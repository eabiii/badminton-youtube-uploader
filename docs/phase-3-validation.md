# Phase 3 hosted validation evidence

Evidence for the Cloudflare Private beta. An item is recorded here only after it was observed on the hosted Workers.

## Deployment workflows — October 15, 2026

- **Deploy staging** ran from `main`. The first run left the fixed Preview without secrets, because each `wrangler preview` deployment replaces its secrets and Preview base-config secrets were not inherited. After commit `8e36b9b` uploaded the staging secrets with `--secrets-file`, a run left all five Preview secrets present and `/api/health` returned `200`.
- **Deploy production** ran from `main`. All five Worker secrets were still present afterwards, `/api/health` returned `200` (it returned `500` before the first deploy), `/` returned `200`, an unauthenticated `/api/session` returned `401`, and no D1 migrations remained.

## Staging authentication — October 15, 2026

`scripts/hosted-auth-check.mjs` against the staging Worker passed all 20 checks:

- `/api/health` and `/` return `200`; `/api/session` returns `401` without a session.
- Login succeeds; the session cookie is HttpOnly, Secure, and persistent.
- `/api/session` reports the live publisher with audit approval disabled.
- Logout succeeds and the logged-out session is revoked.
- Five failed logins return `401`, the sixth returns `429` with `Retry-After: 59`, and login succeeds again after the one-minute window.

## Still to validate

- Private upload larger than 64 MiB into the Destination Playlist, two-browser contention, cancellation, lease expiry, and storage/network leak review on staging.
- PBKDF2 CPU cost on Cloudflare, near-2 GB upload, OAuth rotation, and D1 Time Travel recovery.
- Production smoke upload, rollback drill, and the trusted-Uploader beta.
