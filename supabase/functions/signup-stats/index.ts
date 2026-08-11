import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

/**
 * 對外分享的「即時報名人數」唯讀 API
 *
 * GET /functions/v1/signup-stats?token=xxx
 *
 * token 對應 signup_boards 一筆設定，決定要撈哪一門課的 orders。
 * 前端拿不到 email / 電話 / 訂單編號 — 姓名也做遮罩後才回傳。
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, authorization, apikey',
};

// 王小明 → 王○明；陳美 → 陳○；Kenda Lai → K***
function maskName(raw: string): string {
    const name = (raw || '').trim();
    if (!name) return '匿名';

    // 去掉常見的公司前綴與 emoji，只留人名部分
    const cleaned = name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
    const person = cleaned.includes('-') ? cleaned.split('-').pop()!.trim() : cleaned;

    const hasCJK = /[一-鿿]/.test(person);
    if (hasCJK) {
        const chars = [...person];
        if (chars.length <= 1) return person;
        if (chars.length === 2) return chars[0] + '○';
        return chars[0] + '○'.repeat(chars.length - 2) + chars[chars.length - 1];
    }

    const first = person.split(/\s+/)[0];
    return first.slice(0, 1).toUpperCase() + '***';
}

function dateKeyTaipei(iso: string): string {
    // orders.payment_time 是 UTC，看板以台北時間分日
    return new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
            status,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        });

    if (req.method !== 'GET') {
        return json({ error: 'Method not allowed' }, 405);
    }

    const token = new URL(req.url).searchParams.get('token') || '';
    if (!token) return json({ error: 'Missing token' }, 400);

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    try {
        const { data: boards } = await supabase
            .from('signup_boards')
            .select('*')
            .eq('token', token)
            .eq('active', true)
            .limit(1);

        const board = boards?.[0];
        if (!board) return json({ error: 'Board not found' }, 404);

        const { data: rows, error } = await supabase
            .from('orders')
            .select('payment_status, payment_time, created_at, student_name, amount, plan_name, course_name')
            .ilike('course_name', board.course_match)
            .order('payment_time', { ascending: false, nullsFirst: false });

        if (error) throw error;

        const all = rows || [];
        const paid = all.filter((r) => r.payment_status === 'Paid');
        const unpaid = all.filter((r) => r.payment_status === 'Unpaid');
        const refunded = all.filter((r) => r.payment_status === 'Refunded');

        // 每日報名數（台北時間），補滿中間沒人報名的日子
        const byDay = new Map<string, number>();
        for (const r of paid) {
            const key = dateKeyTaipei(r.payment_time || r.created_at);
            byDay.set(key, (byDay.get(key) || 0) + 1);
        }
        const daily: { date: string; count: number }[] = [];
        if (byDay.size > 0) {
            const keys = [...byDay.keys()].sort();
            const cursor = new Date(keys[0] + 'T00:00:00Z');
            const last = new Date(keys[keys.length - 1] + 'T00:00:00Z');
            while (cursor <= last) {
                const key = cursor.toISOString().slice(0, 10);
                daily.push({ date: key, count: byDay.get(key) || 0 });
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
        }

        const recent = board.show_names
            ? paid.slice(0, 30).map((r) => ({
                name: maskName(r.student_name || ''),
                at: r.payment_time || r.created_at,
            }))
            : [];

        return json({
            title: board.title,
            subtitle: board.subtitle || '',
            capacity: board.capacity,
            counts: {
                paid: paid.length,
                unpaid: unpaid.length,
                refunded: refunded.length,
            },
            revenue: paid.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
            latest_at: paid[0]?.payment_time || null,
            daily,
            recent,
            generated_at: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[signup-stats]', err);
        return json({ error: 'Internal server error' }, 500);
    }
});
