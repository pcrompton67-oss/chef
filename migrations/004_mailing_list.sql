-- 004 · Mailing list (issue #10): sign-ups become customers, where each
-- customer came from, and a private code for their unsubscribe link.

-- Someone who only signs up gives an email, not a name.
ALTER TABLE customers ALTER COLUMN name DROP NOT NULL;

-- How we first heard from them: 'website' order, an order Eleanor added in
-- the console ('console'), or a 'signup' box.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source text;

-- The private code in their unsubscribe link (a new random one per customer).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS unsubscribe_token text
  NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');
CREATE UNIQUE INDEX IF NOT EXISTS customers_unsubscribe_token_key ON customers (unsubscribe_token);

-- Fill in where existing customers came from (their first order).
UPDATE customers c
   SET source = CASE WHEN o.source = 'website' THEN 'website' ELSE 'console' END
  FROM (SELECT DISTINCT ON (customer_id) customer_id, source
          FROM orders WHERE customer_id IS NOT NULL ORDER BY customer_id, created_at) o
 WHERE o.customer_id = c.id AND c.source IS NULL;

-- Earlier "tell me about the next one" sign-ups join the list as customers.
INSERT INTO customers (email, language, marketing_consent, consent_at, source, is_test, created_at)
SELECT DISTINCT ON (lower(s.email)) s.email, s.language, true, s.created_at, 'signup',
       s.email ILIKE '%@example.com', s.created_at
  FROM notify_signups s
 ORDER BY lower(s.email), s.created_at
ON CONFLICT (lower(email)) DO UPDATE
   SET marketing_consent = true,
       consent_at = CASE WHEN customers.marketing_consent THEN customers.consent_at
                         ELSE EXCLUDED.consent_at END;
