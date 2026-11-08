-- People. Only the hub writes this table; every app reads it.
CREATE TABLE hub_users (
  id           INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,         -- Hebrew name shown in every app
  phone        TEXT NOT NULL UNIQUE,  -- E.164, e.g. +972501234567: the sign-in identifier
  email        TEXT,                  -- where sign-in codes go; set when the person accepts an invite
  status       TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
