/**
 * sessionExport.js — 場次學員資料匯出模組
 * 匯出 ZIP：多份 CSV + HTML 視覺化報告
 */
import { db } from './supabase.js';

const BOM = '\uFEFF';
const TYPE_LABELS = {
    quiz: '選擇題', poll: '投票', truefalse: '是非題', opentext: '開放問答',
    scale: '量表', buzzer: '搶答', wordcloud: '文字雲', hotspot: '圖片標註',
    matching: '連連看', ordering: '排列', fillblank: '填空', homework: '作業',
    copycard: '複製卡', livetap: '即時點擊', image: '圖片上傳'
};

function csvEscape(val) {
    if (val == null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function csvRow(arr) { return arr.map(csvEscape).join(','); }

function toCSV(headers, rows) {
    return BOM + csvRow(headers) + '\n' + rows.map(r => csvRow(r)).join('\n');
}

function fmtTime(t) {
    if (!t) return '';
    return new Date(t).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

// ── 主匯出函數 ──
export async function exportSession(sessionId, projectName, sessionMeta) {
    const btn = document.querySelector(`[data-export-sid="${sessionId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = '匯出中…'; }

    try {
        // 取得 session 資訊
        const { data: sessRows } = await db.select('project_sessions', {
            filter: { id: `eq.${sessionId}` }, limit: 1
        });
        const sess = sessRows?.[0] || sessionMeta || {};
        const sessionCode = sess.session_code || '';
        const sessionUUID = sess.id || sessionId; // submissions 用 UUID 查

        // 1. 學員名冊（students 用 session_code 存）
        const { data: studentsRaw } = await db.select('students', {
            filter: { session_code: `eq.${sessionCode}` },
            select: 'name,email,company,created_at'
        });
        const students = studentsRaw || [];

        // 2. 作答紀錄 (submissions) — session_id 存的是 UUID
        const { data: subsRaw } = await db.select('submissions', {
            filter: { session_id: `eq.${sessionUUID}` },
            order: 'submitted_at.asc'
        });
        let submissions = subsRaw || [];

        // fallback: 如果 UUID 查不到，用 session_code 再查一次（相容舊資料）
        if (submissions.length === 0 && sessionCode) {
            const { data: subsFallback } = await db.select('submissions', {
                filter: { session_id: `eq.${sessionCode}` },
                order: 'submitted_at.asc'
            });
            submissions = subsFallback || [];
        }

        // 3. 投票紀錄 (poll_votes) — 同時查 session_code 和 UUID
        let polls = [];
        const { data: pollsRaw } = await db.select('poll_votes', {
            filter: { session_code: `eq.${sessionCode}` },
            order: 'created_at.asc'
        });
        polls = pollsRaw || [];
        // fallback: 用 UUID 查
        if (polls.length === 0 && sessionUUID) {
            const { data: pollsFallback } = await db.select('poll_votes', {
                filter: { session_code: `eq.${sessionUUID}` },
                order: 'created_at.asc'
            });
            polls = pollsFallback || [];
        }

        // 4. 作業定義
        const { data: assignRaw } = await db.select('session_assignments', {
            filter: { session_id: `eq.${sessionId}` },
            order: 'sort_order.asc'
        });
        const assignments = assignRaw || [];

        // ── 產出 CSV ──
        const csvStudents = buildStudentsCSV(students);
        const csvSummary = buildSummaryCSV(submissions, polls, students);
        const csvDetail = buildDetailCSV(submissions);
        const csvPolls = buildPollsCSV(polls);
        const csvHomework = buildHomeworkCSV(submissions, assignments);
        const csvPerStudent = buildPerStudentCSV(students, submissions, polls);

        // ── 產出 HTML 報告 ──
        const htmlReport = buildHTMLReport(projectName, sess, students, submissions, polls, assignments);

        // ── 打包 ZIP ──
        if (typeof JSZip === 'undefined') {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
                s.onload = resolve; s.onerror = reject;
                document.head.appendChild(s);
            });
        }

        const zip = new JSZip();
        const prefix = `${projectName || '課程'}_${sess.date || 'export'}`;
        zip.file('1_學員名冊.csv', csvStudents);
        zip.file('2_互動統計摘要.csv', csvSummary);
        zip.file('3_學員作答明細.csv', csvDetail);
        zip.file('4_投票紀錄.csv', csvPolls);
        zip.file('5_作業提交.csv', csvHomework);
        zip.file('6_學員個別互動明細.csv', csvPerStudent);
        zip.file('報告總覽.html', htmlReport);

        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${prefix}_學員報告.zip`;
        a.click();
        URL.revokeObjectURL(a.href);

    } catch (e) {
        console.error('[Export] error:', e);
        alert('匯出失敗：' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '匯出'; }
    }
}

// ── CSV 生成 ──

function buildStudentsCSV(students) {
    const headers = ['姓名', 'Email', '公司', '登入時間'];
    const rows = students.map(s => [s.name, s.email, s.company || '', fmtTime(s.created_at)]);
    return toCSV(headers, rows);
}

function buildSummaryCSV(submissions, polls, students) {
    // 依 element_id 分群統計
    const byElement = {};
    submissions.forEach(s => {
        const eid = s.element_id || s.assignment_title || 'unknown';
        if (!byElement[eid]) byElement[eid] = { title: s.assignment_title || eid, type: s.type || '', total: 0, correct: 0, graded: 0, participants: new Set() };
        const g = byElement[eid];
        g.total++;
        g.participants.add(s.student_email || s.student_name);
        if (s.is_correct === true || s.is_correct === 'true') { g.correct++; g.graded++; }
        else if (s.is_correct === false || s.is_correct === 'false') { g.graded++; }
    });

    // 投票統計
    const pollByElement = {};
    polls.forEach(p => {
        const eid = p.element_id || 'poll';
        if (!pollByElement[eid]) pollByElement[eid] = { voters: new Set(), total: 0 };
        pollByElement[eid].voters.add(p.student_email);
        pollByElement[eid].total++;
    });

    const headers = ['題目/活動', '類型', '參與人數', '總提交', '正確數', '正答率'];
    const rows = [];
    Object.entries(byElement).forEach(([, g]) => {
        const rate = g.graded > 0 ? Math.round(g.correct / g.graded * 100) + '%' : '-';
        rows.push([g.title, TYPE_LABELS[g.type] || g.type, g.participants.size, g.total, g.correct, rate]);
    });
    Object.entries(pollByElement).forEach(([eid, g]) => {
        rows.push([`投票 (${eid.slice(0, 8)})`, '投票', g.voters.size, g.total, '-', '-']);
    });

    return toCSV(headers, rows);
}

function buildDetailCSV(submissions) {
    const headers = ['學員姓名', 'Email', '題目/作業', '類型', '回答內容', '正確', '分數', '檔案連結', '提交時間'];
    const rows = submissions.map(s => {
        let content = s.content || '';
        if (content.length > 500) content = content.slice(0, 500) + '…';
        const correct = s.is_correct === true || s.is_correct === 'true' ? '✓'
            : s.is_correct === false || s.is_correct === 'false' ? '✗' : '';
        return [
            s.student_name || '', s.student_email || '',
            s.assignment_title || '', TYPE_LABELS[s.type] || s.type || '',
            content, correct, s.score ?? '', s.file_url || '', fmtTime(s.submitted_at)
        ];
    });
    return toCSV(headers, rows);
}

function buildPollsCSV(polls) {
    const headers = ['學員 Email', '題目 ID', '選項編號', '選項內容', '投票時間'];
    const rows = polls.map(p => [
        p.student_email || '', p.element_id || '',
        (p.option_index != null ? p.option_index + 1 : ''), p.option_text || '', fmtTime(p.created_at)
    ]);
    return toCSV(headers, rows);
}

function buildHomeworkCSV(submissions, assignments) {
    // 只取作業類型的提交
    const hwTypes = new Set(['homework', 'image', 'text', 'link', 'video', 'audio']);
    const hwSubs = submissions.filter(s => hwTypes.has(s.type) || s.file_url);
    const headers = ['學員姓名', 'Email', '作業名稱', '類型', '內容/連結', '檔案連結', '提交時間'];
    const rows = hwSubs.map(s => {
        let content = s.content || '';
        if (content.startsWith('http')) content = content; // keep URL
        else if (content.length > 300) content = content.slice(0, 300) + '…';
        return [
            s.student_name || '', s.student_email || '',
            s.assignment_title || '', TYPE_LABELS[s.type] || s.type || '',
            content, s.file_url || '', fmtTime(s.submitted_at)
        ];
    });
    return toCSV(headers, rows);
}

function buildPerStudentCSV(students, submissions, polls) {
    const headers = ['學員姓名', 'Email', '互動類型', '題目/作業名稱', '回答內容', '正確', '得分', '累計得分', '檔案連結', 'Prompt', '提交時間'];
    const rows = [];

    // 收集所有學員（合併 students 表 + submissions 中出現的學員）
    const studentMap = new Map();
    students.forEach(s => studentMap.set(s.email, s.name));
    submissions.forEach(s => {
        const key = s.student_email || s.student_name;
        if (key && !studentMap.has(key)) studentMap.set(key, s.student_name || key);
    });

    for (const [email, name] of studentMap) {
        const subs = submissions.filter(s => (s.student_email || s.student_name) === email);
        const pVotes = polls.filter(p => p.student_email === email);

        if (subs.length === 0 && pVotes.length === 0) {
            rows.push([name, email, '（無互動紀錄）', '', '', '', '', '', '', '', '']);
            continue;
        }

        // 計算累計得分
        let totalAwarded = 0;

        // submissions
        subs.forEach(s => {
            let st = s.state;
            if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
            const awarded = parseFloat(st?._awarded) || 0;
            totalAwarded += awarded;

            const correct = s.is_correct === true || s.is_correct === 'true' ? '✓'
                : s.is_correct === false || s.is_correct === 'false' ? '✗' : '';

            // 提取 prompt（image_prompt 模式）
            let prompt = '';
            let content = s.content || '';
            try {
                const parsed = JSON.parse(content);
                if (parsed?.prompt) { prompt = parsed.prompt; content = parsed.image || content; }
            } catch { /* not JSON */ }
            if (content.length > 500) content = content.slice(0, 500) + '…';

            rows.push([
                name, email,
                TYPE_LABELS[s.type] || s.type || '',
                s.assignment_title || '',
                content,
                correct,
                awarded > 0 ? awarded : (s.score ?? ''),
                totalAwarded,
                s.file_url || '',
                prompt,
                fmtTime(s.submitted_at)
            ]);
        });

        // poll_votes
        pVotes.forEach(p => {
            rows.push([
                name, email,
                '投票',
                p.element_id || '',
                p.option_text || `選項 ${(p.option_index || 0) + 1}`,
                '', '', totalAwarded, '', '',
                fmtTime(p.created_at)
            ]);
        });
    }
    return toCSV(headers, rows);
}

// ── HTML 報告 ──

function buildHTMLReport(projectName, sess, students, submissions, polls, assignments) {
    const date = sess.date || '';
    const venue = sess.venue || '';
    const time = sess.time || '';

    // 統計
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

    // 學員排行
    const studentScores = {};
    submissions.forEach(s => {
        const key = s.student_name || s.student_email || '匿名';
        if (!studentScores[key]) studentScores[key] = { correct: 0, total: 0, email: s.student_email || '' };
        studentScores[key].total++;
        if (s.is_correct === true || s.is_correct === 'true') studentScores[key].correct++;
    });
    const ranked = Object.entries(studentScores)
        .map(([name, d]) => ({ name, ...d, rate: d.total > 0 ? Math.round(d.correct / d.total * 100) : 0 }))
        .sort((a, b) => b.rate - a.rate || b.correct - a.correct);

    // 投票摘要
    const pollSummary = {};
    polls.forEach(p => {
        const eid = p.element_id || 'poll';
        if (!pollSummary[eid]) pollSummary[eid] = { options: {}, voters: new Set() };
        const label = p.option_text || `選項 ${(p.option_index || 0) + 1}`;
        pollSummary[eid].options[label] = (pollSummary[eid].options[label] || 0) + 1;
        pollSummary[eid].voters.add(p.student_email);
    });

    // 作業提交列表
    const hwSubs = submissions.filter(s => s.file_url || ['homework', 'image', 'image_prompt'].includes(s.type));

    const totalInteractions = Object.keys(byElement).length + Object.keys(pollSummary).length;
    const overallCorrect = submissions.filter(s => s.is_correct === true || s.is_correct === 'true').length;
    const overallGraded = submissions.filter(s => s.is_correct !== null && s.is_correct !== undefined && s.is_correct !== '').length;
    const overallRate = overallGraded > 0 ? Math.round(overallCorrect / overallGraded * 100) : '-';

    // 題目統計 rows
    let elementRows = '';
    Object.entries(byElement).forEach(([, g]) => {
        const rate = (g.correct + g.wrong) > 0 ? Math.round(g.correct / (g.correct + g.wrong) * 100) : null;
        const barColor = rate === null ? '#e2e8f0' : rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444';
        const barWidth = rate === null ? 0 : rate;
        elementRows += `<tr>
            <td>${esc(g.title || '—')}</td>
            <td><span class="type-badge">${esc(TYPE_LABELS[g.type] || g.type)}</span></td>
            <td>${g.participants.size}</td>
            <td>${g.total}</td>
            <td>
                ${rate !== null ? `<div class="bar-wrap"><div class="bar-fill" style="width:${barWidth}%;background:${barColor}"></div></div>
                <span class="rate-text">${rate}%</span>` : '<span style="color:#94a3b8">—</span>'}
            </td>
        </tr>`;
    });

    // 投票 rows
    let pollRows = '';
    Object.entries(pollSummary).forEach(([eid, g]) => {
        const total = Object.values(g.options).reduce((a, b) => a + b, 0);
        const optHtml = Object.entries(g.options)
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => {
                const pct = Math.round(count / total * 100);
                return `<div class="poll-opt"><span class="poll-label">${esc(label)}</span><div class="poll-bar"><div class="poll-fill" style="width:${pct}%"></div></div><span class="poll-count">${count} (${pct}%)</span></div>`;
            }).join('');
        pollRows += `<div class="poll-card"><div class="poll-title">投票 · ${g.voters.size} 人參與</div>${optHtml}</div>`;
    });

    // 學員排行 rows
    let rankRows = '';
    ranked.slice(0, 30).forEach((r, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
        rankRows += `<tr><td>${medal}</td><td>${esc(r.name)}</td><td>${r.correct}/${r.total}</td><td><strong>${r.rate}%</strong></td></tr>`;
    });

    // 作業 rows
    let hwRows = '';
    hwSubs.forEach(s => {
        const contentPreview = s.file_url
            ? `<a href="${esc(s.file_url)}" target="_blank">查看檔案</a>`
            : esc((s.content || '').slice(0, 100));
        hwRows += `<tr><td>${esc(s.student_name || '')}</td><td>${esc(s.assignment_title || '')}</td><td>${contentPreview}</td><td>${fmtTime(s.submitted_at)}</td></tr>`;
    });

    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(projectName)} — 學員互動報告</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6}
.container{max-width:960px;margin:0 auto;padding:32px 24px}
.header{text-align:center;margin-bottom:40px;padding:40px 24px;background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);color:#fff;border-radius:16px}
.header h1{font-size:1.6rem;margin-bottom:8px;font-weight:700}
.header .meta{font-size:.88rem;opacity:.85}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px}
.stat-card{background:#fff;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.stat-value{font-size:1.8rem;font-weight:800;color:#2563eb}
.stat-label{font-size:.78rem;color:#64748b;margin-top:4px}
h2{font-size:1.15rem;font-weight:700;margin:32px 0 16px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;gap:8px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:24px}
th{background:#f1f5f9;padding:10px 14px;text-align:left;font-size:.78rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
td{padding:10px 14px;border-top:1px solid #f1f5f9;font-size:.85rem}
tr:hover td{background:#f8fafc}
.type-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:600;background:#eff6ff;color:#2563eb}
.bar-wrap{display:inline-block;width:80px;height:8px;background:#e2e8f0;border-radius:4px;vertical-align:middle;margin-right:6px}
.bar-fill{height:100%;border-radius:4px;transition:width .3s}
.rate-text{font-size:.8rem;font-weight:600}
.poll-card{background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.poll-title{font-weight:700;font-size:.9rem;margin-bottom:12px;color:#334155}
.poll-opt{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.poll-label{flex:0 0 120px;font-size:.82rem;text-align:right;color:#475569}
.poll-bar{flex:1;height:20px;background:#f1f5f9;border-radius:6px;overflow:hidden}
.poll-fill{height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:6px;transition:width .3s}
.poll-count{flex:0 0 80px;font-size:.78rem;color:#64748b}
.footer{text-align:center;padding:32px;color:#94a3b8;font-size:.78rem}
a{color:#2563eb;text-decoration:none}
@media print{body{background:#fff}.container{padding:16px}.header{break-after:avoid}}
@media(max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>${esc(projectName || '課程互動報告')}</h1>
        <div class="meta">${[date, time, venue].filter(Boolean).join(' · ')}</div>
        <div class="meta" style="margin-top:4px;font-size:.78rem;opacity:.65">報告產出時間：${new Date().toLocaleString('zh-TW')}</div>
    </div>

    <div class="stats">
        <div class="stat-card"><div class="stat-value">${uniqueStudents.size}</div><div class="stat-label">參與學員</div></div>
        <div class="stat-card"><div class="stat-value">${totalInteractions}</div><div class="stat-label">互動題數</div></div>
        <div class="stat-card"><div class="stat-value">${submissions.length}</div><div class="stat-label">作答紀錄</div></div>
        <div class="stat-card"><div class="stat-value">${typeof overallRate === 'number' ? overallRate + '%' : '—'}</div><div class="stat-label">整體正答率</div></div>
    </div>

    <h2>📊 互動統計</h2>
    ${elementRows ? `<table><thead><tr><th>題目</th><th>類型</th><th>參與</th><th>提交</th><th>正答率</th></tr></thead><tbody>${elementRows}</tbody></table>` : '<p style="color:#94a3b8;text-align:center;padding:20px;">無互動紀錄</p>'}

    ${pollRows ? `<h2>🗳️ 投票結果</h2>${pollRows}` : ''}

    <h2>🏆 學員表現排行</h2>
    ${rankRows ? `<table><thead><tr><th>#</th><th>學員</th><th>答對/總題</th><th>正答率</th></tr></thead><tbody>${rankRows}</tbody></table>` : '<p style="color:#94a3b8;text-align:center;padding:20px;">無評分紀錄</p>'}

    ${hwRows ? `<h2>📝 作業提交</h2><table><thead><tr><th>學員</th><th>作業</th><th>內容</th><th>時間</th></tr></thead><tbody>${hwRows}</tbody></table>` : ''}

    ${buildStudentDetailHTML(students, submissions, polls)}

    <div class="footer">
        此報告由教學系統自動產出 · ${esc(projectName || '')}
    </div>
</div>
</body>
</html>`;
}

function buildStudentDetailHTML(students, submissions, polls) {
    // 收集所有學員
    const studentMap = new Map();
    students.forEach(s => studentMap.set(s.email, s.name));
    submissions.forEach(s => {
        const key = s.student_email || s.student_name;
        if (key && !studentMap.has(key)) studentMap.set(key, s.student_name || key);
    });

    if (studentMap.size === 0) return '';

    let html = '<h2 style="page-break-before:always">👤 學員個別互動清單</h2>';

    for (const [email, name] of studentMap) {
        const subs = submissions.filter(s => (s.student_email || s.student_name) === email);
        const pVotes = polls.filter(p => p.student_email === email);
        if (subs.length === 0 && pVotes.length === 0) continue;

        // 計算總分
        let totalScore = 0;
        subs.forEach(s => {
            let st = s.state;
            if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
            totalScore += parseFloat(st?._awarded) || 0;
        });

        html += `<div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;border-bottom:1px solid #f1f5f9;padding-bottom:12px">
                <div style="width:40px;height:40px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem">${esc(name.charAt(0))}</div>
                <div>
                    <div style="font-weight:700;font-size:1rem">${esc(name)}</div>
                    <div style="font-size:.78rem;color:#64748b">${esc(email)} · 互動 ${subs.length} 次${pVotes.length > 0 ? ` · 投票 ${pVotes.length} 次` : ''}${totalScore > 0 ? ` · 累計 ${totalScore} 分` : ''}</div>
                </div>
            </div>`;

        // 列出每個互動
        subs.forEach(s => {
            let st = s.state;
            if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
            const awarded = parseFloat(st?._awarded) || 0;
            const typeLabel = TYPE_LABELS[s.type] || s.type || '其他';
            const correct = s.is_correct === true || s.is_correct === 'true' ? '✅'
                : s.is_correct === false || s.is_correct === 'false' ? '❌' : '';

            // 解析 content
            let contentHtml = '';
            let prompt = '';
            let content = s.content || '';
            try {
                const parsed = JSON.parse(content);
                if (parsed?.image) {
                    contentHtml = `<img src="${esc(parsed.image)}" style="max-width:200px;max-height:150px;border-radius:6px;border:1px solid #e2e8f0;margin-top:6px;display:block">`;
                    if (parsed.prompt) prompt = parsed.prompt;
                    content = '';
                }
            } catch { /* not JSON */ }

            if (!contentHtml) {
                if (s.file_url && /\.(jpg|jpeg|png|gif|webp)/i.test(s.file_url)) {
                    contentHtml = `<img src="${esc(s.file_url)}" style="max-width:200px;max-height:150px;border-radius:6px;border:1px solid #e2e8f0;margin-top:6px;display:block">`;
                } else if (s.file_url) {
                    contentHtml = `<a href="${esc(s.file_url)}" target="_blank">📎 查看檔案</a>`;
                } else if (content && content !== '(image)') {
                    const truncated = content.length > 300 ? content.slice(0, 300) + '…' : content;
                    contentHtml = `<div style="color:#475569;font-size:.82rem;line-height:1.5;white-space:pre-wrap;word-break:break-word">${esc(truncated)}</div>`;
                }
            }

            html += `<div style="padding:8px 0;border-bottom:1px solid #f8f9fa;display:flex;gap:12px;align-items:flex-start">
                <div style="min-width:70px"><span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:600;background:#eff6ff;color:#2563eb">${esc(typeLabel)}</span></div>
                <div style="flex:1">
                    <div style="font-size:.85rem;font-weight:600;color:#1e293b">${esc(s.assignment_title || '')} ${correct}</div>
                    ${contentHtml}
                    ${prompt ? `<div style="margin-top:4px;padding:6px 10px;background:#f0f4ff;border-radius:6px;border:1px solid #c3d9fc;font-size:.78rem"><span style="color:#1a73e8;font-weight:600">💬 Prompt:</span> ${esc(prompt.length > 200 ? prompt.slice(0, 200) + '…' : prompt)}</div>` : ''}
                </div>
                <div style="min-width:60px;text-align:right;font-size:.82rem">
                    ${awarded > 0 ? `<span style="font-weight:700;color:#059669">+${awarded}</span>` : (s.score != null && s.score !== '' ? `<span style="color:#64748b">${s.score}</span>` : '')}
                    <div style="color:#94a3b8;font-size:.72rem;margin-top:2px">${fmtTime(s.submitted_at).split(' ').pop() || ''}</div>
                </div>
            </div>`;
        });

        // 投票
        if (pVotes.length > 0) {
            pVotes.forEach(p => {
                html += `<div style="padding:8px 0;border-bottom:1px solid #f8f9fa;display:flex;gap:12px;align-items:center">
                    <div style="min-width:70px"><span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:600;background:#fef3c7;color:#92400e">投票</span></div>
                    <div style="flex:1;font-size:.85rem;color:#1e293b">${esc(p.option_text || `選項 ${(p.option_index || 0) + 1}`)}</div>
                    <div style="min-width:60px;text-align:right;color:#94a3b8;font-size:.72rem">${fmtTime(p.created_at).split(' ').pop() || ''}</div>
                </div>`;
            });
        }

        html += '</div>';
    }
    return html;
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
