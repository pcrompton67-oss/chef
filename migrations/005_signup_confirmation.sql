-- 005 · Sign-up boxes ask people to confirm their email address before they
-- join the mailing list (double opt-in). Each sign-up gets a private code for
-- its confirmation link.

ALTER TABLE notify_signups ADD COLUMN IF NOT EXISTS confirm_token text
  NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');
CREATE UNIQUE INDEX IF NOT EXISTS notify_signups_confirm_token_key ON notify_signups (confirm_token);

-- When the confirmation email was last sent (at most one an hour per sign-up).
ALTER TABLE notify_signups ADD COLUMN IF NOT EXISTS confirm_sent_at timestamptz;

-- When they clicked the link (empty = still waiting).
ALTER TABLE notify_signups ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Sign-ups made before this change already put people on the list.
UPDATE notify_signups SET confirmed_at = created_at
 WHERE confirmed_at IS NULL AND confirm_sent_at IS NULL;
