/**
 * 填空題互動模組（含狀態持久化）
 */
import { stateManager } from './stateManager.js';

export class FillBlank {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 監聽投影片渲染完成事件
        window.addEventListener('slideRendered', () => {
            this.init();
        });

        // 事件代理
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('fill-blank-check-btn')) {
                const container = e.target.closest('.fill-blank-container');
                if (container) {
                    this.checkAnswers(container);
                }
            }
        });
    }

    init() {
        // 找到所有填空題元件
        const containers = document.querySelectorAll('.fill-blank-container');
        containers.forEach(container => {
            this.setupContainer(container);
        });
    }

    async setupContainer(container) {
        const inputs = container.querySelectorAll('.fill-blank-input');
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';

        // ── 載入歷史狀態 ──
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev && prev.state && prev.state.answers) {
                const answers = prev.state.answers;
                inputs.forEach((input, i) => {
                    // 用新元素替換舊元素以清除所有事件監聽
                    const newInput = input.cloneNode(true);
                    input.parentNode.replaceChild(newInput, input);

                    if (answers[i] != null) {
                        newInput.value = answers[i];
                        // 檢查答案並標記
                        const answer = newInput.dataset.answer.toLowerCase().trim();
                        const userAnswer = answers[i].toLowerCase().trim();
                        if (userAnswer === answer) {
                            newInput.classList.add('correct');
                        } else {
                            newInput.classList.add('incorrect');
                        }
                    }
                });

                // 顯示結果
                const result = container.querySelector('.fill-blank-result');
                if (result && prev.state.correct != null) {
                    const correct = prev.state.correct;
                    const total = prev.state.total;
                    if (correct === total) {
                        result.textContent = `🎉 太棒了！全部答對！`;
                        result.className = 'fill-blank-result success';
                    } else {
                        result.textContent = `答對 ${correct}/${total} 題，再試試看！`;
                        result.className = 'fill-blank-result error';
                    }
                }
                return; // 已有歷史，不再重新綁定
            }
        }

        inputs.forEach(input => {
            // 用新元素替換舊元素以清除所有事件監聯
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);

            // 清除狀態
            newInput.classList.remove('correct', 'incorrect');
            newInput.value = '';

            // IME 合成狀態追蹤（防止中文輸入重複）
            let isComposing = false;

            newInput.addEventListener('compositionstart', () => {
                isComposing = true;
            });

            newInput.addEventListener('compositionend', () => {
                isComposing = false;
                // compositionend 後才清除狀態
                newInput.classList.remove('correct', 'incorrect');
            });

            // 輸入時清除狀態（非 IME 合成中才處理）
            newInput.addEventListener('input', () => {
                if (!isComposing) {
                    newInput.classList.remove('correct', 'incorrect');
                }
            });

            // Enter 鍵檢查
            newInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !isComposing) {
                    e.preventDefault();
                    this.checkSingleInput(newInput);

                    // 跳到下一個輸入框
                    const nextInput = container.querySelector(
                        `.fill-blank-input[data-index="${parseInt(newInput.dataset.index) + 1}"]`
                    );
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            });
        });

        // 重置結果
        const result = container.querySelector('.fill-blank-result');
        if (result) {
            result.textContent = '';
            result.className = 'fill-blank-result';
        }
    }

    /**
     * 檢查單個輸入
     */
    checkSingleInput(input) {
        const answer = input.dataset.answer.toLowerCase().trim();
        const userAnswer = input.value.toLowerCase().trim();

        if (userAnswer === answer) {
            input.classList.remove('incorrect');
            input.classList.add('correct');
            return true;
        } else {
            input.classList.remove('correct');
            input.classList.add('incorrect');
            return false;
        }
    }

    /**
     * 檢查所有答案
     */
    checkAnswers(container) {
        const inputs = container.querySelectorAll('.fill-blank-input');
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        let correct = 0;
        let total = inputs.length;
        const answers = [];

        inputs.forEach(input => {
            answers.push(input.value);
            if (this.checkSingleInput(input)) {
                correct++;
            }
        });

        // 顯示結果
        const result = container.querySelector('.fill-blank-result');
        if (result) {
            if (correct === total) {
                result.textContent = `🎉 太棒了！全部答對！`;
                result.className = 'fill-blank-result success animate-bounce';
            } else {
                result.textContent = `答對 ${correct}/${total} 題，再試試看！`;
                result.className = 'fill-blank-result error';
            }
        }

        this.reportScore(elementId, correct, total, answers);
        return { correct, total };
    }

    /**
     * 回報成績 — 透過 stateManager
     */
    async reportScore(elementId, correct, total, answers) {
        const el = document.querySelector(`[data-id="${elementId}"]`);
        const points = parseInt(el?.dataset.points) || 10;
        await stateManager.save(elementId, {
            type: 'fillblank',
            title: '填空題',
            content: `${correct}/${total}`,
            isCorrect: correct === total,
            score: Math.round((correct / total) * 100),
            points,
            state: { answers, correct, total },
        });
        // 填空題成績已回報
    }

    /**
     * 重置填空題
     */
    reset(container) {
        const inputs = container.querySelectorAll('.fill-blank-input');
        inputs.forEach(input => {
            input.value = '';
            input.classList.remove('correct', 'incorrect');
        });

        const result = container.querySelector('.fill-blank-result');
        if (result) {
            result.textContent = '';
            result.className = 'fill-blank-result';
        }
    }

    /**
     * 顯示答案
     */
    showAnswers(container) {
        const inputs = container.querySelectorAll('.fill-blank-input');
        inputs.forEach(input => {
            input.value = input.dataset.answer;
            input.classList.add('correct');
        });
    }
}
