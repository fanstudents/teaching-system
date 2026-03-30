import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, authorization, apikey'
};

// ── Base64url helpers (safe for Deno) ──
function base64url(str: string): string {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromBytes(buf: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Google Service Account JWT ──
async function getAccessToken(sa: any, scope: string): Promise<string> {
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);

    // For Service Account: iss = client_email, NO sub unless Domain-Wide Delegation
    const claimSet = {
        iss: sa.client_email,
        scope,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    };
    const claim = base64url(JSON.stringify(claimSet));

    // Import private key
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

    // Sign
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
        console.error('[calendar] Token error:', JSON.stringify(data));
        throw new Error(`Failed to get access token: ${data.error_description || data.error || 'unknown'}`);
    }
    return data.access_token;
}

// In-memory cache
let cache: { data: any; expiry: number } = { data: null, expiry: 0 };

serve(async (req: Request) => {
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
            console.error('[calendar] GOOGLE_SERVICE_ACCOUNT_KEY not set');
            return new Response(JSON.stringify({
                calendarConnected: false,
                error: 'Service account not configured'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        let sa: any;
        try {
            sa = JSON.parse(saKeyJson);
        } catch (e) {
            console.error('[calendar] Failed to parse service account JSON:', e);
            return new Response(JSON.stringify({
                calendarConnected: false,
                error: 'Invalid service account JSON'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (!sa.private_key || !sa.client_email) {
            console.error('[calendar] Missing private_key or client_email. Keys found:', Object.keys(sa).join(', '));
            return new Response(JSON.stringify({
                calendarConnected: false,
                error: 'Invalid service account: missing private_key or client_email. You may have uploaded an OAuth client secret instead of a Service Account key.'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[calendar] Using service account: ${sa.client_email}`);

        const accessToken = await getAccessToken(sa, 'https://www.googleapis.com/auth/calendar.readonly');
        const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID') || 'primary';
        const extraIds = (Deno.env.get('GOOGLE_EXTRA_CALENDAR_IDS') || '').split(',').map((s: string) => s.trim()).filter(Boolean);

        console.log(`[calendar] Querying calendars: ${calendarId}, extras: ${extraIds.join(', ') || 'none'}`);

        // Build date range: next 30 weekdays from tomorrow (Asia/Taipei)
        // Use explicit timezone offset for Taipei (UTC+8)
        const TAIPEI_OFFSET = 8 * 60 * 60 * 1000;
        const nowMs = Date.now();
        const taipeiNow = new Date(nowMs + TAIPEI_OFFSET);

        const dates: Date[] = [];
        let d = new Date(taipeiNow);
        d.setUTCHours(0, 0, 0, 0);
        d = new Date(d.getTime() + 24 * 60 * 60 * 1000); // tomorrow in Taipei

        while (dates.length < 30) {
            const day = d.getUTCDay();
            if (day !== 0 && day !== 6) {
                dates.push(new Date(d));
            }
            d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
        }

        // timeMin/timeMax in RFC3339 for Google API
        const firstDateUtc = new Date(dates[0].getTime() - TAIPEI_OFFSET);
        const lastDateUtc = new Date(dates[dates.length - 1].getTime() + 24 * 60 * 60 * 1000 - TAIPEI_OFFSET);
        const timeMin = firstDateUtc.toISOString();
        const timeMax = lastDateUtc.toISOString();

        // FreeBusy query
        const calendarItems = [{ id: calendarId }, ...extraIds.map((id: string) => ({ id }))];

        const fbRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ timeMin, timeMax, timeZone: 'Asia/Taipei', items: calendarItems })
        });

        const fbData = await fbRes.json();
        if (!fbRes.ok) {
            console.error('[calendar] FreeBusy error:', JSON.stringify(fbData));
            return new Response(JSON.stringify({
                calendarConnected: false,
                error: `Calendar API error: ${fbData.error?.message || 'unknown'}`
            }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Collect ALL busy intervals from ALL calendars
        const allBusy: { start: number; end: number }[] = [];
        for (const [calId, calData] of Object.entries(fbData.calendars || {})) {
            const busyList = (calData as any).busy || [];
            console.log(`[calendar] ${calId}: ${busyList.length} busy intervals`);
            for (const b of busyList) {
                allBusy.push({
                    start: new Date(b.start).getTime(),
                    end: new Date(b.end).getTime()
                });
            }
        }

        // Available time slots (in Asia/Taipei hours)
        // Morning+Afternoon: 09-17, Evening: 21-23
        const slotHours = [9, 10, 11, 12, 13, 14, 15, 16, 21, 22, 23];

        const result = dates.map(date => {
            // date is midnight Taipei (stored as UTC for that Taipei midnight)
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const slots = slotHours.map(hour => {
                // Taipei hour → UTC timestamp
                // date is midnight Taipei in UTC-adjusted form
                // So Taipei 09:00 = date + 9h - 8h(offset) = date + 1h in UTC
                const slotStartUtc = date.getTime() + (hour - 8) * 60 * 60 * 1000;
                const slotEndUtc = slotStartUtc + 60 * 60 * 1000;

                const isBusy = allBusy.some(b =>
                    (slotStartUtc < b.end && slotEndUtc > b.start)
                );

                const label = `${String(hour).padStart(2, '0')}:00`;
                return { hour, label, available: !isBusy };
            });

            return {
                date: dateStr,
                dow: date.getUTCDay(),
                slots: slots.filter(s => s.available).map(s => s.label),
                availableCount: slots.filter(s => s.available).length,
                allBusy: slots.every(s => !s.available)
            };
        });

        const responseData = {
            calendarConnected: true,
            timezone: 'Asia/Taipei',
            totalDates: result.length,
            totalBusyIntervals: allBusy.length,
            dates: result
        };

        cache = { data: responseData, expiry: Date.now() + 5 * 60 * 1000 };

        return new Response(JSON.stringify(responseData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('[calendar] Error:', err?.message, err?.stack);
        return new Response(JSON.stringify({
            calendarConnected: false,
            error: err?.message || 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
