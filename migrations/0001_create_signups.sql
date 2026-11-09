-- Waitlist sign-ups (ADR-0004). One row per normalised address per list (`source`), with the
-- consent evidence GDPR asks for: when consent was given and which privacy notice it was given under.
CREATE TABLE signups (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  privacy_notice_version TEXT NOT NULL,
  UNIQUE (email, source)
);
