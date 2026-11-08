# Deploying the WDG demo site to Vercel

Live demo: https://wdg-demo.vercel.app (Vercel team `kill75`, auto-deploys on every push to `main`).

## What's in the project

| Part | Files | Runs where |
|---|---|---|
| Static pages | `*.html`, `style.css`, `fb.js` | Served as-is |
| Contact form backend | `api/contact.js` | Vercel function → emails through Resend |
| Public news feed | `api/news.js`, `news-db.js`, `story.html` | Vercel function → reads Postgres (Neon) |
| News admin | `admin.html`, `admin.js`, `api/admin/login.js`, `api/admin/news.js` | Vercel functions → Postgres + Vercel Blob (photos) |
| Shared helpers | `api/_lib/db.js`, `api/_lib/auth.js` | Not endpoints (names starting with `_` are skipped) |

The 5 original stories are still plain HTML files. Stories added in the admin page appear above them.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Needed for | How it gets there |
|---|---|---|
| `RESEND_API_KEY` | Contact form | You paste it (Resend → API Keys) |
| `CONTACT_TO` | Contact form | You set it. Must be your Resend sign-up email until a domain is verified |
| `CONTACT_FROM` | Contact form (optional) | Only after verifying a domain in Resend |
| `DATABASE_URL` | News | **Added automatically** when you connect a Neon database |
| `BLOB_READ_WRITE_TOKEN` | News photos | **Added automatically** when you connect a Blob store |
| `ADMIN_PASSWORD` | Admin login | You choose it: 10+ characters, mark it **Secret** |
| `ADMIN_SESSION_SECRET` | Admin login (optional) | Any long random text; if unset the password is used |

After adding or changing any variable: **Deployments → ⋯ → Redeploy**.

## Setting up storage (one time)

1. **Database:** Project → **Storage** → **Create Database** → **Neon** (Postgres) → free plan → region close to your users
   (e.g. Frankfurt) → connect to project `wdg-demo`. The `news_posts` table is created automatically on first use.
2. **Photos:** Project → **Storage** → **Create** → **Blob** → access **Public** → connect to project `wdg-demo`.
3. **Admin password:** add `ADMIN_PASSWORD` (type **Secret**).
4. Redeploy.

## Using it

- Admin: `https://wdg-demo.vercel.app/admin.html` → log in → write story → optional photo → Save.
- Text format: blank line = new paragraph; a line starting with `## ` = heading.
- Photos are resized in the browser to max 1600 px before upload.
- New stories show on the News page within about a minute (the list is cached for 60 seconds).

## Troubleshooting

- Vercel → Project → **Logs**: errors from the functions (`[news]`, `[admin/news]`, `Resend error`).
- Resend → **Logs**: why an email was refused.
- Neon (Vercel → Storage → your database → Open in Neon) → **Tables**: see the stored stories.

## Notes

- On GitHub Pages (no backend) the contact form falls back to the visitor's email app and the News page shows only the static stories.
- `website` is a hidden spam-trap field on the contact form.
- Admin security: one shared password, a signed HttpOnly cookie for 8 hours, JSON-only requests (blocks forged
  cross-site requests). Fine for a small team; a customer with many editors would need individual accounts.
