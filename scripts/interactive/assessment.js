/**
 * 課前/課後評量互動模組
 * 支援選擇題 + 是非題，全螢幕作答，分數記錄到 stateManager
 */
import { stateManager } from './stateManager.js';

export class AssessmentGame {
    constructor() {
        this._overlay = null;
    }

    /**
     * 在投影片中渲染入口卡片（學員端 / 播放模式）
     */
    async render(container, element) {
        const elementId = element.id;
        const title = element.title || (element.assessmentType === 'post' ? '📝 課後測驗' : '📝 課前測驗');
        const qCount = (element.questions || []).length;
        const typeLabel = element.assessmentType === 'post' ? '課後' : '課前';
        const typeColor = element.assessmentType === 'post' ? '#10b981' : '#3b82f6';

        // 檢查是否已作答
        const existing = await stateManager.load(elementId);
        if (existing) {
            const st = existing.state || {};
            this._renderResult(container, element, st);
            return;
        }

        container.innerHTML = `
            <div class="assessment-card">
                <div class="assessment-card-badge" style="background:${typeColor}">${typeLabel}</div>
                <div class="assessment-card-icon">
                    <span class="material-symbols-outlined" style="font-size:48px;color:${typeColor}">quiz</span>
                </div>
                <div class="assessment-card-title">${this._esc(title)}</div>
                <div class="assessment-card-info">${qCount} 題 ・ 選擇題 & 是非題</div>
                <button class="assessment-start-btn" style="--accent:${typeColor}">
                    <span class="material-symbols-outlined" style="font-size:18px;">play_arrow</span>
                    開始測驗
                </button>
            </div>
        `;

        container.querySelector('.assessment-start-btn')?.addEventListener('click', () => {
            this.openFullscreen(element);
        });
    }

    /**
     * 全螢幕作答介面
     */
    openFullscreen(element) {
        const questions = element.questions || [];
        if (questions.length === 0) return;

        // 打亂題目順序
        const shuffled = [...questions].map((q, i) => ({ ...q, _origIdx: i }));
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const answers = new Array(shuffled.length).fill(null);
        let currentIdx = 0;

        // 建立 overlay
        const overlay = document.createElement('div');
        overlay.className = 'assessment-overlay';
        // 倒數計時器
        let timeLeft = 180;
        let timerInterval = null;

        overlay.innerHTML = `
            <div class="assessment-fullscreen">
                <div class="assessment-header">
                    <div class="assessment-header-title">${this._esc(element.title || '測驗')}</div>
                    <div class="assessment-progress">
                        <span class="assessment-progress-text">1 / ${shuffled.length}</span>
                        <div class="assessment-progress-bar"><div class="assessment-progress-fill" style="width:${100 / shuffled.length}%"></div></div>
                    </div>
                    <div class="assessment-timer" id="assessmentTimer">
                        <span class="material-symbols-outlined" style="font-size:16px;">timer</span>
                        <span class="assessment-timer-text">3:00</span>
                    </div>
                    <button class="assessment-close-btn" title="關閉">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="assessment-body"></div>
                <div class="assessment-nav">
                    <button class="assessment-prev-btn" disabled>
                        <span class="material-symbols-outlined">arrow_back</span> 上一題
                    </button>
                    <button class="assessment-next-btn">
                        下一題 <span class="material-symbols-outlined">arrow_forward</span>
                    </button>
                    <button class="assessment-submit-btn" style="display:none">
                        <span class="material-symbols-outlined">check_circle</span> 提交測驗
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this._overlay = overlay;

        const body = overlay.querySelector('.assessment-body');
        const prevBtn = overlay.querySelector('.assessment-prev-btn');
        const nextBtn = overlay.querySelector('.assessment-next-btn');
        const submitBtn = overlay.querySelector('.assessment-submit-btn');
        const progressText = overlay.querySelector('.assessment-progress-text');
        const progressFill = overlay.querySelector('.assessment-progress-fill');

        const renderQuestion = (idx) => {
            currentIdx = idx;
            const q = shuffled[idx];
            progressText.textContent = `${idx + 1} / ${shuffled.length}`;
            progressFill.style.width = `${((idx + 1) / shuffled.length) * 100}%`;
            prevBtn.disabled = idx === 0;

            // 最後一題顯示提交按鈕
            const allAnswered = answers.every(a => a !== null);
            if (idx === shuffled.length - 1) {
                nextBtn.style.display = 'none';
                submitBtn.style.display = '';
                submitBtn.disabled = !allAnswered;
            } else {
                nextBtn.style.display = '';
                submitBtn.style.display = 'none';
            }

            if (q.type === 'truefalse') {
                const selected = answers[idx];
                body.innerHTML = `
                    <div class="assessment-question">
                        <span class="assessment-q-badge">${idx + 1}</span>
                        <span class="assessment-q-type">是非題</span>
                        <div class="assessment-q-text">${this._esc(q.question)}</div>
                    </div>
                    <div class="assessment-tf-options">
                        <button class="assessment-tf-btn ${selected === true ? 'selected' : ''}" data-val="true">
                            <span class="material-symbols-outlined" style="font-size:28px;">check_circle</span>
                            <span>正確</span>
                        </button>
                        <button class="assessment-tf-btn ${selected === false ? 'selected' : ''}" data-val="false">
                            <span class="material-symbols-outlined" style="font-size:28px;">cancel</span>
                            <span>錯誤</span>
                        </button>
                        <button class="assessment-tf-btn assessment-idk-btn ${selected === -1 ? 'selected' : ''}" data-val="idk">
                            <span class="material-symbols-outlined" style="font-size:28px;">help</span>
                            <span>我不知道</span>
                        </button>
                    </div>
                `;
                body.querySelectorAll('.assessment-tf-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const v = btn.dataset.val;
                        answers[idx] = v === 'idk' ? -1 : v === 'true';
                        renderQuestion(idx);
                    });
                });
            } else {
                // choice
                const markers = 'ABCDEFGHIJ';
                const selected = answers[idx];
                const opts = q.options || [];
                body.innerHTML = `
                    <div class="assessment-question">
                        <span class="assessment-q-badge">${idx + 1}</span>
                        <span class="assessment-q-type">選擇題</span>
                        <div class="assessment-q-text">${this._esc(q.question)}</div>
                    </div>
                    <div class="assessment-choice-options">
                        ${opts.map((opt, i) => `
                            <button class="assessment-choice-btn ${selected === i ? 'selected' : ''}" data-idx="${i}">
                                <span class="assessment-choice-marker">${markers[i]}</span>
                                <span class="assessment-choice-text">${this._esc(typeof opt === 'string' ? opt : opt.text)}</span>
                            </button>
                        `).join('')}
                        <button class="assessment-choice-btn assessment-idk-btn ${selected === -1 ? 'selected' : ''}" data-idx="-1">
                            <span class="assessment-choice-marker">?</span>
                            <span class="assessment-choice-text">我不知道</span>
                        </button>
                    </div>
                `;
                body.querySelectorAll('.assessment-choice-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        answers[idx] = parseInt(btn.dataset.idx);
                        renderQuestion(idx);
                    });
                });
            }

            // 更新提交按鈕狀態
            const nowAllAnswered = answers.every(a => a !== null);
            submitBtn.disabled = !nowAllAnswered;
        };

        prevBtn.addEventListener('click', () => {
            if (currentIdx > 0) renderQuestion(currentIdx - 1);
        });
        nextBtn.addEventListener('click', () => {
            if (currentIdx < shuffled.length - 1) renderQuestion(currentIdx + 1);
        });
        overlay.querySelector('.assessment-close-btn').addEventListener('click', () => {
            if (answers.some(a => a !== null)) {
                if (!confirm('還沒作答完畢，確定要離開嗎？')) return;
            }
            if (timerInterval) clearInterval(timerInterval);
            overlay.remove();
            this._overlay = null;
        });

        // 自動提交函數
        const doSubmit = async () => {
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined assessment-spin">progress_activity</span> 提交中…';

            // 未作答的填 -1（我不知道）
            for (let i = 0; i < answers.length; i++) {
                if (answers[i] === null) answers[i] = -1;
            }

            // 計算分數
            let correct = 0;
            const details = [];
            shuffled.forEach((q, i) => {
                let isCorrect = false;
                if (q.type === 'truefalse') {
                    isCorrect = answers[i] === q.answer;
                } else {
                    isCorrect = answers[i] === q.answer;
                }
                if (isCorrect) correct++;
                details.push({
                    questionId: q.id,
                    question: q.question,
                    type: q.type,
                    userAnswer: answers[i],
                    correctAnswer: q.answer,
                    isCorrect,
                    concept: q.concept || '',
                    difficulty: q.difficulty || 2,
                });
            });

            const score = Math.round((correct / shuffled.length) * 100);
            const points = element.points ?? 15;
            const awardedPoints = Math.round((score / 100) * points);

            await stateManager.save(element.id, {
                type: 'assessment',
                title: element.title || '測驗',
                content: `${correct}/${shuffled.length} (${score}%)`,
                isCorrect: score >= 60,
                score: String(score),
                points,
                state: {
                    assessmentType: element.assessmentType || 'pre',
                    correct,
                    total: shuffled.length,
                    score,
                    details,
                },
            });

            // 供分數牆定位自身位置
            if (!window._assessmentWallMyScores) window._assessmentWallMyScores = {};
            window._assessmentWallMyScores[element.assessmentType || 'pre'] = score;

            // 顯示結果
            const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
            const emoji = score >= 80 ? '🎉' : score >= 60 ? '👍' : '💪';

            body.innerHTML = `
                <div class="assessment-result-screen">
                    <div class="assessment-result-emoji">${emoji}</div>
                    <div class="assessment-result-score" style="color:${color}">${score}<span style="font-size:24px;color:#94a3b8">分</span></div>
                    <div class="assessment-result-detail">答對 ${correct} / ${shuffled.length} 題</div>
                    <div class="assessment-result-bar-wrap">
                        <div class="assessment-result-bar" style="width:${score}%;background:${color}"></div>
                    </div>
                    <div class="assessment-result-breakdown">
                        ${details.map((d, i) => `
                            <div class="assessment-result-row ${d.isCorrect ? 'correct' : 'wrong'}">
                                <span class="assessment-result-q-num">${i + 1}</span>
                                <span class="assessment-result-q-text">${this._esc(d.question).slice(0, 40)}${d.question.length > 40 ? '…' : ''}</span>
                                <span class="material-symbols-outlined" style="font-size:18px;color:${d.isCorrect ? '#10b981' : '#ef4444'}">${d.isCorrect ? 'check_circle' : 'cancel'}</span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="assessment-done-btn">
                        <span class="material-symbols-outlined">arrow_back</span> 返回簡報
                    </button>
                </div>
            `;

            // 隱藏上下題按鈕
            overlay.querySelector('.assessment-nav').style.display = 'none';

            body.querySelector('.assessment-done-btn')?.addEventListener('click', () => {
                overlay.remove();
                this._overlay = null;
                // 更新入口卡片為結果狀態
                const card = document.querySelector(`[data-id="${element.id}"]`);
                if (card) {
                    this._renderResult(card, element, { correct, total: shuffled.length, score, details });
                }
            });

            stateManager.playSuccessFeedback(body);
        };

        submitBtn.addEventListener('click', () => doSubmit());

        // ── 倒數計時器邏輯 ──
        const timerEl = overlay.querySelector('.assessment-timer-text');
        const timerWrap = overlay.querySelector('.assessment-timer');
        const updateTimer = () => {
            const min = Math.floor(timeLeft / 60);
            const sec = timeLeft % 60;
            timerEl.textContent = `${min}:${String(sec).padStart(2, '0')}`;
            if (timeLeft <= 30) {
                timerWrap.classList.add('timer-danger');
            }
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                doSubmit();
            }
            timeLeft--;
        };
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);

        renderQuestion(0);

        // 鍵盤導覽
        const handleKey = (e) => {
            if (!document.body.contains(overlay)) {
                document.removeEventListener('keydown', handleKey);
                return;
            }
            if (e.key === 'ArrowLeft' && currentIdx > 0) renderQuestion(currentIdx - 1);
            if (e.key === 'ArrowRight' && currentIdx < shuffled.length - 1) renderQuestion(currentIdx + 1);
            if (e.key === 'Escape') overlay.querySelector('.assessment-close-btn')?.click();
        };
        document.addEventListener('keydown', handleKey);
    }

    /**
     * 已作答結果卡片
     */
    _renderResult(container, element, state) {
        const { correct = 0, total = 0, score = 0, details = [] } = state || {};
        const typeLabel = element.assessmentType === 'post' ? '課後' : '課前';
        const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
        const weakConcepts = details
            .filter(d => !d.isCorrect && d.concept)
            .map(d => d.concept)
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 3);

        container.innerHTML = `
            <div class="assessment-card assessment-done">
                <div class="assessment-card-badge" style="background:${color}">${typeLabel} ✓</div>
                <div class="assessment-done-score" style="color:${color}">${score}<span style="font-size:16px;color:#94a3b8">分</span></div>
                <div class="assessment-done-detail">答對 ${correct} / ${total} 題</div>
                ${weakConcepts.length > 0 ? `
                    <div class="assessment-weak-concepts">
                        <span style="font-size:11px;color:#94a3b8;">待加強：</span>
                        ${weakConcepts.map(c => `<span class="assessment-weak-tag">${this._esc(c)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 編輯器預覽
     */
    renderPreview(container, element) {
        const title = element.title || (element.assessmentType === 'post' ? '📝 課後測驗' : '📝 課前測驗');
        const qCount = (element.questions || []).length;
        const typeLabel = element.assessmentType === 'post' ? '課後' : '課前';
        const typeColor = element.assessmentType === 'post' ? '#10b981' : '#3b82f6';

        container.innerHTML = `
            <div class="assessment-card assessment-preview">
                <div class="assessment-card-badge" style="background:${typeColor}">${typeLabel}</div>
                <div class="assessment-card-icon">
                    <span class="material-symbols-outlined" style="font-size:36px;color:${typeColor}">quiz</span>
                </div>
                <div class="assessment-card-title">${this._esc(title)}</div>
                <div class="assessment-card-info">${qCount} 題 ・ 點擊編輯</div>
            </div>
        `;
    }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
