import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";

// Real Supabase round trip. Opt-in: CLOUD_E2E=1 pnpm exec playwright test e2e/cloud.spec.ts --project=desktop
// Needs .env.local with the Supabase keys and a dev/prod server using them on E2E_BASE_URL (default :3000).
test.skip(!process.env.CLOUD_E2E, "set CLOUD_E2E=1 to run against Supabase");
test.use({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ref = new URL(url || "http://x").hostname.split(".")[0];
const admin = () => createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Magic links can't be clicked in CI, so sign in with a password server-side and hand the
// session to the page the same way supabase-js stores it.
async function signedIn(context: BrowserContext, email: string, password: string) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${ref}-auth-token`, JSON.stringify(data.session)] as const);
}

test("capture on one device, see it on another, delete everything", async ({ browser }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = crypto.randomUUID();
  const { data: created, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const uid = created.user.id;
  try {
    const phone = await browser.newContext();
    await signedIn(phone, email, password);
    const page = await phone.newPage();
    await page.goto("/library");
    await page.waitForURL("**/username");
    const username = `e2e_${Date.now().toString(36)}`;
    await page.getByRole("textbox").first().fill(username);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("**/library");

    await page.goto("/add?mode=type");
    await page.getByLabel("Title").fill("Synced Across Devices");
    await page.getByRole("button", { name: "Add book" }).locator("visible=true").click();
    await page.waitForURL("**/book?id=*");
    const bookId = new URL(page.url()).searchParams.get("id")!;
    await page.goto(`/capture?book=${bookId}`);
    await page.getByRole("button", { name: "Type it instead" }).click();
    await page.getByLabel("The passage").fill("A sentence worth keeping.");
    await page.getByRole("button", { name: "Save passage" }).locator("visible=true").click();
    await page.waitForURL("**/book?id=*");

    // The sync engine pushes within a couple of seconds.
    await expect
      .poll(async () => (await admin().from("passages").select("text").eq("user_id", uid)).data?.map((r) => r.text), { timeout: 15_000 })
      .toEqual(["A sentence worth keeping."]);

    // A second device pulls the same library.
    const laptop = await browser.newContext();
    await signedIn(laptop, email, password);
    const p2 = await laptop.newPage();
    await p2.goto(`/book?id=${bookId}`);
    await expect(p2.getByText("A sentence worth keeping.").locator("visible=true").first()).toBeVisible({ timeout: 15_000 });

    // Share it (unlisted, passages on) and read it logged out; unpublishing takes it down at once.
    const { data: book } = await admin().from("books").select("slug").eq("id", bookId).single();
    await admin().from("books").update({ visibility: "unlisted", share: { reflection: false, passages: true, words: false, pages: false, mood: false } }).eq("id", bookId);
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/@${username}/${book!.slug}`);
    await expect(visitor.getByText("A sentence worth keeping.").first()).toBeVisible();
    await admin().from("books").update({ visibility: "private" }).eq("id", bookId);
    expect((await visitor.goto(`/@${username}/${book!.slug}`))!.status()).toBe(404);
  } finally {
    await admin().auth.admin.deleteUser(uid);
  }
  // Cascade removed every row (T6).
  expect((await admin().from("books").select("id").eq("user_id", uid)).data).toEqual([]);
});
