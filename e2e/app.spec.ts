import { expect, test, type Page } from "@playwright/test";

// Runs in device-only mode (no Supabase env): the full private app works locally.

async function start(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("reader@example.com");
  await page.getByRole("button", { name: /Start on this device|Send me a sign-in link/ }).click();
  await page.waitForURL("**/username");
  await page.getByRole("textbox").first().fill("reader_one");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/library");
}

async function addBook(page: Page, title: string) {
  await page.goto("/add?mode=type");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Author").fill("Some Author");
  await page.getByRole("button", { name: "Add book" }).locator("visible=true").click();
  await page.waitForURL("**/book?id=*");
}

test("T11: logged-out visitors are sent to sign-in", async ({ page }) => {
  for (const path of ["/library", "/book?id=x", "/settings", "/capture"]) {
    await page.goto(path);
    await page.waitForURL((u) => u.pathname === "/");
  }
});

test("deep links survive a reload", async ({ page }) => {
  await start(page);
  await page.goto("/inbox");
  await page.reload();
  await expect(page).toHaveURL(/\/inbox$/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings$/);
});

test("add a book, type a passage, find it again", async ({ page }) => {
  await start(page);
  await addBook(page, "A Quiet Test Book");
  await expect(page.getByRole("heading", { level: 1, name: "A Quiet Test Book" })).toBeVisible();
  const bookUrl = page.url();

  // Exit preview returns to the book even when the preview was opened directly.
  await page.goto(bookUrl.replace("/book?", "/preview?"));
  await page.getByRole("link", { name: /Exit/ }).click();
  await page.waitForURL(bookUrl);

  await page.goto(bookUrl.replace("/book?id=", "/capture?book="));
  await page.getByRole("button", { name: "Type it instead" }).click();
  await page.getByLabel("The passage").fill("Nothing is so tiring as a thing left undone.");
  await page.getByRole("button", { name: /^¶/ }).click();
  await page.getByRole("button", { name: "Save passage" }).locator("visible=true").click();
  await page.waitForURL("**/book?id=*");
  await expect(page.getByText("Nothing is so tiring as a thing left undone.").locator("visible=true").first()).toBeVisible();

  // With no query, "All" lists every book.
  await page.goto("/search");
  await expect(page.getByText("A Quiet Test Book").locator("visible=true").first()).toBeVisible();

  await page.goto("/search?q=tiring");
  await expect(page.locator("mark", { hasText: "tiring" }).first()).toBeVisible();
});

test("opens with no network after the first visit", async ({ page, context }) => {
  await start(page);
  await addBook(page, "Offline Companion");
  await page.goto("/library");
  // Wait for the service worker to take control and precache the shells.
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller, null, { timeout: 30_000 });
  await page.waitForFunction(async () => (await caches.open("shell-v1").then((c) => c.keys())).length >= 10, null, { timeout: 30_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Offline Companion").first()).toBeVisible();
  await page.goto("/add?mode=type"); // cold load of a route never opened in this session
  await expect(page.getByLabel("Title")).toBeVisible();
  await addBook(page, "Written While Offline");
  await expect(page.getByRole("heading", { level: 1, name: "Written While Offline" })).toBeVisible();
});
