// email-tracker Edge Function — 開信追蹤 1px pixel
// GET /email-tracker?id={draftId}
// 記錄開信事件，回傳 1x1 透明 GIF

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// 1x1 transparent GIF (base64)
const TRANSPARENT_GIF = Uint8Array.from(atob(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
), c => c.charCodeAt(0));

serve(async (req) => {
    const url = new URL(req.url);
    const draftId = url.searchParams.get('id');

    // Always return the pixel, even if we can't record
    const pixelHeaders = {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
    };

    if (!draftId) {
        return new Response(TRANSPARENT_GIF, { headers: pixelHeaders });
    }

    // Record open event asynchronously (don't block the pixel response)
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || '';
        const userAgent = req.headers.get('user-agent') || '';

        // 防重複：同一 draft_id + IP 在 10 分鐘內只記錄一次
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
            .from('email_events')
            .select('id')
            .eq('draft_id', draftId)
            .eq('ip_address', ip)
            .gte('created_at', tenMinAgo)
            .limit(1);

        if (!recent || recent.length === 0) {
            // 查詢 draft 的 student_email
            const { data: draft } = await supabase
                .from('email_drafts')
                .select('student_email')
                .eq('id', draftId)
                .limit(1);

            const studentEmail = draft?.[0]?.student_email || '';

            // 插入開信事件
            await supabase.from('email_events').insert({
                draft_id: draftId,
                student_email: studentEmail,
                event_type: 'open',
                ip_address: ip,
                user_agent: userAgent,
            });

            // 更新 email_drafts 的開信統計
            const { data: currentDraft } = await supabase
                .from('email_drafts')
                .select('open_count, first_opened_at')
                .eq('id', draftId)
                .limit(1);

            const updates: Record<string, unknown> = {
                open_count: (currentDraft?.[0]?.open_count || 0) + 1,
                last_opened_at: new Date().toISOString(),
            };
            if (!currentDraft?.[0]?.first_opened_at) {
                updates.first_opened_at = new Date().toISOString();
            }

            await supabase
                .from('email_drafts')
                .update(updates)
                .eq('id', draftId);
        }
    } catch (err) {
        // Log but don't fail — always return the pixel
        console.error('[email-tracker] Error recording open:', err.message);
    }

    return new Response(TRANSPARENT_GIF, { headers: pixelHeaders });
});
