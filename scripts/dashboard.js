/**
 * 即時教學儀表板 v2
 * - 場次選擇器（project_sessions）
 * - 僅顯示在線學員（students 表 + session_code）
 * - 場次比較檢視
 * - 每 5 秒自動輪詢
 */
import { db, realtime } from './supabase.js';

const POLL_INTERVAL = 30000;
const TYPE_ICONS = { quiz: 'quiz', poll: 'how_to_vote', matching: 'drag_indicator', ordering: 'format_list_numbered', fillblank: 'edit_note', truefalse: 'check_circle', opentext: 'chat', scale: 'linear_scale', buzzer: 'notifications_active', wordcloud: 'cloud', hotspot: 'my_location' };
const TYPE_LABELS = { quiz: '\u9078\u64C7\u984C', poll: '\u6295\u7968', matching: '\u9023\u9023\u770B', ordering: '\u6392\u5217\u9806\u5E8F', fillblank: '\u586B\u7A7A\u984C', truefalse: '\u662F\u975E\u984C', opentext: '\u958B\u653E\u554F\u7B54', scale: '\u91CF\u8868\u8A55\u5206', buzzer: '\u6436\u7B54', wordcloud: '\u6587\u5B57\u96F2', hotspot: '\u5716\u7247\u6A19\u8A3B' };

// Helper: handle is_correct as both boolean and string
function isCorrectTrue(v) { return v === true || v === 'true'; }
function isCorrectFalse(v) { return v === false || v === 'false'; }
function isCorrectGraded(v) { return v !== null && v !== undefined && v !== ''; }

// ── State ──
let currentSessionCode = '';
let allSessions = [];           // { session_code, date, venue, ... }
let pollTimer = null;
let slides = [];
let interactiveElements = [];
let onlineStudents = new Set();  // email — 在線學員
let studentNames = {};
let submissionsMap = {};
let pollVotesMap = {};
let rawSubmissions = [];  // 原始提交列表（軌跡檢視用）
let lastFetchTime = null;
let currentView = 'cards';

// ══════════════════════
//  初始化
// ══════════════════════
export async function init() {
    currentSessionCode = new URLSearchParams(location.search).get('code') || '';

    // 載入所有場次
    await loadSessions();

    // 場次選擇器事件
    const sel = document.getElementById('sessionSelect');
    sel.addEventListener('change', async () => {
        currentSessionCode = sel.value;
        onlineStudents = new Set();
        submissionsMap = {};
        pollVotesMap = {};
        await loadProjectSlides();
        await loadOnlineStudents();
        await fetchSubmissions();
        renderAll();
        updateLiveIndicator();
    });

    if (!currentSessionCode && allSessions.length > 0) {
        currentSessionCode = allSessions[0].session_code || allSessions[0].join_code || '';
    }
    sel.value = currentSessionCode;

    if (!currentSessionCode) {
        renderError('\u627E\u4E0D\u5230\u5834\u6B21\u3002\u8ACB\u5F9E\u5EE3\u64AD\u5217\u7684\u300C\u5100\u8868\u677F\u300D\u6309\u9215\u958B\u555F\u3002');
        return;
    }

    renderLoading();
    await loadProjectSlides();
    await loadOnlineStudents();
    await fetchSubmissions();
    renderAll();
    updateLiveIndicator();
    startPolling();

    window.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollTop');
        if (btn) btn.classList.toggle('visible', window.scrollY > 300);
    });
}

// ══════════════════════
//  場次管理
// ══════════════════════
async function loadSessions() {
    try {
        const { data } = await db.select('sessions', {
            select: 'id,session_code,title,is_broadcasting,created_at',
            order: 'created_at.desc',
        });
        allSessions = (data || []).map(s => ({
            ...s,
            session_code: s.session_code,
            join_code: s.session_code,
            status: s.is_broadcasting === 'true' || s.is_broadcasting === true ? 'active' : 'ended',
            date: s.created_at ? new Date(s.created_at).toISOString().slice(0, 10) : '',
            venue: '',
        }));

        const sel = document.getElementById('sessionSelect');
        sel.innerHTML = '';
        if (allSessions.length === 0) {
            sel.innerHTML = '<option value="">\u7121\u5834\u6B21</option>';
            return;
        }
        allSessions.forEach(s => {
            const code = s.session_code || '';
            const label = (s.title || '') + (s.date ? ' \u00B7 ' + s.date : '') + (s.status === 'active' ? ' [LIVE]' : '');
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = label || code;
            sel.appendChild(opt);
        });
    } catch (e) {
        console.warn('loadSessions error:', e);
    }
}

function updateLiveIndicator() {
    const dot = document.getElementById('dashLiveDot');
    const currentSession = allSessions.find(s => (s.session_code || s.join_code) === currentSessionCode);
    const isLive = currentSession?.status === 'active';
    if (dot) dot.style.display = isLive ? '' : 'none';
}

// ══════════════════════
//  在線學員
// ══════════════════════
async function loadOnlineStudents() {
    try {
        const { data } = await db.select('students', {
            filter: { session_code: 'eq.' + currentSessionCode },
            select: 'email,name',
        });
        onlineStudents = new Set();
        studentNames = {};
        (data || []).forEach(s => {
            if (s.email) {
                onlineStudents.add(s.email);
                if (s.name) studentNames[s.email] = s.name;
            }
        });
    } catch (e) {
        console.warn('loadOnlineStudents error:', e);
    }
}

// ══════════════════════
//  投影片 → 互動元素
// ══════════════════════
async function loadProjectSlides() {
    try {
        // 嘗試用 join_code 找 project
        let projects = [];
        const { data: byJoinCode } = await db.select('projects', {
            filter: { join_code: 'eq.' + currentSessionCode },
            select: 'id,name,slides_data',
            limit: 1,
        });
        projects = byJoinCode || [];

        // 如果找不到，嘗試從 sessions 取 project_id
        if (projects.length === 0) {
            try {
                const { data: sessRows } = await db.select('sessions', {
                    filter: { session_code: 'eq.' + currentSessionCode },
                    select: 'project_id',
                    limit: 1,
                });
                const pid = sessRows?.[0]?.project_id;
                if (pid) {
                    const { data: byId } = await db.select('projects', {
                        filter: { id: 'eq.' + pid },
                        select: 'id,name,slides_data',
                        limit: 1,
                    });
                    projects = byId || [];
                }
            } catch { /* no project_id column, skip */ }
        }

        if (projects.length > 0 && projects[0].slides_data) {
            const sd = typeof projects[0].slides_data === 'string'
                ? JSON.parse(projects[0].slides_data)
                : projects[0].slides_data;
            slides = sd.slides || [];
            document.getElementById('dashProjectName').textContent = projects[0].name || '\u8AB2\u5802\u5100\u8868\u677F';
            extractInteractiveElements();
        } else {
            slides = [];
            interactiveElements = [];
        }
    } catch (e) {
        console.warn('loadProjectSlides error:', e);
    }
}

function extractInteractiveElements() {
    interactiveElements = [];
    const types = ['quiz', 'poll', 'matching', 'ordering', 'fillblank', 'truefalse', 'opentext', 'scale', 'buzzer', 'wordcloud', 'hotspot'];
    slides.forEach((slide, si) => {
        (slide.elements || []).forEach(el => {
            const t = el.interactiveType || el.type || '';
            if (types.includes(t)) {
                const title = (t === 'quiz' || t === 'poll') ? (el.question || el.title || TYPE_LABELS[t]) : (el.title || TYPE_LABELS[t]);
                interactiveElements.push({ id: el.id, type: t, title, slideIndex: si });
            }
        });
    });
}

// ══════════════════════
//  Submissions 取得
// ══════════════════════
async function fetchSubmissions() {
    try {
        const subColumns = 'id,element_id,student_email,student_name,content,is_correct,score,type,assignment_title,submitted_at,created_at,session_id';
        const pollColumns = 'id,element_id,student_email,student_name,option_index,option_text,created_at,session_code';
        const [subRes, pollRes] = await Promise.all([
            db.select('submissions', { select: subColumns, filter: { session_id: 'eq.' + currentSessionCode }, order: 'submitted_at.asc' }),
            db.select('poll_votes', { select: pollColumns, filter: { session_code: 'eq.' + currentSessionCode }, order: 'created_at.asc' }),
        ]);

        submissionsMap = {};
        rawSubmissions = subRes?.data || [];
        rawSubmissions.forEach(s => {
            if (!s.element_id) return;
            if (!submissionsMap[s.element_id]) submissionsMap[s.element_id] = {};
            submissionsMap[s.element_id][s.student_email] = s;
            if (s.student_email) {
                // 有作答紀錄也算在線
                onlineStudents.add(s.student_email);
                if (s.student_name) studentNames[s.student_email] = s.student_name;
            }
        });

        pollVotesMap = {};
        (pollRes?.data || []).forEach(v => {
            if (!v.element_id) return;
            if (!pollVotesMap[v.element_id]) pollVotesMap[v.element_id] = [];
            pollVotesMap[v.element_id].push(v);
            if (v.student_email) {
                onlineStudents.add(v.student_email);
                if (v.student_name) studentNames[v.student_email] = v.student_name;
            }
        });

        lastFetchTime = Date.now();
        updateHeaderMeta();
    } catch (e) {
        console.warn('fetchSubmissions error:', e);
    }
}

// ══════════════════════
//  輪詢
// ══════════════════════
function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
        await loadOnlineStudents();
        await fetchSubmissions();
        renderAll();
    }, POLL_INTERVAL);

    // Realtime 即時推送：學生交作答或投票時立刻更新（debounce 500ms 防連續觸發）
    if (currentSessionCode) {
        let _rtTimer = null;
        const onRealtimeUpdate = () => {
            if (_rtTimer) clearTimeout(_rtTimer);
            _rtTimer = setTimeout(async () => {
                await fetchSubmissions();
                renderAll();
            }, 500);
        };
        realtime.on('submission_saved', onRealtimeUpdate);
        realtime.on('poll_vote', onRealtimeUpdate);
    }
}

window._dashRefresh = async function () {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.classList.add('spinning');
    await loadOnlineStudents();
    await fetchSubmissions();
    renderAll();
    setTimeout(() => btn?.classList.remove('spinning'), 500);
};

// ══════════════════════
//  View Toggle
// ══════════════════════
window._dashSetView = function (view) {
    currentView = view;
    ['viewCards', 'viewMatrix', 'viewCompare', 'viewTrail'].forEach(id => {
        document.getElementById(id)?.classList.toggle('active', id === 'view' + view.charAt(0).toUpperCase() + view.slice(1));
    });
    document.getElementById('dashCards').style.display = view === 'cards' ? '' : 'none';
    document.getElementById('dashMatrix').style.display = view === 'matrix' ? '' : 'none';
    document.getElementById('dashCompare').style.display = view === 'compare' ? '' : 'none';
    document.getElementById('dashTrail').style.display = view === 'trail' ? '' : 'none';
    renderAll();
};

// ══════════════════════
//  渲染主入口
// ══════════════════════
function renderAll() {
    updateStats();
    if (currentView === 'cards') renderCardsView();
    else if (currentView === 'matrix') renderMatrixView();
    else if (currentView === 'compare') renderCompareView();
    else if (currentView === 'trail') renderTrailView();
}

// ── 卡片檢視 ──
function renderCardsView() {
    const c = document.getElementById('dashCards');
    const allEls = getAllElements();
    if (onlineStudents.size === 0 && allEls.length === 0) {
        c.innerHTML = '<div class="dash-empty"><span class="material-symbols-outlined">pending_actions</span><p>\u76EE\u524D\u6C92\u6709\u5B78\u54E1\u5728\u7DDA\u6216\u4F5C\u7B54\u8CC7\u6599\u3002</p></div>';
        return;
    }
    c.innerHTML = allEls.map(el => renderCard(el)).join('');
}

function renderCard(el) {
    const isPoll = el.type === 'poll';
    const icon = TYPE_ICONS[el.type] || 'quiz';
    const typeLabel = TYPE_LABELS[el.type] || el.type;
    const slide = el.slideIndex >= 0 ? '\u7B2C' + (el.slideIndex + 1) + '\u9801' : '';
    const body = isPoll ? renderPollBody(el) : renderScoreBody(el);
    const prog = isPoll ? '' : renderProgress(el);
    return '<div class="dash-card"><div class="dash-card-header"><div class="dash-card-title type-' + el.type + '"><span class="material-symbols-outlined">' + icon + '</span><span>' + esc(el.title) + '</span></div><div class="dash-card-type"><span class="material-symbols-outlined">' + (slide ? 'slideshow' : 'category') + '</span>' + typeLabel + (slide ? ' \u00B7 ' + slide : '') + '</div></div><div class="dash-card-body">' + body + '</div>' + prog + '</div>';
}

function renderScoreBody(el) {
    const subs = submissionsMap[el.id] || {};
    const emails = [...onlineStudents];
    if (!emails.length) return '<div style="color:var(--dash-text-muted);font-size:0.8rem;">\u5C1A\u7121\u5B78\u54E1</div>';
    let html = '<div class="dash-students-grid">';
    emails.forEach(email => {
        const r = subs[email];
        const name = studentNames[email] || email.split('@')[0];
        let cls, icon, score;
        if (!r) { cls = 'status-pending'; icon = '\u00B7'; score = ''; }
        else if (isCorrectTrue(r.is_correct)) { cls = 'status-correct'; icon = '\u2713'; score = r.content || ''; }
        else if (isCorrectFalse(r.is_correct)) { cls = 'status-wrong'; icon = '\u2717'; score = r.content || ''; }
        else { cls = 'status-voted'; icon = '\u2713'; score = r.content || ''; }
        html += '<div class="dash-student"><div class="dash-student-status ' + cls + '">' + icon + '</div><div class="dash-student-name">' + esc(name) + '</div>' + (score ? '<div class="dash-student-score">' + esc(score) + '</div>' : '') + '</div>';
    });
    return html + '</div>';
}

function renderPollBody(el) {
    const votes = pollVotesMap[el.id] || [];
    const subs = submissionsMap[el.id] || {};
    const votedEmails = new Set();
    votes.forEach(v => { if (v.student_email) votedEmails.add(v.student_email); });
    Object.keys(subs).forEach(e => votedEmails.add(e));
    if (!votes.length && !Object.keys(subs).length) return '<div style="color:var(--dash-text-muted);font-size:0.8rem;">\u5C1A\u7121\u6295\u7968</div>';
    const counts = {};
    votes.forEach(v => { const l = '\u9078\u9805 ' + (v.option_index + 1); counts[l] = (counts[l] || 0) + 1; });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    let bars = '';
    Object.entries(counts).forEach(([l, c]) => {
        const p = total > 0 ? Math.round(c / total * 100) : 0;
        bars += '<div class="dash-poll-option"><div class="dash-poll-label">' + esc(l) + '</div><div class="dash-poll-bar-wrap"><div class="dash-poll-bar-fill" style="width:' + p + '%"></div></div><div class="dash-poll-count">' + c + ' (' + p + '%)</div></div>';
    });
    let voters = '';
    [...onlineStudents].forEach(e => {
        const name = studentNames[e] || e.split('@')[0];
        const voted = votedEmails.has(e);
        voters += '<span class="dash-poll-voter ' + (voted ? '' : 'not-voted') + '">' + (voted ? '\u2713' : '\u00B7') + ' ' + esc(name) + '</span>';
    });
    return '<div class="dash-poll-bars">' + bars + '</div>' + (voters ? '<div class="dash-poll-voters">' + voters + '</div>' : '');
}

function renderProgress(el) {
    const subs = submissionsMap[el.id] || {};
    const total = onlineStudents.size;
    if (!total) return '';
    const answered = Object.keys(subs).filter(e => onlineStudents.has(e)).length;
    const correct = Object.values(subs).filter(s => onlineStudents.has(s.student_email) && isCorrectTrue(s.is_correct)).length;
    const pct = Math.round(correct / total * 100);
    return '<div class="dash-card-progress"><div class="dash-progress-bar"><div class="dash-progress-fill green" style="width:' + pct + '%"></div></div><div class="dash-progress-text">' + answered + '/' + total + ' \u5DF2\u7B54 \u00B7 ' + correct + ' \u7B54\u5C0D (' + pct + '%)</div></div>';
}

// ── 矩陣檢視 ──
function renderMatrixView() {
    const c = document.getElementById('dashMatrix');
    const emails = [...onlineStudents];
    const allEls = getAllElements();
    if (!emails.length || !allEls.length) {
        c.innerHTML = '<div class="dash-empty"><span class="material-symbols-outlined">pending_actions</span><p>\u5C1A\u7121\u8CC7\u6599\u3002</p></div>';
        return;
    }
    let thead = '<tr><th>\u5B78\u54E1</th>';
    allEls.forEach((el, i) => {
        thead += '<th title="' + esc(el.title) + ' (' + ((TYPE_LABELS[el.type]) || el.type) + ')">' + (i + 1) + '</th>';
    });
    thead += '<th>\u7E3D\u89BD</th></tr>';

    let tbody = '';
    emails.forEach(email => {
        const name = studentNames[email] || email.split('@')[0];
        let correct = 0, answered = 0, graded = 0;
        let row = '<tr><td class="matrix-student-name" title="' + esc(email) + '">' + esc(name) + '</td>';
        allEls.forEach(el => {
            const sub = submissionsMap[el.id] && submissionsMap[el.id][email];
            const hasPolled = (pollVotesMap[el.id] || []).some(v => v.student_email === email);
            if (el.type === 'poll') {
                if (hasPolled || sub) {
                    const pollContent = sub ? sub.content : '\u5DF2\u6295\u7968';
                    row += '<td class="matrix-cell matrix-voted" title="' + esc(name) + ': ' + esc(pollContent) + '" data-student="' + esc(email) + '" data-el="' + el.id + '">\u2713</td>';
                    answered++;
                } else {
                    row += '<td class="matrix-cell matrix-pending">\u2014</td>';
                }
            } else if (sub) {
                answered++;
                const content = sub.content || '';
                const tip = esc(name) + ': ' + esc(content.length > 60 ? content.slice(0, 60) + '...' : content);
                if (isCorrectTrue(sub.is_correct)) { correct++; graded++; row += '<td class="matrix-cell matrix-correct" title="' + tip + '" data-student="' + esc(email) + '" data-el="' + el.id + '">\u2713</td>'; }
                else if (isCorrectFalse(sub.is_correct)) { graded++; row += '<td class="matrix-cell matrix-wrong" title="' + tip + '" data-student="' + esc(email) + '" data-el="' + el.id + '">\u2717</td>'; }
                else { row += '<td class="matrix-cell matrix-voted" title="' + tip + '" data-student="' + esc(email) + '" data-el="' + el.id + '">\u2713</td>'; }
            } else { row += '<td class="matrix-cell matrix-pending">\u2014</td>'; }
        });
        const rate = graded > 0 ? Math.round(correct / graded * 100) + '%' : '-';
        row += '<td class="matrix-summary">' + answered + '/' + allEls.length + '<br>' + rate + '</td></tr>';
        tbody += row;
    });
    c.innerHTML = '<table class="dash-matrix"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';

    // 點擊儲存格 → 展開回答詳情
    c.querySelectorAll('.matrix-cell[data-student]').forEach(td => {
        td.style.cursor = 'pointer';
        td.addEventListener('click', () => {
            const studentEmail = td.dataset.student;
            const elId = td.dataset.el;
            showAnswerDetail(studentEmail, elId, allEls);
        });
    });
}

function showAnswerDetail(email, elId, allEls) {
    const name = studentNames[email] || email.split('@')[0];
    const el = allEls.find(e => e.id === elId);
    const sub = submissionsMap[elId] && submissionsMap[elId][email];
    const typeName = TYPE_LABELS[el?.type] || el?.type || '';

    let content = '';
    if (sub) {
        content = `
            <div class="detail-field"><label>\u985E\u578B</label><span>${esc(typeName)}</span></div>
            <div class="detail-field"><label>\u984C\u76EE</label><span>${esc(el?.title || sub.assignment_title || '')}</span></div>
            <div class="detail-field"><label>\u56DE\u7B54</label><div class="detail-answer">${esc(sub.content || '\uFF08\u7121\uFF09')}</div></div>
            ${sub.is_correct !== null ? '<div class="detail-field"><label>\u7D50\u679C</label><span class="' + (sub.is_correct ? 'detail-correct' : 'detail-wrong') + '">' + (sub.is_correct ? '\u2713 \u6B63\u78BA' : '\u2717 \u932F\u8AA4') + '</span></div>' : ''}
            ${sub.score != null ? '<div class="detail-field"><label>\u5206\u6578</label><span>' + sub.score + '</span></div>' : ''}
            <div class="detail-field"><label>\u6642\u9593</label><span>${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('zh-TW') : ''}</span></div>
        `;
    } else {
        // 嘗試查找 poll vote
        const votes = (pollVotesMap[elId] || []).filter(v => v.student_email === email);
        if (votes.length) {
            content = `
                <div class="detail-field"><label>\u985E\u578B</label><span>\u6295\u7968</span></div>
                <div class="detail-field"><label>\u984C\u76EE</label><span>${esc(el?.title || '')}</span></div>
                <div class="detail-field"><label>\u9078\u64C7</label><span>${votes.map(v => esc(v.option_text || v.option_index)).join(', ')}</span></div>
            `;
        } else {
            content = '<div class="detail-empty">\u7121\u56DE\u7B54\u7D00\u9304</div>';
        }
    }

    // 移除舊的
    document.querySelector('.dash-detail-popup')?.remove();

    const popup = document.createElement('div');
    popup.className = 'dash-detail-popup';
    popup.innerHTML = `
        <div class="detail-header">
            <span class="material-symbols-outlined" style="font-size:18px;">person</span>
            <strong>${esc(name)}</strong>
            <button class="detail-close"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="detail-body">${content}</div>
    `;
    document.getElementById('dashMatrix').appendChild(popup);
    popup.querySelector('.detail-close').addEventListener('click', () => popup.remove());
    // 點外關閉
    setTimeout(() => {
        const handler = (e) => { if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', handler); } };
        document.addEventListener('click', handler);
    }, 100);
}

// ── 場次比較（按題目 × 場次）──
async function renderCompareView() {
    const c = document.getElementById('dashCompare');
    c.innerHTML = '<div class="dash-loading"><div class="dash-spinner"></div><span>\u8F09\u5165\u4E2D...</span></div>';

    if (allSessions.length < 1) {
        c.innerHTML = '<div class="dash-empty"><span class="material-symbols-outlined">compare_arrows</span><p>\u7121\u5834\u6B21\u8CC7\u6599\u3002</p></div>';
        return;
    }

    const sessionData = [];
    for (const s of allSessions) {
        const code = s.session_code || s.join_code || '';
        if (!code) continue;
        try {
            const [subRes, pollRes, studRes] = await Promise.all([
                db.select('submissions', { select: 'id,element_id,student_email,content,is_correct,score,type,assignment_title,submitted_at', filter: { session_id: 'eq.' + code } }),
                db.select('poll_votes', { select: 'id,element_id,student_email,option_index,option_text,created_at', filter: { session_code: 'eq.' + code } }),
                db.select('students', { filter: { session_code: 'eq.' + code }, select: 'email' }),
            ]);
            sessionData.push({ code, date: s.date || code, status: s.status, studentCount: (studRes?.data || []).length, subs: subRes?.data || [], polls: pollRes?.data || [] });
        } catch (e) { console.warn('compare error:', code, e); }
    }

    if (!sessionData.length) {
        c.innerHTML = '<div class="dash-empty"><span class="material-symbols-outlined">compare_arrows</span><p>\u7121\u8CC7\u6599\u3002</p></div>';
        return;
    }

    // 收集所有互動元素
    const elementMap = new Map();
    getAllElements().forEach(el => elementMap.set(el.id, { type: el.type, title: el.title }));
    sessionData.forEach(sd => {
        sd.subs.forEach(sub => { if (sub.element_id && !elementMap.has(sub.element_id)) elementMap.set(sub.element_id, { type: sub.type || 'quiz', title: sub.assignment_title || '\u984C\u76EE' }); });
        sd.polls.forEach(pv => { if (pv.element_id && !elementMap.has(pv.element_id)) elementMap.set(pv.element_id, { type: 'poll', title: '\u6295\u7968' }); });
    });

    const elements = [...elementMap.entries()];
    if (!elements.length) {
        c.innerHTML = '<div class="dash-empty"><span class="material-symbols-outlined">compare_arrows</span><p>\u5C1A\u7121\u4E92\u52D5\u8CC7\u6599\u3002</p></div>';
        return;
    }

    // Header
    let thead = '<tr><th style="text-align:left;">\u984C\u76EE</th><th>\u985E\u578B</th>';
    sessionData.forEach(sd => {
        const cur = sd.code === currentSessionCode;
        thead += '<th' + (cur ? ' style="background:#eef4ff;"' : '') + '>' + esc(sd.date) + (sd.status === 'active' ? ' <span style="color:#16a34a;font-weight:700;font-size:0.6rem;">LIVE</span>' : '') + '<br><span style="font-weight:400;font-size:0.65rem;color:#8b949e;">' + sd.studentCount + '\u4EBA</span></th>';
    });
    thead += '</tr>';

    // Body
    let tbody = '';
    elements.forEach(([eid, info], idx) => {
        const short = info.title.length > 12 ? info.title.slice(0, 12) + '\u2026' : info.title;
        tbody += '<tr><td class="matrix-student-name" style="position:static;" title="' + esc(info.title) + '">' + (idx + 1) + '. ' + esc(short) + '</td>';
        tbody += '<td style="font-size:0.68rem;color:var(--dash-text-muted);">' + (TYPE_LABELS[info.type] || info.type) + '</td>';

        sessionData.forEach(sd => {
            const cur = sd.code === currentSessionCode;
            const bg = cur ? ' style="background:#f8fbff;"' : '';
            if (info.type === 'poll') {
                const votes = sd.polls.filter(v => v.element_id === eid);
                const pSubs = sd.subs.filter(s => s.element_id === eid);
                const voters = new Set([...votes.map(v => v.student_email), ...pSubs.map(s => s.student_email)].filter(Boolean)).size;
                if (voters > 0) {
                    const oc = {}; votes.forEach(v => { const k = '\u9078' + (v.option_index + 1); oc[k] = (oc[k] || 0) + 1; });
                    const top = Object.entries(oc).sort((a, b) => b[1] - a[1])[0];
                    tbody += '<td' + bg + '><span style="font-weight:600;">' + voters + '\u7968</span><br><span style="font-size:0.65rem;color:#8b949e;">' + (top ? top[0] + '(' + top[1] + ')' : '') + '</span></td>';
                } else { tbody += '<td' + bg + ' class="matrix-pending">-</td>'; }
            } else {
                const subs = sd.subs.filter(s => s.element_id === eid);
                if (subs.length > 0) {
                    let correct = 0, graded = 0;
                    subs.forEach(s => { if (isCorrectGraded(s.is_correct)) { graded++; if (isCorrectTrue(s.is_correct)) correct++; } });
                    if (graded > 0) {
                        const rate = Math.round(correct / graded * 100);
                        const clr = rate >= 80 ? 'var(--dash-success)' : rate >= 50 ? 'var(--dash-warning)' : 'var(--dash-danger)';
                        tbody += '<td' + bg + '><span style="font-weight:700;color:' + clr + ';">' + rate + '%</span><br><span style="font-size:0.65rem;color:#8b949e;">' + correct + '/' + graded + ' \u00B7 ' + subs.length + '\u4EBA</span></td>';
                    } else {
                        tbody += '<td' + bg + '><span style="font-weight:600;">' + subs.length + '\u4EBA</span><br><span style="font-size:0.65rem;color:#8b949e;">\u5DF2\u4F5C\u7B54</span></td>';
                    }
                } else { tbody += '<td' + bg + ' class="matrix-pending">-</td>'; }
            }
        });
        tbody += '</tr>';
    });

    // Summary row
    tbody += '<tr style="border-top:2px solid var(--dash-border);font-weight:700;"><td style="text-align:left;">\u6574\u9AD4</td><td></td>';
    sessionData.forEach(sd => {
        let correct = 0, graded = 0;
        sd.subs.forEach(s => { if (isCorrectGraded(s.is_correct)) { graded++; if (isCorrectTrue(s.is_correct)) correct++; } });
        const rate = graded > 0 ? Math.round(correct / graded * 100) + '%' : '-';
        const cur = sd.code === currentSessionCode;
        tbody += '<td' + (cur ? ' style="background:#f8fbff;"' : '') + '>' + rate + '<br><span style="font-weight:400;font-size:0.65rem;color:#8b949e;">' + sd.subs.length + '\u7B46</span></td>';
    });
    tbody += '</tr>';

    c.innerHTML = '<table class="dash-matrix"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
}

// ══════════════════════
//  Helpers
// ══════════════════════
function getAllElements() {
    const ids = new Set();
    const result = [];
    interactiveElements.forEach(el => { ids.add(el.id); result.push(el); });
    Object.keys(submissionsMap).forEach(eid => {
        if (ids.has(eid)) return; ids.add(eid);
        const f = Object.values(submissionsMap[eid])[0];
        if (f) result.push({ id: eid, type: f.type || 'quiz', title: f.assignment_title || '\u984C\u76EE', slideIndex: -1 });
    });
    Object.keys(pollVotesMap).forEach(eid => {
        if (ids.has(eid)) return; ids.add(eid);
        result.push({ id: eid, type: 'poll', title: '\u6295\u7968', slideIndex: -1 });
    });
    return result;
}

function updateStats() {
    const ge = id => document.getElementById(id);
    const total = onlineStudents.size;
    const interactions = interactiveElements.length || Object.keys(submissionsMap).length;
    let totalSubs = 0, totalCorrect = 0, totalAnswered = 0;
    Object.values(submissionsMap).forEach(byS => {
        Object.values(byS).forEach(s => {
            if (onlineStudents.has(s.student_email)) {
                totalAnswered++;
                if (isCorrectGraded(s.is_correct)) { totalSubs++; if (isCorrectTrue(s.is_correct)) totalCorrect++; }
            }
        });
    });
    const rate = totalSubs > 0 ? Math.round(totalCorrect / totalSubs * 100) : 0;
    if (ge('statStudents')) ge('statStudents').textContent = total;
    if (ge('statInteractions')) ge('statInteractions').textContent = interactions;
    if (ge('statCorrectRate')) ge('statCorrectRate').textContent = rate + '%';
    if (ge('statAnswered')) ge('statAnswered').textContent = totalAnswered;
}

function updateHeaderMeta() {
    const el = document.getElementById('dashStudentCount');
    if (el) el.textContent = onlineStudents.size + ' \u4EBA\u5728\u7DDA';
    const t = document.getElementById('dashLastUpdate');
    if (t && lastFetchTime) {
        const d = new Date(lastFetchTime);
        t.textContent = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }
}

function renderLoading() {
    document.getElementById('dashCards').innerHTML = '<div class="dash-loading"><div class="dash-spinner"></div><span>\u8F09\u5165\u4E2D...</span></div>';
}

function renderError(msg) {
    document.getElementById('dashCards').innerHTML = '<div class="dash-empty"><span class="material-symbols-outlined">error_outline</span><p>' + msg + '</p></div>';
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 學員軌跡檢視 ──
function renderTrailView() {
    const wrap = document.getElementById('dashTrail');
    if (!wrap) return;

    // 合併 submissions + poll_votes 為統一列表
    const allItems = [];
    rawSubmissions.forEach(s => {
        allItems.push({
            name: s.student_name || '匿名',
            email: s.student_email || '',
            type: s.type || s.assignment_title || 'unknown',
            title: s.assignment_title || '',
            content: s.content || '',
            answer: s.content || '',
            isCorrect: s.is_correct,
            time: s.submitted_at || s.created_at || '',
            state: typeof s.state === 'string' ? (() => { try { return JSON.parse(s.state); } catch { return s.state; } })() : (s.state || {}),
            elementId: s.element_id || ''
        });
    });
    // poll votes
    Object.values(pollVotesMap).flat().forEach(v => {
        allItems.push({
            name: v.student_name || '匿名',
            email: v.student_email || '',
            type: 'poll',
            title: '投票',
            content: v.option_text || `選項 ${v.option_index + 1}`,
            answer: v.option_text || '',
            isCorrect: null,
            time: v.created_at || '',
            state: {},
            elementId: v.element_id || ''
        });
    });

    // group by student name
    const byStudent = {};
    allItems.forEach(item => {
        const key = item.name || item.email || '匿名';
        if (!byStudent[key]) byStudent[key] = [];
        byStudent[key].push(item);
    });
    // sort each student's items by time
    Object.values(byStudent).forEach(arr => arr.sort((a, b) => new Date(a.time) - new Date(b.time)));

    const students = Object.keys(byStudent).sort();

    if (students.length === 0) {
        wrap.innerHTML = '<div class="dash-empty"><span class="material-symbols-outlined">pending_actions</span><p>目前沒有學員互動紀錄。</p></div>';
        return;
    }

    const typeIcons = {
        quiz: 'quiz', poll: 'how_to_vote', truefalse: 'check_circle', opentext: 'chat',
        scale: 'linear_scale', buzzer: 'notifications_active', wordcloud: 'cloud',
        hotspot: 'my_location', matching: 'drag_indicator', ordering: 'format_list_numbered',
        fillblank: 'edit_note', homework: 'assignment', copycard: 'content_copy',
        qa: 'help_outline', survey: 'rate_review', document: 'description', showcase: 'collections'
    };
    const typeLabels = {
        quiz: '選擇題', poll: '投票', truefalse: '是非題', opentext: '開放問答',
        scale: '量表', buzzer: '搶答', wordcloud: '文字雲', hotspot: '圖片標註',
        matching: '連連看', ordering: '排列', fillblank: '填空', homework: '作業',
        copycard: '複製卡', qa: 'Q&A 提問', survey: '問卷', document: '文件', showcase: '展示'
    };

    const formatTime = (t) => {
        if (!t) return '';
        const d = new Date(t);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    };

    const correctBadge = (v) => {
        if (isCorrectTrue(v)) return '<span style="color:#16a34a;font-weight:600;">✓ 正確</span>';
        if (isCorrectFalse(v)) return '<span style="color:#dc2626;font-weight:600;">✗ 錯誤</span>';
        return '';
    };

    const contentPreview = (item) => {
        let c = item.content || item.answer || '';
        if (typeof c === 'object') c = JSON.stringify(c);
        // copycard variables
        if (item.type === 'copycard' && item.state?.variables) {
            const vars = Object.entries(item.state.variables).map(([k, v]) => `${k}: ${v}`).join('、');
            return esc(vars || c).slice(0, 120);
        }
        if (c.startsWith('data:image')) return '(圖片)';
        if (c.startsWith('http')) return `<a href="${esc(c)}" target="_blank" style="color:#6366f1;">${esc(c.slice(0, 60))}</a>`;
        return esc(c).slice(0, 120);
    };

    wrap.innerHTML = students.map(name => {
        const items = byStudent[name];
        const count = items.length;
        return `
            <div class="trail-student" style="margin-bottom:12px;">
                <div class="trail-student-header" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:12px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;font-weight:600;font-size:14px;">
                    <span class="material-symbols-outlined" style="font-size:18px;color:#6366f1;">person</span>
                    <span style="flex:1;">${esc(name)}</span>
                    <span style="background:#f1f5f9;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:500;color:#475569;">${count} 筆</span>
                    <span class="material-symbols-outlined trail-arrow" style="font-size:16px;color:#94a3b8;transition:transform 0.2s;">expand_more</span>
                </div>
                <div class="trail-items" style="display:none;padding:8px 0 0 28px;border-left:2px solid #e2e8f0;margin-left:24px;">
                    ${items.map(item => {
            const icon = typeIcons[item.type] || 'circle';
            const label = typeLabels[item.type] || item.type;
            return `
                            <div style="position:relative;padding:8px 12px;margin-bottom:6px;background:#fafbfc;border-radius:8px;font-size:13px;border:1px solid #f0f0f0;">
                                <div style="position:absolute;left:-22px;top:12px;width:10px;height:10px;border-radius:50%;background:#e2e8f0;border:2px solid #fff;"></div>
                                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                                    <span class="material-symbols-outlined" style="font-size:14px;color:#6366f1;">${icon}</span>
                                    <span style="font-weight:600;color:#334155;">${esc(label)}</span>
                                    ${item.title && item.title !== label ? `<span style="color:#94a3b8;font-size:12px;">— ${esc(item.title)}</span>` : ''}
                                    <span style="margin-left:auto;color:#94a3b8;font-size:11px;">${formatTime(item.time)}</span>
                                </div>
                                <div style="color:#475569;line-height:1.5;">
                                    ${contentPreview(item)}
                                    ${correctBadge(item.isCorrect)}
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }).join('');

    // Toggle open/close
    wrap.querySelectorAll('.trail-student-header').forEach(h => {
        h.addEventListener('click', () => {
            const parent = h.parentElement;
            const items = parent.querySelector('.trail-items');
            const arrow = h.querySelector('.trail-arrow');
            const isOpen = parent.classList.contains('open');
            items.style.display = isOpen ? 'none' : 'block';
            arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
        });
    });
}

document.addEventListener('DOMContentLoaded', () => init());
