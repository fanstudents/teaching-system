-- 企業諮詢表單資料表
-- 先 DROP 再建（確保欄位完整）
DROP TABLE IF EXISTS enterprise_inquiries CASCADE;

CREATE TABLE enterprise_inquiries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    inquiry_type TEXT NOT NULL DEFAULT 'training',
    team_size TEXT,
    message TEXT,
    source_page TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);

-- RLS
ALTER TABLE enterprise_inquiries ENABLE ROW LEVEL SECURITY;

-- 匿名用戶可以 INSERT（送出表單）
CREATE POLICY "anon_can_insert_inquiries" ON enterprise_inquiries
    FOR INSERT TO anon WITH CHECK (true);

-- 已登入用戶可讀取與更新
CREATE POLICY "auth_can_read_inquiries" ON enterprise_inquiries
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_can_update_inquiries" ON enterprise_inquiries
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 索引
CREATE INDEX idx_inquiries_status ON enterprise_inquiries(status);
CREATE INDEX idx_inquiries_created ON enterprise_inquiries(created_at DESC);
