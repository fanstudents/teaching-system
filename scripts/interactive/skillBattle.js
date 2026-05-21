/**
 * Skill Battle 互動模組 — Prompt 競技場
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
                    <span>Skill Battle — Prompt 競技場</span>
                </div>
                <div class="sb-preview-task">${esc(element.question || '（尚未設定任務描述）')}</div>
                <div class="sb-preview-meta">
                    <span>${mi('smart_toy', 14)} ${element.model || 'gpt-4o'}</span>
                    <span>${mi('description', 14)} 標準答案：${element.referenceAnswer ? '已設定' : '未設定'}</span>
                </div>
            </div>`;
    }

    /* ── 簡報模式（學員 & 教師共用入口）── */
    render(el, element) {
        const elementId = el.closest('[data-id]')?.dataset.id || el.dataset.elementId || '';
        el.dataset.elementId = elementId;
        el.classList.add('skill-battle-container');

        // 判斷角色：教師 or 學員
        const isTeacher = !!el.closest('.presentation-slide');   // 簡報端 = 教師
        const isStudent = !!el.closest('.aud-interaction-wrap'); // 觀眾端 = 學員

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
        el.innerHTML = `
            <div class="sb-student">
                <div class="sb-task-section">
                    <div class="sb-task-label">${mi('assignment', 18)} 任務說明</div>
                    <div class="sb-task-text">${esc(element.question || '')}</div>
                </div>
                <div class="sb-input-section">
                    <label class="sb-input-label">${mi('edit_note', 18)} 你的 Skill（Prompt 指令）</label>
                    <textarea class="sb-skill-input" placeholder="在此輸入你的 prompt 指令..." rows="6"></textarea>
                    <div class="sb-input-footer">
                        <span class="sb-char-count">0 字</span>
                        <button class="sb-submit-btn">${mi('send', 16)} 提交 Skill</button>
                    </div>
                </div>
                <div class="sb-student-result"></div>
            </div>`;

        const textarea = el.querySelector('.sb-skill-input');
        const submitBtn = el.querySelector('.sb-submit-btn');
        const charCount = el.querySelector('.sb-char-count');
        const resultEl = el.querySelector('.sb-student-result');
        let submitted = false;

        // 字數計數
        textarea.addEventListener('input', () => {
            charCount.textContent = `${textarea.value.length} 字`;
        });

        // 載入歷史
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev?.state?.skill) {
                textarea.value = prev.state.skill;
                textarea.disabled = true;
                submitBtn.disabled = true;
                submitted = true;
                charCount.textContent = `${prev.state.skill.length} 字`;

                if (prev.state.status === 'scored') {
                    this._showStudentResult(resultEl, prev.state);
                } else {
                    resultEl.innerHTML = `<div class="sb-waiting">${mi('hourglass_top', 20)} 已提交，等待教師執行評分...</div>`;
                }
            }
        }

        // 提交
        submitBtn.addEventListener('click', async () => {
            if (submitted) return;
            const skill = textarea.value.trim();
            if (!skill) { textarea.focus(); return; }
            if (skill.length < 5) { alert('Skill 內容太短，至少 5 個字'); return; }

            submitted = true;
            textarea.disabled = true;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `${mi('check', 16)} 已提交`;
            resultEl.innerHTML = `<div class="sb-waiting">${mi('hourglass_top', 20)} 已提交，等待教師執行評分...</div>`;

            const title = element.question?.substring(0, 50) || 'Skill Battle';
            await stateManager.save(elementId, {
                type: 'skillBattle', title, content: skill,
                isCorrect: null, score: null, points: 0, participated: true,
                state: { skill, output: '', score: null, feedback: '', status: 'pending' },
            });
        });

        // 監聽分數更新（Realtime）
        if (elementId) {
            const tid = setInterval(async () => {
                if (!submitted) return;
                const latest = await stateManager.load(elementId);
                if (latest?.state?.status === 'scored') {
                    this._showStudentResult(resultEl, latest.state);
                    clearInterval(tid);
                }
            }, 5000);
            this._intervals.set(elementId + '_student', tid);
        }
    }

    _showStudentResult(resultEl, state) {
        const score = state.score ?? 0;
        const barWidth = Math.max(5, score);
        const barColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444';
        resultEl.innerHTML = `
            <div class="sb-result-card">
                <div class="sb-result-header">
                    ${mi('emoji_events', 22)} 你的成績
                </div>
                <div class="sb-result-score" style="color:${barColor}">${score}<span class="sb-score-unit"> 分</span></div>
                <div class="sb-result-bar">
                    <div class="sb-result-bar-fill" style="width:${barWidth}%;background:${barColor}"></div>
                </div>
                ${state.feedback ? `<div class="sb-result-feedback">${mi('chat_bubble', 14)} ${esc(state.feedback)}</div>` : ''}
                ${state.output ? `<div class="sb-result-output-toggle">
                    <details>
                        <summary>${mi('visibility', 14)} 查看 AI 輸出</summary>
                        <div class="sb-result-output">${esc(state.output)}</div>
                    </details>
                </div>` : ''}
            </div>`;
    }

    /* ═══════════════════════════════════════════════ */
    /*               教 師 端                          */
    /* ═══════════════════════════════════════════════ */
    async _renderTeacher(el, element, elementId) {
        el.innerHTML = `
            <div class="sb-teacher">
                <div class="sb-teacher-header">
                    <div class="sb-teacher-title">${mi('science', 22)} Skill Battle</div>
                    <div class="sb-teacher-actions">
                        <button class="sb-btn sb-btn-refresh">${mi('refresh', 16)} 重新整理</button>
                        <button class="sb-btn sb-btn-execute-all">${mi('play_arrow', 16)} 全部執行</button>
                    </div>
                </div>
                <div class="sb-teacher-stats">
                    <span class="sb-stat">${mi('people', 16)} 提交：<b class="sb-count-submitted">0</b></span>
                    <span class="sb-stat">${mi('check_circle', 16)} 已評分：<b class="sb-count-scored">0</b></span>
                </div>
                <div class="sb-submissions-list"></div>
                <div class="sb-leaderboard-section">
                    <div class="sb-leaderboard-header">${mi('leaderboard', 20)} 排行榜</div>
                    <div class="sb-leaderboard"></div>
                </div>
                <div class="sb-execution-log"></div>
            </div>`;

        const listEl = el.querySelector('.sb-submissions-list');
        const leaderboardEl = el.querySelector('.sb-leaderboard');
        const logEl = el.querySelector('.sb-execution-log');
        const refreshBtn = el.querySelector('.sb-btn-refresh');
        const execAllBtn = el.querySelector('.sb-btn-execute-all');
        const countSubmitted = el.querySelector('.sb-count-submitted');
        const countScored = el.querySelector('.sb-count-scored');

        // 載入提交記錄
        const loadSubmissions = async () => {
            const { data } = await db.select('submissions', {
                filter: { element_id: 'eq.' + elementId, type: 'eq.skillBattle' },
                order: 'created_at.asc',
            });
            const subs = data || [];
            countSubmitted.textContent = subs.length;
            countScored.textContent = subs.filter(s => {
                try { return JSON.parse(s.state || '{}').status === 'scored'; } catch { return false; }
            }).length;

            // 提交清單
            listEl.innerHTML = subs.length === 0
                ? `<div class="sb-empty">${mi('inbox', 24)} 等待學員提交 Skill...</div>`
                : subs.map((s, i) => {
                    let state = {};
                    try { state = JSON.parse(s.state || '{}'); } catch {}
                    const name = s.student_name || s.student_email?.split('@')[0] || `學員${i + 1}`;
                    const status = state.status || 'pending';
                    const statusIcon = status === 'scored' ? mi('check_circle', 14) :
                        status === 'running' ? mi('progress_activity', 14) : mi('schedule', 14);
                    const statusClass = `sb-status-${status}`;
                    return `
                        <div class="sb-submission-item ${statusClass}" data-id="${s.id}" data-email="${s.student_email}">
                            <div class="sb-sub-info">
                                <span class="sb-sub-name">${esc(name)}</span>
                                <span class="sb-sub-status">${statusIcon} ${status === 'scored' ? state.score + ' 分' : status === 'running' ? '執行中...' : '等待執行'}</span>
                            </div>
                            <div class="sb-sub-skill">${esc((s.content || '').substring(0, 80))}${(s.content || '').length > 80 ? '...' : ''}</div>
                            ${status === 'pending' ? `<button class="sb-btn sb-btn-execute-one" data-submission-id="${s.id}">${mi('play_arrow', 14)} 執行</button>` : ''}
                        </div>`;
                }).join('');

            // 排行榜
            const scored = subs.filter(s => {
                try { return JSON.parse(s.state || '{}').status === 'scored'; } catch { return false; }
            }).map(s => {
                const state = JSON.parse(s.state || '{}');
                return {
                    name: s.student_name || s.student_email?.split('@')[0] || '?',
                    score: state.score || 0,
                    feedback: state.feedback || '',
                };
            }).sort((a, b) => b.score - a.score);

            if (scored.length > 0) {
                leaderboardEl.innerHTML = scored.map((s, i) => {
                    const medal = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                    const barW = Math.max(5, s.score);
                    const barC = s.score >= 80 ? '#22c55e' : s.score >= 60 ? '#eab308' : '#f97316';
                    return `
                        <div class="sb-rank-item ${medal ? 'sb-rank-' + medal : ''}">
                            <span class="sb-rank-num">${i + 1}</span>
                            <span class="sb-rank-name">${esc(s.name)}</span>
                            <div class="sb-rank-bar"><div style="width:${barW}%;background:${barC}"></div></div>
                            <span class="sb-rank-score">${s.score}</span>
                        </div>`;
                }).join('');
            } else {
                leaderboardEl.innerHTML = `<div class="sb-empty-board">${mi('pending', 18)} 尚無評分結果</div>`;
            }

            return subs;
        };

        await loadSubmissions();

        // 綁定事件
        refreshBtn.addEventListener('click', () => loadSubmissions());

        // 逐一執行
        listEl.addEventListener('click', async (e) => {
            const btn = e.target.closest('.sb-btn-execute-one');
            if (!btn) return;
            const subId = btn.dataset.submissionId;
            btn.disabled = true;
            btn.innerHTML = `${mi('progress_activity', 14)} 執行中...`;
            await this._executeOne(subId, element, logEl);
            await loadSubmissions();
        });

        // 全部執行
        execAllBtn.addEventListener('click', async () => {
            if (this._executing) return;
            this._executing = true;
            execAllBtn.disabled = true;
            execAllBtn.innerHTML = `${mi('progress_activity', 16)} 執行中...`;
            logEl.innerHTML = '';

            const subs = await loadSubmissions();
            const pending = subs.filter(s => {
                try { return JSON.parse(s.state || '{}').status === 'pending'; } catch { return false; }
            });

            this._appendLog(logEl, `開始執行 ${pending.length} 個 Skill...`, 'info');

            // 並發控制：一次 3 個
            const CONCURRENCY = 3;
            for (let i = 0; i < pending.length; i += CONCURRENCY) {
                const batch = pending.slice(i, i + CONCURRENCY);
                await Promise.all(batch.map(s => this._executeOne(s.id, element, logEl)));
                await loadSubmissions(); // 即時更新 UI
            }

            this._appendLog(logEl, `全部完成！`, 'success');
            this._executing = false;
            execAllBtn.disabled = false;
            execAllBtn.innerHTML = `${mi('play_arrow', 16)} 全部執行`;
        });

        // 自動刷新（每 8 秒）
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

            // Step 2: LLM-as-Judge 評分
            const judgePrompt = element.judgePrompt || `你是一位嚴格但公正的評審。

【任務描述】
${task}

【標準答案】
${reference}

【學員的 AI 輸出】
${output}

請根據以下標準評分（0-100）：
1. 內容正確性與完整度（40%）
2. 格式與結構（30%）
3. 表達清晰度（30%）

請只回傳 JSON 格式，不要有其他文字：
{"score": <整數0-100>, "feedback": "<20字以內的評語>"}`;

            const judgeResult = await ai.chat([
                { role: 'user', content: judgePrompt },
            ], { model, maxTokens: 200, temperature: 0.3 });

            // 解析分數
            let score = 50;
            let feedback = '';
            try {
                const jsonMatch = judgeResult.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    score = Math.min(100, Math.max(0, parseInt(parsed.score) || 50));
                    feedback = parsed.feedback || '';
                }
            } catch (e) {
                console.warn('Judge parse error:', e, judgeResult);
                feedback = '評分解析失敗';
            }

            // Step 3: 更新 DB
            const newState = { ...state, output, score, feedback, status: 'scored', executedAt: new Date().toISOString() };
            await db.update('submissions', { id: submissionId }, {
                state: JSON.stringify(newState),
                score: String(score),
                is_correct: score >= 60,
            });

            this._appendLog(logEl, `${mi('emoji_events', 14)} ${esc(studentName)} — <b>${score} 分</b>　${esc(feedback)}`, 'success');

            // Realtime 通知
            try {
                const sessionCode = stateManager._sessionCode || sessionStorage.getItem('_session_code') || '';
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
