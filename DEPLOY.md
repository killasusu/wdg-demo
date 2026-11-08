# Deploying the WDG demo site to Vercel

The site is plain HTML/CSS/JS plus one serverless function:

- `*.html`, `style.css`, `fb.js` – static pages, served as-is
- `api/contact.js` – backend for the contact form (`POST /api/contact`), sends the message by email through Resend

## 1. Email service (Resend)

1. Sign up at https://resend.com with **director@womendevelopmentgroup.org**.
2. API Keys → Create API key (permission: "Sending access"). Copy it (starts with `re_`).

Until you verify a domain, Resend can only deliver to the address you signed up with – that's fine for testing.
For a customer, add their domain in Resend → Domains, add the DNS records it shows, then set `CONTACT_FROM`
to something like `Website <website@theirdomain.org>`.

## 2. Vercel

1. Sign up at https://vercel.com with GitHub (account killasusu).
2. Add New → Project → import **killasusu/wdg-demo**.
3. Framework preset: **Other**. Leave build/output settings empty. Deploy.
4. Settings → Environment Variables, add:
   - `RESEND_API_KEY` = your key
   - `CONTACT_TO` = director@womendevelopmentgroup.org (optional, this is the default)
   - `CONTACT_FROM` = optional, default `WDG Website <onboarding@resend.dev>`
5. Deployments → ⋯ → Redeploy (env vars only apply to new deployments).

Every `git push` to `main` now deploys automatically. Pushes to other branches get preview URLs.

## 3. Test

Open `https://<project>.vercel.app/contact.html`, send a message, check the inbox.
If it fails: Vercel → Project → Logs shows the error from `api/contact.js`.

## Notes

- On GitHub Pages (no backend) the form falls back to opening the visitor's email app.
- `website` is a hidden spam-trap field; submissions that fill it are silently dropped.
