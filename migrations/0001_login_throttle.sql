CREATE TABLE login_attempts (
  client_hash TEXT PRIMARY KEY NOT NULL,
  failed_count INTEGER NOT NULL,
  window_started_at INTEGER NOT NULL
);
