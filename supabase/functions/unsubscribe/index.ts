// unsubscribe Edge Function — 取消訂閱
// GET /unsubscribe?email={email}&token={hmac}
// 顯示取消訂閱確認頁面，並更新 students 表

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// 簡單的 token 驗證（避免任意取消別人的訂閱）
function simpleHash(email: string): string {
    let hash = 0;
    const str = email + (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'salt');
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

serve(async (req) => {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    const token = url.searchParams.get('token');

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/html; charset=utf-8',
    };

    if (!email) {
        return new Response('<h1>無效的連結</h1>', { status: 400, headers: corsHeaders });
    }

    // 驗證 token
    if (token !== simpleHash(email)) {
        return new Response('<h1>連結無效或已過期</h1>', { status: 403, headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 更新 students 表
    await supabase
        .from('students')
        .update({ email_unsubscribed: true, email_unsubscribed_at: new Date().toISOString() })
        .eq('email', email);

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>取消訂閱</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans TC', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f4f4f8; color: #333; }
  .card { background: white; border-radius: 16px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  h1 { font-size: 24px; margin: 0 0 16px; color: #1a1a2e; }
  p { font-size: 15px; line-height: 1.7; color: #666; margin: 0 0 8px; }
  .check { font-size: 48px; margin-bottom: 16px; }
  .brand { margin-top: 24px; font-size: 12px; color: #999; }
</style>
</head>
<body>
<div class="card">
  <div class="check">✓</div>
  <h1>已取消訂閱</h1>
  <p>你的 Email（${email}）已從數位簡報室的信件通知中移除。</p>
  <p>如果這是誤按，請聯絡 service@teaching.tbr.digital 恢復。</p>
  <div class="brand">數位簡報室 tbr.digital</div>
</div>
</body>
</html>`;

    return new Response(html, { headers: corsHeaders });
});
