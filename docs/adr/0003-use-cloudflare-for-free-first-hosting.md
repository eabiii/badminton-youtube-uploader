# Use Cloudflare for free-first hosting

Host the desktop web interface on Cloudflare Pages, run application and YouTube integration logic in Workers, and store the Player Directory and global upload lock in D1. To remain within the free plan's 100 MB request-body limit while protecting the centralized YouTube token, the browser splits each video into smaller resumable chunks that Workers relay to YouTube without persistently storing the file. Completed Game Upload metadata is not retained.

## Consequences

The application depends on Cloudflare's platform limits and pricing, which can change. Chunk sizes must remain valid for both Cloudflare and YouTube, the design must tolerate retrying individual chunks, and deployment still incurs domain-registration cost even if platform usage remains within free allowances.
