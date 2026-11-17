-- Removes everything flagged as test data (and anything belonging to a test
-- event). Real data is never touched.
DELETE FROM orders
 WHERE is_test
    OR event_id IN (SELECT id FROM events WHERE is_test);
DELETE FROM events WHERE is_test;      -- also removes its courses, options, points, sign-ups
DELETE FROM customers WHERE is_test;
DELETE FROM notify_signups WHERE email ILIKE '%@example.com';   -- test "notify me" sign-ups
