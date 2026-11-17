-- 003 · Site settings and a log of every email sent.

CREATE TABLE IF NOT EXISTS settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind         text NOT NULL,          -- e.g. 'order_confirmation', 'reminder'
  to_email     text NOT NULL,
  subject      text,
  order_id     bigint REFERENCES orders (id) ON DELETE SET NULL,
  event_id     bigint REFERENCES events (id) ON DELETE SET NULL,
  status       text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider_id  text,                   -- id returned by the email service
  error        text,
  sent_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_log_order_idx ON email_log (order_id);
CREATE INDEX IF NOT EXISTS email_log_kind_event_idx ON email_log (kind, event_id);
