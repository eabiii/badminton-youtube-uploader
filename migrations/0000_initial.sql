CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  password_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE upload_lease (
  singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
  lease_id TEXT,
  owner_session_hash TEXT,
  expires_at INTEGER,
  state TEXT,
  upload_url TEXT,
  upload_length INTEGER,
  uploaded_bytes INTEGER,
  video_id TEXT,
  metadata_json TEXT
);

INSERT INTO upload_lease (singleton, state, uploaded_bytes)
VALUES (1, 'idle', 0);

CREATE TABLE players (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
