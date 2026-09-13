# Centralize YouTube authorization

Use one securely stored authorization from the YouTube channel owner for all uploads. Although each Uploader must already have channel access, YouTube Studio delegates cannot act on that channel through the YouTube API; centralized authorization therefore enables the shared workflow without sharing the owner's Google credentials.

## Consequences

The application must still prevent unauthorized use, protect the channel owner's refresh token as a high-value secret, and account for the fact that application access cannot be verified against YouTube Studio delegates through the API. The YouTube authorization, Destination Playlist, and shared application password are deployment-only settings and cannot be changed through the application interface. Revoking the central authorization disables YouTube operations for every Uploader.
