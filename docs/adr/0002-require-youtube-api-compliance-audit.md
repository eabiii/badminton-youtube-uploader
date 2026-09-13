# Require YouTube API compliance approval for production

Complete YouTube's API compliance audit before relying on the application for production uploads. Unaudited API projects force uploaded videos to Private, which conflicts with selectable visibility and the Unlisted default; until approval is granted, testing and fallback uploads remain Private.

## Consequences

Production readiness depends on an external review whose timing and outcome the project does not control. No domain is owned yet, so the work must include acquiring and verifying a domain, HTTPS hosting, a public application home page, and a privacy policy before seeking approval. To meet YouTube's required minimum functionality, the form must expose editable title, description, and visibility fields; every upload uses the fixed Sports category. The application must never claim that an unaudited upload is Unlisted or Public when YouTube has restricted it to Private.
