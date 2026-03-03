/**
 * 是非題互動模組
 * - 學員：作答後顯示「已作答」，等講師公布才揭曉
 * - 講師（簡報模式）：「公布答案」按鈕，按下後揭曉 + 統計
 */
import { stateManager } from './stateManager.js';
import { db } from '../supabase.js';

export class TrueFalseGame {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        document.querySelectorAll('.truefalse-container').forEach(c => {
            if (!c.dataset._tfReady) { c.dataset._tfReady = '1'; this.setupContainer(c); }
        });
    }

    async setupContainer(container) {
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        const correctAnswer = container.dataset.answer === 'true';
        let answered = false;
        let revealed = false;
        let chosenValue = null;

        // 判斷是否為講師（簡報模式）
        const isPresenter = !!container.closest('.presentation-slide');

        // 重新作答按鈕
        const resetBtn = document.createElement('button');
        resetBtn.className = 'interactive-reset-btn';
        resetBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>重新作答';
        container.style.position = 'relative';
        container.appendChild(resetBtn);

        // 統計區（使用已有的 tf-stats-area）
        const statsArea = container.querySelector('.tf-stats-area');

        // 公布答案區（使用已有的 tf-reveal-area）
        const revealArea = container.querySelector('.tf-reveal-area');

        const resetUI = () => {
            answered = false;
            revealed = false;
            chosenValue = null;
            container.querySelectorAll('.tf-btn').forEach(b => {
                b.classList.remove('selected', 'correct', 'wrong', 'tf-waiting');
                b.disabled = false;
            });
            const resultEl = container.querySelector('.tf-result');
            if (resultEl) { resultEl.className = 'tf-result'; resultEl.textContent = ''; }
            if (statsArea) statsArea.innerHTML = '';
            if (revealArea) revealArea.innerHTML = '';
            resetBtn.classList.remove('visible');
        };

        // 學員作答：只標記選擇，不揭曉答案
        const markChosen = (chosen) => {
            answered = true;
            chosenValue = chosen;
            const btnTrue = container.querySelector('.tf-btn-true');
            const btnFalse = container.querySelector('.tf-btn-false');
            if (chosen) {
                btnTrue?.classList.add('selected', 'tf-waiting');
            } else {
                btnFalse?.classList.add('selected', 'tf-waiting');
            }
            // 禁用按鈕
            container.querySelectorAll('.tf-btn').forEach(b => b.disabled = true);

            const resultEl = container.querySelector('.tf-result');
            if (resultEl && !isPresenter) {
                resultEl.className = 'tf-result tf-pending';
                resultEl.textContent = '✓ 已作答，等待講師公布答案';
            }
            resetBtn.classList.add('visible');
        };

        // 公布答案：揭曉正確/錯誤 + 統計
        const revealAnswer = () => {
            revealed = true;
            const btnTrue = container.querySelector('.tf-btn-true');
            const btnFalse = container.querySelector('.tf-btn-false');
            const resultEl = container.querySelector('.tf-result');

            // 移除等待狀態
            container.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('tf-waiting'));

            // 標記正確答案
            if (correctAnswer) btnTrue?.classList.add('correct');
            else btnFalse?.classList.add('correct');

            // 如果學員已作答，標記對錯
            if (answered && chosenValue !== null) {
                const isCorrect = chosenValue === correctAnswer;
                if (!isCorrect) {
                    if (chosenValue) btnTrue?.classList.add('wrong');
                    else btnFalse?.classList.add('wrong');
                }
                if (resultEl) {
                    resultEl.className = 'tf-result ' + (isCorrect ? 'success' : 'error');
                    resultEl.textContent = isCorrect ? '✓ 回答正確！' : '✗ 答案是' + (correctAnswer ? '「對」' : '「錯」');
                }
            } else if (resultEl) {
                resultEl.className = 'tf-result tf-revealed';
                resultEl.textContent = '正確答案：' + (correctAnswer ? '對 ✓' : '錯 ✗');
            }

            // 隱藏公布按鈕
            if (revealArea) revealArea.innerHTML = '';

            // 載入統計
            this.loadStats(elementId, statsArea);
        };

        // 講師模式：顯示公布答案按鈕
        if (isPresenter && revealArea) {
            const revealBtn = document.createElement('button');
            revealBtn.className = 'tf-reveal-btn';
            revealBtn.innerHTML = '<span class="material-symbols-outlined">visibility</span> 公布答案';
            revealBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                revealAnswer();
                // 廣播公布事件
                if (window.app?.broadcasting && window.app?.sessionCode) {
                    import('../supabase.js').then(({ realtime }) => {
                        realtime.publish(`session:${window.app.sessionCode}`, 'truefalse_reveal', {
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
                realtime.on('truefalse_reveal', (msg) => {
                    const p = msg.payload || msg;
                    if (p.elementId === elementId && !revealed) {
                        revealAnswer();
                    }
                });
            } catch (e) { /* no realtime */ }
        }

        // 載入歷史
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev?.state?.chosen !== undefined) {
                markChosen(prev.state.chosen);
                // 如有歷史且已公布，直接揭曉
                if (prev.state.revealed) revealAnswer();
            }
        }

        // 按鈕事件
        container.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (answered) return;
                const chosen = btn.classList.contains('tf-btn-true');
                markChosen(chosen);
                const title = container.querySelector('.tf-question')?.textContent || '是非題';
                const points = parseInt(container.closest('[data-points]')?.dataset.points) || 5;
                await stateManager.save(elementId, {
                    type: 'truefalse', title,
                    content: chosen ? '對' : '錯',
                    isCorrect: chosen === correctAnswer,
                    score: chosen === correctAnswer ? 100 : 0,
                    points,
                    state: { chosen },
                });

                // 講師模式下，作答後仍等講師公布
                // 不自動揭曉
            });
        });

        // 重新作答
        resetBtn.addEventListener('click', async () => {
            resetUI();
            // 講師模式重新顯示公布按鈕
            if (isPresenter && revealArea) {
                const revealBtn = document.createElement('button');
                revealBtn.className = 'tf-reveal-btn';
                revealBtn.innerHTML = '<span class="material-symbols-outlined">visibility</span> 公布答案';
                revealBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    revealAnswer();
                });
                revealArea.appendChild(revealBtn);
            }
            if (elementId) await stateManager.clear(elementId);
        });
    }

    async loadStats(elementId, statsEl) {
        if (!elementId || !statsEl) return;
        try {
            const { data } = await db.select('submissions', {
                filter: { element_id: 'eq.' + elementId },
                select: 'is_correct',
            });
            let total, correct;
            if (data && data.length) {
                total = data.length;
                correct = data.filter(s => s.is_correct === true).length;
            } else {
                const localCorrect = statsEl.closest('.truefalse-container')?.querySelector('.tf-btn.correct.selected');
                total = 1;
                correct = localCorrect ? 1 : 0;
            }
            const pct = Math.round((correct / total) * 100);
            const wrongPct = 100 - pct;
            statsEl.innerHTML = `
                <div class="tf-stats-grid">
                    <div class="tf-stat-item tf-stat-correct">
                        <div class="tf-stat-value">${pct}%</div>
                        <div class="tf-stat-label">答對</div>
                        <div class="tf-stat-bar"><div class="tf-stat-fill correct" style="width:${pct}%"></div></div>
                    </div>
                    <div class="tf-stat-item tf-stat-wrong">
                        <div class="tf-stat-value">${wrongPct}%</div>
                        <div class="tf-stat-label">答錯</div>
                        <div class="tf-stat-bar"><div class="tf-stat-fill wrong" style="width:${wrongPct}%"></div></div>
                    </div>
                </div>
                <div class="tf-stat-total">${total} 人作答</div>
            `;
        } catch (e) {
            console.warn('truefalse stats error:', e);
        }
    }
}
