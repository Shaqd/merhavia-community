-- BBQ events. Events are closed, never deleted, so history accumulates across them.
CREATE TABLE bbq_events (
  id                      INTEGER PRIMARY KEY,
  title                   TEXT NOT NULL,
  starts_at               TEXT NOT NULL,  -- ISO 8601, UTC
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  price_per_person_agorot INTEGER CHECK (price_per_person_agorot >= 0),  -- money in agorot: ₪70 = 7000
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
