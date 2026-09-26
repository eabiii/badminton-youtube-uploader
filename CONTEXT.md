# Badminton Uploader

This context describes the people, matches, games, and publishing choices used to turn recorded badminton games into consistently titled YouTube videos.

## Language

**Player**:
A badminton participant identified by one canonical display name used in video titles.
_Avoid_: Person, competitor

**Player Directory**:
The shared collection of known Players available for autocomplete. Uploaders may add, rename, merge, or remove entries.
_Avoid_: Roster, player list

**Queuing Session**:
A badminton session identified for title purposes by a Queuing Name and Queue Location rather than by specific Players and a Match Type.
_Avoid_: Upload queue, queued upload

**Queuing Directory**:
The shared collection of saved Queuing Names and Queue Locations available for Game Upload selection.
_Avoid_: Session history, upload queue

**Queuing Name**:
The display name that identifies a Queuing Session within the Queuing Directory.
_Avoid_: Match name, playlist name

**Queue Location**:
The venue display name paired with a Queuing Name in the Queuing Directory.
_Avoid_: Upload destination, queue position

**Title Name Override**:
A shorter Player name used only for one Game Upload when the generated title would exceed YouTube's title limit. It does not change the Player's canonical display name.
_Avoid_: Rename, nickname

**Custom Title**:
A generated video title that an Uploader has freely edited before submission. It remains subject to YouTube's non-empty and 100-character title constraints.
_Avoid_: Title Name Override

**Match**:
A badminton contest between two Sides, assigned a Match Type and comprising one or more Games.
_Avoid_: Video

**Match Type**:
The Match classification displayed in a video title. Its only values are `Singles Match` and `Doubles Match`.
_Avoid_: Singles, Doubles, type of game

**Game**:
A numbered segment within a Match. Each uploaded video contains exactly one Game.
_Avoid_: Match, set, video

**Game Number**:
The optional title qualifier that identifies a Game's position within its Match, such as 1 or 2. When omitted, no game number appears in the video title.
_Avoid_: Video number

**Side**:
One participant in a Match: one Player in Singles or two Players in Doubles.
_Avoid_: Team

**Match Date**:
The calendar date on which a Match was played, independent of when its video is uploaded or published. Titles render it in English as `Month D, YYYY`.
_Avoid_: Upload date, publication date

**Game Upload**:
The transient submission of one Game and its publishing choices to YouTube. It uses either the Player Match or Queuing Session title format; the application discards it after completion and does not retain upload history or support later corrections.
_Avoid_: Match Upload, Upload Job, stored video

**Uploader**:
A trusted application user who already has access to the YouTube channel and may create Game Uploads and maintain the Player Directory.
_Avoid_: Editor, channel owner

**Destination Playlist**:
The single YouTube playlist to which every Game Upload is added.
_Avoid_: Selected playlist, upload playlist

**Visibility**:
The YouTube availability assigned to a Game Upload. It is chosen per upload from Private, Unlisted, or Public and defaults to Unlisted; scheduled publishing is not supported.
_Avoid_: Privacy

**Partial Success**:
A temporary state in which a Game Upload's video exists on YouTube but has not been added to the Destination Playlist. During the current session, the Uploader can retry the playlist step without uploading the video again or accept the result and discard the state.
_Avoid_: Failed upload, retry upload
