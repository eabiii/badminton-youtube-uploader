# Badminton Uploader

Desktop web application for trusted Uploaders to publish individual badminton Games to one centrally authorized YouTube channel and Destination Playlist.

## Local setup

Requirements: Node.js 24+ and pnpm 12+.

```sh
pnpm install
pnpm wrangler d1 migrations apply badminton-youtube-uploader-local --local
pnpm password:hash
cp .dev.vars.example .dev.vars
```

Put the generated hash in `SHARED_PASSWORD_HASH` in `.dev.vars`, then run:

```sh
pnpm dev
```

Local development uses the deterministic fake YouTube publisher. It accepts bytes and returns stable fake video links without contacting YouTube.

Sessions have no server-side time expiry and remain revocable. Because browsers impose cookie lifetime limits, the secure, HTTP-only session cookie uses a rolling 400-day maximum that is refreshed on every authenticated request. Increment `PASSWORD_VERSION` whenever the deployed shared password changes to invalidate every existing session.

## Live test configuration

Set `YOUTUBE_MODE=live` and configure these secrets through Wrangler; do not put them in source or `wrangler.jsonc`:

- `SHARED_PASSWORD_HASH`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `YOUTUBE_PLAYLIST_ID`

Keep `YOUTUBE_AUDIT_APPROVED=false` until the API project has passed the YouTube compliance audit. The backend will force effective Visibility to Private while it is false.

Before completing Phase One, use the dedicated test channel locally to exercise a file larger than 64 MiB, verify contention from two real browsers, and inspect browser storage, network responses, built assets, and runtime logs for credentials and YouTube resumable-session URLs. Record that evidence before checking the remaining live-integration items in `PLAN.md`; hosted leak validation remains Phase Three work.

## Verification

```sh
pnpm check
pnpm test
pnpm test:e2e
pnpm build
pnpm dev
```
