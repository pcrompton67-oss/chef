-- 001 · Events, their menus (courses and options) and collection points.
-- Written to be safe to run again: everything uses IF NOT EXISTS.
-- All money is stored in cents (euro cents).

CREATE TABLE IF NOT EXISTS events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- What kind of event this is. Only Dine at Home for now; restaurant
  -- bookings and other kinds can be added later.
  kind            text        NOT NULL DEFAULT 'dine_at_home',
  slug            text        NOT NULL UNIQUE,
  title           text        NOT NULL,
  theme           text,
  event_date      date        NOT NULL,
  intro           text,
  hero_image      text,
  menu_image      text,
  price_cents     integer     NOT NULL CHECK (price_cents >= 0),
  deposit_cents   integer     NOT NULL DEFAULT 0 CHECK (deposit_cents >= 0),
  capacity        integer     NOT NULL CHECK (capacity > 0),   -- number of diners
  cutoff_at       timestamptz NOT NULL,                        -- last moment to order
  status          text        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'open', 'sold_out', 'closed', 'done')),
  is_test         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (deposit_cents <= price_cents)
);

CREATE INDEX IF NOT EXISTS events_date_idx ON events (event_date);

-- A course on an event's menu. "fixed" = everyone gets the same dish;
-- "choice" = each diner picks one of the options.
CREATE TABLE IF NOT EXISTS courses (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id     bigint  NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  position     integer NOT NULL,
  name         text    NOT NULL,            -- e.g. "Starter", "Main"
  kind         text    NOT NULL CHECK (kind IN ('fixed', 'choice')),
  -- Short line shown in italics under the dish(es), components separated by " · ".
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, position)
);

-- The dish(es) in a course: one for a fixed course, two or more for a choice.
CREATE TABLE IF NOT EXISTS course_options (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id    bigint  NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  position     integer NOT NULL,
  name         text    NOT NULL,
  vegetarian   boolean NOT NULL DEFAULT false,   -- shown as "(v)"
  description  text,                             -- optional, for this dish only
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, position)
);

-- Where and when customers collect their meal, per event.
CREATE TABLE IF NOT EXISTS collection_points (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id      bigint  NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  position      integer NOT NULL,
  place         text    NOT NULL,       -- e.g. "Lorigné"
  collect_time  time    NOT NULL,       -- Paris time on the event date
  address       text    NOT NULL,       -- exact address, sent to customers
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, position)
);
