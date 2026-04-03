-- 推廣者帳戶新增：真實姓名、電話
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS real_name TEXT;
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS phone TEXT;
