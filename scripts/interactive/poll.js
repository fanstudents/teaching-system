/**
 * 投票互動模組 — 無正確答案，即時票數統計（含統一狀態寫入）
 */
import { db, realtime } from '../supabase.js';
import { stateManager } from './stateManager.js';

export class PollGame {
    constructor() {
        this._voteCounts = {};   // elementId → [count0, count1, ...]
        this._voteNames = {};    // elementId → [[name1, name2], [name3], ...]
        this._voted = new Set(); // 已投票的 elementId
        this._revealed = new Set(); // 已開票的 elementId
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        document.querySelectorAll('.poll-container').forEach(c => this.setupContainer(c));
    }

    setupContainer(container) {
        if (container.dataset.pollInit === 'true') return;
        container.dataset.pollInit = 'true';

        const optionEls = container.querySelectorAll('.poll-option');
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        const sessionCode = this._getSessionCode();
        const isMulti = container.dataset.multiSelect === 'true';
        const maxSelect = parseInt(container.dataset.maxSelect) || 0;

        // 載入歷史票數
        this._loadVotes(elementId, sessionCode, container);

        // ★ 先註冊 realtime 監聽（必須在 early return 之前，否則已投票的學員永遠收不到重置事件）
        if (typeof realtime !== 'undefined' && realtime.isConnected && sessionCode) {
            realtime.on('poll_lock', (msg) => {
                if (msg.elementId === elementId) {
                    container.classList.add('poll-locked');
                    optionEls.forEach(opt => { opt.style.cursor = 'default'; opt.style.pointerEvents = 'none'; });
                    let lockStatus = container.querySelector('.poll-lock-status');
                    if (!lockStatus) {
                        lockStatus = document.createElement('div');
                        lockStatus.className = 'poll-lock-status';
                        lockStatus.style.cssText = 'text-align:center;padding:6px;font-size:12px;color:#94a3b8;margin-top:8px;';
                        container.appendChild(lockStatus);
                    }
                    lockStatus.textContent = '🔒 投票已截止';
                }
            });

            // 監聽投票重置（講師觸發）
            realtime.on('poll_reset', (msg) => {
                if (msg.elementId === elementId) {
                    // 清除本地投票狀態
                    this._voted.delete(elementId);
                    this._clearVotedLocal(elementId);
                    this._voteCounts[elementId] = new Array(optionEls.length).fill(0);

                    // 重置 UI
                    container.classList.remove('poll-voted', 'poll-locked');
                    container.querySelector('.poll-status')?.remove();
                    container.querySelector('.poll-lock-status')?.remove();
                    optionEls.forEach(opt => {
                        opt.classList.remove('poll-selected');
                        opt.style.cursor = '';
                        opt.style.pointerEvents = '';
                        opt.querySelector('.poll-bar')?.remove();
                        opt.querySelector('.poll-pct')?.remove();
                    });

                    // 重新綁定事件（透過重新 init）
                    container.dataset.pollInit = 'false';
                    this.setupContainer(container);
                }
            });
        }

        // 檢查是否已投過票
        const user = this._getUser();
        if (user?.email && this._hasVotedLocal(elementId)) {
            this._markVoted(container, optionEls);
            return;
        }

        if (isMulti) {
            // ── 多選模式 ──
            const selected = new Set();
            const submitBtn = container.querySelector('.poll-multi-submit');

            optionEls.forEach((opt, i) => {
                opt.addEventListener('click', () => {
                    if (this._voted.has(elementId) || container.classList.contains('poll-locked')) return;

                    if (selected.has(i)) {
                        selected.delete(i);
                        opt.classList.remove('poll-selected');
                    } else {
                        if (maxSelect > 0 && selected.size >= maxSelect) return; // 已達上限
                        selected.add(i);
                        opt.classList.add('poll-selected');
                    }

                    // 顯示/隱藏送出按鈕
                    if (submitBtn) {
                        submitBtn.style.display = selected.size > 0 ? 'inline-block' : 'none';
                        submitBtn.textContent = `確認送出（${selected.size}）`;
                    }
                });
            });

            if (submitBtn) {
                submitBtn.addEventListener('click', () => {
                    if (selected.size === 0 || this._voted.has(elementId)) return;
                    this._voted.add(elementId);
                    // 為每個選中的選項提交一票
                    for (const idx of selected) {
                        this._submitVote(elementId, idx, sessionCode, container, optionEls);
                    }
                    this._markVoted(container, optionEls);
                    submitBtn.style.display = 'none';
                });
            }
        } else {
            // ── 單選模式（原邏輯）──
            optionEls.forEach((opt, i) => {
                opt.addEventListener('click', () => {
                    if (this._voted.has(elementId) || container.classList.contains('poll-locked')) return;
                    this._voted.add(elementId);

                    // 視覺回饋
                    optionEls.forEach(o => o.classList.remove('poll-selected'));
                    opt.classList.add('poll-selected');

                    // 記錄投票
                    this._submitVote(elementId, i, sessionCode, container, optionEls);
                });
            });
        }
    }

    async _submitVote(elementId, optionIndex, sessionCode, container, optionEls) {
        const user = this._getUser();

        // 鎖定投票
        this._markVoted(container, optionEls);

        // 更新本地計數
        if (!this._voteCounts[elementId]) {
            this._voteCounts[elementId] = new Array(optionEls.length).fill(0);
        }
        this._voteCounts[elementId][optionIndex]++;
        this._renderBars(container, optionEls, this._voteCounts[elementId]);

        // 標記 localStorage 已投票
        this._setVotedLocal(elementId);

        // 發送 realtime event
        if (realtime.isConnected) {
            realtime.publish(`session:${sessionCode}`, 'poll_vote', {
                elementId,
                optionIndex,
                studentName: user?.name || '匿名',
            });
        }

        // 持久化到 DB（poll_votes 獨立表，用於即時統計）
        try {
            await db.insert('poll_votes', {
                session_code: stateManager.getSessionCode() || sessionCode || 'free',
                element_id: elementId,
                student_email: user?.email || '',
                student_name: user?.name || '匿名',
                option_index: optionIndex,
                created_at: new Date().toISOString(),
            });
        } catch (e) {
            console.warn('poll vote DB insert failed:', e);
        }

        // 統一寫入 submissions（讓 email 模組可以查詢）
        const optLabel = optionEls[optionIndex]?.textContent?.trim() || `選項 ${optionIndex + 1}`;
        const points = parseInt(container.closest('[data-points]')?.dataset.points) || 1;
        const speedBonus = container.closest('[data-speed-bonus]')?.dataset.speedBonus === 'true';
        const _r = await stateManager.save(elementId, {
            type: 'poll',
            title: container.querySelector('.poll-question')?.textContent || '投票',
            content: optLabel,
            isCorrect: null,
            score: null,
            points,
            speedBonus,
            participated: true,
            state: { optionIndex, optionLabel: optLabel },
        });
        if (_r?.isRetry) stateManager.showRetryBanner(container);
    }

    async _loadVotes(elementId, sessionCode, container) {
        const optionEls = container.querySelectorAll('.poll-option');
        const counts = new Array(optionEls.length).fill(0);
        try {
            const code = stateManager.getSessionCode() || sessionCode || 'free';
            const rows = await db.select('poll_votes', {
                filter: {
                    session_code: `eq.${code}`,
                    element_id: `eq.${elementId}`,
                },
            });
            const data = rows?.data || rows || [];
            if (data && data.length > 0) {
                data.forEach(r => {
                    if (r.option_index >= 0 && r.option_index < counts.length) {
                        counts[r.option_index]++;
                    }
                });
            }
        } catch (e) {
            console.warn('poll votes load failed:', e);
        }
        this._voteCounts[elementId] = counts;

        // 如果已投票，顯示結果
        if (this._hasVotedLocal(elementId)) {
            this._markVoted(container, optionEls);
            this._renderBars(container, optionEls, counts);
        }
    }

    _markVoted(container, optionEls) {
        container.classList.add('poll-voted');
        optionEls.forEach(opt => {
            opt.style.cursor = 'default';
        });
        // 顯示 status
        let status = container.querySelector('.poll-status');
        if (!status) {
            status = document.createElement('div');
            status.className = 'poll-status';
            container.appendChild(status);
        }
        status.textContent = '✓ 已投票';
    }

    _renderBars(container, optionEls, counts) {
        const total = counts.reduce((a, b) => a + b, 0);
        optionEls.forEach((opt, i) => {
            const count = counts[i] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;

            // bar
            let bar = opt.querySelector('.poll-bar');
            if (!bar) {
                bar = document.createElement('div');
                bar.className = 'poll-bar';
                opt.appendChild(bar);
            }
            bar.style.width = `${pct}%`;

            // label
            let label = opt.querySelector('.poll-pct');
            if (!label) {
                label = document.createElement('span');
                label.className = 'poll-pct';
                opt.appendChild(label);
            }
            label.textContent = `${count} 票 (${pct}%)`;
        });
    }

    /**
     * 講師端：接收 realtime 投票事件，更新即時統計
     */
    handleVoteEvent(payload) {
        const { elementId, optionIndex, studentName } = payload;
        if (!this._voteCounts[elementId]) {
            const containers = document.querySelectorAll('.poll-container');
            containers.forEach(c => {
                const eid = c.closest('[data-id]')?.dataset.id || '';
                if (!this._voteCounts[eid]) {
                    const opts = c.querySelectorAll('.poll-option');
                    this._voteCounts[eid] = new Array(opts.length).fill(0);
                    this._voteNames[eid] = Array.from({ length: opts.length }, () => []);
                }
            });
        }

        if (this._voteCounts[elementId]) {
            this._voteCounts[elementId][optionIndex]++;
            if (!this._voteNames[elementId]) this._voteNames[elementId] = this._voteCounts[elementId].map(() => []);
            if (!this._voteNames[elementId][optionIndex]) this._voteNames[elementId][optionIndex] = [];
            this._voteNames[elementId][optionIndex].push(studentName || '匿名');

            const containers = document.querySelectorAll('.poll-container');
            containers.forEach(c => {
                const eid = c.closest('[data-id]')?.dataset.id || '';
                if (eid === elementId) {
                    const optionEls = c.querySelectorAll('.poll-option');
                    if (this._revealed.has(elementId)) {
                        this._renderBarsWithNames(c, optionEls, this._voteCounts[elementId], this._voteNames[elementId]);
                    } else {
                        this._renderBars(c, optionEls, this._voteCounts[elementId]);
                    }
                }
            });
        }
    }

    /**
     * 講師端：載入歷史票數（簡報模式用）
     */
    async loadVotesForPresenter(sessionCode) {
        const containers = document.querySelectorAll('.poll-container');
        for (const c of containers) {
            const elementId = c.closest('[data-id]')?.dataset.id || '';
            const optionEls = c.querySelectorAll('.poll-option');
            const counts = new Array(optionEls.length).fill(0);
            const names = Array.from({ length: optionEls.length }, () => []);
            try {
                const sid = window._activeSessionUUID || sessionCode || 'free';
                const rows = await db.select('poll_votes', {
                    filter: {
                        session_code: `eq.${sid}`,
                        element_id: `eq.${elementId}`,
                    },
                });
                const data = rows?.data || rows || [];
                if (data) {
                    data.forEach(r => {
                        if (r.option_index >= 0 && r.option_index < counts.length) {
                            counts[r.option_index]++;
                            names[r.option_index].push(r.student_name || '匿名');
                        }
                    });
                }
            } catch (e) { /* ignore */ }
            this._voteCounts[elementId] = counts;
            this._voteNames[elementId] = names;
            this._renderBars(c, optionEls, counts);

            // 新增「公布結果」按鈕
            if (!c.querySelector('.poll-reveal-btn')) {
                const revealBtn = document.createElement('button');
                revealBtn.className = 'poll-reveal-btn';
                revealBtn.style.cssText = 'display:block;margin:10px auto 0;padding:8px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#1a73e8,#4285f4);color:white;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;';
                revealBtn.textContent = '📊 公布結果';
                revealBtn.addEventListener('click', () => this.revealResults(elementId, sessionCode));
                c.appendChild(revealBtn);
            }

            // 新增「重置投票」按鈕
            if (!c.querySelector('.poll-reset-btn')) {
                const resetBtn = document.createElement('button');
                resetBtn.className = 'poll-reset-btn';
                resetBtn.style.cssText = 'display:block;margin:6px auto 0;padding:6px 16px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.2s;font-family:inherit;';
                resetBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:2px;">refresh</span>重置投票';
                resetBtn.addEventListener('click', () => this.resetPoll(elementId, sessionCode, c));
                c.appendChild(resetBtn);
            }
        }
    }

    /**
     * 講師端：公布結果 — 鎖定投票 + 顯示誰投了什麼
     */
    revealResults(elementId, sessionCode) {
        this._revealed.add(elementId);

        // 廣播鎖定事件給學員
        if (realtime.isConnected && sessionCode) {
            realtime.publish(`session:${sessionCode}`, 'poll_lock', { elementId });
        }

        // 更新講師端 UI
        const containers = document.querySelectorAll('.poll-container');
        containers.forEach(c => {
            const eid = c.closest('[data-id]')?.dataset.id || '';
            if (eid === elementId) {
                const optionEls = c.querySelectorAll('.poll-option');
                const counts = this._voteCounts[elementId] || [];
                const names = this._voteNames[elementId] || [];
                this._renderBarsWithNames(c, optionEls, counts, names);

                // 移除按鈕，加上已開票狀態
                c.querySelector('.poll-reveal-btn')?.remove();
                let tag = c.querySelector('.poll-revealed-tag');
                if (!tag) {
                    tag = document.createElement('div');
                    tag.className = 'poll-revealed-tag';
                    tag.style.cssText = 'text-align:center;padding:6px;font-size:12px;color:#10b981;font-weight:600;margin-top:8px;';
                    tag.textContent = '✓ 已公布結果';
                    c.appendChild(tag);
                }
            }
        });
    }

    /**
     * 含投票人姓名的 bar 渲染
     */
    _renderBarsWithNames(container, optionEls, counts, names) {
        const total = counts.reduce((a, b) => a + b, 0);
        optionEls.forEach((opt, i) => {
            const count = counts[i] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const voters = names[i] || [];

            // bar
            let bar = opt.querySelector('.poll-bar');
            if (!bar) {
                bar = document.createElement('div');
                bar.className = 'poll-bar';
                opt.appendChild(bar);
            }
            bar.style.width = `${pct}%`;

            // pct label
            let label = opt.querySelector('.poll-pct');
            if (!label) {
                label = document.createElement('span');
                label.className = 'poll-pct';
                opt.appendChild(label);
            }
            label.textContent = `${count} 票 (${pct}%)`;

            // voter names
            let voterEl = opt.querySelector('.poll-voters');
            if (!voterEl) {
                voterEl = document.createElement('div');
                voterEl.className = 'poll-voters';
                voterEl.style.cssText = 'font-size:11px;color:#64748b;margin-top:4px;line-height:1.5;display:flex;flex-wrap:wrap;gap:4px;';
                opt.appendChild(voterEl);
            }
            voterEl.innerHTML = voters.map(n => `<span style="background:#f1f5f9;padding:1px 6px;border-radius:4px;white-space:nowrap;">${String(n).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`).join('');
        });
    }

    /**
     * 講師端：重置投票 — 清除 DB 資料 + 廣播重置事件
     */
    async resetPoll(elementId, sessionCode, container) {
        if (!confirm('確定要重置此投票？所有票數和學員投票紀錄都會被清除。')) return;

        const sid = window._activeSessionUUID || sessionCode || 'free';

        // 清除 DB
        try {
            await db.delete('poll_votes', {
                session_code: `eq.${sid}`,
                element_id: `eq.${elementId}`,
            });
        } catch (e) { console.warn('reset poll_votes failed:', e); }

        try {
            await db.delete('submissions', {
                session_id: `eq.${sid}`,
                element_id: `eq.${elementId}`,
            });
        } catch (e) { console.warn('reset submissions failed:', e); }

        // 清除內存
        this._voteCounts[elementId] = [];
        this._voteNames[elementId] = [];
        this._voted.delete(elementId);
        this._revealed.delete(elementId);

        // 重置 UI
        const optionEls = container.querySelectorAll('.poll-option');
        optionEls.forEach(opt => {
            opt.querySelector('.poll-bar')?.remove();
            opt.querySelector('.poll-pct')?.remove();
            opt.querySelector('.poll-voters')?.remove();
        });
        container.querySelector('.poll-revealed-tag')?.remove();
        container.querySelector('.poll-lock-status')?.remove();
        container.classList.remove('poll-locked');

        // 重新載入（清零 bars）
        this._voteCounts[elementId] = new Array(optionEls.length).fill(0);
        this._voteNames[elementId] = Array.from({ length: optionEls.length }, () => []);
        this._renderBars(container, optionEls, this._voteCounts[elementId]);

        // 恢復「公布結果」按鈕
        if (!container.querySelector('.poll-reveal-btn')) {
            const revealBtn = document.createElement('button');
            revealBtn.className = 'poll-reveal-btn';
            revealBtn.style.cssText = 'display:block;margin:10px auto 0;padding:8px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#1a73e8,#4285f4);color:white;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;';
            revealBtn.textContent = '📊 公布結果';
            revealBtn.addEventListener('click', () => this.revealResults(elementId, sessionCode));
            // 插在 reset 按鈕之前
            const resetBtn = container.querySelector('.poll-reset-btn');
            if (resetBtn) container.insertBefore(revealBtn, resetBtn);
            else container.appendChild(revealBtn);
        }

        // 廣播重置事件給學員
        if (realtime.isConnected && sessionCode) {
            realtime.publish(`session:${sessionCode}`, 'poll_reset', { elementId });
        }

        console.log(`[poll] Reset elementId=${elementId} in session=${sid}`);
    }

    // ─ Helpers ─
    _getSessionCode() {
        // 優先用 stateManager 的 session override
        const override = stateManager.getSessionCode();
        if (override) return override;
        return new URLSearchParams(location.search).get('code')
            || new URLSearchParams(location.search).get('session')
            || sessionStorage.getItem('poll_session_code')
            || '';
    }

    _getUser() {
        return JSON.parse(sessionStorage.getItem('homework_user') || 'null');
    }

    _hasVotedLocal(elementId) {
        const key = `poll_voted_${elementId}`;
        return localStorage.getItem(key) === 'true';
    }

    _setVotedLocal(elementId) {
        localStorage.setItem(`poll_voted_${elementId}`, 'true');
    }

    _clearVotedLocal(elementId) {
        localStorage.removeItem(`poll_voted_${elementId}`);
    }
}
