// send-email Edge Function — HTML 模板 + 開信追蹤
// 透過 Resend API 發送專業 HTML 格式信件

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_ZaV22t8T_8qh2TiAfCA3cXDYfZNZjB7xn';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://wsaknnhjgiqmkendeyrj.supabase.co';
const FROM_EMAIL = 'service@tbr.digital';
const FROM_NAME = '數位簡報室';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── 純文字 → HTML 轉換 ──
function textToHtml(text: string): string {
    // Escape HTML entities
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 段落標題（── xxx ──）
    html = html.replace(/──\s*(.+?)\s*──/g,
        '<h3 style="font-size:15px;font-weight:600;color:#1a1a2e;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #e8e8f0;">$1</h3>');

    // 編號列表（1. 2. 3.）
    html = html.replace(/^(\d+)\.\s+(.+)$/gm,
        '<div style="display:flex;gap:10px;margin:6px 0;"><span style="color:#6366f1;font-weight:600;min-width:20px;">$1.</span><span>$2</span></div>');

    // URLs → clickable links
    html = html.replace(/(https?:\/\/[^\s<]+)/g,
        '<a href="$1" style="color:#6366f1;text-decoration:underline;">$1</a>');

    // 雙換行 → 段落
    const paragraphs = html.split(/\n\n+/);
    html = paragraphs.map(p => {
        p = p.trim();
        if (!p) return '';
        if (p.startsWith('<h3') || p.startsWith('<div style="display:flex')) return p;
        // 單換行 → <br>
        p = p.replace(/\n/g, '<br>');
        return `<p style="margin:0 0 14px;line-height:1.75;">${p}</p>`;
    }).join('\n');

    return html;
}

// ── HTML Email 模板 ──
function wrapInHtmlTemplate(bodyHtml: string, trackingPixelUrl?: string): string {
    const trackingImg = trackingPixelUrl
        ? `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`
        : '';

    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>課後回饋</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f8;">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 36px;border-radius:16px 16px 0 0;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td>
<div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">📬 數位簡報室</div>
<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">課後學習回饋</div>
</td>
</tr>
</table>
</td>
</tr>

<!-- Body -->
<tr>
<td style="background-color:#ffffff;padding:36px 36px 28px;font-size:14px;color:#333;line-height:1.75;">
${bodyHtml}
</td>
</tr>

<!-- Footer -->
<tr>
<td style="background-color:#fafafe;padding:20px 36px;border-top:1px solid #e8e8f0;border-radius:0 0 16px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td style="font-size:11px;color:#999;line-height:1.6;">
<div>此信件由<a href="https://tbr.digital" style="color:#6366f1;text-decoration:none;"> 數位簡報室 </a>系統自動發送</div>
<div style="margin-top:4px;">如有任何問題，歡迎直接回覆此信件</div>
</td>
<td align="right" style="font-size:11px;color:#ccc;">
<a href="https://www.instagram.com/tbr.digital/" style="color:#999;text-decoration:none;">Instagram</a>
&nbsp;·&nbsp;
<a href="https://www.linkedin.com/company/tbr-digital/" style="color:#999;text-decoration:none;">LinkedIn</a>
</td>
</tr>
</table>
${trackingImg}
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const { to, subject, body, replyTo, draftId, homeworkImages } = await req.json();

        if (!to || !body) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: to, body' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 純文字 → HTML
        let bodyHtml = textToHtml(body);

        // ★ 作業圖片嵌入
        if (homeworkImages && Array.isArray(homeworkImages) && homeworkImages.length > 0) {
            bodyHtml += `<div style="margin-top:28px;padding-top:20px;border-top:2px solid #e8e8f0;">
                <h3 style="font-size:15px;font-weight:600;color:#1a1a2e;margin:0 0 16px;">📸 你的課堂作品</h3>`;
            homeworkImages.forEach((hw: { title: string; imageUrl: string; prompt?: string }) => {
                bodyHtml += `<div style="margin-bottom:16px;border:1px solid #e8e8f0;border-radius:12px;overflow:hidden;">
                    <img src="${hw.imageUrl}" alt="${hw.title}" style="width:100%;max-height:400px;object-fit:contain;display:block;background:#f8f9fa;" />
                    <div style="padding:12px 16px;">
                        <div style="font-weight:600;font-size:13px;color:#1a1a2e;">${hw.title}</div>
                        ${hw.prompt ? `<div style="margin-top:4px;font-size:12px;color:#6366f1;">💬 ${hw.prompt}</div>` : ''}
                    </div>
                </div>`;
            });
            bodyHtml += `</div>`;
        }

        // Tracking pixel URL
        const trackingUrl = draftId
            ? `${SUPABASE_URL}/functions/v1/email-tracker?id=${draftId}`
            : undefined;

        const htmlContent = wrapInHtmlTemplate(bodyHtml, trackingUrl);

        // ── 透過 Resend API 發送 ──
        const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: [to],
                subject: subject || '課後學習回饋',
                html: htmlContent,
                text: body, // 純文字版本 fallback
                reply_to: replyTo || FROM_EMAIL,
            }),
        });

        const resendData = await resendRes.json();

        if (!resendRes.ok) {
            console.error('[send-email] Resend error:', resendData);
            return new Response(
                JSON.stringify({ error: resendData.message || 'Resend API error', details: resendData }),
                { status: resendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                messageId: resendData.id,
                to,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[send-email] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
