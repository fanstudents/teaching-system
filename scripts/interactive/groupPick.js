/**
 * 分組選擇器 — GroupPickGame
 * 學員選組 → homework_user.group → stateManager 後續自動帶入 student_group
 */

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const mi = (name, sz = 20) => `<span class="material-symbols-outlined" style="font-size:${sz}px">${name}</span>`;

const GROUP_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#f59e0b',
    '#8b5cf6', '#06b6d4', '#ec4899', '#f97316',
    '#14b8a6', '#6366f1'
];

export class GroupPickGame {

    /* ─── 編輯器預覽 ─── */
    renderPreview(el, element) {
        const n = element.groupCount || 4;
        el.innerHTML = `
        <div class="gp-preview">
            <div class="gp-preview-icon">👥</div>
            <div class="gp-preview-title">現場分組</div>
            <div class="gp-preview-sub">${n} 組 · 學員即時選組 · 組別計分</div>
        </div>`;
    }

    /* ─── 即時模式入口 ─── */
    render(el, element) {
        const isPresenter = !!el.closest('.presentation-slide');
        let hwUser = null;
        try { hwUser = JSON.parse(sessionStorage.getItem('homework_user') || 'null'); } catch {}

        if (hwUser && !isPresenter) {
            this._renderStudent(el, element);
        } else {
            this._renderTeacher(el, element);
        }
    }

    /* ═══════════════════════════════════════
       學員端
       ═══════════════════════════════════════ */
    async _renderStudent(el, element) {
        const { db } = await import('../supabase.js');
        const { stateManager } = await import('./stateManager.js');
        let user = {};
        try { user = JSON.parse(sessionStorage.getItem('homework_user') || '{}'); } catch {}
        const sessionCode = stateManager.getSessionCode();
        const elementId = element.id;
        const studentEmail = user.email || '';
        const studentName = user.name || '';

        const groupCount = element.groupCount || 4;
        const groupNames = element.groupNames || Array.from({length: groupCount}, (_, i) => `第 ${i+1} 組`);
        const groupColors = element.groupColors || GROUP_COLORS.slice(0, groupCount);

        let myGroup = user.group || null;

        const renderUI = (picks) => {
            // 統計各組人數
            const counts = {};
            (picks || []).forEach(p => {
                const g = p.content;
                counts[g] = (counts[g] || 0) + 1;
            });

            el.innerHTML = `
            <div class="gp-student">
                <div class="gp-student-title">${mi('groups', 20)} 選擇你的組別</div>
                <div class="gp-group-grid">
                    ${groupNames.slice(0, groupCount).map((name, i) => {
                        const idx = String(i + 1);
                        const color = groupColors[i] || GROUP_COLORS[i];
                        const sel = myGroup === idx ? 'selected' : '';
                        const cnt = counts[idx] || 0;
                        return `<button class="gp-group-btn ${sel}" data-group="${idx}" style="--gp-color:${color};border-color:${sel ? color : '#e2e8f0'}">
                            <div class="gp-group-btn-name">${esc(name)}</div>
                            <div class="gp-group-btn-count">${cnt} 人</div>
                        </button>`;
                    }).join('')}
                </div>
                ${myGroup ? `
                <div class="gp-selected-info">
                    <div class="gp-selected-label">你已加入 ${esc(groupNames[parseInt(myGroup) - 1] || '第'+myGroup+'組')}</div>
                    <div class="gp-selected-score" style="color:${groupColors[parseInt(myGroup)-1] || '#475569'}">
                        點擊其他組別可換組
                    </div>
                </div>` : ''}
            </div>`;

            // 綁定按鈕
            el.querySelectorAll('.gp-group-btn').forEach(btn => {
                btn.addEventListener('click', () => selectGroup(btn.dataset.group));
            });
        };

        const selectGroup = async (groupIdx) => {
            myGroup = groupIdx;
            // 更新 sessionStorage
            user.group = groupIdx;
            sessionStorage.setItem('homework_user', JSON.stringify(user));

            // 寫入 DB
            await db.insert('submissions', {
                session_id: sessionCode,
                element_id: elementId,
                student_name: studentName,
                student_email: studentEmail,
                type: 'groupPick',
                content: groupIdx,
                state: JSON.stringify({ group: groupIdx, groupName: groupNames[parseInt(groupIdx)-1] }),
                submitted_at: new Date().toISOString()
            }, { onConflict: 'session_id,element_id,student_email' });

            // 重新載入
            await loadAndRender();
        };

        const loadAndRender = async () => {
            const filter = {
                type: 'eq.groupPick',
                element_id: 'eq.' + elementId,
            };
            if (sessionCode) filter.session_id = 'eq.' + sessionCode;
            const { data } = await db.select('submissions', { filter });
            renderUI(data || []);
        };

        // 偵測已選組
        const filter0 = {
            type: 'eq.groupPick',
            element_id: 'eq.' + elementId,
            student_email: 'eq.' + studentEmail,
        };
        if (sessionCode) filter0.session_id = 'eq.' + sessionCode;
        const { data: existing } = await db.select('submissions', { filter: filter0 });
        if (existing?.[0]) {
            myGroup = existing[0].content;
            user.group = myGroup;
            sessionStorage.setItem('homework_user', JSON.stringify(user));
        }

        await loadAndRender();

        // Polling 每 5 秒
        this._studentTimer = setInterval(loadAndRender, 5000);
    }

    /* ═══════════════════════════════════════
       講師端
       ═══════════════════════════════════════ */
    async _renderTeacher(el, element) {
        const { db } = await import('../supabase.js');
        const { stateManager } = await import('./stateManager.js');
        const sessionCode = window._activeSessionUUID || stateManager.getSessionCode();
        const elementId = element.id;

        const groupCount = element.groupCount || 4;
        const groupNames = element.groupNames || Array.from({length: groupCount}, (_, i) => `第 ${i+1} 組`);
        const groupColors = element.groupColors || GROUP_COLORS.slice(0, groupCount);

        el.innerHTML = `
        <div class="gp-teacher">
            <div class="gp-teacher-header">
                <div class="gp-teacher-title">${mi('groups', 22)} 現場分組</div>
                <div class="gp-teacher-stats"></div>
            </div>
            <div class="gp-team-grid"></div>
        </div>`;

        const gridEl = el.querySelector('.gp-team-grid');
        const statsEl = el.querySelector('.gp-teacher-stats');
        let lastHash = '';

        const load = async () => {
            // 1. 讀取分組
            const pickFilter = { type: 'eq.groupPick', element_id: 'eq.' + elementId };
            if (sessionCode) pickFilter.session_id = 'eq.' + sessionCode;
            const { data: picks } = await db.select('submissions', { filter: pickFilter });
            const pickList = picks || [];

            // 2. 建立組別 → 成員對照
            const groups = {}; // groupIdx → [{name, email}]
            pickList.forEach(p => {
                const g = p.content;
                if (!groups[g]) groups[g] = [];
                groups[g].push({
                    name: p.student_name || p.student_email?.split('@')[0] || '學員',
                    email: p.student_email
                });
            });

            // 3. 讀取該 session 所有分數
            const scoreFilter = { session_id: 'eq.' + sessionCode };
            const { data: allSubs } = await db.select('submissions', {
                filter: scoreFilter,
                select: 'student_email,score,student_group'
            });

            // 4. 按組累計分數
            const groupScores = {};
            (allSubs || []).forEach(s => {
                const g = s.student_group;
                if (g) {
                    groupScores[g] = (groupScores[g] || 0) + (parseFloat(s.score) || 0);
                }
            });

            // hash 比對
            const hash = JSON.stringify({ groups, groupScores });
            if (hash === lastHash) return;
            lastHash = hash;

            // 統計
            const total = pickList.length;
            statsEl.textContent = `${total} 人已分組`;

            // 渲染卡片
            gridEl.innerHTML = Array.from({length: groupCount}, (_, i) => {
                const idx = String(i + 1);
                const color = groupColors[i] || GROUP_COLORS[i];
                const name = groupNames[i] || `第 ${idx} 組`;
                const members = groups[idx] || [];
                const score = Math.round(groupScores[idx] || 0);

                return `
                <div class="gp-team-card" style="--gp-color:${color}">
                    <div class="gp-team-card-header">
                        <div class="gp-team-card-name">${esc(name)}</div>
                        <div class="gp-team-card-score">${score}</div>
                    </div>
                    <div class="gp-team-card-count">${mi('person', 14)} ${members.length} 人</div>
                    <div class="gp-team-card-members">
                        ${members.map(m => `<span class="gp-member-chip">${esc(m.name)}</span>`).join('')}
                    </div>
                </div>`;
            }).join('');
        };

        await load();
        this._teacherTimer = setInterval(load, 5000);
    }
}
