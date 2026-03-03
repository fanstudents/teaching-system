/**
 * 搶答互動模組（文字輸入 + 已被搶答偵測 + 重新作答）
 * 使用 Material Symbols 圖示，不使用 emoji
 */
import { stateManager } from './stateManager.js';
import { db } from '../supabase.js';

export class BuzzerGame {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        document.querySelectorAll('.buzzer-container').forEach(c => {
            if (!c.dataset._bzReady) { c.dataset._bzReady = '1'; this.setupContainer(c); }
        });
    }

    async setupContainer(container) {
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        let pressed = false;

        // 重新建構 UI
        const question = container.querySelector('.buzzer-question');
        container.innerHTML = '';
        if (question) container.appendChild(question);

        // 輸入區域
        const inputRow = document.createElement('div');
        inputRow.className = 'buzzer-input-row';
        inputRow.innerHTML = `
            <input type="text" class="buzzer-text-input" placeholder="輸入你的答案..." />
            <button class="buzzer-submit-btn">
                <span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle;">campaign</span>
                搶答
            </button>
        `;
        container.appendChild(inputRow);

        // 狀態提示區
        const statusEl = document.createElement('div');
        statusEl.className = 'buzzer-status';
        container.appendChild(statusEl);

        const resultEl = document.createElement('div');
        resultEl.className = 'buzzer-result';
        container.appendChild(resultEl);

        const rankEl = document.createElement('div');
        rankEl.className = 'buzzer-ranking';
        container.appendChild(rankEl);

        // 重新作答按鈕
        const resetBtn = document.createElement('button');
        resetBtn.className = 'interactive-reset-btn';
        resetBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>重新作答';
        container.style.position = 'relative';
        container.appendChild(resetBtn);

        const textInput = container.querySelector('.buzzer-text-input');
        const submitBtn = container.querySelector('.buzzer-submit-btn');

        const showPressed = (text) => {
            pressed = true;
            if (textInput) { textInput.value = text; textInput.disabled = true; }
            if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('pressed'); }
            resultEl.className = 'buzzer-result success';
            resultEl.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;color:#22c55e;">check_circle</span> 已搶答';
            resetBtn.classList.add('visible');
        };

        const showClaimed = (firstPerson) => {
            pressed = true;
            if (textInput) textInput.disabled = true;
            if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('pressed'); }
            statusEl.className = 'buzzer-status claimed';
            statusEl.innerHTML = `
                <span class="material-symbols-outlined" style="font-size:20px;">lock</span>
                <span>已被搶答 — ${this.escHtml(firstPerson)}</span>
            `;
            inputRow.style.opacity = '0.5';
            inputRow.style.pointerEvents = 'none';
        };

        const resetUI = () => {
            pressed = false;
            if (textInput) { textInput.value = ''; textInput.disabled = false; }
            if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('pressed'); }
            resultEl.className = 'buzzer-result';
            resultEl.textContent = '';
            statusEl.className = 'buzzer-status';
            statusEl.innerHTML = '';
            inputRow.style.opacity = '1';
            inputRow.style.pointerEvents = 'auto';
            resetBtn.classList.remove('visible');
        };

        // 檢查是否已被搶答
        const myPrev = elementId ? await stateManager.load(elementId) : null;
        if (myPrev?.state?.pressed) {
            showPressed(myPrev.state.answer || '');
            this.loadRanking(elementId, rankEl);
        } else if (elementId) {
            // 查看是否已被其他人搶答
            const firstPerson = await this.checkClaimed(elementId);
            if (firstPerson) {
                showClaimed(firstPerson);
                this.loadRanking(elementId, rankEl);
            }
        }

        // 搶答送出
        submitBtn?.addEventListener('click', async () => {
            if (pressed) return;
            const answer = textInput?.value?.trim();
            if (!answer) { textInput?.focus(); return; }

            // 再次確認是否已被搶答
            const firstPerson = await this.checkClaimed(elementId);
            if (firstPerson) {
                showClaimed(firstPerson);
                this.loadRanking(elementId, rankEl);
                return;
            }

            const timestamp = new Date().toISOString();
            showPressed(answer);

            const title = container.querySelector('.buzzer-question')?.textContent || '搶答';
            const points = parseInt(container.closest('[data-points]')?.dataset.points) || 10;
            const _r = await stateManager.save(elementId, {
                type: 'buzzer', title, content: answer,
                isCorrect: null, score: null, points, participated: true,
                state: { pressed: true, answer, timestamp },
            });
            if (_r?.isRetry) stateManager.showRetryBanner(container);
            setTimeout(() => this.loadRanking(elementId, rankEl), 500);
        });

        // Enter 送出
        textInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitBtn?.click();
        });

        // 重新作答
        resetBtn.addEventListener('click', async () => {
            resetUI();
            if (elementId) await stateManager.clear(elementId);
        });

        // 定期刷新排行 + 搶答狀態
        if (elementId) {
            setInterval(async () => {
                if (pressed) { this.loadRanking(elementId, rankEl); return; }
                const firstPerson = await this.checkClaimed(elementId);
                if (firstPerson) {
                    showClaimed(firstPerson);
                    this.loadRanking(elementId, rankEl);
                }
            }, 3000);
        }
    }

    async checkClaimed(elementId) {
        try {
            const { data } = await db.select('submissions', {
                filter: { element_id: 'eq.' + elementId },
                order: 'created_at.asc',
                limit: 1,
            });
            if (data?.length) {
                return data[0].student_name || data[0].student_email?.split('@')[0] || '某位學員';
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    async loadRanking(elementId, rankEl) {
        if (!rankEl) return;
        try {
            const { data } = await db.select('submissions', {
                filter: { element_id: 'eq.' + elementId },
                order: 'created_at.asc',
                limit: 10,
            });
            if (!data || !data.length) { rankEl.innerHTML = ''; return; }
            rankEl.innerHTML = `
                <div class="buzzer-rank-title">
                    <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">trophy</span>
                    搶答排行
                </div>` +
                data.map((s, i) => {
                    const medal = i === 0 ? '<span class="buzzer-medal gold">1</span>'
                        : i === 1 ? '<span class="buzzer-medal silver">2</span>'
                            : i === 2 ? '<span class="buzzer-medal bronze">3</span>'
                                : `<span class="buzzer-medal">${i + 1}</span>`;
                    const name = s.student_name || s.student_email?.split('@')[0] || '?';
                    const answer = s.content ? s.content : '';
                    return `<div class="buzzer-rank-item">${medal}<span class="buzzer-rank-name">${this.escHtml(name)}</span><span class="buzzer-rank-answer">${this.escHtml(answer)}</span></div>`;
                }).join('');
        } catch (e) {
            console.warn('buzzer ranking error:', e);
        }
    }

    escHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
