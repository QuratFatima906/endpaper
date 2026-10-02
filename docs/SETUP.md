# Setting up Endpaper

Everything here is a one-time setup done by the project owner. Without it, the app still runs in
**device-only mode**: one local account, no sync and no public pages.

## 1. Supabase project

1. Create a project at supabase.com. The free tier works, but free projects pause after about a week of inactivity.
2. Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → Project URL, e.g. `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API Keys → **publishable key** (`sb_publishable_…`), or Legacy API keys → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → **secret key** (`sb_secret_…`), or legacy `service_role`. **Server only; never commit it.** |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; your real domain in production |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional. Used for the "your account was deleted" email. |

3. Run the schema. Either paste `supabase/migrations/0001_init.sql` into **SQL Editor → New query → Run**, or use the CLI:

```bash
supabase login --token <personal access token with database read/write>
supabase link --project-ref <ref> -p '<database password>'
supabase db push
```

Delete any personal access token once you're done with it.

## 2. Authentication

### Email (magic link)
On by default. Check **Authentication → Sign In / Providers → Email** is enabled and keep "Confirm email" on.

**Authentication → URL Configuration**
- **Site URL:** `http://localhost:3000` (your real domain in production)
- **Redirect URLs:** add `http://localhost:3000/auth/callback`, and `https://<your-domain>/auth/callback` when you deploy

Supabase's built-in email only sends a few messages per hour, which is fine for testing. For launch, add your own
sender (for example Resend, with a verified domain) under **Authentication → Emails → SMTP Settings**.

### Google

**In Google Cloud Console** (console.cloud.google.com)
1. Create or select a project.
2. **APIs & Services → OAuth consent screen:** choose External, then set the app name (Endpaper), support email and developer email.
   Scopes: `email`, `profile`, `openid`.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID:**
   - Application type: **Web application**
   - Authorised JavaScript origins: `http://localhost:3000` (add your domain later)
   - Authorised redirect URIs: the **Callback URL** shown in Supabase's Google provider panel,
     `https://<ref>.supabase.co/auth/v1/callback`
4. Click **Create** and copy the **Client ID** and **Client secret**.

**In Supabase → Authentication → Sign In / Providers → Google**

| Field | Value |
|---|---|
| Enable Sign in with Google | On |
| Client IDs | Your Client ID (`…apps.googleusercontent.com`) |
| Client Secret (for OAuth) | Your Client secret (`GOCSPX-…`) |
| Skip nonce checks | Off |
| Allow users without an email | Off. Endpaper links Google and magic-link sign-ins by email. |
| Callback URL | Nothing to enter; paste it into Google (step 3 above) |

Click **Save**. While the Google consent screen is in "Testing" mode, only the test users you list there can sign in.
Click **Publish app** when you launch.

## 3. Run it

```bash
pnpm install
pnpm dev        # restart after changing .env.local
pnpm test       # unit tests
pnpm e2e        # end-to-end tests (device-only build)
```

## 4. Deploy (when ready)
- Vercel or Cloudflare Pages. Set the same environment variables there. Vercel's free Hobby plan doesn't allow commercial use.
- Set `NEXT_PUBLIC_SITE_URL`, and update the Supabase Site URL, Redirect URLs and Google origins to the real domain.

## 5. Owner decisions and checks before launch
- Verdict labels: the design uses *Loved it / Liked it / Not for me*, the spec uses *Keep · Lend · Let go*. Change them in `src/lib/marks.ts`.
- Accent colour: ink blue (from the design) or oxblood (the spec's default). Change it with one token in `src/app/globals.css`.
- Have the privacy and terms pages reviewed (`src/app/privacy`, `src/app/terms`).
- Check the copyright rule: only transcribed passage text is ever public, never photos.
- Check the name "Endpaper" (domain, app stores, trademark).
- Analytics: set up Umami or PostHog (cookieless) if you want visitor counts.
- Test on real iPhone and Android devices: camera capture, barcode scanning, installing to the home screen.
