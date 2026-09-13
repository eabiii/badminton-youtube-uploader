# Badminton Uploader

English-only desktop web application for trusted Uploaders to publish individual badminton Games to one centrally authorized YouTube channel and Destination Playlist. The repository is currently specification-only; treat the stack below as planned until the application scaffold exists.

## Read these before changing anything

| File         | What it defines                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| `CONTEXT.md` | Canonical domain language. Use these terms consistently in code, UI copy, tests, and documentation.       |
| `PRODUCT.md` | Required product behavior, constraints, exclusions, and deferred work.                                    |
| `PLAN.md`    | Delivery order, current implementation status, defaults, exit criteria, and verification commands.        |
| `docs/adr/`  | Architectural decisions and their consequences. Read the relevant ADR before changing a settled decision. |

If documents appear to conflict, preserve the architectural decisions in the ADRs, use `PRODUCT.md` for product intent, and update `PLAN.md` to reflect the resulting delivery work. Do not silently invent behavior to resolve a material conflict.

## Planned stack

React · Vite · strict TypeScript · Tailwind CSS · Hono · Cloudflare Pages and Workers · D1 with Drizzle · Zod · Vitest · Playwright · Wrangler.

Prefer shared domain logic and validation over separate client and server interpretations. Keep platform and framework dependencies out of pure domain code where practical.

## Domain language

- Use **Player**, **Player Directory**, **Title Name Override**, **Custom Title**, **Match**, **Match Type**, **Game**, **Game Number**, **Side**, **Match Date**, **Game Upload**, **Uploader**, **Destination Playlist**, **Visibility**, and **Partial Success** as defined in `CONTEXT.md`.
- Do not substitute the discouraged terms listed there. In particular, one uploaded video is a Game, not a Match, and a Side is not a team.
- Match Type values are exactly `Singles Match` and `Doubles Match`.
- A Game Upload is transient. It is not an upload-history record or a durable job.

## Rules that are easy to break

These rules protect credentials, preserve truthful YouTube behavior, or define the core workflow. They are not optional style preferences.

### YouTube authorization and compliance

- All uploads use one centrally stored authorization from the YouTube channel owner. Never expose OAuth credentials, refresh tokens, access tokens, or YouTube resumable-session URLs to browser-readable persistence or logs.
- Keep refresh and upload coordination on the backend. The browser may send video chunks but must not receive the centralized YouTube token.
- Until `YOUTUBE_AUDIT_APPROVED=true`, force the effective Visibility to Private and represent that restriction truthfully in the UI and responses. Never claim an upload is Unlisted or Public when YouTube will restrict it to Private.
- Audience is always Not made for kids, category is always Sports, and every successful upload is added to the configured Destination Playlist.
- Public Visibility requires a confirmation immediately before upload. Scheduled publishing is out of scope.

### Upload lifecycle and retention

- Allow only one active upload across the whole application. There is no queue.
- Use 64 MiB browser chunks, 30-second heartbeats, and a five-minute upload lease. Reconcile retries against the server/YouTube offset rather than assuming the client offset is authoritative.
- Cancellation abandons the upload and releases the lease. A network interruption, closed tab, computer restart, or expired lease requires restarting from byte zero.
- If video creation succeeds but playlist insertion fails, enter Partial Success. Retrying the playlist step must never upload the video again; accepting Partial Success discards the transient state.
- Never persist video bytes or completed Game Upload metadata. Persist only the Player Directory, authentication/session data, and the global upload lease.
- Do not add upload history, duplicate-title detection, post-upload correction, deletion, scheduling, batch selection, or an upload queue. Those capabilities are explicitly excluded.

### Authentication

- Uploaders share one deployment-managed password; do not introduce individual accounts, invitations, roles, or user activity history.
- Store the password as a secure hash, rate-limit login attempts, and use persistent revocable sessions with no time-based expiry.
- Logout revokes the current session. Changing the deployed password must invalidate every existing session, such as through password-version revocation.
- The password, YouTube authorization, channel, and Destination Playlist remain deployment configuration and are not editable in the application.

### Players and titles

- Normalize Player uniqueness by trimming, applying Unicode NFKC normalization, and using locale-independent case folding while retaining canonical display capitalization.
- A Player cannot occupy more than one position in a Game. Singles requires two unique Players; Doubles requires four.
- Title Name Overrides affect only the current upload and never rename a Player in the Player Directory.
- Once an Uploader edits a generated title, it is a Custom Title. Structured-field changes must preserve it until the Uploader explicitly regenerates it.
- Titles must be non-empty and at most 100 characters. Render Match Dates with English month names using the formats specified in `PRODUCT.md`.
- `Upload another` retains only Match Date; reset the file, Players, Match Type, Game Number, title state, Description, and Visibility.

### Hosting and operations

- Keep the architecture Cloudflare free-first: Pages for the web interface, Workers for backend/integration logic, and D1 for durable application state.
- Do not add persistent video storage as a workaround for platform limits. Chunking must remain compatible with both Cloudflare request limits and YouTube resumable uploads.
- Treat the YouTube refresh token and shared-password material as high-value secrets. Keep secrets out of source, client bundles, diagnostics, and logs.
- Use the deterministic fake YouTube publisher for automated and local tests; live integration checks require the dedicated test channel and configured playlist.

## Working with the delivery plan

- Follow the phases and dependencies in `PLAN.md`; do not mark later work complete merely because its code exists before an earlier exit criterion passes.
- A checked item means it has automated verification or has been exercised locally. Check an item only after that evidence exists.
- Keep `PLAN.md` aligned when implementation materially changes delivery status, defaults, dependencies, or verification expectations.
- Record non-obvious architectural changes in an ADR rather than quietly reversing an existing decision.

## Verification

Run the checks relevant to the change. Once the scaffold provides them, the full verification set is:

```sh
pnpm check
pnpm test
pnpm build
pnpm dev
```

Add focused unit tests for domain and validation rules, integration tests for authentication/upload coordination, component tests for interactions, and Playwright coverage for the end-to-end behaviors in `PRODUCT.md`. Test failure modes such as contention between browsers, lease abandonment, offset reconciliation, cancellation, Private-only compliance enforcement, and playlist Partial Success.

## Commits

Follow [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>[optional scope]: <description>
```

Examples:

```text
feat(upload): relay resumable video chunks
fix(auth): revoke sessions after password change
docs: record the deployment workflow
```

- Keep messages short. A subject line is usually enough.
- Use a lowercase Conventional Commit type and a concise imperative description without a trailing period.
- Add a body only when the reason for the change is not obvious from the diff. Do not use it to narrate files or progress.
- Never add a `Co-Authored-By` trailer, including for assistant-authored changes.

### Never commit unless explicitly instructed

- Do not stage or commit changes unless the developer explicitly asks. Editing files, completing a task, or reaching a checkpoint is not permission to stage or commit.
- Leave changes unstaged by default so the developer can review the working-tree diff.
- If the developer has already staged files, preserve that staging boundary. Do not add unrelated paths.
- Never push unless explicitly instructed. Permission to commit is not permission to push.
