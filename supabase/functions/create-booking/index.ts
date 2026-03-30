import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, authorization, apikey'
};

// ── Base64url helpers ──
function base64url(str: string): string {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlFromBytes(buf: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Google Service Account JWT
async function getAccessToken(sa: any, scope: string): Promise<string> {
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const claim = base64url(JSON.stringify({
        iss: sa.client_email,
        scope,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    }));

    const pemContents = sa.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s/g, '');
    const binaryKey = Uint8Array.from(atob(pemContents), (c: string) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
        'pkcs8', binaryKey,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign']
    );

    const sigInput = new TextEncoder().encode(`${header}.${claim}`);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, sigInput);
    const signature = base64urlFromBytes(sig);
    const jwt = `${header}.${claim}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const data = await res.json();
    if (!data.access_token) {
        throw new Error(`Token error: ${data.error_description || data.error}`);
    }
    return data.access_token;
}


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

    try {
        const body = await req.json();
        const { name, email, phone, company, message, date, time, headcount, lineId } = body;

        if (!name || !email || !date || !time) {
            return new Response(JSON.stringify({
                error: '必填欄位：name, email, date, time'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ── 1. Create Google Calendar event ──
        const saKeyJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
        let calendarEventId = null;
        let calendarError = null;

        if (saKeyJson) {
            try {
                const sa = JSON.parse(saKeyJson);
                const accessToken = await getAccessToken(sa, 'https://www.googleapis.com/auth/calendar');
                const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID') || 'primary';

                // Parse booking time
                const [hour] = time.split(':').map(Number);
                const startDt = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+08:00`);
                const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);

                const eventBody = {
                    summary: `【諮詢預約】${name}${company ? ` - ${company}` : ''}`,
                    description: [
                        `👤 姓名：${name}`,
                        `📧 Email：${email}`,
                        phone ? `📱 電話：${phone}` : '',
                        lineId ? `💬 LINE：${lineId}` : '',
                        company ? `🏢 公司：${company}` : '',
                        headcount ? `👥 人數：${headcount}` : '',
                        message ? `\n📝 需求說明：\n${message}` : ''
                    ].filter(Boolean).join('\n'),
                    start: {
                        dateTime: startDt.toISOString(),
                        timeZone: 'Asia/Taipei'
                    },
                    end: {
                        dateTime: endDt.toISOString(),
                        timeZone: 'Asia/Taipei'
                    },
                    attendees: [{ email }],
                    reminders: {
                        useDefault: false,
                        overrides: [
                            { method: 'email', minutes: 60 },
                            { method: 'popup', minutes: 30 }
                        ]
                    },
                    colorId: '9' // Blueberry
                };

                const calRes = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(eventBody)
                    }
                );

                const calData = await calRes.json();
                if (calRes.ok) {
                    calendarEventId = calData.id;
                    console.log(`[booking] Calendar event created: ${calData.id}`);
                } else {
                    calendarError = calData.error?.message || 'Calendar insert failed';
                    console.error('[booking] Calendar error:', JSON.stringify(calData));
                }
            } catch (e) {
                calendarError = e.message;
                console.error('[booking] Calendar exception:', e);
            }
        }

        // ── 2. Save to enterprise_inquiries ──
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL'),
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        );

        const { data: inquiry, error: dbError } = await supabase
            .from('enterprise_inquiries')
            .insert([{
                name,
                email,
                phone: phone || '',
                line_id: lineId || '',
                company: company || '',
                team_size: headcount || '',
                message: message || '',
                inquiry_type: 'consulting',
                source_page: 'consulting.html',
                booking_date: date,
                booking_time: time,
                calendar_event_id: calendarEventId,
                status: 'new'
            }])
            .select('*');

        if (dbError) {
            console.error('[booking] DB error:', dbError);
        }

        return new Response(JSON.stringify({
            success: true,
            booking: {
                date,
                time,
                calendarEventCreated: !!calendarEventId,
                calendarEventId,
                calendarError,
                inquiryId: inquiry?.[0]?.id
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('[booking] Error:', err);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: err.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
