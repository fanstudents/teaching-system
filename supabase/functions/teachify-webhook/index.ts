import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

/**
 * Teachify 統一 Webhook 入口
 * 支援事件：
 *   - course.created → 自動建立 project
 *   - course.updated → 更新 project
 *   - payment.paid   → 建立購買紀錄 + 配對 session
 *   - payment.refund → 標記退款
 */

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
