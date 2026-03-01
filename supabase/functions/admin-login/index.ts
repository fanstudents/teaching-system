import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, authorization, apikey',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const { username, password } = await req.json();

        const ADMIN_USERNAME = Deno.env.get('ADMIN_USERNAME') || 'admin';
        const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') || 'ai2025';
        const TOKEN_SECRET = Deno.env.get('ADMIN_TOKEN_SECRET') || 'supabase-admin-secret-key-2025';

        if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
            return new Response(JSON.stringify({ error: '帳號或密碼錯誤' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const timestamp = Date.now();
        const payload = `${username}:${timestamp}`;

        const encoder = new TextEncoder();
        const keyData = encoder.encode(TOKEN_SECRET);
        const key = await crypto.subtle.importKey(
            'raw', keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false, ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
        const signatureHex = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const token = btoa(JSON.stringify({
            user: username,
            ts: timestamp,
            sig: signatureHex,
        }));

        return new Response(JSON.stringify({
            success: true,
            token,
            message: '登入成功',
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: '伺服器錯誤' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
