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
    async render(container, element, prefill = null) {
        const elementId = element.id;
        const questions = element.surveyQuestions || this.defaultQuestions;
        const title = element.surveyTitle || '📋 課程回饋問卷';

        // 檢查是否已填寫（有 prefill 時跳過，代表是返回編輯）
        if (!prefill) {
            const existing = await stateManager.load(elementId);
            if (existing) {
                this._renderThankYou(container, element, existing?.state?.answers);
                return;
            }
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
                    ${prefill ? '更新問卷' : '提交問卷'}
                </button>
            </div>
        `;

        // 星星評分互動
        container.querySelectorAll('.survey-stars').forEach(starsEl => {
            const qid = starsEl.dataset.qid;
            const stars = starsEl.querySelectorAll('.survey-star');
            // prefill stars
            if (prefill?.[qid]?.value) {
                const pv = prefill[qid].value;
                starsEl.dataset.selected = pv;
                stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= pv));
            }
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

        // 文字輸入監聽 + prefill
        container.querySelectorAll('.survey-textarea').forEach(ta => {
            const qid = ta.id.replace('survey_', '');
            if (prefill?.[qid]?.value) ta.value = prefill[qid].value;
            ta.addEventListener('input', () => this._checkCanSubmit(container));
        });

        // 如果有 prefill，重新檢查 submit 按鈕狀態
        if (prefill) this._checkCanSubmit(container);

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

            this._renderThankYou(container, element, answers);
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

    _renderThankYou(container, element, savedAnswers) {
        const title = element.surveyTitle || '📋 課程回饋問卷';
        container.innerHTML = `
            <div class="survey-widget survey-done" style="max-width:480px;margin:0 auto;">
                <!-- 感謝標題 -->
                <div style="text-align:center;margin-bottom:20px;">
                    <div style="font-size:48px;margin-bottom:8px;">🎉</div>
                    <div style="font-size:20px;font-weight:700;color:#f1f5f9;">感謝你的回饋！</div>
                    <div style="font-size:13px;color:#94a3b8;margin-top:4px;">你的意見是我們進步的動力</div>
                </div>

                <!-- 修完這堂課之後… -->
                <div style="font-size:14px;font-weight:600;color:#cbd5e1;margin-bottom:12px;text-align:center;">✨ 修完這堂課，你還可以…</div>

                <!-- CTA 卡片 -->
                <a href="https://tbr.digital" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);border-radius:12px;margin-bottom:10px;text-decoration:none;transition:all 0.2s;" onmouseover="this.style.background='rgba(99,102,241,0.2)'" onmouseout="this.style.background='rgba(99,102,241,0.12)'">
                    <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <span class="material-symbols-outlined" style="color:#fff;font-size:20px;">school</span>
                    </div>
                    <div>
                        <div style="font-size:14px;font-weight:600;color:#e2e8f0;">數位簡報室・更多課程</div>
                        <div style="font-size:12px;color:#94a3b8;">探索更多數位工具與 AI 應用課程</div>
                    </div>
                    <span class="material-symbols-outlined" style="margin-left:auto;color:#6366f1;font-size:18px;">arrow_forward</span>
                </a>

                <a href="https://tbr.digital/consulting" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.2);border-radius:12px;margin-bottom:10px;text-decoration:none;transition:all 0.2s;" onmouseover="this.style.background='rgba(234,179,8,0.18)'" onmouseout="this.style.background='rgba(234,179,8,0.1)'">
                    <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#eab308,#f59e0b);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <span class="material-symbols-outlined" style="color:#fff;font-size:20px;">handshake</span>
                    </div>
                    <div>
                        <div style="font-size:14px;font-weight:600;color:#e2e8f0;">企業顧問服務</div>
                        <div style="font-size:12px;color:#94a3b8;">內部培訓 ・ 諮詢 ・ 數位工具導入</div>
                    </div>
                    <span class="material-symbols-outlined" style="margin-left:auto;color:#eab308;font-size:18px;">arrow_forward</span>
                </a>

                <a href="https://www.threads.net/intent/post?text=${encodeURIComponent('剛上完數位簡報室的課程！收穫滿滿 🎓✨ @TBR.DIGITAL')}" target="_blank" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:12px;margin-bottom:10px;text-decoration:none;transition:all 0.2s;" onmouseover="this.style.background='rgba(16,185,129,0.18)'" onmouseout="this.style.background='rgba(16,185,129,0.1)'">
                    <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <span class="material-symbols-outlined" style="color:#fff;font-size:20px;">share</span>
                    </div>
                    <div>
                        <div style="font-size:14px;font-weight:600;color:#e2e8f0;">前往 Threads 分享心得</div>
                        <div style="font-size:12px;color:#94a3b8;">標記 <strong style="color:#10b981;">@TBR.DIGITAL</strong> 讓老師看到你的感受！</div>
                    </div>
                    <span class="material-symbols-outlined" style="margin-left:auto;color:#10b981;font-size:18px;">arrow_forward</span>
                </a>

                <!-- 告別訊息 -->
                <div style="margin-top:20px;padding:16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.06);text-align:center;">
                    <div style="font-size:14px;color:#cbd5e1;line-height:1.7;">
                        🙌 歡迎來找老師聊聊天、私下互動<br>
                        或是開心地離開教室，回家注意安全！
                    </div>
                </div>

                <!-- Email 通知 -->
                <div style="margin-top:12px;padding:12px 16px;background:rgba(99,102,241,0.06);border-radius:10px;border:1px solid rgba(99,102,241,0.12);display:flex;align-items:flex-start;gap:10px;">
                    <span class="material-symbols-outlined" style="color:#818cf8;font-size:20px;flex-shrink:0;margin-top:1px;">mail</span>
                    <div style="font-size:12px;color:#94a3b8;line-height:1.6;">
                        我們會在 <strong style="color:#c7d2fe;">課後兩天內</strong>，將這堂課的學習筆記整理寄到你的 Email，請務必留意課後信件 📬
                    </div>
                </div>
                <!-- 返回修改 -->
                <div style="margin-top:12px;text-align:center;">
                    <button class="survey-edit-back-btn" type="button" style="background:none;border:1px solid #475569;color:#94a3b8;border-radius:10px;padding:8px 20px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.2s;" onmouseover="this.style.borderColor='#818cf8';this.style.color='#c7d2fe'" onmouseout="this.style.borderColor='#475569';this.style.color='#94a3b8'">
                        <span class="material-symbols-outlined" style="font-size:16px;">edit_note</span>
                        返回修改問卷
                    </button>
                </div>
            </div>
        `;

        container.querySelector('.survey-edit-back-btn')?.addEventListener('click', () => {
            this.render(container, element, savedAnswers);
        });
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
