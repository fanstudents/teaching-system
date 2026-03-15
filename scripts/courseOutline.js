/**
 * Course Outline — Client-side Logic
 * 動態架構：URL ?session=xxx → 從 DB 載入 session → project → organization
 * Admin: ?admin=1 → 管理面板（學員、講師、客戶、課程內容編輯）
 * CMS: outline_data JSONB 存入 projects 表，學員端動態渲染
 */

import { db, storage, ai } from './supabase.js';
import { getToolLogo, getToolUrl, AI_TOOLS_REGISTRY } from './aiToolsRegistry.js';

// ── State ──
let sessionData = null;   // project_sessions record
let projectData = null;   // projects record
let orgData = null;       // organizations record

// Alias for backward compat
const _resolveToolLogo = (name, existing) => getToolLogo(name, existing);
let currentUser = null;   // logged-in student or admin
let isAdmin = false;
let students = [];
let uploadedFiles = [];
const ADMIN_PASSWORD = 'admin2026';

// ── DOM Ready ──
document.addEventListener('DOMContentLoaded', init);

async function init() {
    const params = new URLSearchParams(location.search);
    isAdmin = params.get('admin') === '1';
    const sessionCode = params.get('session') || '';
    const projectId = params.get('project') || '';

    // Load session → project → org chain
    if (sessionCode) {
        await loadSessionChain(sessionCode);
    } else if (projectId) {
        await loadProjectDirect(projectId);
    }

    // Apply dynamic data to page
    renderDynamicContent();

    // Admin preview mode: skip login when coming from editor preview button
    const isPreview = params.get('preview') === 'admin';
    if (isPreview && (localStorage.getItem('_at') || localStorage.getItem('_rt'))) {
        currentUser = { name: '預覽模式', email: 'admin@preview', _isClient: true };
        sessionStorage.setItem('outline_user', JSON.stringify(currentUser));
        enterPage();
        return;
    }

    // Admin auto-login: if already authenticated in admin system, skip password
    if (isAdmin) {
        let hasToken = localStorage.getItem('_at') || sessionStorage.getItem('_at');
        // Try refresh if access token missing but refresh token exists
        if (!hasToken) {
            const rt = localStorage.getItem('_rt') || sessionStorage.getItem('_rt');
            if (rt) {
                try {
                    const res = await fetch('https://wsaknnhjgiqmkendeyrj.supabase.co/auth/v1/token?grant_type=refresh_token', {
                        method: 'POST',
                        headers: { 'apikey': 'sb_publishable_RRbhQpB2zcqeHc6Cds8fgA_jVWyvdyF', 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refresh_token: rt })
                    });
                    if (res.ok) {
                        const d = await res.json();
                        if (d.access_token) { localStorage.setItem('_at', d.access_token); sessionStorage.setItem('_at', d.access_token); hasToken = d.access_token; }
                        if (d.refresh_token) { localStorage.setItem('_rt', d.refresh_token); sessionStorage.setItem('_rt', d.refresh_token); }
                    }
                } catch(e) { /* ignore */ }
            }
        }
        if (hasToken) {
            currentUser = { name: '管理員', _isAdmin: true };
            sessionStorage.setItem('outline_user', JSON.stringify(currentUser));
            enterPage();
            return;
        }
    }

    // Check saved session
    const saved = sessionStorage.getItem('outline_user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            enterPage();
            return;
        } catch(e) { /* ignore */ }
    }
    // Set login page logo from organization
    const loginLogo = document.getElementById('loginClientLogo');
    if (loginLogo && orgData?.logo_url) {
        loginLogo.src = orgData.logo_url;
        loginLogo.alt = orgData.name || '';
        loginLogo.style.display = '';
    }
    setupLoginForm();
}

async function loadProjectDirect(projectId) {
    const { data: projects } = await db.select('projects', { filter: { id: `eq.${projectId}` } });
    if (projects?.length) {
        projectData = projects[0];
        if (projectData.organization_id) {
            const { data: orgs } = await db.select('organizations', { filter: { id: `eq.${projectData.organization_id}` } });
            if (orgs?.length) orgData = orgs[0];
        }
        const { data: sess } = await db.select('project_sessions', { filter: { project_id: `eq.${projectId}` }, order: 'date.asc', limit: 1 });
        if (sess?.length) sessionData = sess[0];
    }
}

async function loadSessionChain(code) {
    const { data: sessions } = await db.select('project_sessions', { filter: { session_code: `eq.${code}` } });
    if (sessions?.length) {
        sessionData = sessions[0];
        const { data: projects } = await db.select('projects', { filter: { id: `eq.${sessionData.project_id}` } });
        if (projects?.length) {
            projectData = projects[0];
            if (projectData.organization_id) {
                const { data: orgs } = await db.select('organizations', { filter: { id: `eq.${projectData.organization_id}` } });
                if (orgs?.length) orgData = orgs[0];
            }
        }
    }
}

function renderDynamicContent() {
    // Client logo in topbar + badge in hero
    const topbarLogo = document.getElementById('topbarClientLogo');
    const topbarTitle = document.getElementById('topbarTitle');
    const badgeEl = document.getElementById('heroBadge');
    const clientName = orgData?.name || '';

    // Topbar: client logo + title
    if (topbarLogo && orgData?.logo_url) {
        topbarLogo.src = orgData.logo_url;
        topbarLogo.alt = clientName;
        topbarLogo.style.display = '';
    }
    if (topbarTitle && clientName) {
        topbarTitle.innerHTML = `${clientName}<span> — 企業內訓規劃課綱</span>`;
    }

    // Hero badge (no logo, just text)
    if (badgeEl && clientName) {
        const projectType = projectData?.type === 'corporate' ? '企業內部培訓' : '課程規劃';
        badgeEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px">school</span> ${clientName} · ${projectType}`;
    }

    // Course name
    const courseName = projectData?.name || 'AI 辦公室應用實戰班';
    const heroTitle = document.getElementById('heroTitle');
    if (heroTitle) heroTitle.textContent = courseName;
    document.title = `課程規劃大綱 — ${courseName}`;

    // Admin mode adjustments
    if (isAdmin) {
        document.getElementById('loginTitle').textContent = '管理端登入';
        document.getElementById('loginSubtext').textContent = '輸入管理密碼以進入管理面板';
        const userField = document.getElementById('loginUser');
        userField.placeholder = '管理密碼';
        userField.type = 'password';
        document.querySelector('#fieldEmail .material-symbols-outlined').textContent = 'key';
        document.getElementById('fieldPassword').style.display = 'none';
        document.getElementById('loginPass').removeAttribute('required');
    }

    // Render outline from DB if available
    renderOutlineFromDB();
}

// ══════════════════════════════════════
// DYNAMIC OUTLINE RENDERING (CMS)
// ══════════════════════════════════════

function getOutlineData() {
    const od = projectData?.outline_data;
    if (!od || typeof od !== 'object' || Object.keys(od).length === 0) return null;
    return od;
}

function renderOutlineFromDB() {
    const od = getOutlineData();
    if (!od) return; // Keep hardcoded HTML as fallback

    // Hero subtitle & meta
    if (od.hero) {
        const heroSub = document.getElementById('heroSub');
        if (heroSub && od.hero.subtitle) heroSub.textContent = od.hero.subtitle;

        const metaEl = document.getElementById('heroMeta');
        if (metaEl) {
            // Build schedule text — compute from schedule array or hero
            let scheduleText = '';
            if (od.schedule?.length > 1) {
                const totalH = od.schedule.reduce((s, d) => s + (parseFloat(d.hours) || 0), 0);
                scheduleText = totalH ? `${od.schedule.length} 天 / 共 ${totalH} 小時` : `${od.schedule.length} 天`;
            } else if (od.schedule?.length === 1 && od.schedule[0].hours) {
                scheduleText = `${od.schedule[0].hours} 小時`;
            } else if (od.hero?.duration) {
                scheduleText = od.hero.duration;
            } else if (od.hero?.days && od.hero.days !== '1') {
                scheduleText = `${od.hero.days} 天`;
            }
            const items = [
                { icon: 'schedule', text: scheduleText },
                { icon: 'groups', text: od.hero.groupSize },
                { icon: 'location_on', text: od.hero.location }
            ].filter(i => i.text);
            if (items.length > 0) {
                metaEl.innerHTML = items.map(i =>
                    `<div class="hero-meta-item"><span class="material-symbols-outlined">${i.icon}</span>${i.text}</div>`
                ).join('');
            }
        }
    }

    // Timeline — grouped by day
    if (od.timeline?.length > 0) {
        const timelineEl = document.querySelector('.timeline');
        if (timelineEl) {
            let schedule = od.schedule || [];
            // Auto-detect days from timeline blocks if schedule is incomplete
            const uniqueDays = [...new Set(od.timeline.map(b => b.day || 1))].sort((a, b) => a - b);
            if (uniqueDays.length > 1 && schedule.length < uniqueDays.length) {
                schedule = uniqueDays.map(d => {
                    const existing = schedule.find(s => s.day === d);
                    if (existing) return existing;
                    // Auto-compute hours from blocks
                    const dayBlocks = od.timeline.filter(b => (b.day || 1) === d && !b.isBreak);
                    let totalMin = 0;
                    dayBlocks.forEach(b => {
                        const m = (b.time || '').match(/(\d+)\s*分鐘/);
                        if (m) totalMin += parseInt(m[1]);
                    });
                    return { day: d, hours: totalMin ? String(Math.round(totalMin / 60 * 10) / 10) : '', topic: '' };
                });
            }

            // Aggressive fallback: scan timeline text for "Day 2"/"第二天" markers when all blocks are day:1
            if (uniqueDays.length === 1 && uniqueDays[0] === 1) {
                let currentDay = 1;
                const maxScanDay = Math.max(parseInt(od.hero?.days) || 1, schedule.length, 5);
                od.timeline.forEach(b => {
                    const text = `${b.title || ''} ${b.time || ''} ${b.desc || ''}`.toLowerCase();
                    for (let d = 2; d <= maxScanDay; d++) {
                        if (text.includes(`day ${d}`) || text.includes(`day${d}`) || text.includes(`第${['','一','二','三','四','五'][d]}天`)) {
                            currentDay = d;
                        }
                    }
                    b.day = currentDay;
                });
                // Rebuild schedule from corrected days
                const fixedDays = [...new Set(od.timeline.map(b => b.day))].sort((a, b) => a - b);
                if (fixedDays.length > 1) {
                    schedule = fixedDays.map(d => schedule.find(s => s.day === d) || { day: d, hours: '', topic: '' });
                }
            }

            if (!schedule.length) schedule = [{ day: 1, hours: '', topic: '' }];
            const isMultiDay = schedule.length > 1;

            const renderBlocks = (blocks) => blocks.map(block => {
                const tags = (block.tags || []).map((t, i) =>
                    `<span class="topic-tag${i === 0 ? ' highlight' : ''}">${t}</span>`
                ).join('');
                const dept = block.dept && block.dept !== '全部門' ? `<div class="timeline-dept-badge dept-custom"><span class="material-symbols-outlined" style="font-size:12px">group</span>${block.dept}</div>` : '';
                return `<div class="timeline-block">
                    ${dept}
                    ${block.time ? `<div class="timeline-time" style="margin-bottom:6px">${block.time}</div>` : ''}
                    <div class="timeline-title">${block.title || ''}</div>
                    <div class="timeline-desc">${block.desc || ''}</div>
                    ${tags ? `<div class="timeline-topics">${tags}</div>` : ''}
                </div>`;
            }).join('');

            let html = '';
            if (isMultiDay) {
                // Side-by-side grid columns
                const cols = schedule.map(dayInfo => {
                    const dayBlocks = od.timeline.filter(b => (b.day || 1) === dayInfo.day);
                    return `<div class="timeline-day-col">
                        <div class="timeline-day-header">
                            <span class="timeline-day-badge">Day ${dayInfo.day}</span>
                            <span class="timeline-day-info">${dayInfo.topic || ''}${dayInfo.hours ? ` — ${dayInfo.hours} 小時` : ''}</span>
                        </div>
                        ${renderBlocks(dayBlocks)}
                    </div>`;
                }).join('');
                html = `<div class="timeline-grid timeline-grid-${Math.min(schedule.length, 4)}">${cols}</div>`;
            } else {
                // Single day — flat
                const dayBlocks = od.timeline.filter(b => (b.day || 1) === 1);
                html = renderBlocks(dayBlocks);
            }

            // Legacy unmatched blocks
            const unmatchedBlocks = od.timeline.filter(b => !schedule.find(s => s.day === (b.day || 1)));
            if (unmatchedBlocks.length) html += renderBlocks(unmatchedBlocks);

            timelineEl.innerHTML = html + `<div class="timeline-note"><span class="material-symbols-outlined" style="font-size:18px;color:var(--accent);flex-shrink:0;margin-top:1px">info</span><span>以上時間配置為建議規劃，實際授課時數與進度將依現場學員吸收狀況與講師節奏進行彈性調整。</span></div>`;

            // Dynamic section description
            const descEl = document.getElementById('timelineSectionDesc');
            if (descEl) {
                const totalHours = schedule.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
                if (isMultiDay && totalHours) {
                    descEl.textContent = `${schedule.length} 天共 ${totalHours} 小時的完整課程時間規劃`;
                } else if (totalHours) {
                    descEl.textContent = `${totalHours} 小時的完整課程時間規劃`;
                } else if (od.hero?.duration) {
                    descEl.textContent = `${od.hero.duration}的完整課程時間規劃`;
                }
            }
        }
    }

    // Tools
    if (od.tools?.length > 0) {
        const toolGrid = document.querySelector('.tool-grid');
        if (toolGrid) {
            toolGrid.innerHTML = od.tools.map(t => {
                const logo = _resolveToolLogo(t.name, t.logo);
                const url = getToolUrl(t.name, t.url);
                return `<div class="tool-card">
                    ${logo ? `<img class="tool-logo" src="${logo}" alt="${t.name}" onerror="this.style.display='none'">` : ''}
                    <div class="tool-name">${t.name || ''}</div>
                    <div class="tool-purpose">${t.purpose || ''}</div>
                    ${url ? `<a class="tool-url" href="${url}" target="_blank">${url.replace(/^https?:\/\//, '').split('/')[0]} →</a>` : ''}
                </div>`;
            }).join('');
        }
        // Tools note
        const toolsNoteEl = document.querySelector('.tool-grid + .note-callout');
        if (toolsNoteEl && od.toolsNote) {
            toolsNoteEl.querySelector('p').textContent = od.toolsNote;
        }
    }

    // Equipment
    if (od.equipment?.length > 0) {
        const equipGrid = document.querySelector('.equip-grid');
        if (equipGrid) {
            equipGrid.innerHTML = od.equipment.map(e =>
                `<div class="equip-item">
                    <div class="equip-icon"><span class="material-symbols-outlined">${e.icon || 'devices'}</span></div>
                    <div><div class="equip-label">${e.label || ''}</div><div class="equip-detail">${e.detail || ''}</div></div>
                </div>`
            ).join('');
        }
        // Equip note
        const equipNoteEl = document.querySelector('.equip-grid + .note-callout');
        if (equipNoteEl && od.equipNote) {
            equipNoteEl.querySelector('p').innerHTML = `<strong>課前準備提醒：</strong>${od.equipNote}`;
        }
    }

    // TA Config — hide entirely
    const taSection = document.querySelector('.ta-card')?.closest('.outline-section');
    if (taSection) taSection.style.display = 'none';

    // Instructors — load from saved IDs
    if (od.instructorIds?.length) {
        loadStudentInstructors(od.instructorIds);
    }
}

async function loadStudentInstructors(ids) {
    if (!ids?.length) return;
    const { data } = await db.select('instructors');
    if (!data) return;
    const selected = ids.map(id => data.find(i => i.id === id)).filter(Boolean);
    if (!selected.length) return;
    const el = document.getElementById('instructorContent');
    if (!el) return;
    el.innerHTML = selected.map(inst => {
        const photo = inst.photo_url
            ? `<img class="instructor-photo" src="${inst.photo_url}" alt="${inst.name}">`
            : '<div class="instructor-photo-placeholder"><span class="material-symbols-outlined">person</span></div>';
        const specs = (inst.specialties||[]).map(s=>`<span class="instructor-tag">${s}</span>`).join('');
        const gallery = (inst.teaching_photos||[]);
        const galleryHtml = gallery.length ? `<div class="instructor-gallery"><div class="instructor-gallery-title">📸 授課紀錄</div><div class="instructor-gallery-grid">${gallery.map(u=>`<img src="${u}" alt="授課照片" loading="lazy">`).join('')}</div></div>` : '';
        return `<div class="instructor-card"><div class="instructor-main">${photo}<div class="instructor-info"><div class="instructor-name">${inst.name}</div><div class="instructor-title-text">${inst.title||''}</div><div class="instructor-bio">${inst.bio||''}</div><div class="instructor-tags">${specs}</div></div></div>${galleryHtml}</div>`;
    }).join('');
}

async function enterPage() {
    const overlay = document.getElementById('loginOverlay');
    const content = document.getElementById('pageContent');
    overlay.classList.add('fade-out');
    content.style.display = 'block';
    setTimeout(() => overlay.style.display = 'none', 400);

    if (isAdmin && currentUser._isAdmin) {
        // Move admin content from template into the visible adminPanel div
        const tpl = document.getElementById('adminPanelContent');
        const panel = document.getElementById('adminPanel');
        if (tpl && panel) {
            panel.appendChild(tpl.content.cloneNode(true));
        }
        panel.classList.add('show');
        // Hide student preview in admin mode — pure editor
        const sv = document.getElementById('studentView');
        if (sv) sv.style.display = 'none';
        loadStudents();
        await loadInstructors();
        await loadOrganizations();
        initOutlineEditor();

        // Set preview button href — with auto-login preview token
        const previewBtn = document.getElementById('btnPreviewOutline');
        if (previewBtn && projectData?.id) {
            previewBtn.href = `${location.origin}/course-outline.html?project=${projectData.id}&preview=admin`;
        }
        // Set back to project button
        const backBtn = document.getElementById('btnBackToProject');
        if (backBtn && projectData?.id) {
            backBtn.href = `/manage.html#project-${projectData.id}`;
        }
    } else {
        loadUploadedFiles();
    }
    updateTopbar();
    initHrEmail();
}

function setupLoginForm() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('loginError');
        errorEl.style.display = 'none';

        if (isAdmin) {
            const pass = document.getElementById('loginUser').value;
            if (pass === ADMIN_PASSWORD) {
                currentUser = { name: '管理員', _isAdmin: true };
                sessionStorage.setItem('outline_user', JSON.stringify(currentUser));
                enterPage();
            } else {
                errorEl.textContent = '密碼錯誤';
                errorEl.style.display = 'block';
            }
        } else {
            const email = document.getElementById('loginUser').value.trim().toLowerCase();
            const pass = document.getElementById('loginPass').value.trim();

            // 1) Try student login (email + password)
            const filter = { email: `eq.${email}`, login_password: `eq.${pass}` };
            if (sessionData) filter.session_code = `eq.${sessionData.session_code}`;
            const { data } = await db.select('students', { filter, select: 'name,email' });
            if (data?.length) {
                currentUser = data[0];
                sessionStorage.setItem('outline_user', JSON.stringify(currentUser));
                enterPage();
                return;
            }

            // 2) Try client login (email + project join_code)
            if (projectData?.join_code && pass === projectData.join_code) {
                // Check if email is in org's contact_email list (comma-separated)
                const allowedEmails = (orgData?.contact_email || '')
                    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
                if (allowedEmails.includes(email)) {
                    currentUser = { name: orgData.contact_person || orgData.name || email, email, _isClient: true };
                    sessionStorage.setItem('outline_user', JSON.stringify(currentUser));
                    enterPage();
                    return;
                }
            }

            errorEl.textContent = '帳號或密碼錯誤，請確認後重試';
            errorEl.style.display = 'block';
        }
    });
}

function updateTopbar() {
    const el = document.getElementById('topbarUser');
    if (currentUser?._isAdmin) {
        el.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">admin_panel_settings</span><span><strong>管理模式</strong></span>`;
    } else if (currentUser) {
        el.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">person</span><span>歡迎，<strong>${currentUser.name || currentUser.email}</strong></span>`;
    }
}

// ══════════════════════════════════════
// ADMIN: Outline Content Editor (CMS)
// ══════════════════════════════════════

function initOutlineEditor() {
    const od = getOutlineData();

    // Populate hero fields
    if (od?.hero) {
        _v('oeHeroSubtitle', od.hero.subtitle);
        _v('oeHeroGroupSize', od.hero.groupSize || '20–30 人');
        _v('oeHeroLocation', od.hero.location || '現場實體授課');
    }

    // Populate schedule (Day 1, Day 2...)
    if (od?.schedule?.length > 0) {
        od.schedule.forEach(s => addScheduleDay(s));
    } else {
        addScheduleDay({ day: 1, hours: '7', topic: '' });
    }

    // Restore selected instructors
    if (od?.instructorIds?.length) {
        selectedInstructorIds = od.instructorIds;
        renderSelectedInstructors();
        renderStudentInstructors();
    }

    // Populate timeline
    if (od?.timeline?.length > 0) {
        od.timeline.forEach(block => addTimelineBlock(block));
    }

    // Populate tools
    if (od?.tools?.length > 0) {
        od.tools.forEach(tool => addToolBlock(tool));
    }
    if (od?.toolsNote) _v('oeToolsNote', od.toolsNote);

    // Populate equipment
    if (od?.equipment?.length > 0) {
        od.equipment.forEach(eq => addEquipBlock(eq));
    }
    if (od?.equipNote) _v('oeEquipNote', od.equipNote);

    // Populate TA
    if (od?.taConfig) {
        _v('oeTaCount', od.taConfig.count);
        _v('oeTaDuties', (od.taConfig.duties || []).join('\n'));
    }

    // Bind buttons
    document.getElementById('btnSaveOutline').addEventListener('click', saveOutlineData);
    document.getElementById('btnImportDefaults').addEventListener('click', importDefaults);
    document.getElementById('btnAiGenOutline').addEventListener('click', () => {
        const modal = document.getElementById('aiOutlineModal');
        modal.classList.add('show');
        // Render tool checkboxes for current day count
        updateAiToolInputs();
        // Restore previous AI form values
        const saved = localStorage.getItem(`aiOlForm_${projectData?.id}`);
        if (saved) {
            try {
                const f = JSON.parse(saved);
                _v('aiOlClient', f.client);
                _v('aiOlIndustry', f.industry);
                _v('aiOlDepts', f.depts);
                _v('aiOlDays', f.days);
                _v('aiOlHours', f.hours);
                _v('aiOlLevel', f.level);
                _v('aiOlTranscript', f.transcript);
                // Re-render tools with saved selections
                if (typeof updateAiToolInputs === 'function') updateAiToolInputs();
                // Restore checkbox selections
                if (f.dayTools?.length) {
                    f.dayTools.forEach(dt => {
                        const prefix = `aiOlDay${dt.day}`;
                        const knownTools = (dt.tools || []).filter(t => AI_TOOL_OPTIONS.map(o => o.toLowerCase()).includes(t.toLowerCase()));
                        const otherTools = (dt.tools || []).filter(t => !AI_TOOL_OPTIONS.map(o => o.toLowerCase()).includes(t.toLowerCase()));
                        knownTools.forEach(t => {
                            const cb = document.querySelector(`.${prefix}-tool-cb[value="${AI_TOOL_OPTIONS.find(o => o.toLowerCase() === t.toLowerCase()) || t}"]`);
                            if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
                        });
                        if (otherTools.length) {
                            const otherEl = document.querySelector(`.${prefix}-tool-other`);
                            if (otherEl) otherEl.value = otherTools.join(', ');
                        }
                    });
                } else if (Array.isArray(f.tools) && f.tools.length) {
                    const knownTools = f.tools.filter(t => AI_TOOL_OPTIONS.map(o => o.toLowerCase()).includes(t.toLowerCase()));
                    const otherTools = f.tools.filter(t => !AI_TOOL_OPTIONS.map(o => o.toLowerCase()).includes(t.toLowerCase()));
                    knownTools.forEach(t => {
                        const cb = document.querySelector(`.aiOlSingle-tool-cb[value="${AI_TOOL_OPTIONS.find(o => o.toLowerCase() === t.toLowerCase()) || t}"]`);
                        if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
                    });
                    if (otherTools.length) {
                        const otherEl = document.querySelector('.aiOlSingle-tool-other');
                        if (otherEl) otherEl.value = otherTools.join(', ');
                    }
                }
            } catch(e) {}
        }
    });
}

function _v(id, val) {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
}

// ── Schedule Day Builder ──
let _schCounter = 0;
window.addScheduleDay = function(data = {}) {
    const list = document.getElementById('oeScheduleList');
    if (!list) return;
    const idx = _schCounter++;
    const dayNum = data.day || (list.children.length + 1);
    const div = document.createElement('div');
    div.className = 'oe-schedule-day';
    div.style.cssText = 'display:flex;gap:10px;align-items:center;padding:10px 14px;background:linear-gradient(135deg,#f8fafc,#eef2ff);border:1px solid #e0e7ff;border-radius:10px;transition:box-shadow 0.2s';
    div.onmouseenter = () => div.style.boxShadow = '0 2px 8px rgba(99,102,241,0.08)';
    div.onmouseleave = () => div.style.boxShadow = 'none';
    div.innerHTML = `
        <span class="oe-day-badge" style="display:inline-flex;align-items:center;justify-content:center;min-width:52px;padding:4px 10px;border-radius:6px;background:var(--accent);color:#fff;font-size:0.75rem;font-weight:700;letter-spacing:0.04em;white-space:nowrap">Day ${dayNum}</span>
        <input type="hidden" data-key="day" value="${dayNum}">
        <div style="display:flex;align-items:center;gap:4px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:2px 8px">
            <input type="text" data-key="hours" value="${_esc(data.hours || '')}" placeholder="7" style="width:36px;font-size:0.85rem;border:none;outline:none;text-align:center;background:transparent;font-weight:600">
            <span style="font-size:0.75rem;color:var(--text-3);white-space:nowrap">小時</span>
        </div>
        <input type="text" data-key="topic" value="${_esc(data.topic || '')}" placeholder="當日課程主題" style="flex:1;font-size:0.85rem;border:1px solid var(--border);border-radius:6px;padding:6px 10px;background:#fff">
        <button class="oe-delete" onclick="this.closest('.oe-schedule-day').remove();renumberScheduleDays()" style="position:static;width:26px;height:26px;border-radius:6px;opacity:0.4;transition:opacity 0.2s" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.4'"><span class="material-symbols-outlined" style="font-size:14px">close</span></button>
    `;
    list.appendChild(div);
};

window.renumberScheduleDays = function() {
    document.querySelectorAll('#oeScheduleList .oe-schedule-day').forEach((el, i) => {
        el.querySelector('.oe-day-badge').textContent = `Day ${i + 1}`;
        el.querySelector('[data-key="day"]').value = i + 1;
    });
};

function getScheduleDays() {
    return [...document.querySelectorAll('#oeScheduleList .oe-schedule-day')].map(el => ({
        day: parseInt(el.querySelector('[data-key="day"]').value),
        hours: el.querySelector('[data-key="hours"]').value.trim(),
        topic: el.querySelector('[data-key="topic"]').value.trim()
    }));
}

function getScheduleOptions() {
    const days = getScheduleDays();
    return days.map(d => `<option value="${d.day}">Day ${d.day}</option>`).join('');
}

// ── Timeline Block ──
let _tlCounter = 0;
window.addTimelineBlock = function(data = {}) {
    const list = document.getElementById('oeTimelineList');
    const idx = _tlCounter++;
    const dayOptions = getScheduleOptions();
    const div = document.createElement('div');
    div.className = 'oe-list-item';
    div.dataset.idx = idx;
    div.innerHTML = `
        <button class="oe-delete" onclick="this.closest('.oe-list-item').remove()"><span class="material-symbols-outlined">close</span></button>
        <div class="oe-row">
            <div class="oe-field" style="max-width:90px"><label>天數</label><select data-key="day">${dayOptions}</select></div>
            <div class="oe-field" style="max-width:100px"><label>時長</label><input type="text" data-key="time" value="${_esc(data.time || '')}" placeholder="60 分鐘"></div>
            <div class="oe-field"><label>標題</label><input type="text" data-key="title" value="${_esc(data.title || '')}" placeholder="模組名稱"></div>
            <div class="oe-field" style="max-width:140px"><label>部門</label><input type="text" data-key="dept" value="${_esc(data.dept || '全部門')}" placeholder="全部門"></div>
        </div>
        <div class="oe-field" style="margin-top:8px"><label>描述</label><textarea data-key="desc" rows="2" placeholder="模組說明...">${_esc(data.desc || '')}</textarea></div>
        <div class="oe-field" style="margin-top:8px"><label>標籤（逗號分隔）</label><input type="text" data-key="tags" value="${_esc((data.tags||[]).join(', '))}" placeholder="AI 辦公趨勢, 案例分享"></div>
    `;
    // Set day value after appending
    if (data.day) {
        const sel = div.querySelector('[data-key="day"]');
        sel.value = data.day;
    }
    list.appendChild(div);
};

// ── Tool Block ──
let _toolCounter = 0;
window.addToolBlock = function(data = {}) {
    const list = document.getElementById('oeToolsList');
    const div = document.createElement('div');
    div.className = 'oe-list-item';
    div.innerHTML = `
        <button class="oe-delete" onclick="this.closest('.oe-list-item').remove()"><span class="material-symbols-outlined">close</span></button>
        <div class="oe-row">
            <div class="oe-field"><label>工具名稱</label><input type="text" data-key="name" value="${_esc(data.name || '')}" placeholder="ChatGPT"></div>
            <div class="oe-field"><label>網址</label><input type="text" data-key="url" value="${_esc(data.url || '')}" placeholder="https://chat.openai.com"></div>
        </div>
        <div class="oe-field" style="margin-top:8px"><label>用途</label><input type="text" data-key="purpose" value="${_esc(data.purpose || '')}" placeholder="文字生成、文件撰寫..."></div>
        <div class="oe-field" style="margin-top:8px"><label>Logo URL</label><input type="text" data-key="logo" value="${_esc(data.logo || '')}" placeholder="https://...svg"></div>
    `;
    list.appendChild(div);
};

// ── Equipment Block ──
let _eqCounter = 0;
window.addEquipBlock = function(data = {}) {
    const list = document.getElementById('oeEquipList');
    const div = document.createElement('div');
    div.className = 'oe-list-item';
    div.innerHTML = `
        <button class="oe-delete" onclick="this.closest('.oe-list-item').remove()"><span class="material-symbols-outlined">close</span></button>
        <div class="oe-row">
            <div class="oe-field"><label>圖示</label><input type="text" data-key="icon" value="${_esc(data.icon || '')}" placeholder="laptop_mac"></div>
            <div class="oe-field"><label>名稱</label><input type="text" data-key="label" value="${_esc(data.label || '')}" placeholder="學員筆電"></div>
        </div>
        <div class="oe-field" style="margin-top:8px"><label>說明</label><input type="text" data-key="detail" value="${_esc(data.detail || '')}" placeholder="每人 1 台，需可上網"></div>
    `;
    list.appendChild(div);
};

function _esc(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ── Collect Form Data ──
function collectOutlineData() {
    const od = {};

    // Hero
    od.hero = {
        subtitle: document.getElementById('oeHeroSubtitle').value.trim(),
        groupSize: document.getElementById('oeHeroGroupSize').value,
        location: document.getElementById('oeHeroLocation').value
    };

    // Schedule (Day 1, Day 2...)
    od.schedule = getScheduleDays();
    // Backwards compat: also set hero.days/duration from schedule
    od.hero.days = String(od.schedule.length);
    od.hero.duration = od.schedule.map(s => `Day ${s.day}：${s.hours || '?'} 小時`).join('、');

    // Instructor IDs
    od.instructorIds = [...selectedInstructorIds];

    // Timeline
    od.timeline = [...document.querySelectorAll('#oeTimelineList .oe-list-item')].map(el => ({
        day: parseInt(el.querySelector('[data-key="day"]')?.value || '1'),
        time: el.querySelector('[data-key="time"]').value.trim(),
        title: el.querySelector('[data-key="title"]').value.trim(),
        desc: el.querySelector('[data-key="desc"]').value.trim(),
        dept: el.querySelector('[data-key="dept"]')?.value.trim() || '全部門',
        tags: el.querySelector('[data-key="tags"]').value.split(',').map(s => s.trim()).filter(Boolean)
    }));

    // Tools — auto-resolve logos from registry
    od.tools = [...document.querySelectorAll('#oeToolsList .oe-list-item')].map(el => {
        const name = el.querySelector('[data-key="name"]').value.trim();
        const manualLogo = el.querySelector('[data-key="logo"]').value.trim();
        return {
            name,
            url: el.querySelector('[data-key="url"]').value.trim(),
            purpose: el.querySelector('[data-key="purpose"]').value.trim(),
            logo: manualLogo || _resolveToolLogo(name, '')
        };
    });
    od.toolsNote = document.getElementById('oeToolsNote').value.trim();

    // Equipment
    od.equipment = [...document.querySelectorAll('#oeEquipList .oe-list-item')].map(el => ({
        icon: el.querySelector('[data-key="icon"]').value.trim(),
        label: el.querySelector('[data-key="label"]').value.trim(),
        detail: el.querySelector('[data-key="detail"]').value.trim()
    }));
    od.equipNote = document.getElementById('oeEquipNote').value.trim();

    // TA
    od.taConfig = {
        count: document.getElementById('oeTaCount').value.trim(),
        duties: document.getElementById('oeTaDuties').value.split('\n').map(s => s.trim()).filter(Boolean)
    };

    return od;
}

// ── Save ──
async function saveOutlineData() {
    if (!projectData?.id) { alert('無法儲存：找不到專案 ID'); return; }
    const btn = document.getElementById('btnSaveOutline');
    const statusEl = document.getElementById('outlineSaveStatus');
    btn.disabled = true;
    btn.textContent = '儲存中...';
    try {
        const outline_data = collectOutlineData();
        const { error } = await db.update('projects', { outline_data }, { id: `eq.${projectData.id}` });
        if (error) throw new Error(JSON.stringify(error));
        projectData.outline_data = outline_data;
        renderOutlineFromDB();
        statusEl.textContent = `✓ 已儲存（${new Date().toLocaleTimeString('zh-TW')})`;
        statusEl.style.display = 'block';
        statusEl.style.color = '#059669';
        setTimeout(() => statusEl.style.display = 'none', 3000);
    } catch (e) {
        statusEl.textContent = `✗ 儲存失敗：${e.message}`;
        statusEl.style.display = 'block';
        statusEl.style.color = '#ef4444';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">save</span> 儲存大綱';
    }
}

// ── Import Defaults (from hardcoded HTML) ──
function importDefaults() {
    if (document.querySelectorAll('#oeTimelineList .oe-list-item').length > 0) {
        if (!confirm('目前表單已有資料，匯入預設值會覆蓋。確定要匯入嗎？')) return;
    }
    // Clear existing
    document.getElementById('oeTimelineList').innerHTML = '';
    document.getElementById('oeToolsList').innerHTML = '';
    document.getElementById('oeEquipList').innerHTML = '';
    _tlCounter = 0; _toolCounter = 0; _eqCounter = 0;

    // Hero defaults
    _v('oeHeroSubtitle', '從 ChatGPT 到 Notion，掌握五大 AI 工具在日常辦公中的應用技巧，全面提升工作效率與產出品質');
    _v('oeHeroDays', '1');
    _v('oeHeroDuration', '7 小時（含休息）');
    _v('oeHeroGroupSize', '20–30 人');
    _v('oeHeroLocation', '現場實體授課');

    // Default schedule
    document.getElementById('oeScheduleList').innerHTML = '';
    addScheduleDay({ day: 1, hours: '7', topic: 'AI 辦公應用實戰' });

    // Default timeline
    const defaultTimeline = [
        { day: 1, time: '20 分鐘', title: '開場：AI 趨勢與辦公應用概覽', desc: '介紹 AI 辦公趨勢，說明 AI 如何改變日常工作流程。', tags: ['AI 趨勢', '案例分享'] },
        { day: 1, time: '50 分鐘', title: '模組一：ChatGPT — AI 文字助手', desc: '核心功能與 Prompt 設計技巧，涵蓋文件撰寫、Email 修潤、資料分析。', tags: ['ChatGPT', 'Prompt 工程'] },
        { day: 1, time: '40 分鐘', title: '模組二：Gemini — Google 生態系 AI 整合', desc: '在 Gmail、Docs、Sheets 中串聯 AI，學習跨平台協作。', tags: ['Gemini', 'Google 協作'] },
        { day: 1, time: '40 分鐘', title: '模組三：NotebookLM — AI 知識庫與研究助手', desc: '將內部文件上傳建立專屬知識庫，實作文件問答與重點摘要。', tags: ['NotebookLM', '知識庫建構'] },
        { day: 1, time: '40 分鐘', title: '模組四：Gamma — AI 簡報設計', desc: 'AI 自動簡報生成，快速製作專業提案簡報。', tags: ['Gamma', 'AI 簡報'] },
        { day: 1, time: '30 分鐘', title: '模組五：Notion — AI 會議記錄與專案管理', desc: '會議記錄整理、待辦追蹤和團隊知識管理。', tags: ['Notion', '專案管理'] },
        { day: 1, time: '10 分鐘', title: '總結與 Q&A', desc: '回顧課程重點，開放提問。', tags: ['Q&A'] },
    ];
    defaultTimeline.forEach(b => addTimelineBlock(b));

    // Default tools
    const defaultTools = [
        { name: 'ChatGPT', purpose: '文字生成、文件撰寫、資料分析、Email 修潤', url: 'https://chat.openai.com', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg' },
        { name: 'Gemini', purpose: 'Google 生態系 AI 助手、跨平台文件協作', url: 'https://gemini.google.com', logo: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690b6.svg' },
        { name: 'NotebookLM', purpose: '文件知識庫建構、AI 輔助閱讀與研究', url: 'https://notebooklm.google.com', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/58/NotebookLM_icon.svg' },
        { name: 'Gamma', purpose: 'AI 驅動的簡報、文件與網頁自動設計', url: 'https://gamma.app', logo: 'https://assets-global.website-files.com/6537a67c83a22a5e41e9d55c/6537a67c83a22a5e41e9d639_Gamma_V2_Logo.svg' },
        { name: 'Notion', purpose: 'AI 會議記錄、專案管理、團隊知識庫', url: 'https://www.notion.so', logo: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png' },
    ];
    defaultTools.forEach(t => addToolBlock(t));
    _v('oeToolsNote', '以上工具皆提供免費版本可供課程期間使用。建議學員於課前先完成各平台帳號註冊，以利課堂順利進行。');

    // Default equipment
    const defaultEquip = [
        { icon: 'laptop_mac', label: '學員筆電', detail: '每人 1 台，需可上網' },
        { icon: 'wifi', label: '穩定網路', detail: '建議頻寬 ≥ 100Mbps' },
        { icon: 'tv', label: '投影設備', detail: '大螢幕 / 投影機 × 1' },
        { icon: 'mic', label: '擴音設備', detail: '無線麥克風 × 1' },
        { icon: 'power', label: '電源供應', detail: '充足插座 / 延長線' },
        { icon: 'meeting_room', label: '教室座位', detail: '課桌式，需有桌面' },
    ];
    defaultEquip.forEach(e => addEquipBlock(e));
    _v('oeEquipNote', '請學員於課前完成以下帳號註冊 — ChatGPT、Google（Gemini/NotebookLM）、Gamma、Notion。建議使用 Chrome 瀏覽器以獲得最佳體驗。');

    // Default TA
    _v('oeTaCount', '1–2 位');
    _v('oeTaDuties', '負責協助學員操作工具、排除技術問題\n即時回答學員在實作練習中的問題\n協助發放課程講義與學習資源');

    const statusEl = document.getElementById('outlineSaveStatus');
    statusEl.textContent = '✓ 已匯入預設值，請編輯後按「儲存大綱」';
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--accent)';
}

// ══════════════════════════════════════
// ADMIN: Students
// ══════════════════════════════════════
async function loadStudents() {
    let opts = { select: 'id,name,email,login_password,created_at', order: 'created_at.desc' };
    if (sessionData) {
        opts.filter = { session_code: `eq.${sessionData.session_code}` };
    } else if (projectData?.id) {
        // No session loaded — try to find all sessions for this project
        const { data: allSess } = await db.select('project_sessions', { filter: { project_id: `eq.${projectData.id}` }, select: 'session_code' });
        const codes = (allSess || []).map(s => s.session_code).filter(Boolean);
        if (codes.length) {
            opts.filter = { session_code: `in.(${codes.join(',')})` };
        } else {
            // No sessions → no students
            students = [];
            renderStudentTable();
            return;
        }
    } else {
        students = [];
        renderStudentTable();
        return;
    }
    const { data } = await db.select('students', opts);
    students = data || [];
    renderStudentTable();
}

function renderStudentTable() {
    const tbody = document.getElementById('studentTableBody');
    if (!tbody) return;
    if (!students.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:32px">尚無學員資料</td></tr>';
        return;
    }
    tbody.innerHTML = students.map(s => `<tr>
        <td><strong>${s.name||'—'}</strong></td><td>${s.email}</td>
        <td style="font-family:monospace;font-size:0.8rem;color:var(--text-3)">${s.login_password||'—'}</td>
        <td><button class="btn btn-outline" style="padding:4px 8px;font-size:0.78rem" onclick="deleteStudent('${s.id}')"><span class="material-symbols-outlined" style="font-size:14px">delete</span></button></td>
    </tr>`).join('');
    document.getElementById('studentCount').textContent = students.length;
}

window.deleteStudent = async (id) => {
    if (!confirm('確定刪除此學員？')) return;
    await db.delete('students', { id: `eq.${id}` });
    loadStudents();
};

window.openAddStudentModal = () => document.getElementById('addStudentModal').classList.add('show');
window.closeAddStudentModal = () => { document.getElementById('addStudentModal').classList.remove('show'); document.getElementById('addStudentForm').reset(); };

window.submitAddStudent = async () => {
    const name = document.getElementById('addName').value.trim();
    const email = document.getElementById('addEmail').value.trim();
    if (!name || !email) { alert('姓名與 Email 為必填'); return; }
    const record = {
        name, email,
        login_password: document.getElementById('addPass').value.trim() || genPwd(),
        session_code: sessionData?.session_code || '',
        session_id: sessionData?.id || null,
        project_id: projectData?.id || '',
        order_id: `outline-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    };
    const { error } = await db.insert('students', record);
    if (error) { alert('新增失敗：' + JSON.stringify(error)); return; }
    closeAddStudentModal();
    loadStudents();
};

function genPwd() { return Math.random().toString(36).substr(2, 6); }

// ── CSV Import ──
let pendingImport = [];

window.openImportModal = () => {
    document.getElementById('importModal').classList.add('show');
    document.getElementById('importPreview').innerHTML = '';
    document.getElementById('importFooter').style.display = 'none';
    pendingImport = [];
};
window.closeImportModal = () => document.getElementById('importModal').classList.remove('show');

window.handleImportFile = (input) => {
    const file = input.files[0];
    if (!file || !file.name.endsWith('.csv')) { alert('請上傳 .csv 檔案'); return; }
    const reader = new FileReader();
    reader.onload = (e) => parseCSV(e.target.result);
    reader.readAsText(file, 'UTF-8');
};

function parseCSV(text) {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { alert('CSV 至少需要標題行 + 一筆資料'); return; }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const obj = {};
        headers.forEach((h, i) => obj[h] = vals[i] || '');
        return obj;
    });
    pendingImport = rows.map(r => ({
        name: r['姓名'] || r.name || '',
        email: r['Email'] || r.email || r['信箱'] || '',
        login_password: r['密碼'] || r.password || r.login_password || genPwd(),
        session_code: sessionData?.session_code || '',
        session_id: sessionData?.id || null,
        project_id: projectData?.id || '',
        order_id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    })).filter(r => r.name && r.email);

    document.getElementById('importPreview').innerHTML = `
        <p style="font-size:0.85rem;margin-bottom:8px">共解析 <strong>${pendingImport.length}</strong> 筆學員</p>
        <table><thead><tr><th>姓名</th><th>Email</th><th>密碼</th></tr></thead>
        <tbody>${pendingImport.slice(0,15).map(r=>`<tr><td>${r.name}</td><td>${r.email}</td><td>${r.login_password}</td></tr>`).join('')}
        ${pendingImport.length>15?`<tr><td colspan="3" style="text-align:center;color:#94a3b8">... 還有 ${pendingImport.length-15} 筆</td></tr>`:''}</tbody></table>`;
    document.getElementById('importFooter').style.display = 'flex';
}

window.doImport = async () => {
    if (!pendingImport.length) return;
    const btn = document.getElementById('btnConfirmImport');
    btn.disabled = true; btn.textContent = '匯入中...';
    let ok = 0, fail = 0;
    for (const row of pendingImport) {
        try { const { error } = await db.insert('students', row); error ? fail++ : ok++; }
        catch { fail++; }
    }
    alert(`匯入完成：成功 ${ok} 筆${fail>0?`，失敗 ${fail} 筆`:''}`);
    btn.disabled = false; btn.textContent = '確認匯入';
    closeImportModal(); loadStudents();
};

window.downloadTemplate = () => {
    const csv = '姓名,Email,密碼\n王小明,ming@example.com,abc123\n李小華,hua@example.com,xyz789';
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'students_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// ══════════════════════════════════════
// ADMIN: Instructor Module
// ══════════════════════════════════════
let instructors = [];

async function loadInstructors() {
    const { data } = await db.select('instructors', { order: 'created_at.desc' });
    instructors = data || [];
    const sel = document.getElementById('instructorSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">— 選擇講師 —</option>' +
        instructors.map(i => `<option value="${i.id}">${i.name}（${i.email}）</option>`).join('');
}

// Track selected instructor IDs
let selectedInstructorIds = [];

window.addInstructorToList = (selectEl) => {
    const id = selectEl.value;
    if (!id || selectedInstructorIds.includes(id)) { selectEl.value = ''; return; }
    selectedInstructorIds.push(id);
    selectEl.value = '';
    renderSelectedInstructors();
    renderStudentInstructors();
};

window.removeInstructorFromList = (id) => {
    selectedInstructorIds = selectedInstructorIds.filter(x => x !== id);
    renderSelectedInstructors();
    renderStudentInstructors();
};

function renderSelectedInstructors() {
    const container = document.getElementById('selectedInstructorsList');
    if (!container) return;
    if (!selectedInstructorIds.length) {
        container.innerHTML = '<div style="color:var(--text-3);font-size:0.82rem;padding:12px 0">尚未選擇講師</div>';
        return;
    }
    container.innerHTML = selectedInstructorIds.map(id => {
        const inst = instructors.find(i => i.id === id);
        if (!inst) return '';
        const photo = inst.photo_url
            ? `<img src="${inst.photo_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`
            : '<span class="material-symbols-outlined" style="font-size:20px;color:var(--text-3)">person</span>';
        return `<div style="display:flex;align-items:center;gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px">
            ${photo}
            <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:0.88rem">${inst.name}</div>
                <div style="font-size:0.75rem;color:var(--text-3)">${inst.title || inst.email}</div>
            </div>
            <button class="btn btn-outline" style="padding:4px 6px;font-size:0.75rem" onclick="removeInstructorFromList('${id}')">
                <span class="material-symbols-outlined" style="font-size:14px">close</span>
            </button>
        </div>`;
    }).join('');
}

function renderStudentInstructors() {
    const el = document.getElementById('instructorContent');
    if (!el) return;
    if (!selectedInstructorIds.length) { el.innerHTML = ''; return; }
    el.innerHTML = selectedInstructorIds.map(id => {
        const inst = instructors.find(i => i.id === id);
        if (!inst) return '';
        const photo = inst.photo_url
            ? `<img class="instructor-photo" src="${inst.photo_url}" alt="${inst.name}">`
            : '<div class="instructor-photo-placeholder"><span class="material-symbols-outlined">person</span></div>';
        const specs = (inst.specialties||[]).map(s=>`<span class="instructor-tag">${s}</span>`).join('');
        const gallery = (inst.teaching_photos||[]);
        const galleryHtml = gallery.length ? `<div class="instructor-gallery"><div class="instructor-gallery-title">📸 授課紀錄</div><div class="instructor-gallery-grid">${gallery.map(u=>`<img src="${u}" alt="授課照片" loading="lazy">`).join('')}</div></div>` : '';
        return `<div class="instructor-card"><div class="instructor-main">${photo}<div class="instructor-info"><div class="instructor-name">${inst.name}</div><div class="instructor-title-text">${inst.title||''}</div><div class="instructor-bio">${inst.bio||''}</div><div class="instructor-tags">${specs}</div></div></div>${galleryHtml}</div>`;
    }).join('');
}

// ══════════════════════════════════════
// ADMIN: Organization / Client Management
// ══════════════════════════════════════
let organizations = [];

async function loadOrganizations() {
    const { data } = await db.select('organizations', { order: 'created_at.desc' });
    organizations = data || [];
    renderOrgTable();
}

function renderOrgTable() {
    const container = document.getElementById('orgSectionContent');
    if (!container) return;

    // Check if project is already bound to an org
    const boundOrg = projectData?.organization_id
        ? organizations.find(o => o.id === projectData.organization_id)
        : null;

    if (boundOrg) {
        // Show compact bound client info card
        container.innerHTML = `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:200px">
                    ${boundOrg.logo_url ? `<img src="${boundOrg.logo_url}" style="height:36px;width:auto;object-fit:contain;border-radius:8px">` : '<span class="material-symbols-outlined" style="font-size:32px;color:var(--text-3)">business</span>'}
                    <div>
                        <div style="font-weight:700;font-size:1rem">${boundOrg.name}</div>
                        <div style="font-size:0.78rem;color:var(--text-3)">${[boundOrg.contact_person, boundOrg.contact_email, boundOrg.phone].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-outline" style="font-size:0.78rem" onclick="editOrg('${boundOrg.id}')">
                        <span class="material-symbols-outlined" style="font-size:14px">edit</span> 編輯
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // Not bound — show full management table
    container.innerHTML = `
        <div class="admin-toolbar">
            <button class="btn btn-primary" onclick="openOrgModal()">
                <span class="material-symbols-outlined">add_business</span> 新增客戶
            </button>
        </div>
        <div style="overflow-x:auto">
            <table class="admin-table">
                <thead><tr><th>客戶名稱</th><th>聯絡人</th><th>電話</th><th>報價</th><th></th></tr></thead>
                <tbody id="orgTableBody">
                    ${!organizations.length
                        ? '<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:32px">尚無客戶資料</td></tr>'
                        : organizations.map(o => `<tr>
                            <td><div style="display:flex;align-items:center;gap:10px">
                                ${o.logo_url ? `<img src="${o.logo_url}" style="height:28px;width:auto;object-fit:contain;border-radius:4px">` : '<span class="material-symbols-outlined" style="font-size:20px;color:var(--text-3)">business</span>'}
                                <strong>${o.name}</strong></div></td>
                            <td>${o.contact_person || o.contact_email || '—'}</td>
                            <td>${o.phone || '—'}</td>
                            <td>${o.pricing || '—'}</td>
                            <td style="white-space:nowrap">
                                <button class="btn btn-outline" style="padding:4px 8px;font-size:0.78rem" onclick="editOrg('${o.id}')"><span class="material-symbols-outlined" style="font-size:14px">edit</span></button>
                                <button class="btn btn-outline" style="padding:4px 8px;font-size:0.78rem;margin-left:4px" onclick="deleteOrg('${o.id}')"><span class="material-symbols-outlined" style="font-size:14px">delete</span></button>
                            </td></tr>`).join('')}
                </tbody>
            </table>
        </div>
        <p style="font-size:0.82rem;color:var(--text-3);margin-top:12px">
            <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">info</span>
            新增客戶後，請到專案設定中綁定。
        </p>
    `;
}

window.openOrgModal = (editId) => {
    const modal = document.getElementById('orgModal');
    const form = document.getElementById('orgForm');
    form.reset();
    if (editId) {
        const o = organizations.find(x => x.id === editId);
        if (o) {
            document.getElementById('orgModalTitle').textContent = '編輯客戶';
            document.getElementById('orgId').value = o.id;
            document.getElementById('orgName').value = o.name || '';
            document.getElementById('orgLogo').value = o.logo_url || '';
            document.getElementById('orgContact').value = o.contact_person || '';
            document.getElementById('orgEmail').value = o.contact_email || '';
            document.getElementById('orgPhone').value = o.phone || '';
            document.getElementById('orgPricing').value = o.pricing || '';
        }
    } else {
        document.getElementById('orgModalTitle').textContent = '新增客戶';
        document.getElementById('orgId').value = '';
    }
    modal.classList.add('show');
};
window.closeOrgModal = () => document.getElementById('orgModal').classList.remove('show');

window.editOrg = (id) => openOrgModal(id);
window.deleteOrg = async (id) => {
    if (!confirm('確定刪除此客戶？')) return;
    await db.delete('organizations', { id: `eq.${id}` });
    loadOrganizations();
};

window.submitOrg = async () => {
    const id = document.getElementById('orgId').value;
    const record = {
        name: document.getElementById('orgName').value.trim(),
        logo_url: document.getElementById('orgLogo').value.trim(),
        contact_person: document.getElementById('orgContact').value.trim(),
        contact_email: document.getElementById('orgEmail').value.trim(),
        phone: document.getElementById('orgPhone').value.trim(),
        pricing: document.getElementById('orgPricing').value.trim(),
    };
    if (!record.name) { alert('客戶名稱為必填'); return; }
    if (id) {
        await db.update('organizations', record, { id: `eq.${id}` });
    } else {
        await db.insert('organizations', record);
    }
    closeOrgModal();
    loadOrganizations();
};

// Logo upload for org
window.handleOrgLogoUpload = async (input) => {
    const file = input.files[0];
    if (!file) return;
    const key = `org-logos/${Date.now()}_${file.name}`;
    const { data, error } = await storage.upload('outline-files', key, file);
    if (error) { alert('上傳失敗'); return; }
    document.getElementById('orgLogo').value = data.url;
    input.value = '';
};

// ══════════════════════════════════════
// HR NOTIFICATION EMAIL TEMPLATE
// ══════════════════════════════════════
function initHrEmail() {
    const contentEl = document.getElementById('hrEmailContent');
    const copyBtn = document.getElementById('btnCopyEmail');
    if (!contentEl) return;

    // Auto-generate email content
    const od = getOutlineData() || {};
    const hero = od.hero || {};
    const courseName = projectData?.name || '課程名稱';
    const clientName = orgData?.name || '貴公司';
    const joinCode = sessionData?.session_code || '';
    const loginUrl = `${location.origin}/course-outline.html?project=${projectData?.id || ''}`;

    // Schedule from schedule array
    const schedule = od.schedule || [];
    let scheduleText = '';
    if (schedule.length > 1) {
        const totalH = schedule.reduce((s, d) => s + (parseFloat(d.hours) || 0), 0);
        scheduleText = totalH ? `${schedule.length} 天 / 共 ${totalH} 小時` : `${schedule.length} 天`;
    } else if (schedule.length === 1 && schedule[0].hours) {
        scheduleText = `${schedule[0].hours} 小時`;
    } else {
        scheduleText = hero.duration || '';
    }

    // Timeline summary grouped by day — items only, no times, with dept
    const timeline = od.timeline || [];
    const _isBreak = b => b.isBreak || /休息|午餐|break/i.test(b.title || '');
    let moduleSummary = '';
    if (schedule.length > 1) {
        moduleSummary = schedule.map(s => {
            const dayBlocks = timeline.filter(b => (b.day || 1) === s.day && !_isBreak(b));
            const items = dayBlocks.map((b, i) => {
                const deptTag = (b.dept && b.dept !== '全部門') ? `【${b.dept}】` : '';
                return `    ${i + 1}. ${b.title}${deptTag}`;
            }).join('\n');
            return `  【Day ${s.day}${s.hours ? ` — ${s.hours} 小時` : ''}${s.topic ? ` ${s.topic}` : ''}】\n${items || '    （尚未設定）'}`;
        }).join('\n\n');
    } else {
        const nonBreak = timeline.filter(b => !_isBreak(b));
        moduleSummary = nonBreak.map((b, i) => {
            const deptTag = (b.dept && b.dept !== '全部門') ? `【${b.dept}】` : '';
            return `  ${i + 1}. ${b.title}${deptTag}`;
        }).join('\n');
    }

    // Prep items from equipment
    const equipItems = (od.equipment || []).map(e =>
        `  ✓ ${e.label}${e.detail ? `：${e.detail}` : ''}`
    ).join('\n');
    const equipNote = od.equipNote || '';

    // Tools
    const toolNames = (od.tools || []).map(t => t.name).join('、');

    contentEl.textContent = `各位同仁好：

公司將舉辦「${courseName}」教育訓練，誠摯邀請您參加。以下為課程相關資訊，請詳閱並預做準備。


━━━━━━━━━━━━━━━━━━━━
📋 課程簡介
━━━━━━━━━━━━━━━━━━━━

課程名稱：${courseName}
${hero.subtitle ? `課程說明：${hero.subtitle}` : ''}
授課時數：${scheduleText}
人　　數：${hero.groupSize || ''}
授課方式：${hero.location || '現場實體授課'}
${toolNames ? `使用工具：${toolNames}` : ''}

課程大綱：
${moduleSummary || '  （尚未設定課程模組）'}


━━━━━━━━━━━━━━━━━━━━
📌 課程須知
━━━━━━━━━━━━━━━━━━━━

  1. 本課程屬於數位課程，不提供實體講義。
  2. 本次課程簡報採用特別開發的互動式簡報，上課當天可透過「課前準備頁」進入簡報連結，進行課堂互動。
  3. 講師將進行螢幕錄影（原檔交付不剪輯）。若需實體拍攝請自行安排。若錄影因設備意外中斷，將提供課程逐字稿摘要供後續參考。


━━━━━━━━━━━━━━━━━━━━
🔗 學員登入入口
━━━━━━━━━━━━━━━━━━━━

請於課前使用以下連結登入課程系統：
${loginUrl}
${joinCode ? `\n課程代碼：${joinCode}` : ''}

登入方式：輸入您的 Email 與課程代碼即可進入。


━━━━━━━━━━━━━━━━━━━━
📝 課前準備事項
━━━━━━━━━━━━━━━━━━━━

${equipItems || '  ✓ 請自備筆電，需可連接網路'}
${equipNote ? `\n⚠️ ${equipNote}` : ''}


━━━━━━━━━━━━━━━━━━━━
📅 上課時間與地點
━━━━━━━━━━━━━━━━━━━━

日　　期：【請填入上課日期】
時　　間：【請填入上課時間】
地　　點：【請填入上課地點】


如有任何問題，請洽人力資源部。
期待您的參與！

${clientName} 人力資源部 敬上`;

    // Copy button
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const text = contentEl.innerText;
            navigator.clipboard.writeText(text).then(() => {
                const orig = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">check</span> 已複製';
                setTimeout(() => { copyBtn.innerHTML = orig; }, 2000);
            });
        });
    }
}

// ══════════════════════════════════════
// FILE UPLOAD (with DB persistence)
// ══════════════════════════════════════
window.triggerFileUpload = () => document.getElementById('fileUploadInput').click();

window.handleFileUpload = async (input) => {
    const files = input.files;
    if (!files.length) return;
    const allowed = ['.ppt','.pptx','.doc','.docx','.pdf','.vsdx','.vsd','.xls','.xlsx','.txt'];
    const progressEl = document.getElementById('uploadProgress');

    for (const file of files) {
        const ext = '.'+file.name.split('.').pop().toLowerCase();
        if (!allowed.includes(ext)) { alert(`不支援的格式：${ext}`); continue; }
        if (file.size > 50*1024*1024) { alert('檔案上限 50MB'); continue; }

        // Show progress
        if (progressEl) {
            progressEl.style.display = 'block';
            progressEl.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 0">
                    <span class="material-symbols-outlined" style="font-size:18px;color:var(--accent);animation:spin 1s linear infinite">sync</span>
                    <div style="flex:1">
                        <div style="font-size:0.82rem;font-weight:600;margin-bottom:4px">正在上傳 ${file.name}...</div>
                        <div style="height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden">
                            <div style="height:100%;width:60%;background:var(--accent);border-radius:2px;animation:progressPulse 1.5s ease-in-out infinite"></div>
                        </div>
                    </div>
                </div>`;
        }

        const projectId = projectData?.id || 'default';
        const key = `projects/${projectId}/${Date.now()}_${file.name}`;
        const { data, error } = await storage.upload('outline-files', key, file);

        if (error) {
            if (progressEl) progressEl.style.display = 'none';
            alert('上傳失敗：' + (error.message || '未知錯誤'));
        } else {
            // Save to DB
            const fileRecord = {
                project_id: projectId,
                file_name: file.name,
                file_size: file.size,
                file_url: data.url,
                storage_key: key,
                uploaded_by: currentUser?.email || currentUser?.name || 'anonymous'
            };
            await db.insert('project_files', fileRecord);
            uploadedFiles.push(fileRecord);
            renderFileList();

            // Update progress to success
            if (progressEl) {
                progressEl.innerHTML = `
                    <div style="display:flex;align-items:center;gap:10px;padding:8px 0">
                        <span class="material-symbols-outlined" style="font-size:18px;color:#059669">check_circle</span>
                        <span style="font-size:0.82rem;font-weight:600;color:#059669">${file.name} 上傳完成</span>
                    </div>`;
                setTimeout(() => { progressEl.style.display = 'none'; }, 2500);
            }
        }
    }
    input.value = '';
};

async function loadUploadedFiles() {
    const projectId = projectData?.id;
    if (!projectId) { renderFileList(); return; }
    const { data } = await db.select('project_files', { project_id: projectId });
    if (data?.length) {
        uploadedFiles = data.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    }
    renderFileList();
}

function renderFileList() {
    const list = document.getElementById('fileList');
    if (!list || !uploadedFiles.length) { if(list) list.innerHTML=''; return; }
    const icons = { ppt:'slideshow',pptx:'slideshow',doc:'article',docx:'article',xls:'table_chart',xlsx:'table_chart',pdf:'picture_as_pdf',vsd:'schema',vsdx:'schema',txt:'description' };
    list.innerHTML = uploadedFiles.map((f,i) => {
        const ext = (f.file_name||f.name||'').split('.').pop().toLowerCase();
        const icon = icons[ext] || 'description';
        const name = f.file_name || f.name;
        const bytes = f.file_size || f.size || 0;
        const size = bytes < 1024 ? bytes+'B' : bytes < 1048576 ? (bytes/1024).toFixed(1)+'KB' : (bytes/1048576).toFixed(1)+'MB';
        const url = f.file_url || f.url || '#';
        return `<div class="file-item">
            <div class="file-item-left">
                <span class="material-symbols-outlined">${icon}</span>
                <div>
                    <div class="file-item-name"><a href="${url}" target="_blank" style="color:inherit;text-decoration:none" title="點擊下載">${name}</a></div>
                    <div class="file-item-size">${size}${f.uploaded_by ? ' · ' + f.uploaded_by : ''}</div>
                </div>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
                <a href="${url}" target="_blank" style="color:var(--accent);display:flex;align-items:center" title="下載"><span class="material-symbols-outlined" style="font-size:18px">download</span></a>
                <button class="file-delete-btn" onclick="removeFile(${i})"><span class="material-symbols-outlined">close</span></button>
            </div>
        </div>`;
    }).join('');
}

window.removeFile = async (idx) => {
    const file = uploadedFiles[idx];
    if (file?.id) {
        await db.delete('project_files', file.id);
    }
    uploadedFiles.splice(idx, 1);
    renderFileList();
};
window.outlineLogout = () => { sessionStorage.removeItem('outline_user'); location.reload(); };

// ══════════════════════════════════════
// AI OUTLINE GENERATION
// ══════════════════════════════════════

window.closeAiOutlineModal = () => document.getElementById('aiOutlineModal').classList.remove('show');

// Common AI tools list for checkbox selection
const AI_TOOL_OPTIONS = [
    'ChatGPT', 'Gemini', 'Claude', 'Copilot', 'Perplexity',
    'NotebookLM', 'Gamma', 'Notion', 'Canva', 'Lovable',
    'Cursor', 'v0', 'Midjourney', 'Napkin AI', 'HeyGen'
];

function _renderToolCheckboxes(prefix, selectedTools = []) {
    const selected = selectedTools.map(t => t.trim().toLowerCase());
    let html = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">';
    AI_TOOL_OPTIONS.forEach(tool => {
        const checked = selected.includes(tool.toLowerCase()) ? 'checked' : '';
        html += `<label style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:1px solid ${checked ? 'var(--accent)' : 'var(--border)'};background:${checked ? 'var(--accent-light)' : '#fff'};cursor:pointer;font-size:0.78rem;font-weight:500;transition:all .15s;user-select:none" 
            onmouseover="this.style.borderColor='var(--accent)'" onmouseout="if(!this.querySelector('input').checked)this.style.borderColor='var(--border)'">
            <input type="checkbox" class="${prefix}-tool-cb" value="${tool}" ${checked} 
                onchange="this.parentElement.style.borderColor=this.checked?'var(--accent)':'var(--border)';this.parentElement.style.background=this.checked?'var(--accent-light)':'#fff'"
                style="width:14px;height:14px;accent-color:var(--accent)">
            ${tool}
        </label>`;
    });
    html += '</div>';
    html += `<input class="form-input ${prefix}-tool-other" type="text" placeholder="其他工具（逗號分隔）" style="margin-top:6px;font-size:0.78rem">`;
    return html;
}

// Dynamic per-day tool inputs
window.updateAiToolInputs = function() {
    const daysVal = document.getElementById('aiOlDays').value;
    const numDays = Math.ceil(parseFloat(daysVal) || 1);
    const group = document.getElementById('aiOlToolsGroup');
    if (!group) return;
    if (numDays <= 1) {
        group.innerHTML = `<label class="form-label">指定工具（選填，可複選）</label>` + _renderToolCheckboxes('aiOlSingle');
    } else {
        let html = '<label class="form-label">每日指定工具（選填，可複選）</label>';
        for (let d = 1; d <= numDays; d++) {
            html += `<div style="margin-top:${d > 1 ? '10' : '0'}px;padding:8px 12px;background:#fafbfc;border-radius:8px;border:1px solid var(--border)">
                <div style="font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:4px">Day ${d}</div>
                ${_renderToolCheckboxes(`aiOlDay${d}`)}
            </div>`;
        }
        group.innerHTML = html;
    }
};

window.startAiOutlineGeneration = async function() {
    const statusEl = document.getElementById('aiOlStatus');
    const btn = document.getElementById('btnStartAiGen');
    const transcript = document.getElementById('aiOlTranscript').value.trim();

    if (!transcript && !document.getElementById('aiOlClient').value.trim()) {
        statusEl.textContent = '⚠️ 請至少填寫客戶名稱或需求描述';
        statusEl.style.color = '#ef4444';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;animation:spin 1s linear infinite">progress_activity</span> AI 生成中...';
    statusEl.textContent = '正在分析需求並生成課綱，約需 15-30 秒...';
    statusEl.style.color = 'var(--text-3)';

    // Collect inputs
    const client = document.getElementById('aiOlClient').value.trim();
    const industry = document.getElementById('aiOlIndustry').value.trim();
    const depts = document.getElementById('aiOlDepts').value.trim();
    const days = document.getElementById('aiOlDays').value;
    const hours = document.getElementById('aiOlHours').value;
    const level = document.getElementById('aiOlLevel').value;

    // Helper: get checked tools + other text for a prefix
    function _getCheckedTools(prefix) {
        const checked = Array.from(document.querySelectorAll(`.${prefix}-tool-cb:checked`)).map(cb => cb.value);
        const other = document.querySelector(`.${prefix}-tool-other`)?.value.trim();
        if (other) checked.push(...other.split(',').map(s => s.trim()).filter(Boolean));
        return checked;
    }

    // Save form values for next time
    const numDays = Math.ceil(parseFloat(days) || 1);
    const formData = { client, industry, depts, days, hours, level, transcript };
    if (numDays > 1) {
        formData.dayTools = [];
        for (let d = 1; d <= numDays; d++) {
            formData.dayTools.push({ day: String(d), tools: _getCheckedTools(`aiOlDay${d}`) });
        }
    } else {
        formData.tools = _getCheckedTools('aiOlSingle');
    }
    if (projectData?.id) localStorage.setItem(`aiOlForm_${projectData.id}`, JSON.stringify(formData));

    // Collect per-day or single tool info for prompt
    let toolsInfo = '';
    if (numDays > 1) {
        const parts = [];
        for (let d = 1; d <= numDays; d++) {
            const tools = _getCheckedTools(`aiOlDay${d}`);
            if (tools.length) parts.push(`Day ${d}：${tools.join(', ')}`);
        }
        if (parts.length) toolsInfo = parts.join('\n');
    } else {
        const tools = _getCheckedTools('aiOlSingle');
        if (tools.length) toolsInfo = tools.join(', ');
    }

    // Build context
    let context = '';
    if (client) context += `客戶公司：${client}\n`;
    if (industry) context += `產業類型：${industry}\n`;
    if (depts) context += `學員部門：${depts}\n`;
    if (days) context += `課程天數：${days} 天\n`;
    if (hours) context += `每天時數：${hours} 小時\n`;
    if (toolsInfo) context += `指定使用工具：\n${toolsInfo}\n`;
    if (level) context += `學員程度：${level}\n`;
    if (transcript) context += `\n客戶需求 / 訪談內容：\n${transcript}\n`;

    const prompt = `你是一位專業的 AI 培訓課程設計師。請根據以下客戶資訊，生成一份完整的 AI 辦公應用培訓課程大綱。

${context}

請回傳嚴格的 JSON 格式（不要包含 markdown 標記），結構如下：
{
  "hero": {
    "subtitle": "課程的一句話副標題描述",
    "duration": "總時數描述，如「4 小時（含休息）」",
    "days": "總天數數字字串，如 \"1\" 或 \"2\"",
    "groupSize": "建議人數，如「建議 20–40 人」",
    "device": "設備需求，如「需自備筆電」",
    "location": "授課方式，如「現場實體授課」"
  },
  "schedule": [
    { "day": 1, "hours": "每天時數（數字字串）", "topic": "該天主題" }
  ],
  "timeline": [
    {
      "day": 1,
      "time": "開始時間 – 結束時間（分鐘數）",
      "title": "模組標題",
      "desc": "2-3 句模組說明，包含具體學習內容",
      "tags": ["關鍵字1", "關鍵字2", "關鍵字3"],
      "isBreak": false
    }
  ],
  "tools": [
    {
      "name": "工具名稱",
      "purpose": "用途說明",
      "url": "工具網址",
      "logo": "Logo 圖片 URL（如果知道的話，否則留空字串）"
    }
  ],
  "equipment": [
    { "icon": "Material Symbol icon 名稱", "label": "設備名稱", "detail": "規格說明" }
  ],
  "toolsNote": "工具使用備註",
  "equipNote": "課前準備提醒",
  "taConfig": {
    "count": "建議助教人數",
    "duties": ["職責1", "職責2", "職責3"]
  }
}

重要規則：
1. timeline 要包含合理的休息時間（isBreak: true），一般每 60-90 分鐘安排 10 分鐘休息
2. 每個模組的 time 要用實際時間格式，例如「09:00 – 09:20（20 分鐘）」
3. 【關鍵】多天課程時，timeline 中每個 block 必須設定正確的 "day" 值（Day 1 的模組 day=1，Day 2 的模組 day=2）
4. 【關鍵】多天課程時，schedule 陣列必須包含每天的項目，例如 2 天課程：[{"day":1,"hours":"7","topic":"Day1主題"},{"day":2,"hours":"7","topic":"Day2主題"}]
5. hero.days 必須設為正確的天數字串（如 "2"），不要永遠設 "1"
6. 如果指定了工具，以指定工具為主；沒指定則根據需求選擇最合適的 AI 工具
7. tools 中的 logo URL 請使用知名 AI 工具的真實圖片，如果不確定就留空字串
8. equipment 中的 icon 請使用 Google Material Symbols 的 icon 名稱
9. tags 從課程內容中提取 2-5 個關鍵字
10. 根據學員部門調整案例和應用場景（例如行銷部側重文案生成，HR 側重招聘流程）
11. 根據學員程度調整教學深度和節奏
12. 輸出純 JSON，不要任何額外文字或 markdown`;

    try {
        const result = await ai.chat([{ role: 'user', content: prompt }], {
            maxTokens: 8192,
            temperature: 0.6
        });

        // Parse JSON from response (handle possible markdown wrapping)
        let json;
        try {
            json = JSON.parse(result);
        } catch {
            // Try extracting from markdown code block
            const match = result.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (match) {
                json = JSON.parse(match[1].trim());
            } else {
                // Try finding first { to last }
                const firstBrace = result.indexOf('{');
                const lastBrace = result.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                    json = JSON.parse(result.substring(firstBrace, lastBrace + 1));
                } else {
                    throw new Error('無法解析 AI 回傳的 JSON');
                }
            }
        }

        // Populate editor forms
        populateEditorFromAI(json);

        statusEl.textContent = '✓ 課綱已生成！請檢查並調整後按「儲存大綱」。';
        statusEl.style.color = '#059669';

        // Close modal
        setTimeout(() => {
            document.getElementById('aiOutlineModal').classList.remove('show');
        }, 1500);

    } catch (e) {
        console.error('[AI Outline]', e);
        statusEl.textContent = `✗ 生成失敗：${e.message}`;
        statusEl.style.color = '#ef4444';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">auto_awesome</span> 開始生成課綱';
    }
};

function populateEditorFromAI(data) {
    // Clear existing items
    document.getElementById('oeTimelineList').innerHTML = '';
    document.getElementById('oeToolsList').innerHTML = '';
    document.getElementById('oeEquipList').innerHTML = '';
    _tlCounter = 0; _toolCounter = 0; _eqCounter = 0;

    // Hero
    if (data.hero) {
        _v('oeHeroSubtitle', data.hero.subtitle);
        _v('oeHeroDays', data.hero.days || '1');
        _v('oeHeroDuration', data.hero.duration || '');
        _v('oeHeroGroupSize', data.hero.groupSize || '20–30 人');
        _v('oeHeroLocation', data.hero.location || '現場實體授課');
    }

    // Timeline
    if (data.timeline?.length) {
        data.timeline.forEach(block => addTimelineBlock(block));
    }

    if (data.tools?.length) {
        data.tools.forEach(tool => {
            if (!tool.logo) tool.logo = _resolveToolLogo(tool.name, '');
            addToolBlock(tool);
        });
    }
    if (data.toolsNote) _v('oeToolsNote', data.toolsNote);

    // Equipment
    if (data.equipment?.length) {
        data.equipment.forEach(eq => addEquipBlock(eq));
    }
    if (data.equipNote) _v('oeEquipNote', data.equipNote);

    // TA
    if (data.taConfig) {
        _v('oeTaCount', data.taConfig.count);
        _v('oeTaDuties', (data.taConfig.duties || []).join('\n'));
    }

    // Scroll to editor
    document.querySelector('.outline-edit-group')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const statusEl = document.getElementById('outlineSaveStatus');
    statusEl.textContent = '✓ AI 課綱已填入，請檢查後按「儲存大綱」';
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--accent)';
}

// Spin animation for loading
if (!document.getElementById('_spinStyle')) {
    const s = document.createElement('style');
    s.id = '_spinStyle';
    s.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
}
