/**
 * tools-logic.js — 免費工具箱邏輯（強化版）
 */

// ── Copy helper ──
window.copyOutput = function(boxId) {
    const box = document.getElementById(boxId);
    const pre = box.querySelector('pre');
    const text = pre ? pre.textContent : box.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = box.querySelector('.copy-btn');
        if (btn) { btn.textContent = '✓ 已複製'; setTimeout(() => btn.textContent = '複製', 1500); }
    });
};

// ── History helpers ──
function saveHistory(key, item) {
    const history = JSON.parse(localStorage.getItem('tools_' + key) || '[]');
    history.unshift({ text: item, time: new Date().toLocaleString('zh-TW') });
    if (history.length > 20) history.pop();
    localStorage.setItem('tools_' + key, JSON.stringify(history));
    renderHistory(key);
}
function renderHistory(key) {
    const section = document.getElementById(key + '-history-section');
    const list = document.getElementById(key + '-history');
    if (!section || !list) return;
    const history = JSON.parse(localStorage.getItem('tools_' + key) || '[]');
    if (history.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    list.innerHTML = history.map(h => `<div class="history-item" onclick="navigator.clipboard.writeText('${h.text.replace(/'/g, "\\'")}')" title="點擊複製">${h.text}</div>`).join('');
}
window.clearHistory = function(key) {
    localStorage.removeItem('tools_' + key);
    renderHistory(key);
};

// ══════════════════════════════════
// 1. UTM 連結產生器（強化版）
// ══════════════════════════════════
window.generateUTM = function() {
    let url = document.getElementById('utm-url').value.trim();
    const source = document.getElementById('utm-source').value.trim();
    const medium = document.getElementById('utm-medium').value.trim();
    if (!url || !source || !medium) return alert('請填寫網址、Source 和 Medium');
    if (!url.startsWith('http')) url = 'https://' + url;
    const params = new URLSearchParams();
    params.set('utm_source', source);
    params.set('utm_medium', medium);
    ['campaign','term','content'].forEach(k => {
        const v = document.getElementById(`utm-${k}`).value.trim();
        if (v) params.set(`utm_${k}`, v);
    });
    const sep = url.includes('?') ? '&' : '?';
    const result = url + sep + params.toString();
    document.getElementById('utm-result').textContent = result;
    document.getElementById('utm-output').style.display = 'block';
    saveHistory('utm', result);
};

// ══════════════════════════════════
// 2. QR Code 產生器
// ══════════════════════════════════
window.generateQR = function() {
    const text = document.getElementById('qr-text').value.trim();
    if (!text) return alert('請輸入網址或文字');
    const size = document.getElementById('qr-size').value;
    const color = document.getElementById('qr-color').value.replace('#','');
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(text)}&size=${size}x${size}&color=${color}`;
    const out = document.getElementById('qr-output');
    out.style.display = 'block';
    out.innerHTML = `
        <img src="${apiUrl}" alt="QR Code" style="border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.1);margin-bottom:16px;">
        <br><a href="${apiUrl}" download="qrcode.png" class="btn btn-secondary btn-sm" style="text-decoration:none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 下載 QR Code
        </a>
        <div style="margin-top:12px;font-size:.72rem;color:#9ca3af">內容：${text.length > 60 ? text.substring(0,60)+'...' : text}</div>`;
};

// ══════════════════════════════════
// 3. 社群字數檢測器（強化版）
// ══════════════════════════════════
const SOCIAL_LIMITS = { twitter: 280, fb: 63206, ig: 2200, li: 3000, threads: 500 };
window.checkSocialLength = function() {
    const text = document.getElementById('social-text').value;
    const len = text.length;
    document.getElementById('sc-chars').textContent = len.toLocaleString();
    Object.entries(SOCIAL_LIMITS).forEach(([key, max]) => {
        const pct = Math.min(100, (len / max) * 100);
        document.getElementById(`sc-${key}`).textContent = `${len.toLocaleString()} / ${max.toLocaleString()}`;
        const bar = document.getElementById(`sc-${key}-bar`);
        bar.style.width = pct + '%';
        bar.style.background = pct > 100 ? '#ef4444' : bar.dataset.color || bar.style.background;
    });
    // Extra analysis
    const extra = document.getElementById('social-extra');
    if (!extra) return;
    const emojiCount = (text.match(/\p{Emoji}/gu) || []).length;
    const hashCount = (text.match(/#\S+/g) || []).length;
    const lineCount = text.split('\n').length;
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (len > 0) {
        extra.innerHTML = `<div class="result-grid">
            <div class="result-card"><div class="rc-label">Emoji 數量</div><div class="rc-value">${emojiCount}</div></div>
            <div class="result-card"><div class="rc-label">Hashtag 數量</div><div class="rc-value">${hashCount}</div></div>
            <div class="result-card"><div class="rc-label">行數</div><div class="rc-value">${lineCount}</div></div>
            <div class="result-card"><div class="rc-label">詞數（約）</div><div class="rc-value">${wordCount}</div></div>
        </div>`;
    } else {
        extra.innerHTML = '';
    }
};

// ══════════════════════════════════
// 4. Email 主旨評分器（強化版+A/B）
// ══════════════════════════════════
function analyzeSubject(subj) {
    let total = 0; const tips = [];
    const len = subj.length;
    if (len >= 20 && len <= 50) { total += 25; tips.push('✅ 長度適中 (20-50字)'); }
    else if (len < 20) { total += 10; tips.push('⚠️ 太短，建議 20-50 字'); }
    else { total += 10; tips.push('⚠️ 偏長，可能被手機截斷'); }
    if (/\p{Emoji}/u.test(subj)) { total += 15; tips.push('✅ 含 Emoji，有助提升開信率'); }
    else { total += 5; tips.push('💡 可加入 Emoji 增加注意力'); }
    if (/\d/.test(subj)) { total += 15; tips.push('✅ 含數字，增加具體感'); }
    else { total += 5; tips.push('💡 加入數字提升說服力'); }
    if (/限時|最後|倒數|今天|即將|馬上|立即|only|last/i.test(subj)) { total += 20; tips.push('✅ 含緊迫感詞彙'); }
    else { total += 5; tips.push('💡 適當加入緊迫感'); }
    if (/你|您|專屬|獨享/.test(subj)) { total += 15; tips.push('✅ 含個人化用語'); }
    else { total += 5; tips.push('💡 加入「你」「專屬」等詞'); }
    if (/免費|賺錢|恭喜|中獎|100%/i.test(subj)) { total -= 10; tips.push('🚨 含疑似垃圾信關鍵字'); }
    total = Math.max(0, Math.min(100, total));
    const color = total >= 80 ? '#10b981' : total >= 50 ? '#f59e0b' : '#ef4444';
    const grade = total >= 80 ? 'A 優秀' : total >= 60 ? 'B 不錯' : total >= 40 ? 'C 普通' : 'D 需改善';
    return { total, color, grade, tips, len };
}

function renderScore(r, label) {
    return `<div style="margin-bottom:20px">
        ${label ? `<div style="font-size:.82rem;font-weight:700;margin-bottom:8px">${label}</div>` : ''}
        <div style="text-align:center;margin-bottom:12px">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:50%;border:5px solid ${r.color};font-size:1.6rem;font-weight:800;color:${r.color}">${r.total}</div>
            <div style="font-size:.85rem;font-weight:700;margin-top:4px;color:${r.color}">${r.grade}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px">
            ${r.tips.map(t => `<div style="padding:3px 0;font-size:.78rem">${t}</div>`).join('')}
        </div>
    </div>`;
}

window.scoreEmail = function() {
    const subj = document.getElementById('email-subject').value.trim();
    if (!subj) return alert('請輸入主旨');
    const subjB = document.getElementById('email-subject-b')?.value.trim();
    const rA = analyzeSubject(subj);
    const out = document.getElementById('email-output');
    out.style.display = 'block';
    if (subjB) {
        const rB = analyzeSubject(subjB);
        const winner = rA.total >= rB.total ? 'A' : 'B';
        out.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div style="border:2px solid ${winner==='A'?'#10b981':'transparent'};border-radius:12px;padding:12px">${renderScore(rA, '版本 A' + (winner==='A'?' 🏆':''))}</div>
            <div style="border:2px solid ${winner==='B'?'#10b981':'transparent'};border-radius:12px;padding:12px">${renderScore(rB, '版本 B' + (winner==='B'?' 🏆':''))}</div>
        </div>`;
    } else {
        out.innerHTML = renderScore(rA);
    }
};

// ══════════════════════════════════
// 5. Hashtag 產生器
// ══════════════════════════════════
const HASHTAG_DB = {
    'AI': ['AI', '人工智慧', 'ChatGPT', 'Claude', 'AItools', 'MachineLearning', 'AI應用', 'AI教學', '生成式AI', 'AIautomation', 'Prompt', 'AI趨勢', 'DeepLearning', 'NLP'],
    '行銷': ['數位行銷', 'DigitalMarketing', 'SEO', 'ContentMarketing', '內容行銷', '社群行銷', 'SocialMedia', 'MarTech', '品牌行銷', '行銷策略', 'Branding', 'Growth', 'CRM'],
    '教學': ['線上課程', 'OnlineLearning', '教學', 'EdTech', '自主學習', '技能提升', 'Upskilling', '數位學習', 'Elearning', '終身學習'],
    '科技': ['科技', 'Tech', 'SaaS', 'Startup', '創業', 'Innovation', '數位轉型', 'DigitalTransformation', 'NoCode', 'Automation'],
    '職場': ['職場', 'Career', '工作效率', 'Productivity', '遠端工作', 'RemoteWork', '職涯發展', 'Leadership', '團隊管理', 'HR'],
    'default': ['學習', '成長', '分享', '筆記', '推薦', '好用', '實用', '必看', '乾貨', '經驗分享']
};
window.generateHashtags = function() {
    const kw = document.getElementById('ht-keyword').value.trim();
    if (!kw) return alert('請輸入關鍵字');
    const platform = document.getElementById('ht-platform').value;
    let tags = new Set();
    Object.entries(HASHTAG_DB).forEach(([cat, arr]) => {
        if (kw.includes(cat) || cat === 'default') arr.forEach(t => tags.add(t));
    });
    kw.split(/[,，、\s]+/).filter(Boolean).forEach(w => tags.add(w.replace(/\s/g,'')));
    const limits = { instagram: 30, threads: 5, twitter: 3, linkedin: 5 };
    const result = [...tags].slice(0, limits[platform] || 20);
    const cloud = document.getElementById('ht-output');
    cloud.style.display = 'flex';
    cloud.innerHTML = result.map(t => `<span class="tag-item" onclick="this.classList.toggle('selected')">#${t}</span>`).join('');
    const copyBox = document.getElementById('ht-copy-box');
    copyBox.style.display = 'block';
    document.getElementById('ht-result').textContent = result.map(t => '#' + t).join(' ');
};

// ══════════════════════════════════
// 6. 薪資試算器（強化版 + 所得稅級距）
// ══════════════════════════════════
window.calcSalary = function() {
    const monthly = Number(document.getElementById('sal-monthly').value) || 0;
    if (!monthly) return alert('請輸入月薪');
    const overtime = Number(document.getElementById('sal-overtime').value) || 0;
    const bonus = Number(document.getElementById('sal-bonus').value) || 2;
    const dependents = Number(document.getElementById('sal-dependents').value) || 0;
    const gross = monthly + overtime;
    const laborIns = Math.round(gross * 0.115 * 0.2);
    const healthIns = Math.round(gross * 0.0517 * 0.3);
    const laborPension = Math.round(gross * 0.06);
    const totalDeduct = laborIns + healthIns;
    const netMonthly = gross - totalDeduct;
    const annualGross = monthly * 12 + monthly * bonus + overtime * 12;
    const annualNet = netMonthly * 12 + monthly * bonus;
    // 所得稅概估
    const taxableIncome = annualGross - 92000 - (dependents * 92000) - 207000 - 200000;
    let tax = 0;
    if (taxableIncome > 0) {
        if (taxableIncome <= 560000) tax = taxableIncome * 0.05;
        else if (taxableIncome <= 1260000) tax = 28000 + (taxableIncome - 560000) * 0.12;
        else if (taxableIncome <= 2520000) tax = 112000 + (taxableIncome - 1260000) * 0.20;
        else if (taxableIncome <= 4720000) tax = 364000 + (taxableIncome - 2520000) * 0.30;
        else tax = 1024000 + (taxableIncome - 4720000) * 0.40;
    }
    const monthlyTax = Math.round(Math.max(0, tax) / 12);

    const out = document.getElementById('salary-output');
    out.style.display = 'block';
    out.innerHTML = `
        <div class="result-grid">
            <div class="result-card"><div class="rc-label">月薪總額</div><div class="rc-value">$${gross.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">勞保自付</div><div class="rc-value" style="color:#ef4444">-$${laborIns.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">健保自付</div><div class="rc-value" style="color:#ef4444">-$${healthIns.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">所得稅預扣/月（約）</div><div class="rc-value" style="color:#f59e0b">-$${monthlyTax.toLocaleString()}</div></div>
            <div class="result-card" style="border-color:#10b981"><div class="rc-label">每月實領（約）</div><div class="rc-value" style="color:#10b981">$${(netMonthly - monthlyTax).toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">年收入（含年終 ${bonus} 月）</div><div class="rc-value">$${annualGross.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">雇主勞退提撥/月</div><div class="rc-value" style="color:#2563eb">$${laborPension.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">年所得稅（約）</div><div class="rc-value" style="color:#f59e0b">$${Math.round(Math.max(0,tax)).toLocaleString()}</div></div>
        </div>
        <div style="margin-top:16px;padding:14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px">
            <div style="font-size:.78rem;font-weight:700;margin-bottom:8px">薪資結構分析</div>
            <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin-bottom:6px">
                <div style="width:${((netMonthly-monthlyTax)/gross*100).toFixed(1)}%;background:#10b981" title="實領"></div>
                <div style="width:${(laborIns/gross*100).toFixed(1)}%;background:#ef4444" title="勞保"></div>
                <div style="width:${(healthIns/gross*100).toFixed(1)}%;background:#f59e0b" title="健保"></div>
                <div style="width:${(monthlyTax/gross*100).toFixed(1)}%;background:#8b5cf6" title="所得稅"></div>
            </div>
            <div style="display:flex;gap:16px;font-size:.65rem;color:#6b7280;flex-wrap:wrap">
                <span>🟢 實領 ${((netMonthly-monthlyTax)/gross*100).toFixed(1)}%</span>
                <span>🔴 勞保 ${(laborIns/gross*100).toFixed(1)}%</span>
                <span>🟡 健保 ${(healthIns/gross*100).toFixed(1)}%</span>
                <span>🟣 稅 ${(monthlyTax/gross*100).toFixed(1)}%</span>
            </div>
        </div>
        <div style="margin-top:8px;font-size:.72rem;color:#9ca3af">* 以上為概估值，實際金額依投保級距和個人條件而異。所得稅依 2024 年級距計算。</div>`;
};

// ══════════════════════════════════
// 7. 會議成本計算器（強化版）
// ══════════════════════════════════
window.calcMeeting = function() {
    const people = Number(document.getElementById('mtg-people').value) || 1;
    const minutes = Number(document.getElementById('mtg-minutes').value) || 60;
    const salary = Number(document.getElementById('mtg-salary').value) || 50000;
    const hourlyRate = salary / 22 / 8;
    const meetingCost = Math.round(hourlyRate * (minutes / 60) * people);
    const perPerson = Math.round(meetingCost / people);
    const weeklyIf = meetingCost * 4;
    const yearlyIf = meetingCost * 50;
    const personHours = Math.round(people * minutes / 60 * 10) / 10;
    // Efficiency rating
    let efficiency = '高效';let effColor = '#10b981';
    if (minutes > 60 || people > 8) { efficiency = '需注意'; effColor = '#f59e0b'; }
    if (minutes > 90 || people > 15) { efficiency = '偏低'; effColor = '#ef4444'; }
    const out = document.getElementById('meeting-output');
    out.style.display = 'block';
    out.innerHTML = `
        <div class="result-grid">
            <div class="result-card" style="border-color:#ef4444"><div class="rc-label">本次會議成本</div><div class="rc-value" style="color:#ef4444">$${meetingCost.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">每人成本</div><div class="rc-value">$${perPerson.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">若每週開一次/月</div><div class="rc-value" style="color:#f59e0b">$${weeklyIf.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">若每週開一次/年</div><div class="rc-value" style="color:#ef4444">$${yearlyIf.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">消耗人力時數</div><div class="rc-value">${personHours} 小時</div></div>
            <div class="result-card" style="border-color:${effColor}"><div class="rc-label">效率評估</div><div class="rc-value" style="color:${effColor}">${efficiency}</div></div>
        </div>
        <div style="margin-top:16px;padding:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:.82rem;color:#9a3412">
            💡 <strong>小提醒：</strong>${people} 人 × ${minutes} 分鐘的會議，等於消耗了 <strong>${personHours} 人小時</strong>的生產力。
            ${minutes > 60 ? '<br>建議將會議拆分為 30 分鐘以內的專注議程。' : '確保每場會議都有明確議程和可執行的結論！'}
        </div>`;
};

// ══════════════════════════════════
// 8. 年假計算器（強化版 + 對照表）
// ══════════════════════════════════
window.calcLeave = function() {
    const startDate = document.getElementById('leave-start').value;
    if (!startDate) return alert('請選擇到職日');
    const start = new Date(startDate);
    const now = new Date();
    const diffMs = now - start;
    if (diffMs < 0) return alert('到職日不能在未來');
    const years = diffMs / (365.25 * 24 * 60 * 60 * 1000);
    let days = 0; let note = '';
    if (years < 0.5) { days = 3; note = '未滿 6 個月：3 天'; }
    else if (years < 1) { days = 3; note = '6 個月以上未滿 1 年：3 天'; }
    else if (years < 2) { days = 7; note = '1 年以上未滿 2 年：7 天'; }
    else if (years < 3) { days = 10; note = '2 年以上未滿 3 年：10 天'; }
    else if (years < 5) { days = 14; note = '3 年以上未滿 5 年：14 天'; }
    else if (years < 10) { days = 15; note = '5 年以上未滿 10 年：15 天'; }
    else { days = Math.min(30, 15 + Math.floor(years - 10)); note = `10 年以上：每年加 1 天（上限 30 天）`; }
    const seniority = years >= 1 ? `${Math.floor(years)} 年 ${Math.floor((years % 1) * 12)} 個月` : `${Math.floor(years * 12)} 個月`;
    // Multi-year reference
    const refs = [[0.5,3],[1,7],[2,10],[3,14],[5,15],[10,16],[15,21],[20,26],[25,30]];
    const refRows = refs.map(([y,d]) => {
        const isCurrent = years >= y && (y === 25 || years < refs[refs.indexOf([y,d])+1]?.[0]);
        return `<div style="display:flex;justify-content:space-between;padding:4px 8px;background:${years>=y?'#ecfdf5':'#f8fafc'};border-radius:4px;font-size:.72rem;margin:2px 0${years>=y&&years<(refs[refs.indexOf(refs.find(r=>r[0]===y))+1]||[999])[0]?';border:1px solid #10b981':''}">
            <span>${y >= 1 ? y + ' 年' : y*12 + ' 個月'}</span><span style="font-weight:700">${d} 天</span></div>`;
    }).join('');
    const out = document.getElementById('leave-output');
    out.style.display = 'block';
    out.innerHTML = `
        <div class="result-grid">
            <div class="result-card"><div class="rc-label">年資</div><div class="rc-value">${seniority}</div></div>
            <div class="result-card" style="border-color:#10b981"><div class="rc-label">特休天數</div><div class="rc-value" style="color:#10b981;font-size:1.8rem">${days} 天</div></div>
        </div>
        <div style="margin-top:12px;padding:14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;font-size:.82rem;color:#065f46">
            📅 依勞基法第 38 條：${note}
        </div>
        <div style="margin-top:12px;padding:14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px">
            <div style="font-size:.78rem;font-weight:700;margin-bottom:8px">年資對照表</div>
            ${refRows}
        </div>
        <div style="margin-top:8px;font-size:.72rem;color:#9ca3af">* 特休未休完，雇主應折算工資發給。</div>`;
};

// ══════════════════════════════════
// 9. 面試題目產生器（強化版 + 評分標準）
// ══════════════════════════════════
const IQ_TEMPLATES = {
    behavior: [
        '請分享一個你在工作中解決困難問題的經驗，你是如何分析和處理的？',
        '描述一次你與團隊成員意見不合的經驗，最後怎麼解決？',
        '請舉例說明你如何在壓力下完成一個重要的專案。',
        '談談你最自豪的一個工作成就，為什麼對你很重要？',
        '描述一次你必須快速學習新技能的經驗。',
        '請分享一個你主動發現並解決問題的經驗。',
        '描述一次你如何說服他人接受你的想法。'
    ],
    technical: {
        junior: ['請說明你最熟悉的技術棧，並解釋為什麼選擇它？', '你如何進行程式碼除錯？請分享你的流程。', '請解釋 {skill} 的基本概念和應用場景。'],
        mid: ['請設計一個 {skill} 的架構方案，並說明你的技術選型。', '你如何確保程式碼品質？請分享你的方法論。', '描述你如何優化過一個效能瓶頸問題。'],
        senior: ['從系統架構角度，你如何設計一個可擴展的 {skill} 解決方案？', '你如何建立技術團隊的工程文化和最佳實踐？', '談談你對技術債的看法和管理策略。']
    },
    culture: ['你理想中的工作環境是什麼樣的？', '你如何平衡工作和生活？', '你對持續學習有什麼看法？目前在學什麼？', '你為什麼對這個職位感興趣？']
};
window.generateInterviewQ = function() {
    const role = document.getElementById('iq-role').value.trim();
    if (!role) return alert('請輸入職位名稱');
    const level = document.getElementById('iq-level').value;
    const skills = document.getElementById('iq-skills').value.trim();
    const skill = skills.split(/[,，]/)[0]?.trim() || role;
    const techQs = IQ_TEMPLATES.technical[level].map(q => q.replace('{skill}', skill));
    const allQs = [
        { cat: '🎯 行為面試', qs: IQ_TEMPLATES.behavior.sort(() => Math.random() - 0.5).slice(0, 3) },
        { cat: '💻 技術能力', qs: techQs },
        { cat: '🤝 文化適配', qs: IQ_TEMPLATES.culture.sort(() => Math.random() - 0.5).slice(0, 2) }
    ];
    const levelLabel = level === 'junior' ? '初階' : level === 'mid' ? '中階' : '資深';
    const out = document.getElementById('interview-output');
    out.style.display = 'block';
    out.innerHTML = `
        <div style="font-size:.88rem;font-weight:700;margin-bottom:12px">📋 ${role}（${levelLabel}）面試題目</div>
        ${allQs.map(g => `
            <div style="margin-bottom:16px">
                <div style="font-size:.8rem;font-weight:700;color:#4b5563;margin-bottom:8px">${g.cat}</div>
                ${g.qs.map((q, i) => `<div style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:6px;font-size:.82rem">
                    <div><span style="color:#9ca3af;margin-right:6px">${i + 1}.</span>${q}</div>
                    <div style="font-size:.68rem;color:#9ca3af;margin-top:4px">📝 評分重點：邏輯清晰度、具體程度、反思能力</div>
                </div>`).join('')}
            </div>
        `).join('')}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="generateInterviewQ()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> 重新產生
            </button>
        </div>`;
};

// ══════════════════════════════════
// 10. 職缺描述產生器
// ══════════════════════════════════
window.generateJD = function() {
    const title = document.getElementById('jd-title').value.trim();
    if (!title) return alert('請輸入職位名稱');
    const company = document.getElementById('jd-company').value.trim() || '[公司名稱]';
    const industry = document.getElementById('jd-industry').value;
    const type = document.getElementById('jd-type').value;
    const duties = document.getElementById('jd-duties').value.trim();
    const dutyList = duties ? duties.split(/[,，]/).map(d => d.trim()).filter(Boolean) : ['負責相關業務推動', '跨部門溝通協作', '專案規劃與執行'];
    const jd = `【${company}】${title} — 招募中

📍 工作型態：${type}
🏢 產業：${industry}

━━━━━━━━━━━━━━━━━━━━

📌 職位描述
${company} 正在尋找一位優秀的 ${title}，加入我們的團隊！
我們期望你能在${industry}領域中發揮所長，與團隊一起打造卓越的產品和服務。

📋 工作內容
${dutyList.map((d, i) => `${i + 1}. ${d}`).join('\n')}

🎯 必備條件
• 相關領域 1 年以上工作經驗
• 具備良好的溝通能力與團隊合作精神
• 積極主動、有責任感
• 對${industry}產業有熱情

✨ 加分條件
• 具備跨部門協作經驗
• 熟悉敏捷開發或專案管理方法
• 有${industry}產業背景

💰 薪資福利
• 具競爭力的薪資待遇（面議）
• 年終獎金、績效獎金
• 完善的教育訓練制度
• 彈性工時 / 遠端工作選項

📩 應徵方式
請將您的履歷寄至 hr@${company.toLowerCase().replace(/\s/g,'')}.com
或透過人力銀行投遞履歷。

#${title.replace(/\s/g,'')} #${industry} #${type} #招募 #徵才`;

    document.getElementById('jd-result').textContent = jd;
    document.getElementById('jd-output').style.display = 'block';
};

// ── Init history on load ──
document.addEventListener('DOMContentLoaded', () => { renderHistory('utm'); });
