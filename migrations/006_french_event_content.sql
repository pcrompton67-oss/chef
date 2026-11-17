-- 006 · French wording for an evening's own content (issue #12): title, theme,
-- introduction, course names and description lines, and dish names.
-- All optional: the French site falls back to the English wording where empty.
-- Only adds columns, so it is safe to run again and safe for the code already live.

ALTER TABLE events ADD COLUMN IF NOT EXISTS title_fr text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS theme_fr text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS intro_fr text;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS name_fr text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS description_fr text;

ALTER TABLE course_options ADD COLUMN IF NOT EXISTS name_fr text;
