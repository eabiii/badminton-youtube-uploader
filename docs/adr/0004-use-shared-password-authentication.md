# Use a shared password with persistent sessions

Authenticate all Uploaders with one deployment-managed shared password instead of individual accounts or invitations. Successful logins persist across browser restarts without a time-based expiry, matching the intentionally anonymous, low-administration collaboration model.

## Consequences

The application cannot identify individual Uploaders, and a session left on a lost or shared computer remains usable. The password must be stored as a secure hash, login attempts must be rate-limited, a visible logout action must revoke the current session, and changing the deployment password must invalidate every existing session.
