-- affiliate_orders - 推廣者帶來的訂單記錄
CREATE TABLE IF NOT EXISTS public.affiliate_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT UNIQUE NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'TWD',
    payment_time TIMESTAMPTZ,
    payment_status TEXT DEFAULT 'Paid',
    coupon_code TEXT NOT NULL,
    coupon_name TEXT,
    course_name TEXT,
    plan_name TEXT,
    student_name TEXT,
    student_email TEXT,
    student_phone TEXT,
    affiliate_name TEXT NOT NULL,
    affiliate_email TEXT NOT NULL,
    affiliate_code TEXT NOT NULL,
    commission_rate NUMERIC(5,4) DEFAULT 0.2000,
    commission_amount INTEGER DEFAULT 0,
    commission_status TEXT DEFAULT 'pending', -- pending, approved, paid
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.affiliate_orders ENABLE ROW LEVEL SECURITY;

-- Affiliates can read their own orders
CREATE POLICY "affiliates_read_own_orders" ON public.affiliate_orders
    FOR SELECT USING (true);

-- Admin can do everything
CREATE POLICY "admin_all_affiliate_orders" ON public.affiliate_orders
    FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookup by affiliate
-- Index for fast lookup by affiliate
CREATE INDEX IF NOT EXISTS idx_affiliate_orders_email ON public.affiliate_orders(affiliate_email);
CREATE INDEX IF NOT EXISTS idx_affiliate_orders_coupon ON public.affiliate_orders(coupon_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_orders_txn ON public.affiliate_orders(transaction_id);


-- ============================================================
-- orders - 全量訂單（Excel 匯入 + Webhook 自動寫入共用）
-- transaction_id UNIQUE 確保不重複，Webhook 優先
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT UNIQUE NOT NULL,
    currency TEXT DEFAULT 'TWD',
    amount INTEGER NOT NULL DEFAULT 0,
    payment_time TIMESTAMPTZ,
    payment_status TEXT DEFAULT 'Paid',
    payment_method TEXT,
    installments INTEGER,
    affiliate_code TEXT,
    coupon_name TEXT,
    coupon_code TEXT,
    promotion_name TEXT,
    course_name TEXT,
    plan_name TEXT,
    event_name TEXT,
    membership_plan TEXT,
    is_subscription BOOLEAN DEFAULT FALSE,
    order_notes TEXT,
    mailing_address TEXT,
    invoice_type TEXT,
    invoice_number TEXT,
    unified_business_number TEXT,
    company_name TEXT,
    student_email TEXT,
    student_name TEXT,
    student_phone TEXT,
    gender TEXT,
    extra_field TEXT,
    refund_time TIMESTAMPTZ,
    source TEXT DEFAULT 'excel_import', -- 'excel_import' or 'webhook'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_orders" ON public.orders
    FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(student_email);
CREATE INDEX IF NOT EXISTS idx_orders_coupon ON public.orders(coupon_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_time ON public.orders(payment_time DESC);
CREATE INDEX IF NOT EXISTS idx_orders_course ON public.orders(course_name);
