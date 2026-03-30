import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, authorization, apikey'
};

// Google JWT for Service Account
async function getAccessToken(serviceAccount, scope) {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const claim = btoa(JSON.stringify({
        iss: serviceAccount.client_email,
        sub: Deno.env.get('GOOGLE_CALENDAR_ID'),
        scope,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    }));

    const key = await importPrivateKey(serviceAccount.private_key);
    const signature = await sign(`${header}.${claim}`, key);
    const jwt = `${header}.${claim}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const data = await res.json();
    return data.access_token;
}

async function importPrivateKey(pem) {
    const pemContents = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\n/g, '');
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
        'pkcs8', binaryKey,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign']
    );
}

async function sign(input, key) {
    const data = new TextEncoder().encode(input);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data);
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// In-memory cache
let cache = { data: null, expiry: 0 };

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        // Check cache (5 min)
        if (cache.data && Date.now() < cache.expiry) {
            return new Response(JSON.stringify(cache.data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const saKeyJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
        if (!saKeyJson) {
            return new Response(JSON.stringify({
                calendarConnected: false,
                error: 'Service account not configured'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const sa = JSON.parse(saKeyJson);
        const accessToken = await getAccessToken(sa, 'https://www.googleapis.com/auth/calendar');
        const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID') || 'primary';
        const extraIds = (Deno.env.get('GOOGLE_EXTRA_CALENDAR_IDS') || '').split(',').filter(Boolean);

        // Build date range: next 30 weekdays
        const dates = [];
        const now = new Date();
        let d = new Date(now);
        d.setDate(d.getDate() + 1); // Start from tomorrow

        while (dates.length < 30) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) {
                dates.push(new Date(d));
            }
            d.setDate(d.getDate() + 1);
        }

        const timeMin = dates[0].toISOString();
        const timeMax = new Date(dates[dates.length - 1].getTime() + 24 * 60 * 60 * 1000).toISOString();

        // FreeBusy query
        const calendarItems = [{ id: calendarId }];
        for (const eid of extraIds) {
            calendarItems.push({ id: eid.trim() });
        }

        const fbRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                timeMin,
                timeMax,
                timeZone: 'Asia/Taipei',
                items: calendarItems
            })
        });

        const fbData = await fbRes.json();
        if (!fbRes.ok) {
            console.error('FreeBusy error:', JSON.stringify(fbData));
            return new Response(JSON.stringify({
                calendarConnected: false,
                error: 'Calendar API error'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Collect all busy intervals
        const allBusy = [];
        for (const cal of Object.values(fbData.calendars || {})) {
            for (const b of (cal.busy || [])) {
                allBusy.push({
                    start: new Date(b.start).getTime(),
                    end: new Date(b.end).getTime()
                });
            }
        }

        // Available slots: 09-17 (hourly) + 21-24 (hourly) = 11 slots per day
        const slotHours = [9, 10, 11, 12, 13, 14, 15, 16, 21, 22, 23];

        const result = dates.map(date => {
            const dateStr = date.toISOString().slice(0, 10);
            const slots = slotHours.map(hour => {
                const slotStart = new Date(date);
                slotStart.setHours(hour, 0, 0, 0);
                // Adjust for UTC+8
                const startMs = slotStart.getTime() - (8 * 60 * 60 * 1000);
                const endMs = startMs + 60 * 60 * 1000;

                const isBusy = allBusy.some(b =>
                    (startMs < b.end && endMs > b.start)
                );

                const label = `${String(hour).padStart(2, '0')}:00`;
                return { hour, label, available: !isBusy };
            });

            return {
                date: dateStr,
                dow: date.getDay(),
                slots: slots.filter(s => s.available).map(s => s.label),
                availableCount: slots.filter(s => s.available).length,
                allBusy: slots.every(s => !s.available)
            };
        });

        const responseData = {
            calendarConnected: true,
            timezone: 'Asia/Taipei',
            dates: result
        };

        cache = { data: responseData, expiry: Date.now() + 5 * 60 * 1000 };

        return new Response(JSON.stringify(responseData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Calendar availability error:', err);
        return new Response(JSON.stringify({
            calendarConnected: false,
            error: err.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
