/**
 * sessionReportPDF.js — 精美學員互動成效報告（PDF 匯出）
 * 
 * 用法：
 *   import { exportSessionReport } from './scripts/sessionReportPDF.js';
 *   exportSessionReport(sessionId, projectName, sessionMeta);
 */
import { db } from './supabase.js';

const TYPE_LABELS = {
    quiz: '選擇題', poll: '投票', truefalse: '是非題', opentext: '開放問答',
    scale: '量表', buzzer: '搶答', wordcloud: '文字雲', hotspot: '圖片標註',
    matching: '連連看', ordering: '排列', fillblank: '填空', homework: '作業',
    copycard: '複製卡', livetap: '即時點擊', image: '圖片上傳'
};

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTime(t) {
    if (!t) return '';
    return new Date(t).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

function fmtTimeShort(t) {
    if (!t) return '';
    return new Date(t).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' });
}

function getSessionDateRange(sess) {
    if (!sess.date) return null;
    try {
        const d = new Date(sess.date + 'T00:00:00+08:00');
        if (isNaN(d.getTime())) return null;
        return { start: d, end: new Date(d.getTime() + 86400000) };
    } catch { return null; }
}

function filterByDateRange(records, range, field = 'submitted_at') {
    if (!range) return records;
    return records.filter(r => {
        const t = r[field] ? new Date(r[field]) : null;
        return t && t >= range.start && t < range.end;
    });
}

// ══════════════════════════════════════
// 資料收集（復用 sessionExport 邏輯）
// ══════════════════════════════════════

async function collectReportData(sessionId) {
    const { data: sessRows } = await db.select('project_sessions', {
        filter: { id: `eq.${sessionId}` }, limit: 1
    });
    const sess = sessRows?.[0] || {};
    const sessionCode = sess.session_code || '';
    const sessionUUID = sess.id || sessionId;
    const dateRange = getSessionDateRange(sess);

    // 專案資訊
    let projectName = '';
    let joinCode = '';
    if (sess.project_id) {
        try {
            const { data: projRows } = await db.select('projects', {
                filter: { id: `eq.${sess.project_id}` }, select: 'name,join_code', limit: 1
            });
            projectName = projRows?.[0]?.name || '';
            joinCode = projRows?.[0]?.join_code || '';
        } catch { }
    }

    // 學員
    const { data: studentsRaw } = await db.select('students', {
        filter: { session_code: `eq.${sessionCode}` },
        select: 'name,email,company,created_at'
    });
    const students = studentsRaw || [];

    // Submissions（多 key 合併）
    const subKeys = [...new Set([sessionUUID, sessionCode, joinCode].filter(Boolean))];
    const subMap = new Map();
    for (const key of subKeys) {
        const { data: rows } = await db.select('submissions', {
            filter: { session_id: `eq.${key}` }, order: 'submitted_at.asc', limit: 5000
        });
        let candidates = filterByDateRange(rows || [], dateRange, 'submitted_at');
        for (const s of candidates) {
            if (s.id && !subMap.has(s.id)) subMap.set(s.id, s);
        }
    }
    const submissions = [...subMap.values()].sort((a, b) => (a.submitted_at || '').localeCompare(b.submitted_at || ''));

    // Polls（多 key 合併）
    const pollMap = new Map();
    for (const key of subKeys) {
        const { data: rows } = await db.select('poll_votes', {
            filter: { session_code: `eq.${key}` }, order: 'created_at.asc', limit: 5000
        });
        let candidates = filterByDateRange(rows || [], dateRange, 'created_at');
        for (const p of candidates) {
            if (p.id && !pollMap.has(p.id)) pollMap.set(p.id, p);
        }
    }
    const polls = [...pollMap.values()].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

    return { sess, projectName, students, submissions, polls };
}

// ══════════════════════════════════════
// HTML 報告生成
// ══════════════════════════════════════

function buildReport({ sess, projectName, students, submissions, polls }) {
    const date = sess.date || '';
    const venue = sess.venue || '';
    const time = sess.time || '';

    // ── 統計 ──
    const uniqueStudents = new Set();
    submissions.forEach(s => uniqueStudents.add(s.student_email || s.student_name));
    polls.forEach(p => uniqueStudents.add(p.student_email));
    students.forEach(s => uniqueStudents.add(s.email));

    // 題目統計
    const byElement = {};
    submissions.forEach(s => {
        const eid = s.element_id || s.assignment_title || 'unknown';
        if (!byElement[eid]) byElement[eid] = {
            title: s.assignment_title || '', type: s.type || '',
            correct: 0, wrong: 0, total: 0, participants: new Set()
        };
        const g = byElement[eid];
        g.total++;
        g.participants.add(s.student_email || s.student_name);
        if (s.is_correct === true || s.is_correct === 'true') g.correct++;
        else if (s.is_correct === false || s.is_correct === 'false') g.wrong++;
    });

    const overallCorrect = submissions.filter(s => s.is_correct === true || s.is_correct === 'true').length;
    const overallGraded = submissions.filter(s => s.is_correct !== null && s.is_correct !== undefined && s.is_correct !== '').length;
    const overallRate = overallGraded > 0 ? Math.round(overallCorrect / overallGraded * 100) : null;
    const totalInteractions = Object.keys(byElement).length;

    // 學員排行
    const studentScores = {};
    submissions.forEach(s => {
        const key = s.student_name || s.student_email || '匿名';
        if (!studentScores[key]) studentScores[key] = { correct: 0, total: 0, email: s.student_email || '', totalAwarded: 0 };
        studentScores[key].total++;
        if (s.is_correct === true || s.is_correct === 'true') studentScores[key].correct++;
        let st = s.state;
        if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
        studentScores[key].totalAwarded += parseFloat(st?._awarded) || 0;
    });
    const ranked = Object.entries(studentScores)
        .map(([name, d]) => ({ name, ...d, rate: d.total > 0 ? Math.round(d.correct / d.total * 100) : 0 }))
        .sort((a, b) => b.totalAwarded - a.totalAwarded || b.rate - a.rate || b.correct - a.correct);

    // 投票
    const pollSummary = {};
    polls.forEach(p => {
        const eid = p.element_id || 'poll';
        if (!pollSummary[eid]) pollSummary[eid] = { options: {}, voters: new Set(), question: '' };
        const label = p.option_text || `選項 ${(p.option_index || 0) + 1}`;
        pollSummary[eid].options[label] = (pollSummary[eid].options[label] || 0) + 1;
        pollSummary[eid].voters.add(p.student_email);
    });

    // ── 頁面生成 ──
    const pages = [];

    // ====== 封面 ======
    pages.push(`
    <div class="page cover-page">
        <div class="cover-accent"></div>
        <div class="cover-content">
            <div class="cover-badge">📊 學員互動成效報告</div>
            <h1 class="cover-title">${esc(projectName || '課程互動報告')}</h1>
            <div class="cover-meta">
                ${[date, time, venue].filter(Boolean).map(m => `<span>${esc(m)}</span>`).join('<span class="cover-dot">·</span>')}
            </div>
            <div class="cover-stats">
                <div class="cover-stat"><div class="cover-stat-value">${uniqueStudents.size}</div><div class="cover-stat-label">參與學員</div></div>
                <div class="cover-stat"><div class="cover-stat-value">${totalInteractions}</div><div class="cover-stat-label">互動題數</div></div>
                <div class="cover-stat"><div class="cover-stat-value">${submissions.length}</div><div class="cover-stat-label">作答紀錄</div></div>
                <div class="cover-stat"><div class="cover-stat-value">${overallRate !== null ? overallRate + '%' : '—'}</div><div class="cover-stat-label">整體正答率</div></div>
            </div>
        </div>
        <div class="cover-footer">
            <div class="brand">數位簡報室 The Briefing Room</div>
            <div class="gen-time">報告產出：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</div>
        </div>
    </div>`);

    // ====== 題目分析 ======
    const elements = Object.entries(byElement);
    if (elements.length > 0) {
        // 每頁最多 6 題
        for (let i = 0; i < elements.length; i += 6) {
            const chunk = elements.slice(i, i + 6);
            let rows = '';
            chunk.forEach(([, g]) => {
                const graded = g.correct + g.wrong;
                const rate = graded > 0 ? Math.round(g.correct / graded * 100) : null;
                const barColor = rate === null ? '#e2e8f0' : rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444';
                rows += `
                <div class="q-row">
                    <div class="q-info">
                        <span class="q-type">${esc(TYPE_LABELS[g.type] || g.type)}</span>
                        <span class="q-title">${esc(g.title || '—')}</span>
                    </div>
                    <div class="q-stats">
                        <span class="q-participants">${g.participants.size} 人</span>
                        ${rate !== null ? `
                        <div class="q-bar-wrap">
                            <div class="q-bar" style="width:${rate}%;background:${barColor}"></div>
                        </div>
                        <span class="q-rate" style="color:${barColor}">${rate}%</span>
                        ` : '<span class="q-rate" style="color:#94a3b8">—</span>'}
                    </div>
                </div>`;
            });

            pages.push(`
            <div class="page">
                <div class="page-header">
                    <h2>📋 互動題目分析${elements.length > 6 ? ` (${i + 1}-${Math.min(i + 6, elements.length)} / ${elements.length})` : ''}</h2>
                    <div class="page-num">${pages.length + 1}</div>
                </div>
                <div class="q-list">${rows}</div>
                <div class="page-footer"><span>數位簡報室 The Briefing Room</span></div>
            </div>`);
        }
    }

    // ====== 投票結果 ======
    const pollEntries = Object.entries(pollSummary);
    if (pollEntries.length > 0) {
        let pollHtml = '';
        pollEntries.forEach(([, g]) => {
            const total = Object.values(g.options).reduce((a, b) => a + b, 0);
            const sorted = Object.entries(g.options).sort((a, b) => b[1] - a[1]);
            const maxCount = sorted[0]?.[1] || 1;
            let optionsHtml = sorted.map(([label, count]) => {
                const pct = Math.round(count / total * 100);
                const barW = Math.round(count / maxCount * 100);
                return `
                <div class="poll-row">
                    <div class="poll-label">${esc(label)}</div>
                    <div class="poll-bar-wrap"><div class="poll-bar" style="width:${barW}%"></div></div>
                    <div class="poll-count">${count} 票 (${pct}%)</div>
                </div>`;
            }).join('');
            pollHtml += `
            <div class="poll-card">
                <div class="poll-header">${g.voters.size} 人參與投票</div>
                ${optionsHtml}
            </div>`;
        });

        pages.push(`
        <div class="page">
            <div class="page-header">
                <h2>🗳️ 投票結果</h2>
                <div class="page-num">${pages.length + 1}</div>
            </div>
            ${pollHtml}
            <div class="page-footer"><span>數位簡報室 The Briefing Room</span></div>
        </div>`);
    }

    // ====== 學員排行榜 ======
    if (ranked.length > 0) {
        const top = ranked.slice(0, 15);
        const maxScore = top[0]?.totalAwarded || top[0]?.correct || 1;
        let rankRows = top.map((r, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span class="rank-num">${i + 1}</span>`;
            const score = r.totalAwarded > 0 ? r.totalAwarded : r.correct;
            const barW = Math.round(score / maxScore * 100);
            return `
            <div class="rank-row ${i < 3 ? 'rank-top' : ''}">
                <div class="rank-medal">${medal}</div>
                <div class="rank-name">${esc(r.name)}</div>
                <div class="rank-bar-wrap"><div class="rank-bar" style="width:${barW}%"></div></div>
                <div class="rank-score">${r.totalAwarded > 0 ? r.totalAwarded + ' 分' : r.correct + '/' + r.total}</div>
                <div class="rank-rate">${r.rate}%</div>
            </div>`;
        }).join('');

        pages.push(`
        <div class="page">
            <div class="page-header">
                <h2>🏆 學員排行榜</h2>
                <div class="page-num">${pages.length + 1}</div>
            </div>
            <div class="rank-list">${rankRows}</div>
            <div class="page-footer"><span>數位簡報室 The Briefing Room</span></div>
        </div>`);
    }

    // ====== 個別學員互動 ======
    const studentMap = new Map();
    students.forEach(s => studentMap.set(s.email, s.name));
    submissions.forEach(s => {
        const key = s.student_email || s.student_name;
        if (key && !studentMap.has(key)) studentMap.set(key, s.student_name || key);
    });

    // 每頁放 2 位學員
    const studentEntries = [...studentMap.entries()].filter(([email]) => {
        const subs = submissions.filter(s => (s.student_email || s.student_name) === email);
        const pVotes = polls.filter(p => p.student_email === email);
        return subs.length > 0 || pVotes.length > 0;
    });

    for (let i = 0; i < studentEntries.length; i += 2) {
        const chunk = studentEntries.slice(i, i + 2);
        let cardsHtml = chunk.map(([email, name]) => {
            const subs = submissions.filter(s => (s.student_email || s.student_name) === email);
            const pVotes = polls.filter(p => p.student_email === email);

            let totalScore = 0;
            subs.forEach(s => {
                let st = s.state;
                if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
                totalScore += parseFloat(st?._awarded) || 0;
            });

            const correct = subs.filter(s => s.is_correct === true || s.is_correct === 'true').length;
            const graded = subs.filter(s => s.is_correct !== null && s.is_correct !== undefined && s.is_correct !== '').length;
            const rate = graded > 0 ? Math.round(correct / graded * 100) : null;

            // 初始字母
            const initial = (name || '?').charAt(0).toUpperCase();
            const colors = ['#6366f1', '#0284c7', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#ea580c'];
            const color = colors[Math.abs(hashCode(email || name)) % colors.length];

            // 互動明細（最多 8 筆）
            let detailRows = subs.slice(0, 8).map(s => {
                const typeLabel = TYPE_LABELS[s.type] || s.type || '';
                const icon = s.is_correct === true || s.is_correct === 'true' ? '✅'
                    : s.is_correct === false || s.is_correct === 'false' ? '❌' : '';
                let content = s.content || '';
                if (content.length > 60) content = content.slice(0, 60) + '…';
                // Check for image
                let hasImage = false;
                try { const p = JSON.parse(s.content); if (p?.image) hasImage = true; } catch { }
                if (s.file_url && /\.(jpg|jpeg|png|gif|webp)/i.test(s.file_url)) hasImage = true;

                return `
                <div class="detail-row">
                    <span class="detail-type">${esc(typeLabel)}</span>
                    <span class="detail-title">${esc(s.assignment_title || '')} ${icon}</span>
                    ${hasImage ? '<span class="detail-img">🖼️</span>' : ''}
                    <span class="detail-time">${fmtTimeShort(s.submitted_at)}</span>
                </div>`;
            }).join('');

            if (subs.length > 8) {
                detailRows += `<div class="detail-more">⋯ 另有 ${subs.length - 8} 筆互動</div>`;
            }

            // 投票
            if (pVotes.length > 0) {
                detailRows += pVotes.slice(0, 3).map(p =>
                    `<div class="detail-row"><span class="detail-type detail-type-poll">投票</span><span class="detail-title">${esc(p.option_text || '')}</span><span class="detail-time">${fmtTimeShort(p.created_at)}</span></div>`
                ).join('');
            }

            return `
            <div class="student-card">
                <div class="student-header">
                    <div class="student-avatar" style="background:${color}">${esc(initial)}</div>
                    <div class="student-info">
                        <div class="student-name">${esc(name)}</div>
                        <div class="student-meta">
                            互動 ${subs.length} 次${pVotes.length > 0 ? ` · 投票 ${pVotes.length} 次` : ''}${totalScore > 0 ? ` · 累計 ${totalScore} 分` : ''}${rate !== null ? ` · 正答率 ${rate}%` : ''}
                        </div>
                    </div>
                    ${totalScore > 0 ? `<div class="student-score">${totalScore}<small>分</small></div>` : ''}
                </div>
                <div class="student-details">${detailRows}</div>
            </div>`;
        }).join('');

        pages.push(`
        <div class="page">
            <div class="page-header">
                <h2>👤 學員互動清單 (${i + 1}-${Math.min(i + 2, studentEntries.length)} / ${studentEntries.length})</h2>
                <div class="page-num">${pages.length + 1}</div>
            </div>
            <div class="student-grid">${cardsHtml}</div>
            <div class="page-footer"><span>數位簡報室 The Briefing Room</span></div>
        </div>`);
    }

    // ====== 結尾頁 ======
    pages.push(`
    <div class="page end-page">
        <div class="end-content">
            <div class="end-icon">✨</div>
            <h2 class="end-title">感謝參與本次課程</h2>
            <p class="end-subtitle">${esc(projectName || '')}</p>
            <div class="end-stats">
                <span>${uniqueStudents.size} 位學員</span>
                <span>·</span>
                <span>${submissions.length} 次互動</span>
                <span>·</span>
                <span>${polls.length} 票投票</span>
            </div>
            <div class="end-brand">
                <div class="end-brand-name">數位簡報室</div>
                <div class="end-brand-en">The Briefing Room</div>
            </div>
        </div>
    </div>`);

    return buildFullHTML(pages, projectName);
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

function buildFullHTML(pages, title) {
    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — 學員互動成效報告</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
/* ── Reset ── */
*{margin:0;padding:0;box-sizing:border-box}

/* ── Page Setup ── */
@page{size:A4 landscape;margin:0}
body{
    font-family:'Noto Sans TC','Inter',-apple-system,BlinkMacSystemFont,sans-serif;
    background:#f0f2f5;
    color:#1e293b;
    line-height:1.5;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
}

.page{
    width:297mm;height:210mm;
    padding:28px 40px;
    background:#fff;
    position:relative;
    overflow:hidden;
    page-break-after:always;
    margin:0 auto 20px;
    box-shadow:0 4px 24px rgba(0,0,0,.08);
}
@media print{
    body{background:#fff}
    .page{box-shadow:none;margin:0}
    .toolbar{display:none!important}
}

/* ── 封面 ── */
.cover-page{
    background:linear-gradient(145deg,#0f172a 0%,#1e3a5f 40%,#1e293b 100%);
    color:#f1f5f9;
    display:flex;flex-direction:column;justify-content:center;
    padding:0;
}
.cover-accent{
    position:absolute;top:0;right:0;width:45%;height:100%;
    background:linear-gradient(135deg,rgba(99,102,241,.15) 0%,rgba(56,189,248,.08) 100%);
    clip-path:polygon(20% 0,100% 0,100% 100%,0% 100%);
}
.cover-content{padding:60px 80px;position:relative;z-index:1}
.cover-badge{
    display:inline-block;padding:6px 18px;
    background:rgba(99,102,241,.2);border:1px solid rgba(99,102,241,.3);
    border-radius:20px;font-size:14px;font-weight:600;color:#a5b4fc;
    letter-spacing:.5px;margin-bottom:24px;
}
.cover-title{
    font-size:42px;font-weight:900;line-height:1.3;
    letter-spacing:-0.5px;margin-bottom:16px;
    background:linear-gradient(135deg,#f1f5f9 0%,#e2e8f0 100%);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;
    background-clip:text;
}
.cover-meta{font-size:16px;color:#94a3b8;margin-bottom:48px;display:flex;gap:8px;align-items:center}
.cover-dot{color:#475569}
.cover-stats{
    display:flex;gap:24px;
}
.cover-stat{
    background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);
    border-radius:16px;padding:20px 28px;min-width:130px;text-align:center;
    backdrop-filter:blur(8px);
}
.cover-stat-value{font-size:36px;font-weight:900;color:#f1f5f9;font-family:'Inter',sans-serif}
.cover-stat-label{font-size:12px;color:#94a3b8;font-weight:500;margin-top:4px;letter-spacing:.5px}
.cover-footer{
    position:absolute;bottom:32px;left:80px;right:80px;
    display:flex;justify-content:space-between;align-items:center;
    font-size:12px;color:#475569;
}
.brand{font-weight:700;letter-spacing:.5px}

/* ── 共用頁面元素 ── */
.page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #e2e8f0}
.page-header h2{font-size:20px;font-weight:800;color:#1e293b;display:flex;align-items:center;gap:8px}
.page-num{font-size:12px;color:#94a3b8;font-weight:600;background:#f1f5f9;padding:4px 12px;border-radius:12px}
.page-footer{position:absolute;bottom:20px;left:40px;right:40px;text-align:center;font-size:10px;color:#cbd5e1;border-top:1px solid #f1f5f9;padding-top:8px}

/* ── 題目分析 ── */
.q-list{display:flex;flex-direction:column;gap:10px}
.q-row{
    display:flex;align-items:center;justify-content:space-between;
    padding:14px 20px;background:#f8fafc;border-radius:12px;
    border:1px solid #e2e8f0;
}
.q-info{display:flex;align-items:center;gap:12px;flex:1;min-width:0}
.q-type{
    display:inline-block;padding:3px 10px;border-radius:8px;
    font-size:11px;font-weight:700;background:#eff6ff;color:#2563eb;
    white-space:nowrap;
}
.q-title{font-size:14px;font-weight:600;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.q-stats{display:flex;align-items:center;gap:12px;flex-shrink:0}
.q-participants{font-size:12px;color:#64748b;min-width:40px;text-align:right}
.q-bar-wrap{width:120px;height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden}
.q-bar{height:100%;border-radius:5px;transition:width .3s}
.q-rate{font-size:14px;font-weight:800;min-width:40px;text-align:right;font-family:'Inter',sans-serif}

/* ── 投票 ── */
.poll-card{background:#f8fafc;border-radius:16px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0}
.poll-header{font-size:14px;font-weight:700;color:#334155;margin-bottom:16px}
.poll-row{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.poll-label{font-size:13px;font-weight:500;color:#475569;min-width:120px;text-align:right}
.poll-bar-wrap{flex:1;height:24px;background:#e2e8f0;border-radius:8px;overflow:hidden}
.poll-bar{height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:8px}
.poll-count{font-size:12px;color:#64748b;min-width:80px;font-family:'Inter',sans-serif}

/* ── 排行榜 ── */
.rank-list{display:flex;flex-direction:column;gap:8px}
.rank-row{
    display:flex;align-items:center;gap:12px;
    padding:12px 20px;background:#f8fafc;border-radius:12px;
    border:1px solid #e2e8f0;
}
.rank-top{background:linear-gradient(135deg,#faf5ff 0%,#f0f9ff 100%);border-color:#c4b5fd}
.rank-medal{font-size:20px;min-width:32px;text-align:center}
.rank-num{font-size:14px;font-weight:800;color:#94a3b8;font-family:'Inter',sans-serif}
.rank-name{font-size:14px;font-weight:700;color:#1e293b;min-width:100px}
.rank-bar-wrap{flex:1;height:12px;background:#e2e8f0;border-radius:6px;overflow:hidden}
.rank-bar{height:100%;background:linear-gradient(90deg,#6366f1,#a78bfa);border-radius:6px}
.rank-score{font-size:13px;font-weight:700;color:#6366f1;min-width:60px;text-align:right;font-family:'Inter',sans-serif}
.rank-rate{font-size:12px;color:#64748b;min-width:40px;text-align:right}

/* ── 學員互動 ── */
.student-grid{display:flex;flex-direction:column;gap:16px}
.student-card{background:#f8fafc;border-radius:16px;padding:20px;border:1px solid #e2e8f0}
.student-header{display:flex;align-items:center;gap:14px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e2e8f0}
.student-avatar{
    width:44px;height:44px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    color:#fff;font-weight:800;font-size:18px;flex-shrink:0;
}
.student-info{flex:1;min-width:0}
.student-name{font-size:15px;font-weight:700;color:#1e293b}
.student-meta{font-size:11px;color:#64748b;margin-top:2px}
.student-score{font-size:24px;font-weight:900;color:#6366f1;font-family:'Inter',sans-serif;display:flex;align-items:baseline;gap:2px}
.student-score small{font-size:11px;color:#94a3b8;font-weight:500}
.student-details{display:flex;flex-direction:column;gap:4px}
.detail-row{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px}
.detail-type{
    display:inline-block;padding:1px 8px;border-radius:6px;
    font-size:10px;font-weight:700;background:#eff6ff;color:#2563eb;
    white-space:nowrap;
}
.detail-type-poll{background:#fef3c7;color:#92400e}
.detail-title{flex:1;color:#334155;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.detail-img{font-size:12px}
.detail-time{color:#94a3b8;font-size:11px;font-family:'Inter',sans-serif}
.detail-more{font-size:11px;color:#94a3b8;text-align:center;padding:4px 0}

/* ── 結尾 ── */
.end-page{
    background:linear-gradient(145deg,#0f172a 0%,#1e3a5f 40%,#1e293b 100%);
    color:#f1f5f9;
    display:flex;align-items:center;justify-content:center;
    text-align:center;
}
.end-content{position:relative;z-index:1}
.end-icon{font-size:64px;margin-bottom:24px}
.end-title{font-size:36px;font-weight:900;margin-bottom:12px}
.end-subtitle{font-size:18px;color:#94a3b8;margin-bottom:32px}
.end-stats{display:flex;gap:16px;justify-content:center;font-size:14px;color:#64748b;margin-bottom:48px}
.end-brand-name{font-size:20px;font-weight:800;color:#a5b4fc;letter-spacing:1px}
.end-brand-en{font-size:12px;color:#64748b;margin-top:4px;letter-spacing:2px}

/* ── 工具列 ── */
.toolbar{
    position:fixed;top:20px;right:20px;z-index:1000;
    display:flex;gap:8px;
}
.toolbar button{
    padding:10px 20px;border:none;border-radius:10px;
    font-size:14px;font-weight:700;cursor:pointer;
    font-family:'Noto Sans TC',sans-serif;
    transition:all .2s;
}
.btn-pdf{background:#6366f1;color:#fff;box-shadow:0 4px 12px rgba(99,102,241,.3)}
.btn-pdf:hover{background:#4f46e5;transform:translateY(-1px)}
.btn-print{background:#fff;color:#334155;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.btn-print:hover{background:#f8fafc}
</style>
</head>
<body>

<div class="toolbar">
    <button class="btn-pdf" onclick="downloadPDF()">⬇ 下載 PDF</button>
    <button class="btn-print" onclick="window.print()">🖨️ 列印</button>
</div>

${pages.join('\n')}

<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js"></script>
<script>
function downloadPDF() {
    const btn = document.querySelector('.btn-pdf');
    btn.textContent = '⏳ 產生中…';
    btn.disabled = true;

    const toolbar = document.querySelector('.toolbar');
    toolbar.style.display = 'none';

    const opt = {
        margin: 0,
        filename: '${esc(title)}_學員互動報告.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['css'] }
    };

    html2pdf().set(opt).from(document.body).save().then(() => {
        toolbar.style.display = 'flex';
        btn.textContent = '⬇ 下載 PDF';
        btn.disabled = false;
    });
}
</script>
</body>
</html>`;
}

// ══════════════════════════════════════
// 匯出入口
// ══════════════════════════════════════

export async function exportSessionReport(sessionId, projectName, sessionMeta) {
    const btn = document.querySelector(`[data-report-sid="${sessionId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = '產出中…'; }

    try {
        const data = await collectReportData(sessionId);
        if (projectName) data.projectName = projectName;
        const html = buildReport(data);

        // 開新視窗
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();

    } catch (e) {
        console.error('[Report] error:', e);
        alert('報告產出失敗：' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '📊 報告'; }
    }
}
