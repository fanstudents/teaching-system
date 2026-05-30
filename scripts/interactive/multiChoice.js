/**
 * 多選一投票互動模組
 * - 學員：選擇一個選項後顯示「已投票，等待公布結果」
 * - 講師（簡報模式）：「公布結果」按鈕，按下後揭曉各選項投票百分比
 * - 無正確答案（純投票，非測驗）
 */
import { stateManager } from './stateManager.js';
import { db } from '../supabase.js';

export class MultiChoiceGame {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        document.querySelectorAll('.multichoice-container').forEach(c => {
            if (!c.dataset._mcReady) { c.dataset._mcReady = '1'; this.setupContainer(c); }
        });
    }

    async setupContainer(container) {
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        let answered = false;
        let revealed = false;
        let chosenIndex = null;

        // 判斷是否為講師（簡報模式）
        const isPresenter = !!container.closest('.presentation-slide');

        // 重新作答按鈕（僅講師端）
        const resetBtn = document.createElement('button');
        resetBtn.className = 'interactive-reset-btn';
        resetBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>重新投票';
        container.style.position = 'relative';
        if (isPresenter) container.appendChild(resetBtn);

        // 統計區
        const statsArea = container.querySelector('.mc-stats-area');
        // 公布結果區
        const revealArea = container.querySelector('.mc-reveal-area');
        const resultEl = container.querySelector('.mc-result');

        const resetUI = () => {
            answered = false;
            revealed = false;
            chosenIndex = null;
            container.querySelectorAll('.mc-choice-btn').forEach(b => {
                b.classList.remove('selected');
                b.disabled = false;
            });
            if (resultEl) { resultEl.className = 'mc-result'; resultEl.textContent = ''; }
            if (statsArea) statsArea.innerHTML = '';
            if (revealArea) revealArea.innerHTML = '';
            resetBtn.classList.remove('visible');
        };

        // 學員投票：標記選擇
        const markChosen = (index) => {
            answered = true;
            chosenIndex = index;
            container.querySelectorAll('.mc-choice-btn').forEach((b, i) => {
                if (i === index) b.classList.add('selected');
                b.disabled = true;
            });
            if (resultEl && !isPresenter) {
                resultEl.className = 'mc-result mc-pending';
                resultEl.textContent = '✓ 已投票，等待公布結果';
            }
            resetBtn.classList.add('visible');
        };

        // 公布結果：顯示投票百分比
        const revealResults = () => {
            revealed = true;
            if (revealArea) revealArea.innerHTML = '';
            this.loadStats(elementId, statsArea, container);
        };

        // 講師模式：顯示公布結果按鈕
        if (isPresenter && revealArea) {
            const revealBtn = document.createElement('button');
            revealBtn.className = 'mc-reveal-btn';
            revealBtn.innerHTML = '<span class="material-symbols-outlined">visibility</span> 公布結果';
            revealBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                revealResults();
                // 廣播公布事件
                if (window.app?.broadcasting && window.app?.sessionCode) {
                    import('../supabase.js').then(({ realtime }) => {
                        realtime.publish(`session:${window.app.sessionCode}`, 'multichoice_reveal', {
                            elementId
                        });
                    });
                }
            });
            revealArea.appendChild(revealBtn);
        }

        // 監聽講師公布事件（學員端）
        if (!isPresenter) {
            try {
                const { realtime } = await import('../supabase.js');
                realtime.on('multichoice_reveal', (msg) => {
                    const p = msg.payload || msg;
                    if (p.elementId === elementId && !revealed) {
                        revealResults();
                    }
                });
            } catch (e) { /* no realtime */ }
        }

        // ★ 綁定按鈕事件
        container.querySelectorAll('.mc-choice-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (answered) return;
                const index = parseInt(btn.dataset.index);
                markChosen(index);
                const title = container.querySelector('.mc-question')?.textContent || '多選一';
                const points = parseInt(container.closest('[data-points]')?.dataset.points) || 1;
                const chosenLabel = btn.textContent;
                const _r = await stateManager.save(elementId, {
                    type: 'multiChoice', title,
                    content: chosenLabel,
                    isCorrect: true, // 投票無對錯
                    score: 100,
                    points,
                    speedBonus: false,
                    state: { chosenIndex: index, chosenLabel },
                });
                if (_r?.isRetry) stateManager.showRetryBanner(container);
            });
        });

        // 載入歷史（非阻塞）
        if (elementId) {
            try {
                const prev = await stateManager.load(elementId);
                if (prev?.state?.chosenIndex !== undefined) {
                    markChosen(prev.state.chosenIndex);
                    if (prev.state.revealed) revealResults();
                }
            } catch (e) {
                console.warn('[multiChoice] load history failed:', e);
            }
        }

        // 重新投票
        resetBtn.addEventListener('click', async () => {
            resetUI();
            if (isPresenter && revealArea) {
                const revealBtn = document.createElement('button');
                revealBtn.className = 'mc-reveal-btn';
                revealBtn.innerHTML = '<span class="material-symbols-outlined">visibility</span> 公布結果';
                revealBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    revealResults();
                });
                revealArea.appendChild(revealBtn);
            }
            if (elementId) await stateManager.clear(elementId);
        });
    }

    async loadStats(elementId, statsEl, container) {
        if (!elementId || !statsEl) return;

        // 從按鈕取得選項文字
        const choices = [];
        container.querySelectorAll('.mc-choice-btn').forEach(b => {
            choices.push(b.textContent.trim());
        });

        const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b'];

        try {
            const { data } = await db.select('submissions', {
                filter: { element_id: 'eq.' + elementId },
                select: 'state',
            });

            // 統計各選項票數
            const counts = new Array(choices.length).fill(0);
            let total = 0;

            if (data && data.length) {
                data.forEach(s => {
                    const state = typeof s.state === 'string' ? JSON.parse(s.state) : s.state;
                    const idx = state?.chosenIndex;
                    if (idx !== undefined && idx >= 0 && idx < choices.length) {
                        counts[idx]++;
                        total++;
                    }
                });
            }

            // 如果沒有 DB 資料，至少算上本地的投票
            if (total === 0) {
                const selectedBtn = container.querySelector('.mc-choice-btn.selected');
                if (selectedBtn) {
                    const idx = parseInt(selectedBtn.dataset.index);
                    counts[idx] = 1;
                    total = 1;
                }
            }

            statsEl.innerHTML = `
                <div class="mc-stats-grid">
                    ${choices.map((label, i) => {
                        const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
                        const color = colors[i] || '#94a3b8';
                        return `
                            <div class="mc-stat-item">
                                <div class="mc-stat-header">
                                    <span class="mc-stat-label" style="color:${color};">${label}</span>
                                    <span class="mc-stat-value">${pct}%</span>
                                </div>
                                <div class="mc-stat-bar">
                                    <div class="mc-stat-fill" style="width:${pct}%;background:${color};"></div>
                                </div>
                                <div class="mc-stat-count">${counts[i]} 票</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="mc-stat-total">${total} 人投票</div>
            `;
        } catch (e) {
            console.warn('multiChoice stats error:', e);
        }
    }
}
