/**
 * 分組選擇器 — GroupPickGame
 * 學員選組 → homework_user.group → stateManager 後續自動帶入 student_group
 * 支援自由拖曳擺放組別位置（模擬教室桌位）
 */

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const mi = (name, sz = 20) => `<span class="material-symbols-outlined" style="font-size:${sz}px">${name}</span>`;

const GROUP_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#f59e0b',
    '#8b5cf6', '#06b6d4', '#ec4899', '#f97316',
    '#14b8a6', '#6366f1'
];

/** 預設 grid 位置（%），4 組為例 */
function defaultPositions(n) {
    const cols = Math.min(n, 4);
    const rows = Math.ceil(n / cols);
    const result = [];
    for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        result.push({
            x: 10 + c * (80 / Math.max(cols - 1, 1)),
            y: 15 + r * (70 / Math.max(rows - 1, 1))
        });
    }
    // 只有 1 行時置中偏上
    if (rows === 1) result.forEach(p => p.y = 35);
    return result;
}

export class GroupPickGame {

    /* ─── 編輯器預覽（可拖曳卡片位置）─── */
    renderPreview(el, element) {
        const n = element.groupCount || 4;
        const names = element.groupNames || Array.from({length: n}, (_, i) => `第 ${i+1} 組`);
        const colors = element.groupColors || GROUP_COLORS.slice(0, n);
        if (!element.groupPositions || element.groupPositions.length !== n) {
            element.groupPositions = defaultPositions(n);
        }
        const pos = element.groupPositions;

        el.innerHTML = `
        <div class="gp-canvas">
            <div class="gp-canvas-hint">${mi('open_with', 14)} 拖曳卡片排列教室座位</div>
            ${pos.map((p, i) => `
                <div class="gp-drag-card" data-idx="${i}"
                     style="--gp-color:${colors[i]};left:${p.x}%;top:${p.y}%">
                    <div class="gp-drag-card-name">${esc(names[i])}</div>
                </div>
            `).join('')}
        </div>`;

        // 拖曳邏輯
        this._enableDrag(el.querySelector('.gp-canvas'), pos, () => {
            element.groupPositions = [...pos];
            window.dispatchEvent(new Event('slideContentChanged'));
        });
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
        const pos = element.groupPositions || defaultPositions(groupCount);

        let myGroup = user.group || null;

        const renderUI = (picks) => {
            const counts = {};
            (picks || []).forEach(p => {
                const g = p.content;
                counts[g] = (counts[g] || 0) + 1;
            });

            el.innerHTML = `
            <div class="gp-canvas gp-canvas--student">
                <div class="gp-student-title">${mi('groups', 20)} 點擊選擇你的組別</div>
                ${pos.slice(0, groupCount).map((p, i) => {
                    const idx = String(i + 1);
                    const color = groupColors[i] || GROUP_COLORS[i];
                    const sel = myGroup === idx;
                    const cnt = counts[idx] || 0;
                    return `<button class="gp-pos-btn ${sel ? 'selected' : ''}" data-group="${idx}"
                        style="--gp-color:${color};left:${p.x}%;top:${p.y}%;border-color:${sel ? color : '#e2e8f0'}">
                        <div class="gp-pos-btn-name">${esc(groupNames[i])}</div>
                        <div class="gp-pos-btn-count">${cnt} 人</div>
                        ${sel ? `<div class="gp-pos-btn-check">${mi('check_circle', 16)}</div>` : ''}
                    </button>`;
                }).join('')}
                ${myGroup ? `
                <div class="gp-float-info">
                    已加入 <b style="color:${groupColors[parseInt(myGroup)-1] || '#475569'}">${esc(groupNames[parseInt(myGroup)-1] || '第'+myGroup+'組')}</b>
                    · 點擊其他組別可換組
                </div>` : ''}
            </div>`;

            el.querySelectorAll('.gp-pos-btn').forEach(btn => {
                btn.addEventListener('click', () => selectGroup(btn.dataset.group));
            });
        };

        const selectGroup = async (groupIdx) => {
            myGroup = groupIdx;
            user.group = groupIdx;
            sessionStorage.setItem('homework_user', JSON.stringify(user));

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

            await loadAndRender();
        };

        const loadAndRender = async () => {
            const filter = { type: 'eq.groupPick', element_id: 'eq.' + elementId };
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
        this._studentTimer = setInterval(loadAndRender, 5000);
    }

    /* ═══════════════════════════════════════
       講師端（可拖曳）
       ═══════════════════════════════════════ */
    async _renderTeacher(el, element) {
        const { db } = await import('../supabase.js');
        const { stateManager } = await import('./stateManager.js');
        const sessionCode = window._activeSessionUUID || stateManager.getSessionCode();
        const elementId = element.id;

        const groupCount = element.groupCount || 4;
        const groupNames = element.groupNames || Array.from({length: groupCount}, (_, i) => `第 ${i+1} 組`);
        const groupColors = element.groupColors || GROUP_COLORS.slice(0, groupCount);
        if (!element.groupPositions || element.groupPositions.length !== groupCount) {
            element.groupPositions = defaultPositions(groupCount);
        }
        const pos = element.groupPositions;

        el.innerHTML = `
        <div class="gp-canvas gp-canvas--teacher">
            <div class="gp-teacher-header">
                <div class="gp-teacher-title">${mi('groups', 22)} 現場分組</div>
                <div class="gp-teacher-stats"></div>
            </div>
            <div class="gp-canvas-hint">${mi('open_with', 14)} 可拖曳調整桌位</div>
        </div>`;

        const canvas = el.querySelector('.gp-canvas');
        const statsEl = el.querySelector('.gp-teacher-stats');
        let lastHash = '';

        const load = async () => {
            // 1. 讀取分組
            const pickFilter = { type: 'eq.groupPick', element_id: 'eq.' + elementId };
            if (sessionCode) pickFilter.session_id = 'eq.' + sessionCode;
            const { data: picks } = await db.select('submissions', { filter: pickFilter });
            const pickList = picks || [];

            // 2. 組別 → 成員
            const groups = {};
            pickList.forEach(p => {
                const g = p.content;
                if (!groups[g]) groups[g] = [];
                groups[g].push({
                    name: p.student_name || p.student_email?.split('@')[0] || '學員',
                    email: p.student_email
                });
            });

            // 3. 分數
            const scoreFilter = { session_id: 'eq.' + sessionCode };
            const { data: allSubs } = await db.select('submissions', {
                filter: scoreFilter,
                select: 'student_email,score,student_group'
            });
            const groupScores = {};
            (allSubs || []).forEach(s => {
                const g = s.student_group;
                if (g) groupScores[g] = (groupScores[g] || 0) + (parseFloat(s.score) || 0);
            });

            const hash = JSON.stringify({ groups, groupScores });
            if (hash === lastHash) return;
            lastHash = hash;

            statsEl.textContent = `${pickList.length} 人已分組`;

            // 移除舊卡片（保留 header + hint）
            canvas.querySelectorAll('.gp-team-card').forEach(c => c.remove());

            // 渲染卡片（絕對定位）
            for (let i = 0; i < groupCount; i++) {
                const idx = String(i + 1);
                const color = groupColors[i] || GROUP_COLORS[i];
                const name = groupNames[i] || `第 ${idx} 組`;
                const members = groups[idx] || [];
                const score = Math.round(groupScores[idx] || 0);
                const p = pos[i] || { x: 10, y: 10 };

                const card = document.createElement('div');
                card.className = 'gp-team-card gp-team-card--abs';
                card.dataset.idx = String(i);
                card.style.cssText = `--gp-color:${color};left:${p.x}%;top:${p.y}%`;
                card.innerHTML = `
                    <div class="gp-team-card-header">
                        <div class="gp-team-card-name">${esc(name)}</div>
                        <div class="gp-team-card-score">${score}</div>
                    </div>
                    <div class="gp-team-card-count">${mi('person', 14)} ${members.length} 人</div>
                    <div class="gp-team-card-members">
                        ${members.map(m => `<span class="gp-member-chip">${esc(m.name)}</span>`).join('')}
                    </div>`;
                canvas.appendChild(card);
            }

            // 啟用拖曳
            this._enableDrag(canvas, pos, () => {
                element.groupPositions = [...pos];
                // 講師端 presentation mode 通常不能直接存，但位置會保留在記憶體
                try { window.dispatchEvent(new Event('slideContentChanged')); } catch {}
            });
        };

        await load();
        this._teacherTimer = setInterval(load, 5000);
    }

    /* ═══════════════════════════════════════
       拖曳引擎（共用）
       ═══════════════════════════════════════ */
    _enableDrag(canvas, positions, onEnd) {
        if (!canvas) return;
        const cards = canvas.querySelectorAll('[data-idx]');
        cards.forEach(card => {
            // 避免重複綁定
            if (card._gpDragBound) return;
            card._gpDragBound = true;

            let startX, startY, origX, origY, dragging = false;

            const onPointerDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                dragging = true;
                const rect = canvas.getBoundingClientRect();
                startX = (e.touches ? e.touches[0].clientX : e.clientX);
                startY = (e.touches ? e.touches[0].clientY : e.clientY);
                const idx = parseInt(card.dataset.idx);
                origX = positions[idx]?.x ?? 0;
                origY = positions[idx]?.y ?? 0;
                card.style.zIndex = '10';
                card.style.transition = 'none';
                card.classList.add('gp-dragging');
            };

            const onPointerMove = (e) => {
                if (!dragging) return;
                e.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const cx = (e.touches ? e.touches[0].clientX : e.clientX);
                const cy = (e.touches ? e.touches[0].clientY : e.clientY);
                const dx = ((cx - startX) / rect.width) * 100;
                const dy = ((cy - startY) / rect.height) * 100;
                const nx = Math.max(0, Math.min(85, origX + dx));
                const ny = Math.max(0, Math.min(85, origY + dy));
                card.style.left = nx + '%';
                card.style.top = ny + '%';
            };

            const onPointerUp = () => {
                if (!dragging) return;
                dragging = false;
                card.style.zIndex = '';
                card.style.transition = '';
                card.classList.remove('gp-dragging');
                const idx = parseInt(card.dataset.idx);
                positions[idx] = {
                    x: parseFloat(card.style.left),
                    y: parseFloat(card.style.top)
                };
                if (onEnd) onEnd();
            };

            card.addEventListener('mousedown', onPointerDown);
            card.addEventListener('touchstart', onPointerDown, { passive: false });
            document.addEventListener('mousemove', onPointerMove);
            document.addEventListener('touchmove', onPointerMove, { passive: false });
            document.addEventListener('mouseup', onPointerUp);
            document.addEventListener('touchend', onPointerUp);
        });
    }
}
