-- 002 · Customers, "notify me" sign-ups, orders and order lines.

CREATE TABLE IF NOT EXISTS customers (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               text    NOT NULL,
  email              text    NOT NULL,
  mobile             text,
  language           text    NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  marketing_consent  boolean NOT NULL DEFAULT false,
  consent_at         timestamptz,
  unsubscribed_at    timestamptz,
  is_test            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- One customer per email address, whatever the capitals.
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_key ON customers (lower(email));

-- People who asked to be told when the next event (or a given one) opens.
CREATE TABLE IF NOT EXISTS notify_signups (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email        text NOT NULL,
  name         text,
  language     text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  event_id     bigint REFERENCES events (id) ON DELETE CASCADE,  -- empty = any event
  notified_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notify_signups_email_event_key
  ON notify_signups (lower(email), coalesce(event_id, 0));

CREATE TABLE IF NOT EXISTS orders (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id             bigint  NOT NULL REFERENCES events (id),
  collection_point_id  bigint  NOT NULL REFERENCES collection_points (id),
  customer_id          bigint  REFERENCES customers (id) ON DELETE SET NULL,
  diners               integer NOT NULL CHECK (diners > 0),
  name                 text    NOT NULL,
  mobile               text    NOT NULL,
  email                text    NOT NULL,
  allergies            text,
  notes                text,
  language             text    NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  -- How the order reached Eleanor.
  source               text    NOT NULL DEFAULT 'website'
                       CHECK (source IN ('website', 'phone', 'whatsapp', 'email', 'messenger', 'in_person')),
  -- How the deposit is paid.
  payment_method       text    NOT NULL
                       CHECK (payment_method IN ('card', 'bank_transfer', 'cash', 'cheque')),
  -- held: places kept while waiting for payment (see hold_expires_at)
  -- awaiting_transfer: waiting for a bank transfer to arrive
  -- confirmed: deposit received · cancelled · expired: hold ran out unpaid
  status               text    NOT NULL DEFAULT 'held'
                       CHECK (status IN ('held', 'awaiting_transfer', 'confirmed', 'cancelled', 'expired')),
  total_cents          integer NOT NULL CHECK (total_cents >= 0),
  deposit_cents        integer NOT NULL DEFAULT 0 CHECK (deposit_cents >= 0),
  deposit_paid_at      timestamptz,
  balance_cents        integer NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),  -- due at collection
  balance_paid_at      timestamptz,
  balance_method       text CHECK (balance_method IN ('card', 'bank_transfer', 'cash', 'cheque')),
  payment_reference    text,          -- card payment id or bank transfer reference
  hold_expires_at      timestamptz,
  collected_at         timestamptz,
  refund_status        text    NOT NULL DEFAULT 'none'
                       CHECK (refund_status IN ('none', 'requested', 'partial', 'refunded')),
  refund_cents         integer NOT NULL DEFAULT 0 CHECK (refund_cents >= 0),
  is_test              boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (deposit_cents + balance_cents = total_cents)
);

CREATE INDEX IF NOT EXISTS orders_event_idx ON orders (event_id);
CREATE INDEX IF NOT EXISTS orders_collection_point_idx ON orders (collection_point_id);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id);

-- How many diners chose each option of a choice course.
-- (Fixed courses need no lines: every diner gets them.)
CREATE TABLE IF NOT EXISTS order_lines (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id          bigint  NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  course_option_id  bigint  NOT NULL REFERENCES course_options (id),
  quantity          integer NOT NULL CHECK (quantity > 0),
  UNIQUE (order_id, course_option_id)
);
