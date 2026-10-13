# Use a shared password with persistent sessions

Authenticate all Uploaders with one deployment-managed shared password instead of individual accounts or invitations. Successful logins persist across browser restarts without a time-based expiry, matching the intentionally anonymous, low-administration collaboration model.

## Consequences

The application cannot identify individual Uploaders, and a session left on a lost or shared computer remains usable. The password must be stored as a secure hash, login attempts must be rate-limited, a visible logout action must revoke the current session, and changing the deployment password must invalidate every existing session.

The deployment hash uses PBKDF2-HMAC-SHA256 with exactly 100,000 iterations because the Cloudflare Workers Web Crypto implementation rejects higher PBKDF2 iteration counts. Runtime crypto failures are server errors, not incorrect-password responses. The platform-constrained work factor increases the importance of using a long, randomly generated shared password and treating its hash as a deployment secret.
