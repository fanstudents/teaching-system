// link-tracker Edge Function — 連結點擊追蹤
// GET /link-tracker?id={draftId}&url={encodedUrl}
// 記錄點擊事件，302 redirect 到原始 URL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
    const url = new URL(req.url);
    const draftId = url.searchParams.get('id');
    const targetUrl = url.searchParams.get('url');

    // 沒有目標 URL → 回首頁
    if (!targetUrl) {
        return new Response(null, {
            status: 302,
            headers: { 'Location': 'https://tbr.digital' }
        });
    }

    // 非同步記錄點擊（不阻塞 redirect）
    if (draftId) {
        try {
            const supabase = createClient(
                Deno.env.get('SUPABASE_URL')!,
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
            );

            const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                || req.headers.get('x-real-ip')
                || '';
            const userAgent = req.headers.get('user-agent') || '';

            // 查詢 draft 的 student_email
            const { data: draft } = await supabase
                .from('email_drafts')
                .select('student_email')
                .eq('id', draftId)
                .limit(1);

            await supabase.from('email_events').insert({
                draft_id: draftId,
                student_email: draft?.[0]?.student_email || '',
                event_type: 'click',
                url: targetUrl,
                ip_address: ip,
                user_agent: userAgent,
            });
        } catch (err) {
            console.error('[link-tracker] Error:', err.message);
        }
    }

    return new Response(null, {
        status: 302,
        headers: {
            'Location': targetUrl,
            'Cache-Control': 'no-store, no-cache',
        }
    });
});
