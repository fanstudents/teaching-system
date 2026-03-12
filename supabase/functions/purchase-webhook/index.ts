import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

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

    try {
        const body = await req.json();

        const isTeachify = body.type && body.data;
        const eventType = isTeachify ? body.type : (body.event_type || 'purchase');
        const d = isTeachify ? body.data : body;

        const email = d.user?.email || d.email || '';
        const name = d.user?.name || d.name || '';
        const phone = d.user?.phone_number || d.phone || '';
        const order_id = d.trade_no || d.order_id || '';
        const amount = d.amount || 0;
        const refunded_amount = d.refunded_amount || 0;
        const payment_state = d.payment_state || '';

        let course_id = d.course_id || '';
        let plan_id = '';
        if (!course_id && d.lineitems?.length > 0) {
            course_id = d.lineitems[0].product_id || d.lineitems[0].item_slug || '';
            plan_id = d.lineitems[0].item_id || '';
        } else if (d.lineitems?.length > 0) {
            plan_id = d.lineitems[0].item_id || '';
        }

        if (!email && !order_id) {
            return new Response(JSON.stringify({
                error: 'Missing required fields: need email or order_id (trade_no)',
                received_type: eventType
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ── Handle refund events ──
        if (eventType === 'payment.refund') {
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
                        refunded_amount: refunded_amount,
                        raw_data: body
                    })
                    .eq('id', existingPurchase.id);

                if (existingPurchase.session_id) {
                    await supabase
                        .from('students')
                        .update({ registration_status: 'refunded' })
                        .eq('purchase_id', existingPurchase.id);
                }

                return new Response(JSON.stringify({
                    success: true,
                    action: 'refund_updated',
                    purchase_id: existingPurchase.id,
                    refunded_amount
                }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } else {
                const { data: refundResult } = await supabase
                    .from('purchases')
                    .insert([{
                        email,
                        name,
                        order_id: order_id || `refund-${Date.now()}`,
                        course_id,
                        phone,
                        amount,
                        payment_state: 'refunded',
                        refunded_amount,
                        raw_data: body
                    }])
                    .select('*');

                return new Response(JSON.stringify({
                    success: true,
                    action: 'refund_created_new',
                    purchase_id: refundResult?.[0]?.id,
                    refunded_amount
                }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // ── Handle purchase/paid events ──
        const purchaseData = {
            email,
            name,
            order_id,
            course_id,
            phone,
            amount,
            payment_state: payment_state || 'paid',
            raw_data: body
        };

        const { data: purchaseResult, error: purchaseError } = await supabase
            .from('purchases')
            .insert([purchaseData])
            .select('*');

        if (purchaseError) {
            if (purchaseError.message?.includes('duplicate') || purchaseError.code === '23505') {
                return new Response(JSON.stringify({
                    error: 'Duplicate order_id',
                    order_id
                }), {
                    status: 409,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
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

                    await supabase
                        .from('students')
                        .insert([{
                            email,
                            name,
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

        return new Response(JSON.stringify({
            success: true,
            action: 'purchase_created',
            purchase_id: purchase?.id,
            synced_to_session: !!syncedSession,
            session_id: syncedSession?.id || null
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: err.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
