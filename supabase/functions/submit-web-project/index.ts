// submit-web-project — Supabase Edge Function (Deno)
// POST /functions/v1/submit-web-project

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return json({ error: '只接受 POST' }, 405);
    }

    try {
        const body = await req.json();
        const { session_id, student_name, student_email, html, css, js, title, prompt } = body;
        let { element_id } = body;

        if (!session_id) return json({ error: '缺少 session_id' }, 400);
        if (!student_name) return json({ error: '缺少 student_name' }, 400);
        if (!student_email) return json({ error: '缺少 student_email' }, 400);
        if (!html) return json({ error: '缺少 html' }, 400);

        // 組合 HTML + CSS + JS
        let combined = html;
        if (css?.trim()) {
            const tag = `\n<style>\n${css}\n</style>\n`;
            combined = combined.includes('</head>')
                ? combined.replace('</head>', tag + '</head>')
                : tag + combined;
        }
        if (js?.trim()) {
            const tag = `\n<script>\n${js}\n</script>\n`;
            combined = combined.includes('</body>')
                ? combined.replace('</body>', tag + '</body>')
                : combined + tag;
        }

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        // 自動偵測 element_id
        if (!element_id) {
            const r = await fetch(
                `${SUPABASE_URL}/rest/v1/submissions?session_id=eq.${enc(session_id)}&type=eq.webProject&select=element_id&limit=1`,
                { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
            );
            const d = await r.json();
            element_id = d?.[0]?.element_id || 'webProject_api';
        }

        // 先刪舊提交
        await fetch(
            `${SUPABASE_URL}/rest/v1/submissions?session_id=eq.${enc(session_id)}&element_id=eq.${enc(element_id)}&student_email=eq.${enc(student_email)}`,
            { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        );

        // 新增提交
        const record = {
            session_id, element_id, student_name, student_email,
            type: 'webProject',
            assignment_title: title || '網頁作品（AI 提交）',
            content: combined,
            state: JSON.stringify({
                mode: 'api', status: 'submitted',
                combinedSize: combined.length,
                files: ['index.html', ...(css ? ['style.css'] : []), ...(js ? ['script.js'] : [])],
                prompt: prompt || '',
            }),
            submitted_at: new Date().toISOString(),
        };

        const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
            method: 'POST',
            headers: {
                apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json', Prefer: 'return=representation',
            },
            body: JSON.stringify([record]),
        });

        if (!res.ok) return json({ error: `儲存失敗: ${await res.text()}` }, 500);
        const result = await res.json();

        return json({
            success: true,
            message: `✅ ${student_name} 的作品已成功提交！`,
            submission_id: result?.[0]?.id || null,
            combined_size: combined.length,
        });

    } catch (e) {
        return json({ error: `伺服器錯誤: ${e.message}` }, 500);
    }
});

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
function enc(s) { return encodeURIComponent(s); }
