/**
 * 課後問卷互動模組
 */
import { stateManager } from './stateManager.js';

export class SurveyGame {
    constructor() {
        this.defaultQuestions = [
            { id: 'q1', type: 'stars', text: '課程整體滿意度', max: 5 },
            { id: 'q2', type: 'stars', text: '講師教學表現', max: 5 },
            { id: 'q3', type: 'stars', text: '課程內容實用性', max: 5 },
            { id: 'q4', type: 'text', text: '這堂課最大的收穫是什麼？', placeholder: '請分享你印象最深刻的部分…' },
            { id: 'q5', type: 'text', text: '你覺得還想學哪些相關主題？', placeholder: '例如：AI 繪圖、自動化工具…' },
            { id: 'q6', type: 'text', text: '給講師的一句話或建議 💬', placeholder: '任何想說的話都可以！' },
        ];
    }

    /**
     * 在學員端渲染可填寫的問卷
     */
    async render(container, element) {
        const elementId = element.id;
        const questions = element.surveyQuestions || this.defaultQuestions;
        const title = element.surveyTitle || '📋 課程回饋問卷';

        // 檢查是否已填寫
        const existing = await stateManager.load(elementId);
        if (existing) {
            this._renderThankYou(container, title);
            return;
        }

        container.innerHTML = `
            <div class="survey-widget">
                <div class="survey-title">${title}</div>
                <div class="survey-subtitle">你的回饋是我們進步的動力 ✨</div>
                <div class="survey-questions">
                    ${questions.map((q, i) => this._renderQuestion(q, i)).join('')}
                </div>
                <button class="survey-submit-btn" disabled>
                    <span class="material-symbols-outlined">send</span>
                    提交問卷
                </button>
            </div>
        `;

        // 星星評分互動
        container.querySelectorAll('.survey-stars').forEach(starsEl => {
            const stars = starsEl.querySelectorAll('.survey-star');
            stars.forEach(star => {
                star.addEventListener('click', () => {
                    const val = parseInt(star.dataset.value);
                    starsEl.dataset.selected = val;
                    stars.forEach(s => {
                        s.classList.toggle('active', parseInt(s.dataset.value) <= val);
                    });
                    this._checkCanSubmit(container);
                });
            });
        });

        // 文字輸入監聽
        container.querySelectorAll('.survey-textarea').forEach(ta => {
            ta.addEventListener('input', () => this._checkCanSubmit(container));
        });

        // 提交
        container.querySelector('.survey-submit-btn')?.addEventListener('click', async () => {
            const btn = container.querySelector('.survey-submit-btn');
            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined survey-spin">progress_activity</span> 提交中…';

            const answers = {};
            questions.forEach((q, i) => {
                if (q.type === 'stars') {
                    const starsEl = container.querySelector(`[data-qid="${q.id}"]`);
                    answers[q.id] = {
                        question: q.text,
                        type: 'stars',
                        value: parseInt(starsEl?.dataset.selected || '0')
                    };
                } else {
                    const ta = container.querySelector(`#survey_${q.id}`);
                    answers[q.id] = {
                        question: q.text,
                        type: 'text',
                        value: ta?.value?.trim() || ''
                    };
                }
            });

            await stateManager.save(elementId, {
                type: 'survey',
                title: title,
                content: JSON.stringify(answers),
                isCorrect: null,
                score: null,
                points: 2,
                participated: true,
                state: { answers }
            });

            this._renderThankYou(container, title);
            stateManager.playSuccessFeedback(container);
        });
    }

    _renderQuestion(q, index) {
        if (q.type === 'stars') {
            return `
                <div class="survey-q">
                    <div class="survey-q-label">${index + 1}. ${q.text}</div>
                    <div class="survey-stars" data-qid="${q.id}" data-selected="0">
                        ${Array.from({ length: q.max }, (_, i) => `
                            <span class="survey-star" data-value="${i + 1}">★</span>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        return `
            <div class="survey-q">
                <div class="survey-q-label">${index + 1}. ${q.text}</div>
                <textarea class="survey-textarea" id="survey_${q.id}" placeholder="${q.placeholder || ''}" rows="2"></textarea>
            </div>
        `;
    }

    _checkCanSubmit(container) {
        const starsEls = container.querySelectorAll('.survey-stars');
        let allStarsSelected = true;
        starsEls.forEach(el => {
            if (parseInt(el.dataset.selected || '0') === 0) allStarsSelected = false;
        });
        const btn = container.querySelector('.survey-submit-btn');
        if (btn) btn.disabled = !allStarsSelected;
    }

    _renderThankYou(container, title) {
        container.innerHTML = `
            <div class="survey-widget survey-done">
                <div class="survey-done-icon">🎉</div>
                <div class="survey-done-title">感謝你的回饋！</div>
                <div class="survey-done-text">你的意見對我們非常重要，<br>祝你學習愉快！</div>
            </div>
        `;
    }

    /**
     * 編輯器預覽
     */
    renderPreview(container, element) {
        const title = element.surveyTitle || '📋 課程回饋問卷';
        const questions = element.surveyQuestions || this.defaultQuestions;
        container.innerHTML = `
            <div class="survey-widget survey-preview">
                <div class="survey-title">${title}</div>
                <div class="survey-subtitle">你的回饋是我們進步的動力 ✨</div>
                <div class="survey-questions">
                    ${questions.slice(0, 3).map((q, i) => `
                        <div class="survey-q">
                            <div class="survey-q-label">${i + 1}. ${q.text}</div>
                            ${q.type === 'stars' ? `
                                <div class="survey-stars-preview">
                                    ${'★'.repeat(q.max)}
                                </div>
                            ` : `
                                <div class="survey-textarea-preview">${q.placeholder || ''}</div>
                            `}
                        </div>
                    `).join('')}
                    <div class="survey-more">+${questions.length - 3} 題…</div>
                </div>
            </div>
        `;
    }
}
