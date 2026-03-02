// AI Proxy Edge Function for Supabase
// 透過 Zeabur AI Hub 使用 Claude API
//
// Zeabur AI Hub endpoint: https://hnd1.aihub.zeabur.ai/
// 使用 Anthropic Messages API 格式

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const ZEABUR_BASE_URL = 'https://hnd1.aihub.zeabur.ai';
const ZEABUR_API_KEY = 'sk-CYwvqJAEhySFAYcksFAi0Q';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const { model, messages, temperature, max_tokens } = await req.json();

        // Anthropic 格式：system 要從 messages 拆出來
        let system = '';
        const claudeMessages = [];
        for (const msg of messages) {
            if (msg.role === 'system') {
                system += (system ? '\n' : '') + msg.content;
            } else {
                claudeMessages.push({ role: msg.role, content: msg.content });
            }
        }

        const res = await fetch(`${ZEABUR_BASE_URL}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': ZEABUR_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || 'claude-sonnet-4-5',
                messages: claudeMessages,
                ...(system ? { system } : {}),
                temperature: temperature ?? 0.7,
                max_tokens: max_tokens ?? 4096,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return new Response(
                JSON.stringify({ error: data.error?.message || `Zeabur Claude API error: ${res.status}` }),
                { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const text = data.content?.[0]?.text || '';
        return new Response(
            JSON.stringify({ text, content: text }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
