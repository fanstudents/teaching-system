// process-scheduled Edge Function — 排程信件處理器
// 由 pg_cron 每小時觸發，處理到期的排程信件
// 支援 AI 即時生成追蹤信內容

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://wsaknnhjgiqmkendeyrj.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ZEABUR_BASE_URL = 'https://hnd1.aihub.zeabur.ai';
const ZEABUR_API_KEY = Deno.env.get('ZEABUR_API_KEY') || 'sk-CYwvqJAEhySFAYcksFAi0Q';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── AI 生成追蹤信 ──
async function generateFollowUp(
    studentName: string,
    delayDays: number,
    originalEmailBody: string,
    sessionConfig: Record<string, string>
): Promise<{ subject: string; body: string }> {
    const signature = sessionConfig.signature || '樊松蒲｜數位簡報室';

    const systemPrompt = `你是一位企業內訓講師，正在撰寫課後追蹤信件。
這封信是在課後 ${delayDays} 天後發送的跟進信。

寫作要求：
- 語氣溫暖、關心，像朋友問候
- 詢問學員是否有將課堂所學應用在工作中
- 提供 1-2 個具體的實踐建議
- 如果是 7 天追蹤，問是否有遇到困難
- 如果是 14 天以上，分享一個進階技巧或資源
- 邀請回信分享心得
- 控制在 300-400 字
- 純文字，不要 markdown 或 emoji
- 段落標題用「── xxx ──」格式
- 署名：${signature}
${sessionConfig.ai_prompt ? `\n講師額外指示：${sessionConfig.ai_prompt}` : ''}`;

    const userPrompt = `學員姓名：${studentName}
追蹤天數：課後第 ${delayDays} 天
原始回饋信摘要（前 500 字）：
${originalEmailBody.substring(0, 500)}

請撰寫追蹤信件。`;

    try {
        const res = await fetch(`${ZEABUR_BASE_URL}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': ZEABUR_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-5',
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
                temperature: 0.7,
                max_tokens: 1000,
            }),
        });

        const data = await res.json();
        const text = data.content?.[0]?.text || '';

        if (!text) throw new Error('Empty AI response');

        return {
            subject: `${studentName}，課後 ${delayDays} 天，你的 AI 實踐進展如何？`,
            body: text,
        };
    } catch (err) {
        // Fallback template
        return {
            subject: `${studentName}，課後 ${delayDays} 天，你的 AI 實踐進展如何？`,
            body: `${studentName} 你好，

距離上次課程已經 ${delayDays} 天了，想關心一下你的學習進展。

── 想請你回想一下 ──

在這段時間裡，你有沒有試著把課堂上學到的 AI 技巧應用在工作中？不管是用 ChatGPT 整理會議紀錄、用 Claude 撰寫報告，還是其他任何嘗試，都很值得。

── 給你的建議 ──

如果你還沒開始實踐，建議從「最痛的點」開始 —— 找出工作中最花時間的重複性任務，試著用 AI 工具處理看看。

如果你已經在用了，恭喜！建議你把好用的 Prompt 記錄下來，建立自己的模板庫，這會讓你的效率越來越高。

有任何問題或心得，歡迎直接回信跟我分享！

${signature}`,
        };
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        // 查詢到期的排程信件
        const now = new Date().toISOString();
        const { data: pendingEmails, error } = await supabase
            .from('scheduled_emails')
            .select('*, project_sessions!inner(post_email_template)')
            .eq('status', 'pending')
            .lte('scheduled_at', now)
            .order('scheduled_at', { ascending: true })
            .limit(50); // 每次最多處理 50 封

        if (error) throw error;
        if (!pendingEmails || pendingEmails.length === 0) {
            return new Response(
                JSON.stringify({ success: true, processed: 0, message: 'No pending emails' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        let sent = 0;
        let failed = 0;

        for (const email of pendingEmails) {
            try {
                const sessionConfig = email.project_sessions?.post_email_template || {};

                // 如果沒有預先生成的 body，用 AI 生成
                let subject = email.subject;
                let body = email.body;

                if (!body) {
                    // 查找原始 email draft 取得首次信件內容
                    const { data: drafts } = await supabase
                        .from('email_drafts')
                        .select('body')
                        .eq('student_email', email.student_email)
                        .eq('status', 'sent')
                        .order('sent_at', { ascending: false })
                        .limit(1);

                    const originalBody = drafts?.[0]?.body || '';

                    const generated = await generateFollowUp(
                        email.student_name,
                        email.delay_days,
                        originalBody,
                        sessionConfig
                    );
                    subject = generated.subject;
                    body = generated.body;
                }

                // 發送信件
                const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    },
                    body: JSON.stringify({
                        to: email.student_email,
                        subject,
                        body,
                        replyTo: 'service@mail.tbr.digital',
                    }),
                });

                if (!sendRes.ok) {
                    const err = await sendRes.text();
                    throw new Error(`send-email failed: ${err}`);
                }

                // 標記已發送
                await supabase
                    .from('scheduled_emails')
                    .update({
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                        subject,
                        body,
                    })
                    .eq('id', email.id);

                sent++;
            } catch (emailErr) {
                console.error(`[process-scheduled] Failed for ${email.student_email}:`, emailErr.message);

                await supabase
                    .from('scheduled_emails')
                    .update({
                        status: 'failed',
                        error_message: emailErr.message,
                    })
                    .eq('id', email.id);

                failed++;
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                processed: pendingEmails.length,
                sent,
                failed,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[process-scheduled] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
