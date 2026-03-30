-- Add booking calendar fields to enterprise_inquiries
ALTER TABLE public.enterprise_inquiries
    ADD COLUMN IF NOT EXISTS booking_date TEXT,
    ADD COLUMN IF NOT EXISTS booking_time TEXT,
    ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,
    ADD COLUMN IF NOT EXISTS line_id TEXT;
