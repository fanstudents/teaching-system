/**
 * inquiry-form.js — 企業諮詢表單 Modal（共用元件）
 * 使用方式：在頁面中加 <script src="scripts/inquiry-form.js"></script>
 * 開啟：openInquiryForm('training') 或 openInquiryForm('integration')
 */
(function () {
    const SUPABASE_URL = 'https://wsaknnhjgiqmkendeyrj.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzYWtubmhqZ2lxbWtlbmRleXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTI4MTIsImV4cCI6MjA4NzY4ODgxMn0.1j-4D9Kw0vqhVcTWgU7ABTJ_mO6aN4IB72Ojof8Yfko';

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
    .inq-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);z-index:9998;opacity:0;transition:opacity .3s;display:none}
    .inq-overlay.show{display:block;opacity:1}
    .inq-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(.95);background:#fff;border-radius:18px;width:92%;max-width:520px;max-height:90vh;overflow-y:auto;z-index:9999;box-shadow:0 20px 60px rgba(0,0,0,.2);opacity:0;transition:all .3s;display:none;font-family:'Noto Sans TC','Inter',sans-serif}
    .inq-modal.show{display:block;opacity:1;transform:translate(-50%,-50%) scale(1)}
    .inq-head{padding:24px 28px 0;display:flex;align-items:center;justify-content:space-between}
    .inq-head h3{margin:0;font-size:1.15rem;font-weight:700;color:#1e293b}
    .inq-close{background:none;border:none;width:36px;height:36px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#94a3b8;transition:all .15s}
    .inq-close:hover{background:#f1f5f9;color:#475569}
    .inq-body{padding:20px 28px 28px}
    .inq-body .fg{display:flex;flex-direction:column;gap:14px}
    .inq-body label{font-size:.78rem;font-weight:600;color:#475569;margin-bottom:3px;display:block}
    .inq-body input,.inq-body select,.inq-body textarea{width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.88rem;font-family:inherit;transition:border .2s;background:#fff;box-sizing:border-box}
    .inq-body input:focus,.inq-body select:focus,.inq-body textarea:focus{border-color:#da7756;outline:none;box-shadow:0 0 0 3px rgba(218,119,86,.1)}
    .inq-body textarea{resize:vertical;min-height:80px}
    .inq-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .inq-submit{width:100%;padding:12px;border:none;border-radius:12px;background:#da7756;color:#fff;font-size:.92rem;font-weight:700;cursor:pointer;transition:all .2s;margin-top:6px;font-family:inherit}
    .inq-submit:hover{background:#c4623e;transform:translateY(-1px)}
    .inq-submit:disabled{opacity:.6;transform:none;cursor:not-allowed}
    .inq-success{text-align:center;padding:40px 20px}
    .inq-success svg{margin-bottom:16px}
    .inq-success h4{margin:0 0 8px;font-size:1.1rem;color:#1e293b}
    .inq-success p{margin:0;font-size:.85rem;color:#64748b}
    @media(max-width:480px){.inq-row{grid-template-columns:1fr}.inq-modal{width:96%}}
    `;
    document.head.appendChild(style);

    // Build modal
    const overlay = document.createElement('div');
    overlay.className = 'inq-overlay';
    overlay.addEventListener('click', closeInquiryForm);

    const modal = document.createElement('div');
    modal.className = 'inq-modal';
    modal.innerHTML = `
    <div class="inq-head">
        <h3 id="inq-title">企業諮詢表單</h3>
        <button class="inq-close" onclick="closeInquiryForm()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    </div>
    <div class="inq-body" id="inq-body">
        <div class="fg">
            <input type="hidden" id="inq-type" value="training">
            <div>
                <label>姓名 / 稱呼 *</label>
                <input type="text" id="inq-name" placeholder="王小明" required>
            </div>
            <div>
                <label>公司名稱</label>
                <input type="text" id="inq-company" placeholder="ABC 科技股份有限公司">
            </div>
            <div class="inq-row">
                <div>
                    <label>Email *</label>
                    <input type="email" id="inq-email" placeholder="name@company.com" required>
                </div>
                <div>
                    <label>聯絡電話</label>
                    <input type="tel" id="inq-phone" placeholder="0912-345-678">
                </div>
            </div>
            <div class="inq-row">
                <div>
                    <label>諮詢類型</label>
                    <select id="inq-inquiry-type">
                        <option value="training">AI 企業內訓</option>
                        <option value="integration">AI 系統導入</option>
                        <option value="consulting">AI 顧問諮詢</option>
                        <option value="other">其他</option>
                    </select>
                </div>
                <div>
                    <label>團隊規模</label>
                    <select id="inq-team-size">
                        <option value="">請選擇</option>
                        <option value="1-10">1-10 人</option>
                        <option value="11-50">11-50 人</option>
                        <option value="51-200">51-200 人</option>
                        <option value="200+">200+ 人</option>
                    </select>
                </div>
            </div>
            <div>
                <label>需求說明</label>
                <textarea id="inq-message" placeholder="請簡述您的需求，我們會盡快與您聯繫…"></textarea>
            </div>
            <button class="inq-submit" id="inq-submit-btn" onclick="submitInquiry()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                送出諮詢
            </button>
        </div>
    </div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    // API
    window.openInquiryForm = function (type) {
        const typeMap = { training: 'AI 企業內訓諮詢', integration: 'AI 系統導入諮詢', consulting: 'AI 顧問諮詢', other: '諮詢表單' };
        document.getElementById('inq-title').textContent = typeMap[type] || '企業諮詢表單';
        document.getElementById('inq-type').value = type || 'training';
        const sel = document.getElementById('inq-inquiry-type');
        if (sel) sel.value = type || 'training';
        // Reset form
        ['inq-name', 'inq-company', 'inq-email', 'inq-phone', 'inq-message'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('inq-body').querySelectorAll('.inq-success').forEach(e => e.remove());
        document.getElementById('inq-body').querySelector('.fg').style.display = '';
        overlay.classList.add('show');
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    };

    window.closeInquiryForm = function () {
        overlay.classList.remove('show');
        modal.classList.remove('show');
        document.body.style.overflow = '';
    };

    window.submitInquiry = async function () {
        const name = document.getElementById('inq-name').value.trim();
        const email = document.getElementById('inq-email').value.trim();
        if (!name || !email) return alert('請填寫姓名與 Email');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert('請輸入有效的 Email');

        const btn = document.getElementById('inq-submit-btn');
        btn.disabled = true;
        btn.textContent = '送出中...';

        const payload = {
            name,
            company: document.getElementById('inq-company').value.trim(),
            email,
            phone: document.getElementById('inq-phone').value.trim(),
            inquiry_type: document.getElementById('inq-inquiry-type').value,
            team_size: document.getElementById('inq-team-size').value,
            message: document.getElementById('inq-message').value.trim(),
            source_page: location.pathname.split('/').pop() || 'unknown'
        };

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/enterprise_inquiries`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(await res.text());

            // Success
            const body = document.getElementById('inq-body');
            body.querySelector('.fg').style.display = 'none';
            const success = document.createElement('div');
            success.className = 'inq-success';
            success.innerHTML = `
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none"><circle cx="28" cy="28" r="28" fill="#ecfdf5"/><path d="M18 28l7 7 13-13" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <h4>諮詢已送出！</h4>
                <p>感謝您的詢問，我們會在 1-2 個工作天內與您聯繫。</p>
                <button onclick="closeInquiryForm()" style="margin-top:20px;padding:10px 28px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;font-size:.85rem;font-weight:600;color:#475569;font-family:inherit">關閉</button>`;
            body.appendChild(success);
        } catch (err) {
            console.error('Inquiry submit error:', err);
            alert('送出失敗，請稍後再試或直接來信 service@tbr.digital');
            btn.disabled = false;
            btn.textContent = '送出諮詢';
        }
    };

    // ESC close
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeInquiryForm(); });
})();
