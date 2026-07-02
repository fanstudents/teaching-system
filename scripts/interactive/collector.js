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
const RESERVED_VARS = ['API_ENDPOINT', 'API_KEY', 'TOKEN', 'JSON_EXAMPLE', 'FIELD_LIST'];

const DEFAULT_PROMPT_TEMPLATE = `【背景與授權】
接續你剛才在這個對話裡，依照 Agent 設定檔找到的那 10 組潛在客戶
資料——我正在使用我自己帳號底下的一套線上教學平台，這是我這堂課
的課堂練習。現在請你把剛才找到的每一筆資料，用一般的 HTTP API
呼叫方式，提交到下方這個屬於我這堂課的端點，讓我可以在課堂的即時
排行榜上看到我的進度。這筆資料只用於這堂課當下的即時排行榜顯示，
不是要建立永久客戶資料庫。

【這是什麼】
下面的 token 是這個平台核發給「我」的識別碼，伺服器會用它辨識這是
我送出的資料，所以不需要你額外幫我加上姓名或 email。請原樣照抄
這個值，不要更改。

【API 呼叫方式】
POST {{API_ENDPOINT}}

Headers：
apikey: {{API_KEY}}
Authorization: Bearer {{API_KEY}}
Content-Type: application/json

Body 格式（JSON）：
{{JSON_EXAMPLE}}
"token" 欄位請固定填 "{{TOKEN}}"，其餘欄位請依照你剛才找到的每一筆
真實資料填入。

【怎麼提交、要不要跟我確認】
把你剛才找到的那 10 組潛在客戶資料，依序逐筆呼叫這支 API，一組
資料呼叫一次，不要把多組資料塞進同一次呼叫。如果你認為每次呼叫前
先跟我確認一下內容比較妥當，請照你的判斷跟我確認，我不介意多一個
確認步驟。全部送出後，跟我回報一共成功提交了幾筆。

【欄位規則】
1. 欄位名稱請完全比照上面 JSON 範例的 key（一字不差），不要自己翻譯或改名。
2. 欄位暫時沒有資料可以留空字串 ""，但請保留這個 key。
3. 如果呼叫回傳非 2xx 的錯誤，請直接告訴我發生了什麼錯誤，我會自己
   確認處理（可能是憑證過期，我會回到課堂頁面重新整理拿新的）。`;

const DEFAULT_AGENT_BUILDER_PROMPT = `我要打造一個屬於我自己的「業務開發 Agent」。

【我的開發條件】
- 目標對象（我想開發的客戶類型）：{{目標對象}}
- 地區：{{地區}}
- 客戶屬性（規模、產業、痛點等篩選條件）：{{客戶屬性}}
- 產出欄位（請完全比照，一字不差，不要自己翻譯或改名）：{{FIELD_LIST}}

請直接動手做，不要先列一堆說明或跟我確認：

1. 在目前這個專案資料夾裡建立一個檔案（例如 CLAUDE.md 或
   agents/業務開發-agent.md），把這個 Agent 的設定寫進去：目標客群、
   篩選條件、判斷一個潛在客戶是否合格的具體標準、以及上面列出的
   產出欄位格式。

2. 建好之後，直接依照這份設定，實際找出 10 組符合條件的潛在客戶
   名單，每一組都要包含「產出欄位」列出的所有項目，列成清單給我看。

除了那個設定檔和這 10 筆名單以外，不要輸出其他說明、選項比較或
討論過程 —— 我只要「做好的 Agent 設定檔」和「10 筆名單」這兩個結果。`;

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
        // 注意：自訂欄位必須包在 data（jsonb）裡面，不能跟 token 平級 ——
        // collector_entries 表只有 token/data 等固定欄位，"客戶 Email" 這類
        // 老師自訂欄位不是真實的資料表欄位，寫在最外層會被 PostgREST 拒絕（PGRST204）
        const bodyExample = { token, data: Object.fromEntries(fields.map(f => [f.label, exampleFor(f.label)])) };

        // 系統保留變數：兩段提示詞都能用，自動代入，不需要學員手動輸入
        const systemValues = {
            API_ENDPOINT: endpoint,
            API_KEY: anonKey,
            TOKEN: token,
            JSON_EXAMPLE: JSON.stringify(bodyExample, null, 2),
            FIELD_LIST: fields.map(f => f.label).join('、'),
        };
        const applySystemVars = text => Object.entries(systemValues)
            .reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v), text);

        // ── Prompt 1：打造你的業務開發 Agent（此時還沒有 Agent） ──
        const builderText = applySystemVars(element.agentBuilderPrompt || DEFAULT_AGENT_BUILDER_PROMPT);

        // ── Prompt 2：把回報格式教給做好的 Agent ──
        const reportText = applySystemVars(element.promptTemplate || DEFAULT_PROMPT_TEMPLATE);

        // 兩段共用同一組「學員自訂變數」（例如 {{目標客群}}），填一次、兩段都套用
        const allVars = [...new Set([...this._extractVars(builderText), ...this._extractVars(reportText)])];
        const toDisplayHtml = text => {
            let html = text.replace(/\n/g, '<br>');
            if (allVars.length) {
                html = html.replace(/\{\{([^}]+)\}\}/g, (_, name) =>
                    `<input type="text" class="col-var-input" data-var="${name}" placeholder="${name}" autocomplete="off">`);
            }
            return html;
        };

        el.innerHTML = `
            <div class="col-student">
                <div class="col-student-header">
                    ${mi('database', 20)} 資料收集器
                    <span class="col-contribution-badge"><span class="col-contribution-num">…</span> 筆已貢獻</span>
                </div>
                <div class="col-student-desc">${esc(element.question || '把你的 AI Agent 開發到的資料，依照下方格式即時回報到這裡。')}</div>

                ${allVars.length ? `<div class="col-var-hint">請先填寫下方反白欄位，兩段會一起解鎖</div>` : ''}

                <div class="col-prompt-row">
                    <div class="col-block col-prompt-block">
                        <div class="col-block-title">
                            ${mi('looks_one', 14)} 步驟 1：貼給 AI，打造你的業務開發 Agent
                            <button class="col-copy-btn col-copy-prompt" data-target="builder" ${allVars.length ? 'disabled' : ''}>${mi('content_copy', 14)} 複製</button>
                        </div>
                        <div class="col-prompt-template">${toDisplayHtml(builderText)}</div>
                    </div>

                    <div class="col-block col-prompt-block">
                        <div class="col-block-title">
                            ${mi('looks_two', 14)} 步驟 2：把回報格式教給做好的 Agent
                            <button class="col-copy-btn col-copy-prompt" data-target="report" ${allVars.length ? 'disabled' : ''}>${mi('content_copy', 14)} 複製</button>
                        </div>
                        <div class="col-prompt-template">${toDisplayHtml(reportText)}</div>
                    </div>
                </div>
            </div>`;

        // 學員自訂變數：全填滿才能複製；同名變數跨兩段自動同步；複製時把 {{變數}} 換成填入的值
        const copyBtns = el.querySelectorAll('.col-copy-prompt');
        const varHintEl = el.querySelector('.col-var-hint');
        if (allVars.length) {
            const checkFilled = () => {
                const byVar = new Map();
                el.querySelectorAll('.col-var-input').forEach(inp => {
                    if (!byVar.has(inp.dataset.var)) byVar.set(inp.dataset.var, inp.value.trim());
                });
                const allFilled = [...byVar.values()].every(v => v !== '');
                copyBtns.forEach(btn => { btn.disabled = !allFilled; });
                if (varHintEl) varHintEl.style.display = allFilled ? 'none' : '';
            };
            el.querySelectorAll('.col-var-input').forEach(inp => {
                inp.addEventListener('input', () => {
                    // 同名變數跨區塊同步
                    el.querySelectorAll(`.col-var-input[data-var="${inp.dataset.var}"]`).forEach(other => {
                        if (other !== inp) other.value = inp.value;
                    });
                    checkFilled();
                });
            });
        }
        copyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                let finalText = btn.dataset.target === 'builder' ? builderText : reportText;
                el.querySelectorAll('.col-var-input').forEach(inp => {
                    finalText = finalText.replaceAll(`{{${inp.dataset.var}}}`, inp.value.trim());
                });
                copyText(finalText);
                const orig = btn.innerHTML;
                btn.innerHTML = `${mi('check', 14)} 已複製`;
                setTimeout(() => { btn.innerHTML = orig; }, 1500);
            });
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

    /**
     * select-or-insert：同一位學員重整頁面拿到同一組 token。
     * 多位學員同時翻到這頁時，任何一次請求都可能碰上瞬斷，
     * 失敗時重試最多 2 次（遞增等待），降低偶發錯誤直接卡住學員的機率。
     */
    async _mintToken(sessionId, elementId, email, name, attempt = 0) {
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
        if (sel.data?.[0]?.token) return sel.data[0].token;

        if (attempt < 2) {
            await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
            return this._mintToken(sessionId, elementId, email, name, attempt + 1);
        }
        return null;
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
