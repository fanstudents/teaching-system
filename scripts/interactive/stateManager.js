/**
 * 互動狀態管理器 — 統一快取 + DB 持久化
 * 各互動模組共用，負責 save / load 學員互動記錄
 */
import { db, realtime } from '../supabase.js';

class InteractionState {
    constructor() {
        /** @type {Map<string, object>} key → submission record */
        this._cache = new Map();
    }

    /** 組合快取 key */
    _key(sessionId, elementId, email) {
        return `${sessionId || ''}::${elementId}::${email || ''}`;
    }

    /** 取得當前學員 */
    getUser() {
        return JSON.parse(sessionStorage.getItem('homework_user') || 'null');
    }

    /** 取得 session code */
    getSessionCode() {
        return new URLSearchParams(location.search).get('code')
            || new URLSearchParams(location.search).get('session')
            || '';
    }

    /**
     * 從 db.select 結果中取出 rows 陣列
     */
    _unwrap(result) {
        if (!result) return [];
        if (result.data && Array.isArray(result.data)) return result.data;
        if (Array.isArray(result)) return result;
        return [];
    }

    /**
     * 儲存互動結果（記憶體 + DB upsert）
     * 首次計分制：只有第一次作答的分數會被記錄，重複作答不覆蓋分數
     * @returns {{ isRetry: boolean }} 是否為重複作答
     */
    async save(elementId, data) {
        const user = this.getUser();
        const sessionId = this.getSessionCode();
        const email = user ? (user.email || '') : 'guest';
        const k = this._key(sessionId, elementId, email);

        // 計算本次實際獲得的分數
        const maxPoints = data.points ?? 0;
        let awardedPoints = 0;
        if (maxPoints > 0) {
            if (data.isCorrect === true) {
                awardedPoints = maxPoints;
            } else if (data.isCorrect === false) {
                awardedPoints = 0;
            } else if (data.score != null && data.score > 0) {
                awardedPoints = Math.round((parseFloat(data.score) / 100) * maxPoints);
            } else if (data.isCorrect === null && data.participated) {
                awardedPoints = maxPoints;
            }
        }

        // ── 檢查是否已有首次作答（首次計分制）──
        let isRetry = false;
        let firstAwardedPoints = awardedPoints;
        const cached = this._cache.get(k);
        if (cached) {
            isRetry = true;
            firstAwardedPoints = cached.state?._awarded ?? cached.awarded_points ?? awardedPoints;
        }

        const record = {
            session_id: sessionId || null,
            element_id: elementId,
            student_name: user ? user.name : '訪客',
            student_email: email,
            student_group: user ? user.group : '',
            assignment_title: data.title || '',
            type: data.type,
            content: data.content || '',
            is_correct: data.isCorrect ?? null,
            score: data.score != null ? String(data.score) : null,
            state: {
                ...(data.state || {}),
                _awarded: isRetry ? firstAwardedPoints : awardedPoints,
                _maxPts: maxPoints,
                _isRetry: isRetry,
                _thisAttemptAwarded: awardedPoints,
            },
            submitted_at: new Date().toISOString(),
        };

        record.awarded_points = isRetry ? firstAwardedPoints : awardedPoints;
        record.max_points = maxPoints;
        record._isRetry = isRetry;
        this._cache.set(k, record);

        if (!user) return { isRetry };

        // ★ DB upsert — 用 onConflict 取代 select→insert/update
        const MAX_RETRIES = 2;
        let saved = false;
        for (let attempt = 0; attempt <= MAX_RETRIES && !saved; attempt++) {
            try {
                if (attempt > 0) await new Promise(r => setTimeout(r, 1000));

                const { awarded_points, max_points, _isRetry, ...dbRecord } = record;
                await db.insert('submissions', dbRecord, {
                    onConflict: 'session_id,element_id,student_email'
                });
                saved = true;

                // 通知儀表板即時更新
                try {
                    if (realtime.isConnected && sessionId) {
                        realtime.publish(`session:${sessionId}`, 'submission_saved', {
                            element_id: elementId,
                            student_email: email,
                            type: data.type,
                        });
                    }
                } catch { /* ignore */ }
            } catch (e) {
                console.warn(`[stateManager] save attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, e);
                if (attempt === MAX_RETRIES) {
                    window.dispatchEvent(new CustomEvent('submission-error', {
                        detail: { elementId, type: data.type, error: e.message || '儲存失敗' }
                    }));
                }
            }
        }

        // 加分動畫（每次頁面載入的首次互動 + 有得分 + 非講師端）
        const popupKey = `${elementId}::${email}`;
        if (!this._shownPopups) this._shownPopups = new Set();
        const showPts = isRetry ? firstAwardedPoints : awardedPoints;
        if (showPts > 0 && !this._shownPopups.has(popupKey) && !document.querySelector('.presentation-slide')) {
            this._shownPopups.add(popupKey);
            this.showScorePopup(showPts);
        }

        return { isRetry };
    }

    /**
     * 顯示「首次計分」重複作答提示橫幅
     */
    showRetryBanner(container) {
        // 避免重複插入
        if (container.querySelector('.retry-score-banner')) return;
        const banner = document.createElement('div');
        banner.className = 'retry-score-banner';
        banner.innerHTML = `
            <span class="material-symbols-outlined" style="font-size:16px;">info</span>
            <span>分數以第一次作答為準，本次答題不計入排行榜。繼續加油！</span>
        `;
        container.appendChild(banner);
    }

    /**
     * 載入某元素的互動記錄
     */
    async load(elementId) {
        const user = this.getUser();
        const sessionId = this.getSessionCode();
        const email = user ? (user.email || '') : 'guest';
        const k = this._key(sessionId, elementId, email);

        // 記憶體快取命中 (訪客也會命中這裡)
        if (this._cache.has(k)) {
            return this._cache.get(k);
        }

        // 訪客沒有 DB 資料可查
        if (!user) return null;

        // 從 DB 查詢
        try {
            const raw = await db.select('submissions', {
                filter: {
                    session_id: `eq.${sessionId || ''}`,
                    element_id: `eq.${elementId}`,
                    student_email: `eq.${email}`,
                },
            });
            const rows = this._unwrap(raw);
            if (rows.length > 0) {
                const record = rows[0];
                if (typeof record.state === 'string') {
                    try { record.state = JSON.parse(record.state); } catch { record.state = {}; }
                }
                this._cache.set(k, record);
                return record;
            }
        } catch (e) {
            console.warn('[stateManager] load failed:', e);
        }
        return null;
    }

    /**
     * 清除某元素的互動記錄（重新作答用）
     */
    async clear(elementId) {
        const user = this.getUser();
        const sessionId = this.getSessionCode();
        const email = user ? (user.email || '') : 'guest';
        const k = this._key(sessionId, elementId, email);

        // 清除記憶體快取
        this._cache.delete(k);

        // 清除 DB 記錄
        if (!user) return;
        try {
            await db.delete('submissions', {
                session_id: `eq.${sessionId || ''}`,
                element_id: `eq.${elementId}`,
                student_email: `eq.${email}`,
            });
        } catch (e) {
            console.warn('[stateManager] clear failed:', e);
        }
    }

    /**
     * 載入某學員在某 session 的所有互動記錄（email 模組用）
     * @param {string} sessionId
     * @param {string} email
     */
    async loadAll(sessionId, email) {
        try {
            const raw = await db.select('submissions', {
                filter: {
                    session_id: `eq.${sessionId}`,
                    student_email: `eq.${email}`,
                    element_id: 'neq.',
                },
            });
            return this._unwrap(raw);
        } catch (e) {
            console.warn('[stateManager] loadAll failed:', e);
            return [];
        }
    }

    /**
     * 取得排行榜資料
     * @param {string} sessionId
     * @returns {Promise<Array<{name: string, email: string, totalPoints: number}>>}
     */
    async getLeaderboard(sessionId, projectId) {
        if (!sessionId) return [];
        try {
            // ★ 使用 DB 端 RPC function 聚合，避免前端拉全表
            const { data, error } = await db.rpc('get_leaderboard', {
                p_session_id: sessionId,
                p_project_id: projectId || null
            });

            if (error || !data) {
                console.warn('[stateManager] RPC getLeaderboard failed, fallback to client-side:', error);
                return this._getLeaderboardFallback(sessionId, projectId);
            }

            return data.map(r => ({
                name: r.name || r.email,
                email: r.email,
                totalPoints: parseInt(r.total_points) || 0
            }));
        } catch (e) {
            console.warn('[stateManager] getLeaderboard failed:', e);
            return [];
        }
    }

    /** Fallback：如果 RPC 不存在，退回 client-side 聚合 */
    async _getLeaderboardFallback(sessionId, projectId) {
        try {
            const raw = await db.select('submissions', {
                filter: {
                    session_id: `eq.${sessionId}`,
                    student_email: 'neq.guest',
                },
                limit: 500,
            });
            const rows = this._unwrap(raw);
            const map = new Map();
            for (const r of rows) {
                const key = r.student_email || r.student_name;
                if (!key) continue;
                if (!map.has(key)) {
                    map.set(key, { name: r.student_name || key, email: r.student_email, totalPoints: 0 });
                }
                let st = r.state;
                if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
                map.get(key).totalPoints += (parseInt(st?._awarded) || 0);
            }
            return [...map.values()].sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
        } catch (e) {
            console.warn('[stateManager] fallback getLeaderboard failed:', e);
            return [];
        }
    }

    /**
     * 計算百分比（贏過幾 % 的同學）
     */
    async getPercentile(sessionId, elementId, currentScoreStr) {
        if (!sessionId || !elementId) return null;
        try {
            // 從 DB 撈取該 session + 該元素 的所有非訪客分數
            const raw = await db.select('submissions', {
                filter: {
                    session_id: `eq.${sessionId}`,
                    element_id: `eq.${elementId}`,
                    student_email: 'neq.guest' // 排除未登入的訪客
                }
            });
            const rows = this._unwrap(raw);
            if (rows.length === 0) return 100;

            const myScore = parseFloat(currentScoreStr) || 0;

            // 計算比自己低分的人數 (或是同分但提交較晚，這裡簡單用分數算)
            let lowerCount = 0;
            rows.forEach(r => {
                const s = parseFloat(r.score) || 0;
                if (s < myScore) {
                    lowerCount++;
                }
            });

            const total = rows.length;
            if (total === 0) return 100;

            // 避免計算出 0%，至少給 1% 鼓勵，或是直接計算。
            // 例如有 10 人，你最高，贏過 9 人 -> 90%
            const pct = Math.round((lowerCount / total) * 100);
            return pct;
        } catch (e) {
            console.warn('[stateManager] getPercentile failed:', e);
            return null;
        }
    }

    /**
     * 播放成功的煙火動畫與音效
     */
    playSuccessFeedback(container) {
        // --- 1. 煙火動畫 ---
        const colors = ['#4A7AE8', '#22c55e', '#f59e0b', '#ec4899', '#4285f4'];
        // 如果容器有 relative，就在容器內；沒有的話，先設定
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        for (let i = 0; i < 30; i++) {
            const dot = document.createElement('div');
            // 可以沿用 ordering-confetti class 如果有定義，如果沒有就寫 inline style
            dot.className = 'interactive-confetti';
            dot.style.position = 'absolute';
            dot.style.width = '8px';
            dot.style.height = '8px';
            dot.style.borderRadius = '50%';
            dot.style.pointerEvents = 'none';
            dot.style.zIndex = '999';
            dot.style.setProperty('--x', `${(Math.random() - 0.5) * 200}px`);
            dot.style.setProperty('--y', `${-60 - Math.random() * 120}px`);
            dot.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);

            // CSS Animation
            dot.animate([
                { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
                { transform: `translate(var(--x), var(--y)) rotate(var(--r))`, opacity: 0 }
            ], {
                duration: 800 + Math.random() * 400,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                fill: 'forwards',
                delay: Math.random() * 200
            });

            dot.style.left = `${40 + Math.random() * 20}%`;
            dot.style.bottom = '20px';
            dot.style.background = colors[i % colors.length];
            container.appendChild(dot);
            setTimeout(() => dot.remove(), 1500);
        }

        // --- 2. 成功音效 (Web Audio API) ---
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                const playTone = (freq, startTime, duration) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

                    gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
                    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + startTime + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(ctx.currentTime + startTime);
                    osc.stop(ctx.currentTime + startTime + duration);
                };

                // 播放一個輕快的琶音 C5 -> E5 -> G5 -> C6
                playTone(523.25, 0, 0.3);    // C5
                playTone(659.25, 0.1, 0.3);  // E5
                playTone(783.99, 0.2, 0.3);  // G5
                playTone(1046.50, 0.3, 0.5); // C6
            }
        } catch (e) {
            console.warn('[stateManager] play audio failed:', e);
        }
    }

    /**
     * 顯示加分動畫
     */
    showScorePopup(points) {
        const mountTarget = document.querySelector('.presentation-mode.active') || document.body;

        // 注入 keyframes
        if (!document.getElementById('score-popup-v2')) {
            const style = document.createElement('style');
            style.id = 'score-popup-v2';
            style.textContent = `
                @keyframes spvOverlay { from{opacity:0} to{opacity:1} }
                @keyframes spvBounce {
                    0%{transform:scale(0) rotate(-8deg);opacity:0}
                    60%{transform:scale(1.1) rotate(2deg);opacity:1}
                    80%{transform:scale(0.95) rotate(-1deg)}
                    100%{transform:scale(1) rotate(0);opacity:1}
                }
                @keyframes spvRing {
                    0%{transform:translate(-50%,-50%) scale(0.2);opacity:1}
                    100%{transform:translate(-50%,-50%) scale(3);opacity:0}
                }
                @keyframes spvLabel {
                    0%{transform:translateY(12px);opacity:0}
                    100%{transform:translateY(0);opacity:0.8}
                }
            `;
            document.head.appendChild(style);
        }

        // 覆蓋層
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; inset:0; z-index:10000;
            pointer-events:none;
            display:flex; align-items:center; justify-content:center; flex-direction:column;
            background:rgba(0,0,0,0.45);
            backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
            animation: spvOverlay 0.25s ease-out;
        `;
        mountTarget.appendChild(overlay);

        // 光環
        const ring = document.createElement('div');
        ring.style.cssText = `
            position:fixed; left:50%; top:50%;
            width:160px; height:160px; border-radius:50%;
            border:3px solid #fbbf24;
            box-shadow: 0 0 40px rgba(251,191,36,0.4), inset 0 0 40px rgba(251,191,36,0.2);
            animation: spvRing 0.8s 0.1s cubic-bezier(0.22,0.61,0.36,1) forwards;
        `;
        overlay.appendChild(ring);

        // 中央內容
        const center = document.createElement('div');
        center.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;z-index:1;';

        // 標籤
        const label = document.createElement('div');
        label.textContent = '得分';
        label.style.cssText = `
            color:rgba(255,255,255,0.6); font-size:13px; font-weight:500;
            letter-spacing:3px;
            font-family:'Inter','Noto Sans TC',sans-serif;
            animation: spvLabel 0.3s 0.15s ease-out both;
        `;

        // 大數字
        const big = document.createElement('div');
        big.textContent = `+${points}`;
        big.style.cssText = `
            font-size: min(24vw, 100px);
            font-weight:900; line-height:1;
            color:#fbbf24;
            text-shadow: 0 0 40px rgba(251,191,36,0.5), 0 0 80px rgba(251,191,36,0.3), 0 4px 20px rgba(0,0,0,0.4);
            font-family:'Inter','Noto Sans TC',sans-serif;
            font-variant-numeric:tabular-nums;
            animation: spvBounce 0.5s 0.08s cubic-bezier(0.34,1.56,0.64,1) both;
        `;

        // 分標
        const unit = document.createElement('div');
        unit.textContent = '分';
        unit.style.cssText = `
            color:rgba(255,255,255,0.5); font-size:16px; font-weight:500;
            font-family:'Noto Sans TC',sans-serif;
            animation: spvLabel 0.3s 0.4s ease-out both;
        `;

        center.appendChild(label);
        center.appendChild(big);
        center.appendChild(unit);
        overlay.appendChild(center);

        // 粒子爆發
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const colors = ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#22c55e', '#4A7AE8', '#ec4899'];
        for (let i = 0; i < 24; i++) {
            const p = document.createElement('div');
            const size = 4 + Math.random() * 8;
            const angle = (i / 24) * Math.PI * 2;
            const dist = 80 + Math.random() * 250;
            p.style.cssText = `
                position:fixed; left:${cx}px; top:${cy}px;
                width:${size}px; height:${size}px;
                background:${colors[i % colors.length]};
                border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
                pointer-events:none; z-index:10001;
                box-shadow: 0 0 4px ${colors[i % colors.length]};
            `;
            overlay.appendChild(p);
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            setTimeout(() => {
                p.animate([
                    { transform: 'translate(-50%,-50%) scale(0)', opacity: 1 },
                    { transform: `translate(calc(-50% + ${dx*0.4}px),calc(-50% + ${dy*0.4}px)) scale(1.5)`, opacity: 1, offset: 0.3 },
                    { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(0)`, opacity: 0 }
                ], {
                    duration: 700 + Math.random() * 400,
                    easing: 'cubic-bezier(0.22,0.61,0.36,1)',
                    fill: 'forwards'
                });
            }, Math.random() * 150);
            setTimeout(() => p.remove(), 1200);
        }

        // 音效
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) {
                const ctx = new AC();
                const play = (freq, t, dur) => {
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.type = 'sine';
                    o.frequency.setValueAtTime(freq, ctx.currentTime + t);
                    g.gain.setValueAtTime(0, ctx.currentTime + t);
                    g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + t + 0.03);
                    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
                    o.connect(g); g.connect(ctx.destination);
                    o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + dur);
                };
                play(659, 0, 0.15); play(784, 0.08, 0.15); play(1047, 0.16, 0.3);
            }
        } catch { /* silent */ }

        // 1.5 秒後淡出
        setTimeout(() => {
            overlay.animate([
                { opacity: 1, backdropFilter: 'blur(6px)' },
                { opacity: 0, backdropFilter: 'blur(0px)' }
            ], { duration: 350, fill: 'forwards' });
            setTimeout(() => overlay.remove(), 400);
        }, 1500);
    }
}

/** 全域單例 */
export const stateManager = new InteractionState();
