-- Add confirmed_at and confirmed_by to quotations
-- Run this in Supabase SQL Editor

ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS confirmed_by TEXT;

COMMENT ON COLUMN quotations.confirmed_at IS 'Timestamp when client confirmed this quote';
COMMENT ON COLUMN quotations.confirmed_by IS 'Name of person who confirmed the quote';
