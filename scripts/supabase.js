/**
 * Supabase Client — 共用 singleton
 * 透過 Supabase REST API 提供 DB / Auth / Storage / Realtime / AI / Functions
 *
 * Supabase 底層也是 PostgREST，所以 db 模組幾乎不用改
 * Auth: 改用 Supabase Auth REST API
 * Storage: 改用 Supabase Storage API
 * Realtime: 改用 Supabase Realtime (Phoenix channels)
 * AI: 改用 Supabase Edge Function proxy
 */

const SUPABASE_URL = 'https://wsaknnhjgiqmkendeyrj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzYWtubmhqZ2lxbWtlbmRleXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTI4MTIsImV4cCI6MjA4NzY4ODgxMn0.1j-4D9Kw0vqhVcTWgU7ABTJ_mO6aN4IB72Ojof8Yfko';

// 動態 headers：如果有 access token 就用 authenticated 身份
function _isJwtExpired(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp && payload.exp * 1000 < Date.now();
    } catch { return true; }
}

function getHeaders() {
    let token = localStorage.getItem('_at') || sessionStorage.getItem('_at');
    // 過期的 token 清掉，fallback 到 anon key
    if (token && _isJwtExpired(token)) {
        localStorage.removeItem('_at');
        sessionStorage.removeItem('_at');
        token = null;
    }
    token = token || SUPABASE_ANON_KEY;
    return {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// ── Database (PostgREST — Supabase 底層相同) ──

export const db = {
    // ★ 暴露給 slideManager beforeunload keepalive fetch 使用
    _baseUrl: SUPABASE_URL,
    _anonKey: SUPABASE_ANON_KEY,
    /**
 * INSERT — body 必須是 array
 * @param {string} table
 * @param {object|object[]} records
 * @param {object} [opts] — { onConflict: 'col1,col2' } 啟用 UPSERT
 * @returns {Promise<{data, error}>}
 */
    async insert(table, records, opts = {}) {
        const body = Array.isArray(records) ? records : [records];
        let url = `${SUPABASE_URL}/rest/v1/${table}`;
        const prefer = ['return=representation'];
        if (opts.onConflict) {
            url += `?on_conflict=${opts.onConflict}`;
            prefer.push('resolution=merge-duplicates');
        }
        const res = await fetch(url, {
            method: 'POST',
            headers: { ...getHeaders(), 'Prefer': prefer.join(',') },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);
        return { data: res.ok ? data : null, error: res.ok ? null : data };
    },

    /**
     * SELECT — 支援 PostgREST filter query string
     * @param {string} table
     * @param {object} opts — { filter, select, order, limit, offset }
     */
    async select(table, opts = {}) {
        const params = new URLSearchParams();
        if (opts.select) params.set('select', opts.select);
        if (opts.order) params.set('order', opts.order);
        params.set('limit', opts.limit || 1000); // 預設上限 1000，避免無限制拉取
        if (opts.offset) params.set('offset', opts.offset);
        // PostgREST filters: { session_id: 'eq.ABC123' }
        if (opts.filter) {
            for (const [col, val] of Object.entries(opts.filter)) {
                params.set(col, val);
            }
        }
        const qs = params.toString();
        const url = `${SUPABASE_URL}/rest/v1/${table}${qs ? '?' + qs : ''}`;
        const res = await fetch(url, { headers: getHeaders() });
        const data = await res.json().catch(() => null);
        return { data: res.ok ? data : null, error: res.ok ? null : data };
    },

    /**
     * UPDATE — PATCH with PostgREST filters
     * 用法: db.update('sessions', { current_slide: '3' }, { session_code: 'eq.ABC123' })
     */
    async update(table, values, filter = {}) {
        const params = new URLSearchParams();
        for (const [col, val] of Object.entries(filter)) {
            params.set(col, val);
        }
        const qs = params.toString();
        const url = `${SUPABASE_URL}/rest/v1/${table}${qs ? '?' + qs : ''}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { ...getHeaders(), 'Prefer': 'return=representation' },
            body: JSON.stringify(values)
        });
        const data = await res.json().catch(() => null);
        return { data: res.ok ? data : null, error: res.ok ? null : data };
    },

    /**
     * DELETE
     */
    async delete(table, filter = {}) {
        const params = new URLSearchParams();
        for (const [col, val] of Object.entries(filter)) {
            params.set(col, val);
        }
        const qs = params.toString();
        const url = `${SUPABASE_URL}/rest/v1/${table}${qs ? '?' + qs : ''}`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const data = await res.json().catch(() => null);
        return { data: res.ok ? data : null, error: res.ok ? null : data };
    },

    /**
     * RPC — 呼叫 Postgres function
     * @param {string} fnName - function 名稱
     * @param {object} params - 參數
     */
    async rpc(fnName, params = {}) {
        const url = `${SUPABASE_URL}/rest/v1/rpc/${fnName}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { ...getHeaders(), 'Prefer': 'return=representation' },
            body: JSON.stringify(params)
        });
        const data = await res.json().catch(() => null);
        return { data: res.ok ? data : null, error: res.ok ? null : data };
    }
};

// ── Auth (Supabase GoTrue) ──

export const auth = (() => {
    let _accessToken = localStorage.getItem('_at') || sessionStorage.getItem('_at') || null;
    let _refreshToken = localStorage.getItem('_rt') || sessionStorage.getItem('_rt') || null;
    let _user = null;

    function _save(accessToken, refreshToken) {
        _accessToken = accessToken;
        _refreshToken = refreshToken;
        if (accessToken) { sessionStorage.setItem('_at', accessToken); localStorage.setItem('_at', accessToken); }
        else { sessionStorage.removeItem('_at'); localStorage.removeItem('_at'); }
        if (refreshToken) { sessionStorage.setItem('_rt', refreshToken); localStorage.setItem('_rt', refreshToken); }
        else { sessionStorage.removeItem('_rt'); localStorage.removeItem('_rt'); }
    }

    return {
        /** Sign in with email + password */
        async signIn(email, password) {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) return { data: null, error: data };
            _save(data.access_token, data.refresh_token);
            _user = data.user;
            return { data: { accessToken: data.access_token, user: data.user }, error: null };
        },

        /** Try to refresh session using refresh token */
        async refresh() {
            if (!_refreshToken) return { data: null, error: 'no refresh token' };
            const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: _refreshToken })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                _save(null, null);
                _user = null;
                return { data: null, error: data };
            }
            _save(data.access_token, data.refresh_token);
            _user = data.user;
            return { data: { accessToken: data.access_token, user: data.user }, error: null };
        },

        /** Get current session — tries accessToken first, then refresh */
        async getSession() {
            // Try existing token
            if (_accessToken) {
                const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${_accessToken}`
                    }
                });
                if (res.ok) {
                    const user = await res.json();
                    _user = user;
                    return { user, accessToken: _accessToken };
                }
            }
            // Try refresh
            const { data } = await auth.refresh();
            if (data) return { user: data.user || _user, accessToken: data.accessToken };
            return null;
        },

        /** Sign out */
        async signOut() {
            if (_accessToken) {
                await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${_accessToken}`
                    }
                }).catch(() => { });
            }
            _save(null, null);
            _user = null;
        },

        /** Sign in with Google OAuth — redirects to Google consent */
        signInWithGoogle(redirectTo) {
            const redirect = redirectTo || location.href;
            const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`;
            location.href = url;
        },

        /** Handle OAuth callback — extracts tokens from URL hash after redirect */
        async handleOAuthCallback() {
            const hash = location.hash.substring(1);
            if (!hash) return null;
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            if (!accessToken) return null;
            _save(accessToken, refreshToken);
            // Fetch user info
            const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            if (res.ok) {
                _user = await res.json();
                // Clean up URL hash
                history.replaceState(null, '', location.pathname + location.search);
                return { user: _user, accessToken };
            }
            return null;
        },

        get user() { return _user; },
        get accessToken() { return _accessToken; }
    };
})();

// ── Storage (Supabase Storage API) ──

export const storage = {
    /**
     * Upload file to Supabase Storage
     * @param {string} bucket
     * @param {string} objectKey — e.g. 'hero-images/photo.jpg'
     * @param {File|Blob} file
     */
    async upload(bucket, objectKey, file) {
        // Always use anon key for public bucket uploads (avoids expired JWT issues)
        const token = SUPABASE_ANON_KEY;

        const res = await fetch(
            `${SUPABASE_URL}/storage/v1/object/${bucket}/${objectKey}`,
            {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': file.type || 'application/octet-stream',
                    'x-upsert': 'true'
                },
                body: file
            }
        );
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            console.error('Storage upload error:', data);
            return { data: null, error: data || { message: `Upload failed: ${res.status}` } };
        }
        // Build public URL
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectKey}`;
        return { data: { ...data, url: publicUrl }, error: null };
    },

    /**
     * 取得公開 URL
     */
    getPublicUrl(bucket, key) {
        return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`;
    }
};

// ── Realtime (Supabase Realtime — Phoenix channels over WebSocket) ──

class RealtimeClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this._listeners = new Map();
        this._subscribedChannels = new Map(); // channel name → ref
        this._heartbeatRef = null;
        this._ref = 0;
        this._pendingReplies = new Map();
        // ★ 指數退避重連
        this._reconnectAttempt = 0;
        this._maxReconnectDelay = 30000;
        // ★ 發布重試佇列
        this._publishQueue = [];
        // ★ 連線狀態回調
        this._statusCallbacks = [];
        this._status = 'disconnected'; // 'connected' | 'reconnecting' | 'disconnected'
    }

    _nextRef() {
        return String(++this._ref);
    }

    async connect() {
        if (this.isConnected) return;

        return new Promise((resolve, reject) => {
            const wsUrl = SUPABASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
            this.ws = new WebSocket(
                `${wsUrl}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`
            );

            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 10000);

            this.ws.onopen = () => {
                clearTimeout(timeout);
                this.isConnected = true;
                this._reconnectAttempt = 0; // ★ 重置退避計數器
                this._setStatus('connected');
                console.log('[Realtime] connected');

                // Heartbeat
                this._heartbeatRef = setInterval(() => {
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({
                            topic: 'phoenix',
                            event: 'heartbeat',
                            payload: {},
                            ref: this._nextRef()
                        }));
                    }
                }, 30000);

                // Re-subscribe channels
                for (const [ch] of this._subscribedChannels) {
                    this._joinChannel(ch);
                }

                // ★ Flush 重連佇列（丟棄超過 10 秒的舊訊息，避免發送過時資料）
                const now = Date.now();
                const queued = this._publishQueue.splice(0).filter(m => now - m._ts < 10000);
                if (queued.length > 0) {
                    console.log(`[Realtime] flushing ${queued.length} queued messages`);
                    for (const msg of queued) {
                        this.publish(msg.channel, msg.event, msg.payload);
                    }
                }

                resolve();
            };

            this.ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                const { topic, event: evt, payload } = msg;

                // 轉發給監聽者
                const key = `${topic}:${evt}`;
                if (this._listeners.has(key)) {
                    for (const cb of this._listeners.get(key)) {
                        cb(payload);
                    }
                }

                // 也觸發 event-only listeners (向後相容)
                if (this._listeners.has(evt)) {
                    for (const cb of this._listeners.get(evt)) {
                        cb(payload);
                    }
                }

                // ── 解包 Supabase Realtime broadcast 事件 ──
                // Supabase 的 broadcast 訊息格式：
                //   { topic, event: "broadcast", payload: { type: "broadcast", event: "slide_change", payload: {...} } }
                // 需要把內層 event name 取出來，才能觸發 realtime.on('slide_change', ...) 等 listener
                if (evt === 'broadcast' && payload && payload.event) {
                    const innerEvent = payload.event;
                    const innerPayload = payload.payload || payload;

                    if (this._listeners.has(innerEvent)) {
                        for (const cb of this._listeners.get(innerEvent)) {
                            cb(innerPayload);
                        }
                    }
                }
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                clearInterval(this._heartbeatRef);
                this._setStatus('reconnecting');

                // ★ 指數退避重連 (1s → 2s → 4s → ... → max 30s) + 隨機 jitter
                const delay = Math.min(
                    1000 * Math.pow(2, this._reconnectAttempt) + Math.random() * 1000,
                    this._maxReconnectDelay
                );
                this._reconnectAttempt++;
                console.log(`[Realtime] disconnected, reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this._reconnectAttempt})`);
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.connect().catch(console.error);
                    }
                }, delay);
            };

            this.ws.onerror = (err) => {
                clearTimeout(timeout);
                console.error('[Realtime] error:', err);
                reject(err);
            };
        });
    }

    _joinChannel(channel) {
        const ref = this._nextRef();
        this._subscribedChannels.set(channel, ref);
        this.ws.send(JSON.stringify({
            topic: `realtime:${channel}`,
            event: 'phx_join',
            payload: {
                config: {
                    // self: false — 不會收到自己 publish 的訊息，講師端用本地呼叫處理自己的狀態
                    broadcast: { self: false, ack: false },
                    presence: { key: '' }
                }
            },
            ref
        }));
    }

    subscribe(channel) {
        return new Promise((resolve) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                resolve({ ok: false, channel, error: 'Not connected' });
                return;
            }
            const ref = this._nextRef();
            this._subscribedChannels.set(channel, ref);

            // 等待 phx_reply 確認加入成功
            const topic = `realtime:${channel}`;
            const timer = setTimeout(() => {
                console.warn(`[Realtime] join timeout for ${channel}, assuming ok`);
                resolve({ ok: true, channel });
            }, 3000);

            const origOnMessage = this.ws.onmessage;
            const handler = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.topic === topic && msg.event === 'phx_reply' && msg.ref === ref) {
                    clearTimeout(timer);
                    this.ws.onmessage = origOnMessage;
                    // 先讓原 handler 處理這則訊息
                    origOnMessage.call(this.ws, event);
                    console.log(`[Realtime] subscribed to: ${channel} (confirmed)`);
                    resolve({ ok: true, channel });
                    return;
                }
                origOnMessage.call(this.ws, event);
            };
            this.ws.onmessage = handler;

            this.ws.send(JSON.stringify({
                topic,
                event: 'phx_join',
                payload: {
                    config: {
                        broadcast: { self: false, ack: false },
                        presence: { key: '' }
                    }
                },
                ref
            }));
        });
    }

    unsubscribe(channel) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                topic: `realtime:${channel}`,
                event: 'phx_leave',
                payload: {},
                ref: this._nextRef()
            }));
        }
        this._subscribedChannels.delete(channel);
        for (const key of [...this._listeners.keys()]) {
            if (key.startsWith(`realtime:${channel}:`)) {
                this._listeners.delete(key);
            }
        }
    }

    /**
     * 發布訊息到 channel (broadcast)
     * Supabase realtime broadcast
     */
    publish(channel, event, payload) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            // ★ 佇列訊息，重連後自動補發（最多保留 50 條）
            if (this._publishQueue.length < 50) {
                this._publishQueue.push({ channel, event, payload, _ts: Date.now() });
                console.warn(`[Realtime] not connected, queued (${this._publishQueue.length} pending)`);
            }
            return;
        }
        this.ws.send(JSON.stringify({
            topic: `realtime:${channel}`,
            event: 'broadcast',
            payload: {
                type: 'broadcast',
                event,
                payload
            },
            ref: this._nextRef()
        }));
    }

    /**
     * 監聽 channel 上的 event
     */
    on(event, callback) {
        if (!this._listeners.has(event)) this._listeners.set(event, []);
        this._listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this._listeners.has(event)) {
            const arr = this._listeners.get(event).filter(fn => fn !== callback);
            if (arr.length) this._listeners.set(event, arr);
            else this._listeners.delete(event);
        }
    }

    disconnect() {
        clearInterval(this._heartbeatRef);
        this._reconnectAttempt = 999; // 阻止自動重連
        this.ws?.close();
        this.isConnected = false;
        this._setStatus('disconnected');
    }

    // ★ 連線狀態管理
    _setStatus(status) {
        if (this._status === status) return;
        this._status = status;
        for (const cb of this._statusCallbacks) {
            try { cb(status); } catch (e) { console.warn('[Realtime] status callback error:', e); }
        }
    }

    get status() { return this._status; }

    onStatusChange(callback) {
        this._statusCallbacks.push(callback);
        // 立即通知目前狀態
        callback(this._status);
        return () => {
            this._statusCallbacks = this._statusCallbacks.filter(cb => cb !== callback);
        };
    }
}

export const realtime = new RealtimeClient();

// ── 工具 ──

export function generateSessionCode(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ── AI (支援 Direct API / Supabase proxy) ──
// 設定方式：ai.setProvider('openai', 'sk-...') 或 ai.setProvider('anthropic', 'sk-ant-...')
// 或在 localStorage 設定 _ai_provider / _ai_api_key
// 未設定時 fallback 到 Supabase Edge Function proxy

const _aiConfig = {
    provider: localStorage.getItem('_ai_provider') || '', // 'openai' | 'anthropic' | '' (supabase)
    apiKey: localStorage.getItem('_ai_api_key') || '',
    baseUrl: localStorage.getItem('_ai_base_url') || '', // 自訂 endpoint（如 Zeabur AI Hub）
};

// Model 映射：把通用名稱轉成各 provider 的真實 model name
function _resolveModel(model, provider) {
    const map = {
        openai: {
            'claude-haiku-4-5': 'gpt-4o-mini',
            'claude-sonnet-4-5': 'gpt-4o',
            'gpt-4o-mini': 'gpt-4o-mini',
            'gpt-4o': 'gpt-4o',
        },
        anthropic: {
            'claude-haiku-4-5': 'claude-haiku-4-5-20250315',
            'claude-sonnet-4-5': 'claude-sonnet-4-5-20250514',
            'gpt-4o-mini': 'claude-haiku-4-5-20250315',
            'gpt-4o': 'claude-sonnet-4-5-20250514',
        }
    };
    return map[provider]?.[model] || model;
}

async function _chatOpenAI(messages, opts) {
    const model = _resolveModel(opts.model || 'gpt-4o-mini', 'openai');
    const baseUrl = _aiConfig.baseUrl || 'https://api.openai.com';
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${_aiConfig.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            messages,
            temperature: opts.temperature ?? 0.7,
            max_tokens: opts.maxTokens ?? 4096,
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `OpenAI error: ${res.status}`);
    return data.choices?.[0]?.message?.content || '';
}

async function _chatAnthropic(messages, opts) {
    const model = _resolveModel(opts.model || 'claude-haiku-4-5', 'anthropic');
    // Anthropic 格式：system 從 messages 抽出來
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': _aiConfig.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            system: systemMsg?.content || '',
            messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
            temperature: opts.temperature ?? 0.7,
            max_tokens: opts.maxTokens ?? 4096,
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Anthropic error: ${res.status}`);
    return data.content?.[0]?.text || '';
}

async function _chatSupabase(messages, opts) {
    const maxRetries = 3;
    const body = JSON.stringify({
        model: opts.model || 'claude-sonnet-4-5',
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 4096,
    });
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body
        });
        if (res.status === 429 && attempt < maxRetries - 1) {
            const wait = Math.pow(2, attempt + 1) * 1000;
            console.warn(`[AI] 429 rate limit, retrying in ${wait / 1000}s... (${attempt + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, wait));
            continue;
        }
        const rawText = await res.text();
        console.log(`[AI] Response status: ${res.status}, body preview: ${rawText.substring(0, 200)}`);
        let json;
        try {
            json = JSON.parse(rawText);
        } catch (parseErr) {
            throw new Error(`AI API 回傳非 JSON（HTTP ${res.status}）: ${rawText.substring(0, 100)}`);
        }
        if (!res.ok) throw new Error(json.error || `AI API error: ${res.status}`);
        if (json.error) throw new Error(json.error);
        return json.text || json.content || json.choices?.[0]?.message?.content || '';
    }
}

export const ai = {
    async chat(messages, opts = {}) {
        const provider = _aiConfig.provider;
        if (provider === 'openai' && _aiConfig.apiKey) {
            console.log('[AI] Using OpenAI direct API');
            return _chatOpenAI(messages, opts);
        } else if (provider === 'anthropic' && _aiConfig.apiKey) {
            console.log('[AI] Using Anthropic direct API');
            return _chatAnthropic(messages, opts);
        } else {
            console.log('[AI] Using Supabase proxy');
            return _chatSupabase(messages, opts);
        }
    },

    /** 設定 AI provider，會存到 localStorage
     *  provider: 'openai' | 'anthropic' | '' (supabase)
     *  apiKey: API key
     *  baseUrl: 自訂 endpoint（如 Zeabur AI Hub: https://hub.zeabur.com）
     */
    setProvider(provider, apiKey, baseUrl) {
        _aiConfig.provider = provider;
        _aiConfig.apiKey = apiKey || '';
        _aiConfig.baseUrl = baseUrl || '';
        localStorage.setItem('_ai_provider', provider);
        localStorage.setItem('_ai_api_key', apiKey || '');
        localStorage.setItem('_ai_base_url', baseUrl || '');
        console.log(`[AI] Provider set to: ${provider || 'supabase'}${baseUrl ? ` (${baseUrl})` : ''}`);
    },

    /** 取得目前設定 */
    getProvider() {
        return { provider: _aiConfig.provider || 'supabase', hasKey: !!_aiConfig.apiKey };
    }
};

// ── Edge Functions (Supabase Functions) ──

export const functions = {
    async invoke(slug, { body = {}, headers = {}, method = 'POST' } = {}) {
        // 確保 token 是最新的（自動 refresh）
        const session = await auth.getSession();
        const token = session?.accessToken || SUPABASE_ANON_KEY;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
            method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...headers
            },
            body: method !== 'GET' ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: { message: data?.message || `Function error: ${res.status}`, status: res.status } };
        return { data, error: null };
    }
};

// ── User Profile Helper ──

let _cachedProfile = null;

export async function getUserProfile() {
    if (_cachedProfile) return _cachedProfile;
    const session = await auth.getSession();
    if (!session) return null;
    const { data } = await db.select('user_profiles', {
        filter: { id: `eq.${session.user.id}` },
        limit: 1
    });
    _cachedProfile = data?.[0] || null;
    return _cachedProfile;
}

export function clearProfileCache() {
    _cachedProfile = null;
}

// ── Auth Guard ──

export async function requireAuth(allowedRoles = null) {
    const session = await auth.getSession();
    if (!session) {
        location.href = `login.html?redirect=${encodeURIComponent(location.pathname + location.search)}`;
        return null;
    }
    if (allowedRoles) {
        const profile = await getUserProfile();
        if (!profile || !allowedRoles.includes(profile.role)) {
            location.href = 'login.html';
            return null;
        }
        return { session, profile };
    }
    return { session, profile: await getUserProfile() };
}

// ── Export all ──

export const supabase = { db, auth, storage, realtime, ai, functions, generateSessionCode, getUserProfile, requireAuth, clearProfileCache };
export default supabase;
