-- 1. 建立 affiliate_courses 表（後台可管理課程列表）
CREATE TABLE IF NOT EXISTS public.affiliate_courses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    url text NOT NULL,
    platform text NOT NULL DEFAULT 'tbr',  -- 'tbr' or 'hahow'
    icon text DEFAULT 'school',
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.affiliate_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read affiliate_courses" ON public.affiliate_courses
    FOR SELECT USING (true);

CREATE POLICY "Allow all affiliate_courses" ON public.affiliate_courses
    FOR ALL USING (true) WITH CHECK (true);

-- 2. affiliates 表新增 platforms 欄位
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS platforms text[];

-- 3. 插入初始課程資料
INSERT INTO public.affiliate_courses (name, url, platform, icon, sort_order) VALUES
-- 數位簡報室 AI 系列
('AI 職場全方位應用｜2026 全新 AI 入門課程', 'https://tbr.digital/courses/ai-course', 'tbr', 'smart_toy', 1),
('新時代的 AI 寫作課｜帶你打造個人高效寫作系統', 'https://tbr.digital/courses/ai-writing', 'tbr', 'edit_note', 2),
('Vibe Coding 商業上線實戰｜4場直播帶你經歷完整旅程', 'https://tbr.digital/courses/vibe-coding-live', 'tbr', 'code', 3),
('Vibe Coding 一日上線戰鬥營｜Vibe Coder 拖延症良藥', 'https://tbr.digital/courses/vibe-coding', 'tbr', 'rocket_launch', 4),
('Vibe Coding｜金流課程', 'https://tbr.digital/courses/vibe-coding-cash-flow', 'tbr', 'payments', 5),
('Vibe Coding 30 日陪跑計畫', 'https://tbr.digital/courses/vibe-coding-coach', 'tbr', 'group', 6),
('AI x n8n 自動化場景實戰｜從入門到實作一次搞懂 n8n', 'https://tbr.digital/courses/ai-auto', 'tbr', 'settings_suggest', 7),
('Vibe Coding 從零到一｜初學者全方位工作坊', 'https://tbr.digital/courses/vibe-coding-workshop', 'tbr', 'build', 8),
('AI 行銷數據實戰班｜掌握新時代數據應用的實作課程', 'https://tbr.digital/courses/ai-data', 'tbr', 'analytics', 9),
-- 數位簡報室 行銷課程
('Threads 脆流量變現實戰｜進階陪跑課', 'https://tbr.digital/courses/threads', 'tbr', 'forum', 10),
('Email 行銷進階實戰攻略｜企業 CRM 必備課程', 'https://tbr.digital/courses/email-marketing', 'tbr', 'mail', 11),
('CRM X LINE 會員經營實戰', 'https://tbr.digital/courses/crm', 'tbr', 'loyalty', 12),
('轉換率優化 - 從用戶心理到數據實驗的實戰指南', 'https://tbr.digital/courses/cro-marketing', 'tbr', 'trending_up', 13),
('廣告投手培訓班', 'https://tbr.digital/courses/ads', 'tbr', 'ads_click', 14),
('行銷人的百萬年薪實戰課', 'https://tbr.digital/courses/marketing', 'tbr', 'workspace_premium', 15),
-- Hahow 合作課程
('網路行銷全方位入門實戰（23 小時）', 'https://hahow.in/cr/marketing', 'hahow', 'campaign', 100),
('Looker Studio 視覺化報表（6.3 小時）', 'https://hahow.in/cr/datastudio', 'hahow', 'bar_chart', 101),
('電商數據營運指標全攻略（3.3 小時）', 'https://hahow.in/cr/metrics100', 'hahow', 'shopping_cart', 102);
