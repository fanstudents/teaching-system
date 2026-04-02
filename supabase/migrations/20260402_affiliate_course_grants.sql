-- 免費觀看課程資格機制

-- 1. 課程授權紀錄表
CREATE TABLE IF NOT EXISTS public.affiliate_course_grants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.affiliates(id) NOT NULL,
    course_id UUID REFERENCES public.affiliate_courses(id) NOT NULL,
    grant_month TEXT NOT NULL,  -- '2026-04'
    status TEXT DEFAULT 'pending',  -- pending, approved, rejected
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    UNIQUE(affiliate_id, course_id, grant_month)
);

ALTER TABLE public.affiliate_course_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_course_grants" ON public.affiliate_course_grants FOR ALL USING (true) WITH CHECK (true);

-- 2. affiliates 新增社群帳號欄位
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS social_url TEXT,
  ADD COLUMN IF NOT EXISTS social_platform TEXT,
  ADD COLUMN IF NOT EXISTS social_followers INTEGER;
