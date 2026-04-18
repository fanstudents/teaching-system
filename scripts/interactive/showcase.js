/**
 * 作業展示模組 — 投影片內嵌的作品展示牆
 * 自動從 DB 拉取提交，渲染繳交狀態 + 作品 grid
 */
import { db, realtime } from '../supabase.js';

export class Showcase {
    constructor() {
        this.cache = {};       // assignment_title → submissions[]
        this.pollingTimers = {};
        this.sessionCode = null;
        this.totalStudents = 0;
    }

    setSessionCode(code) {
        this.sessionCode = code;
    }

    /**
     * 初始化頁面上所有 .showcase-container
     */
    init() {
        this.destroy();
        this._lastDataHash = {};  // 強制重新渲染
        const containers = document.querySelectorAll('.showcase-container');
        containers.forEach(c => this.setupContainer(c));
    }

    /**
     * 清除所有 polling timers
     */
    destroy() {
        Object.values(this.pollingTimers).forEach(id => clearInterval(id));
        this.pollingTimers = {};
    }

    /**
     * 設定單一展示容器
     */
    async setupContainer(container) {
        const title = container.dataset.assignmentTitle || '';
        console.log('[Showcase] setupContainer title:', title, 'sessionCode:', this.sessionCode);
        if (!title) {
            container.innerHTML = `<div class="showcase-error"><span class="material-symbols-outlined">error</span> 未設定作業名稱</div>`;
            return;
        }

        // 偵測是否為講師端 — 存在 container 上，避免多容器互相覆蓋
        container._showcaseIsPresenter = !!container.closest('.presentation-slide');
        container._showcaseBroadcasting = !!window.app?.broadcasting;

        // 每個容器有唯一 ID，避免多個同 title 容器互相覆蓋 hash
        if (!container._showcaseId) {
            container._showcaseId = title + '_' + Math.random().toString(36).substr(2, 6);
        }
        const cid = container._showcaseId;

        // 清除舊 hash，確保新容器一定會渲染
        if (this._lastDataHash) delete this._lastDataHash[cid];

        container.innerHTML = `
            <div class="showcase-loading">
                <span class="material-symbols-outlined showcase-spin">progress_activity</span>
                <span>載入作品中…</span>
            </div>`;

        try {
            // ★ 載入互評投票資料（在 fetchAndRender 之前）
            if (container.dataset.peerVote === 'true' && this.sessionCode) {
                await this._loadPeerVotes(container, title);
            }
            await this.fetchAndRender(container, title);
        } catch (e) {
            console.error('[Showcase] setupContainer failed:', e);
            this.renderError(container, '載入失敗');
        }

        if (this.pollingTimers[cid]) clearInterval(this.pollingTimers[cid]);
        const timerId = setInterval(() => this.fetchAndRender(container, title), 8000);
        this.pollingTimers[cid] = timerId;

        // 學員端：監聽講師捲動同步
        if (!container._showcaseIsPresenter) {
            realtime.on('showcase_scroll', (msg) => {
                const p = msg.payload || msg;
                if (p.title !== title) return;
                const grid = container.querySelector('.showcase-grid');
                if (grid) {
                    const maxScroll = grid.scrollWidth - grid.clientWidth;
                    grid.scrollTo({ left: maxScroll * p.scrollPct, behavior: 'smooth' });
                }
            });
            realtime.on('showcase_focus', (msg) => {
                const p = msg.payload || msg;
                if (p.title !== title) return;
                const subs = this.cache[title];
                if (subs) this.openFocus(subs, p.index, container);
            });
        }
    }

    /**
     * 從 DB 拉取並渲染
     */
    async fetchAndRender(container, assignmentTitle) {
        const cid = container._showcaseId || assignmentTitle;
        try {
            // 加入 timeout 保護（10秒）
            const fetchWithTimeout = (table, opts) => {
                return Promise.race([
                    db.select(table, opts),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 10000))
                ]);
            };

            // ★ 查詢提交（含 session_id 優先 + fallback）
            let data = null;
            let error = null;

            // 第一輪：帶 session_id 嚴格查詢
            if (this.sessionCode) {
                const qid = window._activeSessionUUID || this.sessionCode;
                try {
                    const r = await fetchWithTimeout('submissions', {
                        filter: {
                            assignment_title: `eq.${assignmentTitle}`,
                            session_id: `eq.${qid}`
                        },
                        order: 'submitted_at.asc'
                    });
                    data = r.data;
                    error = r.error;
                } catch (e) {
                    console.warn('[Showcase] strict query failed:', e);
                }
            }

            // 第二輪：如果無結果，退回只用 assignment_title
            if (!data || data.length === 0) {
                try {
                    const r = await fetchWithTimeout('submissions', {
                        filter: { assignment_title: `eq.${assignmentTitle}` },
                        order: 'submitted_at.asc'
                    });
                    data = r.data;
                    error = r.error;
                } catch (e) {
                    console.warn('[Showcase] loose query failed:', e);
                }
            }

            console.log('[Showcase] result for', assignmentTitle, ':', data?.length, 'rows');
            if (error || !data) {
                console.error('[Showcase] query error:', error);
                this.renderError(container, '無法載入作品');
                return;
            }

            if (this.sessionCode) {
                try {
                    const { data: students } = await fetchWithTimeout('students', {
                        filter: { session_code: `eq.${this.sessionCode}` },
                        select: 'id'
                    });
                    this.totalStudents = students?.length || 0;
                } catch { /* non-critical */ }
            }

            // 比較資料是否有變化，沒變就不重新渲染（避免重設捲動位置）
            const dataHash = JSON.stringify(data.map(s => {
                let st = s.state;
                if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
                return s.id + (s.submitted_at || '') + (st?._awarded || '');
            }));
            if (this._lastDataHash && this._lastDataHash[cid] === dataHash) {
                return; // 資料沒變，跳過
            }
            if (!this._lastDataHash) this._lastDataHash = {};
            this._lastDataHash[cid] = dataHash;

            // ★ 去重：同一學員只保留最新一筆（data 已按 submitted_at asc 排序）
            const deduped = [];
            const seen = new Map(); // student_name → index in deduped
            for (const s of data) {
                const key = s.student_name || s.student_email || s.id;
                if (seen.has(key)) {
                    deduped[seen.get(key)] = s; // 替換為更新的
                } else {
                    seen.set(key, deduped.length);
                    deduped.push(s);
                }
            }

            this.cache[assignmentTitle] = deduped;
            console.log('[Showcase] submissions for', assignmentTitle, ':', data.length, 'raw →', deduped.length, 'deduped');

            // 保存捲動位置
            const grid = container.querySelector('.showcase-grid');
            const savedScroll = grid ? grid.scrollLeft : 0;

            this.render(container, deduped, assignmentTitle);

            // 恢復捲動位置
            requestAnimationFrame(() => {
                const newGrid = container.querySelector('.showcase-grid');
                if (newGrid && savedScroll > 0) {
                    newGrid.scrollLeft = savedScroll;
                }
            });
        } catch (e) {
            console.error('[Showcase] fetch error:', e);
            if (this.cache[assignmentTitle]) {
                this.render(container, this.cache[assignmentTitle], assignmentTitle);
            } else {
                this.renderError(container, '連線失敗，請稍後重試');
            }
        }
    }

    /* ───── 渲染 ───── */

    render(container, submissions, assignmentTitle) {
        const count = submissions.length;
        const isPresenter = container._showcaseIsPresenter && container._showcaseBroadcasting;

        // ── 互評投票設定 ──
        const peerVoteEnabled = container.dataset.peerVote === 'true';
        const peerVoteMax = parseInt(container.dataset.peerVoteCount) || 3;
        const myVotes = container._peerMyVotes || new Set();  // submission IDs I voted for
        const voteCounts = container._peerVoteCounts || {};    // submission_id → count
        const currentUser = (() => {
            try { return JSON.parse(sessionStorage.getItem('homework_user')); } catch { return null; }
        })();
        const myName = currentUser?.name || '';

        const statusHtml = submissions.map(s => {
            const safeName = this.escapeHtml(s.student_name || '?');
            return `
            <div class="showcase-status-chip" title="${safeName}">
                <span class="showcase-chip-avatar">${safeName[0]}</span>
                <span class="showcase-chip-name">${safeName}</span>
            </div>
        `;
        }).join('');

        const cardsHtml = submissions.map((s, i) => {
            const preview = this.getPreview(s);
            const existingScore = (() => {
                let st = s.state;
                if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
                return (st?._instructorScored) ? (parseInt(st?._awarded) || 0) : 0;
            })();
            const safeName = this.escapeHtml(s.student_name || '匿名');
            const subId = s.id;
            const vc = voteCounts[subId] || 0;

            // 講師端：5 星評分
            const scoreHtml = isPresenter ? `
                <div class="showcase-score-bar" data-sub-id="${s.id}">
                    <div class="showcase-score-stars">
                        ${[1, 2, 3, 4, 5].map(n => {
                            const filled = existingScore >= n;
                            return `<button class="showcase-star-btn${filled ? ' filled' : ''}" data-score="${n}" title="${n} 分">
                                <span class="material-symbols-outlined">${filled ? 'star' : 'star'}</span>
                            </button>`;
                        }).join('')}
                    </div>
                    <span class="showcase-score-value">${existingScore ? existingScore + ' 分' : ''}</span>
                    <span class="showcase-score-saved" style="display:none;">✓ 已存</span>
                </div>` : (s.instructor_score ? `
                <div class="showcase-score-display">
                    <span class="material-symbols-outlined">star</span>
                    <span>${s.instructor_score} 分</span>
                </div>` : '');

            // 互評投票列（講師端顯示得票數，學員端顯示投票按鈕）
            let peerHtml = '';
            if (peerVoteEnabled) {
                const isMine = s.student_name === myName;
                const voted = myVotes.has(subId);
                if (isPresenter) {
                    // 講師端：只顯示得票數
                    peerHtml = `<div class="showcase-peer-bar">
                        <span class="material-symbols-outlined" style="font-size:14px;color:${vc > 0 ? '#ef4444' : '#cbd5e1'};">favorite</span>
                        <span class="showcase-peer-count">${vc}</span>
                    </div>`;
                } else {
                    // 學員端：投票按鈕
                    peerHtml = `<div class="showcase-peer-bar">
                        <button class="showcase-vote-btn ${voted ? 'voted' : ''} ${isMine ? 'is-mine' : ''}"
                                data-sub-id="${subId}" ${isMine ? 'disabled title="不能投自己"' : ''}>
                            <span class="material-symbols-outlined">${voted ? 'favorite' : 'favorite_border'}</span>
                        </button>
                        <span class="showcase-peer-count">${vc || ''}</span>
                    </div>`;
                }
            }

            return `
                <div class="showcase-work-card" data-index="${i}" data-sub-id="${subId}">
                    <div class="showcase-work-header">
                        <span class="showcase-work-avatar">${safeName[0]}</span>
                        <div style="flex:1;min-width:0;">
                            <div class="showcase-work-name">${safeName}</div>
                            <div style="font-size:10px;color:#94a3b8;">${this.formatTime(s.submitted_at || s.created_at)}</div>
                        </div>
                        <div style="font-size:10px;color:#94a3b8;">#${i + 1}</div>
                    </div>
                    <div class="showcase-work-body">${preview}</div>
                    ${scoreHtml}
                    ${peerHtml}
                </div>`;
        }).join('');

        const total = this.totalStudents;
        const notSubmitted = Math.max(0, total - count);
        const countLabel = total > 0
            ? `已繳 ${count} / 應繳 ${total}　<span class="showcase-header-pending">${notSubmitted} 人未繳</span>`
            : `${count} 份繳交`;

        // 互評剩餘票數提示
        const remaining = peerVoteMax - myVotes.size;
        const peerInfoHtml = peerVoteEnabled ? (isPresenter
            ? `<button class="showcase-settle-btn" title="結算互評分數">
                <span class="material-symbols-outlined" style="font-size:14px;">calculate</span> 結算
              </button>`
            : `<span class="showcase-votes-remaining">${remaining > 0 ? `剩 ${remaining} 票` : '已投完'}</span>`
        ) : '';

        container.innerHTML = `
            <div class="showcase-header-bar">
                <div class="showcase-header-left">
                    <span class="material-symbols-outlined" style="font-size:18px;">gallery_thumbnail</span>
                    <span class="showcase-header-title">${assignmentTitle}</span>
                    <div class="showcase-view-toggle">
                        <button class="showcase-view-btn active" data-view="scroll" title="左右滑動">
                            <span class="material-symbols-outlined">view_column</span>
                        </button>
                        <button class="showcase-view-btn" data-view="grid-3" title="9 宮格（3×3）">
                            <span class="material-symbols-outlined">grid_view</span>
                        </button>
                        <button class="showcase-view-btn" data-view="grid-4" title="16 宮格（4×4）">
                            <span class="material-symbols-outlined">apps</span>
                        </button>
                    </div>
                    ${peerInfoHtml}
                </div>
                <span class="showcase-header-count">${countLabel}</span>
            </div>
            <div class="showcase-status-row">${statusHtml}</div>
            <div class="showcase-grid">${cardsHtml || '<div class="showcase-empty">尚無人繳交</div>'}</div>
        `;

        // ── 宮格模式切換邏輯 ──
        const viewBtns = container.querySelectorAll('.showcase-view-btn');
        const gridEl = container.querySelector('.showcase-grid');
        // 恢復上次的模式
        const savedView = container._showcaseViewMode || 'scroll';
        if (savedView !== 'scroll' && gridEl) {
            gridEl.classList.add('grid-mode', savedView);
            viewBtns.forEach(b => b.classList.toggle('active', b.dataset.view === savedView));
        }
        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.view;
                container._showcaseViewMode = mode;
                viewBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (!gridEl) return;
                gridEl.classList.remove('grid-mode', 'grid-3', 'grid-4');
                if (mode !== 'scroll') {
                    gridEl.classList.add('grid-mode', mode);
                }
            });
        });

        container.querySelectorAll('.showcase-work-card').forEach(card => {
            // 點擊作品區域 → 聚焦放大（不含評分列）
            const bodyArea = card.querySelector('.showcase-work-body');
            const headerArea = card.querySelector('.showcase-work-header');
            const openFn = () => {
                const idx = parseInt(card.dataset.index);
                this.openFocus(submissions, idx, container);
                if (isPresenter) {
                    realtime.publish(`session:${this.sessionCode}`, 'showcase_focus', {
                        title: assignmentTitle, index: idx
                    });
                }
            };
            bodyArea?.addEventListener('click', openFn);
            headerArea?.addEventListener('click', openFn);

            // ★ 講師評分按鈕（5 星制）
            if (isPresenter) {
                card.querySelectorAll('.showcase-star-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const score = parseInt(btn.dataset.score);
                        const subId = card.querySelector('.showcase-score-bar')?.dataset.subId;
                        if (!subId) return;

                        // 1. 讀取舊分數（只查一次）
                        let oldScore = 0;
                        let existingState = {};
                        try {
                            const { data: rows } = await db.select('submissions', {
                                filter: { id: `eq.${subId}` },
                                select: 'state'
                            });
                            if (rows && rows[0]) {
                                let st = rows[0].state;
                                if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
                                existingState = st || {};
                                oldScore = parseInt(existingState._awarded) || 0;
                            }
                        } catch { }

                        const delta = score - oldScore;

                        // 2. UI 回饋 — 星星填滿（先做，不等 DB）
                        card.querySelectorAll('.showcase-star-btn').forEach(b => {
                            const bScore = parseInt(b.dataset.score);
                            if (bScore <= score) {
                                b.classList.add('filled');
                                b.classList.remove('half');
                            } else {
                                b.classList.remove('filled', 'half');
                            }
                        });
                        const valueEl = card.querySelector('.showcase-score-value');
                        if (valueEl) valueEl.textContent = score + ' 分';

                        // 3. ★ 立即觸發動畫（每次點擊都顯示）
                        const sub = submissions[parseInt(card.dataset.index)];
                        this._flyStarToLeaderboard(btn, delta || score);

                        // 4. 非同步寫入 DB + 廣播
                        try {
                            // ★ 如果 submission 沒有 email，從排行榜 DOM 找
                            let studentEmail = sub.student_email || '';
                            if (!studentEmail && sub.student_name) {
                                // 從排行榜 DOM 反查 email
                                document.querySelectorAll('.lb-row').forEach(row => {
                                    const nameEl = row.querySelector('.lb-name');
                                    if (nameEl && nameEl.textContent.trim() === sub.student_name) {
                                        studentEmail = row.dataset.email || '';
                                    }
                                });
                                if (studentEmail) {
                                    console.log('[Showcase] 從排行榜找到 email:', studentEmail, 'for', sub.student_name);
                                }
                            }

                            // ★ 用 SECURITY DEFINER RPC 更新 state._awarded + 補 email
                            const { data: rpcResult, error: rpcErr } = await db.rpc(
                                'instructor_score_submission',
                                {
                                    p_submission_id: subId,
                                    p_score: score,
                                    p_session_id: window._activeSessionUUID || this.sessionCode || null,
                                    p_student_email: studentEmail || null
                                }
                            );

                            if (rpcErr) {
                                console.error('[Showcase] RPC score failed:', rpcErr);
                            } else {
                                const r = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
                                console.log('[Showcase] RPC score OK:', r);
                            }

                            // UI saved 提示
                            const saved = card.querySelector('.showcase-score-saved');
                            if (saved) {
                                saved.style.display = 'inline';
                                setTimeout(() => saved.style.display = 'none', 2000);
                            }

                            // 廣播
                            if (sub && this.sessionCode) {
                                realtime.publish(`session:${this.sessionCode}`, 'hw_scored', {
                                    studentName: sub.student_name,
                                    studentEmail: sub.student_email || '',
                                    score,
                                    assignmentTitle
                                });
                            }

                            // DB 寫入完成後：樂觀更新排行榜 DOM
                            if (studentEmail && window.app) {
                                const lbRow = document.querySelector(`.lb-row[data-email="${studentEmail}"]`);
                                if (lbRow) {
                                    const ptsEl = lbRow.querySelector('.lb-pts');
                                    if (ptsEl && delta !== 0) {
                                        const oldPts = parseInt(ptsEl.textContent) || 0;
                                        const newPts = oldPts + delta;
                                        ptsEl.textContent = newPts;
                                        if (window.app._lbScoreCache) {
                                            const c = window.app._lbScoreCache.get(studentEmail);
                                            if (c) c.pts = newPts;
                                            else window.app._lbScoreCache.set(studentEmail, { pts: newPts, rank: -1 });
                                        }
                                    }
                                }
                                // 延遲 RPC 同步排序
                                setTimeout(() => window.app.updateLeaderboard(), 2000);
                            }

                            console.log(`[Showcase] scored ${sub?.student_name}: ${oldScore} → ${score} (delta: ${delta > 0 ? '+' : ''}${delta})`);
                        } catch (err) {
                            console.warn('[Showcase] score save failed:', err);
                        }
                    });
                });
            }
        });

        // ── 學員互評投票 ──
        if (peerVoteEnabled && !isPresenter) {
            container.querySelectorAll('.showcase-vote-btn:not(.is-mine)').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const subId = btn.dataset.subId;
                    if (!subId || !myName) return;

                    if (myVotes.has(subId)) {
                        // 取消投票
                        myVotes.delete(subId);
                        voteCounts[subId] = Math.max(0, (voteCounts[subId] || 1) - 1);
                        btn.classList.remove('voted');
                        btn.querySelector('.material-symbols-outlined').textContent = 'favorite_border';
                        // 刪 DB
                        db.delete('poll_votes', {
                            session_code: `eq.${this.sessionCode || 'free'}`,
                            element_id: `eq.peer_vote_${assignmentTitle}`,
                            student_name: `eq.${myName}`,
                            option_text: `eq.${subId}`,
                        }).catch(e => console.warn('[PeerVote] delete failed:', e));
                    } else {
                        // 檢查票數上限
                        if (myVotes.size >= peerVoteMax) {
                            import('../ui.js').then(m => m.showToast(`你最多只能投 ${peerVoteMax} 票`, { type: 'error' }));
                            return;
                        }
                        myVotes.add(subId);
                        voteCounts[subId] = (voteCounts[subId] || 0) + 1;
                        btn.classList.add('voted');
                        btn.querySelector('.material-symbols-outlined').textContent = 'favorite';
                        // 寫 DB
                        db.insert('poll_votes', {
                            session_code: this.sessionCode || 'free',
                            element_id: `peer_vote_${assignmentTitle}`,
                            student_name: myName,
                            student_email: currentUser?.email || '',
                            option_text: subId,
                            option_index: 0,
                            created_at: new Date().toISOString(),
                        }).catch(e => console.warn('[PeerVote] insert failed:', e));
                    }

                    container._peerMyVotes = myVotes;
                    container._peerVoteCounts = voteCounts;

                    // 更新得票數顯示
                    const countEl = btn.parentElement?.querySelector('.showcase-peer-count');
                    if (countEl) countEl.textContent = voteCounts[subId] || '';

                    // 更新剩餘票數
                    const remainEl = container.querySelector('.showcase-votes-remaining');
                    const rem = peerVoteMax - myVotes.size;
                    if (remainEl) remainEl.textContent = rem > 0 ? `剩 ${rem} 票` : '已投完';

                    // 禁用其他未投按鈕（票數用完）
                    if (rem <= 0) {
                        container.querySelectorAll('.showcase-vote-btn:not(.voted):not(.is-mine)').forEach(b => b.disabled = true);
                    } else {
                        container.querySelectorAll('.showcase-vote-btn:not(.is-mine)').forEach(b => b.disabled = false);
                    }
                });
            });
        }

        // ── 講師結算互評 ──
        if (peerVoteEnabled && isPresenter) {
            const settleBtn = container.querySelector('.showcase-settle-btn');
            if (settleBtn) {
                settleBtn.addEventListener('click', async () => {
                    settleBtn.disabled = true;
                    settleBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;">hourglass_top</span> 結算中…';

                    try {
                        // 查所有投票
                        const { data: votes } = await db.select('poll_votes', {
                            filter: {
                                session_code: `eq.${this.sessionCode || 'free'}`,
                                element_id: `eq.peer_vote_${assignmentTitle}`,
                            }
                        });

                        // 計算每個 submission 的得票數
                        const tally = {};
                        (votes || []).forEach(v => {
                            const sid = v.option_text;
                            tally[sid] = (tally[sid] || 0) + 1;
                        });

                        const maxVotes = Math.max(...Object.values(tally), 1);
                        const maxPts = parseInt(container.closest('[data-points]')?.dataset.points) || 5;

                        // 結算結果陣列
                        const results = [];

                        // 逐一更新 submission 分數
                        for (const sub of submissions) {
                            const vc = tally[sub.id] || 0;
                            if (vc <= 0) continue;
                            const score = Math.round(maxPts * (vc / maxVotes) * 100) / 100;
                            results.push({ name: sub.student_name, votes: vc, score });

                            try {
                                const { error } = await db.rpc('instructor_score_submission', {
                                    p_submission_id: sub.id,
                                    p_score: score,
                                    p_session_id: window._activeSessionUUID || this.sessionCode || null,
                                    p_student_email: sub.student_email || null,
                                });
                                if (error) console.warn('[PeerVote] settle score failed:', error);
                                else console.log(`[PeerVote] ${sub.student_name}: ${vc} votes → ${score} pts`);
                            } catch (e) { console.warn('[PeerVote] settle error:', e); }
                        }

                        settleBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> 已結算';

                        // ★ 顯示結算摘要卡片
                        results.sort((a, b) => b.votes - a.votes);
                        const summaryRows = results.map((r, i) => `
                            <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
                                <span style="font-size:12px;color:#94a3b8;width:20px;text-align:right;">#${i + 1}</span>
                                <span style="flex:1;font-size:13px;font-weight:500;color:#1e293b;">${this.escapeHtml(r.name)}</span>
                                <span style="font-size:12px;color:#ef4444;">❤️ ${r.votes}</span>
                                <span style="font-size:13px;font-weight:700;color:#059669;">${r.score} 分</span>
                            </div>
                        `).join('');

                        const summaryCard = document.createElement('div');
                        summaryCard.className = 'showcase-settle-summary';
                        summaryCard.innerHTML = `
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                <span style="font-size:13px;font-weight:700;color:#1e293b;">📊 互評結算結果</span>
                                <span style="font-size:11px;color:#94a3b8;">${votes?.length || 0} 票 → ${results.length} 人得分（滿分 ${maxPts}）</span>
                            </div>
                            ${summaryRows || '<div style="color:#94a3b8;font-size:13px;">無投票資料</div>'}
                        `;

                        // 插入在 status-row 和 grid 之間
                        const existingSummary = container.querySelector('.showcase-settle-summary');
                        if (existingSummary) existingSummary.remove();
                        const gridEl = container.querySelector('.showcase-grid');
                        if (gridEl) gridEl.parentElement.insertBefore(summaryCard, gridEl);

                        // 刷新排行榜
                        if (window.app) setTimeout(() => window.app.updateLeaderboard(), 1500);
                    } catch (e) {
                        console.error('[PeerVote] settle failed:', e);
                        settleBtn.disabled = false;
                        settleBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;">error</span> 結算失敗';
                    }
                });
            }
        }

        // 講師端：廣播捲動位置
        const grid = container.querySelector('.showcase-grid');
        if (grid && container._showcaseIsPresenter && container._showcaseBroadcasting) {
            let scrollThrottle = null;
            grid.addEventListener('scroll', () => {
                if (scrollThrottle) return;
                scrollThrottle = setTimeout(() => {
                    const pct = grid.scrollWidth > grid.clientWidth
                        ? grid.scrollLeft / (grid.scrollWidth - grid.clientWidth)
                        : 0;
                    realtime.publish(`session:${this.sessionCode}`, 'showcase_scroll', {
                        title: assignmentTitle, scrollPct: pct
                    });
                    scrollThrottle = null;
                }, 150);
            });
        }
    }

    /* ───── 圖片來源提取 ───── */

    _extractImageSrc(s) {
        const content = s.content || '';
        let src = '';
        let promptText = '';

        if (s.file_url && s.file_url.startsWith('http')) src = s.file_url;
        if (!src && content.startsWith('data:image/')) src = content;
        if (!src && content.startsWith('{')) {
            try {
                const p = JSON.parse(content);
                src = p.data || p.image?.data
                    || (typeof p.image === 'string' && p.image.startsWith('data:') ? p.image : '')
                    || '';
                promptText = p.prompt || '';
            } catch { /* */ }
        }
        if (!src && (content.startsWith('http://') || content.startsWith('https://'))) src = content;
        // 即使 src 已從 file_url 取得，仍嘗試提取 prompt
        if (src && !promptText && content.startsWith('{')) {
            try { promptText = JSON.parse(content).prompt || ''; } catch { /* */ }
        }
        if (!src) {
            console.warn('[Showcase] image src not found:', {
                file_url: s.file_url, content_start: content.substring(0, 100)
            });
        }
        return { src, promptText };
    }

    /* ───── 卡片預覽 ───── */

    getPreview(submission) {
        const s = submission;
        const content = s.content || '';

        switch (s.type) {
            case 'text':
                return `<div class="showcase-preview-text">${this.linkifyUrls(this.escapeHtml(content).substring(0, 200))}${content.length > 200 ? '…' : ''}</div>`;

            case 'image': {
                const { src, promptText } = this._extractImageSrc(s);
                let html = '';
                if (src) {
                    html += `<img src="${src}" class="showcase-preview-img" alt="作品" loading="lazy">`;
                } else {
                    html += `<div style="text-align:center;padding:16px;color:#94a3b8;"><span class="material-symbols-outlined" style="font-size:28px;">image</span><br>圖片載入中</div>`;
                }
                if (promptText) {
                    html += `<div class="showcase-preview-prompt">
                        <span style="font-size:10px;color:#1a73e8;font-weight:600;">Prompt</span>
                        <div style="font-size:12px;color:#334155;line-height:1.5;margin-top:2px;white-space:pre-wrap;">${this.escapeHtml(promptText)}</div>
                    </div>`;
                }
                return html;
            }

            case 'video': {
                let src = s.file_url || '';
                if (!src) { try { src = JSON.parse(content).data || ''; } catch { src = ''; } }
                if (src) return `<video src="${src}" style="width:100%;max-height:160px;border-radius:6px;object-fit:cover;" muted></video>`;
                return `<div style="text-align:center;padding:16px;color:#64748b;"><span class="material-symbols-outlined" style="font-size:28px;">videocam</span><br>影片</div>`;
            }

            case 'audio': {
                let src = s.file_url || '';
                if (!src) { try { src = JSON.parse(content).data || ''; } catch { src = ''; } }
                return `<div style="text-align:center;padding:12px;">
                    <span class="material-symbols-outlined" style="font-size:28px;color:#1a73e8;">headphones</span>
                    ${src ? `<audio src="${src}" controls style="width:100%;margin-top:8px;height:32px;"></audio>` : '<div style="color:#94a3b8;font-size:12px;margin-top:4px;">音檔</div>'}
                </div>`;
            }

            case 'link':
                return `<div style="padding:8px;word-break:break-all;">
                    <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;color:#1a73e8;">link</span>
                    <a href="${content}" target="_blank" style="color:#4A7AE8;font-size:12px;">${this.truncate(content, 60)}</a>
                </div>`;

            case 'matching':
            case 'fillblank':
                return `<div class="showcase-preview-score ${s.is_correct === 'true' ? 'perfect' : ''}">
                    <span class="score-big">${s.score || '—'}</span>
                    <span class="score-label">分</span>
                </div>`;

            default:
                return `<div class="showcase-preview-text">${this.linkifyUrls(this.escapeHtml(content).substring(0, 120))}</div>`;
        }
    }

    /* ───── 聚焦放大 ───── */

    /**
     * 清除目前的 focus overlay + keyboard handler
     */
    _cleanupFocusOverlay() {
        if (this._focusKeyHandler) {
            document.removeEventListener('keydown', this._focusKeyHandler);
            this._focusKeyHandler = null;
        }
        document.querySelector('.showcase-focus-overlay')?.remove();
    }

    openFocus(submissions, index, container) {
        // ★ 先清除舊的 overlay 和 keyboard handler
        this._cleanupFocusOverlay();

        const s = submissions[index];
        if (!s) return;
        const total = submissions.length;

        const overlay = document.createElement('div');
        overlay.className = 'showcase-focus-overlay';
        overlay.style.zIndex = '999999'; // 確保高於 .presentation-mode (z-index:2000)

        const fullContent = this.getFullContent(s);

        overlay.innerHTML = `
            <div class="showcase-focus-backdrop"></div>
            <div class="showcase-focus-card">
                <div class="showcase-focus-header">
                    <div class="showcase-focus-user">
                        <div class="showcase-focus-avatar">${(s.student_name || '?')[0]}</div>
                        <div>
                            <h3>${s.student_name || '匿名'}</h3>
                            <span>${this.formatTime(s.submitted_at || s.created_at)}</span>
                        </div>
                    </div>
                    <span class="showcase-focus-counter">${index + 1} / ${total}</span>
                </div>
                <div class="showcase-focus-body">${fullContent}</div>
                <div class="showcase-focus-nav">
                    <button class="showcase-focus-btn prev" ${index === 0 ? 'disabled' : ''}><span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span> 上一位</button>
                    <button class="showcase-focus-btn close"><span class="material-symbols-outlined" style="font-size:16px;">close</span> 關閉</button>
                    <button class="showcase-focus-btn next" ${index === total - 1 ? 'disabled' : ''}>下一位 <span class="material-symbols-outlined" style="font-size:16px;">arrow_forward</span></button>
                </div>
            </div>
        `;

        // 附加到 presentation-mode 容器內（避免被廣播 z-index 壓住）
        const presMode = document.querySelector('.presentation-mode.active') || document.body;
        presMode.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        // ★ 關閉用的共用函式（同時清除 keydown handler）
        const closeFocus = () => {
            if (this._focusKeyHandler) {
                document.removeEventListener('keydown', this._focusKeyHandler);
                this._focusKeyHandler = null;
            }
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 200);
        };

        overlay.querySelector('.showcase-focus-btn.close').onclick = closeFocus;
        overlay.querySelector('.showcase-focus-backdrop').onclick = closeFocus;
        overlay.querySelector('.showcase-focus-btn.prev').onclick = () => {
            overlay.remove();
            this.openFocus(submissions, index - 1, container);
        };
        overlay.querySelector('.showcase-focus-btn.next').onclick = () => {
            overlay.remove();
            this.openFocus(submissions, index + 1, container);
        };

        // ★ 將 keyHandler 存到 instance 上，外部可清除
        const keyHandler = (e) => {
            // ★ 如果 overlay 已被外部移除（例如切頁），清除 handler 並退出
            if (!overlay.isConnected) {
                document.removeEventListener('keydown', keyHandler);
                this._focusKeyHandler = null;
                return;
            }
            if (e.key === 'Escape') {
                e.stopPropagation(); // 避免觸發退出簡報
                closeFocus();
            } else if (e.key === 'ArrowLeft' && index > 0) {
                e.stopPropagation(); // 避免同時切投影片
                overlay.remove();
                this.openFocus(submissions, index - 1, container);
            } else if (e.key === 'ArrowRight' && index < total - 1) {
                e.stopPropagation(); // 避免同時切投影片
                overlay.remove();
                this.openFocus(submissions, index + 1, container);
            }
        };
        this._focusKeyHandler = keyHandler;
        document.addEventListener('keydown', keyHandler);
    }

    /* ───── 聚焦完整內容 ───── */

    getFullContent(s) {
        const content = s.content || '';
        switch (s.type) {
            case 'text':
                return `<div class="showcase-full-text">${this.linkifyUrls(this.escapeHtml(content))}</div>`;
            case 'image': {
                const { src, promptText } = this._extractImageSrc(s);
                let html = src ? `<img src="${src}" class="showcase-full-img">` : '<p>圖片無法顯示</p>';
                if (promptText) {
                    html += `<div style="margin-top:14px;padding:14px 18px;background:#f0f4ff;border-radius:10px;border:1px solid #a8c7fa;">
                        <div style="font-size:12px;color:#1a73e8;font-weight:700;margin-bottom:6px;">💬 Prompt</div>
                        <div style="font-size:15px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${this.escapeHtml(promptText)}</div>
                    </div>`;
                }
                return html;
            }
            case 'video': {
                let src = s.file_url || '';
                if (!src) { try { src = JSON.parse(content).data || ''; } catch { src = ''; } }
                return src ? `<video src="${src}" controls class="showcase-full-video"></video>` : '<p>影片無法顯示</p>';
            }
            case 'audio': {
                let src = s.file_url || '';
                if (!src) { try { src = JSON.parse(content).data || ''; } catch { src = ''; } }
                return `<div class="showcase-full-audio"><span class="material-symbols-outlined" style="font-size:2.5rem;">headphones</span><br><audio src="${src}" controls></audio></div>`;
            }
            case 'link':
                return `<div class="showcase-full-link"><a href="${content}" target="_blank">${content}</a></div>`;
            case 'matching':
            case 'fillblank':
                return `<div class="showcase-full-score ${s.is_correct === 'true' ? 'perfect' : ''}">
                    <div class="score-value">${s.score || '—'}</div>
                    <div class="score-detail">${content}</div>
                </div>`;
            default:
                return `<div class="showcase-full-text">${this.linkifyUrls(this.escapeHtml(content))}</div>`;
        }
    }

    /**
     * 載入互評投票資料
     */
    async _loadPeerVotes(container, assignmentTitle) {
        try {
            const { data: votes } = await db.select('poll_votes', {
                filter: {
                    session_code: `eq.${this.sessionCode}`,
                    element_id: `eq.peer_vote_${assignmentTitle}`,
                }
            });
            if (!votes || votes.length === 0) return;

            const currentUser = (() => {
                try { return JSON.parse(sessionStorage.getItem('homework_user')); } catch { return null; }
            })();
            const myName = currentUser?.name || '';

            const myVotes = new Set();
            const voteCounts = {};

            for (const v of votes) {
                const sid = v.option_text; // submission ID
                voteCounts[sid] = (voteCounts[sid] || 0) + 1;
                if (v.student_name === myName) {
                    myVotes.add(sid);
                }
            }

            container._peerMyVotes = myVotes;
            container._peerVoteCounts = voteCounts;
            console.log(`[PeerVote] loaded ${votes.length} votes, mine: ${myVotes.size}`);
        } catch (e) {
            console.warn('[PeerVote] load failed:', e);
        }
    }

    renderError(container, msg) {
        container.innerHTML = `<div class="showcase-error"><span class="material-symbols-outlined">error</span> ${msg}</div>`;
    }


    escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    /**
     * 將已 escape 的文字中的 URL 轉為可點擊超連結
     */
    linkifyUrls(escapedHtml) {
        return escapedHtml.replace(
            /(https?:\/\/[^\s<>&"]+)/gi,
            '<a href="$1" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:underline;text-underline-offset:2px;word-break:break-all;" onclick="event.stopPropagation()">$1</a>'
        );
    }

    truncate(str, max) {
        return str.length > max ? str.substring(0, max) + '…' : str;
    }

    formatTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    /**
     * 全螢幕加分/扣分動畫
     * @param {HTMLElement} starBtn - 被點擊的星星按鈕
     * @param {number} delta - 分數差值（正=加分，負=扣分）
     */
    _flyStarToLeaderboard(starBtn, delta) {
        const isPositive = delta > 0;
        const absDelta = Math.abs(delta);
        const accentColor = isPositive ? '#f59e0b' : '#ef4444';
        const accentGlow = isPositive ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)';

        // 找到對應學員名字
        const card = starBtn.closest('.showcase-work-card');
        const studentName = card?.querySelector('.showcase-work-name')?.textContent || '';

        // 掛載容器
        const mountTarget = document.fullscreenElement
            || document.webkitFullscreenElement
            || document.querySelector('.presentation-mode.active')
            || document.body;

        // ═══ 注入 keyframes ═══
        if (!document.getElementById('lb-anim-v2')) {
            const style = document.createElement('style');
            style.id = 'lb-anim-v2';
            style.textContent = `
                @keyframes scoreOverlayIn { from { opacity:0 } to { opacity:1 } }
                @keyframes scorePulseRing {
                    0% { transform:translate(-50%,-50%) scale(0.3); opacity:1 }
                    100% { transform:translate(-50%,-50%) scale(2.5); opacity:0 }
                }
                @keyframes scoreNumIn {
                    0% { transform:scale(0) rotate(-12deg); opacity:0 }
                    60% { transform:scale(1.15) rotate(2deg); opacity:1 }
                    80% { transform:scale(0.95) rotate(-1deg) }
                    100% { transform:scale(1) rotate(0deg); opacity:1 }
                }
                @keyframes scoreStarPop {
                    0% { transform:scale(0) rotate(-30deg); opacity:0 }
                    60% { transform:scale(1.3) rotate(5deg); opacity:1 }
                    100% { transform:scale(1) rotate(0deg); opacity:1 }
                }
                @keyframes scoreNameSlide {
                    0% { transform:translateY(20px); opacity:0 }
                    100% { transform:translateY(0); opacity:1 }
                }
                @keyframes scoreLabelFade {
                    0% { transform:translateY(10px); opacity:0 }
                    100% { transform:translateY(0); opacity:0.7 }
                }
            `;
            document.head.appendChild(style);
        }

        // ═══ 覆蓋層 ═══
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; inset:0; z-index:99999;
            pointer-events:none;
            display:flex; align-items:center; justify-content:center; flex-direction:column;
            background:rgba(0,0,0,0.55);
            backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
            animation: scoreOverlayIn 0.3s ease-out;
        `;
        mountTarget.appendChild(overlay);

        // ═══ 脈衝光環 ═══
        for (let r = 0; r < 2; r++) {
            const ring = document.createElement('div');
            ring.style.cssText = `
                position:fixed; left:50%; top:50%;
                width:200px; height:200px; border-radius:50%;
                border: 3px solid ${accentColor};
                box-shadow: 0 0 40px ${accentGlow}, inset 0 0 40px ${accentGlow};
                pointer-events:none;
                animation: scorePulseRing 1s ${r * 0.3}s cubic-bezier(0.22,0.61,0.36,1) forwards;
            `;
            overlay.appendChild(ring);
        }

        // ═══ 中央內容區 ═══
        const center = document.createElement('div');
        center.style.cssText = `
            display:flex; flex-direction:column; align-items:center; gap:6px;
            position:relative; z-index:1;
        `;

        // 標籤
        const label = document.createElement('div');
        label.textContent = isPositive ? '作業評分' : '扣分';
        label.style.cssText = `
            color:rgba(255,255,255,0.6); font-size:14px; font-weight:500;
            letter-spacing:4px; text-transform:uppercase;
            font-family:'Inter','Noto Sans TC',sans-serif;
            animation: scoreLabelFade 0.4s 0.1s ease-out both;
        `;

        // 學員名字
        const nameEl = document.createElement('div');
        nameEl.textContent = studentName;
        nameEl.style.cssText = `
            color:#fff; font-size:22px; font-weight:700;
            font-family:'Noto Sans TC',sans-serif;
            text-shadow: 0 2px 12px rgba(0,0,0,0.5);
            animation: scoreNameSlide 0.5s 0.15s ease-out both;
        `;

        // 大數字
        const bigNum = document.createElement('div');
        bigNum.textContent = `${isPositive ? '+' : ''}${delta}`;
        bigNum.style.cssText = `
            font-size: min(28vw, 140px);
            font-weight:900; line-height:1;
            color:${accentColor};
            text-shadow: 0 0 60px ${accentGlow}, 0 0 120px ${accentGlow}, 0 8px 32px rgba(0,0,0,0.4);
            font-family:'Inter','Noto Sans TC',sans-serif;
            font-variant-numeric:tabular-nums;
            animation: scoreNumIn 0.6s 0.1s cubic-bezier(0.34,1.56,0.64,1) both;
        `;

        // 星星列
        const starsRow = document.createElement('div');
        starsRow.style.cssText = 'display:flex; gap:8px; margin-top:4px;';
        for (let i = 0; i < 5; i++) {
            const s = document.createElement('span');
            s.className = 'material-symbols-outlined';
            s.textContent = 'star';
            const filled = i < absDelta;
            s.style.cssText = `
                font-size:36px;
                color: ${filled ? accentColor : 'rgba(255,255,255,0.12)'};
                ${filled ? `filter: drop-shadow(0 0 12px ${accentColor}); text-shadow: 0 0 20px ${accentGlow};` : ''}
                animation: ${filled ? `scoreStarPop 0.4s ${0.3 + i * 0.1}s cubic-bezier(0.34,1.56,0.64,1) both` : 'none'};
                ${!filled ? 'opacity:0.3;' : ''}
            `;
            starsRow.appendChild(s);
        }

        // 分數標題
        const ptsLabel = document.createElement('div');
        ptsLabel.textContent = '分';
        ptsLabel.style.cssText = `
            color:rgba(255,255,255,0.5); font-size:18px; font-weight:500;
            font-family:'Noto Sans TC',sans-serif;
            margin-top:-8px;
            animation: scoreLabelFade 0.4s 0.5s ease-out both;
        `;

        center.appendChild(label);
        center.appendChild(nameEl);
        center.appendChild(bigNum);
        center.appendChild(ptsLabel);
        center.appendChild(starsRow);
        overlay.appendChild(center);

        // ═══ 金色粒子爆發 ═══
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const particleCount = 20 + absDelta * 5;
        const shapes = ['star', 'circle', 'diamond'];

        for (let i = 0; i < particleCount; i++) {
            const p = document.createElement('div');
            const shape = shapes[i % 3];
            const size = 4 + Math.random() * 10;
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
            const dist = 100 + Math.random() * 400;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;

            if (shape === 'star') {
                p.className = 'material-symbols-outlined';
                p.textContent = 'star';
                p.style.cssText = `
                    position:fixed; left:${cx}px; top:${cy}px;
                    font-size:${size + 8}px; color:${accentColor};
                    filter:drop-shadow(0 0 4px ${accentColor});
                    pointer-events:none; z-index:100000;
                `;
            } else {
                p.style.cssText = `
                    position:fixed; left:${cx}px; top:${cy}px;
                    width:${size}px; height:${size}px;
                    background:${isPositive ? ['#fbbf24','#f59e0b','#d97706','#fcd34d','#fff7ed'][i%5] : ['#ef4444','#f87171','#fca5a5'][i%3]};
                    border-radius:${shape === 'circle' ? '50%' : '2px'};
                    ${shape === 'diamond' ? 'transform:rotate(45deg);' : ''}
                    pointer-events:none; z-index:100000;
                    box-shadow: 0 0 6px ${accentGlow};
                `;
            }
            overlay.appendChild(p);

            const delay = Math.random() * 250;
            setTimeout(() => {
                p.animate([
                    { transform: `translate(-50%,-50%) scale(0) rotate(0deg)`, opacity: 1 },
                    { transform: `translate(calc(-50% + ${dx*0.4}px), calc(-50% + ${dy*0.4}px)) scale(1.5) rotate(${(Math.random()-0.5)*360}deg)`, opacity: 1, offset: 0.3 },
                    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0) rotate(${(Math.random()-0.5)*720}deg)`, opacity: 0 }
                ], {
                    duration: 800 + Math.random() * 500,
                    easing: 'cubic-bezier(0.22,0.61,0.36,1)',
                    fill: 'forwards'
                });
            }, delay);
        }

        // ═══ 音效 ═══
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
                    g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + t + 0.03);
                    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
                    o.connect(g); g.connect(ctx.destination);
                    o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + dur);
                };
                if (isPositive) {
                    play(523, 0, 0.2); play(659, 0.08, 0.2); play(784, 0.16, 0.2); play(1047, 0.24, 0.4);
                } else {
                    play(440, 0, 0.3); play(370, 0.15, 0.4);
                }
            }
        } catch { /* silent */ }

        // ═══ 1.2 秒後淡出 ═══
        setTimeout(() => {
            overlay.animate([
                { opacity: 1, backdropFilter: 'blur(8px)' },
                { opacity: 0, backdropFilter: 'blur(0px)' }
            ], { duration: 400, fill: 'forwards' });
            setTimeout(() => overlay.remove(), 450);
        }, 1200);
    }
}
