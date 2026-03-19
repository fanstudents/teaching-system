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
        let firstAwardedPoints = awardedPoints; // 預設用本次分數
        const cached = this._cache.get(k);
        if (cached) {
            // 記憶體中已有紀錄 → 這是重複作答
            isRetry = true;
            firstAwardedPoints = cached.state?._awarded ?? cached.awarded_points ?? awardedPoints;
        } else if (user) {
            // 記憶體沒有但 DB 可能有
            try {
                const raw = await db.select('submissions', {
                    filter: {
                        session_id: `eq.${sessionId || ''}`,
                        element_id: `eq.${elementId}`,
                        student_email: `eq.${email}`,
                    },
                });
                const existing = this._unwrap(raw);
                if (existing.length > 0) {
                    isRetry = true;
                    let st = existing[0].state;
                    if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
                    firstAwardedPoints = st?._awarded ?? 0;
                }
            } catch { }
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
            // 首次計分制：保留首次的分數
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

        // 如果是訪客，不寫入 DB
        if (!user) return { isRetry };

        // DB upsert（重複作答時只更新 content/state 但不改 _awarded）
        // ★ 加入重試機制，失敗時通知 UI
        const MAX_RETRIES = 2;
        let saved = false;
        for (let attempt = 0; attempt <= MAX_RETRIES && !saved; attempt++) {
            try {
                if (attempt > 0) await new Promise(r => setTimeout(r, 1000));

                const raw = await db.select('submissions', {
                    filter: {
                        session_id: `eq.${sessionId || ''}`,
                        element_id: `eq.${elementId}`,
                        student_email: `eq.${email}`,
                    },
                });
                const existing = this._unwrap(raw);

                if (existing.length > 0) {
                    await db.update('submissions', {
                        content: record.content,
                        is_correct: record.is_correct,
                        score: record.score,
                        state: record.state,
                        submitted_at: record.submitted_at,
                    }, { id: `eq.${existing[0].id}` });
                } else {
                    const { awarded_points, max_points, _isRetry, ...dbRecord } = record;
                    await db.insert('submissions', dbRecord);
                }
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
                    // ★ 所有重試都失敗 → 通知 UI 顯示 toast
                    window.dispatchEvent(new CustomEvent('submission-error', {
                        detail: { elementId, type: data.type, error: e.message || '儲存失敗' }
                    }));
                }
            }
        }

        // 加分動畫（非重複作答 + 有得分 + 非講師端）
        if (!isRetry && awardedPoints > 0 && !document.querySelector('.presentation-slide')) {
            this.showScorePopup(awardedPoints);
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
            // 自動查找 projectId（如果未提供）
            if (!projectId) {
                try {
                    const sessRaw = await db.select('project_sessions', {
                        filter: { session_code: `eq.${sessionId}` },
                        select: 'project_id',
                        limit: 1,
                    });
                    const sess = this._unwrap(sessRaw);
                    if (sess[0]?.project_id) projectId = sess[0].project_id;
                } catch { }
            }

            // 1. 取得 submissions 的分數
            const raw = await db.select('submissions', {
                filter: {
                    session_id: `eq.${sessionId}`,
                    student_email: 'neq.guest',
                },
            });
            const rows = this._unwrap(raw);

            // 按學員分組加總 state._awarded
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

            // 2. 取得已註冊學員（從 students 表），補齊沒有互動紀錄的學員
            if (projectId) {
                try {
                    const studentsRaw = await db.select('students', {
                        filter: { project_id: `eq.${projectId}` },
                        select: 'email,name',
                    });
                    const students = this._unwrap(studentsRaw);
                    for (const s of students) {
                        if (s.email && !map.has(s.email)) {
                            map.set(s.email, { name: s.name || s.email, email: s.email, totalPoints: 0 });
                        }
                    }
                } catch (e) {
                    console.warn('[stateManager] fetch registered students failed:', e);
                }
            }

            // 排序（高分在前，同分按名字排序）
            return [...map.values()].sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
        } catch (e) {
            console.warn('[stateManager] getLeaderboard failed:', e);
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
        // 掛載到 presentation-mode 容器（避免被 fullscreen 壓住）
        const mountTarget = document.querySelector('.presentation-mode.active') || document.body;

        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.innerHTML = `
            <div class="score-popup-inner">
                <span class="material-symbols-outlined">star</span>
                +${points} 分
            </div>
        `;
        mountTarget.appendChild(popup);

        // JS 煙火粒子
        const colors = ['#fbbf24', '#f59e0b', '#d97706', '#1a73e8', '#ec4899', '#22c55e'];
        for (let i = 0; i < 16; i++) {
            const p = document.createElement('div');
            p.style.cssText = `
                position:fixed;top:50%;left:50%;width:6px;height:6px;
                border-radius:50%;pointer-events:none;z-index:10001;
                background:${colors[i % colors.length]};
            `;
            mountTarget.appendChild(p);
            const angle = (i / 16) * Math.PI * 2;
            const dist = 60 + Math.random() * 80;
            p.animate([
                { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
                { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0)`, opacity: 0 }
            ], {
                duration: 700 + Math.random() * 400,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                fill: 'forwards',
                delay: 100 + Math.random() * 150
            });
            setTimeout(() => p.remove(), 1300);
        }

        setTimeout(() => popup.remove(), 2500);
    }
}

/** 全域單例 */
export const stateManager = new InteractionState();
