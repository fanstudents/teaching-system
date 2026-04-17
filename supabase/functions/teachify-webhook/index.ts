import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

/**
 * Teachify 統一 Webhook 入口
 * 支援事件：
 *   - course.created → 自動建立 project
 *   - course.updated → 更新 project
 *   - payment.paid   → 建立購買紀錄 + 配對 session + 推廣者佣金通知
 *   - payment.refund → 標記退款
 */

// ── Resend 設定 ──
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_DxAbQkWb_PxLtAcFT1bACsR7BVaa4i6kK';
const FROM_EMAIL = 'service@mail.tbr.digital';
const FROM_NAME = '數位簡報室';
const AFFILIATE_DASHBOARD_URL = 'https://tbr.digital/affiliate-dashboard';

// ── 推廣者佣金通知信 HTML ──
function buildAffiliateNotificationHtml(params: {
    affiliateName: string;
    transactionId: string;
    courseName: string;
    amount: number;
    commissionRate: number;
    commissionAmount: number;
    currency: string;
}): string {
    const { affiliateName, transactionId, courseName, amount, commissionRate, commissionAmount, currency } = params;
    const ratePercent = Math.round(commissionRate * 100);
    const currencySymbol = currency === 'TWD' ? 'NT$' : '$';

    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>推廣佣金通知</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f8;">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 36px;border-radius:16px 16px 0 0;">
<div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">🎉 數位簡報室・推廣夥伴</div>
<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">新訂單佣金通知</div>
</td>
</tr>

<!-- Body -->
<tr>
<td style="background-color:#ffffff;padding:36px 36px 28px;font-size:14px;color:#333;line-height:1.75;">
<p style="margin:0 0 16px;font-size:15px;">Hi <strong>${affiliateName}</strong>，恭喜！</p>
<p style="margin:0 0 20px;">你推廣的課程有一筆新訂單成立 🎊，以下是訂單明細：</p>

<!-- 訂單明細卡片 -->
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8f9ff;border:1px solid #e8e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
<tr>
<td style="padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td style="padding:8px 0;border-bottom:1px solid #e8e8f0;">
<span style="color:#666;font-size:13px;">📋 訂單編號</span><br>
<strong style="font-size:14px;color:#1a1a2e;">${transactionId}</strong>
</td>
</tr>
<tr>
<td style="padding:8px 0;border-bottom:1px solid #e8e8f0;">
<span style="color:#666;font-size:13px;">📚 商品名稱</span><br>
<strong style="font-size:14px;color:#1a1a2e;">${courseName || '課程商品'}</strong>
</td>
</tr>
<tr>
<td style="padding:8px 0;border-bottom:1px solid #e8e8f0;">
<span style="color:#666;font-size:13px;">💰 訂單金額</span><br>
<strong style="font-size:14px;color:#1a1a2e;">${currencySymbol} ${amount.toLocaleString()}</strong>
</td>
</tr>
<tr>
<td style="padding:8px 0;border-bottom:1px solid #e8e8f0;">
<span style="color:#666;font-size:13px;">📊 分潤比例</span><br>
<strong style="font-size:14px;color:#6366f1;">${ratePercent}%</strong>
</td>
</tr>
<tr>
<td style="padding:8px 0;">
<span style="color:#666;font-size:13px;">🏆 本筆佣金</span><br>
<strong style="font-size:18px;color:#10b981;">${currencySymbol} ${commissionAmount.toLocaleString()}</strong>
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
<a href="${AFFILIATE_DASHBOARD_URL}" target="_blank" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(99,102,241,0.3);">前往聯盟行銷後台 →</a>
</td>
</tr>
</table>

<p style="margin:16px 0 0;font-size:13px;color:#888;">佣金將在確認後統一結算，詳情請至後台查看。</p>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="background-color:#fafafe;padding:20px 36px;border-top:1px solid #e8e8f0;border-radius:0 0 16px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td style="font-size:11px;color:#999;line-height:1.6;">
<div>此信件由 數位簡報室 系統自動發送</div>
<div>如有任何問題，歡迎直接回覆此信件</div>
</td>
<td align="right" style="font-size:11px;color:#ccc;">
<a href="https://www.instagram.com/tbr.digital/" style="color:#999;text-decoration:none;">Instagram</a>
&nbsp;·&nbsp;
<a href="https://www.linkedin.com/company/tbr-digital/" style="color:#999;text-decoration:none;">LinkedIn</a>
</td>
</tr>
</table>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
}

// ── 發送推廣者通知信（含追蹤、DB 範本） ──
async function sendAffiliateNotification(params: {
    affiliateEmail: string;
    affiliateName: string;
    transactionId: string;
    courseName: string;
    amount: number;
    commissionRate: number;
    commissionAmount: number;
    currency: string;
}, supabaseClient: any): Promise<void> {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://wsaknnhjgiqmkendeyrj.supabase.co';

    try {
        const ratePercent = Math.round(params.commissionRate * 100);
        const currencySymbol = params.currency === 'TWD' ? 'NT$' : '$';

        // 範本變數 map
        const vars: Record<string, string> = {
            affiliate_name: params.affiliateName,
            transaction_id: params.transactionId,
            course_name: params.courseName || '課程商品',
            amount: params.amount.toLocaleString(),
            currency_symbol: currencySymbol,
            rate_percent: String(ratePercent),
            commission_amount: params.commissionAmount.toLocaleString(),
            dashboard_url: AFFILIATE_DASHBOARD_URL,
        };

        // 1) 從 DB 讀取範本
        let subjectTemplate = '';
        let bodyTemplate = '';
        try {
            const { data: tpl } = await supabaseClient
                .from('email_templates')
                .select('subject_template, body_template')
                .eq('id', 'affiliate_commission')
                .single();
            if (tpl) {
                subjectTemplate = tpl.subject_template || '';
                bodyTemplate = tpl.body_template || '';
            }
        } catch { /* fallback below */ }

        // Fallback: 若 DB 沒範本，用 hardcoded
        if (!subjectTemplate) {
            subjectTemplate = '🎉 新訂單佣金通知 — {{currency_symbol}}{{commission_amount}} ({{rate_percent}}%)';
        }
        if (!bodyTemplate) {
            bodyTemplate = buildAffiliateNotificationHtml(params);
        }

        // 替換 {{變數}}
        function renderTemplate(template: string, variables: Record<string, string>): string {
            return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
        }

        const subject = renderTemplate(subjectTemplate, vars);
        const bodyContent = bodyTemplate.includes('<!DOCTYPE') ? bodyTemplate : wrapEmailShell(renderTemplate(bodyTemplate, vars));

        // 2) 建立 notification_logs 記錄
        const { data: logResult } = await supabaseClient.from('notification_logs').insert({
            notification_type: 'affiliate_commission',
            recipient_email: params.affiliateEmail,
            recipient_name: params.affiliateName,
            subject,
            reference_id: params.transactionId,
            reference_type: 'affiliate_order',
            metadata: {
                course_name: params.courseName,
                amount: params.amount,
                commission_rate: params.commissionRate,
                commission_amount: params.commissionAmount,
                currency: params.currency,
            },
            send_status: 'sending',
        }).select('id').single();

        const notifId = logResult?.id || '';
        let html = bodyContent;

        // 3) 嵌入追蹤 pixel + 連結追蹤
        if (notifId) {
            const trackingPixelUrl = `${SUPABASE_URL}/functions/v1/notification-tracker?nid=${notifId}&event=open`;
            html = html.replace('</body>', `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" /></body>`);

            html = html.replace(
                /href="(https:\/\/tbr\.digital\/affiliate-dashboard[^"]*)"/g,
                (_match: string, originalUrl: string) => {
                    const trackedUrl = `${SUPABASE_URL}/functions/v1/notification-tracker?nid=${notifId}&event=click&url=${encodeURIComponent(originalUrl)}`;
                    return `href="${trackedUrl}"`;
                }
            );
        }

        // 4) 透過 Resend 發信
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: [params.affiliateEmail],
                subject,
                html,
                text: `Hi ${params.affiliateName}，你推廣的課程「${params.courseName}」有一筆新訂單！訂單編號：${params.transactionId}，金額：${currencySymbol}${params.amount.toLocaleString()}，佣金：${currencySymbol}${params.commissionAmount.toLocaleString()} (${ratePercent}%)。前往後台查看：${AFFILIATE_DASHBOARD_URL}`,
                reply_to: FROM_EMAIL,
            }),
        });

        const data = await res.json();

        // 5) 回寫 notification_logs
        if (notifId) {
            if (res.ok) {
                await supabaseClient.from('notification_logs').update({
                    send_status: 'sent',
                    resend_message_id: data.id || '',
                    sent_at: new Date().toISOString(),
                }).eq('id', notifId);
                console.log(`[webhook] Affiliate notification sent to ${params.affiliateEmail}, messageId: ${data.id}, notifId: ${notifId}`);
            } else {
                await supabaseClient.from('notification_logs').update({
                    send_status: 'failed',
                    error_message: data.message || JSON.stringify(data),
                }).eq('id', notifId);
                console.error(`[webhook] Resend error for ${params.affiliateEmail}:`, data);
            }
        }
    } catch (err) {
        console.error(`[webhook] Failed to send affiliate notification:`, err.message);
    }
}

// ── Email 外殼（包裝 body content） ──
function wrapEmailShell(bodyHtml: string): string {
    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>推廣佣金通知</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f8;">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 36px;border-radius:16px 16px 0 0;">
<div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">🎉 數位簡報室・推廣夥伴</div>
<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">新訂單佣金通知</div>
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
<div>此信件由 數位簡報室 系統自動發送</div>
<div>如有任何問題，歡迎直接回覆此信件</div>
</td>
<td align="right" style="font-size:11px;color:#ccc;">
<a href="https://www.instagram.com/tbr.digital/" style="color:#999;text-decoration:none;">Instagram</a>
&nbsp;·&nbsp;
<a href="https://www.linkedin.com/company/tbr-digital/" style="color:#999;text-decoration:none;">LinkedIn</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-webhook-secret, authorization, apikey'
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const secret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('WEBHOOK_SECRET');
    if (expectedSecret && secret !== expectedSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const json = (data, status = 200) =>
        new Response(JSON.stringify(data), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    try {
        const body = await req.json();
        const eventType = body.type || '';
        const d = body.data || body;

        switch (eventType) {

            // ━━━━ COURSE CREATED ━━━━
            case 'course.created': {
                const courseId = d.id || '';
                const courseName = d.name || '未命名課程';
                const description = d.description || '';
                const slug = d.slug || '';
                const state = d.state || 'draft';
                const plans = d.plans || [];

                if (!courseId) {
                    return json({ error: 'Missing course id' }, 400);
                }

                const { data: existing } = await supabase
                    .from('projects')
                    .select('id')
                    .eq('course_id', courseId);

                if (existing?.length > 0) {
                    return json({
                        success: true,
                        action: 'course_already_exists',
                        project_id: existing[0].id
                    });
                }

                const joinCode = generateCode(6);
                const purchaseLink = slug ? `https://teachify.tw/${slug}` : '';

                const { data: projectResult, error: projectError } = await supabase
                    .from('projects')
                    .insert([{
                        name: courseName,
                        description,
                        join_code: joinCode,
                        course_id: courseId,
                        course_type: mapCourseType(d.type),
                        purchase_link: purchaseLink,
                        current_phase: 'pre-class',
                        slides_data: JSON.stringify({
                            teachify_slug: slug,
                            teachify_state: state,
                            plans: plans.map(p => ({
                                id: p.id,
                                name: p.name,
                                amount: p.amount,
                                currency: p.currency || 'TWD'
                            }))
                        })
                    }])
                    .select('*');

                if (projectError) throw projectError;

                return json({
                    success: true,
                    action: 'course_created',
                    project_id: projectResult?.[0]?.id,
                    join_code: joinCode,
                    course_id: courseId
                });
            }

            // ━━━━ COURSE UPDATED ━━━━
            case 'course.updated': {
                const courseId = d.id || '';
                if (!courseId) {
                    return json({ error: 'Missing course id' }, 400);
                }

                const updateFields = {};
                if (d.name) updateFields.name = d.name;
                if (d.description !== undefined) updateFields.description = d.description;
                if (d.slug) updateFields.purchase_link = `https://teachify.tw/${d.slug}`;

                if (d.plans || d.state) {
                    const { data: current } = await supabase
                        .from('projects')
                        .select('slides_data')
                        .eq('course_id', courseId);

                    let existingMeta = {};
                    try { existingMeta = JSON.parse(current?.[0]?.slides_data || '{}'); } catch { }

                    if (d.state) existingMeta.teachify_state = d.state;
                    if (d.slug) existingMeta.teachify_slug = d.slug;
                    if (d.plans) {
                        existingMeta.plans = d.plans.map(p => ({
                            id: p.id, name: p.name, amount: p.amount, currency: p.currency || 'TWD'
                        }));
                    }
                    updateFields.slides_data = JSON.stringify(existingMeta);
                }

                if (Object.keys(updateFields).length === 0) {
                    return json({ success: true, action: 'no_changes' });
                }

                await supabase
                    .from('projects')
                    .update(updateFields)
                    .eq('course_id', courseId);

                return json({
                    success: true,
                    action: 'course_updated',
                    course_id: courseId
                });
            }

            // ━━━━ PAYMENT PAID ━━━━
            case 'payment.paid': {
                const email = d.user?.email || '';
                const name = d.user?.name || '';
                const phone = d.user?.phone_number || '';
                const order_id = d.trade_no || '';
                const amount = d.amount || 0;

                let course_id = '';
                let plan_id = '';
                if (d.lineitems?.length > 0) {
                    course_id = d.lineitems[0].product_id || d.lineitems[0].item_slug || '';
                    plan_id = d.lineitems[0].item_id || '';
                }

                if (!email && !order_id) {
                    return json({ error: 'Missing email or trade_no' }, 400);
                }

                const { data: purchaseResult, error: purchaseError } = await supabase
                    .from('purchases')
                    .insert([{
                        email, name, order_id, course_id, phone, amount,
                        payment_state: 'paid',
                        raw_data: body
                    }])
                    .select('*');

                if (purchaseError) {
                    if (purchaseError.message?.includes('duplicate') || purchaseError.code === '23505') {
                        return json({ error: 'Duplicate order_id', order_id }, 409);
                    }
                    throw purchaseError;
                }

                const purchase = purchaseResult?.[0];
                let syncedSession = null;

                if (course_id) {
                    const { data: projects } = await supabase
                        .from('projects')
                        .select('*')
                        .eq('course_id', course_id);

                    if (projects?.length > 0) {
                        const project = projects[0];

                        // 1) Try exact match by teachify_plan_id
                        let session = null;
                        if (plan_id) {
                            const { data: exactMatch } = await supabase
                                .from('project_sessions')
                                .select('*')
                                .eq('project_id', project.id)
                                .eq('teachify_plan_id', plan_id)
                                .in('current_phase', ['pre-class', 'in-class']);
                            if (exactMatch?.length > 0) {
                                session = exactMatch[0];
                            }
                        }

                        // 2) Fallback: first active session
                        if (!session) {
                            const { data: sessions } = await supabase
                                .from('project_sessions')
                                .select('*')
                                .eq('project_id', project.id)
                                .in('current_phase', ['pre-class', 'in-class'])
                                .order('date', { ascending: true });
                            if (sessions?.length > 0) {
                                session = sessions[0];
                            }
                        }

                        // 3) Auto-create session if none found (首次有人報名)
                        if (!session && plan_id) {
                            const lineitem = d.lineitems?.[0] || {};
                            const sessionCode = generateCode(6);
                            const sessionName = lineitem.name || '新場次';
                            const today = new Date().toISOString().slice(0, 10);

                            const { data: newSessions, error: createErr } = await supabase
                                .from('project_sessions')
                                .insert([{
                                    project_id: project.id,
                                    session_code: sessionCode,
                                    join_code: project.join_code || sessionCode,
                                    venue: sessionName,
                                    date: today,
                                    current_phase: 'pre-class',
                                    teachify_plan_id: plan_id,
                                    max_capacity: 50,
                                    session_format: 'onsite'
                                }])
                                .select('*');

                            if (!createErr && newSessions?.length > 0) {
                                session = newSessions[0];
                                console.log(`[webhook] Auto-created session: ${sessionCode} for plan ${plan_id}`);
                            }
                        }

                        if (session) {
                            syncedSession = session;

                            await supabase.from('students').insert([{
                                email, name,
                                project_id: project.id,
                                session_id: session.id,
                                session_code: session.session_code,
                                order_id,
                                purchase_id: purchase?.id,
                                registration_status: 'purchased'
                            }]);

                            if (purchase?.id) {
                                await supabase
                                    .from('purchases')
                                    .update({ synced_to_session: true, session_id: session.id })
                                    .eq('id', purchase.id);
                            }
                        }
                    }
                }

                // ── Sync to orders table ──
                const couponCode = d.coupon_code || d.coupon_name || '';
                const lineitem = d.lineitems?.[0] || {};
                const courseName = lineitem.name || lineitem.item_name || d.course_name || '';
                const planName = lineitem.plan_name || lineitem.item_plan_name || '';

                await supabase.from('orders').upsert([{
                    transaction_id: order_id || `wh-${Date.now()}`,
                    amount,
                    currency: d.currency || 'TWD',
                    payment_time: d.paid_at || new Date().toISOString(),
                    payment_status: 'Paid',
                    payment_method: d.payment_method || '',
                    coupon_code: couponCode,
                    coupon_name: d.coupon_name || couponCode,
                    course_name: courseName,
                    plan_name: planName,
                    student_email: email,
                    student_name: name,
                    student_phone: phone,
                    source: 'webhook'
                }], { onConflict: 'transaction_id' });

                // ── Sync to affiliate_orders if coupon matches an affiliate ──
                if (couponCode) {
                    const { data: matchedAff } = await supabase
                        .from('affiliates')
                        .select('*')
                        .eq('coupon_code', couponCode)
                        .eq('status', 'approved')
                        .limit(1);

                    if (matchedAff?.length > 0) {
                        const aff = matchedAff[0];
                        const rate = Number(aff.commission_rate) || 0.20;
                        const commissionAmount = Math.round(amount * rate);

                        await supabase.from('affiliate_orders').upsert([{
                            transaction_id: order_id || `wh-${Date.now()}`,
                            amount,
                            currency: d.currency || 'TWD',
                            payment_time: d.paid_at || new Date().toISOString(),
                            payment_status: 'Paid',
                            coupon_code: couponCode,
                            coupon_name: d.coupon_name || couponCode,
                            course_name: courseName,
                            plan_name: planName,
                            student_name: name,
                            student_email: email,
                            student_phone: phone,
                            affiliate_name: aff.name,
                            affiliate_email: aff.email,
                            affiliate_code: aff.coupon_code,
                            commission_rate: rate,
                            commission_amount: commissionAmount,
                            commission_status: 'pending'
                        }], { onConflict: 'transaction_id' });

                        console.log(`[webhook] Affiliate order created for ${aff.name} (${aff.coupon_code}), commission: $${commissionAmount}`);

                        // ── 發送推廣者佣金通知信 ──
                        await sendAffiliateNotification({
                            affiliateEmail: aff.email,
                            affiliateName: aff.name,
                            transactionId: order_id,
                            courseName,
                            amount,
                            commissionRate: rate,
                            commissionAmount,
                            currency: d.currency || 'TWD',
                        }, supabase);
                    }
                }

                return json({
                    success: true,
                    action: 'purchase_created',
                    purchase_id: purchase?.id,
                    synced_to_session: !!syncedSession,
                    session_id: syncedSession?.id || null,
                    matched_by: syncedSession ? (plan_id ? 'plan_id' : 'fallback') : null
                });
            }

            // ━━━━ PAYMENT REFUND ━━━━
            case 'payment.refund': {
                const email = d.user?.email || '';
                const name = d.user?.name || '';
                const phone = d.user?.phone_number || '';
                const order_id = d.trade_no || '';
                const amount = d.amount || 0;
                const refunded_amount = d.refunded_amount || 0;

                let course_id = '';
                if (d.lineitems?.length > 0) {
                    course_id = d.lineitems[0].product_id || d.lineitems[0].item_slug || '';
                }

                let existingPurchase = null;
                if (order_id) {
                    const { data: found } = await supabase
                        .from('purchases')
                        .select('*')
                        .eq('order_id', order_id);
                    existingPurchase = found?.[0];
                }

                if (existingPurchase) {
                    await supabase
                        .from('purchases')
                        .update({
                            payment_state: 'refunded',
                            refunded_amount,
                            raw_data: body
                        })
                        .eq('id', existingPurchase.id);

                    if (existingPurchase.session_id) {
                        await supabase
                            .from('students')
                            .update({ registration_status: 'refunded' })
                            .eq('purchase_id', existingPurchase.id);
                    }

                    return json({
                        success: true,
                        action: 'refund_updated',
                        purchase_id: existingPurchase.id,
                        refunded_amount
                    });
                } else {
                    const { data: refundResult } = await supabase
                        .from('purchases')
                        .insert([{
                            email, name,
                            order_id: order_id || `refund-${Date.now()}`,
                            course_id, phone, amount,
                            payment_state: 'refunded',
                            refunded_amount,
                            raw_data: body
                        }])
                        .select('*');

                    return json({
                        success: true,
                        action: 'refund_created_new',
                        purchase_id: refundResult?.[0]?.id,
                        refunded_amount
                    });
                }
            }

            // ━━━━ UNKNOWN EVENT ━━━━
            default: {
                await supabase
                    .from('purchases')
                    .insert([{
                        email: d.user?.email || d.email || 'unknown',
                        name: d.user?.name || d.name || '',
                        order_id: `evt-${eventType}-${Date.now()}`,
                        payment_state: eventType || 'unknown',
                        raw_data: body
                    }]);

                return json({
                    success: true,
                    action: 'unknown_event_stored',
                    event_type: eventType
                });
            }
        }

    } catch (err) {
        return json({
            error: 'Internal server error',
            message: err.message
        }, 500);
    }
});

function generateCode(length) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function mapCourseType(teachifyType) {
    const map = {
        'Course': 'ai-workplace',
        'Workshop': 'workshop',
        'Livestream': 'workshop'
    };
    return map[teachifyType] || 'other';
}
