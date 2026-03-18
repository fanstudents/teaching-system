/**
 * 選擇題互動模組 — 單選 / 多選（含狀態持久化）
 */
import { stateManager } from './stateManager.js';

export class QuizGame {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        document.querySelectorAll('.quiz-container').forEach(c => this.setupContainer(c));
    }

    async setupContainer(container) {
        const optionEls = container.querySelectorAll('.quiz-option');
        const isMultiple = container.dataset.multiple === 'true';
        const submitBtn = container.querySelector('.quiz-submit');
        const resultEl = container.querySelector('.quiz-result');
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';

        let answered = false;

        // ── 載入歷史狀態 ──
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev && prev.state && prev.state.selected) {
                answered = true;
                // 還原選擇
                const selected = prev.state.selected;
                optionEls.forEach((opt, i) => {
                    if (selected.includes(i)) {
                        opt.classList.add('selected');
                    }
                });
                // 揭曉答案
                this.revealAnswers(container, optionEls, resultEl, true);
                return; // 已答題，不再綁定事件
            }
        }

        if (!isMultiple) {
            // ── 單選：點擊即作答 ──
            optionEls.forEach(opt => {
                opt.addEventListener('click', () => {
                    if (answered) return;

                    // 清除先前選擇
                    optionEls.forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');

                    // 延遲一下再揭曉（讓使用者看到自己選了什麼）
                    setTimeout(() => {
                        answered = true;
                        this.revealAnswers(container, optionEls, resultEl);
                    }, 300);
                });
            });
        } else {
            // ── 多選：toggle 後按提交 ──
            optionEls.forEach(opt => {
                opt.addEventListener('click', () => {
                    if (answered) return;
                    opt.classList.toggle('selected');
                });
            });

            if (submitBtn) {
                submitBtn.addEventListener('click', () => {
                    if (answered) return;
                    const selected = container.querySelectorAll('.quiz-option.selected');
                    if (selected.length === 0) return;
                    answered = true;
                    submitBtn.disabled = true;
                    this.revealAnswers(container, optionEls, resultEl);
                });
            }
        }

        // ── 重試按鈕 ──
        const retryBtn = container.querySelector('.quiz-retry');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                answered = false;
                optionEls.forEach(o => o.classList.remove('selected', 'correct-answer', 'wrong-answer', 'missed-answer'));
                if (resultEl) { resultEl.className = 'quiz-result'; resultEl.textContent = ''; }
                if (submitBtn) submitBtn.disabled = false;
                retryBtn.style.display = 'none';
            });
        }
    }

    revealAnswers(container, optionEls, resultEl, isRestore = false) {
        let correct = 0;
        let totalCorrect = 0;
        let wrong = 0;
        const selectedIndices = [];

        optionEls.forEach((opt, i) => {
            const isAnswer = opt.dataset.correct === 'true';
            const isSelected = opt.classList.contains('selected');

            if (isAnswer) totalCorrect++;

            if (isSelected) selectedIndices.push(i);

            if (isSelected && isAnswer) {
                opt.classList.add('correct-answer');
                correct++;
            } else if (isSelected && !isAnswer) {
                opt.classList.add('wrong-answer');
                wrong++;
            } else if (!isSelected && isAnswer) {
                opt.classList.add('missed-answer');
            }
        });

        const allCorrect = correct === totalCorrect && wrong === 0;

        if (resultEl) {
            if (allCorrect) {
                resultEl.className = 'quiz-result success';
                resultEl.textContent = '✓ 回答正確！';
                try { navigator.vibrate?.([100, 50, 100]); } catch(_) {} // 震動回饋
            } else {
                resultEl.className = 'quiz-result error';
                resultEl.textContent = `✗ ${correct}/${totalCorrect} 正確`;
                try { navigator.vibrate?.(200); } catch(_) {} // 短震動
            }
        }

        // 顯示重試按鈕
        const retryBtn = container.querySelector('.quiz-retry');
        if (retryBtn) retryBtn.style.display = 'inline-flex';

        // 回報成績（還原時不重複寫入）
        if (!isRestore) {
            this.reportScore(container, correct, totalCorrect, selectedIndices, allCorrect);
        }
    }

    reset(container) {
        const optionEls = container.querySelectorAll('.quiz-option');
        optionEls.forEach(o => o.classList.remove('selected', 'correct-answer', 'wrong-answer', 'missed-answer'));
        const resultEl = container.querySelector('.quiz-result');
        if (resultEl) { resultEl.className = 'quiz-result'; resultEl.textContent = ''; }
        const retryBtn = container.querySelector('.quiz-retry');
        if (retryBtn) retryBtn.style.display = 'none';
        const submitBtn = container.querySelector('.quiz-submit');
        if (submitBtn) submitBtn.disabled = false;
    }

    async reportScore(container, correct, total, selectedIndices, allCorrect) {
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        const title = container.querySelector('.quiz-question')?.textContent || '選擇題';
        const points = parseInt(container.closest('[data-points]')?.dataset.points) || 5;

        const result = await stateManager.save(elementId, {
            type: 'quiz',
            title,
            content: `${correct}/${total}`,
            isCorrect: allCorrect,
            score: Math.round((correct / total) * 100),
            points,
            state: { selected: selectedIndices, correct: allCorrect },
        });
        if (result?.isRetry) {
            stateManager.showRetryBanner(container);
        }
    }
}
