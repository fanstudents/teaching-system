/**
 * tools-logic.js — 免費工具箱邏輯
 */

// ── Sidebar nav ──
document.querySelectorAll('.tool-item[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`panel-${btn.dataset.tool}`)?.classList.add('active');
        document.querySelector('.tool-sidebar')?.classList.remove('open');
    });
});

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

// ══════════════════════════════════
// 1. UTM 連結產生器
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
            <span class="material-symbols-outlined" style="font-size:16px;">download</span> 下載 QR Code
        </a>`;
};

// ══════════════════════════════════
// 3. 社群字數檢測器
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
        if (pct > 100) bar.style.background = '#ef4444';
    });
};

// ══════════════════════════════════
// 4. Email 主旨評分器
// ══════════════════════════════════
window.scoreEmail = function() {
    const subj = document.getElementById('email-subject').value.trim();
    if (!subj) return alert('請輸入主旨');
    let total = 0; const tips = [];
    // Length
    const len = subj.length;
    if (len >= 20 && len <= 50) { total += 25; tips.push('✅ 長度適中 (20-50字)'); }
    else if (len < 20) { total += 10; tips.push('⚠️ 太短，建議 20-50 字'); }
    else { total += 10; tips.push('⚠️ 偏長，可能被手機截斷'); }
    // Emoji
    if (/\p{Emoji}/u.test(subj)) { total += 15; tips.push('✅ 含 Emoji，有助提升開信率'); }
    else { total += 5; tips.push('💡 可加入 Emoji 增加注意力'); }
    // Numbers
    if (/\d/.test(subj)) { total += 15; tips.push('✅ 含數字，增加具體感'); }
    else { total += 5; tips.push('💡 加入數字提升說服力（如「3招」「50%」）'); }
    // Urgency
    if (/限時|最後|倒數|今天|即將|馬上|立即|only|last/i.test(subj)) { total += 20; tips.push('✅ 含緊迫感詞彙'); }
    else { total += 5; tips.push('💡 適當加入緊迫感可提高開信率'); }
    // Personalization
    if (/你|您|專屬|獨享/.test(subj)) { total += 15; tips.push('✅ 含個人化用語'); }
    else { total += 5; tips.push('💡 加入「你」「專屬」等詞增加親近感'); }
    // Spam words
    if (/免費|賺錢|恭喜|中獎|100%/i.test(subj)) { total -= 10; tips.push('🚨 含疑似垃圾信關鍵字，可能影響送達率'); }
    total = Math.max(0, Math.min(100, total));

    const color = total >= 80 ? '#10b981' : total >= 50 ? '#f59e0b' : '#ef4444';
    const grade = total >= 80 ? 'A 優秀' : total >= 60 ? 'B 不錯' : total >= 40 ? 'C 普通' : 'D 需改善';
    const out = document.getElementById('email-output');
    out.style.display = 'block';
    out.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:100px;height:100px;border-radius:50%;border:6px solid ${color};font-size:2rem;font-weight:800;color:${color};">${total}</div>
            <div style="font-size:1rem;font-weight:700;margin-top:8px;color:${color};">${grade}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:16px;">
            ${tips.map(t => `<div style="padding:4px 0;font-size:0.82rem;">${t}</div>`).join('')}
        </div>`;
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
    let tags = new Set();
    Object.entries(HASHTAG_DB).forEach(([cat, arr]) => {
        if (kw.includes(cat) || cat === 'default') arr.forEach(t => tags.add(t));
    });
    kw.split(/[,，、\s]+/).filter(Boolean).forEach(w => tags.add(w.replace(/\s/g,'')));
    const result = [...tags].slice(0, 20);
    const cloud = document.getElementById('ht-output');
    cloud.style.display = 'flex';
    cloud.innerHTML = result.map(t => `<span class="tag-item" onclick="this.classList.toggle('selected')">#${t}</span>`).join('');
    const copyBox = document.getElementById('ht-copy-box');
    copyBox.style.display = 'block';
    document.getElementById('ht-result').textContent = result.map(t => '#' + t).join(' ');
};

// ══════════════════════════════════
// 6. 薪資試算器
// ══════════════════════════════════
window.calcSalary = function() {
    const monthly = Number(document.getElementById('sal-monthly').value) || 0;
    if (!monthly) return alert('請輸入月薪');
    const overtime = Number(document.getElementById('sal-overtime').value) || 0;
    const bonus = Number(document.getElementById('sal-bonus').value) || 2;
    const gross = monthly + overtime;
    // 簡化計算
    const laborIns = Math.round(gross * 0.115 * 0.2); // 勞保自付 ~2.3%
    const healthIns = Math.round(gross * 0.0517 * 0.3); // 健保自付 ~1.55%
    const laborPension = Math.round(gross * 0.06); // 勞退 6% 雇主提撥
    const totalDeduct = laborIns + healthIns;
    const netMonthly = gross - totalDeduct;
    const annualGross = monthly * 12 + monthly * bonus + overtime * 12;
    const annualNet = netMonthly * 12 + monthly * bonus;
    const out = document.getElementById('salary-output');
    out.style.display = 'block';
    out.innerHTML = `
        <div class="result-grid">
            <div class="result-card"><div class="rc-label">月薪總額</div><div class="rc-value">$${gross.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">勞保自付</div><div class="rc-value" style="color:#ef4444;">-$${laborIns.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">健保自付</div><div class="rc-value" style="color:#ef4444;">-$${healthIns.toLocaleString()}</div></div>
            <div class="result-card" style="border-color:#10b981;"><div class="rc-label">每月實領（約）</div><div class="rc-value" style="color:#10b981;">$${netMonthly.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">年收入（含年終 ${bonus} 個月）</div><div class="rc-value">$${annualGross.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">雇主勞退提撥/月</div><div class="rc-value" style="color:#2563eb;">$${laborPension.toLocaleString()}</div></div>
        </div>
        <div style="margin-top:12px;font-size:0.72rem;color:#9ca3af;">* 以上為概估值，實際金額依投保級距和個人條件而異。</div>`;
};

// ══════════════════════════════════
// 7. 會議成本計算器
// ══════════════════════════════════
window.calcMeeting = function() {
    const people = Number(document.getElementById('mtg-people').value) || 1;
    const minutes = Number(document.getElementById('mtg-minutes').value) || 60;
    const salary = Number(document.getElementById('mtg-salary').value) || 50000;
    const hourlyRate = salary / 22 / 8; // 22 working days, 8 hours
    const meetingCost = Math.round(hourlyRate * (minutes / 60) * people);
    const perPerson = Math.round(meetingCost / people);
    const weeklyIf = meetingCost * 4;
    const yearlyIf = meetingCost * 50;
    const out = document.getElementById('meeting-output');
    out.style.display = 'block';
    out.innerHTML = `
        <div class="result-grid">
            <div class="result-card" style="border-color:#ef4444;"><div class="rc-label">本次會議成本</div><div class="rc-value" style="color:#ef4444;">$${meetingCost.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">每人成本</div><div class="rc-value">$${perPerson.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">若每週開一次/月</div><div class="rc-value" style="color:#f59e0b;">$${weeklyIf.toLocaleString()}</div></div>
            <div class="result-card"><div class="rc-label">若每週開一次/年</div><div class="rc-value" style="color:#ef4444;">$${yearlyIf.toLocaleString()}</div></div>
        </div>
        <div style="margin-top:16px;padding:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:0.82rem;color:#9a3412;">
            💡 <strong>小提醒：</strong>${people} 人 × ${minutes} 分鐘的會議，等於消耗了 <strong>${Math.round(people*minutes/60*10)/10} 人小時</strong>的生產力。
            確保每場會議都有明確議程和可執行的結論！
        </div>`;
};

// ══════════════════════════════════
// 8. 年假計算器
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
    const out = document.getElementById('leave-output');
    out.style.display = 'block';
    out.innerHTML = `
        <div class="result-grid">
            <div class="result-card"><div class="rc-label">年資</div><div class="rc-value">${seniority}</div></div>
            <div class="result-card" style="border-color:#10b981;"><div class="rc-label">特休天數</div><div class="rc-value" style="color:#10b981;font-size:1.8rem;">${days} 天</div></div>
        </div>
        <div style="margin-top:12px;padding:14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;font-size:0.82rem;color:#065f46;">
            📅 依勞基法第 38 條：${note}
        </div>
        <div style="margin-top:8px;font-size:0.72rem;color:#9ca3af;">* 特休未休完，雇主應折算工資發給。</div>`;
};

// ══════════════════════════════════
// 9. 面試題目產生器
// ══════════════════════════════════
const IQ_TEMPLATES = {
    behavior: [
        '請分享一個你在工作中解決困難問題的經驗，你是如何分析和處理的？',
        '描述一次你與團隊成員意見不合的經驗，最後怎麼解決？',
        '請舉例說明你如何在壓力下完成一個重要的專案。',
        '談談你最自豪的一個工作成就，為什麼對你很重要？',
        '描述一次你必須快速學習新技能的經驗。'
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
    const out = document.getElementById('interview-output');
    out.style.display = 'block';
    out.innerHTML = `
        <div style="font-size:0.88rem;font-weight:700;margin-bottom:12px;">📋 ${role}（${level === 'junior' ? '初階' : level === 'mid' ? '中階' : '資深'}）面試題目</div>
        ${allQs.map(g => `
            <div style="margin-bottom:16px;">
                <div style="font-size:0.8rem;font-weight:700;color:#4b5563;margin-bottom:8px;">${g.cat}</div>
                ${g.qs.map((q, i) => `<div style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:6px;font-size:0.82rem;">
                    <span style="color:#9ca3af;margin-right:6px;">${i + 1}.</span>${q}
                </div>`).join('')}
            </div>
        `).join('')}
        <button class="btn btn-secondary btn-sm" onclick="generateInterviewQ()"><span class="material-symbols-outlined" style="font-size:16px;">refresh</span> 重新產生</button>`;
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
請將您的履歷寄至 hr@${company.toLowerCase().replace(/\s/g, '')}.com
或透過人力銀行投遞履歷。

#${title.replace(/\s/g, '')} #${industry} #${type} #招募 #徵才`;

    document.getElementById('jd-result').textContent = jd;
    document.getElementById('jd-output').style.display = 'block';
};
