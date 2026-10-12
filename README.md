# EmDash Resend Email

[![npm version](https://img.shields.io/npm/v/emdash-resend-email)](https://www.npmjs.com/package/emdash-resend-email)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

[Resend](https://resend.com) email provider for [EmDash CMS](https://emdashcms.com). Magic links.
Invites. Account recovery. Plugin email. Delivered.

EmDash ships without a production email provider, so your first magic link greets you with
_"Email is not configured"_. This plugin is the missing piece: one hook, one API, one key.

- **Sandboxed format.** Runs in-process on any EmDash site, or inside a plugin sandbox if you have
  one.
- **Your key stays a secret.** You paste it into the admin, EmDash encrypts it with
  `EMDASH_ENCRYPTION_KEY`, and it never touches your build, config or server bundle.
- **Nothing dropped.** `to`, `cc`, `replyTo`, `subject`, `text`, `html` — everything EmDash hands
  over reaches Resend.
- **Errors you can read.** Wrong key or unverified domain? Resend's own message shows up in
  **Settings → Email → Send test email**, not buried in a log.
- **Minimal access.** It asks for the email transport hook and network access to `api.resend.com`.
  That's the whole list.

## Requirements

- EmDash `>=1.2.0 <2.0.0`.
- `EMDASH_ENCRYPTION_KEY` in the site's runtime environment. Generate one with
  `npx emdash secrets generate` and back it up — lose it and every encrypted setting goes with it.
- A Resend account with a [verified domain](https://resend.com/domains) and an
  [API key](https://resend.com/api-keys). Give the key **Sending access** only, restricted to that
  domain. Least privilege is cheaper than an incident.

## Install

```bash
npm install emdash-resend-email
```

Add it to `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import resend from "emdash-resend-email";

export default defineConfig({
  integrations: [
    emdash({
      // ...database and storage
      plugins: [resend],
    }),
  ],
});
```

Running a [plugin sandbox](https://docs.emdashcms.com/deployment/plugin-sandbox/)? Use
`sandboxed: [resend]` instead.

## Configure

1. Open **Plugins** in the EmDash admin and click the settings icon next to **resend**.
2. Enter the API key, a sender address on your verified domain, and an optional sender name.
3. Open **Settings → Email**. If more than one provider is installed — `astro dev` adds EmDash's
   console provider — select **resend**.
4. Hit **Send test email**. If it lands, you're done.

Rotating the key: create a new one in Resend, paste it into the plugin settings, revoke the old
one. In that order, unless you enjoy downtime.

## Troubleshooting

| Message | What it means |
| --- | --- |
| `Resend is not configured` | The API key or sender address is missing in the plugin settings. |
| `Resend rejected the email (403 validation_error): … domain is not verified` | Your sender is not on a domain verified in Resend. |
| `Resend rejected the email (401 …)` or `(403 …)` about the API key | The key is wrong, revoked, or lacks Sending access. |
| `Resend rejected the email (429 …)` | You hit Resend's rate limit or sending quota. |

## What it sends, what it logs

Each message goes to `https://api.resend.com/emails` from your configured sender. The plugin logs
the Resend message ID and the message source (`system` or the sending plugin's ID). Never
recipients. Never content.

## Development

```bash
bun install
bun run check       # Ultracite (Biome)
bun run typecheck   # TypeScript 7
bun run test        # validates the manifest, builds, runs the plugin in EmDash's sandbox host
bun run build
```

`bun run test` loads the plugin through `@emdash-cms/plugin-test` with EmDash's production sandbox
wrapper and a fake Resend API. No network, no real email, no surprises in your inbox.

## License

MIT — [Vibe Code](https://vcode.sh)
