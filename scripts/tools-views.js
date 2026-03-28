/**
 * tools-views.js — 動態注入所有工具的詳細頁面（含使用說明）
 */
(function(){
const container = document.getElementById('tool-views-container');
if(!container) return;

const SVG = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M15 18l-6-6 6-6"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>',
    hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    guide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="16" y1="10" x2="16.01" y2="10"/></svg>',
    analytics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
};

function backBtn(){ return `<button class="detail-back" onclick="goHome()">${SVG.back} 返回工具列表</button>`; }
function guideBlock(title, content){
    return `<button class="guide-toggle" onclick="toggleGuide(this)">${SVG.guide} 使用說明與教學</button>
    <div class="guide-content"><div class="guide-inner">${content}</div></div>`;
}

const views = [
// ── UTM ──
{id:'utm', html:`${backBtn()}<div class="detail-card">
<h2>${SVG.link} UTM 連結產生器</h2>
<p class="desc">快速產生帶有 UTM 追蹤參數的網址，支援批次產生、歷史紀錄與常用範本。精準追蹤每個行銷渠道的流量來源。</p>
${guideBlock('使用說明',`<h4>功能說明</h4><p>UTM（Urchin Tracking Module）參數是 Google Analytics 用來追蹤流量來源的標準方式。透過本工具，你可以快速為任何網址添加追蹤參數。</p>
<h4>操作步驟</h4><ol><li>輸入目標網址（必填）</li><li>填入 Source（流量來源，如 facebook、newsletter）</li><li>填入 Medium（媒介類型，如 cpc、email、social）</li><li>選填 Campaign、Term、Content</li><li>點擊「產生連結」即可取得完整追蹤網址</li></ol>
<h4>進階技巧</h4><ul><li>命名規則建議統一使用小寫、底線分隔（如 spring_sale_2026）</li><li>utm_content 可用來區分同一活動中的不同素材（如 banner_a vs banner_b）</li><li>產生的連結會自動儲存至歷史紀錄，方便日後查閱</li></ul>
<div class="tip">💡 建議搭配 Google Analytics 4 的「流量開發」報表，即可即時看到追蹤成效。</div>`)}
<div class="form-group"><label class="form-label">網站網址 *</label><input class="form-input" id="utm-url" placeholder="https://example.com/page"></div>
<div class="form-row">
    <div class="form-group"><label class="form-label">Campaign Source *</label><input class="form-input" id="utm-source" placeholder="facebook, google"><div class="form-hint">流量來源平台</div></div>
    <div class="form-group"><label class="form-label">Campaign Medium *</label><input class="form-input" id="utm-medium" placeholder="cpc, email, social"><div class="form-hint">行銷媒介</div></div>
</div>
<div class="form-row">
    <div class="form-group"><label class="form-label">Campaign Name</label><input class="form-input" id="utm-campaign" placeholder="spring_sale_2026"></div>
    <div class="form-group"><label class="form-label">Campaign Term</label><input class="form-input" id="utm-term" placeholder="付費關鍵字"></div>
</div>
<div class="form-group"><label class="form-label">Campaign Content</label><input class="form-input" id="utm-content" placeholder="區分不同素材 (banner_a)"></div>
<button class="btn btn-primary" onclick="generateUTM()">${SVG.bolt} 產生連結</button>
<div class="output-box" id="utm-output" style="display:none"><button class="copy-btn" onclick="copyOutput('utm-output')">複製</button><pre id="utm-result"></pre></div>
<div class="history-section" id="utm-history-section" style="display:none"><div class="history-title">歷史紀錄 <button class="history-clear" onclick="clearHistory('utm')">清除</button></div><div class="history-list" id="utm-history"></div></div>
</div>`},

// ── QR Code ──
{id:'qrcode', html:`${backBtn()}<div class="detail-card">
<h2>${SVG.qr} QR Code 產生器</h2>
<p class="desc">輸入任何網址或文字，立即產生 QR Code 圖片。支援自訂顏色、尺寸選擇與批次產生。</p>
${guideBlock('使用說明',`<h4>功能說明</h4><p>本工具使用 QR Server API 即時生成 QR Code，支援任何文字、網址、Email、電話號碼等內容。</p>
<h4>操作步驟</h4><ol><li>在輸入框中填入要編碼的內容（網址、文字等）</li><li>選擇 QR Code 尺寸（200-500px）</li><li>選擇顏色（預設黑色）</li><li>點擊「產生 QR Code」</li><li>右鍵或點擊下載按鈕保存圖片</li></ol>
<h4>使用情境</h4><ul><li>名片上放置個人網站/LinkedIn 連結</li><li>活動海報加入報名表單連結</li><li>餐廳菜單加入線上點餐系統</li><li>產品包裝加入說明書連結</li></ul>
<div class="tip">💡 深色背景搭配淺色 QR Code 時，請確保對比度足夠，否則手機相機可能無法辨識。</div>`)}
<div class="form-group"><label class="form-label">網址或文字 *</label><input class="form-input" id="qr-text" placeholder="https://example.com"></div>
<div class="form-row">
    <div class="form-group"><label class="form-label">尺寸</label><select class="form-select" id="qr-size"><option value="200">200×200</option><option value="300" selected>300×300</option><option value="500">500×500</option></select></div>
    <div class="form-group"><label class="form-label">顏色</label><input type="color" id="qr-color" value="#000000" class="form-input" style="height:38px;padding:3px"></div>
</div>
<button class="btn btn-primary" onclick="generateQR()">${SVG.qr} 產生 QR Code</button>
<div id="qr-output" style="margin-top:16px;text-align:center;display:none"></div>
</div>`},

// ── Social Counter ──
{id:'social-counter', html:`${backBtn()}<div class="detail-card">
<h2>${SVG.chat} 社群貼文字數檢測器</h2>
<p class="desc">即時檢測貼文字數，確保符合各社群平台的字數限制。額外提供可讀性分析與 Emoji 統計。</p>
${guideBlock('使用說明',`<h4>功能說明</h4><p>各社群平台都有不同的字數限制。本工具即時計算你的貼文內容，顯示各平台的使用率，幫助你在發文前確保不會被截斷。</p>
<h4>各平台字數限制</h4><ul><li><strong>Twitter / X:</strong> 280 字元</li><li><strong>Facebook:</strong> 63,206 字元（但建議 40-80 字元效果最佳）</li><li><strong>Instagram:</strong> 2,200 字元</li><li><strong>LinkedIn:</strong> 3,000 字元</li><li><strong>Threads:</strong> 500 字元</li></ul>
<div class="tip">💡 研究顯示，Facebook 貼文 40-80 字的互動率最高。Instagram 建議在第一行就抓住注意力。</div>`)}
<div class="form-group"><label class="form-label">貼文內容</label><textarea class="form-textarea" id="social-text" rows="5" placeholder="在此輸入你的貼文..." oninput="checkSocialLength()"></textarea></div>
<div class="result-grid" id="social-results">
    <div class="result-card"><div class="rc-label">字數</div><div class="rc-value" id="sc-chars">0</div></div>
    <div class="result-card"><div class="rc-label">Twitter / X</div><div class="rc-value" id="sc-twitter">0 / 280</div><div class="score-bar"><div class="score-fill" id="sc-twitter-bar" style="width:0;background:#1da1f2"></div></div></div>
    <div class="result-card"><div class="rc-label">Facebook</div><div class="rc-value" id="sc-fb">0 / 63,206</div><div class="score-bar"><div class="score-fill" id="sc-fb-bar" style="width:0;background:#1877f2"></div></div></div>
    <div class="result-card"><div class="rc-label">Instagram</div><div class="rc-value" id="sc-ig">0 / 2,200</div><div class="score-bar"><div class="score-fill" id="sc-ig-bar" style="width:0;background:#e4405f"></div></div></div>
    <div class="result-card"><div class="rc-label">LinkedIn</div><div class="rc-value" id="sc-li">0 / 3,000</div><div class="score-bar"><div class="score-fill" id="sc-li-bar" style="width:0;background:#0a66c2"></div></div></div>
    <div class="result-card"><div class="rc-label">Threads</div><div class="rc-value" id="sc-threads">0 / 500</div><div class="score-bar"><div class="score-fill" id="sc-threads-bar" style="width:0;background:#000"></div></div></div>
</div>
<div id="social-extra" style="margin-top:14px"></div>
</div>`},

// ── Email Score ──
{id:'email-score', html:`${backBtn()}<div class="detail-card">
<h2>${SVG.mail} Email 主旨評分器</h2>
<p class="desc">多維度分析 Email 主旨行品質，提供長度、情緒、行動力、個人化等評分與具體改善建議。支援 A/B 測試比較。</p>
${guideBlock('使用說明',`<h4>功能說明</h4><p>Email 開信率很大程度取決於主旨行的品質。本工具從 6 個維度分析你的主旨，並給出綜合評分與具體改善建議。</p>
<h4>評分維度</h4><ol><li><strong>長度:</strong> 最佳範圍 20-50 字（手機預覽約 30-40 字）</li><li><strong>Emoji:</strong> 適當使用可提升 15-25% 開信率</li><li><strong>數字:</strong> 含數字的主旨更具體、更有說服力</li><li><strong>緊迫感:</strong> 限時、倒數等詞彙能推動行動</li><li><strong>個人化:</strong> 含「你」「專屬」等詞增加親近感</li><li><strong>垃圾信檢測:</strong> 避免「免費」「中獎」等觸發詞</li></ol>
<div class="tip">💡 可以輸入兩個版本的主旨來做 A/B 比較，選出最佳版本。</div>`)}
<div class="form-group"><label class="form-label">Email 主旨 *</label><input class="form-input" id="email-subject" placeholder="限時 3 天！AI 課程 5 折優惠"></div>
<div class="form-group"><label class="form-label">A/B 測試：對照主旨（選填）</label><input class="form-input" id="email-subject-b" placeholder="輸入第二個主旨來比較"></div>
<button class="btn btn-primary" onclick="scoreEmail()">${SVG.analytics} 分析主旨</button>
<div id="email-output" style="display:none;margin-top:16px"></div>
</div>`},

// ── Hashtag ──
{id:'hashtag', html:`${backBtn()}<div class="detail-card">
<h2>${SVG.hash} Hashtag 產生器</h2>
<p class="desc">輸入主題關鍵字，自動產生適合各社群平台的 Hashtag 組合。含熱門度排序與分平台策略建議。</p>
${guideBlock('使用說明',`<h4>功能說明</h4><p>Hashtag 是社群媒體的重要曝光工具。本工具根據你的關鍵字，從內建資料庫中匹配相關標籤，並按平台特性推薦不同策略。</p>
<h4>各平台策略</h4><ul><li><strong>Instagram:</strong> 建議 20-30 個，混合大中小標籤</li><li><strong>Threads:</strong> 建議 3-5 個，精準即可</li><li><strong>Twitter / X:</strong> 建議 1-3 個，太多反而降低互動</li><li><strong>LinkedIn:</strong> 建議 3-5 個，以產業專業標籤為主</li></ul>
<div class="tip">💡 避免使用被禁的 hashtag（如 Instagram 的 shadowban 標籤），定期更換標籤組合保持新鮮度。</div>`)}
<div class="form-group"><label class="form-label">主題關鍵字 *</label><input class="form-input" id="ht-keyword" placeholder="AI教學、數位行銷"></div>
<div class="form-group"><label class="form-label">平台</label><select class="form-select" id="ht-platform"><option value="instagram">Instagram</option><option value="threads">Threads</option><option value="twitter">Twitter / X</option><option value="linkedin">LinkedIn</option></select></div>
<button class="btn btn-primary" onclick="generateHashtags()">${SVG.hash} 產生 Hashtag</button>
<div class="tag-cloud" id="ht-output" style="display:none"></div>
<div class="output-box" id="ht-copy-box" style="display:none"><button class="copy-btn" onclick="copyOutput('ht-copy-box')">複製</button><pre id="ht-result"></pre></div>
</div>`},

// ── Salary ──
{id:'salary', html:`${backBtn()}<div class="detail-card">
<h2>${SVG.dollar} 薪資試算器</h2>
<p class="desc">根據月薪計算勞健保自付額、所得稅預扣、年度實領、薪資結構分析（台灣適用）。</p>
${guideBlock('使用說明',`<h4>功能說明</h4><p>本工具根據台灣勞保、健保費率與所得稅級距，概估每月實領薪資與年收入。</p>
<h4>計算項目</h4><ul><li>勞保自付額（約 2.3%）</li><li>健保自付額（約 1.55%）</li><li>雇主勞退提撥（6%）</li><li>年終獎金試算</li></ul>
<h4>注意事項</h4><ul><li>實際金額依投保級距與個人條件而異</li><li>所得稅預扣依扶養人數調整</li><li>本工具為概估值，正式計算請洽會計師</li></ul>
<div class="tip">💡 勞退自提 6% 可以節稅，是不錯的理財策略。</div>`)}
<div class="form-row">
    <div class="form-group"><label class="form-label">月薪（TWD）*</label><input type="number" class="form-input" id="sal-monthly" placeholder="45000"></div>
    <div class="form-group"><label class="form-label">每月加班費</label><input type="number" class="form-input" id="sal-overtime" placeholder="0"></div>
</div>
<div class="form-row">
    <div class="form-group"><label class="form-label">扶養人數</label><select class="form-select" id="sal-dependents"><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4+</option></select></div>
    <div class="form-group"><label class="form-label">年終月數</label><input type="number" class="form-input" id="sal-bonus" placeholder="2" value="2"></div>
</div>
<button class="btn btn-primary" onclick="calcSalary()">${SVG.calc} 計算</button>
<div id="salary-output" style="display:none;margin-top:16px"></div>
</div>`},

// ── Meeting Cost ──
{id:'meeting-cost', html:`${backBtn()}<div class="detail-card">
<h2>${SVG.users} 會議成本計算器</h2>
<p class="desc">計算會議實際成本與效率評估，提供優化建議，讓團隊對時間的價值更有感。</p>
${guideBlock('使用說明',`<h4>功能說明</h4><p>每場會議都有隱形成本。本工具將參與人數、時間長度、平均薪資轉換為具體金額，幫助你評估會議的投資報酬率。</p>
<h4>如何使用</h4><ol><li>輸入參與會議的人數</li><li>輸入會議長度（分鐘）</li><li>拖動滑桿選擇平均月薪</li><li>點擊「計算成本」</li></ol>
<h4>會議效率建議</h4><ul><li>每場會議都應有明確議程</li><li>控制在 30 分鐘內解決問題</li><li>邀請最少必要人數</li><li>會後 5 分鐘內發出紀錄與待辦</li></ul>
<div class="tip">💡 根據 Harvard Business Review 研究，企業平均 71% 的會議被認為是無效的。</div>`)}
<div class="form-row">
    <div class="form-group"><label class="form-label">參與人數 *</label><input type="number" class="form-input" id="mtg-people" placeholder="5" value="5"></div>
    <div class="form-group"><label class="form-label">會議時長（分鐘）*</label><input type="number" class="form-input" id="mtg-minutes" placeholder="60" value="60"></div>
</div>
<div class="form-group"><label class="form-label">平均月薪（TWD）</label>
    <div class="range-row"><input type="range" id="mtg-salary" min="30000" max="150000" step="5000" value="50000" oninput="document.getElementById('mtg-sal-val').textContent='$'+Number(this.value).toLocaleString()"><span class="range-val" id="mtg-sal-val">$50,000</span></div>
</div>
<button class="btn btn-primary" onclick="calcMeeting()">${SVG.calc} 計算成本</button>
<div id="meeting-output" style="display:none;margin-top:16px"></div>
</div>`},

// ── Leave Calc ──
{id:'leave-calc', html:`${backBtn()}<div class="detail-card">
<h2>${SVG.calendar} 年假計算器</h2>
<p class="desc">根據到職日計算特休天數（依勞基法第 38 條規定），含多年資對照表與換算工資金額。</p>
${guideBlock('使用說明',`<h4>功能說明</h4><p>依據勞基法第 38 條，勞工依年資享有不同天數的特休假。本工具自動計算你目前應有的特休天數。</p>
<h4>特休天數對照</h4><ul><li>6 個月以上未滿 1 年：3 天</li><li>1 年以上未滿 2 年：7 天</li><li>2 年以上未滿 3 年：10 天</li><li>3 年以上未滿 5 年：14 天</li><li>5 年以上未滿 10 年：15 天</li><li>10 年以上：每年加 1 天（上限 30 天）</li></ul>
<div class="tip">💡 特休未休完，雇主應折算工資發給。計算方式：月薪÷30×未休天數。</div>`)}
<div class="form-group"><label class="form-label">到職日期 *</label><input type="date" class="form-input" id="leave-start"></div>
<button class="btn btn-primary" onclick="calcLeave()">${SVG.calendar} 計算特休</button>
<div id="leave-output" style="display:none;margin-top:16px"></div>
</div>`},

// ── Interview Q ──
{id:'interview-q', html:`${backBtn()}<div class="detail-card">
<h2>${SVG.question} 面試題目產生器</h2>
<p class="desc">根據職位和能力需求，產生結構化面試題目組合。含評分標準建議與 STAR 回答範本。</p>
${guideBlock('使用說明',`<h4>功能說明</h4><p>STAR 面試法（Situation-Task-Action-Result）是業界公認最有效的結構化面試方式。本工具產生的題目已按此框架設計。</p>
<h4>題目類型</h4><ul><li><strong>行為面試:</strong> 過去經驗與行為模式（預測未來表現）</li><li><strong>技術能力:</strong> 根據職位技能需求客製化</li><li><strong>文化適配:</strong> 團隊合作、價值觀、工作風格</li></ul>
<h4>面試官使用建議</h4><ul><li>每題給候選人 2-3 分鐘回答</li><li>用追問題深入了解細節</li><li>記錄關鍵字方便事後評分</li></ul>
<div class="tip">💡 可以點擊「重新產生」取得不同題目組合，建立完整題庫。</div>`)}
<div class="form-row">
    <div class="form-group"><label class="form-label">職位名稱 *</label><input class="form-input" id="iq-role" placeholder="前端工程師"></div>
    <div class="form-group"><label class="form-label">年資要求</label><select class="form-select" id="iq-level"><option value="junior">初階 (0-2年)</option><option value="mid">中階 (3-5年)</option><option value="senior">資深 (5年+)</option></select></div>
</div>
<div class="form-group"><label class="form-label">關鍵技能（逗號分隔）</label><input class="form-input" id="iq-skills" placeholder="React, TypeScript, 溝通能力"></div>
<button class="btn btn-primary" onclick="generateInterviewQ()">${SVG.question} 產生題目</button>
<div id="interview-output" style="display:none;margin-top:16px"></div>
</div>`},

// ── JD Gen ──
{id:'jd-gen', html:`${backBtn()}<div class="detail-card">
<h2>${SVG.file} 職缺描述產生器</h2>
<p class="desc">快速產生專業的職缺描述範本，含產業專用模板與 SEO 優化建議。</p>
${guideBlock('使用說明',`<h4>功能說明</h4><p>好的 JD（Job Description）能吸引合適的人才。本工具根據你輸入的職位資訊，自動產出結構化的職缺描述。</p>
<h4>輸出內容</h4><ul><li>職位描述與公司介紹</li><li>工作內容（根據你的輸入客製化）</li><li>必備與加分條件</li><li>薪資福利項目</li><li>應徵方式</li></ul>
<h4>JD 撰寫技巧</h4><ul><li>職位名稱要具體（避免「行銷助理」，改用「社群行銷專員」）</li><li>必備條件不超過 5 項</li><li>薪資範圍透明可提升 30% 投遞率</li><li>展示公司文化與福利吸引人才</li></ul>
<div class="tip">💡 產出的 JD 已包含 SEO 友善的 hashtag，直接複製到求職平台可提升曝光。</div>`)}
<div class="form-row">
    <div class="form-group"><label class="form-label">職位名稱 *</label><input class="form-input" id="jd-title" placeholder="行銷企劃專員"></div>
    <div class="form-group"><label class="form-label">公司名稱</label><input class="form-input" id="jd-company" placeholder="ABC 科技"></div>
</div>
<div class="form-row">
    <div class="form-group"><label class="form-label">產業</label><select class="form-select" id="jd-industry"><option>科技業</option><option>金融業</option><option>零售業</option><option>教育業</option><option>醫療業</option><option>製造業</option><option>其他</option></select></div>
    <div class="form-group"><label class="form-label">工作型態</label><select class="form-select" id="jd-type"><option>全職</option><option>兼職</option><option>遠端</option><option>混合辦公</option></select></div>
</div>
<div class="form-group"><label class="form-label">核心職責（逗號分隔）</label><input class="form-input" id="jd-duties" placeholder="內容行銷, 社群經營, 數據分析"></div>
<button class="btn btn-primary" onclick="generateJD()">${SVG.file} 產生職缺描述</button>
<div class="output-box" id="jd-output" style="display:none"><button class="copy-btn" onclick="copyOutput('jd-output')">複製</button><pre id="jd-result"></pre></div>
</div>`}
];

views.forEach(v=>{
    const div=document.createElement('div');
    div.className='tool-detail';
    div.id='view-'+v.id;
    div.innerHTML=v.html;
    container.appendChild(div);
});
})();
