/**
 * submit-web-project — Supabase Edge Function
 * 
 * 接收 HTML/CSS/JS（分開或合併），自動組合後存入 submissions 表。
 * 讓學員在 Claude / ChatGPT 等 AI 工具中直接提交網頁作品。
 * 
 * POST /functions/v1/submit-web-project
 * Body: {
 *   session_id: string,     // 場次代碼
 *   element_id: string,     // 元素 ID（可選，自動偵測）
 *   student_name: string,
 *   student_email: string,
 *   html: string,           // HTML 內容（必填）
 *   css?: string,           // CSS 內容（可選，會被 inline 到 <head>）
 *   js?: string,            // JS 內容（可選，會被 inline 到 </body> 前）
 *   title?: string          // 作品標題
 * }
 */

const SUPABASE_URL = 'https://wsaknnhjgiqmkendeyrj.supabase.co';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

module.exports = async function (request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: '只接受 POST' }), {
            status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const { session_id, student_name, student_email, html, css, js, title } = body;
        let { element_id } = body;

        // 驗證必填欄位
        if (!session_id) return errResp('缺少 session_id（場次代碼）');
        if (!student_name) return errResp('缺少 student_name（學員名稱）');
        if (!student_email) return errResp('缺少 student_email（學員 Email）');
        if (!html) return errResp('缺少 html 內容');

        // 組合 HTML + CSS + JS
        let combined = html;

        if (css && css.trim()) {
            // 把 CSS 注入到 </head> 前，或如果沒有 </head> 就加在最前面
            const styleTag = `\n<style>\n${css}\n</style>\n`;
            if (combined.includes('</head>')) {
                combined = combined.replace('</head>', styleTag + '</head>');
            } else if (combined.includes('<body')) {
                combined = combined.replace(/<body/i, styleTag + '<body');
            } else {
                combined = styleTag + combined;
            }
        }

        if (js && js.trim()) {
            const scriptTag = `\n<script>\n${js}\n</script>\n`;
            if (combined.includes('</body>')) {
                combined = combined.replace('</body>', scriptTag + '</body>');
            } else {
                combined += scriptTag;
            }
        }

        // 自動偵測 element_id（如果沒給）
        if (!element_id) {
            const sessResp = await fetch(
                `${SUPABASE_URL}/rest/v1/submissions?session_id=eq.${encodeURIComponent(session_id)}&type=eq.webProject&select=element_id&limit=1`,
                { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
            );
            const sessData = await sessResp.json();
            if (sessData?.length > 0) {
                element_id = sessData[0].element_id;
            } else {
                element_id = 'webProject_api';
            }
        }

        // 先刪除舊的提交（如果存在）
        await fetch(
            `${SUPABASE_URL}/rest/v1/submissions?session_id=eq.${encodeURIComponent(session_id)}&element_id=eq.${encodeURIComponent(element_id)}&student_email=eq.${encodeURIComponent(student_email)}`,
            {
                method: 'DELETE',
                headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
            }
        );

        // 新增提交
        const record = {
            session_id,
            element_id,
            student_name,
            student_email,
            type: 'webProject',
            assignment_title: title || '網頁作品（API 提交）',
            content: combined,
            state: JSON.stringify({
                mode: 'api',
                status: 'submitted',
                combinedSize: combined.length,
                files: ['index.html', ...(css ? ['style.css'] : []), ...(js ? ['script.js'] : [])],
            }),
            submitted_at: new Date().toISOString(),
        };

        const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
            method: 'POST',
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
            },
            body: JSON.stringify([record]),
        });

        if (!insertResp.ok) {
            const errText = await insertResp.text();
            return errResp(`儲存失敗: ${errText}`, 500);
        }

        const result = await insertResp.json();

        return new Response(JSON.stringify({
            success: true,
            message: `✅ ${student_name} 的作品已成功提交！`,
            submission_id: result?.[0]?.id || null,
            combined_size: combined.length,
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e) {
        return errResp(`伺服器錯誤: ${e.message}`, 500);
    }
};

function errResp(msg, status = 400) {
    return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
