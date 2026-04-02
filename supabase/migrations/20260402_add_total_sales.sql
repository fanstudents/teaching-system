-- 為 affiliate_courses 新增銷售欄位，用於排序
ALTER TABLE public.affiliate_courses ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0;
ALTER TABLE public.affiliate_courses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.affiliate_courses ADD COLUMN IF NOT EXISTS instructor TEXT;
