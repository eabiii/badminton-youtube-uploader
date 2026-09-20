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
- [x] Exercise a >64 MiB Private upload against the dedicated test channel and configured playlist.
- [x] Verify two real browsers cannot upload simultaneously.
- [x] Verify secrets/resumable URLs are absent from local browser storage, network responses, built assets, and runtime logs.

Exit achieved: all three local live-integration checks pass. Hosted leak validation remains part of Phase 3.

## Phase 2 — Feature-complete local application

Dependencies: Phase 1 exit.

Focused automated verification confirms the implemented features. The manual NVDA + Chrome pass was
waived and the automated keyboard and accessibility evidence accepted on September 20, 2026.

- [x] Support Singles and Doubles, unique Player positions, date, optional Game Number, description, and visibility.
- [x] Add Player autocomplete/add, rename, merge, and removal API behavior.
- [x] Add generated titles, per-upload Title Name Overrides, sticky Custom Titles, and regeneration.
- [x] Confirm Public uploads and enforce Private visibility for unapproved projects.
- [x] Add success links, Partial Success, Retry playlist, Done, and Upload another (retains only Match Date).
- [x] Recover an in-flight network interruption by releasing the lease and restarting from byte zero.
- [x] Add logout, password-version revocation, persistent cookies, and login rate limiting.
- [x] Share Zod validation between client and server.
- [x] Cover domain rules and upload coordination with automated tests.
- [x] Add exhaustive component and Playwright coverage for all PRODUCT.md interactions.
- [x] Complete keyboard and accessibility acceptance (manual screen-reader pass waived).

Interruption recovery, the interaction matrix, keyboard tests, and automated axe scans are complete.
The developer accepted this evidence and explicitly waived the manual NVDA + Chrome pass; the waiver
is recorded in `docs/accessibility-phase-2.md`.

Exit achieved: every PRODUCT.md behavior passes locally, including browser contention and abandoned
byte-zero restart.

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
