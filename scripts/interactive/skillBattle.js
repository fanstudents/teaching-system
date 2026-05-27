/**
 * 競技場 互動模組 — Prompt 競技場
 *
 * 學員上傳 Skill（prompt），教師統一執行 LLM，
 * 比對標準答案後即時排行。
 */
import { stateManager } from './stateManager.js';
import { db, ai, realtime } from '../supabase.js';

/* ── helpers ── */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mi = (n, s = 18) => `<span class="material-symbols-outlined" style="font-size:${s}px;vertical-align:middle">${n}</span>`;

/* ═══════════════════════════════════════════════ */
export class SkillBattleGame {
    constructor() {
        this._intervals = new Map();
        this._executing = false;
    }

    /* ── 編輯器預覽 ── */
    renderPreview(el, element) {
        el.innerHTML = `
            <div class="skill-battle-preview">
                <div class="sb-preview-header">
                    ${mi('science', 28)}
                    <span>Prompt 競技場</span>
                </div>
                <div class="sb-preview-task">${esc(element.question || '（尚未設定任務描述）')}</div>
                <div class="sb-preview-meta">
                    <span>${mi('smart_toy', 14)} ${element.model || 'gpt-4o'}</span>
                    <span>${mi('tune', 14)} ${element.battleMode === 'skill' ? 'Skill 設計模式' : '提示詞模式'}</span>
                    <span>${mi('description', 14)} 標準答案：${element.referenceAnswer ? '已設定' : '未設定'}</span>
                </div>
            </div>`;
    }

    /* ── 簡報模式（學員 & 教師共用入口）── */
    render(el, element, forceStudent = false) {
        const elementId = el.closest('[data-id]')?.dataset.id || el.dataset.elementId || '';
        el.dataset.elementId = elementId;
        el.classList.add('skill-battle-container');

        // 判斷角色：教師 or 學員
        // student.html 會在 sessionStorage 設定 homework_user
        const hwUser = sessionStorage.getItem('homework_user');
        const isPresenter = !!el.closest('.presentation-slide');
        const isStudent = forceStudent || (hwUser && !isPresenter);

        if (isStudent) {
            this._renderStudent(el, element, elementId);
        } else {
            this._renderTeacher(el, element, elementId);
        }
    }

    /* ═══════════════════════════════════════════════ */
    /*               學 員 端                          */
    /* ═══════════════════════════════════════════════ */
    async _renderStudent(el, element, elementId) {
        const mode = element.battleMode || 'prompt';
        const isSkillMode = mode === 'skill';

        const inputSection = isSkillMode ? `
            <div class="sb-field-group">
                <label class="sb-field-label">${mi('badge', 16)} Skill 名稱</label>
                <input type="text" class="sb-skill-name-input" placeholder="例：Email 撰寫助手">
            </div>
            <div class="sb-field-group">
                <label class="sb-field-label">${mi('description', 16)} Skill 描述</label>
                <textarea class="sb-skill-desc-input" rows="3" placeholder="描述這個 Skill 的用途與目標..."></textarea>
            </div>
            <div class="sb-field-group">
                <label class="sb-field-label">${mi('checklist', 16)} Skill 執行細節</label>
                <textarea class="sb-skill-detail-input" rows="4" placeholder="詳細描述 Skill 的執行步驟、格式要求、約束條件..."></textarea>
            </div>
        ` : `
            <label class="sb-input-label">${mi('edit_note', 18)} 你的提示詞 (Prompt)</label>
            <textarea class="sb-skill-input" placeholder="在此輸入你的 prompt 指令..." rows="6"></textarea>
        `;

        el.innerHTML = `
            <div class="sb-student">
                <div class="sb-student-layout">
                    <div class="sb-student-left">
                        <div class="sb-task-section">
                            <div class="sb-task-label">
                                ${mi('assignment', 18)} 任務說明
                                <button class="sb-copy-task-btn" title="複製題目">${mi('content_copy', 14)} 複製</button>
                            </div>
                            <div class="sb-task-text">${esc(element.question || '')}</div>
                        </div>
                    </div>
                    <div class="sb-student-right">
                        <div class="sb-input-section">
                            ${inputSection}
                            <div class="sb-input-footer">
                                <span class="sb-char-count">0 字</span>
                                <button class="sb-submit-btn">${mi('send', 16)} 提交${isSkillMode ? ' Skill' : ''}</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="sb-student-result"></div>
            </div>`;

        // 複製題目按鈕
        el.querySelector('.sb-copy-task-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = element.question || '';
            navigator.clipboard.writeText(text).then(() => {
                const btn = el.querySelector('.sb-copy-task-btn');
                btn.innerHTML = `${mi('check', 14)} 已複製`;
                setTimeout(() => { btn.innerHTML = `${mi('content_copy', 14)} 複製`; }, 1500);
            }).catch(() => {
                // fallback
                const ta = document.createElement('textarea');
                ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
                document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
                const btn = el.querySelector('.sb-copy-task-btn');
                btn.innerHTML = `${mi('check', 14)} 已複製`;
                setTimeout(() => { btn.innerHTML = `${mi('content_copy', 14)} 複製`; }, 1500);
            });
        });

        const submitBtn = el.querySelector('.sb-submit-btn');
        const charCount = el.querySelector('.sb-char-count');
        const resultEl = el.querySelector('.sb-student-result');
        let submitted = false;

        // 字數計數 — prompt mode only
        const textarea = el.querySelector('.sb-skill-input');
        if (textarea) {
            textarea.addEventListener('input', () => {
                charCount.textContent = `${textarea.value.length} 字`;
            });
        }

        // skill mode refs
        const nameInput = el.querySelector('.sb-skill-name-input');
        const descInput = el.querySelector('.sb-skill-desc-input');
        const detailInput = el.querySelector('.sb-skill-detail-input');

        // helper: disable / enable all inputs
        const setInputsDisabled = (disabled) => {
            if (textarea) textarea.disabled = disabled;
            if (nameInput) nameInput.disabled = disabled;
            if (descInput) descInput.disabled = disabled;
            if (detailInput) detailInput.disabled = disabled;
        };

        // 提交函式（可重用）
        const doSubmit = async () => {
            let skill;
            if (isSkillMode) {
                const skillName = nameInput.value.trim();
                const skillDesc = descInput.value.trim();
                const skillDetail = detailInput.value.trim();
                if (!skillName || !skillDesc || !skillDetail) { alert('請填寫所有 Skill 欄位'); return; }
                if (skillName.length < 2 || skillDesc.length < 2 || skillDetail.length < 2) { alert('每個欄位至少 2 個字'); return; }
                skill = `## Skill 名稱\n${skillName}\n\n## Skill 描述\n${skillDesc}\n\n## Skill 執行細節\n${skillDetail}`;
            } else {
                skill = textarea.value.trim();
                if (!skill) { textarea.focus(); return; }
                if (skill.length < 5) { alert('Skill 內容太短，至少 5 個字'); return; }
            }

            submitted = true;
            setInputsDisabled(true);
            submitBtn.disabled = true;
            submitBtn.innerHTML = `${mi('check', 16)} 已提交`;
            resultEl.innerHTML = `<div class="sb-waiting">${mi('hourglass_top', 20)} 已提交，等待教師執行評分...</div>`;

            const title = element.question?.substring(0, 50) || '競技場';

            // 先清除舊快取再存
            await stateManager.clear(elementId);
            await stateManager.save(elementId, {
                type: 'skillBattle', title, content: skill,
                isCorrect: null, score: null, points: 0, participated: true,
                state: { skill, output: '', score: null, feedback: '', status: 'pending' },
            });
        };

        // helper: 從結構化 skill 字串解析回三個欄位
        const parseSkillFields = (raw) => {
            const m = raw.match(/## Skill 名稱\n([\s\S]*?)\n\n## Skill 描述\n([\s\S]*?)\n\n## Skill 執行細節\n([\s\S]*)/);
            return m ? { name: m[1], desc: m[2], detail: m[3] } : null;
        };

        // helper: 填入 skill mode 欄位
        const fillSkillFields = (raw) => {
            if (!isSkillMode) return;
            const parsed = parseSkillFields(raw);
            if (parsed) {
                nameInput.value = parsed.name;
                descInput.value = parsed.desc;
                detailInput.value = parsed.detail;
            } else {
                // fallback: 放第一個欄位
                if (nameInput) nameInput.value = raw;
            }
        };

        // resubmit callback
        const onResubmit = () => {
            submitted = false;
            setInputsDisabled(false);
            submitBtn.disabled = false;
            submitBtn.innerHTML = `${mi('send', 16)} 重新提交`;
            resultEl.innerHTML = '';
            if (textarea) textarea.focus();
            else if (nameInput) nameInput.focus();
        };

        // 載入歷史
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev?.state?.skill) {
                if (isSkillMode) {
                    fillSkillFields(prev.state.skill);
                } else {
                    if (textarea) {
                        textarea.value = prev.state.skill;
                        charCount.textContent = `${prev.state.skill.length} 字`;
                    }
                }

                if (prev.state.status === 'scored') {
                    submitted = true;
                    setInputsDisabled(true);
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `${mi('check', 16)} 已提交`;
                    this._showStudentResult(resultEl, prev.state, onResubmit);
                } else {
                    submitted = true;
                    setInputsDisabled(true);
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `${mi('check', 16)} 已提交`;
                    resultEl.innerHTML = `<div class="sb-waiting">${mi('hourglass_top', 20)} 已提交，等待教師執行評分...</div>`;
                }
            }
        }

        // 提交按鈕
        submitBtn.addEventListener('click', () => doSubmit());

        // 監聽分數更新 — 直接查 DB，不走 stateManager 快取
        if (elementId) {
            const user = stateManager.getUser();
            const sessionId = stateManager.getSessionCode();
            const email = user?.email || 'guest';

            const tid = setInterval(async () => {
                if (!submitted) return;
                try {
                    const { data } = await db.select('submissions', {
                        filter: {
                            session_id: 'eq.' + (sessionId || ''),
                            element_id: 'eq.' + elementId,
                            student_email: 'eq.' + email,
                        },
                        limit: 1,
                    });
                    if (!data?.length) return;
                    const row = data[0];
                    let state = row.state;
                    if (typeof state === 'string') {
                        try { state = JSON.parse(state); } catch { state = {}; }
                    }
                    if (state.status === 'scored') {
                        this._showStudentResult(resultEl, state, onResubmit);
                        clearInterval(tid);
                    }
                } catch { /* ignore */ }
            }, 4000);
            this._intervals.set(elementId + '_student', tid);
        }
    }

    _showStudentResult(resultEl, state, onResubmit) {
        const score = state.score ?? 0;
        const barWidth = Math.max(5, score);
        const barColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444';
        const scoreEmoji = score >= 80 ? '🎉' : score >= 60 ? '👍' : score >= 40 ? '💪' : '💡';
        resultEl.innerHTML = `
            <div class="sb-result-card">
                <div class="sb-result-header">
                    ${mi('emoji_events', 22)} 你的成績 ${scoreEmoji}
                </div>
                <div class="sb-result-score" style="color:${barColor}">${score}<span class="sb-score-unit"> 分</span></div>
                <div class="sb-result-bar">
                    <div class="sb-result-bar-fill" style="width:${barWidth}%;background:${barColor}"></div>
                </div>
                ${state.feedback ? `<div class="sb-result-feedback">${mi('chat_bubble', 14)} ${esc(state.feedback)}</div>` : ''}
                ${state.suggestions ? `
                    <div class="sb-result-suggestions">
                        <div class="sb-result-suggestions-title">${mi('lightbulb', 16)} 改進建議</div>
                        <div class="sb-result-suggestions-body">${esc(state.suggestions)}</div>
                    </div>` : ''}
                ${state.output ? `
                    <details class="sb-result-output-section">
                        <summary class="sb-result-output-label">${mi('smart_toy', 14)} AI 根據你的 Skill 產出的結果</summary>
                        <div class="sb-result-output">${esc(state.output)}</div>
                    </details>` : ''}
                <button class="sb-resubmit-btn">${mi('edit', 16)} 重新編輯並提交</button>
            </div>`;

        // 綁定重新提交按鈕
        const resubmitBtn = resultEl.querySelector('.sb-resubmit-btn');
        if (resubmitBtn && onResubmit) {
            resubmitBtn.addEventListener('click', onResubmit);
        }
    }

    /*               教 師 端                          */
    /* ═══════════════════════════════════════════════ */
    async _renderTeacher(el, element, elementId) {
        // 取得 session code（用於 filter + realtime）
        const sessionCode = sessionStorage.getItem('_session_code')
            || new URLSearchParams(location.search).get('code') || '';

        el.innerHTML = `
            <div class="sb-teacher">
                <div class="sb-teacher-header">
                    <div class="sb-teacher-title">${mi('science', 22)} 競技場</div>
                    <div class="sb-teacher-actions">
                        <button class="sb-btn sb-btn-refresh">${mi('refresh', 16)} 刷新</button>
                        <button class="sb-btn sb-btn-reset-all">${mi('restart_alt', 16)} 重置全部</button>
                        <button class="sb-btn sb-btn-execute-all">${mi('play_arrow', 16)} 全部執行</button>
                    </div>
                </div>
                <div class="sb-teacher-stats">
                    <span class="sb-stat">${mi('people', 16)} 提交：<b class="sb-count-submitted">0</b></span>
                    <span class="sb-stat">${mi('check_circle', 16)} 已評：<b class="sb-count-scored">0</b></span>
                    <span class="sb-stat">${mi('schedule', 16)} 待執行：<b class="sb-count-pending">0</b></span>
                </div>
                <div class="sb-grid"></div>
                <div class="sb-execution-log"></div>
            </div>`;

        const gridEl = el.querySelector('.sb-grid');
        const logEl = el.querySelector('.sb-execution-log');
        const refreshBtn = el.querySelector('.sb-btn-refresh');
        const resetAllBtn = el.querySelector('.sb-btn-reset-all');
        const execAllBtn = el.querySelector('.sb-btn-execute-all');
        const countSubmitted = el.querySelector('.sb-count-submitted');
        const countScored = el.querySelector('.sb-count-scored');
        const countPending = el.querySelector('.sb-count-pending');

        // ── 載入提交記錄 ──
        const loadSubmissions = async () => {
            const filter = { element_id: 'eq.' + elementId, type: 'eq.skillBattle' };
            if (sessionCode) filter.session_id = 'eq.' + sessionCode;

            const { data } = await db.select('submissions', {
                filter,
                order: 'created_at.asc',
            });
            const subs = data || [];

            // 統計
            let scoredCount = 0, pendingCount = 0;
            subs.forEach(s => {
                let st = {};
                try { st = JSON.parse(s.state || '{}'); } catch {}
                if (st.status === 'scored') scoredCount++;
                else pendingCount++;
            });
            countSubmitted.textContent = subs.length;
            countScored.textContent = scoredCount;
            countPending.textContent = pendingCount;

            // ── 網格卡片 ──
            if (subs.length === 0) {
                gridEl.innerHTML = `<div class="sb-empty">${mi('inbox', 24)} 等待學員提交 Skill...</div>`;
            } else {
                gridEl.innerHTML = subs.map((s, i) => {
                    let state = {};
                    try { state = JSON.parse(s.state || '{}'); } catch {}
                    const name = s.student_name || s.student_email?.split('@')[0] || `學員${i + 1}`;
                    const status = state.status || 'pending';
                    const score = state.score ?? null;
                    const content = s.content || '';
                    const shortPreview = content.length > 40 ? content.substring(0, 40) + '…' : content;

                    // 分數顏色
                    const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444';

                    return `
                        <div class="sb-card sb-card-${status}" data-id="${s.id}" data-status="${status}">
                            <div class="sb-card-header">
                                <span class="sb-card-name">${esc(name)}</span>
                                ${status === 'scored'
                                    ? `<span class="sb-card-score" style="color:${scoreColor}">${score}</span>`
                                    : `<span class="sb-card-status-icon">${status === 'running' ? mi('progress_activity', 16) : mi('schedule', 16)}</span>`
                                }
                            </div>
                            <div class="sb-card-preview" title="${esc(content)}">${esc(shortPreview)}</div>
                            ${status === 'scored' && state.feedback
                                ? `<div class="sb-card-feedback">${esc(state.feedback)}</div>`
                                : ''}
                            ${status === 'scored' && state.output
                                ? `<details class="sb-card-output-details"><summary>${mi('visibility', 12)} AI 輸出</summary><div class="sb-card-output">${esc(state.output)}</div></details>`
                                : ''}
                            ${status === 'pending'
                                ? `<button class="sb-card-exec-btn" data-submission-id="${s.id}">${mi('play_arrow', 14)} 執行</button>`
                                : ''}
                        </div>`;
                }).join('');
            }

            return subs;
        };

        await loadSubmissions();

        // ── 刷新 ──
        refreshBtn.addEventListener('click', () => loadSubmissions());

        // ── 重置全部（把 scored 改回 pending）──
        resetAllBtn.addEventListener('click', async () => {
            if (!confirm('確定要重置所有評分結果嗎？')) return;
            const filter = { element_id: 'eq.' + elementId, type: 'eq.skillBattle' };
            if (sessionCode) filter.session_id = 'eq.' + sessionCode;
            const { data } = await db.select('submissions', { filter });
            for (const s of (data || [])) {
                let st = {};
                try { st = JSON.parse(s.state || '{}'); } catch {}
                st.status = 'pending';
                st.score = null;
                st.output = '';
                st.feedback = '';
                await db.update('submissions', {
                    state: JSON.stringify(st),
                    score: null,
                    is_correct: null,
                }, { id: 'eq.' + s.id });
            }
            logEl.innerHTML = '';
            this._appendLog(logEl, '已重置所有評分結果', 'info');
            await loadSubmissions();
        });

        // ── 逐一執行（點卡片按鈕）──
        gridEl.addEventListener('click', async (e) => {
            const btn = e.target.closest('.sb-card-exec-btn');
            if (!btn) return;
            const subId = btn.dataset.submissionId;
            const card = btn.closest('.sb-card');
            if (card) card.classList.add('sb-card-running');
            btn.disabled = true;
            btn.innerHTML = `${mi('progress_activity', 14)} ...`;
            await this._executeOne(subId, element, logEl);
            await loadSubmissions();
        });

        // ── 全部執行 ──
        execAllBtn.addEventListener('click', async () => {
            if (this._executing) return;
            this._executing = true;
            execAllBtn.disabled = true;
            execAllBtn.innerHTML = `${mi('progress_activity', 16)} 執行中...`;
            logEl.innerHTML = '';

            const subs = await loadSubmissions();
            const pending = subs.filter(s => {
                try { return JSON.parse(s.state || '{}').status !== 'scored'; } catch { return true; }
            });

            if (pending.length === 0) {
                this._appendLog(logEl, '沒有待執行的 Skill（全部已評分）', 'info');
            } else {
                this._appendLog(logEl, `開始執行 ${pending.length} 個 Skill...`, 'info');

                // 標記所有 pending 卡片為 running 動畫
                pending.forEach(s => {
                    const card = gridEl.querySelector(`[data-id="${s.id}"]`);
                    if (card) card.classList.add('sb-card-running');
                });

                const CONCURRENCY = 3;
                for (let i = 0; i < pending.length; i += CONCURRENCY) {
                    const batch = pending.slice(i, i + CONCURRENCY);
                    await Promise.all(batch.map(s => this._executeOne(s.id, element, logEl)));
                    await loadSubmissions();
                }

                this._appendLog(logEl, `全部完成！`, 'success');
            }

            this._executing = false;
            execAllBtn.disabled = false;
            execAllBtn.innerHTML = `${mi('play_arrow', 16)} 全部執行`;
        });

        // 自動刷新
        const tid = setInterval(() => loadSubmissions(), 8000);
        this._intervals.set(elementId + '_teacher', tid);
    }

    /* ── 執行單個 Skill ── */
    async _executeOne(submissionId, element, logEl) {
        try {
            // 讀取提交記錄
            const { data } = await db.select('submissions', { filter: { id: 'eq.' + submissionId }, limit: 1 });
            if (!data?.length) return;
            const sub = data[0];
            let state = {};
            try { state = JSON.parse(sub.state || '{}'); } catch {}
            if (state.status === 'scored') return; // 已評分

            const studentName = sub.student_name || sub.student_email?.split('@')[0] || '?';
            const skill = sub.content || state.skill || '';
            const task = element.question || '';
            const reference = element.referenceAnswer || '';
            const model = element.model || 'gpt-4o';

            this._appendLog(logEl, `${mi('person', 14)} ${esc(studentName)} — 執行中...`, 'info');

            // Step 1: 用學員的 Skill 執行 LLM
            const output = await ai.chat([
                { role: 'system', content: skill },
                { role: 'user', content: task },
            ], { model, maxTokens: element.maxTokens || 800, temperature: 0.7 });

            this._appendLog(logEl, `${mi('smart_toy', 14)} ${esc(studentName)} — AI 輸出完成（${output.length} 字）`, 'info');

            // Step 2: LLM-as-Judge 評分（細緻版）
            let judgePrompt;
            if (element.judgePrompt) {
                judgePrompt = element.judgePrompt;
            } else if (element.battleMode === 'skill') {
                judgePrompt = `你是一位嚴格的 AI Skill 設計評審。請根據學員設計的 Skill 進行全面評估。

═══ 評分資料 ═══

【任務描述】
${task}

${reference ? `【標準 Skill 設計（參考答案）】\n${reference}\n` : '（無標準答案，請根據 Skill 設計品質綜合判斷）'}

【學員設計的 Skill】
${skill}

【AI 使用該 Skill 後的實際輸出】
${output}

═══ 評分規則（滿分 100）═══

A. Skill 名稱與描述（25 分）
- 名稱是否清晰、精確描述功能（+10）
- 描述是否完整說明用途與目標（+15）

B. 執行細節的完整性（35 分）
- 是否有明確的步驟流程（+10）
- 是否有輸出格式要求（+10）
- 是否有約束條件或品質標準（+10）
- 是否考慮邊界情況或例外處理（+5）

C. 與標準答案的接近程度（30 分）
- 核心邏輯是否與標準答案一致（+15）
- 執行細節是否涵蓋標準答案的關鍵步驟（+15）

D. AI 輸出品質（10 分）
- 使用該 Skill 後 AI 輸出是否符合任務要求（+10）

═══ 重要 ═══
1. 重點評估 Skill 描述的精確度和執行細節的完整性
2. 只有名稱沒有細節的 Skill 應在 30-45 分
3. 有結構但細節不足的 Skill 應在 50-65 分
4. 執行細節完整且接近標準答案的 Skill 應在 70-85 分
5. 嚴格對比標準答案的關鍵步驟是否被涵蓋

只回傳 JSON，不要有任何其他文字：
{"score": <整數0到100>, "feedback": "<30字以內的中文評語，要具體指出優缺點>", "suggestions": "<80字以內的改進建議，具體說明如何修改 Skill 可以得到更好的結果>"}`;
            } else {
                judgePrompt = `你是一位嚴格的 Prompt 品質評審。請仔細分析學員的提示詞並嚴格打分。

═══ 評分資料 ═══

【任務描述】
${task}

${reference ? `【理想標準輸出】\n${reference}\n` : '（無標準答案，請根據輸出品質綜合判斷）'}

【學員撰寫的 Prompt】
${skill}

【AI 使用該 Prompt 後的實際輸出】
${output}

═══ 評分規則（滿分 100）═══

A. Prompt 工程技巧（30 分）
- 是否有明確角色設定（+5）
- 是否有具體輸出格式要求（+5）
- 是否有約束條件或限制（+5）
- 是否有分步驟或結構化指令（+5）
- 語意是否精確無歧義（+5）
- 是否善用少樣本或範例引導（+5）

B. 輸出與任務的匹配度（35 分）
- 輸出是否完整回應所有任務要求（+15）
- 輸出的專業度與深度（+10）
- 輸出的格式與結構是否清晰（+10）

C. 與標準答案的相似度（25 分）
- 關鍵資訊覆蓋率（+10）
- 論述邏輯與層次（+8）
- 細節準確度（+7）

D. 差異化加分/扣分（10 分）
- 有創意的 prompt 技巧（如 CoT、few-shot）+5~+10
- Prompt 過於簡短或敷衍 -5~-10
- 輸出有明顯錯誤或離題 -5~-10

═══ 重要 ═══
1. 滿分極難得到，90+ 只給真正出色的 prompt
2. 普通直覺式 prompt（如「請幫我寫...」）應在 40-55 分
3. 有基本結構但缺乏技巧的 prompt 應在 55-70 分
4. 有進階技巧（角色、格式、約束）的 prompt 應在 70-85 分
5. 不同品質的 prompt 分數差距應該明顯（至少 10-15 分）

只回傳 JSON，不要有任何其他文字：
{"score": <整數0到100>, "feedback": "<30字以內的中文評語，要具體指出優缺點>", "suggestions": "<80字以內的改進建議，具體說明如何修改 prompt 可以得到更好的結果>"}`;
            }

            const judgeResult = await ai.chat([
                { role: 'user', content: judgePrompt },
            ], { model, maxTokens: 500, temperature: 0.5 });

            // 解析分數
            let score = 50;
            let feedback = '';
            let suggestions = '';
            try {
                const jsonMatch = judgeResult.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    // 用 Number 而非 parseInt || 50，避免 0 分被 fallback
                    const rawScore = Number(parsed.score);
                    score = isNaN(rawScore) ? 50 : Math.min(100, Math.max(0, Math.round(rawScore)));
                    feedback = parsed.feedback || '';
                    suggestions = parsed.suggestions || '';
                }
            } catch (e) {
                console.warn('Judge parse error:', e, judgeResult);
                feedback = '評分解析失敗';
            }
            console.log(`[SkillBattle] ${studentName}: score=${score}, raw=`, judgeResult);
            this._appendLog(logEl, `${mi('bug_report', 14)} Judge raw: ${esc(judgeResult.substring(0, 100))}`, 'info');

            // Step 3: 更新 DB（★ 修正參數順序：data 在前，filter 在後）
            const newState = { ...state, output, score, feedback, suggestions, status: 'scored', executedAt: new Date().toISOString() };
            await db.update('submissions', {
                state: JSON.stringify(newState),
                score: String(score),
                is_correct: score >= 60,
            }, {
                id: 'eq.' + submissionId,
            });

            this._appendLog(logEl, `${mi('emoji_events', 14)} ${esc(studentName)} — <b>${score} 分</b>　${esc(feedback)}`, 'success');

            // Realtime 通知
            try {
                const sessionCode = sessionStorage.getItem('_session_code') || '';
                if (sessionCode) {
                    realtime.publish(`session:${sessionCode}`, 'skill_battle_scored', {
                        element_id: sub.element_id,
                        student_email: sub.student_email,
                        score,
                    });
                }
            } catch (e) { /* ignore */ }

        } catch (err) {
            console.error('SkillBattle execute error:', err);
            this._appendLog(logEl, `${mi('error', 14)} 執行失敗：${esc(err.message)}`, 'error');
        }
    }

    _appendLog(logEl, html, type = 'info') {
        if (!logEl) return;
        const line = document.createElement('div');
        line.className = `sb-log-line sb-log-${type}`;
        line.innerHTML = `<span class="sb-log-time">${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> ${html}`;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    }

    /* ── 清理 ── */
    destroy() {
        for (const [, id] of this._intervals) clearInterval(id);
        this._intervals.clear();
    }
}

/* ═══════════════════════════════════════════════════════════ */
/*  SkillBattleBoardGame — 獨立排行榜元件                       */
/*  放在 競技場 的下一頁，自動讀取同場次的評分資料            */
/* ═══════════════════════════════════════════════════════════ */
export class SkillBattleBoardGame {
    constructor() { this._tid = null; }

    renderPreview(el, element) {
        el.innerHTML = `
            <div class="sb-board-preview">
                <div class="sb-board-preview-header">
                    ${mi('leaderboard', 28)}
                    <span>Prompt 競技場排行榜</span>
                </div>
                <div class="sb-board-preview-body">
                    <div class="sb-board-preview-row sb-rank-gold"><span>🥇</span><span>第 1 名</span><span>—</span></div>
                    <div class="sb-board-preview-row sb-rank-silver"><span>🥈</span><span>第 2 名</span><span>—</span></div>
                    <div class="sb-board-preview-row sb-rank-bronze"><span>🥉</span><span>第 3 名</span><span>—</span></div>
                </div>
            </div>`;
    }

    render(el, element) {
        el.classList.add('sb-board-container');
        // 累積模式預設值（element 屬性 or true）
        let cumulative = element.cumulativeScore !== false;

        el.innerHTML = `
            <div class="sb-board">
                <div class="sb-board-title-bar">
                    <div class="sb-board-title">
                        ${mi('leaderboard', 26)}
                        <span>競技場排行榜</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <label class="sb-board-toggle" title="累積所有競技場分數 vs 單題分數">
                            <input type="checkbox" class="sb-cumulative-cb" ${cumulative ? 'checked' : ''}>
                            <span class="sb-toggle-slider"></span>
                            <span class="sb-toggle-label">累積計分</span>
                        </label>
                        <div class="sb-board-subtitle">即時更新</div>
                    </div>
                </div>
                <div class="sb-board-list"></div>
                <div class="sb-board-empty">${mi('pending', 22)} 等待評分結果...</div>
            </div>`;

        const listEl = el.querySelector('.sb-board-list');
        const emptyEl = el.querySelector('.sb-board-empty');
        const toggleCb = el.querySelector('.sb-cumulative-cb');
        let lastHash = '';

        // 切換累積/單題模式
        toggleCb.addEventListener('change', () => {
            cumulative = toggleCb.checked;
            lastHash = ''; // force refresh
            load();
        });

        const load = async () => {
            const sessionId = window._activeSessionUUID
                || sessionStorage.getItem('_session_code')
                || new URLSearchParams(location.search).get('code') || '';
            let filter = { type: 'eq.skillBattle' };
            if (sessionId) filter.session_id = 'eq.' + sessionId;

            const { data } = await db.select('submissions', {
                filter,
                order: 'created_at.asc',
            });

            const allScored = (data || []).filter(s => {
                try { return JSON.parse(s.state || '{}').status === 'scored'; } catch { return false; }
            }).map(s => {
                const state = JSON.parse(s.state || '{}');
                return {
                    name: s.student_name || s.student_email?.split('@')[0] || '?',
                    email: s.student_email || s.student_name || '?',
                    score: state.score ?? 0,
                    feedback: state.feedback || '',
                    elementId: s.element_id || '',
                };
            });

            let scored;
            if (cumulative) {
                // 累積模式：按學員 group，加總分數
                const grouped = new Map();
                allScored.forEach(s => {
                    const key = s.email;
                    if (!grouped.has(key)) {
                        grouped.set(key, { name: s.name, totalScore: 0, count: 0, feedbacks: [] });
                    }
                    const g = grouped.get(key);
                    g.totalScore += s.score;
                    g.count++;
                    if (s.feedback) g.feedbacks.push(s.feedback);
                });
                scored = [...grouped.values()].map(g => ({
                    name: g.name,
                    score: g.totalScore,
                    feedback: g.count > 1 ? `${g.count} 題累積` : (g.feedbacks[0] || ''),
                })).sort((a, b) => b.score - a.score);
            } else {
                // 單題模式：每筆提交獨立顯示
                scored = allScored.sort((a, b) => b.score - a.score);
            }

            // 比對資料是否有變化
            const hash = JSON.stringify(scored) + cumulative;
            if (hash === lastHash) return;
            lastHash = hash;

            if (scored.length === 0) {
                listEl.style.display = 'none';
                emptyEl.style.display = 'flex';
                return;
            }

            emptyEl.style.display = 'none';
            listEl.style.display = '';

            const topScore = Math.max(scored[0]?.score || 1, 1);
            listEl.innerHTML = scored.map((s, i) => {
                const rank = i + 1;
                const isTop3 = rank <= 3;
                const tierClass = rank === 1 ? 'sb-board-gold' : rank === 2 ? 'sb-board-silver' : rank === 3 ? 'sb-board-bronze' : '';
                const medalEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                const barW = Math.max(4, (s.score / topScore) * 100);
                const barC = s.score >= 80 ? '#22c55e' : s.score >= 60 ? '#eab308' : s.score >= 40 ? '#f97316' : '#ef4444';
                const delay = i * 0.1;
                return `
                    <div class="sb-board-row ${tierClass}" style="animation-delay:${delay}s">
                        <div class="sb-board-rank ${isTop3 ? 'sb-board-rank-top' : ''}">
                            ${medalEmoji ? `<span class="sb-board-medal-emoji">${medalEmoji}</span>` : `<span class="sb-board-rank-num">${rank}</span>`}
                        </div>
                        <div class="sb-board-info">
                            <div class="sb-board-name">${esc(s.name)}</div>
                            ${s.feedback ? `<div class="sb-board-feedback">${esc(s.feedback)}</div>` : ''}
                        </div>
                        <div class="sb-board-bar-wrap">
                            <div class="sb-board-bar"><div class="sb-board-bar-fill" style="--bar-w:${barW}%;background:${barC};animation-delay:${delay + 0.3}s"></div></div>
                        </div>
                        <div class="sb-board-score-wrap">
                            <span class="sb-board-score">${s.score}</span>
                            <span class="sb-board-score-label">分</span>
                        </div>
                    </div>`;
            }).join('');
        };

        load();
        this._tid = setInterval(load, 6000);
    }

    destroy() {
        if (this._tid) clearInterval(this._tid);
    }
}

/* ═══════════════════════════════════════════════════════════ */
/*  SkillBattleReviewGame — 提示詞檢討牆                        */
/*  顯示所有學員提交的 prompt 及 AI 評分回饋                    */
/* ═══════════════════════════════════════════════════════════ */
export class SkillBattleReviewGame {
    constructor() { this._tid = null; }

    renderPreview(el, element) {
        el.innerHTML = `
            <div class="sb-review-preview">
                <div class="sb-review-preview-header">
                    ${mi('rate_review', 28)}
                    <span>提示詞檢討牆</span>
                </div>
                <div class="sb-review-preview-body">
                    <div class="sb-review-preview-row">
                        <div class="sb-review-preview-left"><span class="sb-review-preview-badge">#1</span><span>學員 A</span></div>
                        <div class="sb-review-preview-score" style="color:#22c55e">85</div>
                    </div>
                    <div class="sb-review-preview-row">
                        <div class="sb-review-preview-left"><span class="sb-review-preview-badge">#2</span><span>學員 B</span></div>
                        <div class="sb-review-preview-score" style="color:#eab308">62</div>
                    </div>
                    <div class="sb-review-preview-row">
                        <div class="sb-review-preview-left"><span class="sb-review-preview-badge">#3</span><span>學員 C</span></div>
                        <div class="sb-review-preview-score" style="color:#f97316">45</div>
                    </div>
                </div>
            </div>`;
    }

    render(el, element) {
        el.classList.add('sb-review-container');
        el.innerHTML = `
            <div class="sb-review">
                <div class="sb-review-title-bar">
                    <div class="sb-review-title">
                        📝 提示詞檢討牆
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <select class="sb-review-filter" title="選擇競技場">
                            <option value="">全部競技場</option>
                        </select>
                        <div class="sb-review-subtitle"><span class="sb-review-count">共 0 筆提交</span></div>
                    </div>
                </div>
                <div class="sb-review-list"></div>
                <div class="sb-review-empty">${mi('pending', 22)} 等待提交資料...</div>
            </div>`;

        const listEl = el.querySelector('.sb-review-list');
        const emptyEl = el.querySelector('.sb-review-empty');
        const countEl = el.querySelector('.sb-review-count');
        const filterEl = el.querySelector('.sb-review-filter');
        let lastHash = '';
        let selectedElementId = ''; // '' = all

        filterEl.addEventListener('change', () => {
            selectedElementId = filterEl.value;
            lastHash = ''; // force refresh
            load();
        });

        const load = async () => {
            const sessionId = window._activeSessionUUID
                || sessionStorage.getItem('_session_code')
                || new URLSearchParams(location.search).get('code') || '';
            let filter = { type: 'eq.skillBattle' };
            if (sessionId) filter.session_id = 'eq.' + sessionId;

            const { data } = await db.select('submissions', {
                filter,
                order: 'created_at.asc',
            });

            const allSubs = data || [];

            // 動態更新下拉選單（用 element_id + assignment_title 區分）
            const elementMap = new Map();
            allSubs.forEach(s => {
                const eid = s.element_id || '';
                if (eid && !elementMap.has(eid)) {
                    elementMap.set(eid, s.assignment_title || `競技場 ${elementMap.size + 1}`);
                }
            });

            // 只在選項數量變化時更新下拉選單
            const optKeys = [...elementMap.keys()].join(',');
            if (filterEl.dataset.keys !== optKeys) {
                filterEl.dataset.keys = optKeys;
                const currentVal = filterEl.value;
                filterEl.innerHTML = '<option value="">📋 全部競技場</option>';
                let idx = 1;
                elementMap.forEach((title, eid) => {
                    const opt = document.createElement('option');
                    opt.value = eid;
                    opt.textContent = `#${idx++} ${title}`;
                    filterEl.appendChild(opt);
                });
                filterEl.value = currentVal || '';
            }

            // 依據選擇篩選
            const subs = selectedElementId
                ? allSubs.filter(s => s.element_id === selectedElementId)
                : allSubs;

            // hash 比對避免不必要的 DOM 重建
            const hash = JSON.stringify(subs.map(s => s.id + (s.state || ''))) + selectedElementId;
            if (hash === lastHash) return;
            lastHash = hash;

            countEl.textContent = `共 ${subs.length} 筆提交`;

            if (subs.length === 0) {
                listEl.style.display = 'none';
                emptyEl.style.display = 'flex';
                return;
            }

            emptyEl.style.display = 'none';
            listEl.style.display = '';

            listEl.innerHTML = subs.map((s, i) => {
                let state = {};
                try { state = JSON.parse(s.state || '{}'); } catch {}
                const name = s.student_name || s.student_email?.split('@')[0] || `學員${i + 1}`;
                const status = state.status || 'pending';
                const score = state.score ?? null;
                const prompt = s.content || state.skill || '';
                const feedback = state.feedback || '';
                const output = state.output || '';
                const delay = i * 0.08;

                // 分數顏色
                const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444';
                // 左邊框顏色
                const borderColor = status === 'scored' ? scoreColor : '#94a3b8';

                return `
                    <div class="sb-review-row" style="animation-delay:${delay}s;--row-border-color:${borderColor}">
                        <div class="sb-review-row-header">
                            <div class="sb-review-row-left">
                                <span class="sb-review-num">#${i + 1}</span>
                                <span class="sb-review-name">${esc(name)}</span>
                            </div>
                            <div class="sb-review-row-right">
                                ${status === 'scored'
                                    ? `<span class="sb-review-score" style="color:${scoreColor}">${score}<span class="sb-review-score-unit"> 分</span></span>`
                                    : `<span class="sb-review-pending">⏳ 待評分</span>`
                                }
                            </div>
                        </div>
                        <div class="sb-review-prompt">${esc(prompt)}</div>
                        ${status === 'scored' && feedback
                            ? `<div class="sb-review-feedback">💬 AI 評分建議：${esc(feedback)}</div>`
                            : ''}
                        ${status === 'scored' && state.suggestions
                            ? `<div class="sb-review-suggestions">💡 改進建議：${esc(state.suggestions)}</div>`
                            : ''}
                        ${status === 'scored' && output
                            ? `<details class="sb-review-output-details"><summary>📄 AI 輸出結果</summary><div class="sb-review-output">${esc(output)}</div></details>`
                            : ''}
                    </div>`;
            }).join('');
        };

        load();
        this._tid = setInterval(load, 6000);
    }

    destroy() {
        if (this._tid) clearInterval(this._tid);
    }
}
