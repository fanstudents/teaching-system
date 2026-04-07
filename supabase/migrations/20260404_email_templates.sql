-- ══════════════════════════════════════
-- email_templates — 信件範本管理
-- 可從後台「系統設置」修改範本內容
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.email_templates (
  id TEXT PRIMARY KEY,                     -- e.g. 'affiliate_commission'
  name TEXT NOT NULL,                      -- 顯示名稱
  description TEXT DEFAULT '',             -- 說明
  subject_template TEXT NOT NULL DEFAULT '',-- 主旨範本（支援 {{變數}}）
  body_template TEXT NOT NULL DEFAULT '',   -- HTML Body 範本（支援 {{變數}}）
  available_vars TEXT DEFAULT '',           -- 可用變數列表（逗號分隔，僅供提示）
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_email_templates" ON public.email_templates
  FOR ALL USING (true) WITH CHECK (true);

-- ── 插入預設推廣佣金通知範本 ──
INSERT INTO public.email_templates (id, name, description, subject_template, body_template, available_vars)
VALUES (
  'affiliate_commission',
  '推廣佣金通知',
  '訂單成立時自動發送給推廣者的佣金通知信',
  '🎉 新訂單佣金通知 — {{currency_symbol}}{{commission_amount}} ({{rate_percent}}%)',
  '<!-- 訂單明細卡片 -->
<p style="margin:0 0 16px;font-size:15px;">Hi <strong>{{affiliate_name}}</strong>，恭喜！</p>
<p style="margin:0 0 20px;">你推廣的課程有一筆新訂單成立 🎊，以下是訂單明細：</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8f9ff;border:1px solid #e8e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
<tr>
<td style="padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td style="padding:8px 0;border-bottom:1px solid #e8e8f0;">
<span style="color:#666;font-size:13px;">📋 訂單編號</span><br>
<strong style="font-size:14px;color:#1a1a2e;">{{transaction_id}}</strong>
</td>
</tr>
<tr>
<td style="padding:8px 0;border-bottom:1px solid #e8e8f0;">
<span style="color:#666;font-size:13px;">📚 商品名稱</span><br>
<strong style="font-size:14px;color:#1a1a2e;">{{course_name}}</strong>
</td>
</tr>
<tr>
<td style="padding:8px 0;border-bottom:1px solid #e8e8f0;">
<span style="color:#666;font-size:13px;">💰 訂單金額</span><br>
<strong style="font-size:14px;color:#1a1a2e;">{{currency_symbol}} {{amount}}</strong>
</td>
</tr>
<tr>
<td style="padding:8px 0;border-bottom:1px solid #e8e8f0;">
<span style="color:#666;font-size:13px;">📊 分潤比例</span><br>
<strong style="font-size:14px;color:#6366f1;">{{rate_percent}}%</strong>
</td>
</tr>
<tr>
<td style="padding:8px 0;">
<span style="color:#666;font-size:13px;">🏆 本筆佣金</span><br>
<strong style="font-size:18px;color:#10b981;">{{currency_symbol}} {{commission_amount}}</strong>
</td>
</tr>
</table>
</td>
</tr>
</table>

<!-- CTA 按鈕 -->
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td align="center" style="padding:8px 0 16px;">
<a href="{{dashboard_url}}" target="_blank" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(99,102,241,0.3);">前往聯盟行銷後台 →</a>
</td>
</tr>
</table>

<p style="margin:16px 0 0;font-size:13px;color:#888;">佣金將在確認後統一結算，詳情請至後台查看。</p>',
  'affiliate_name,transaction_id,course_name,amount,currency_symbol,rate_percent,commission_amount,dashboard_url'
) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN RAISE NOTICE '✅ email_templates 表已建立，預設範本已插入'; END $$;
