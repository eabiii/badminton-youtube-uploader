# Badminton Uploader Product Brief

## Outcome

Badminton Uploader is a simple, English-only desktop web application for publishing individual badminton games to one YouTube channel. It replaces repetitive metadata entry for roughly 20 uploads per week while leaving post-upload video management to YouTube Studio.

## Users and access

- Multiple trusted Uploaders access the application over the internet.
- All Uploaders use one shared password; there are no individual accounts or invitations.
- A remembered login has no time-based expiry. Logout revokes the current session, and changing the deployment password revokes all sessions.
- The application uses one centrally stored authorization from the YouTube channel owner.
- The shared password, YouTube authorization, channel, and Destination Playlist are deployment-only configuration.

## Game Upload form

The form accepts one upload at a time and contains:

- One MP4 file no larger than 2 GB, selected with the file picker or drag and drop.
- Match Type: `Singles Match` or `Doubles Match`, defaulting to `Doubles Match`.
- Two unique Players for Singles or four unique Players for Doubles.
- A required, explicitly selected Match Date.
- An optional Game Number that starts blank.
- A generated title with a live character count and a 100-character maximum.
- An editable Description that starts blank.
- Visibility: `Private`, `Unlisted`, or `Public`, defaulting to `Unlisted`.

Audience is fixed to Not made for kids. Category is fixed to Sports. Every successfully uploaded video is added to the one configured Destination Playlist. Scheduled publishing is not supported.

## Title rules

Without Game Number:

`Player 1 vs Player 2 | Singles Match | September 7, 2026`

`Player 1/Player 2 vs Player 3/Player 4 | Doubles Match | September 7, 2026`

With Game Number:

`Player 1 vs Player 2 | Singles Match | Game 1 | September 7, 2026`

`Player 1/Player 2 vs Player 3/Player 4 | Doubles Match | Game 2 | September 7, 2026`

Month names are always English. An Uploader may shorten a Player name for the current upload without changing the Player Directory. The Uploader may also freely edit the final title; after it becomes a Custom Title, changes to structured fields preserve it until the Uploader explicitly regenerates it.

## Player Directory

- Player selection provides autocomplete.
- An unknown Player can be added from the upload form.
- Uploaders can rename, merge, or remove Players.
- Names are trimmed and compared case-insensitively for uniqueness while retaining entered capitalization.
- The same Player cannot occupy more than one position in a Game.

## Upload lifecycle

- Only one upload may be active across the entire application; there is no queue.
- Another Uploader sees a busy state while the global upload lock is held.
- Video data is split into sub-100 MB chunks and relayed through the backend to YouTube without persistent video storage or exposing the centralized token.
- An Uploader may cancel, which abandons the upload and releases the lock.
- A network interruption, closed tab, or computer restart requires beginning again from byte zero.
- Abandoned server-side state expires and releases the lock automatically.
- Public visibility requires an additional confirmation immediately before upload.
- If the YouTube video succeeds but playlist addition fails, the current screen offers Retry playlist addition or Accept partial success. Retry never uploads the video again.
- Success means YouTube accepted the video and playlist addition succeeded; processing and copyright checks continue in YouTube Studio.
- The success screen shows the YouTube watch link and direct YouTube Studio edit link, followed by Done and Upload another.
- Upload another retains only Match Date. File, Players, Match Type, Game Number, title state, Description, and Visibility reset.

## Data retention and excluded capabilities

- Persist only the Player Directory, authentication/session data, and the global upload lock.
- Do not retain video files or completed Game Upload metadata.
- Do not provide upload history, duplicate-title detection, post-upload correction, deletion, scheduling, batch selection, or an upload queue.
- All post-upload changes and video deletion occur in YouTube Studio.

## Hosting and compliance

- Use Cloudflare Pages, Workers, and D1 with a free-first deployment.
- A domain has not yet been acquired. Domain registration, verification, HTTPS hosting, a public homepage, and a privacy policy are prerequisites for production review.
- Pursue both applicable Google OAuth verification and the YouTube API compliance audit.
- Before YouTube approves the API project, uploads are restricted to Private regardless of the requested visibility; the application must represent that truthfully.

## Deferred

- Custom branding, logo design, and refinement of the application's display title.
- Individual user identities, invitations, roles, and activity history.
- Mobile support and multiple YouTube channels.
