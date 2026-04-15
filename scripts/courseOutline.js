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

// ── Outline Versions ──
let outlineVersions = [];    // [{name, data, created_at}]
let activeVersionIdx = 0;

// ── DOM Ready ──
document.addEventListener('DOMContentLoaded', init);

// Immediately hide login overlay if session exists — prevents flash on refresh
(function() {
    const saved = sessionStorage.getItem('outline_user');
    const params = new URLSearchParams(location.search);
    const isPreview = params.get('preview') === 'admin';
    const hasToken = localStorage.getItem('_at') || sessionStorage.getItem('_at');
    if (saved || isPreview || params.get('code') || (params.get('admin') === '1' && hasToken)) {
        // Hide overlay before paint
        const style = document.createElement('style');
        style.textContent = '#loginOverlay{display:none!important}#pageContent{display:block!important}';
        document.head.appendChild(style);
    }
})();

async function init() {
    const params = new URLSearchParams(location.search);
    isAdmin = params.get('admin') === '1';
    const sessionCode = params.get('session') || '';
    const projectId = params.get('project') || '';
    const joinCode = params.get('code') || '';

    // Load session → project → org chain
    if (joinCode) {
        // ?code=JOINCODE — load project by join_code, auto-login
        const { data: matchedProjects } = await db.select('projects', {
            filter: { join_code: `eq.${joinCode.toUpperCase()}` },
            limit: 1
        });
        if (matchedProjects?.length) {
            projectData = matchedProjects[0];
            if (projectData.organization_id) {
                const { data: orgs } = await db.select('organizations', { filter: { id: `eq.${projectData.organization_id}` } });
                if (orgs?.length) orgData = orgs[0];
            }
            const { data: sess } = await db.select('project_sessions', { filter: { project_id: `eq.${projectData.id}` }, order: 'date.asc', limit: 1 });
            if (sess?.length) sessionData = sess[0];
        }
    } else if (sessionCode) {
        await loadSessionChain(sessionCode);
    } else if (projectId) {
        await loadProjectDirect(projectId);
    }

    // Apply dynamic data to page
    renderDynamicContent();

    // Reveal login overlay now that dynamic content is populated
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.opacity = '1';

    // Auto-login when ?code= loaded a project successfully
    if (joinCode && projectData?.id) {
        currentUser = { name: '訪客', _isClient: true };
        sessionStorage.setItem('outline_user', JSON.stringify(currentUser));
        enterPage();
        return;
    }

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

// ── Extract dominant color from logo and apply to brand panel ──
function extractDominantColor(logoUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            const size = 64;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;

            // Bucket colors, skip near-white/black/grey
            const buckets = {};
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                if (a < 128) continue; // skip transparent
                const max = Math.max(r, g, b), min = Math.min(r, g, b);
                const lum = (max + min) / 2;
                const sat = max === min ? 0 : (max - min) / (lum > 127 ? (510 - max - min) : (max + min));
                if (lum > 240 || lum < 15) continue; // skip near-white/black
                if (sat < 0.15) continue; // skip grey
                // Round to bucket
                const br = Math.round(r / 32) * 32;
                const bg = Math.round(g / 32) * 32;
                const bb = Math.round(b / 32) * 32;
                const key = `${br},${bg},${bb}`;
                buckets[key] = (buckets[key] || 0) + 1;
            }

            // Find the most frequent vibrant bucket
            let bestKey = null, bestCount = 0;
            for (const [key, count] of Object.entries(buckets)) {
                if (count > bestCount) { bestCount = count; bestKey = key; }
            }
            if (!bestKey) return;

            const [cr, cg, cb] = bestKey.split(',').map(Number);
            const hsl = rgbToHsl(cr, cg, cb);
            applyBrandColor(hsl);
        } catch (e) {
            // CORS or canvas tainted — silently ignore
            console.warn('Color extraction failed:', e.message);
        }
    };
    img.onerror = () => {}; // silently ignore
    img.src = logoUrl;
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyBrandColor({ h, s, l }) {
    // Clamp saturation to look nice
    const sat = Math.max(s, 40);
    const overlay = document.getElementById('loginOverlay');
    if (!overlay) return;

    // Set CSS custom properties on the overlay
    overlay.style.setProperty('--brand-h', h);
    overlay.style.setProperty('--brand-s', `${sat}%`);
    overlay.style.setProperty('--brand-l', `${Math.min(l, 55)}%`);

    // Apply dynamic colors to brand panel elements
    const panel = overlay.querySelector('.login-brand-panel');
    if (panel) {
        panel.style.background = `linear-gradient(160deg, hsl(${h}, ${sat * 0.2}%, 4%) 0%, hsl(${h}, ${sat * 0.4}%, 8%) 40%, hsl(${h}, ${sat * 0.3}%, 14%) 100%)`;
        panel.style.setProperty('--glow-color', `hsla(${h}, ${sat}%, ${Math.min(l, 55)}%, 0.12)`);
    }

    // Ambient orbs via pseudo-elements (use CSS variables)
    const style = document.createElement('style');
    style.textContent = `
        .login-brand-panel::before {
            background: radial-gradient(circle, hsla(${h}, ${sat}%, ${Math.min(l, 55)}%, 0.15) 0%, transparent 70%) !important;
        }
        .login-brand-panel::after {
            background: radial-gradient(circle, hsla(${h}, ${Math.max(sat - 10, 30)}%, ${Math.min(l + 10, 60)}%, 0.10) 0%, transparent 70%) !important;
        }
        .login-brand-shape {
            border-color: hsla(${h}, ${sat}%, ${Math.min(l, 55)}%, 0.08) !important;
        }
        .login-brand-shape:nth-child(2) {
            border-color: hsla(${h}, ${Math.max(sat - 15, 25)}%, ${Math.min(l + 10, 60)}%, 0.06) !important;
        }
        .login-brand-shape:nth-child(4) {
            border-color: hsla(${h}, ${Math.max(sat - 5, 30)}%, ${Math.min(l + 5, 58)}%, 0.07) !important;
        }
        .login-brand-title {
            background: linear-gradient(135deg,
                hsl(${h}, ${Math.min(sat + 10, 100)}%, 88%) 0%,
                hsl(${h}, ${sat}%, 80%) 30%,
                hsl(${h}, ${sat}%, 70%) 60%,
                hsl(${h}, ${sat}%, 60%) 100%) !important;
            -webkit-background-clip: text !important;
            background-clip: text !important;
        }
        .login-brand-sub {
            color: hsla(${h}, ${Math.min(sat, 60)}%, 75%, 0.5) !important;
        }
        .login-brand-feature {
            color: hsla(${h}, ${Math.min(sat, 60)}%, 75%, 0.35) !important;
        }
        .login-brand-feature .material-symbols-outlined {
            color: hsla(${h}, ${sat}%, 65%, 0.4) !important;
        }
        .login-brand-icon-wrap {
            box-shadow: 0 8px 32px hsla(${h}, ${sat}%, 20%, 0.3), 0 0 40px hsla(${h}, ${sat}%, ${Math.min(l, 55)}%, 0.15) !important;
        }
        .login-form-panel::before {
            background: linear-gradient(90deg,
                hsl(${h}, ${sat}%, ${Math.min(l, 55)}%),
                hsl(${(h + 20) % 360}, ${Math.max(sat - 10, 30)}%, ${Math.min(l + 5, 58)}%),
                hsl(${(h + 40) % 360}, ${Math.max(sat - 15, 25)}%, ${Math.min(l + 10, 60)}%)) !important;
        }
        .login-btn {
            background: linear-gradient(135deg,
                hsl(${h}, ${sat}%, ${Math.min(l, 55)}%) 0%,
                hsl(${(h + 15) % 360}, ${Math.max(sat - 5, 35)}%, ${Math.min(l - 5, 45)}%) 100%) !important;
        }
        .login-btn:hover {
            box-shadow: 0 8px 25px -5px hsla(${h}, ${sat}%, ${Math.min(l, 55)}%, 0.4),
                        0 4px 10px -5px hsla(${h}, ${sat}%, ${Math.min(l, 55)}%, 0.2) !important;
        }
        .login-field input:focus {
            border-color: hsl(${h}, ${sat}%, ${Math.min(l, 55)}%) !important;
            box-shadow: 0 0 0 4px hsla(${h}, ${sat}%, ${Math.min(l, 55)}%, 0.08) !important;
        }
    `;
    document.head.appendChild(style);
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

    // Login page: client logo (replaces lock icon)
    const loginLogo = document.getElementById('loginClientLogo');
    if (loginLogo && orgData?.logo_url) {
        loginLogo.src = orgData.logo_url;
        loginLogo.alt = clientName;
        loginLogo.style.display = '';
        // Hide the default icon when logo is present
        const lockIcon = document.getElementById('loginBrandIconDefault');
        if (lockIcon) lockIcon.style.display = 'none';
        // Extract dominant color from logo and apply to brand panel
        extractDominantColor(orgData.logo_url);
    }
    // Update brand panel title — show client name on page, OG/meta stays generic
    if (clientName) {
        const brandTitle = document.getElementById('loginBrandTitle');
        if (brandTitle) brandTitle.textContent = clientName;
        const brandSub = document.getElementById('loginBrandSub');
        if (brandSub) brandSub.textContent = '數位簡報室 - 為企業打造數位人才';
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
    document.title = `數位簡報室課程規劃 — ${courseName}`;

    // Admin mode adjustments
    if (isAdmin) {
        document.getElementById('loginTitle').textContent = '管理端登入';
        document.getElementById('loginSubtext').textContent = '輸入管理密碼以進入管理面板';
        const brandTitle = document.getElementById('loginBrandTitle');
        if (brandTitle) brandTitle.textContent = '課程管理後台';
        const brandSub = document.getElementById('loginBrandSub');
        if (brandSub) brandSub.textContent = '編輯課綱 · 管理學員 · 設定內容';
        document.getElementById('labelUser').textContent = '管理密碼';
        const userField = document.getElementById('loginUser');
        userField.placeholder = '管理密碼';
        userField.type = 'password';
        document.querySelector('#fieldEmail .material-symbols-outlined').textContent = 'lock';
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
    // ── Build corrected schedule (shared by hero + timeline) ──
    let schedule = od.schedule ? [...od.schedule] : [];
    if (od.timeline?.length > 0) {
        const uniqueDays = [...new Set(od.timeline.map(b => b.day || 1))].sort((a, b) => a - b);
        // Auto-detect multi-day from timeline blocks
        if (uniqueDays.length > 1 && schedule.length < uniqueDays.length) {
            // Use first existing schedule entry's hours as default for missing days
            const defaultHours = schedule[0]?.hours || '';
            schedule = uniqueDays.map(d => {
                const existing = schedule.find(s => s.day === d);
                if (existing) return existing;
                // Inherit hours from Day 1 if set; otherwise compute from blocks
                if (defaultHours) {
                    return { day: d, hours: defaultHours, topic: '' };
                }
                const dayBlocks = od.timeline.filter(b => (b.day || 1) === d);
                let totalMin = 0;
                dayBlocks.forEach(b => {
                    const m = (b.time || '').match(/(\d+)\s*分鐘/);
                    if (m) totalMin += parseInt(m[1]);
                });
                return { day: d, hours: totalMin ? String(Math.round(totalMin / 60 * 10) / 10) : '', topic: '' };
            });
        }
        // Aggressive fallback: scan timeline text for "Day 2" markers when all blocks are day:1
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
            const fixedDays = [...new Set(od.timeline.map(b => b.day))].sort((a, b) => a - b);
            if (fixedDays.length > 1) {
                const defaultH = schedule[0]?.hours || '';
                schedule = fixedDays.map(d => {
                    const existing = schedule.find(s => s.day === d);
                    if (existing) return existing;
                    if (defaultH) return { day: d, hours: defaultH, topic: '' };
                    const dayBlocks = od.timeline.filter(b => (b.day || 1) === d);
                    let totalMin = 0;
                    dayBlocks.forEach(b => {
                        const m = (b.time || '').match(/(\d+)\s*分鐘/);
                        if (m) totalMin += parseInt(m[1]);
                    });
                    return { day: d, hours: totalMin ? String(Math.round(totalMin / 60 * 10) / 10) : '', topic: '' };
                });
            }
        }
        if (!schedule.length) schedule = [{ day: 1, hours: '', topic: '' }];
    }

    // Hero subtitle & meta
    if (od.hero) {
        const heroSub = document.getElementById('heroSub');
        if (heroSub && od.hero.subtitle) heroSub.textContent = od.hero.subtitle;

        const metaEl = document.getElementById('heroMeta');
        if (metaEl) {
            // Build schedule text from corrected schedule
            let scheduleText = '';
            if (schedule.length > 1) {
                const totalH = schedule.reduce((s, d) => s + (parseFloat(d.hours) || 0), 0);
                scheduleText = totalH ? `${schedule.length} 天 / 共 ${totalH} 小時` : `${schedule.length} 天`;
            } else if (schedule.length === 1 && schedule[0].hours) {
                scheduleText = `${schedule[0].hours} 小時`;
            } else if (od.hero?.duration) {
                scheduleText = od.hero.duration;
            } else if (od.hero?.days && od.hero.days !== '1') {
                scheduleText = `${od.hero.days} 天`;
            }
            // Build date text from schedule dates
            let dateText = '';
            const datesWithValue = schedule.filter(s => s.date);
            if (datesWithValue.length > 0) {
                dateText = datesWithValue.map(s => {
                    const d = new Date(s.date + 'T00:00:00');
                    return `${d.getMonth()+1}/${d.getDate()}（${'日一二三四五六'[d.getDay()]}）`;
                }).join('、');
            }
            const items = [
                { icon: 'schedule', text: scheduleText },
                { icon: 'event', text: dateText },
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

    // Timeline — grouped by day (schedule already corrected above)
    if (od.timeline?.length > 0) {
        const timelineEl = document.querySelector('.timeline');
        if (timelineEl) {
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
                    let badgeText = `Day ${dayInfo.day}`;
                    if (dayInfo.date) {
                        const d = new Date(dayInfo.date + 'T00:00:00');
                        badgeText = `${d.getMonth()+1}/${d.getDate()} ${'日一二三四五六'[d.getDay()]}`;
                    }
                    return `<div class="timeline-day-col">
                        <div class="timeline-day-header">
                            <span class="timeline-day-badge">${badgeText}</span>
                            <span class="timeline-day-info">${dayInfo.topic || ''}${dayInfo.hours ? ` — ${dayInfo.hours} 小時` : ''}</span>
                        </div>
                        ${dayInfo.instructor ? `<div style="display:flex;align-items:center;gap:6px;padding:8px 12px;margin-bottom:10px;background:linear-gradient(135deg,#e8f0fe,#d2e3fc);border-radius:8px;border:1px solid rgba(99,102,241,0.12)"><span class="material-symbols-outlined" style="font-size:16px;color:var(--accent)">person</span><span style="font-size:0.82rem;font-weight:600;color:var(--text-1)">課堂講師：${dayInfo.instructor}</span></div>` : ''}
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

            // Widen container for 3+ day layouts
            if (isMultiDay && schedule.length >= 3) {
                const container = timelineEl.closest('.outline-container');
                if (container) {
                    container.style.maxWidth = schedule.length >= 4 ? '1480px' : '1280px';
                }
            }

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

    // Course Notes — render custom notes if available
    const notesEl = document.getElementById('courseNotesContent');
    if (notesEl) {
        const notes = od.courseNotes?.length ? od.courseNotes : DEFAULT_COURSE_NOTES;
        notesEl.innerHTML = notes.map(n => `
            <div style="display:flex;gap:12px;align-items:flex-start">
                <span class="material-symbols-outlined" style="color:#f59e0b;font-size:22px;flex-shrink:0;margin-top:1px">${n.icon || 'info'}</span>
                <div>
                    <div style="font-weight:600;color:var(--text);margin-bottom:2px">${n.title}</div>
                    <div style="font-size:0.85rem;color:var(--text-2);line-height:1.6">${n.desc}</div>
                </div>
            </div>
        `).join('');
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
        // Copy client link button
        const copyLinkBtn = document.getElementById('btnCopyClientLink');
        if (copyLinkBtn && projectData?.id) {
            copyLinkBtn.addEventListener('click', () => {
                const code = projectData.join_code || '';
                const url = code
                    ? `${location.origin}/course-outline.html?code=${code}`
                    : `${location.origin}/course-outline.html?project=${projectData.id}`;
                navigator.clipboard.writeText(url).then(() => {
                    const orig = copyLinkBtn.innerHTML;
                    copyLinkBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">check</span> 已複製';
                    copyLinkBtn.style.background = '#059669';
                    copyLinkBtn.style.color = '#fff';
                    copyLinkBtn.style.borderColor = '#059669';
                    setTimeout(() => { copyLinkBtn.innerHTML = orig; copyLinkBtn.style.background = ''; copyLinkBtn.style.color = ''; copyLinkBtn.style.borderColor = ''; }, 2000);
                });
            });
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

// ── Copy Project Info for CTA ──
window.copyProjectInfo = function() {
    const od = getOutlineData() || {};
    const courseName = projectData?.name || '課程名稱';
    const clientName = orgData?.name || '';
    const schedule = od.schedule || [];
    let scheduleText = '';
    if (schedule.length > 1) {
        const totalH = schedule.reduce((s, d) => s + (parseFloat(d.hours) || 0), 0);
        scheduleText = totalH ? `${schedule.length} 天 / 共 ${totalH} 小時` : `${schedule.length} 天`;
    } else if (schedule.length === 1 && schedule[0].hours) {
        scheduleText = `${schedule[0].hours} 小時`;
    }
    const lines = [
        `📋 課程專案資訊`,
        ``,
        `課程名稱：${courseName}`,
        clientName ? `客戶單位：${clientName}` : '',
        scheduleText ? `授課時數：${scheduleText}` : '',
        od.hero?.groupSize ? `預計人數：${od.hero.groupSize}` : '',
        od.hero?.location ? `授課方式：${od.hero.location}` : '',
        ``,
        `課程大綱連結：${location.origin}/course-outline.html?project=${projectData?.id || ''}`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lines).then(() => {
        const btn = document.getElementById('btnCopyProjectInfo');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">check</span>已複製';
            setTimeout(() => { btn.innerHTML = orig; }, 2000);
        }
    });
};

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
            const code = document.getElementById('loginUser').value.trim().toUpperCase();
            const submitBtn = e.target.querySelector('button');
            const origHTML = submitBtn?.innerHTML || '';
            if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '驗證中...'; }

            try {
                // 1) Match join_code from currently loaded project
                if (projectData?.join_code && code === projectData.join_code.toUpperCase()) {
                    currentUser = { name: '訪客', _isClient: true };
                    sessionStorage.setItem('outline_user', JSON.stringify(currentUser));
                    enterPage();
                    return;
                }

                // 2) Search all projects for matching join_code
                const { data: matchedProjects } = await db.select('projects', {
                    filter: { join_code: `eq.${code}` },
                    limit: 1
                });
                if (matchedProjects?.length) {
                    projectData = matchedProjects[0];
                    if (projectData.organization_id) {
                        const { data: orgs } = await db.select('organizations', { filter: { id: `eq.${projectData.organization_id}` } });
                        if (orgs?.length) orgData = orgs[0];
                    }
                    const { data: sess } = await db.select('project_sessions', { filter: { project_id: `eq.${projectData.id}` }, order: 'date.asc', limit: 1 });
                    if (sess?.length) sessionData = sess[0];

                    renderDynamicContent();
                    currentUser = { name: '訪客', _isClient: true };
                    sessionStorage.setItem('outline_user', JSON.stringify(currentUser));
                    enterPage();
                    return;
                }

                // 3) Search project_sessions for matching session_code
                const { data: matchedSessions } = await db.select('project_sessions', {
                    filter: { session_code: `eq.${code}` },
                    limit: 1
                });
                if (matchedSessions?.length) {
                    await loadSessionChain(matchedSessions[0].session_code);
                    renderDynamicContent();
                    currentUser = { name: '訪客', _isClient: true };
                    sessionStorage.setItem('outline_user', JSON.stringify(currentUser));
                    enterPage();
                    return;
                }

                errorEl.textContent = '專案代碼錯誤，請確認後重試';
                errorEl.style.display = 'block';
            } catch(err) {
                console.error('Login error:', err);
                errorEl.textContent = '驗證失敗：' + (err.message || '未知錯誤');
                errorEl.style.display = 'block';
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origHTML; }
            }
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
    // Init version management tabs
    initVersions();

    const od = getOutlineData();

    // Suppress column rebuild during initial population
    _suppressRebuild = true;

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

    // Now enable rebuild and trigger it if multi-day
    _suppressRebuild = false;
    const scheduleDays = getScheduleDays();
    if (scheduleDays.length > 1) {
        rebuildTimelineColumns();
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

    // Populate pricing items
    applyPricingItems(od?.pricing);

    // Populate Course Notes
    const notesData = od?.courseNotes?.length ? od.courseNotes : DEFAULT_COURSE_NOTES;
    notesData.forEach(n => addCourseNote(n));

    // Populate Email Template
    const emailTemplEl = document.getElementById('oeEmailTemplate');
    if (emailTemplEl) {
        if (od?.email_template) {
            emailTemplEl.textContent = od.email_template;
        } else {
            emailTemplEl.textContent = _generateEmailText();
        }
        document.getElementById('btnRegenEmail')?.addEventListener('click', (e) => {
            emailTemplEl.textContent = _generateEmailText();
            const btn = e.currentTarget;
            const orig = btn.innerHTML;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">check</span> 已重新生成';
            btn.style.background = '#059669';
            setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 2000);
        });
        document.getElementById('btnCopyEmailAdmin')?.addEventListener('click', () => {
            const text = emailTemplEl.innerText;
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('btnCopyEmailAdmin');
                const orig = btn.innerHTML;
                btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">check</span> 已複製';
                setTimeout(() => { btn.innerHTML = orig; }, 2000);
            });
        });
    }

    // Bind buttons
    document.getElementById('btnSaveOutline').addEventListener('click', saveOutlineData);
    document.getElementById('btnImportDefaults').addEventListener('click', importDefaults);
    document.getElementById('btnImportProject')?.addEventListener('click', importFromProject);

    // Init drag-and-drop after all items are populated
    setTimeout(() => initDragAndDrop(), 0);
    document.getElementById('btnAiGenOutline').addEventListener('click', () => {
        const modal = document.getElementById('aiOutlineModal');
        modal.classList.add('show');

        // Pre-fill from project/org data as defaults
        if (orgData?.name) _v('aiOlClient', orgData.name);
        if (orgData?.industry) _v('aiOlIndustry', orgData.industry);

        // Restore previous AI form values
        const saved = localStorage.getItem(`aiOlForm_${projectData?.id}`);
        if (saved) {
            try {
                const f = JSON.parse(saved);
                if (f.client) _v('aiOlClient', f.client);
                if (f.industry) _v('aiOlIndustry', f.industry);
                if (f.depts) _v('aiOlDepts', f.depts);
                if (f.days) _v('aiOlDays', f.days);
                if (f.hours) _v('aiOlHours', f.hours);
                if (f.level) _v('aiOlLevel', f.level);
                if (f.transcript) _v('aiOlTranscript', f.transcript);
            } catch(e) { console.warn('AI form restore error:', e); }
        }

        // Render tool checkboxes AFTER days is set
        updateAiToolInputs();

        // Restore tool checkboxes from saved data
        if (saved) {
            try {
                const f = JSON.parse(saved);
                const numDays = Math.ceil(parseFloat(f.days) || 1);
                if (numDays > 1 && f.dayTools?.length) {
                    f.dayTools.forEach(dt => {
                        const prefix = `aiOlDay${dt.day}`;
                        (dt.tools || []).forEach(t => {
                            const isKnown = AI_TOOL_OPTIONS.find(o => o.toLowerCase() === t.toLowerCase());
                            if (isKnown) {
                                const cb = document.querySelector(`.${prefix}-tool-cb[value="${isKnown}"]`);
                                if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
                            }
                        });
                        const otherTools = (dt.tools || []).filter(t => !AI_TOOL_OPTIONS.find(o => o.toLowerCase() === t.toLowerCase()));
                        if (otherTools.length) {
                            const otherEl = document.querySelector(`.${prefix}-tool-other`);
                            if (otherEl) otherEl.value = otherTools.join(', ');
                        }
                    });
                } else if (Array.isArray(f.tools) && f.tools.length) {
                    f.tools.forEach(t => {
                        const isKnown = AI_TOOL_OPTIONS.find(o => o.toLowerCase() === t.toLowerCase());
                        if (isKnown) {
                            const cb = document.querySelector(`.aiOlSingle-tool-cb[value="${isKnown}"]`);
                            if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
                        }
                    });
                    const otherTools = f.tools.filter(t => !AI_TOOL_OPTIONS.find(o => o.toLowerCase() === t.toLowerCase()));
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
let _rebuildColumnsTimer = null;
let _suppressRebuild = false;
function _scheduleRebuildColumns() {
    if (_suppressRebuild) return;
    _forceFlat = false; // reset user toggle when schedule changes
    clearTimeout(_rebuildColumnsTimer);
    _rebuildColumnsTimer = setTimeout(() => {
        if (typeof rebuildTimelineColumns === 'function') rebuildTimelineColumns();
    }, 100);
}

window.addScheduleDay = function(data = {}) {
    const list = document.getElementById('oeScheduleList');
    if (!list) return;
    const idx = _schCounter++;
    const dayNum = data.day || (list.children.length + 1);
    const div = document.createElement('div');
    div.className = 'oe-schedule-day';
    div.style.cssText = 'display:flex;gap:10px;align-items:center;padding:10px 14px;background:linear-gradient(135deg,#f8fafc,#e8f0fe);border:1px solid #d2e3fc;border-radius:10px;transition:box-shadow 0.2s;flex-wrap:wrap';
    div.onmouseenter = () => div.style.boxShadow = '0 2px 8px rgba(99,102,241,0.08)';
    div.onmouseleave = () => div.style.boxShadow = 'none';
    div.innerHTML = `
        <span class="oe-day-badge" style="display:inline-flex;align-items:center;justify-content:center;min-width:52px;padding:4px 10px;border-radius:6px;background:var(--accent);color:#fff;font-size:0.75rem;font-weight:700;letter-spacing:0.04em;white-space:nowrap">Day ${dayNum}</span>
        <input type="hidden" data-key="day" value="${dayNum}">
        <input type="date" data-key="date" value="${_esc(data.date || '')}" style="font-size:0.82rem;border:1px solid var(--border);border-radius:6px;padding:4px 8px;background:#fff;color:var(--text);font-family:inherit">
        <div style="display:flex;align-items:center;gap:4px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:2px 8px">
            <input type="time" data-key="startTime" value="${_esc(data.startTime || '09:00')}" style="width:80px;font-size:0.85rem;border:none;outline:none;background:transparent;font-weight:600" onchange="_updateTimelineTimeRanges()">
            <span style="font-size:0.72rem;color:var(--text-3);white-space:nowrap">開始</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:2px 8px">
            <input type="text" data-key="hours" value="${_esc(data.hours || '')}" placeholder="7" style="width:36px;font-size:0.85rem;border:none;outline:none;text-align:center;background:transparent;font-weight:600">
            <span style="font-size:0.72rem;color:var(--text-3);white-space:nowrap">小時</span>
        </div>
        <input type="text" data-key="topic" value="${_esc(data.topic || '')}" placeholder="當日課程主題" style="flex:1;min-width:120px;font-size:0.85rem;border:1px solid var(--border);border-radius:6px;padding:6px 10px;background:#fff">
        <input type="text" data-key="instructor" value="${_esc(data.instructor || '')}" placeholder="講師" style="width:80px;font-size:0.85rem;border:1px solid var(--border);border-radius:6px;padding:6px 10px;background:#fff">
        <button class="oe-delete" onclick="this.closest('.oe-schedule-day').remove();renumberScheduleDays();_scheduleRebuildColumns()" style="position:static;width:26px;height:26px;border-radius:6px;opacity:0.4;transition:opacity 0.2s" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.4'"><span class="material-symbols-outlined" style="font-size:14px">close</span></button>
    `;
    list.appendChild(div);
    // Trigger column rebuild after adding a day (debounced)
    _scheduleRebuildColumns();
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
        date: el.querySelector('[data-key="date"]')?.value || '',
        hours: el.querySelector('[data-key="hours"]').value.trim(),
        startTime: el.querySelector('[data-key="startTime"]')?.value || '09:00',
        topic: el.querySelector('[data-key="topic"]').value.trim(),
        instructor: el.querySelector('[data-key="instructor"]')?.value?.trim() || ''
    }));
}

// ── Course Notes Builder ──
const DEFAULT_COURSE_NOTES = [
    { icon: 'menu_book', title: '數位課程，不提供實體講義', desc: '本課程屬於數位課程，所有教學資源均以線上方式提供，不另外印製實體講義。' },
    { icon: 'touch_app', title: '互動式簡報系統', desc: '本次課程簡報並非傳統投影片，而是採用特別開發的互動式簡報。上課當天，學員可透過「課前準備頁」進入簡報連結，即時參與課堂互動。' },
    { icon: 'videocam', title: '課程錄影說明', desc: '本課程講師會進行螢幕錄影，錄影原檔交付不剪輯。若需實體拍攝，請由客戶自行安排拍攝及收音事宜。若螢幕錄影因設備意外導致不連續，將提供課程逐字稿摘要供學員後續參考。' }
];

window.addCourseNote = function(data = {}) {
    const list = document.getElementById('oeCourseNotesList');
    if (!list) return;
    const div = document.createElement('div');
    div.className = 'oe-course-note';
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-start;padding:10px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:10px';
    div.innerHTML = `
        <input type="text" data-key="icon" value="${_esc(data.icon || 'info')}" placeholder="icon 名稱" style="width:70px;font-size:0.82rem;border:1px solid var(--border);border-radius:6px;padding:4px 8px;background:#fff">
        <input type="text" data-key="title" value="${_esc(data.title || '')}" placeholder="標題" style="width:160px;font-size:0.85rem;border:1px solid var(--border);border-radius:6px;padding:6px 10px;background:#fff;font-weight:600">
        <textarea data-key="desc" placeholder="說明內容" rows="2" style="flex:1;min-width:150px;font-size:0.82rem;border:1px solid var(--border);border-radius:6px;padding:6px 10px;background:#fff;resize:vertical;font-family:inherit">${_esc(data.desc || '')}</textarea>
        <button class="oe-delete" onclick="this.closest('.oe-course-note').remove()" style="position:static;width:26px;height:26px;border-radius:6px;opacity:0.4;transition:opacity 0.2s;flex-shrink:0;margin-top:4px" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.4'"><span class="material-symbols-outlined" style="font-size:14px">close</span></button>
    `;
    list.appendChild(div);
};

function getCourseNotes() {
    return [...document.querySelectorAll('#oeCourseNotesList .oe-course-note')].map(el => ({
        icon: el.querySelector('[data-key="icon"]').value.trim(),
        title: el.querySelector('[data-key="title"]').value.trim(),
        desc: el.querySelector('[data-key="desc"]').value.trim()
    })).filter(n => n.title || n.desc);
}

function getScheduleOptions() {
    const days = getScheduleDays();
    return days.map(d => `<option value="${d.day}">Day ${d.day}</option>`).join('');
}

// ── Timeline Block ──
let _tlCounter = 0;
let _isColumnMode = false; // tracks whether multi-day column layout is active

window.addTimelineBlock = function(data = {}, afterEl = null, targetDay = null) {
    const idx = _tlCounter++;
    const dayOptions = getScheduleOptions();
    // Parse duration from existing data.time
    let durationMin = data.duration || 0;
    if (!durationMin && data.time) {
        const m = data.time.match(/(\d+)\s*分鐘/);
        if (m) durationMin = parseInt(m[1]);
    }
    const durationOpts = [10,15,20,30,40,50,60,90,120].map(v =>
        `<option value="${v}"${v === durationMin ? ' selected' : ''}>${v} 分鐘</option>`
    ).join('');
    const div = document.createElement('div');
    div.className = 'oe-list-item';
    div.dataset.idx = idx;
    div.innerHTML = `
        <button class="oe-delete" onclick="this.closest('.oe-list-item').remove();_updateTimelineTimeRanges()"><span class="material-symbols-outlined">close</span></button>
        <div class="oe-row" style="grid-template-columns:80px 120px 1fr 120px">
            <div class="oe-field oe-field-day-select"><label>天數</label><select data-key="day" onchange="_updateTimelineTimeRanges()">${dayOptions}</select></div>
            <div class="oe-field"><label>時長</label>
                <select data-key="duration" onchange="_updateTimelineTimeRanges()">
                    <option value="">選擇</option>
                    ${durationOpts}
                    <option value="custom"${durationMin && ![10,15,20,30,40,50,60,90,120].includes(durationMin) ? ' selected' : ''}>自訂...</option>
                </select>
                <input type="number" data-key="customDuration" value="${durationMin && ![10,15,20,30,40,50,60,90,120].includes(durationMin) ? durationMin : ''}" placeholder="分鐘" min="5" max="300" style="display:${durationMin && ![10,15,20,30,40,50,60,90,120].includes(durationMin) ? 'block' : 'none'};margin-top:4px" onchange="_updateTimelineTimeRanges()">
            </div>
            <div class="oe-field"><label>標題</label><input type="text" data-key="title" value="${_esc(data.title || '')}" placeholder="模組名稱"></div>
            <div class="oe-field"><label>部門</label><input type="text" data-key="dept" value="${_esc(data.dept || '全部門')}" placeholder="全部門"></div>
        </div>
        <div class="oe-time-range-badge" style="display:none"></div>
        <div class="oe-field" style="margin-top:8px"><label>描述</label><textarea data-key="desc" rows="2" placeholder="模組說明...">${_esc(data.desc || '')}</textarea></div>
        <div class="oe-field" style="margin-top:8px"><label>標籤（逗號分隔）</label><input type="text" data-key="tags" value="${_esc((data.tags||[]).join(', '))}" placeholder="AI 辦公趨勢, 案例分享"></div>
    `;
    const actualDay = targetDay || data.day || 1;
    const sel = div.querySelector('[data-key="day"]');
    sel.value = actualDay;

    // Show/hide custom duration input
    const durSel = div.querySelector('[data-key="duration"]');
    const customInput = div.querySelector('[data-key="customDuration"]');
    durSel.addEventListener('change', () => {
        customInput.style.display = durSel.value === 'custom' ? 'block' : 'none';
        if (durSel.value !== 'custom') customInput.value = '';
    });

    // Determine where to insert
    if (_isColumnMode) {
        // Column mode: insert into the correct day column
        const colBody = document.querySelector(`.oe-day-column[data-day="${actualDay}"] .oe-day-column-body`);
        if (colBody) {
            if (afterEl && afterEl.parentNode === colBody) {
                colBody.insertBefore(div, afterEl.nextSibling);
            } else {
                colBody.appendChild(div);
            }
        } else {
            // Fallback: append to flat list
            const list = document.getElementById('oeTimelineList');
            list.appendChild(div);
        }
    } else {
        // Flat list mode
        const list = document.getElementById('oeTimelineList');
        if (afterEl && afterEl.parentNode === list) {
            list.insertBefore(div, afterEl.nextSibling);
        } else {
            list.appendChild(div);
        }
    }
    _makeDraggable(div);
    setTimeout(() => _updateTimelineTimeRanges(), 0);
};

// ══════════════════════════════════════
// MULTI-DAY COLUMN LAYOUT
// ══════════════════════════════════════

window.rebuildTimelineColumns = function() {
    const scheduleDays = getScheduleDays();
    const isMultiDay = scheduleDays.length > 1;
    const container = document.getElementById('oeTimelineList').parentNode;
    const flatList = document.getElementById('oeTimelineList');
    const addBtn = flatList.nextElementSibling?.classList?.contains('oe-add-btn')
        ? flatList.nextElementSibling : null;

    // Collect all existing blocks with their data BEFORE modifying DOM
    const allBlocks = _collectBlocksFromDOM();

    // Remove old column container if exists
    const oldCols = container.querySelector('.oe-timeline-columns');
    if (oldCols) oldCols.remove();
    const oldSummary = container.querySelector('.oe-columns-summary');
    if (oldSummary) oldSummary.remove();

    // Clear flat list
    flatList.innerHTML = '';
    _tlCounter = 0;

    if (isMultiDay && !_forceFlat) {
        // ── Column mode ──
        _isColumnMode = true;
        flatList.style.display = 'none';
        if (addBtn) addBtn.style.display = 'none';

        const grid = document.createElement('div');
        grid.className = `oe-timeline-columns oe-timeline-columns-${Math.min(scheduleDays.length, 4)}`;

        scheduleDays.forEach(dayInfo => {
            const col = document.createElement('div');
            col.className = 'oe-day-column';
            col.dataset.day = dayInfo.day;

            const topicText = dayInfo.topic ? ` — ${dayInfo.topic}` : '';
            const hoursText = dayInfo.hours ? ` (${dayInfo.hours}h)` : '';
            col.innerHTML = `
                <div class="oe-day-column-header">
                    <span class="oe-day-badge">Day ${dayInfo.day}</span>
                    <span class="oe-day-topic">${topicText}${hoursText}</span>
                </div>
                <div class="oe-day-column-body oe-list" id="oeTimelineDay${dayInfo.day}"></div>
                <div class="oe-day-column-footer">
                    <button class="oe-col-add-btn" onclick="addTimelineBlock({}, null, ${dayInfo.day})">
                        <span class="material-symbols-outlined">add</span> 新增時段
                    </button>
                </div>
            `;
            grid.appendChild(col);
        });

        // Insert grid before flatList
        flatList.parentNode.insertBefore(grid, flatList);

        // Re-add blocks to their columns
        allBlocks.forEach(blockData => {
            // Ensure block day exists, fallback to Day 1
            const dayExists = scheduleDays.find(s => s.day === blockData.day);
            if (!dayExists) blockData.day = scheduleDays[0].day;
            addTimelineBlock(blockData, null, blockData.day);
        });

        // Init drag-and-drop for each column body
        scheduleDays.forEach(dayInfo => {
            const colBody = document.getElementById(`oeTimelineDay${dayInfo.day}`);
            if (colBody) _setupDropZone(colBody);
        });
    } else {
        // ── Flat list mode ──
        _isColumnMode = false;
        flatList.style.display = '';
        if (addBtn) addBtn.style.display = '';

        // Re-add blocks to flat list
        allBlocks.forEach(blockData => {
            if (scheduleDays.length === 1) blockData.day = 1;
            addTimelineBlock(blockData);
        });

        initDragAndDrop();
    }

    _updateToggleButton();
    setTimeout(() => _updateTimelineTimeRanges(), 0);
};

/** Show/hide and style the toggle button based on current state */
function _updateToggleButton() {
    const btn = document.getElementById('btnToggleColumnMode');
    if (!btn) return;
    const scheduleDays = getScheduleDays();
    if (scheduleDays.length > 1) {
        btn.style.display = 'inline-flex';
        if (_isColumnMode) {
            btn.classList.add('active');
            btn.querySelector('.oe-column-toggle-label').textContent = '並排';
            btn.querySelector('.material-symbols-outlined').textContent = 'view_column_2';
            btn.title = '切換為單欄模式';
        } else {
            btn.classList.remove('active');
            btn.querySelector('.oe-column-toggle-label').textContent = '單欄';
            btn.querySelector('.material-symbols-outlined').textContent = 'view_list';
            btn.title = '切換為並排模式';
        }
    } else {
        btn.style.display = 'none';
    }
}

/** Toggle between column and flat mode (user-triggered) */
let _forceFlat = false;
window.toggleColumnMode = function() {
    const scheduleDays = getScheduleDays();
    if (scheduleDays.length < 2) return;

    if (_isColumnMode) {
        // Switch to flat mode
        _forceFlat = true;
        rebuildTimelineColumns(); // will see _forceFlat and stay flat
    } else {
        // Switch to column mode
        _forceFlat = false;
        rebuildTimelineColumns();
    }
};

/** Collect timeline block data from current DOM (regardless of flat/column mode) */
function _collectBlocksFromDOM() {
    const items = document.querySelectorAll('.oe-list-item[data-idx]');
    const blocks = [];
    items.forEach(el => {
        // Skip items not in timeline (toolbar, equip, etc)
        const parentList = el.closest('.oe-list');
        if (!parentList) return;
        const isTimeline = parentList.id === 'oeTimelineList'
            || parentList.classList.contains('oe-day-column-body');
        if (!isTimeline) return;

        const durSel = el.querySelector('[data-key="duration"]');
        const customDur = el.querySelector('[data-key="customDuration"]');
        let mins = 0;
        if (durSel) {
            mins = durSel.value === 'custom' ? (parseInt(customDur?.value) || 0) : (parseInt(durSel.value) || 0);
        }

        // In column mode, day comes from the column; in flat mode, from the select
        let day = parseInt(el.querySelector('[data-key="day"]')?.value || '1');
        const col = el.closest('.oe-day-column');
        if (col) day = parseInt(col.dataset.day);

        blocks.push({
            day,
            duration: mins,
            title: el.querySelector('[data-key="title"]')?.value?.trim() || '',
            desc: el.querySelector('[data-key="desc"]')?.value?.trim() || '',
            dept: el.querySelector('[data-key="dept"]')?.value?.trim() || '全部門',
            tags: (el.querySelector('[data-key="tags"]')?.value || '').split(',').map(s => s.trim()).filter(Boolean)
        });
    });
    return blocks;
}

// ── Tool Block ──
let _toolCounter = 0;
window.addToolBlock = function(data = {}, afterEl = null) {
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
    if (afterEl && afterEl.parentNode === list) {
        list.insertBefore(div, afterEl.nextSibling);
    } else {
        list.appendChild(div);
    }
    _makeDraggable(div);
};

// ── Equipment Block ──
let _eqCounter = 0;
window.addEquipBlock = function(data = {}, afterEl = null) {
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
    if (afterEl && afterEl.parentNode === list) {
        list.insertBefore(div, afterEl.nextSibling);
    } else {
        list.appendChild(div);
    }
    _makeDraggable(div);
};

function _esc(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ══════════════════════════════════════
// DRAG AND DROP — Reorder List Items
// ══════════════════════════════════════

let _dragItem = null;

function _makeDraggable(el) {
    // Inject drag handle if not present
    if (!el.querySelector('.oe-drag-handle')) {
        const handle = document.createElement('div');
        handle.className = 'oe-drag-handle';
        handle.innerHTML = '<span class="material-symbols-outlined">drag_indicator</span>';
        handle.setAttribute('draggable', 'true');
        el.insertBefore(handle, el.firstChild);

        // Insert-below button
        const insertBtn = document.createElement('button');
        insertBtn.className = 'oe-insert-btn';
        insertBtn.title = '在此下方插入新項目';
        insertBtn.innerHTML = '<span class="material-symbols-outlined">add</span>';
        insertBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const list = el.closest('.oe-list');
            const listId = list?.id;
            if (listId === 'oeTimelineList' || list?.classList?.contains('oe-day-column-body')) {
                const col = el.closest('.oe-day-column');
                const day = col ? parseInt(col.dataset.day) : null;
                addTimelineBlock({}, el, day);
            }
            else if (listId === 'oeToolsList') addToolBlock({}, el);
            else if (listId === 'oeEquipList') addEquipBlock({}, el);
        });
        el.appendChild(insertBtn);

        // Drag events on the handle
        handle.addEventListener('dragstart', (e) => {
            _dragItem = el;
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
            const rect = el.getBoundingClientRect();
            e.dataTransfer.setDragImage(el, rect.width / 2, 20);
        });

        handle.addEventListener('dragend', () => {
            if (_dragItem) _dragItem.classList.remove('dragging');
            _dragItem = null;
            // Clean up all drag-over states
            document.querySelectorAll('.oe-list-item.drag-over').forEach(i => i.classList.remove('drag-over'));
        });
    }
}

function initDragAndDrop() {
    const lists = ['oeTimelineList', 'oeToolsList', 'oeEquipList'];
    lists.forEach(id => {
        const list = document.getElementById(id);
        if (!list) return;
        _setupDropZone(list);
    });
    // Also set up drop zones for column bodies
    document.querySelectorAll('.oe-day-column-body').forEach(colBody => {
        _setupDropZone(colBody);
    });
}

function _setupDropZone(list) {
    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const target = _getDropTarget(e, list);
        // Clear previous indicators
        list.querySelectorAll('.oe-list-item.drag-over').forEach(i => i.classList.remove('drag-over'));
        if (target && target !== _dragItem) {
            target.classList.add('drag-over');
        }
    });

    list.addEventListener('dragleave', (e) => {
        // Only clear if leaving the list entirely
        if (!list.contains(e.relatedTarget)) {
            list.querySelectorAll('.oe-list-item.drag-over').forEach(i => i.classList.remove('drag-over'));
        }
    });

    list.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!_dragItem) return;

        const target = _getDropTarget(e, list);
        if (target && target !== _dragItem) {
            // Determine if we insert before or after based on mouse position
            const rect = target.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                list.insertBefore(_dragItem, target);
            } else {
                list.insertBefore(_dragItem, target.nextSibling);
            }
        }

        // Clean up
        list.querySelectorAll('.oe-list-item.drag-over').forEach(i => i.classList.remove('drag-over'));
        if (_dragItem) _dragItem.classList.remove('dragging');
        _dragItem = null;
        // Recalculate time ranges after reorder
        if (list.id === 'oeTimelineList') _updateTimelineTimeRanges();
    });
}

function _getDropTarget(e, list) {
    const items = [...list.querySelectorAll('.oe-list-item:not(.dragging)')];
    // Find closest item to cursor
    let closest = null;
    let closestDist = Infinity;
    for (const item of items) {
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dist = Math.abs(e.clientY - midY);
        if (dist < closestDist) {
            closestDist = dist;
            closest = item;
        }
    }
    return closest;
}

// ══════════════════════════════════════
// LIVE TIME RANGE CALCULATOR
// ══════════════════════════════════════

window._updateTimelineTimeRanges = function() {
    const schedule = getScheduleDays();
    const scheduleMap = {};
    schedule.forEach(s => { scheduleMap[s.day] = s; });

    const dayAccum = {};
    // Find all timeline items regardless of flat list or column mode
    const allItems = _isColumnMode
        ? document.querySelectorAll('.oe-day-column-body .oe-list-item')
        : document.querySelectorAll('#oeTimelineList .oe-list-item');
    let totalMinAll = 0;

    allItems.forEach(el => {
        // In column mode, day comes from the column; otherwise from the select
        let day;
        const col = el.closest('.oe-day-column');
        if (col) {
            day = parseInt(col.dataset.day);
            // Also sync the hidden day select
            const daySel = el.querySelector('[data-key="day"]');
            if (daySel) daySel.value = day;
        } else {
            day = parseInt(el.querySelector('[data-key="day"]')?.value || '1');
        }

        const durSel = el.querySelector('[data-key="duration"]');
        const customDur = el.querySelector('[data-key="customDuration"]');
        let mins = 0;
        if (durSel) {
            mins = durSel.value === 'custom' ? (parseInt(customDur?.value) || 0) : (parseInt(durSel.value) || 0);
        }

        const badge = el.querySelector('.oe-time-range-badge');
        if (!badge) return;

        if (!mins) {
            badge.style.display = 'none';
            return;
        }

        const startTime = scheduleMap[day]?.startTime || '09:00';
        const [sh, sm] = startTime.split(':').map(Number);
        const baseMin = (sh * 60 + sm) + (dayAccum[day] || 0);
        dayAccum[day] = (dayAccum[day] || 0) + mins;
        totalMinAll += mins;

        const startH = Math.floor(baseMin / 60), startM = baseMin % 60;
        const endMin = baseMin + mins;
        const endH = Math.floor(endMin / 60), endM = endMin % 60;
        const pad = n => String(n).padStart(2, '0');

        badge.style.display = 'flex';
        badge.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px">schedule</span>${pad(startH)}:${pad(startM)} – ${pad(endH)}:${pad(endM)}`;
    });

    // Update per-column summaries
    if (_isColumnMode) {
        document.querySelectorAll('.oe-day-column').forEach(col => {
            const d = col.dataset.day;
            const mins = dayAccum[d] || 0;
            let sumEl = col.querySelector('.oe-day-column-summary');
            if (!sumEl) {
                sumEl = document.createElement('div');
                sumEl.className = 'oe-day-column-summary';
                const footer = col.querySelector('.oe-day-column-footer');
                col.insertBefore(sumEl, footer);
            }
            if (mins > 0) {
                sumEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px">schedule</span> ${Math.floor(mins/60)}h${mins%60 ? mins%60 + 'm' : ''}`;
                sumEl.style.display = 'flex';
            } else {
                sumEl.style.display = 'none';
            }
        });
    }

    // Update total summary
    let summaryEl = document.getElementById('oeTimelineSummary');
    if (!summaryEl) {
        const anchor = _isColumnMode
            ? document.querySelector('.oe-timeline-columns')
            : document.getElementById('oeTimelineList');
        if (anchor) {
            summaryEl = document.createElement('div');
            summaryEl.id = 'oeTimelineSummary';
            summaryEl.style.cssText = 'padding:8px 20px;font-size:0.78rem;color:var(--text-2);display:flex;gap:16px;align-items:center;flex-wrap:wrap';
            anchor.parentNode.insertBefore(summaryEl, anchor.nextSibling);
        }
    }
    if (summaryEl && totalMinAll > 0) {
        const hrs = Math.floor(totalMinAll / 60);
        const remainMin = totalMinAll % 60;
        const perDay = {};
        Object.entries(dayAccum).forEach(([d, m]) => { perDay[d] = m; });
        const dayBreakdown = Object.entries(perDay).map(([d, m]) =>
            `Day ${d}: ${Math.floor(m/60)}h${m%60 ? m%60 + 'm' : ''}`
        ).join('　');
        summaryEl.innerHTML = `<span style="font-weight:700;color:var(--accent)">⏱ 總計 ${hrs}h${remainMin ? remainMin + 'm' : ''}</span><span style="color:var(--text-3)">${dayBreakdown}</span>`;
    } else if (summaryEl) {
        summaryEl.innerHTML = '';
    }
};

// ═══════════════════════════════════════
// PRICING ITEMS (per outline version)
// ═══════════════════════════════════════
let _pricingCounter = 0;

window.addPricingItem = function(data) {
    const list = document.getElementById('oePricingList');
    if (!list) return;
    const idx = _pricingCounter++;
    const item = data || { label: '', type: 'hourly', hours: 0, rate: 0 };
    const div = document.createElement('div');
    div.className = 'oe-pricing-row';
    div.dataset.idx = idx;
    div.style.cssText = 'display:grid;grid-template-columns:1fr 90px 70px 85px 28px;gap:4px 6px;align-items:center';
    const typeOpts = `<option value="hourly" ${item.type==='hourly'?'selected':''}>小時計</option>
        <option value="fixed" ${item.type==='fixed'?'selected':''}>固定</option>
        <option value="perhead" ${item.type==='perhead'?'selected':''}>人數計</option>`;
    const qty = item.type === 'hourly' ? (item.hours||0) : item.type === 'perhead' ? (item.count||0) : (item.amount||0);
    const rate = item.type === 'fixed' ? '' : (item.rate||0);
    const qtyLabel = item.type === 'hourly' ? '時數' : item.type === 'perhead' ? '人數' : '金額';
    div.innerHTML = `
        <input type="text" data-f="label" value="${_esc(item.label||'')}" placeholder="講師鐘點費" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:0.82rem;font-family:inherit">
        <select data-f="type" onchange="onPricingTypeChange(this)" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:0.82rem;font-family:inherit">${typeOpts}</select>
        <input type="number" data-f="qty" value="${qty}" placeholder="${qtyLabel}" onchange="recalcPricingTotal()" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:0.82rem;text-align:center;font-family:inherit">
        <input type="number" data-f="rate" value="${rate}" placeholder="${item.type==='fixed'?'—':'單價'}" ${item.type==='fixed'?'disabled':''} onchange="recalcPricingTotal()" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:0.82rem;text-align:right;font-family:inherit">
        <button onclick="this.closest('.oe-pricing-row').remove();recalcPricingTotal()" style="width:26px;height:26px;border-radius:6px;border:none;background:#fee2e2;color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="font-size:14px">close</span></button>
    `;
    list.appendChild(div);
    recalcPricingTotal();
};

window.onPricingTypeChange = function(selectEl) {
    const row = selectEl.closest('.oe-pricing-row');
    const type = selectEl.value;
    const rateEl = row.querySelector('[data-f="rate"]');
    const qtyEl = row.querySelector('[data-f="qty"]');
    if (type === 'fixed') {
        rateEl.disabled = true;
        rateEl.value = '';
        rateEl.placeholder = '—';
        qtyEl.placeholder = '金額';
    } else {
        rateEl.disabled = false;
        rateEl.placeholder = '單價';
        qtyEl.placeholder = type === 'hourly' ? '時數' : '人數';
    }
    recalcPricingTotal();
};

window.recalcPricingTotal = function() {
    const items = collectPricingItems();
    let total = 0;
    items.forEach(item => {
        if (item.type === 'hourly') total += (item.hours||0) * (item.rate||0);
        else if (item.type === 'perhead') total += (item.count||0) * (item.rate||0);
        else total += (item.amount||0);
    });
    const str = '$' + total.toLocaleString();
    const el = document.getElementById('oePricingTotal');
    const el2 = document.getElementById('oePricingTotalLarge');
    if (el) el.textContent = str;
    if (el2) el2.textContent = str;
    updateDiscountDisplay();
};

window.updateDiscountDisplay = function() {
    const el = document.getElementById('oeDiscountTotal');
    const label = document.getElementById('oeDiscountLabel');
    if (!el || !label) return;
    const discount = parseFloat(el.value) || 0;
    if (discount > 0) {
        const items = collectPricingItems();
        let total = 0;
        items.forEach(item => {
            if (item.type === 'hourly') total += (item.hours||0) * (item.rate||0);
            else if (item.type === 'perhead') total += (item.count||0) * (item.rate||0);
            else total += (item.amount||0);
        });
        const saved = total - discount;
        label.textContent = saved > 0 ? `省 $${saved.toLocaleString()}` : '';
    } else {
        label.textContent = '';
    }
};

function collectPricingItems() {
    const rows = document.querySelectorAll('#oePricingList .oe-pricing-row');
    const items = [];
    rows.forEach(row => {
        const label = row.querySelector('[data-f="label"]').value.trim();
        const type = row.querySelector('[data-f="type"]').value;
        const qty = parseFloat(row.querySelector('[data-f="qty"]').value) || 0;
        const rate = parseFloat(row.querySelector('[data-f="rate"]').value) || 0;
        let item = { label, type };
        if (type === 'hourly') { item.hours = qty; item.rate = rate; }
        else if (type === 'perhead') { item.count = qty; item.rate = rate; }
        else { item.amount = qty; }
        items.push(item);
    });
    return items;
}

function applyPricingItems(pricing) {
    const list = document.getElementById('oePricingList');
    if (!list) return;
    list.innerHTML = '';
    _pricingCounter = 0;
    if (pricing && pricing.length > 0) {
        pricing.forEach(item => addPricingItem(item));
    } else {
        // Smart defaults based on current outline data
        addPricingItem({ label: '講師鐘點費', type: 'hourly', hours: 0, rate: 8000 });
        addPricingItem({ label: '車馬費', type: 'fixed', amount: 0 });
        const taCount = parseInt(document.getElementById('oeTaCount')?.value) || 0;
        addPricingItem({ label: '助教費', type: 'perhead', count: taCount, rate: 3000 });
        addPricingItem({ label: '教材費', type: 'fixed', amount: 0 });
        addPricingItem({ label: '專業攝影費（出機錄製）', type: 'fixed', amount: 0 });
    }
}

// ═══════════════════════════════════════
// OUTLINE VERSION MANAGEMENT
// ═══════════════════════════════════════

function initVersions() {
    const versions = projectData?.outline_versions;
    if (versions && versions.length > 0) {
        outlineVersions = JSON.parse(JSON.stringify(versions));
    } else {
        // Bootstrap: current outline_data becomes "版本一"
        const od = getOutlineData();
        outlineVersions = [{
            name: '版本一',
            data: od ? JSON.parse(JSON.stringify(od)) : null,
            created_at: new Date().toISOString()
        }];
    }
    // Restore last active version index
    const savedIdx = projectData?.active_version_idx;
    if (typeof savedIdx === 'number' && savedIdx >= 0 && savedIdx < outlineVersions.length) {
        activeVersionIdx = savedIdx;
    } else {
        activeVersionIdx = 0;
    }
    renderVersionTabs();
}

function renderVersionTabs() {
    let container = document.getElementById('outlineVersionTabs');
    if (!container) {
        // Insert after topbar, before first outline-edit-group
        const adminSection = document.querySelector('#adminPanel .admin-section');
        if (!adminSection) return;
        container = document.createElement('div');
        container.id = 'outlineVersionTabs';
        container.className = 'oe-version-bar';
        adminSection.insertBefore(container, adminSection.firstChild);
    }
    container.innerHTML = `
        <div class="oe-version-tabs-inner">
            ${outlineVersions.map((v, i) => {
                const isActive = i === activeVersionIdx;
                return `<button class="oe-vtab${isActive ? ' active' : ''}" onclick="switchVersion(${i})" ondblclick="renameVersion(${i})">${v.name || '版本 ' + (i+1)}</button>`;
            }).join('')}
        </div>
        <div class="oe-version-actions">
            <button class="oe-vtab-action" onclick="addVersion()" title="新增版本">
                <span class="material-symbols-outlined">add</span>
            </button>
            ${outlineVersions.length > 1 ? `
            <button class="oe-vtab-action" onclick="renameVersion(${activeVersionIdx})" title="重新命名">
                <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="oe-vtab-action oe-vtab-action-danger" onclick="deleteVersion(${activeVersionIdx})" title="刪除版本">
                <span class="material-symbols-outlined">delete</span>
            </button>` : `
            <button class="oe-vtab-action" onclick="renameVersion(${activeVersionIdx})" title="重新命名">
                <span class="material-symbols-outlined">edit</span>
            </button>`}
        </div>
    `;
}

window.switchVersion = function(idx) {
    if (idx === activeVersionIdx) return;
    // Save current form data to active version
    outlineVersions[activeVersionIdx].data = collectOutlineData();
    // Switch
    activeVersionIdx = idx;
    renderVersionTabs();
    // Apply new version's data to editor
    const vData = outlineVersions[idx]?.data;
    if (vData) {
        _applyOutlineData(vData);
    } else {
        _clearEditorFields();
    }
};

window.addVersion = function() {
    // Save current version first
    outlineVersions[activeVersionIdx].data = collectOutlineData();
    // Create new version (copy from current)
    const newVersion = {
        name: '版本' + _zhNum(outlineVersions.length + 1),
        data: JSON.parse(JSON.stringify(outlineVersions[activeVersionIdx].data)),
        created_at: new Date().toISOString()
    };
    outlineVersions.push(newVersion);
    activeVersionIdx = outlineVersions.length - 1;
    renderVersionTabs();
    // Apply (already same data, but re-render to be safe)
    _applyOutlineData(newVersion.data);
};

window.deleteVersion = function(idx) {
    if (outlineVersions.length <= 1) return;
    const name = outlineVersions[idx].name || '版本 ' + (idx + 1);
    if (!confirm(`確定要刪除「${name}」嗎？此操作無法復原。`)) return;
    outlineVersions.splice(idx, 1);
    // Adjust activeVersionIdx
    if (activeVersionIdx >= outlineVersions.length) {
        activeVersionIdx = outlineVersions.length - 1;
    } else if (activeVersionIdx > idx) {
        activeVersionIdx--;
    } else if (activeVersionIdx === idx) {
        activeVersionIdx = Math.min(idx, outlineVersions.length - 1);
    }
    renderVersionTabs();
    const vData = outlineVersions[activeVersionIdx]?.data;
    if (vData) {
        _applyOutlineData(vData);
    } else {
        _clearEditorFields();
    }
    const status = document.getElementById('outlineSaveStatus');
    if (status) {
        status.textContent = `✓ 已刪除「${name}」，請記得按「儲存」`;
        status.style.display = 'block';
        status.style.color = '#ef4444';
        setTimeout(() => { status.style.display = 'none'; }, 4000);
    }
};

window.renameVersion = function(idx) {
    // Find the tab button for this version
    const tabContainer = document.getElementById('outlineVersionTabs');
    if (!tabContainer) return;
    const tabBtn = tabContainer.querySelectorAll('.oe-version-tab')[idx];
    if (!tabBtn) return;

    const current = outlineVersions[idx].name || '版本 ' + (idx+1);
    const parentDiv = tabBtn.closest('div[style*="inline-flex"]');
    if (!parentDiv) return;

    // Replace the tab group with an inline input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.style.cssText = 'padding:7px 12px;border:2px solid var(--accent,#6366f1);border-radius:8px;font-size:0.82rem;font-weight:600;font-family:inherit;outline:none;width:120px;background:#fff;color:var(--text,#1e293b)';
    input.setAttribute('autofocus', 'true');

    // Hide the original buttons, show input
    const origHTML = parentDiv.innerHTML;
    parentDiv.innerHTML = '';
    parentDiv.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
        const val = input.value.trim();
        if (val) outlineVersions[idx].name = val;
        renderVersionTabs();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { renderVersionTabs(); }
    });
};

function _zhNum(n) {
    const zh = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return n <= 10 ? zh[n] : String(n);
}

function _clearEditorFields() {
    // Reset all editor fields to empty
    _v('oeHeroSubtitle', '');
    document.getElementById('oeScheduleList').innerHTML = '';
    const oldCols = document.querySelector('.oe-timeline-columns');
    if (oldCols) oldCols.remove();
    document.getElementById('oeTimelineList').innerHTML = '';
    document.getElementById('oeTimelineList').style.display = '';
    document.getElementById('oeToolsList').innerHTML = '';
    document.getElementById('oeEquipList').innerHTML = '';
    _tlCounter = 0; _toolCounter = 0; _eqCounter = 0; _schCounter = 0;
    _isColumnMode = false;
    addScheduleDay({ day: 1, hours: '', topic: '' });
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

    // Timeline — auto-format time ranges
    const scheduleMap = {};
    od.schedule.forEach(s => { scheduleMap[s.day] = s; });
    const dayAccum = {}; // accumulated minutes per day
    // Collect timeline items from either column mode or flat mode
    const timelineSelector = _isColumnMode
        ? '.oe-day-column-body .oe-list-item'
        : '#oeTimelineList .oe-list-item';
    od.timeline = [...document.querySelectorAll(timelineSelector)].map(el => {
        // In column mode, derive day from the column container
        let day;
        const col = el.closest('.oe-day-column');
        if (col) {
            day = parseInt(col.dataset.day);
        } else {
            day = parseInt(el.querySelector('[data-key="day"]')?.value || '1');
        }
        const durSel = el.querySelector('[data-key="duration"]');
        const customDur = el.querySelector('[data-key="customDuration"]');
        let mins = 0;
        if (durSel) {
            mins = durSel.value === 'custom' ? (parseInt(customDur?.value) || 0) : (parseInt(durSel.value) || 0);
        }
        // Compute formatted time
        const startTime = scheduleMap[day]?.startTime || '09:00';
        const [sh, sm] = startTime.split(':').map(Number);
        const baseMin = (sh * 60 + sm) + (dayAccum[day] || 0);
        dayAccum[day] = (dayAccum[day] || 0) + mins;
        let timeStr = mins ? `${mins} 分鐘` : '';
        if (mins) {
            const startH = Math.floor(baseMin / 60), startM = baseMin % 60;
            const endMin = baseMin + mins;
            const endH = Math.floor(endMin / 60), endM = endMin % 60;
            const pad = n => String(n).padStart(2, '0');
            timeStr = `${pad(startH)}:${pad(startM)} – ${pad(endH)}:${pad(endM)}（${mins} 分鐘）`;
        }
        return {
            day,
            time: timeStr,
            duration: mins,
            title: el.querySelector('[data-key="title"]').value.trim(),
            desc: el.querySelector('[data-key="desc"]').value.trim(),
            dept: el.querySelector('[data-key="dept"]')?.value.trim() || '全部門',
            tags: el.querySelector('[data-key="tags"]').value.split(',').map(s => s.trim()).filter(Boolean)
        };
    });

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

    // Course Notes
    od.courseNotes = getCourseNotes();

    // Email Template
    const emailEl = document.getElementById('oeEmailTemplate');
    if (emailEl) {
        od.email_template = emailEl.innerText.trim();
    }

    // Pricing items
    od.pricing = collectPricingItems();
    const discVal = parseFloat(document.getElementById('oeDiscountTotal')?.value) || 0;
    if (discVal > 0) od.discount_total = discVal;

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
        // Update active version's data
        if (outlineVersions.length > 0) {
            outlineVersions[activeVersionIdx].data = outline_data;
        }
        // outline_data field always stores version 0 (default for student view)
        // outline_versions stores ALL versions with their data
        const payload = {
            outline_data: outlineVersions[0]?.data || outline_data,
            active_version_idx: activeVersionIdx
        };
        if (outlineVersions.length > 0) {
            payload.outline_versions = outlineVersions;
        }
        const { error } = await db.update('projects', payload, { id: `eq.${projectData.id}` });
        if (error) throw new Error(JSON.stringify(error));
        projectData.outline_data = payload.outline_data;
        projectData.outline_versions = outlineVersions;
        projectData.active_version_idx = activeVersionIdx;
        renderOutlineFromDB();
        const vName = outlineVersions[activeVersionIdx]?.name || '';
        statusEl.textContent = `✓ 已儲存${vName ? '「' + vName + '」' : ''}（${new Date().toLocaleTimeString('zh-TW')}）`;
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
    const hasItems = document.querySelectorAll('#oeTimelineList .oe-list-item, .oe-day-column-body .oe-list-item').length > 0;
    if (hasItems) {
        if (!confirm('目前表單已有資料，匯入預設值會覆蓋。確定要匯入嗎？')) return;
    }
    // Clean up column mode
    const oldCols = document.querySelector('.oe-timeline-columns');
    if (oldCols) oldCols.remove();
    const oldSummary = document.getElementById('oeTimelineSummary');
    if (oldSummary) oldSummary.remove();
    _isColumnMode = false;
    const flatList = document.getElementById('oeTimelineList');
    flatList.style.display = '';
    // Re-show flat add button
    const addBtn = flatList.nextElementSibling;
    if (addBtn?.classList?.contains('oe-add-btn')) addBtn.style.display = '';

    // Clear existing
    flatList.innerHTML = '';
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

// ── Import From Other Project ──
async function importFromProject() {
    const btn = document.getElementById('btnImportProject');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">hourglass_top</span> 載入中...';

    try {
        const { data: allProjects } = await db.select('projects', {
            select: 'id,name,outline_data,outline_versions',
            order: 'updated_at.desc'
        });

        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">content_copy</span> 導入其他專案';

        if (!allProjects?.length) { alert('目前沒有其他專案可供導入'); return; }

        const available = allProjects.filter(p =>
            p.id !== projectData?.id && p.outline_data && Object.keys(p.outline_data).length > 0
        );
        if (!available.length) { alert('沒有其他含課綱資料的專案'); return; }

        // Modal
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
        const modal = document.createElement('div');
        modal.style.cssText = 'background:#fff;border-radius:16px;padding:28px 32px;max-width:480px;width:90%;max-height:70vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)';

        function renderProjectList() {
            let html = '<h3 style="margin:0 0 8px;font-size:1.1rem">導入其他專案課綱</h3>';
            html += '<p style="font-size:0.82rem;color:#64748b;margin:0 0 20px">選擇一個專案，其課綱內容將覆蓋<strong>目前版本</strong>的編輯內容</p>';
            html += '<div style="display:flex;flex-direction:column;gap:8px">';

            available.forEach(p => {
                const tl = p.outline_data?.timeline || [];
                const tools = p.outline_data?.tools || [];
                const moduleCount = tl.filter(b => !b.isBreak).length;
                const subtitle = p.outline_data?.hero?.subtitle || '';
                const versions = p.outline_versions || [];
                const meta = [];
                if (moduleCount) meta.push(moduleCount + ' 個模組');
                if (tools.length) meta.push(tools.length + ' 個工具');
                if (versions.length > 1) meta.push(versions.length + ' 個版本');
                const metaStr = meta.length ? meta.join(' · ') : '尚無內容';

                html += '<button type="button" class="import-proj-item" data-id="' + p.id + '" style="text-align:left;padding:14px 18px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;cursor:pointer;transition:all 0.15s;font-family:inherit">';
                html += '<div style="font-weight:700;font-size:0.92rem;margin-bottom:4px">' + (p.name || '未命名專案') + '</div>';
                if (subtitle) html += '<div style="font-size:0.78rem;color:#64748b;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:380px">' + subtitle + '</div>';
                html += '<div style="font-size:0.72rem;color:#94a3b8">' + metaStr + '</div>';
                html += '</button>';
            });

            html += '</div>';
            html += '<button type="button" id="importProjCancel" style="margin-top:16px;width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;cursor:pointer;font-size:0.85rem;font-family:inherit;color:#64748b">取消</button>';
            modal.innerHTML = html;
            bindProjectEvents();
        }

        function renderVersionList(proj) {
            const versions = proj.outline_versions || [];
            let html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">';
            html += '<button type="button" id="importBackBtn" style="padding:4px 8px;border:none;background:none;cursor:pointer;color:#64748b;font-size:1.1rem">←</button>';
            html += '<div><h3 style="margin:0;font-size:1.05rem">' + (proj.name || '未命名') + '</h3><p style="margin:2px 0 0;font-size:.78rem;color:#94a3b8">選擇要導入的版本</p></div>';
            html += '</div>';
            html += '<div style="display:flex;flex-direction:column;gap:8px">';

            versions.forEach((v, i) => {
                const vData = v.data || {};
                const tl = vData.timeline || [];
                const tools = vData.tools || [];
                const moduleCount = tl.filter(b => !b.isBreak).length;
                const meta = [];
                if (moduleCount) meta.push(moduleCount + ' 個模組');
                if (tools.length) meta.push(tools.length + ' 個工具');
                if (v.created_at) {
                    const d = new Date(v.created_at);
                    meta.push(d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }));
                }
                const metaStr = meta.length ? meta.join(' · ') : '';
                const subtitle = vData.hero?.subtitle || '';

                html += '<button type="button" class="import-version-item" data-vidx="' + i + '" style="text-align:left;padding:14px 18px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;cursor:pointer;transition:all 0.15s;font-family:inherit">';
                html += '<div style="font-weight:700;font-size:0.88rem;margin-bottom:3px">' + (v.name || '版本 ' + (i + 1)) + '</div>';
                if (subtitle) html += '<div style="font-size:0.76rem;color:#64748b;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:380px">' + subtitle + '</div>';
                if (metaStr) html += '<div style="font-size:0.7rem;color:#94a3b8">' + metaStr + '</div>';
                html += '</button>';
            });

            html += '</div>';
            html += '<button id="importProjCancel" style="margin-top:16px;width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;cursor:pointer;font-size:0.85rem;font-family:inherit;color:#64748b">取消</button>';
            modal.innerHTML = html;

            // Back button
            document.getElementById('importBackBtn').addEventListener('click', () => renderProjectList());

            // Hover
            modal.querySelectorAll('.import-version-item').forEach(b => {
                b.addEventListener('mouseenter', () => { b.style.borderColor = '#1a73e8'; b.style.background = '#f5f3ff'; });
                b.addEventListener('mouseleave', () => { b.style.borderColor = '#e2e8f0'; b.style.background = '#fff'; });
            });

            // Select version
            modal.querySelectorAll('.import-version-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const vidx = parseInt(item.dataset.vidx);
                    const version = versions[vidx];
                    if (!version?.data) { alert('此版本無課綱資料'); return; }
                    const vName = outlineVersions[activeVersionIdx]?.name || '版本 ' + (activeVersionIdx + 1);
                    if (!confirm('確定要將「' + (proj.name || '未命名') + ' → ' + (version.name || '版本') + '」導入到「' + vName + '」嗎？\n僅替換目前版本，其他版本不受影響。')) return;
                    try {
                        _applyOutlineData(version.data);
                        outlineVersions[activeVersionIdx].data = collectOutlineData();
                        overlay.remove();
                    } catch (err) {
                        console.error('[Import] apply version error:', err);
                        alert('導入失敗：' + err.message);
                    }
                });
            });

            document.getElementById('importProjCancel').addEventListener('click', () => overlay.remove());
        }

        function doImport(proj) {
            console.log('[Import] doImport called. versions:', (proj.outline_versions || []).length);
            const versions = proj.outline_versions || [];
            if (versions.length > 1) {
                console.log('[Import] showing version picker');
                renderVersionList(proj);
            } else {
                const vName = outlineVersions[activeVersionIdx]?.name || '版本 ' + (activeVersionIdx + 1);
                console.log('[Import] single version, showing confirm');
                if (!confirm('確定要將「' + (proj.name || '未命名') + '」的課綱導入到「' + vName + '」嗎？\n僅替換目前版本，其他版本不受影響。')) {
                    console.log('[Import] user cancelled');
                    return;
                }
                try {
                    console.log('[Import] applying outline data...');
                    _applyOutlineData(proj.outline_data);
                    outlineVersions[activeVersionIdx].data = collectOutlineData();
                    console.log('[Import] ✅ success, removing overlay');
                    overlay.remove();
                } catch (err) {
                    console.error('[Import] apply error:', err);
                    alert('導入失敗：' + err.message);
                }
            }
        }

        function bindProjectEvents() {
            // Hover
            modal.querySelectorAll('.import-proj-item').forEach(b => {
                b.addEventListener('mouseenter', () => { b.style.borderColor = '#1a73e8'; b.style.background = '#f5f3ff'; });
                b.addEventListener('mouseleave', () => { b.style.borderColor = '#e2e8f0'; b.style.background = '#fff'; });
            });

            // Close
            document.getElementById('importProjCancel').addEventListener('click', () => overlay.remove());

            // Select
            modal.querySelectorAll('.import-proj-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Import] project clicked:', item.dataset.id);
                    const selected = available.find(p => p.id === item.dataset.id);
                    if (!selected) { console.log('[Import] project NOT FOUND'); return; }
                    console.log('[Import] calling doImport for:', selected.name);
                    doImport(selected);
                });
            });
        }

        // Close on overlay click
        let _overlayMouseDownTarget = null;
        overlay.addEventListener('mousedown', e => {
            _overlayMouseDownTarget = e.target;
            console.log('[Import] mousedown on:', e.target.tagName, e.target.className || e.target.id || '(overlay)');
        });
        overlay.addEventListener('click', e => {
            console.log('[Import] click on overlay. e.target===overlay?', e.target === overlay, 'mouseDownTarget===overlay?', _overlayMouseDownTarget === overlay);
            if (e.target === overlay && _overlayMouseDownTarget === overlay) {
                console.log('[Import] ⚠️ CLOSING via overlay click');
                overlay.remove();
            }
        });

        // Track any removal
        const obs = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.removedNodes) {
                    if (node === overlay || node.contains?.(overlay)) {
                        console.log('[Import] ⚠️ OVERLAY REMOVED by MutationObserver! Parent:', m.target.tagName, m.target.id);
                        console.trace('[Import] removal stack trace');
                    }
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        console.log('[Import] modal appended to body ✅');
        renderProjectList();
    } catch(err) {
        console.error('Import error:', err);
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">content_copy</span> 導入其他專案';
        alert('載入失敗：' + err.message);
    }
}

function _applyOutlineData(od) {
    if (!od) return;
    // Remove existing columns if any
    const oldCols = document.querySelector('.oe-timeline-columns');
    if (oldCols) oldCols.remove();
    const oldSummary = document.getElementById('oeTimelineSummary');
    if (oldSummary) oldSummary.remove();

    const flatList = document.getElementById('oeTimelineList');
    flatList.innerHTML = '';
    flatList.style.display = '';
    _isColumnMode = false;

    document.getElementById('oeToolsList').innerHTML = '';
    document.getElementById('oeEquipList').innerHTML = '';
    _tlCounter = 0; _toolCounter = 0; _eqCounter = 0;

    const _v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

    if (od.hero) {
        _v('oeHeroSubtitle', od.hero.subtitle);
        _v('oeHeroDays', od.hero.days);
        _v('oeHeroDuration', od.hero.duration);
        _v('oeHeroGroupSize', od.hero.groupSize);
        _v('oeHeroLocation', od.hero.location);
    }

    document.getElementById('oeScheduleList').innerHTML = '';
    _schCounter = 0;
    // Add schedule days WITHOUT triggering rebuild (we do it manually after timeline is loaded)
    const schedDays = od.schedule?.length ? od.schedule : [{ day: 1, hours: '', topic: '' }];
    schedDays.forEach(s => {
        const list = document.getElementById('oeScheduleList');
        if (!list) return;
        const dayNum = s.day || (list.children.length + 1);
        const div = document.createElement('div');
        div.className = 'oe-schedule-day';
        div.style.cssText = 'display:flex;gap:10px;align-items:center;padding:10px 14px;background:linear-gradient(135deg,#f8fafc,#e8f0fe);border:1px solid #d2e3fc;border-radius:10px;transition:box-shadow 0.2s;flex-wrap:wrap';
        div.onmouseenter = () => div.style.boxShadow = '0 2px 8px rgba(99,102,241,0.08)';
        div.onmouseleave = () => div.style.boxShadow = 'none';
        div.innerHTML = `
            <span class="oe-day-badge" style="display:inline-flex;align-items:center;justify-content:center;min-width:52px;padding:4px 10px;border-radius:6px;background:var(--accent);color:#fff;font-size:0.75rem;font-weight:700;letter-spacing:0.04em;white-space:nowrap">Day ${dayNum}</span>
            <input type="hidden" data-key="day" value="${dayNum}">
            <input type="date" data-key="date" value="${_esc(s.date || '')}" style="font-size:0.82rem;border:1px solid var(--border);border-radius:6px;padding:4px 8px;background:#fff;color:var(--text);font-family:inherit">
            <div style="display:flex;align-items:center;gap:4px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:2px 8px">
                <input type="time" data-key="startTime" value="${_esc(s.startTime || '09:00')}" style="width:80px;font-size:0.85rem;border:none;outline:none;background:transparent;font-weight:600" onchange="_updateTimelineTimeRanges()">
                <span style="font-size:0.72rem;color:var(--text-3);white-space:nowrap">開始</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:2px 8px">
                <input type="text" data-key="hours" value="${_esc(s.hours || '')}" placeholder="7" style="width:36px;font-size:0.85rem;border:none;outline:none;text-align:center;background:transparent;font-weight:600">
                <span style="font-size:0.72rem;color:var(--text-3);white-space:nowrap">小時</span>
            </div>
            <input type="text" data-key="topic" value="${_esc(s.topic || '')}" placeholder="當日課程主題" style="flex:1;min-width:120px;font-size:0.85rem;border:1px solid var(--border);border-radius:6px;padding:6px 10px;background:#fff">
            <input type="text" data-key="instructor" value="${_esc(s.instructor || '')}" placeholder="講師" style="width:80px;font-size:0.85rem;border:1px solid var(--border);border-radius:6px;padding:6px 10px;background:#fff">
            <button class="oe-delete" onclick="this.closest('.oe-schedule-day').remove();renumberScheduleDays();_scheduleRebuildColumns()" style="position:static;width:26px;height:26px;border-radius:6px;opacity:0.4;transition:opacity 0.2s" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.4'"><span class="material-symbols-outlined" style="font-size:14px">close</span></button>
        `;
        list.appendChild(div);
    });

    // First add timeline blocks to the flat list
    (od.timeline || []).forEach(b => addTimelineBlock(b));

    // Now rebuild columns if multi-day
    if (schedDays.length > 1) {
        rebuildTimelineColumns();
    }

    (od.tools || []).forEach(t => addToolBlock(t));
    (od.equipment || []).forEach(e => addEquipBlock(e));
    _v('oeEquipNote', od.equipNote);

    if (od.taConfig) {
        _v('oeTaCount', od.taConfig.count);
        _v('oeTaDuties', (od.taConfig.duties || []).join('\n'));
    }

    // Pricing
    applyPricingItems(od.pricing);
    _v('oeDiscountTotal', od.discount_total || '');
    updateDiscountDisplay();

    initDragAndDrop();
    if (typeof _updateTimelineTimeRanges === 'function') _updateTimelineTimeRanges();

    const status = document.getElementById('outlineSaveStatus');
    if (status) {
        status.textContent = '✓ 已成功導入課綱，請記得按「儲存」';
        status.style.display = 'block';
        setTimeout(() => { status.style.display = 'none'; }, 5000);
    }
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
    const key = `org-logos/${Date.now()}_${encodeURIComponent(file.name)}`;
    const { data, error } = await storage.upload('outline-files', key, file);
    if (error) { alert('上傳失敗'); return; }
    document.getElementById('orgLogo').value = data.url;
    input.value = '';
};

// ══════════════════════════════════════
// HR NOTIFICATION EMAIL TEMPLATE
// ══════════════════════════════════════
function _generateEmailText() {
    const od = getOutlineData() || {};
    const hero = od.hero || {};
    const courseName = projectData?.name || '課程名稱';
    const clientName = orgData?.name || '貴公司';
    const joinCode = projectData?.join_code || '';
    const sessionCode = sessionData?.session_code || '';
    const loginUrl = joinCode
        ? `${location.origin}/portal.html?code=${joinCode}${sessionCode ? '&session=' + sessionCode : ''}`
        : `${location.origin}/portal.html`;

    // Schedule — auto-detect days from timeline (same logic as render)
    const timeline = od.timeline || [];
    let schedule = od.schedule ? [...od.schedule] : [];
    if (timeline.length > 0) {
        const uniqueDays = [...new Set(timeline.map(b => b.day || 1))].sort((a, b) => a - b);
        if (uniqueDays.length > 1 && schedule.length < uniqueDays.length) {
            const defaultHours = schedule[0]?.hours || '';
            schedule = uniqueDays.map(d => {
                const existing = schedule.find(s => s.day === d);
                if (existing) return existing;
                if (defaultHours) return { day: d, hours: defaultHours, topic: '' };
                const dayBlocks = timeline.filter(b => (b.day || 1) === d);
                let totalMin = 0;
                dayBlocks.forEach(b => {
                    const m = (b.time || '').match(/(\d+)\s*分鐘/);
                    if (m) totalMin += parseInt(m[1]);
                });
                return { day: d, hours: totalMin ? String(Math.round(totalMin / 60 * 10) / 10) : '', topic: '' };
            });
        }
    }
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

    return `各位同仁好：

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

${(() => {
    const notes = od.courseNotes || [];
    const isInteractive = projectData?.slide_mode !== 'external';
    if (notes.length > 0) {
        return notes.map((n, i) => `  ${i + 1}. ${n.title}${n.desc ? `\n     ${n.desc}` : ''}`).join('\n');
    }
    const defaultNotes = [
        '本課程屬於數位課程，不提供實體講義。',
        isInteractive
            ? '本次課程簡報採用特別開發的互動式簡報，上課當天可透過「課前準備頁」進入簡報連結，進行課堂互動。'
            : null,
        '講師將進行螢幕錄影（原檔交付不剪輯）。若需實體拍攝請自行安排。若錄影因設備意外中斷，將提供課程逐字稿摘要供後續參考。'
    ].filter(Boolean);
    return defaultNotes.map((n, i) => `  ${i + 1}. ${n}`).join('\n');
})()}


━━━━━━━━━━━━━━━━━━━━
🔗 課程查看入口
━━━━━━━━━━━━━━━━━━━━

請於課前使用以下連結查看課程資訊：
${loginUrl}
${joinCode ? `\n專案代碼：${joinCode}` : ''}

登入方式：輸入專案代碼即可進入。


━━━━━━━━━━━━━━━━━━━━
📝 課前準備事項
━━━━━━━━━━━━━━━━━━━━

${equipItems || '  ✓ 請自備筆電，需可連接網路'}
${equipNote ? `\n⚠️ ${equipNote}` : ''}


━━━━━━━━━━━━━━━━━━━━
📅 上課時間與地點
━━━━━━━━━━━━━━━━━━━━

日　　期：${schedule.some(s => s.date) ? schedule.filter(s => s.date).map(s => { const d = new Date(s.date + 'T00:00:00'); return `Day ${s.day} — ${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}（${'日一二三四五六'[d.getDay()]}）`; }).join('\n　　　　　') : '【請填入上課日期】'}
時　　間：${schedule[0]?.startTime ? schedule.map(s => `Day ${s.day} — ${s.startTime} 開始${s.hours ? `（${s.hours} 小時）` : ''}`).join('\n　　　　　') : '【請填入上課時間】'}
地　　點：【請填入上課地點】


如有任何問題，請洽人力資源部。
期待您的參與！

${clientName} 人力資源部 敬上`;

}

function initHrEmail() {
    const contentEl = document.getElementById('hrEmailContent');
    const copyBtn = document.getElementById('btnCopyEmail');
    if (!contentEl) return;

    // Use saved template if available, otherwise generate
    const od = getOutlineData() || {};
    if (od.email_template) {
        contentEl.textContent = od.email_template;
    } else {
        contentEl.textContent = _generateEmailText();
    }

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
        if (!allowed.includes(ext)) {
            if (progressEl) {
                progressEl.style.display = 'block';
                progressEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:8px 0"><span class="material-symbols-outlined" style="font-size:18px;color:#ef4444">error</span><span style="font-size:0.82rem;font-weight:600;color:#ef4444">不支援的格式：${ext}</span></div>`;
                setTimeout(() => { progressEl.style.display = 'none'; }, 3000);
            }
            continue;
        }
        if (file.size > 50*1024*1024) {
            if (progressEl) {
                progressEl.style.display = 'block';
                progressEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:8px 0"><span class="material-symbols-outlined" style="font-size:18px;color:#ef4444">error</span><span style="font-size:0.82rem;font-weight:600;color:#ef4444">檔案上限 50MB</span></div>`;
                setTimeout(() => { progressEl.style.display = 'none'; }, 3000);
            }
            continue;
        }

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
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        const key = `projects/${projectId}/${Date.now()}${fileExt}`;
        const { data, error } = await storage.upload('outline-files', key, file);

        if (error) {
            if (progressEl) {
                progressEl.style.display = 'block';
                progressEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:8px 0"><span class="material-symbols-outlined" style="font-size:18px;color:#ef4444">error</span><span style="font-size:0.82rem;font-weight:600;color:#ef4444">上傳失敗：${error.message || '未知錯誤'}</span></div>`;
                setTimeout(() => { progressEl.style.display = 'none'; }, 4000);
            }
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
    uploadedFiles = []; // 清空避免殘留上一個專案的檔案
    const projectId = projectData?.id;
    if (!projectId) { renderFileList(); return; }
    const { data } = await db.select('project_files', { filter: { project_id: `eq.${projectId}` } });
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
    if (!file) return;
    if (!confirm(`確定要刪除「${file.file_name || file.name || '此檔案'}」？`)) return;
    try {
        // Delete from database
        if (file.id) {
            await db.delete('project_files', { id: `eq.${file.id}` });
        }
        // Try to delete from storage using correct key field and bucket
        const storageKey = file.storage_key || file.storage_path;
        if (storageKey) {
            try {
                await fetch(
                    `https://wsaknnhjgiqmkendeyrj.supabase.co/storage/v1/object/outline-files/${storageKey}`,
                    { method: 'DELETE', headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzYWtubmhqZ2lxbWtlbmRleXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTI4MTIsImV4cCI6MjA4NzY4ODgxMn0.1j-4D9Kw0vqhVcTWgU7ABTJ_mO6aN4IB72Ojof8Yfko', 'Authorization': `Bearer ${localStorage.getItem('_at') || sessionStorage.getItem('_at') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzYWtubmhqZ2lxbWtlbmRleXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTI4MTIsImV4cCI6MjA4NzY4ODgxMn0.1j-4D9Kw0vqhVcTWgU7ABTJ_mO6aN4IB72Ojof8Yfko'}` } }
                );
            } catch(e) { console.warn('Storage delete skipped:', e); }
        }
    } catch(e) {
        console.error('Delete file error:', e);
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

    const prompt = `你是一位專業的 AI 培訓課程設計師，擅長設計高密度、高互動的企業培訓課程。請根據以下客戶資訊，生成一份完整的 AI 辦公應用培訓課程大綱。

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
      "desc": "2-3 句模組說明，包含具體學習目標、實際操作步驟、使用工具",
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

⚠️ 最重要的規則 — 時間切分粒度：
1. 【強制】每個 timeline 模組時間跨度不得超過 30-40 分鐘！嚴禁出現 60 分鐘以上的大段模組。
2. 【強制】一天 ${hours || '6'} 小時的課程，timeline 應至少有 12-16 個模組（含休息），絕不能只有 5-6 個大塊。
3. 【強制】將教學內容拆分為：概念講解（15-20分鐘）→ 實作練習（15-20分鐘）→ 案例分享（10-15分鐘）的循環。
4. 每個工具教學應拆分為：功能介紹 → 即時演練 → 學員實作 至少 2-3 個子模組。
5. 範例（正確的切分方式）：
   - ✅ "09:00 – 09:20（20 分鐘）" — ChatGPT 核心概念與 Prompt 結構
   - ✅ "09:20 – 09:45（25 分鐘）" — 即時演練：用 ChatGPT 生成會議紀錄摘要
   - ✅ "09:45 – 10:05（20 分鐘）" — 學員實作：各組實際操作完成指定任務
   - ❌ "09:00 – 10:30（90 分鐘）" — ChatGPT 教學與實作  ← 這是錯的！太長！

其他規則：
6. timeline 要包含合理的休息時間（isBreak: true），每 60-90 分鐘安排 10-15 分鐘休息
7. 每個模組的 time 要用實際時間格式，例如「09:00 – 09:20（20 分鐘）」
8. 【關鍵】多天課程時，timeline 中每個 block 必須設定正確的 "day" 值
9. 【關鍵】多天課程時，schedule 陣列必須包含每天的項目
10. hero.days 必須設為正確的天數字串
11. 如果指定了工具，以指定工具為主；沒指定則根據需求選擇最合適的 AI 工具
12. tools 中的 logo URL 請使用知名 AI 工具的真實圖片，如果不確定就留空字串
13. equipment 中的 icon 請使用 Google Material Symbols 的 icon 名稱
14. tags 從課程內容中提取 2-5 個關鍵字
15. 根據學員部門調整案例和應用場景
16. 根據學員程度調整教學深度和節奏
17. desc 欄位要寫得具體詳細（包含會學到什麼、會練習什麼、會用到哪個工具的哪個功能），不要只有籠統的描述
18. 輸出純 JSON，不要任何額外文字或 markdown`;

    try {
        const result = await ai.chat([{ role: 'user', content: prompt }], {
            maxTokens: 16384,
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
