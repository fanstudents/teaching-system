// AI Proxy Edge Function for Supabase
// 透過 Zeabur AI Hub 使用 Claude API（Anthropic Messages 格式）

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

        // ★ 加上 AbortController timeout (150 秒)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 150000);

        let res;
        try {
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
        } finally {
            clearTimeout(timeout);
        }

        // ★ 先讀 text，避免 res.json() 直接爆掉
        const rawText = await res.text();

        if (!res.ok) {
            // 嘗試 parse JSON 錯誤訊息
            let errorMsg = `Zeabur API error: ${res.status}`;
            try {
                const errData = JSON.parse(rawText);
                errorMsg = errData.error?.message || errData.message || errorMsg;
            } catch {
                // rawText 是 HTML 或其他非 JSON
                errorMsg = `Zeabur API returned non-JSON (HTTP ${res.status}): ${rawText.substring(0, 200)}`;
            }
            return new Response(
                JSON.stringify({ error: errorMsg }),
                { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ★ 安全 parse JSON
        let data;
        try {
            data = JSON.parse(rawText);
        } catch {
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

    } catch (error) {
        const errMsg = error.name === 'AbortError'
            ? 'AI API 請求超時（150 秒），請減少頁數後重試'
            : error.message;
        return new Response(
            JSON.stringify({ error: errMsg }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
