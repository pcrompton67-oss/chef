-- 007 · Master list of collection places (issue #35).
-- Each evening still keeps its own copy of place, time and address in
-- collection_points, so editing or removing a place here never changes an
-- evening that already exists or its orders. Places ticked "included in new
-- events" are put into every new evening, at their usual time.
-- Only adds a table, so it is safe to run again and safe for the code already live.

CREATE TABLE IF NOT EXISTS collection_places (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place         text    NOT NULL,             -- e.g. "Lorigné"
  address       text    NOT NULL,             -- exact address, never shown on the website
  usual_time    time    NOT NULL,             -- Paris time, can be changed per evening
  in_new_events boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Start the list from the places already used, once: one row per place name,
-- taken from a real evening where there is one, otherwise a test evening,
-- most recent first.
INSERT INTO collection_places (place, address, usual_time)
SELECT trim(place), address, collect_time
  FROM (SELECT DISTINCT ON (lower(trim(cp.place))) cp.place, cp.address, cp.collect_time
          FROM collection_points cp JOIN events e ON e.id = cp.event_id
         ORDER BY lower(trim(cp.place)), e.is_test, e.event_date DESC, e.id DESC) AS existing
 WHERE NOT EXISTS (SELECT 1 FROM collection_places);
