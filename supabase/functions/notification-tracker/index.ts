// notification-tracker Edge Function — 通知信開信/點擊追蹤
// GET /notification-tracker?nid={notificationId}&event=open
// GET /notification-tracker?nid={notificationId}&event=click&url={encodedUrl}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// 1x1 transparent GIF
const TRANSPARENT_GIF = Uint8Array.from(atob(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
), c => c.charCodeAt(0));

serve(async (req) => {
    const url = new URL(req.url);
    const nid = url.searchParams.get('nid');
    const event = url.searchParams.get('event') || 'open';
    const targetUrl = url.searchParams.get('url');

    // 沒有 nid → 直接回應
    if (!nid) {
        if (event === 'click' && targetUrl) {
            return new Response(null, { status: 302, headers: { 'Location': targetUrl } });
        }
        return new Response(TRANSPARENT_GIF, {
            headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' }
        });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || '';
        const userAgent = req.headers.get('user-agent') || '';

        if (event === 'open') {
            // 防重複：同一 nid + IP 在 10 分鐘內只記錄一次
            const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const { data: recent } = await supabase
                .from('notification_events')
                .select('id')
                .eq('notification_id', nid)
                .eq('event_type', 'open')
                .eq('ip_address', ip)
                .gte('created_at', tenMinAgo)
                .limit(1);

            if (!recent || recent.length === 0) {
                // 插入開信事件
                await supabase.from('notification_events').insert({
                    notification_id: nid,
                    event_type: 'open',
                    ip_address: ip,
                    user_agent: userAgent,
                });

                // 更新 notification_logs 開信統計
                const { data: current } = await supabase
                    .from('notification_logs')
                    .select('open_count, first_opened_at')
                    .eq('id', nid)
                    .single();

                const updates: Record<string, unknown> = {
                    open_count: (current?.open_count || 0) + 1,
                    last_opened_at: new Date().toISOString(),
                };
                if (!current?.first_opened_at) {
                    updates.first_opened_at = new Date().toISOString();
                }

                await supabase
                    .from('notification_logs')
                    .update(updates)
                    .eq('id', nid);
            }
        } else if (event === 'click') {
            // 插入點擊事件
            await supabase.from('notification_events').insert({
                notification_id: nid,
                event_type: 'click',
                url: targetUrl || '',
                ip_address: ip,
                user_agent: userAgent,
            });

            // 更新 notification_logs 點擊統計
            const { data: current } = await supabase
                .from('notification_logs')
                .select('click_count, first_clicked_at')
                .eq('id', nid)
                .single();

            const updates: Record<string, unknown> = {
                click_count: (current?.click_count || 0) + 1,
            };
            if (!current?.first_clicked_at) {
                updates.first_clicked_at = new Date().toISOString();
            }

            await supabase
                .from('notification_logs')
                .update(updates)
                .eq('id', nid);
        }
    } catch (err) {
        console.error('[notification-tracker] Error:', err.message);
    }

    // 回應：click → redirect, open → 1px GIF
    if (event === 'click' && targetUrl) {
        return new Response(null, {
            status: 302,
            headers: {
                'Location': targetUrl,
                'Cache-Control': 'no-store, no-cache',
            }
        });
    }

    return new Response(TRANSPARENT_GIF, {
        headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Access-Control-Allow-Origin': '*',
        }
    });
});
