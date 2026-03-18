import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
        // 驗證呼叫者是 super_admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: '未授權' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

        // 用呼叫者的 token 驗證身份
        const callerToken = authHeader.replace('Bearer ', '');
        const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${callerToken}` } },
        });

        const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
        if (callerError || !caller) {
            return new Response(JSON.stringify({ error: '無效的 token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 檢查是否為 super_admin
        const { data: profile } = await callerClient
            .from('user_profiles')
            .select('role')
            .eq('id', caller.id)
            .single();

        if (!profile || profile.role !== 'super_admin') {
            return new Response(JSON.stringify({ error: '權限不足，只有管理者可以建立講師' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 解析請求
        const { email, display_name, password } = await req.json();

        if (!email) {
            return new Response(JSON.stringify({ error: '請提供 email' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 用 service_role key 建立用戶
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 建立 Auth 用戶
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password: password || generatePassword(),
            email_confirm: true,  // 自動確認 email
            user_metadata: { name: display_name || '' },
        });

        if (createError) {
            // 如果用戶已存在，嘗試取得並只建立 profile
            if (createError.message?.includes('already been registered')) {
                const { data: existingUsers } = await adminClient.auth.admin.listUsers();
                const existing = existingUsers?.users?.find((u: any) => u.email === email);
                if (existing) {
                    // 只建立 profile
                    const { error: profileError } = await adminClient
                        .from('user_profiles')
                        .upsert({
                            id: existing.id,
                            email,
                            display_name: display_name || '',
                            role: 'instructor',
                        }, { onConflict: 'id' });

                    if (profileError) {
                        return new Response(JSON.stringify({ error: `建立 profile 失敗: ${profileError.message}` }), {
                            status: 500,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        });
                    }

                    return new Response(JSON.stringify({
                        success: true,
                        message: '用戶已存在，已建立講師 profile',
                        user_id: existing.id,
                    }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }
            }

            return new Response(JSON.stringify({ error: `建立用戶失敗: ${createError.message}` }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 建立 user_profiles
        const { error: profileError } = await adminClient
            .from('user_profiles')
            .insert({
                id: newUser.user.id,
                email,
                display_name: display_name || '',
                role: 'instructor',
            });

        if (profileError) {
            return new Response(JSON.stringify({ error: `建立 profile 失敗: ${profileError.message}` }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success: true,
            message: '講師帳號已建立',
            user_id: newUser.user.id,
            email,
            temp_password: password || '(已使用隨機密碼)',
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: `伺服器錯誤: ${error.message}` }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

function generatePassword(length = 12) {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
