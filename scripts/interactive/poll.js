/**
 * 投票互動模組 — 無正確答案，即時票數統計（含統一狀態寫入）
 */
import { db, realtime } from '../supabase.js';
import { stateManager } from './stateManager.js';

export class PollGame {
    constructor() {
        this._voteCounts = {};   // elementId → [count0, count1, ...]
        this._voted = new Set(); // 已投票的 elementId
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

        // 載入歷史票數
        this._loadVotes(elementId, sessionCode, container);

        // 檢查是否已投過票
        const user = this._getUser();
        if (user?.email && this._hasVotedLocal(elementId)) {
            this._markVoted(container, optionEls);
            return;
        }

        optionEls.forEach((opt, i) => {
            opt.addEventListener('click', () => {
                if (this._voted.has(elementId)) return;
                this._voted.add(elementId);

                // 視覺回饋
                optionEls.forEach(o => o.classList.remove('poll-selected'));
                opt.classList.add('poll-selected');

                // 記錄投票
                this._submitVote(elementId, i, sessionCode, container, optionEls);
            });
        });
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

        // 持久化到 DB
        try {
            await db.insert('poll_votes', {
                session_code: sessionCode || 'free',
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
        await stateManager.save(elementId, {
            type: 'poll',
            title: container.querySelector('.poll-question')?.textContent || '投票',
            content: optLabel,
            isCorrect: null,
            score: null,
            state: { optionIndex, optionLabel: optLabel },
        });
    }

    async _loadVotes(elementId, sessionCode, container) {
        const optionEls = container.querySelectorAll('.poll-option');
        const counts = new Array(optionEls.length).fill(0);
        try {
            const code = sessionCode || 'free';
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
        const { elementId, optionIndex } = payload;
        if (!this._voteCounts[elementId]) {
            // 嘗試找對應 container
            const containers = document.querySelectorAll('.poll-container');
            containers.forEach(c => {
                const eid = c.closest('[data-id]')?.dataset.id || '';
                if (!this._voteCounts[eid]) {
                    const opts = c.querySelectorAll('.poll-option');
                    this._voteCounts[eid] = new Array(opts.length).fill(0);
                }
            });
        }

        if (this._voteCounts[elementId]) {
            this._voteCounts[elementId][optionIndex]++;

            // 更新 UI
            const containers = document.querySelectorAll('.poll-container');
            containers.forEach(c => {
                const eid = c.closest('[data-id]')?.dataset.id || '';
                if (eid === elementId) {
                    const optionEls = c.querySelectorAll('.poll-option');
                    this._renderBars(c, optionEls, this._voteCounts[elementId]);
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
            try {
                const rows = await db.select('poll_votes', {
                    filter: {
                        session_code: `eq.${sessionCode || 'free'}`,
                        element_id: `eq.${elementId}`,
                    },
                });
                const data = rows?.data || rows || [];
                if (data) {
                    data.forEach(r => {
                        if (r.option_index >= 0 && r.option_index < counts.length) {
                            counts[r.option_index]++;
                        }
                    });
                }
            } catch (e) { /* ignore */ }
            this._voteCounts[elementId] = counts;
            this._renderBars(c, optionEls, counts);
        }
    }

    // ─ Helpers ─
    _getSessionCode() {
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
}
