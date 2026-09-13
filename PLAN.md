# Badminton Uploader Delivery Plan

This checklist is the implementation source of truth. A checked item has automated verification or has been exercised locally; unchecked items remain delivery work.

## Defaults and constraints

- 64 MiB browser chunks; 30-second heartbeats; five-minute upload lease.
- Sessions have no time-based expiry and are renewed on authenticated use.
- Player uniqueness uses trim, Unicode NFKC normalization, and locale-independent case folding.
- Until `YOUTUBE_AUDIT_APPROVED=true`, requested visibility is truthfully forced to Private.
- Video bytes, completed metadata, OAuth credentials, refresh tokens, and resumable URLs are never persisted in browser storage.

## Phase 1 — Risk-focused local proof

Dependencies: a dedicated test channel, its refresh token, and a Destination Playlist.

- [x] Scaffold React, Vite, strict TypeScript, Tailwind, Hono, D1/Drizzle, Vitest, and Wrangler.
- [x] Add shared-password login and persistent, revocable sessions.
- [x] Add a singleton upload lease with heartbeat, abandonment, and busy state.
- [x] Add a minimal-to-complete Game Upload form.
- [x] Implement backend-owned OAuth refresh and resumable upload relay in 64 MiB chunks.
- [x] Add cancellation, server-offset reconciliation, playlist-only retry, and Partial Success acceptance.
- [x] Add a deterministic fake YouTube publisher for automated/local testing.
- [ ] Exercise a >64 MiB Private upload against the dedicated test channel and configured playlist.
- [ ] Verify two real browsers cannot upload simultaneously.
- [ ] Verify secrets/resumable URLs are absent from local browser storage, network responses, built assets, and runtime logs.

Exit: the three unchecked local live-integration checks pass. Hosted leak validation remains part of Phase 3.

## Phase 2 — Feature-complete local application

Dependencies: Phase 1 exit.

Implementation and automated coverage are present, but these items remain unchecked until the Phase 1 live-test exit criteria and the corresponding local acceptance evidence pass.

- [ ] Support Singles and Doubles, unique Player positions, date, optional Game Number, description, and visibility.
- [ ] Add Player autocomplete/add, rename, merge, and removal API behavior.
- [ ] Add generated titles, per-upload Title Name Overrides, sticky Custom Titles, and regeneration.
- [ ] Confirm Public uploads and enforce Private visibility for unapproved projects.
- [ ] Add success links, Partial Success, Retry playlist, Done, and Upload another (retains only Match Date).
- [ ] Add logout, password-version revocation, persistent cookies, and login rate limiting.
- [ ] Share Zod validation between client and server.
- [ ] Cover domain rules and upload coordination with automated tests.
- [ ] Add exhaustive component and Playwright coverage for all PRODUCT.md interactions.
- [ ] Complete a keyboard/screen-reader accessibility pass.

Exit: every PRODUCT.md behavior passes locally, including browser contention and abandoned byte-zero restart.

## Phase 3 — Cloudflare Private beta

Dependencies: Phase 2 exit, Cloudflare account/project, and preview/production secrets.

- [ ] Define Pages Functions bindings, D1 migrations, environment validation, health endpoint, CI checks, and deployment notes.
- [ ] Create preview and production Pages/D1 resources and apply migrations.
- [ ] Configure secrets and authorize the dedicated test channel.
- [ ] Add preview deployment workflow after Cloudflare credentials are available.
- [ ] Validate PBKDF2 CPU cost, streaming, lease heartbeats, near-2 GB uploads, OAuth rotation, and D1 recovery on Cloudflare.
- [ ] Run hosted trusted-Uploader beta and rollback drill.

Exit: hosted beta uploads truthfully as Private and operational validations pass. Move to Workers Paid if secure password verification exceeds Free CPU limits.

## Phase 4 — Compliance and production

Dependencies: chosen domain and ownership of Google/YouTube project.

- [ ] Provide public home and initial privacy-policy routes.
- [ ] Acquire/verify domain and finalize public content.
- [ ] Configure production Google consent screen, owner authorization, and Destination Playlist.
- [ ] Prepare demonstration and submit OAuth verification and YouTube API compliance audit.
- [ ] Confirm approvals and enable Unlisted/Public only with `YOUTUBE_AUDIT_APPROVED=true`.
- [ ] Run production smoke upload and prove production contains no test-channel credentials.
- [ ] Finish incident response and production operations documentation.

Exit: approvals are confirmed and requested/effective visibility match in production.

## Verification commands

```sh
pnpm check
pnpm test
pnpm test:e2e
pnpm build
pnpm dev
```
