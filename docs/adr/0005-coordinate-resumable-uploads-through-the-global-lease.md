# Coordinate resumable uploads through the global lease

Keep the active YouTube resumable-session URL and transient progress inside the server-only global upload lease. Give the browser only an opaque lease ID and the YouTube-confirmed byte offset. Route the fake and live YouTube implementations through one publisher interface owned by the upload coordinator.

## Consequences

The browser can send video chunks and display progress without receiving the centralized OAuth token or YouTube resumable-session URL. Every retry first reconciles against YouTube's offset; if YouTube already completed the video after a lost response, the coordinator proceeds directly to Destination Playlist insertion. Expiration, cancellation, successful playlist insertion, or accepted Partial Success clears all transient lease fields. The D1 lease is the only durable location for active coordination state, and application logs must never include its resumable-session URL.
