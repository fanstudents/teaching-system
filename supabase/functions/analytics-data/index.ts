import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, authorization, apikey'
};

// ── Base64url helpers (same pattern as create-booking) ──
function base64url(str: string): string {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlFromBytes(buf: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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

// ── GA4 Property ID ──
const GA4_PROPERTY_ID = '412879003';
// ── GSC Site URL ──
const GSC_SITE_URL = 'sc-domain:tbr.digital';

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
        const saKeyJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
        if (!saKeyJson) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
        }
        const sa = JSON.parse(saKeyJson);

        const body = await req.json();
        const { type, dateRange } = body;
        // dateRange: { startDate: '2025-03-01', endDate: '2025-03-31' }

        const startDate = dateRange?.startDate || getDateStr(-30);
        const endDate = dateRange?.endDate || getDateStr(0);

        if (type === 'ga4') {
            return await handleGA4(sa, startDate, endDate);
        } else if (type === 'gsc') {
            return await handleGSC(sa, startDate, endDate);
        } else if (type === 'both') {
            const [ga4Result, gscResult] = await Promise.allSettled([
                fetchGA4Data(sa, startDate, endDate),
                fetchGSCData(sa, startDate, endDate)
            ]);
            return new Response(JSON.stringify({
                ga4: ga4Result.status === 'fulfilled' ? ga4Result.value : { error: ga4Result.reason?.message },
                gsc: gscResult.status === 'fulfilled' ? gscResult.value : { error: gscResult.reason?.message },
                dateRange: { startDate, endDate }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } else if (type === 'debug') {
            // Debug: show service account email and try a simple GA4 + GSC call
            const accessToken = await getAccessToken(sa, 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly');
            
            const [ga4Test, gscTest] = await Promise.all([
                fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dateRanges: [{ startDate: getDateStr(-7), endDate: getDateStr(-1) }],
                        metrics: [{ name: 'activeUsers' }]
                    })
                }).then(r => r.json()),
                fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        startDate: getDateStr(-7), endDate: getDateStr(-1),
                        dimensions: ['query'], rowLimit: 3
                    })
                }).then(r => r.json())
            ]);

            return new Response(JSON.stringify({
                serviceAccount: sa.client_email,
                ga4PropertyId: GA4_PROPERTY_ID,
                gscSiteUrl: GSC_SITE_URL,
                ga4RawResponse: ga4Test,
                gscRawResponse: gscTest
            }, null, 2), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } else {
            throw new Error('Invalid type. Use "ga4", "gsc", or "both".');
        }

    } catch (err) {
        console.error('[analytics] Error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

function getDateStr(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
}

// ══════════════════════════════════════════
// ── GA4 Data API v1beta ──
// ══════════════════════════════════════════
async function fetchGA4Data(sa: any, startDate: string, endDate: string) {
    const accessToken = await getAccessToken(sa, 'https://www.googleapis.com/auth/analytics.readonly');

    // Run multiple reports in parallel
    const [overviewRes, pagesRes, dailyRes, sourceRes] = await Promise.all([
        // 1. Overview metrics
        fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dateRanges: [{ startDate, endDate }],
                metrics: [
                    { name: 'activeUsers' },
                    { name: 'sessions' },
                    { name: 'screenPageViews' },
                    { name: 'bounceRate' },
                    { name: 'averageSessionDuration' },
                    { name: 'newUsers' }
                ]
            })
        }),
        // 2. Top pages
        fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
                metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
                orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
                limit: 15
            })
        }),
        // 3. Daily trend
        fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'date' }],
                metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
                orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }]
            })
        }),
        // 4. Traffic sources
        fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'sessionDefaultChannelGroup' }],
                metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                limit: 10
            })
        })
    ]);

    const [overview, pages, daily, sources] = await Promise.all([
        overviewRes.json(), pagesRes.json(), dailyRes.json(), sourceRes.json()
    ]);

    // Parse overview
    const overviewRow = overview.rows?.[0]?.metricValues || [];
    const overviewData = {
        activeUsers: parseInt(overviewRow[0]?.value || '0'),
        sessions: parseInt(overviewRow[1]?.value || '0'),
        pageViews: parseInt(overviewRow[2]?.value || '0'),
        bounceRate: parseFloat(overviewRow[3]?.value || '0'),
        avgSessionDuration: parseFloat(overviewRow[4]?.value || '0'),
        newUsers: parseInt(overviewRow[5]?.value || '0')
    };

    // Parse top pages
    const topPages = (pages.rows || []).map((r: any) => ({
        path: r.dimensionValues[0].value,
        title: r.dimensionValues[1].value,
        views: parseInt(r.metricValues[0].value),
        users: parseInt(r.metricValues[1].value)
    }));

    // Parse daily trend
    const dailyTrend = (daily.rows || []).map((r: any) => ({
        date: r.dimensionValues[0].value,
        users: parseInt(r.metricValues[0].value),
        sessions: parseInt(r.metricValues[1].value),
        pageViews: parseInt(r.metricValues[2].value)
    }));

    // Parse sources
    const trafficSources = (sources.rows || []).map((r: any) => ({
        channel: r.dimensionValues[0].value,
        sessions: parseInt(r.metricValues[0].value),
        users: parseInt(r.metricValues[1].value)
    }));

    return { overview: overviewData, topPages, dailyTrend, trafficSources };
}

async function handleGA4(sa: any, startDate: string, endDate: string) {
    const data = await fetchGA4Data(sa, startDate, endDate);
    return new Response(JSON.stringify({ ga4: data, dateRange: { startDate, endDate } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

// ══════════════════════════════════════════
// ── Google Search Console API ──
// ══════════════════════════════════════════
async function fetchGSCData(sa: any, startDate: string, endDate: string) {
    const accessToken = await getAccessToken(sa, 'https://www.googleapis.com/auth/webmasters.readonly');

    const [queryRes, pageRes] = await Promise.all([
        // 1. Top queries
        fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startDate, endDate,
                dimensions: ['query'],
                rowLimit: 20
            })
        }),
        // 2. Top pages
        fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startDate, endDate,
                dimensions: ['page'],
                rowLimit: 15
            })
        })
    ]);

    const [queryData, pageData] = await Promise.all([queryRes.json(), pageRes.json()]);

    // Check for errors
    if (queryData.error) {
        throw new Error(`GSC query error: ${queryData.error.message}`);
    }

    const topQueries = (queryData.rows || []).map((r: any) => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position
    }));

    const topPages = (pageData.rows || []).map((r: any) => ({
        page: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position
    }));

    // Compute totals
    const totals = topQueries.reduce((acc: any, q: any) => ({
        clicks: acc.clicks + q.clicks,
        impressions: acc.impressions + q.impressions
    }), { clicks: 0, impressions: 0 });
    totals.ctr = totals.impressions ? totals.clicks / totals.impressions : 0;

    return { totals, topQueries, topPages };
}

async function handleGSC(sa: any, startDate: string, endDate: string) {
    const data = await fetchGSCData(sa, startDate, endDate);
    return new Response(JSON.stringify({ gsc: data, dateRange: { startDate, endDate } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
