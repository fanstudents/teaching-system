// AI Proxy Edge Function for Supabase
// 支援 OpenAI 和 Anthropic Claude API
//
// 環境變數:
//   OPENAI_API_KEY   — OpenAI key（model 帶 gpt / o1 / o3 時用）
//   ANTHROPIC_API_KEY — Claude key（model 帶 claude 時用）

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

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
        const modelName = (model || 'gpt-4o-mini').toLowerCase();

        // ── Route: Claude ──
        if (modelName.includes('claude')) {
            const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
            if (!ANTHROPIC_API_KEY) {
                return new Response(
                    JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

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

            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model || 'claude-sonnet-4-20250514',
                    messages: claudeMessages,
                    ...(system ? { system } : {}),
                    temperature: temperature ?? 0.7,
                    max_tokens: max_tokens ?? 2000,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                return new Response(
                    JSON.stringify({ error: data.error?.message || 'Anthropic API error' }),
                    { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const text = data.content?.[0]?.text || '';
            return new Response(
                JSON.stringify({ text, content: text }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ── Route: OpenAI (default) ──
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (!OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || 'gpt-4o-mini',
                messages,
                temperature: temperature ?? 0.7,
                max_tokens: max_tokens ?? 2000,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return new Response(
                JSON.stringify({ error: data.error?.message || 'OpenAI API error' }),
                { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const text = data.choices?.[0]?.message?.content || '';
        return new Response(
            JSON.stringify({ text, content: text, choices: data.choices, usage: data.usage }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
