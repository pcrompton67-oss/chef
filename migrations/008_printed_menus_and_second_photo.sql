-- 008 · Printed menu per language and a second photo per evening (issue #37).
-- menu_image (already there) is the English printed menu; menu_image_fr is
-- the French one. Each is a photo or a PDF; the French site falls back to the
-- English one and the other way round. second_image is the photo further
-- down an evening's page (empty = the site's usual photo).
-- Only adds columns, so it is safe to run again and safe for the code already live.

ALTER TABLE events ADD COLUMN IF NOT EXISTS menu_image_fr text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS second_image text;
