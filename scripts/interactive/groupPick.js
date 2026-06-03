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

/** 預設 grid 位置（%） */
function defaultPositions(n) {
    const cols = Math.min(n, 4);
    const rows = Math.ceil(n / cols);
    const result = [];
    for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const xSpacing = cols <= 1 ? 0 : 70 / (cols - 1);
        const ySpacing = rows <= 1 ? 0 : 50 / (rows - 1);
        result.push({
            x: 15 + c * xSpacing,
            y: 25 + r * ySpacing
        });
    }
    if (rows === 1) result.forEach(p => p.y = 40);
    return result;
}

export class GroupPickGame {

    /* ─── 編輯器預覽 ─── */
    renderPreview(el, element) {
        const n = element.groupCount || 4;
        const names = element.groupNames || Array.from({length: n}, (_, i) => `第 ${i+1} 組`);
        const colors = element.groupColors || GROUP_COLORS.slice(0, n);
        const pos = element.groupPositions || defaultPositions(n);

        el.innerHTML = `
        <div class="gp-canvas gp-canvas--editor">
            <div class="gp-canvas-header">
                <span>👥 現場分組 · ${n} 組</span>
            </div>
            ${pos.slice(0, n).map((p, i) => `
                <div class="gp-drag-card" style="--gp-color:${colors[i] || GROUP_COLORS[i]};left:${p.x}%;top:${p.y}%">
                    <div class="gp-drag-card-name">${esc(names[i] || '第'+(i+1)+'組')}</div>
                </div>
            `).join('')}
            <button class="gp-arrange-btn" title="排列座位">
                ${mi('open_with', 18)} 排列座位
            </button>
        </div>`;

        el.querySelector('.gp-arrange-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this._openArrangeModal(element);
        });
    }

    /* ─── 排列座位彈窗 ─── */
    _openArrangeModal(element) {
        document.getElementById('gpArrangeOverlay')?.remove();

        const n = element.groupCount || 4;
        const names = element.groupNames || Array.from({length: n}, (_, i) => `第 ${i+1} 組`);
        const colors = element.groupColors || GROUP_COLORS.slice(0, n);
        if (!element.groupPositions || element.groupPositions.length !== n) {
            element.groupPositions = defaultPositions(n);
        }
        const pos = element.groupPositions;

        const overlay = document.createElement('div');
        overlay.id = 'gpArrangeOverlay';
        overlay.className = 'gp-modal-overlay';
        overlay.innerHTML = `
            <div class="gp-modal">
                <div class="gp-modal-header">
                    <div class="gp-modal-title">${mi('open_with', 22)} 拖曳排列教室座位</div>
                    <button class="gp-modal-close">${mi('close', 22)}</button>
                </div>
                <div class="gp-modal-canvas" id="gpModalCanvas">
                    <div class="gp-modal-canvas-label">講台</div>
                    ${pos.slice(0, n).map((p, i) => `
                        <div class="gp-drag-card" data-idx="${i}"
                             style="--gp-color:${colors[i] || GROUP_COLORS[i]};left:${p.x}%;top:${p.y}%">
                            <div class="gp-drag-card-name">${esc(names[i] || '第'+(i+1)+'組')}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="gp-modal-footer">
                    <button class="gp-modal-reset">${mi('restart_alt', 16)} 重設位置</button>
                    <button class="gp-modal-save">${mi('check', 18)} 完成</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);

        const canvas = document.getElementById('gpModalCanvas');
        this._enableDrag(canvas, pos);

        overlay.querySelector('.gp-modal-reset').addEventListener('click', () => {
            const newPos = defaultPositions(n);
            newPos.forEach((p, i) => { pos[i] = p; });
            canvas.querySelectorAll('.gp-drag-card').forEach((card, i) => {
                card.style.left = pos[i].x + '%';
                card.style.top = pos[i].y + '%';
            });
        });

        const closeModal = () => {
            element.groupPositions = [...pos];
            window.dispatchEvent(new Event('slideContentChanged'));
            overlay.remove();
            const editorEl = document.querySelector(`[data-element-id="${element.id}"]`);
            if (editorEl) {
                const inner = editorEl.querySelector('.element-content') || editorEl;
                this.renderPreview(inner, element);
            }
        };

        overlay.querySelector('.gp-modal-close').addEventListener('click', closeModal);
        overlay.querySelector('.gp-modal-save').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
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
                        style="--gp-color:${color};left:${p.x}%;top:${p.y}%">
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
                student_group: groupIdx,
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
       講師端 — 破冰牆模式
       ═══════════════════════════════════════ */
    async _renderTeacher(el, element) {
        const { db } = await import('../supabase.js');
        const { stateManager } = await import('./stateManager.js');
        const sessionCode = window._activeSessionUUID || stateManager.getSessionCode();
        const elementId = element.id;

        const groupCount = element.groupCount || 4;
        const groupNames = element.groupNames || Array.from({length: groupCount}, (_, i) => `第 ${i+1} 組`);
        const groupColors = element.groupColors || GROUP_COLORS.slice(0, groupCount);

        let scoreMode = 'total';

        el.innerHTML = `
        <div class="gp-canvas gp-canvas--teacher" style="overflow-y:auto;display:flex;flex-direction:column;">
            <div class="gp-teacher-header" style="position:relative;">
                <div class="gp-teacher-title">${mi('groups', 22)} 現場分組</div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div class="gp-score-toggle" style="display:flex;gap:2px;background:rgba(0,0,0,.06);border-radius:6px;padding:2px;">
                        <button class="gp-mode-btn active" data-mode="total" style="padding:3px 10px;border:none;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;background:#fff;color:#1a73e8;box-shadow:0 1px 3px rgba(0,0,0,.1);">${mi('functions', 14)} 總分</button>
                        <button class="gp-mode-btn" data-mode="avg" style="padding:3px 10px;border:none;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;background:transparent;color:#80868b;">${mi('calculate', 14)} 平均</button>
                    </div>
                    <div class="gp-teacher-stats"></div>
                </div>
            </div>
            <div class="gp-wall" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:12px 8px 16px;flex:1;align-content:start;"></div>
        </div>`;

        const wallEl = el.querySelector('.gp-wall');
        const statsEl = el.querySelector('.gp-teacher-stats');
        let lastHash = '';

        // 切換總分/平均
        el.querySelectorAll('.gp-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                scoreMode = btn.dataset.mode;
                el.querySelectorAll('.gp-mode-btn').forEach(b => {
                    const isActive = b === btn;
                    b.classList.toggle('active', isActive);
                    b.style.background = isActive ? '#fff' : 'transparent';
                    b.style.color = isActive ? '#1a73e8' : '#80868b';
                    b.style.boxShadow = isActive ? '0 1px 3px rgba(0,0,0,.1)' : 'none';
                });
                lastHash = '';
                load();
            });
        });

        const load = async () => {
            const pickFilter = { type: 'eq.groupPick', element_id: 'eq.' + elementId };
            if (sessionCode) pickFilter.session_id = 'eq.' + sessionCode;
            const { data: picks } = await db.select('submissions', { filter: pickFilter });
            const pickList = picks || [];

            const groups = {};
            pickList.forEach(p => {
                const g = p.content;
                if (!groups[g]) groups[g] = [];
                groups[g].push({
                    name: p.student_name || p.student_email?.split('@')[0] || '學員',
                    email: p.student_email
                });
            });

            const scoreFilter = { session_id: 'eq.' + sessionCode };
            const { data: allSubs } = await db.select('submissions', {
                filter: scoreFilter,
                select: 'student_email,state,student_group'
            });
            const groupScores = {};
            (allSubs || []).forEach(s => {
                const g = s.student_group;
                if (!g) return;
                let st = s.state;
                if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
                groupScores[g] = (groupScores[g] || 0) + (parseFloat(st?._awarded) || 0);
            });

            const hash = JSON.stringify({ groups, groupScores, scoreMode });
            if (hash === lastHash) return;
            lastHash = hash;

            statsEl.textContent = `${pickList.length} 人已分組`;

            const calcScore = (total, memberCount) => {
                if (scoreMode === 'avg' && memberCount > 0) return (total / memberCount).toFixed(2);
                return Math.round(total);
            };

            wallEl.innerHTML = Array.from({length: groupCount}, (_, i) => {
                const idx = String(i + 1);
                const color = groupColors[i] || GROUP_COLORS[i];
                const name = groupNames[i] || `第 ${idx} 組`;
                const members = groups[idx] || [];
                const totalScore = groupScores[idx] || 0;
                const score = calcScore(totalScore, members.length);
                const scoreLabel = scoreMode === 'avg' ? '平均' : '總分';

                return `<div class="gp-wall-card" style="--gp-color:${color};">
                    <div class="gp-wall-card-top">
                        <div class="gp-wall-card-color" style="background:${color};"></div>
                        <div class="gp-wall-card-info">
                            <div class="gp-wall-card-name">${esc(name)}</div>
                            <div class="gp-wall-card-meta">
                                ${mi('person', 14)} <b>${members.length}</b> 人
                                <span style="margin-left:8px;">${scoreLabel} <b>${score}</b></span>
                            </div>
                        </div>
                    </div>
                    <div class="gp-wall-members">
                        ${members.length ? members.map(m =>
                            `<div class="gp-wall-member">
                                <div class="gp-wall-avatar" style="background:${color};">${esc(m.name.charAt(0))}</div>
                                <span class="gp-wall-member-name">${esc(m.name)}</span>
                            </div>`
                        ).join('') : `<div class="gp-wall-empty">等待學員加入…</div>`}
                    </div>
                </div>`;
            }).join('');
        };

        await load();
        this._teacherTimer = setInterval(load, 5000);
    }

    /* ═══════════════════════════════════════
       拖曳引擎（僅用於排列彈窗）
       ═══════════════════════════════════════ */
    _enableDrag(canvas, positions, onEnd) {
        if (!canvas) return;
        const cards = canvas.querySelectorAll('[data-idx]');

        cards.forEach(card => {
            if (card._gpDragBound) return;
            card._gpDragBound = true;

            let dragging = false, startX, startY, origX, origY;

            card.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                dragging = true;

                startX = e.clientX;
                startY = e.clientY;
                const idx = parseInt(card.dataset.idx);
                origX = positions[idx]?.x ?? 0;
                origY = positions[idx]?.y ?? 0;

                card.setPointerCapture(e.pointerId);
                card.style.zIndex = '20';
                card.style.transition = 'none';
                card.classList.add('gp-dragging');
            });

            card.addEventListener('pointermove', (e) => {
                if (!dragging) return;
                e.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const dx = ((e.clientX - startX) / rect.width) * 100;
                const dy = ((e.clientY - startY) / rect.height) * 100;
                const nx = Math.max(2, Math.min(90, origX + dx));
                const ny = Math.max(2, Math.min(90, origY + dy));
                card.style.left = nx + '%';
                card.style.top = ny + '%';
            });

            card.addEventListener('pointerup', (e) => {
                if (!dragging) return;
                dragging = false;
                card.releasePointerCapture(e.pointerId);
                card.style.zIndex = '';
                card.style.transition = '';
                card.classList.remove('gp-dragging');
                const idx = parseInt(card.dataset.idx);
                positions[idx] = {
                    x: parseFloat(card.style.left),
                    y: parseFloat(card.style.top)
                };
                if (onEnd) onEnd();
            });

            card.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            });
        });
    }

    /* ─── 清理 ─── */
    destroy() {
        if (this._studentTimer) { clearInterval(this._studentTimer); this._studentTimer = null; }
        if (this._teacherTimer) { clearInterval(this._teacherTimer); this._teacherTimer = null; }
    }
}
