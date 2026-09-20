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

### Refresh the central YouTube authorization

Google Cloud Console does not display an existing refresh token. Generate a replacement by completing OAuth consent again as the owner of the YouTube channel:

1. In Google Cloud Console, open **Google Auth Platform → Clients** and select the OAuth client whose ID and secret are configured for the application.
2. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI for that client.
3. Open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/), select the settings gear, and enable **Use your own OAuth credentials**.
4. Enter the exact `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` configured for the application. Do not use the Playground's default credentials.
5. Authorize `https://www.googleapis.com/auth/youtube.force-ssl` while signed in as the channel owner.
6. Exchange the authorization code for tokens and copy the returned refresh token.
7. For local development, replace `YOUTUBE_REFRESH_TOKEN` in `.dev.vars`. For a deployed environment, update the corresponding Wrangler secret.
8. Restart the local development server or redeploy the configured environment before retrying a Game Upload.

The client ID, client secret, and refresh token must belong to the same OAuth client. If a new OAuth client was created, update all three values together. An `invalid_grant` response usually means the refresh token expired or was revoked; `unauthorized_client` usually means the refresh token was issued for a different OAuth client. Never commit or share any of these values.

## Verification

```sh
pnpm check
pnpm test
pnpm test:e2e
pnpm build
pnpm dev
```
