-- Test data: "TEST – Inspired by India", using Eleanor's real menu.
-- Everything is flagged is_test. Running this again replaces the old test data.
-- Customer emails use example.com so nothing can ever be emailed to a real person.

DO $$
DECLARE
  today       date := (now() AT TIME ZONE 'Europe/Paris')::date;
  two_weeks   date := today + 14;
  ev_date     date;
  ev          bigint;
  c_main      bigint;
  o_chicken   bigint;
  o_aubergine bigint;
  p_lorigne   bigint;
  p_sauze     bigint;
  p_stpierre  bigint;
  p_ruffec    bigint;
  ord         bigint;
  cust        bigint;
  price       int := 4000;   -- €40 per person
  deposit     int := 2000;   -- €20 per person
BEGIN
  -- The Friday nearest to two weeks from today.
  ev_date := two_weeks + ((5 - extract(isodow FROM two_weeks)::int + 10) % 7) - 3;

  INSERT INTO events (slug, title, theme, event_date, intro, hero_image, menu_image,
                      price_cents, deposit_cents, capacity, cutoff_at, status, is_test)
  VALUES ('test-inspired-by-india', 'TEST – Inspired by India', 'Inspired by India', ev_date,
          '4 courses · prepared by me · finished by you. Includes a personal video guide to heating, finishing & plating your meal.',
          '/CEJ_Food2.jpg', '/CEJ_Menu_Indian.jpg',
          price, deposit, 40,
          -- cut-off: two days before, at midnight Paris time
          ((ev_date - 2)::timestamp + time '23:59') AT TIME ZONE 'Europe/Paris',
          'open', true)
  RETURNING id INTO ev;

  -- Menu
  WITH c AS (
    INSERT INTO courses (event_id, position, name, kind, description)
    VALUES (ev, 1, 'Starter', 'fixed', 'roasted red pepper & smoked chilli purée')
    RETURNING id)
  INSERT INTO course_options (course_id, position, name, vegetarian)
  SELECT id, 1, 'Caramelised Onion, Squash & Feta Samosa', true FROM c;

  WITH c AS (
    INSERT INTO courses (event_id, position, name, kind, description)
    VALUES (ev, 2, 'Second course', 'fixed',
            'cauliflower & onion bhaji · raisin & tamarind chutney · curry leaf')
    RETURNING id)
  INSERT INTO course_options (course_id, position, name, vegetarian)
  SELECT id, 1, 'Spiced Cauliflower Velouté', true FROM c;

  INSERT INTO courses (event_id, position, name, kind, description)
  VALUES (ev, 3, 'Main', 'choice',
          'bombay potato pavé · spiced pea & spinach fricassée · makhani gravy')
  RETURNING id INTO c_main;
  INSERT INTO course_options (course_id, position, name, vegetarian)
  VALUES (c_main, 1, 'Chicken Tikka Masala Pithivier', false) RETURNING id INTO o_chicken;
  INSERT INTO course_options (course_id, position, name, vegetarian)
  VALUES (c_main, 2, 'Smoked Aubergine & Chickpea Pithivier', true) RETURNING id INTO o_aubergine;

  WITH c AS (
    INSERT INTO courses (event_id, position, name, kind, description)
    VALUES (ev, 4, 'Dessert', 'fixed', 'jaggery caramel · cardamom crème anglaise')
    RETURNING id)
  INSERT INTO course_options (course_id, position, name, vegetarian)
  SELECT id, 1, 'Masala Chai Sticky Toffee Pudding', true FROM c;

  -- Collection points (placeholder addresses)
  INSERT INTO collection_points (event_id, position, place, collect_time, address)
  VALUES (ev, 1, 'Lorigné', '17:00', 'TEST address – to be confirmed, 79190 Lorigné')
  RETURNING id INTO p_lorigne;
  INSERT INTO collection_points (event_id, position, place, collect_time, address)
  VALUES (ev, 2, 'Sauzé-Vaussais', '17:30', 'TEST address – to be confirmed, 79190 Sauzé-Vaussais')
  RETURNING id INTO p_sauze;
  INSERT INTO collection_points (event_id, position, place, collect_time, address)
  VALUES (ev, 3, 'St-Pierre-d''Exideuil', '18:00', 'TEST address – to be confirmed, 86400 Saint-Pierre-d''Exideuil')
  RETURNING id INTO p_stpierre;
  INSERT INTO collection_points (event_id, position, place, collect_time, address)
  VALUES (ev, 4, 'Ruffec', '18:30', 'TEST address – to be confirmed, 16700 Ruffec')
  RETURNING id INTO p_ruffec;

  -- 1 · Card, confirmed, 2 diners, one of each main
  INSERT INTO customers (name, email, mobile, language, marketing_consent, consent_at, is_test)
  VALUES ('Test Alice Martin', 'alice.test@example.com', '+33 6 00 00 00 01', 'en', true, now(), true)
  RETURNING id INTO cust;
  INSERT INTO orders (event_id, collection_point_id, customer_id, diners, name, mobile, email,
                      language, source, payment_method, status, total_cents, deposit_cents,
                      deposit_paid_at, balance_cents, payment_reference, is_test)
  VALUES (ev, p_lorigne, cust, 2, 'Test Alice Martin', '+33 6 00 00 00 01', 'alice.test@example.com',
          'en', 'website', 'card', 'confirmed', 2 * price, 2 * deposit, now(), 2 * (price - deposit),
          'TEST-CARD-0001', true)
  RETURNING id INTO ord;
  INSERT INTO order_lines (order_id, course_option_id, quantity)
  VALUES (ord, o_chicken, 1), (ord, o_aubergine, 1);

  -- 2 · Card, confirmed, 4 diners
  INSERT INTO customers (name, email, mobile, language, is_test)
  VALUES ('Test Bernard Dupont', 'bernard.test@example.com', '+33 6 00 00 00 02', 'fr', true)
  RETURNING id INTO cust;
  INSERT INTO orders (event_id, collection_point_id, customer_id, diners, name, mobile, email,
                      language, source, payment_method, status, total_cents, deposit_cents,
                      deposit_paid_at, balance_cents, payment_reference, is_test)
  VALUES (ev, p_sauze, cust, 4, 'Test Bernard Dupont', '+33 6 00 00 00 02', 'bernard.test@example.com',
          'fr', 'website', 'card', 'confirmed', 4 * price, 4 * deposit, now(), 4 * (price - deposit),
          'TEST-CARD-0002', true)
  RETURNING id INTO ord;
  INSERT INTO order_lines (order_id, course_option_id, quantity)
  VALUES (ord, o_chicken, 3), (ord, o_aubergine, 1);

  -- 3 · Awaiting bank transfer, places held for 48 hours
  INSERT INTO customers (name, email, mobile, language, is_test)
  VALUES ('Test Claire Moreau', 'claire.test@example.com', '+33 6 00 00 00 03', 'fr', true)
  RETURNING id INTO cust;
  INSERT INTO orders (event_id, collection_point_id, customer_id, diners, name, mobile, email,
                      language, source, payment_method, status, total_cents, deposit_cents,
                      balance_cents, payment_reference, hold_expires_at, is_test)
  VALUES (ev, p_stpierre, cust, 2, 'Test Claire Moreau', '+33 6 00 00 00 03', 'claire.test@example.com',
          'fr', 'website', 'bank_transfer', 'awaiting_transfer', 2 * price, 2 * deposit,
          2 * (price - deposit), 'EJ-TEST-0003', now() + interval '48 hours', true)
  RETURNING id INTO ord;
  INSERT INTO order_lines (order_id, course_option_id, quantity)
  VALUES (ord, o_chicken, 2);

  -- 4 · Card, confirmed, with an allergy note
  INSERT INTO customers (name, email, mobile, language, marketing_consent, consent_at, is_test)
  VALUES ('Test David Evans', 'david.test@example.com', '+33 6 00 00 00 04', 'en', true, now(), true)
  RETURNING id INTO cust;
  INSERT INTO orders (event_id, collection_point_id, customer_id, diners, name, mobile, email,
                      allergies, language, source, payment_method, status, total_cents,
                      deposit_cents, deposit_paid_at, balance_cents, payment_reference, is_test)
  VALUES (ev, p_ruffec, cust, 3, 'Test David Evans', '+33 6 00 00 00 04', 'david.test@example.com',
          'One diner has a severe nut allergy (including cashews).',
          'en', 'website', 'card', 'confirmed', 3 * price, 3 * deposit, now(), 3 * (price - deposit),
          'TEST-CARD-0004', true)
  RETURNING id INTO ord;
  INSERT INTO order_lines (order_id, course_option_id, quantity)
  VALUES (ord, o_aubergine, 3);

  -- 5 · Taken by Eleanor over WhatsApp, card, confirmed
  INSERT INTO customers (name, email, mobile, language, is_test)
  VALUES ('Test Emma Petit', 'emma.test@example.com', '+33 6 00 00 00 05', 'fr', true)
  RETURNING id INTO cust;
  INSERT INTO orders (event_id, collection_point_id, customer_id, diners, name, mobile, email,
                      language, source, payment_method, status, total_cents, deposit_cents,
                      deposit_paid_at, balance_cents, payment_reference, is_test)
  VALUES (ev, p_ruffec, cust, 2, 'Test Emma Petit', '+33 6 00 00 00 05', 'emma.test@example.com',
          'fr', 'whatsapp', 'card', 'confirmed', 2 * price, 2 * deposit, now(), 2 * (price - deposit),
          'TEST-CARD-0005', true)
  RETURNING id INTO ord;
  INSERT INTO order_lines (order_id, course_option_id, quantity)
  VALUES (ord, o_chicken, 1), (ord, o_aubergine, 1);
END $$;
