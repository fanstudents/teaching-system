// AI Proxy Edge Function for Supabase
// 優先使用 OpenAI API，fallback 到 Zeabur AI Hub

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const ZEABUR_BASE_URL = 'https://hnd1.aihub.zeabur.ai';
const ZEABUR_API_KEY = 'sk-CYwvqJAEhySFAYcksFAi0Q';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OpenAI model 映射
const MODEL_MAP: Record<string, string> = {
    'claude-sonnet-4-5': 'gpt-4o',
    'claude-haiku-4-5': 'gpt-4o-mini',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const { model, messages, temperature, max_tokens } = await req.json();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 150000);

        let res;
        let rawText: string;

        try {
            if (OPENAI_API_KEY) {
                // ★ 使用 OpenAI API
                const openaiModel = MODEL_MAP[model] || model || 'gpt-4o';
                console.log(`[ai-proxy] Using OpenAI: ${openaiModel}`);

                res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: openaiModel,
                        messages,
                        temperature: temperature ?? 0.7,
                        max_tokens: max_tokens ?? 4096,
                    }),
                    signal: controller.signal,
                });

                rawText = await res.text();

                if (!res.ok) {
                    let errorMsg = `OpenAI API error: ${res.status}`;
                    try {
                        const errData = JSON.parse(rawText);
                        errorMsg = errData.error?.message || errorMsg;
                    } catch { errorMsg += ` — ${rawText.substring(0, 200)}`; }
                    return new Response(
                        JSON.stringify({ error: errorMsg }),
                        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                let data;
                try { data = JSON.parse(rawText); } catch {
                    return new Response(
                        JSON.stringify({ error: `OpenAI returned invalid JSON: ${rawText.substring(0, 200)}` }),
                        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                const text = data.choices?.[0]?.message?.content || '';
                return new Response(
                    JSON.stringify({ text, content: text }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );

            } else {
                // Fallback: Zeabur AI Hub (Anthropic 格式)
                console.log('[ai-proxy] Fallback to Zeabur AI Hub');
                let system = '';
                const claudeMessages: { role: string; content: string }[] = [];
                for (const msg of messages) {
                    if (msg.role === 'system') {
                        system += (system ? '\n' : '') + msg.content;
                    } else {
                        claudeMessages.push({ role: msg.role, content: msg.content });
                    }
                }

                res = await fetch(`${ZEABUR_BASE_URL}/v1/messages`, {
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
                        max_tokens: max_tokens ?? 16000,
                    }),
                    signal: controller.signal,
                });

                rawText = await res.text();

                if (!res.ok) {
                    let errorMsg = `Zeabur API error: ${res.status}`;
                    try {
                        const errData = JSON.parse(rawText);
                        errorMsg = errData.error?.message || errData.message || errorMsg;
                    } catch { errorMsg += ` — ${rawText.substring(0, 200)}`; }
                    return new Response(
                        JSON.stringify({ error: errorMsg }),
                        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                let data;
                try { data = JSON.parse(rawText); } catch {
                    return new Response(
                        JSON.stringify({ error: `Zeabur returned invalid JSON: ${rawText.substring(0, 200)}` }),
                        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                const text = data.content?.[0]?.text || '';
                return new Response(
                    JSON.stringify({ text, content: text }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        } finally {
            clearTimeout(timeout);
        }

    } catch (error) {
        const errMsg = (error as Error).name === 'AbortError'
            ? 'AI API 請求超時（150 秒），請減少內容後重試'
            : (error as Error).message;
        return new Response(
            JSON.stringify({ error: errMsg }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
