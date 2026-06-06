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
        const sessionCode = window._activeSessionUUID || stateManager.getSessionCode() || '';
        const elementId = element.id;
        const studentEmail = user.email || '';
        const studentName = user.name || '';

        const groupCount = element.groupCount || 4;
        const groupNames = element.groupNames || Array.from({length: groupCount}, (_, i) => `第 ${i+1} 組`);
        const groupColors = element.groupColors || GROUP_COLORS.slice(0, groupCount);
        const pos = element.groupPositions || defaultPositions(groupCount);
        const maxPerGroup = element.maxPerGroup || 0; // 0 = 不限

        let myGroup = user.group || null;

        const renderUI = (picks, myGroupMembers) => {
            const counts = {};
            (picks || []).forEach(p => {
                const g = p.content;
                counts[g] = (counts[g] || 0) + 1;
            });

            const myColor = myGroup ? (groupColors[parseInt(myGroup)-1] || '#475569') : '';
            const myName = myGroup ? (groupNames[parseInt(myGroup)-1] || '第'+myGroup+'組') : '';

            el.innerHTML = `
            <div class="gp-canvas gp-canvas--student">
                <div class="gp-student-title">${mi('groups', 20)} ${myGroup ? '已選擇組別' : '點擊選擇你的組別'}</div>
                ${pos.slice(0, groupCount).map((p, i) => {
                    const idx = String(i + 1);
                    const color = groupColors[i] || GROUP_COLORS[i];
                    const sel = myGroup === idx;
                    const cnt = counts[idx] || 0;
                    const isFull = maxPerGroup > 0 && cnt >= maxPerGroup && !sel;
                    return `<button class="gp-pos-btn ${sel ? 'selected' : ''} ${isFull ? 'gp-full' : ''}" data-group="${idx}"
                        style="--gp-color:${color};left:${p.x}%;top:${p.y}%" ${isFull ? 'disabled' : ''}>
                        <div class="gp-pos-btn-name">${esc(groupNames[i])}</div>
                        <div class="gp-pos-btn-count">${isFull ? '已滿' : cnt + ' 人'}${maxPerGroup > 0 ? ' / ' + maxPerGroup : ''}</div>
                        ${sel ? `<div class="gp-pos-btn-check">${mi('check_circle', 16)}</div>` : ''}
                    </button>`;
                }).join('')}
                ${myGroup ? `
                <div class="gp-float-info">
                    已加入 <b style="color:${myColor}">${esc(myName)}</b>
                    · 點擊其他組別可換組
                </div>` : ''}
            </div>
            ${myGroup && myGroupMembers && myGroupMembers.length ? `
            <div style="margin-top:12px;padding:14px 16px;border-radius:12px;background:linear-gradient(135deg,${myColor}08,${myColor}15);border:1.5px solid ${myColor}25;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
                    <span style="font-size:14px;font-weight:700;color:${myColor};">${esc(myName)}</span>
                    <span style="font-size:11px;color:#94a3b8;font-weight:500;">${myGroupMembers.length} 位成員</span>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    ${myGroupMembers.map(m => {
                        const isMe = m.email === studentEmail;
                        return `<div style="display:flex;align-items:center;gap:6px;padding:5px 10px 5px 5px;border-radius:20px;
                            background:${isMe ? myColor : '#fff'};color:${isMe ? '#fff' : '#334155'};
                            border:1px solid ${isMe ? myColor : '#e2e8f0'};font-size:12px;font-weight:${isMe ? '600' : '500'};">
                            <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;
                                background:${isMe ? 'rgba(255,255,255,.25)' : myColor};color:${isMe ? '#fff' : '#fff'};
                                font-size:11px;font-weight:700;flex-shrink:0;">${esc(m.name.charAt(0))}</div>
                            ${esc(m.name)}${isMe ? ' (你)' : ''}
                        </div>`;
                    }).join('')}
                </div>
            </div>` : ''}`;

            el.querySelectorAll('.gp-pos-btn:not([disabled])').forEach(btn => {
                btn.addEventListener('click', () => selectGroup(btn.dataset.group));
            });
        };

        const selectGroup = async (groupIdx) => {
            // 防止快速連點
            if (this._selectingGroup) return;
            this._selectingGroup = true;

            // ★ 人數上限檢查
            if (maxPerGroup > 0 && groupIdx !== myGroup) {
                try {
                    const { data: gpRows } = await db.select('submissions', {
                        filter: { session_id: `eq.${sessionCode}`, type: 'eq.groupPick', content: `eq.${groupIdx}` },
                        select: 'student_email',
                        limit: maxPerGroup + 1
                    });
                    const currentCount = (gpRows || []).filter(r => r.student_email !== studentEmail).length;
                    if (currentCount >= maxPerGroup) {
                        this._selectingGroup = false;
                        alert(`此組別已滿（上限 ${maxPerGroup} 人），請選擇其他組別`);
                        return;
                    }
                } catch { /* proceed */ }
            }

            myGroup = groupIdx;
            user.group = groupIdx;
            sessionStorage.setItem('homework_user', JSON.stringify(user));

            try {
                // 先刪除舊的 groupPick（避免重複）
                if (sessionCode && studentEmail) {
                    await db.delete('submissions', {
                        session_id: `eq.${sessionCode}`,
                        element_id: `eq.${elementId}`,
                        student_email: `eq.${studentEmail}`,
                        type: 'eq.groupPick'
                    }).catch(() => {});
                }

                // 寫入新的 groupPick
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
                });

                // ★ 回頭更新所有已有 submissions 的 student_group
                if (sessionCode && studentEmail) {
                    db.update('submissions',
                        { student_group: groupIdx },
                        { student_email: `eq.${studentEmail}`, session_id: `eq.${sessionCode}` }
                    ).catch(e => console.warn('[groupPick] batch update student_group failed:', e));
                }
            } catch (e) {
                console.warn('[groupPick] selectGroup failed:', e);
            }

            this._selectingGroup = false;
            await loadAndRender();
        };

        const loadAndRender = async () => {
            const allFilter = { session_id: 'eq.' + sessionCode };

            const { data: allRows } = await db.select('submissions', {
                filter: allFilter,
                select: 'student_email,student_name,student_group,type,content',
                limit: 5000
            });

            const emailToGroup = {};
            const emailToName = {};
            (allRows || []).forEach(r => {
                if (r.student_email && r.student_name) emailToName[r.student_email] = r.student_name;
                let g = r.student_group;
                if (!g && r.type === 'groupPick' && r.content) g = r.content;
                if (g && r.student_email && !emailToGroup[r.student_email]) {
                    emailToGroup[r.student_email] = g;
                }
            });

            const picks = Object.entries(emailToGroup).map(([email, g]) => ({
                content: g, student_email: email
            }));

            let myGroupMembers = [];
            if (myGroup) {
                const seen = new Set();
                Object.entries(emailToGroup).forEach(([email, g]) => {
                    if (g === myGroup && !seen.has(email)) {
                        seen.add(email);
                        myGroupMembers.push({
                            email,
                            name: emailToName[email] || email.split('@')[0] || '學員'
                        });
                    }
                });
                myGroupMembers.sort((a, b) => (a.email === studentEmail ? -1 : b.email === studentEmail ? 1 : a.name.localeCompare(b.name)));
            }

            renderUI(picks, myGroupMembers);
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
        <style>
            @keyframes gpSeatPop { from { opacity:0;transform:scale(.7); } to { opacity:1;transform:scale(1); } }
            .gp-table-card { position:absolute; cursor:grab; user-select:none; transition:box-shadow .2s; z-index:1; }
            .gp-table-card:hover { z-index:10; box-shadow:0 6px 24px rgba(0,0,0,.12) !important; }
            .gp-table-card.dragging { cursor:grabbing; z-index:100; box-shadow:0 12px 40px rgba(0,0,0,.18) !important; opacity:.92; }
            .gp-table-card .gp-seat { display:flex;flex-direction:column;align-items:center;gap:2px; }
            .gp-table-card .gp-seat-avatar { width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid #fff; }
            .gp-table-card .gp-seat-name { font-size:11px;max-width:56px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
        </style>
        <div class="gp-canvas gp-canvas--teacher" style="overflow:hidden;display:flex;flex-direction:column;height:100%;">
            <div class="gp-teacher-header" style="position:relative;flex-shrink:0;">
                <div class="gp-teacher-title">${mi('groups', 22)} 現場分組</div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <div class="gp-zoom-ctrl" style="display:flex;align-items:center;gap:2px;background:rgba(0,0,0,.05);border-radius:6px;padding:2px;">
                        <button class="gp-zoom-btn" data-zoom="out" style="width:24px;height:24px;border:none;border-radius:4px;background:transparent;cursor:pointer;font-size:16px;color:#64748b;display:flex;align-items:center;justify-content:center;">−</button>
                        <span class="gp-zoom-label" style="font-size:10px;color:#64748b;min-width:32px;text-align:center;font-weight:600;">100%</span>
                        <button class="gp-zoom-btn" data-zoom="in" style="width:24px;height:24px;border:none;border-radius:4px;background:transparent;cursor:pointer;font-size:16px;color:#64748b;display:flex;align-items:center;justify-content:center;">+</button>
                    </div>
                    <button class="gp-reset-pos-btn" title="重置位置" style="padding:3px 8px;border:1px solid #e2e8f0;border-radius:5px;font-size:11px;background:#fff;cursor:pointer;color:#64748b;font-family:inherit;">${mi('grid_view', 13)} 重排</button>
                    <div class="gp-score-toggle" style="display:flex;gap:2px;background:rgba(0,0,0,.06);border-radius:6px;padding:2px;">
                        <button class="gp-mode-btn active" data-mode="total" style="padding:3px 10px;border:none;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;background:#fff;color:#1a73e8;box-shadow:0 1px 3px rgba(0,0,0,.1);">${mi('functions', 14)} 總分</button>
                        <button class="gp-mode-btn" data-mode="avg" style="padding:3px 10px;border:none;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;background:transparent;color:#80868b;">${mi('calculate', 14)} 平均</button>
                    </div>
                    <div class="gp-teacher-stats"></div>
                </div>
            </div>
            <div class="gp-wall-viewport" style="position:relative;flex:1;min-height:0;overflow:auto;">
                <div class="gp-wall" style="position:relative;transform-origin:top left;transition:transform .15s ease;min-width:100%;min-height:100%;"></div>
            </div>
        </div>`;

        const viewport = el.querySelector('.gp-wall-viewport');
        const wallEl = el.querySelector('.gp-wall');
        const statsEl = el.querySelector('.gp-teacher-stats');
        const zoomLabel = el.querySelector('.gp-zoom-label');
        let lastHash = '';

        // ── 縮放 ──
        const zoomKey = `gp_zoom_${elementId}`;
        let zoomLevel = parseFloat(localStorage.getItem(zoomKey)) || 1;
        const applyZoom = () => {
            wallEl.style.transform = `scale(${zoomLevel})`;
            zoomLabel.textContent = Math.round(zoomLevel * 100) + '%';
            localStorage.setItem(zoomKey, zoomLevel);
        };
        applyZoom();

        el.querySelectorAll('.gp-zoom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                zoomLevel = Math.max(0.3, Math.min(2, zoomLevel + (btn.dataset.zoom === 'in' ? 0.1 : -0.1)));
                applyZoom();
            });
        });

        viewport.addEventListener('wheel', (e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            zoomLevel = Math.max(0.3, Math.min(2, zoomLevel + (e.deltaY < 0 ? 0.05 : -0.05)));
            applyZoom();
        }, { passive: false });

        // ── 位置管理 ──
        const posKey = `gp_pos_${elementId}`;
        let savedPositions = {};
        try { savedPositions = JSON.parse(localStorage.getItem(posKey) || '{}'); } catch {}

        const getDefaultPositions = (count, w, h) => {
            const cols = Math.ceil(Math.sqrt(count * (w / h)));
            const rows = Math.ceil(count / cols);
            const cellW = w / cols, cellH = h / rows;
            const pos = {};
            for (let i = 0; i < count; i++) {
                const col = i % cols, row = Math.floor(i / cols);
                pos[i] = { x: col * cellW + cellW * 0.08, y: row * cellH + cellH * 0.08 };
            }
            return pos;
        };

        const savePositions = () => {
            const cards = wallEl.querySelectorAll('.gp-table-card');
            const pos = {};
            cards.forEach(c => { pos[c.dataset.idx] = { x: parseFloat(c.style.left), y: parseFloat(c.style.top) }; });
            savedPositions = pos;
            localStorage.setItem(posKey, JSON.stringify(pos));
        };

        // ── 拖曳 ──
        const enableDrag = () => {
            wallEl.querySelectorAll('.gp-table-card').forEach(card => {
                let startX, startY, origLeft, origTop;
                const onDown = (e) => {
                    e.preventDefault();
                    const touch = e.touches?.[0] || e;
                    startX = touch.clientX; startY = touch.clientY;
                    origLeft = parseFloat(card.style.left); origTop = parseFloat(card.style.top);
                    card.classList.add('dragging');
                    card.style.transition = 'none';
                    const onMove = (ev) => {
                        const t = ev.touches?.[0] || ev;
                        card.style.left = (origLeft + t.clientX - startX) + 'px';
                        card.style.top = (origTop + t.clientY - startY) + 'px';
                    };
                    const onUp = () => {
                        card.classList.remove('dragging');
                        card.style.transition = '';
                        savePositions();
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                        document.removeEventListener('touchmove', onMove);
                        document.removeEventListener('touchend', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                    document.addEventListener('touchmove', onMove, { passive: false });
                    document.addEventListener('touchend', onUp);
                };
                card.addEventListener('mousedown', onDown);
                card.addEventListener('touchstart', onDown, { passive: false });
            });
        };

        // ── 重排按鈕 ──
        el.querySelector('.gp-reset-pos-btn').addEventListener('click', () => {
            localStorage.removeItem(posKey);
            savedPositions = {};
            lastHash = '';
            load();
        });

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
            const allFilter = { session_id: 'eq.' + sessionCode };
            const { data: allSubs } = await db.select('submissions', {
                filter: allFilter,
                select: 'student_email,student_name,student_group,state,type,content',
                limit: 5000
            });
            const rows = allSubs || [];

            const groups = {};
            const groupScores = {};
            const seenEmails = {};

            for (const r of rows) {
                let g = r.student_group;
                if (!g && r.type === 'groupPick' && r.content) g = r.content;
                if (!g) continue;
                if (!seenEmails[g]) seenEmails[g] = new Set();
                if (!groups[g]) groups[g] = [];
                if (r.student_email && !seenEmails[g].has(r.student_email)) {
                    seenEmails[g].add(r.student_email);
                    groups[g].push({
                        name: r.student_name || r.student_email?.split('@')[0] || '學員',
                        email: r.student_email
                    });
                }
                let st = r.state;
                if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
                groupScores[g] = (groupScores[g] || 0) + (parseFloat(st?._awarded) || 0);
            }

            const totalMembers = Object.values(groups).reduce((s, arr) => s + arr.length, 0);

            const hash = JSON.stringify({ groups, groupScores, scoreMode });
            if (hash === lastHash) return;
            lastHash = hash;

            statsEl.textContent = `${totalMembers} 人已分組`;

            // 保存當前拖曳位置，以便重新渲染後恢復
            const existingCards = wallEl.querySelectorAll('.gp-table-card');
            if (existingCards.length) {
                existingCards.forEach(c => {
                    savedPositions[c.dataset.idx] = { x: parseFloat(c.style.left), y: parseFloat(c.style.top) };
                });
            }

            const calcScore = (total, memberCount) => {
                if (scoreMode === 'avg' && memberCount > 0) return (total / memberCount).toFixed(1);
                return Math.round(total);
            };

            const ww = wallEl.clientWidth || 800;
            const hh = wallEl.clientHeight || 500;
            const defaultPos = getDefaultPositions(groupCount, ww, hh);

            // 計算單張卡片尺寸 — 根據組數自適應，固定大小
            const cols = Math.ceil(Math.sqrt(groupCount * (ww / hh)));
            const cardW = Math.max(140, Math.min(200, Math.floor(ww / cols - 24)));
            const seatSize = Math.max(28, Math.min(34, Math.floor(cardW / 5.5)));
            const nameFontSize = Math.max(9, Math.min(11, Math.floor(seatSize * 0.32)));

            wallEl.innerHTML = Array.from({length: groupCount}, (_, i) => {
                const idx = String(i + 1);
                const color = groupColors[i] || GROUP_COLORS[i];
                const name = groupNames[i] || `第 ${idx} 組`;
                const members = groups[idx] || [];
                const totalScore = groupScores[idx] || 0;
                const score = calcScore(totalScore, members.length);
                const scoreLabel = scoreMode === 'avg' ? '均' : '分';

                const maxSeats = 6;
                const seatMembers = members.slice(0, maxSeats);
                const overflow = members.slice(maxSeats);
                while (seatMembers.length < maxSeats) seatMembers.push(null);
                const topSeats = seatMembers.slice(0, 3);
                const bottomSeats = [seatMembers[5], seatMembers[4], seatMembers[3]];

                const seatHtml = (m, gIdx) => {
                    if (!m) return `<div class="gp-seat" style="width:${seatSize + 12}px;flex-shrink:0;">
                        <div class="gp-seat-avatar" style="width:${seatSize}px;height:${seatSize}px;border:1.5px dashed ${color}35;color:${color}40;">
                            ${mi('person', Math.floor(seatSize * 0.42))}
                        </div>
                        <div class="gp-seat-name" style="color:transparent;font-size:${nameFontSize}px;">&nbsp;</div>
                    </div>`;
                    return `<div class="gp-seat gp-seat-filled" data-email="${esc(m.email)}" data-group="${gIdx}" data-name="${esc(m.name)}"
                        style="width:${seatSize + 12}px;flex-shrink:0;animation:gpSeatPop .3s ease;cursor:pointer;" title="點擊移除 ${esc(m.name)}">
                        <div class="gp-seat-avatar" style="width:${seatSize}px;height:${seatSize}px;background:${color};color:#fff;box-shadow:0 2px 6px ${color}40;font-size:${Math.floor(seatSize * 0.38)}px;">
                            ${esc(m.name.charAt(0))}
                        </div>
                        <div class="gp-seat-name" style="color:#334155;font-weight:500;font-size:${nameFontSize}px;max-width:${seatSize + 10}px;">${esc(m.name)}</div>
                    </div>`;
                };

                const pos = savedPositions[i] || defaultPos[i] || { x: 20, y: 20 };

                return `<div class="gp-table-card" data-idx="${i}" style="left:${pos.x}px;top:${pos.y}px;width:${cardW}px;
                    display:flex;flex-direction:column;align-items:center;padding:10px 10px 8px;
                    background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.07);border:1px solid ${color}20;">
                    <div style="display:flex;gap:6px;justify-content:center;margin-bottom:5px;height:${seatSize + nameFontSize + 14}px;align-items:flex-start;">
                        ${topSeats.map(m => seatHtml(m, idx)).join('')}
                    </div>
                    <div style="background:linear-gradient(135deg, ${color}10, ${color}20);
                        border:2px solid ${color}30;border-radius:14px;
                        padding:6px 10px;width:calc(100% - 8px);text-align:center;box-sizing:border-box;">
                        <div style="font-size:${Math.min(13, Math.max(10, Math.floor((cardW - 32) / Math.max(name.length, 1) * 1.1)))}px;font-weight:800;color:${color};line-height:1.3;word-break:keep-all;overflow-wrap:break-word;">${esc(name)}</div>
                        <div style="font-size:11px;color:#64748b;margin-top:2px;display:flex;align-items:center;justify-content:center;gap:8px;">
                            <span>${mi('person', 12)} ${members.length}</span>
                            <span>${scoreLabel} <b style="color:${color};font-size:13px;">${score}</b></span>
                        </div>
                    </div>
                    <div style="display:flex;gap:6px;justify-content:center;margin-top:5px;height:${seatSize + nameFontSize + 14}px;align-items:flex-start;">
                        ${bottomSeats.map(m => seatHtml(m, idx)).join('')}
                    </div>
                    ${overflow.length ? `<div style="display:flex;flex-wrap:wrap;gap:2px;justify-content:center;margin-top:3px;padding-top:3px;border-top:1px dashed #e2e8f0;width:100%;">
                        ${overflow.map(m => `<span style="font-size:8px;color:#64748b;background:#f8fafc;padding:1px 5px;border-radius:6px;">${esc(m.name)}</span>`).join('')}
                    </div>` : ''}
                </div>`;
            }).join('');

            enableDrag();

            // ★ 講師點擊座位移除學員
            wallEl.querySelectorAll('.gp-seat-filled').forEach(seat => {
                seat.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const email = seat.dataset.email;
                    const name = seat.dataset.name;
                    const group = seat.dataset.group;
                    if (!email || !confirm(`確定要將「${name}」從第 ${group} 組移除嗎？\n移除後該學員需要重新選組。`)) return;

                    try {
                        // 刪除 groupPick submission
                        await db.delete('submissions', {
                            session_id: `eq.${sessionCode}`,
                            student_email: `eq.${email}`,
                            type: 'eq.groupPick'
                        });
                        // 清除 student_group
                        await db.update('submissions',
                            { student_group: '' },
                            { student_email: `eq.${email}`, session_id: `eq.${sessionCode}` }
                        ).catch(() => {});
                        console.log(`[groupPick] removed ${name} (${email}) from group ${group}`);
                        lastHash = '';
                        load();
                    } catch (err) {
                        console.warn('[groupPick] remove member failed:', err);
                        alert('移除失敗，請重試');
                    }
                });
            });
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
