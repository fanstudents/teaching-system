-- Add instructor profile fields for quote page display
-- These columns may already exist on some deployments; use IF NOT EXISTS pattern

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'title') THEN
    ALTER TABLE instructors ADD COLUMN title text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'photo_url') THEN
    ALTER TABLE instructors ADD COLUMN photo_url text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'bio') THEN
    ALTER TABLE instructors ADD COLUMN bio text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'experience') THEN
    ALTER TABLE instructors ADD COLUMN experience jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'specialties') THEN
    ALTER TABLE instructors ADD COLUMN specialties jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructors' AND column_name = 'photos') THEN
    ALTER TABLE instructors ADD COLUMN photos jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
