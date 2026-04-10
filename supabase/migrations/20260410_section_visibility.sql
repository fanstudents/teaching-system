-- Add section_visibility to quotations
ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS section_visibility jsonb DEFAULT '{"pricing":true,"payment":true,"instructor":true}'::jsonb;
