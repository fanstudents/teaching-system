-- ══════════════════════════════════════
-- notification_logs — 通用通知推送記錄
-- 記錄所有通知信發送狀態、開信、點擊追蹤
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 通知分類
  notification_type TEXT NOT NULL DEFAULT 'affiliate_commission',  -- affiliate_commission, system, marketing...
  
  -- 收件者
  recipient_email TEXT NOT NULL,
  recipient_name TEXT DEFAULT '',
  
  -- 信件內容
  subject TEXT NOT NULL DEFAULT '',
  
  -- 關聯資料
  reference_id TEXT DEFAULT '',        -- 例如 transaction_id
  reference_type TEXT DEFAULT '',      -- 例如 'affiliate_order'
  metadata JSONB DEFAULT '{}',         -- 額外資料（佣金金額、商品名稱等）
  
  -- Resend 回傳
  resend_message_id TEXT DEFAULT '',
  
  -- 發送狀態
  send_status TEXT NOT NULL DEFAULT 'sent',  -- sent, failed, bounced
  error_message TEXT DEFAULT '',
  
  -- 追蹤統計
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ,
  
  -- 時間
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_notif_logs_type ON public.notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notif_logs_email ON public.notification_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notif_logs_ref ON public.notification_logs(reference_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_sent ON public.notification_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_logs_status ON public.notification_logs(send_status);

-- 通知事件追蹤（開信、點擊）
CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notification_logs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'open',  -- open, click
  url TEXT DEFAULT '',                       -- click 時的目標 URL
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_events_nid ON public.notification_events(notification_id);
CREATE INDEX IF NOT EXISTS idx_notif_events_type ON public.notification_events(event_type);

-- RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

-- Admin 可存取所有紀錄
CREATE POLICY "admin_all_notification_logs" ON public.notification_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_notification_events" ON public.notification_events
  FOR ALL USING (true) WITH CHECK (true);

-- Tracker functions (anon) 需要寫入
CREATE POLICY "anon_insert_notification_events" ON public.notification_events
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_notification_logs" ON public.notification_logs
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '✅ notification_logs + notification_events 表已建立'; END $$;
