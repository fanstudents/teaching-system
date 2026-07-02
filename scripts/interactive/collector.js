/**
 * 資料收集器 互動模組 — 業務開發競賽儀表板
 *
 * 學員的外部 AI Agent（跑在自己電腦上）透過 HTTP POST 把資料寫入
 * collector_entries，用專屬 token 辨識身份（不經過瀏覽器）。
 * 即時儀表板另見 collector-dashboard.html（獨立頁面）。
 */
import { stateManager } from './stateManager.js';
import { db } from '../supabase.js';

/* ── helpers ── */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mi = (n, s = 18) => `<span class="material-symbols-outlined" style="font-size:${s}px;vertical-align:middle">${n}</span>`;

const DEFAULT_FIELDS = [{ label: '客戶 Email' }, { label: '客戶名稱' }, { label: '客戶備注' }];

/* 系統保留變數：由程式自動代入，不會顯示成學員填寫欄位 */
const RESERVED_VARS = ['API_ENDPOINT', 'API_KEY', 'TOKEN', 'JSON_EXAMPLE'];

const DEFAULT_PROMPT_TEMPLATE = `你現在要協助我執行一項「業務開發資料回報」任務。

【背景】
我正在使用一套線上教學系統的「資料收集器」功能。每當你（我的 AI Agent）幫我開發到
一筆新的潛在客戶資料時，請立刻用 HTTP POST 的方式，把資料回報到下方指定的 API，
讓我可以即時在課堂排行榜上看到自己的進度。

【重要】下面的 token 就是用來辨識「這是我送出的資料」的唯一憑證，
請完整保留、不要省略、不要換成別的值，也不需要額外附上我的姓名或 email。

【API 網址】
POST {{API_ENDPOINT}}

【HTTP Headers】
apikey: {{API_KEY}}
Authorization: Bearer {{API_KEY}}
Content-Type: application/json

【JSON Body 格式】
{{JSON_EXAMPLE}}
（"token" 欄位請固定填 "{{TOKEN}}"，其餘欄位請填入你實際開發到的真實資料）

【執行時機】
每當你完成「一組」完整的客戶開發資料（也就是上面 JSON 裡列出的所有欄位都有內容了），
就立刻發送一次這個 POST 請求，不要等到所有客戶都找完才一次送出。
每一組客戶資料都是獨立的一次 POST（不要把多組客戶塞進同一個請求）。

【注意事項】
1. 欄位名稱請完全比照上面 JSON 範例的 key（一字不差），不要自己翻譯或改名。
2. 如果某個欄位暫時沒有資料，可以留空字串 ""，但請不要省略這個 key。
3. 送出後不需要等待或解析回應內容，繼續進行下一組客戶開發即可。
4. 如果收到錯誤（HTTP 狀態碼非 2xx），代表 token 可能已失效，
   請提醒我回到課堂簡報頁面重新整理，取得新的憑證。`;

function exampleFor(label) {
    const l = String(label).toLowerCase();
    if (l.includes('email') || label.includes('信箱') || label.includes('郵件')) return 'example@company.com';
    if (label.includes('電話') || l.includes('phone') || l.includes('tel')) return '0912-345-678';
    if (label.includes('公司') || l.includes('company')) return 'ABC 股份有限公司';
    if (label.includes('姓名') || label.includes('名稱') || l.includes('name')) return '王小明';
    return '（填入實際資料）';
}

function copyText(text) {
    return navigator.clipboard?.writeText(text).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    });
}

/* ═══════════════════════════════════════════════ */
export class CollectorGame {
    constructor() {
        this._intervals = new Map();
    }

    _fields(element) {
        return (element.fields && element.fields.length) ? element.fields : DEFAULT_FIELDS;
    }

    _dashboardUrl(sessionId, elementId) {
        return `collector-dashboard.html?session=${encodeURIComponent(sessionId || '')}&element=${encodeURIComponent(elementId || '')}`;
    }

    _bindCopy(root, selector, textFn) {
        root.querySelectorAll(selector).forEach(btn => {
            btn.addEventListener('click', () => {
                copyText(textFn(btn));
                const orig = btn.innerHTML;
                btn.innerHTML = `${mi('check', 14)} 已複製`;
                setTimeout(() => { btn.innerHTML = orig; }, 1500);
            });
        });
    }

    /* ── 編輯器畫布預覽 ── */
    renderPreview(el, element) {
        const fields = this._fields(element);
        el.innerHTML = `
            <div class="col-preview">
                <div class="col-preview-header">${mi('database', 20)} 資料收集器</div>
                <div class="col-preview-fields">${mi('list_alt', 14)} 欄位：${esc(fields.map(f => f.label).join('、'))}</div>
                <div class="col-preview-count">${mi('hourglass_top', 14)} 累計筆數：<span class="col-preview-count-num">—</span></div>
            </div>`;

        const sessionId = stateManager.getSessionCode();
        const elementId = el.closest('[data-id]')?.dataset.id || el.dataset.elementId || '';
        if (sessionId && elementId) {
            db.select('collector_entries', {
                filter: { session_id: `eq.${sessionId}`, element_id: `eq.${elementId}` },
                select: 'id',
            }).then(({ data }) => {
                const countEl = el.querySelector('.col-preview-count-num');
                if (countEl) countEl.textContent = data?.length ?? 0;
            }).catch(() => {});
        }
    }

    /* ── 簡報播放：依角色分派 ── */
    render(el, element, forceStudent) {
        const elementId = el.closest('[data-id]')?.dataset.id || el.dataset.elementId || '';
        el.dataset.elementId = elementId;
        el.classList.add('collector-container');

        const hwUser = sessionStorage.getItem('homework_user');
        const isPresenter = !!el.closest('.presentation-slide');
        const isStudent = forceStudent || (hwUser && !isPresenter);

        if (isStudent) {
            this._renderStudent(el, element, elementId);
        } else {
            this._renderTeacherLive(el, element, elementId);
        }
    }

    /* ═══════════════════════════════════════════════ */
    /*               學 員 端                          */
    /* ═══════════════════════════════════════════════ */
    async _renderStudent(el, element, elementId) {
        el.innerHTML = `<div class="col-student col-loading">${mi('hourglass_top', 20)} 準備你的專屬寫入憑證...</div>`;

        const user = stateManager.getUser();
        const sessionId = stateManager.getSessionCode();

        // 訪客 fallback：用穩定的本機隨機 id，避免每次重整都變成新訪客互搶 token
        let email = user?.email || '';
        let name = user?.name || '';
        if (!email) {
            let guestId = localStorage.getItem('_collector_guest_id');
            if (!guestId) {
                guestId = 'guest_' + Math.random().toString(36).slice(2, 10);
                localStorage.setItem('_collector_guest_id', guestId);
            }
            email = `${guestId}@guest.local`;
            name = name || '訪客';
        }

        const token = await this._mintToken(sessionId, elementId, email, name);
        if (!token) {
            el.innerHTML = `<div class="col-student col-error">${mi('error', 18)} 無法取得寫入憑證，請重新整理頁面再試一次。</div>`;
            return;
        }

        const fields = this._fields(element);
        const endpoint = `${db._baseUrl}/rest/v1/collector_entries`;
        const anonKey = db._anonKey;
        const bodyExample = { token, ...Object.fromEntries(fields.map(f => [f.label, exampleFor(f.label)])) };
        const headersExample = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' };

        // ── Prompt 範本：系統保留變數（端點/金鑰/token/JSON 範例）自動代入，
        //    其餘 {{變數}} 由老師自訂，顯示成學員必填的輸入框（比照複製卡） ──
        const rawTemplate = element.promptTemplate || DEFAULT_PROMPT_TEMPLATE;
        const systemFilled = rawTemplate
            .replaceAll('{{API_ENDPOINT}}', endpoint)
            .replaceAll('{{API_KEY}}', anonKey)
            .replaceAll('{{TOKEN}}', token)
            .replaceAll('{{JSON_EXAMPLE}}', JSON.stringify(bodyExample, null, 2));
        const studentVars = this._extractVars(systemFilled);
        let promptDisplayHtml = systemFilled.replace(/\n/g, '<br>');
        if (studentVars.length) {
            promptDisplayHtml = promptDisplayHtml.replace(/\{\{([^}]+)\}\}/g, (_, name) =>
                `<input type="text" class="col-var-input" data-var="${name}" placeholder="${name}" autocomplete="off">`);
        }

        el.innerHTML = `
            <div class="col-student">
                <div class="col-student-header">
                    ${mi('database', 20)} 資料收集器
                    <span class="col-contribution-badge"><span class="col-contribution-num">…</span> 筆已貢獻</span>
                </div>
                <div class="col-student-desc">${esc(element.question || '把你的 AI Agent 開發到的資料，依照下方格式即時回報到這裡。')}</div>

                <div class="col-block">
                    <div class="col-block-title">${mi('link', 14)} API 端點</div>
                    <div class="col-code-block">${esc(endpoint)}</div>
                </div>

                <div class="col-block">
                    <div class="col-block-title">${mi('key', 14)} Headers</div>
                    <pre class="col-code-block">${esc(JSON.stringify(headersExample, null, 2))}</pre>
                </div>

                <div class="col-block">
                    <div class="col-block-title">${mi('data_object', 14)} JSON Body 範例</div>
                    <pre class="col-code-block">${esc(JSON.stringify(bodyExample, null, 2))}</pre>
                </div>

                <div class="col-block col-prompt-block">
                    <div class="col-block-title">
                        ${mi('smart_toy', 14)} 貼給你的 AI Agent 的完整指令
                        <button class="col-copy-btn col-copy-prompt" ${studentVars.length ? 'disabled' : ''}>${mi('content_copy', 14)} 複製整段指令</button>
                    </div>
                    ${studentVars.length ? `<div class="col-var-hint">請先填寫上方反白欄位，再複製指令</div>` : ''}
                    <div class="col-prompt-template">${promptDisplayHtml}</div>
                </div>
            </div>`;

        // 學員自訂變數：全填滿才能複製；複製時把 {{變數}} 換成學員填的值
        const copyPromptBtn = el.querySelector('.col-copy-prompt');
        const varHintEl = el.querySelector('.col-var-hint');
        if (studentVars.length) {
            const checkFilled = () => {
                const inputs = el.querySelectorAll('.col-var-input');
                const allFilled = [...inputs].every(inp => inp.value.trim() !== '');
                copyPromptBtn.disabled = !allFilled;
                if (varHintEl) varHintEl.style.display = allFilled ? 'none' : '';
            };
            el.querySelectorAll('.col-var-input').forEach(inp => inp.addEventListener('input', checkFilled));
        }
        copyPromptBtn.addEventListener('click', () => {
            let finalText = systemFilled;
            el.querySelectorAll('.col-var-input').forEach(inp => {
                finalText = finalText.replaceAll(`{{${inp.dataset.var}}}`, inp.value.trim());
            });
            copyText(finalText);
            const orig = copyPromptBtn.innerHTML;
            copyPromptBtn.innerHTML = `${mi('check', 14)} 已複製`;
            setTimeout(() => { copyPromptBtn.innerHTML = orig; }, 1500);
        });

        const updateCount = async () => {
            const { data } = await db.select('collector_entries', {
                filter: { session_id: `eq.${sessionId}`, element_id: `eq.${elementId}`, student_email: `eq.${email}` },
                select: 'id',
            });
            const badge = el.querySelector('.col-contribution-num');
            if (badge) badge.textContent = data?.length ?? 0;
        };
        updateCount();
        const tid = setInterval(updateCount, 6000);
        this._intervals.set(elementId + '_student', tid);
    }

    /** select-or-insert：同一位學員重整頁面拿到同一組 token */
    async _mintToken(sessionId, elementId, email, name) {
        const { data } = await db.insert('collector_tokens', {
            session_id: sessionId, element_id: elementId,
            student_email: email, student_name: name,
        }, { onConflict: 'session_id,element_id,student_email' });

        if (data?.length) return data[0].token;

        // upsert 沒回傳（少見）→ 查一次既有的
        const sel = await db.select('collector_tokens', {
            filter: { session_id: `eq.${sessionId}`, element_id: `eq.${elementId}`, student_email: `eq.${email}` },
            limit: 1,
        });
        return sel.data?.[0]?.token || null;
    }

    /** 找出範本中「非系統保留」的 {{變數}}，即需要學員自己填寫的欄位 */
    _extractVars(text) {
        const re = /\{\{([^}]+)\}\}/g;
        const vars = [];
        let m;
        while ((m = re.exec(text)) !== null) {
            if (!RESERVED_VARS.includes(m[1]) && !vars.includes(m[1])) vars.push(m[1]);
        }
        return vars;
    }

    /* ═══════════════════════════════════════════════ */
    /*        教師端（簡報播放中，教師自己的畫面）        */
    /* ═══════════════════════════════════════════════ */
    async _renderTeacherLive(el, element, elementId) {
        const fields = this._fields(element);
        const sessionId = stateManager.getSessionCode();
        const dashboardUrl = this._dashboardUrl(sessionId, elementId);

        el.innerHTML = `
            <div class="col-teacher-live">
                <div class="col-teacher-header">
                    ${mi('database', 20)} 資料收集器
                    <a class="col-open-dashboard-btn" href="${esc(dashboardUrl)}" target="_blank" rel="noopener">
                        ${mi('open_in_new', 14)} 開啟即時儀表板
                    </a>
                </div>
                <div class="col-teacher-fields">${mi('list_alt', 14)} 欄位：${esc(fields.map(f => f.label).join('、'))}</div>
                <div class="col-teacher-stats">
                    <span class="col-stat">${mi('inbox', 14)} 總筆數：<b class="col-stat-total">0</b></span>
                    <span class="col-stat">${mi('groups', 14)} 參與人數：<b class="col-stat-people">0</b></span>
                </div>
                <div class="col-teacher-top5"></div>
            </div>`;

        const top5El = el.querySelector('.col-teacher-top5');
        const refresh = async () => {
            if (!sessionId || !elementId) return;
            const { data } = await db.select('collector_entries', {
                filter: { session_id: `eq.${sessionId}`, element_id: `eq.${elementId}` },
                select: 'student_email,student_name',
            });
            const rows = data || [];
            const byStudent = new Map();
            for (const r of rows) {
                const key = r.student_email || '?';
                if (!byStudent.has(key)) byStudent.set(key, { name: r.student_name || key, count: 0 });
                byStudent.get(key).count++;
            }
            const ranking = [...byStudent.values()].sort((a, b) => b.count - a.count).slice(0, 5);

            el.querySelector('.col-stat-total').textContent = rows.length;
            el.querySelector('.col-stat-people').textContent = byStudent.size;
            top5El.innerHTML = ranking.length ? ranking.map((r, i) => `
                <div class="col-top5-row">
                    <span class="col-top5-rank">${i + 1}</span>
                    <span class="col-top5-name">${esc(r.name)}</span>
                    <span class="col-top5-count">${r.count} 筆</span>
                </div>`).join('') : `<div class="col-empty">${mi('pending', 16)} 尚無資料</div>`;
        };
        refresh();
        const tid = setInterval(refresh, 6000);
        this._intervals.set(elementId + '_teacher', tid);
    }

    /* ── 清理 ── */
    destroy() {
        for (const [, id] of this._intervals) clearInterval(id);
        this._intervals.clear();
    }
}
