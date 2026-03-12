/**
 * 全站後台導航 — 永久固定左側 Sidebar + Auth Guard
 * 在任何後台頁面 <script src="components/nav.js"></script> 即可自動注入
 *
 * Auth: 未登入自動重導 login.html
 * 桌面版：永久固定左側
 * 移動版：hamburger 觸發展開
 */

// ── Auth Guard (non-module, uses Supabase GoTrue API) ──
(function () {
    const SUPABASE_URL = 'https://wsaknnhjgiqmkendeyrj.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_RRbhQpB2zcqeHc6Cds8fgA_jVWyvdyF';
    const PUBLIC_PAGES = ['login', 'affiliate-register', 'portal', 'student', 'index', 'pre-class', 'post-class'];
    const page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
    if (PUBLIC_PAGES.includes(page)) return;

    const token = localStorage.getItem('_at') || sessionStorage.getItem('_at');
    const refreshToken = localStorage.getItem('_rt') || sessionStorage.getItem('_rt');

    async function checkAuth() {
        // Try existing access token
        if (token) {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) return true;
        }
        // Try refresh
        if (refreshToken) {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.access_token) { localStorage.setItem('_at', data.access_token); sessionStorage.setItem('_at', data.access_token); }
                if (data.refresh_token) { localStorage.setItem('_rt', data.refresh_token); sessionStorage.setItem('_rt', data.refresh_token); }
                return true;
            }
        }
        return false;
    }

    checkAuth().then(ok => {
        if (!ok) {
            localStorage.removeItem('_at');
            localStorage.removeItem('_rt');
            sessionStorage.removeItem('_at');
            sessionStorage.removeItem('_rt');
            const redirect = encodeURIComponent(location.pathname + location.search + location.hash);
            location.replace(`login.html?redirect=${redirect}`);
        }
    });
})();

const NAV_ITEMS = [
    {
        group: '教學管理',
        items: [
            { label: '專案管理', icon: 'space_dashboard', href: 'manage.html' },
            { label: '開課單位', icon: 'apartment', href: 'organizations.html' },
        ]
    },
    {
        group: '素材與新聞',
        items: [
            { label: '新聞總覽', icon: 'newspaper', href: 'news-dashboard.html' },
            { label: '素材庫', icon: 'palette', href: 'assets.html' },
        ]
    },
    {
        group: '合作管理',
        items: [
            { label: '聯盟行銷', icon: 'campaign', href: 'partners.html#affiliates' },
            { label: '講師管理', icon: 'school', href: 'partners.html#instructors' },
        ]
    },
    {
        group: '系統',
        items: [
            { label: '會員管理', icon: 'group', href: 'members.html' },
            { label: '系統設置', icon: 'settings', href: 'settings.html' },
        ]
    }
];

function getCurrentPage() {
    const path = location.pathname;
    const file = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    return file;
}

function createAdminSidebar() {
    const currentPage = getCurrentPage();

    // -- Overlay (mobile) --
    const overlay = document.createElement('div');
    overlay.className = 'admin-sidebar-overlay';
    overlay.addEventListener('click', closeAdminSidebar);

    // -- Sidebar --
    const sidebar = document.createElement('nav');
    sidebar.className = 'admin-sidebar';
    sidebar.id = 'adminSidebar';

    const groupsHtml = NAV_ITEMS.map((group, idx) => `
        ${idx > 0 ? '<div class="admin-sidebar-divider"></div>' : ''}
        <div class="admin-sidebar-group">
            <div class="admin-sidebar-group-label">${group.group}</div>
            ${group.items.map(item => {
        const [hrefPath, hrefQuery] = item.href.split('?');
        const itemFile = hrefPath.split('#')[0];
        const itemHash = hrefPath.includes('#') ? hrefPath.split('#')[1] : '';
        let isActive = false;
        if (itemFile === currentPage) {
            if (hrefQuery) {
                isActive = location.search === '?' + hrefQuery;
            } else if (itemHash) {
                isActive = location.hash === '#' + itemHash;
            } else {
                // Only active if no type param for base manage.html
                isActive = !location.search.includes('type=');
            }
        }
        return `
                <a class="admin-sidebar-item${isActive ? ' active' : ''}"
                   href="${item.href}">
                    <span class="material-symbols-outlined">${item.icon}</span>
                    ${item.label}
                </a>`;
    }).join('')}
        </div>
    `).join('');

    sidebar.innerHTML = `
        <div class="admin-sidebar-brand">
            <div class="admin-sidebar-brand-icon">
                <span class="material-symbols-outlined">school</span>
            </div>
            <span class="admin-sidebar-brand-text">數位簡報室</span>
        </div>
        <div class="admin-sidebar-nav">
            ${groupsHtml}
        </div>
        <div class="admin-sidebar-footer">
            <button id="btnLogout" style="background:none;border:1px solid #ddd;border-radius:6px;padding:6px 12px;font-size:0.75rem;font-family:inherit;color:#888;cursor:pointer;display:flex;align-items:center;gap:4px;width:100%;justify-content:center;transition:all 0.15s;"
                onmouseover="this.style.background='#f5f5f5';this.style.color='#333'"
                onmouseout="this.style.background='none';this.style.color='#888'">
                <span class="material-symbols-outlined" style="font-size:0.9rem;">logout</span> 登出
            </button>
        </div>
    `;

    document.body.prepend(sidebar);
    document.body.prepend(overlay);

    // Logout handler
    document.getElementById('btnLogout')?.addEventListener('click', async () => {
        const token = localStorage.getItem('_at') || sessionStorage.getItem('_at');
        if (token) {
            await fetch('https://wsaknnhjgiqmkendeyrj.supabase.co/auth/v1/logout', {
                method: 'POST',
                headers: {
                    'apikey': 'sb_publishable_RRbhQpB2zcqeHc6Cds8fgA_jVWyvdyF',
                    'Authorization': `Bearer ${token}`
                }
            }).catch(() => { });
        }
        sessionStorage.removeItem('_at');
        sessionStorage.removeItem('_rt');
        localStorage.removeItem('_at');
        localStorage.removeItem('_rt');
        location.replace('login.html');
    });

    return { overlay, sidebar };
}

function injectHamburger() {
    const btn = document.createElement('button');
    btn.className = 'admin-hamburger';
    btn.title = '選單';
    btn.innerHTML = '<span class="material-symbols-outlined">menu</span>';
    btn.addEventListener('click', toggleAdminSidebar);

    // Insert into admin-header if exists
    const header = document.querySelector('.admin-header');
    if (header) {
        const title = header.querySelector('.admin-header-title');
        if (title) {
            title.prepend(btn);
        } else {
            header.prepend(btn);
        }
    } else {
        // fallback: fixed position
        btn.style.cssText = 'position:fixed;top:12px;left:12px;z-index:190;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.1);';
        document.body.appendChild(btn);
    }
}

function openAdminSidebar() {
    document.querySelector('.admin-sidebar-overlay')?.classList.add('open');
    document.getElementById('adminSidebar')?.classList.add('open');
}

function closeAdminSidebar() {
    document.querySelector('.admin-sidebar-overlay')?.classList.remove('open');
    document.getElementById('adminSidebar')?.classList.remove('open');
}

function toggleAdminSidebar() {
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('adminSidebar');
        if (sidebar?.classList.contains('open')) {
            closeAdminSidebar();
        } else {
            openAdminSidebar();
        }
    } else {
        document.body.classList.toggle('sidebar-closed');
        localStorage.setItem('sidebar-closed', document.body.classList.contains('sidebar-closed'));
    }
}

// Keyboard support
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAdminSidebar();
});

// -- Auto-init --
// Student-facing pages should NOT get the admin sidebar
const STUDENT_PAGES = ['portal', 'student', 'pre-class', 'post-class'];
const _currentFile = getCurrentPage().replace(/\.html$/, '');
if (!STUDENT_PAGES.includes(_currentFile)) {
    if (localStorage.getItem('sidebar-closed') === 'true') {
        document.body.classList.add('sidebar-closed');
    }
    createAdminSidebar();
    injectHamburger();
}

// Expose for external use
window.openGlobalNav = openAdminSidebar;
window.closeGlobalNav = closeAdminSidebar;
window.toggleGlobalNav = toggleAdminSidebar;
