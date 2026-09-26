CREATE TABLE queuing_entries (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  normalized_location TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX queuing_entries_normalized_name_location_unique
ON queuing_entries (normalized_name, normalized_location);
