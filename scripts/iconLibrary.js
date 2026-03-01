/**
 * Icon 圖庫模組
 * 使用 Iconify API 搜尋並插入 SVG icon 到投影片
 */

// 預設常用 icon（開啟時直接顯示）
const DEFAULT_ICONS = [
    // 教學常用
    'mdi:school', 'mdi:book-open-variant', 'mdi:lightbulb-on', 'mdi:brain',
    'mdi:pencil', 'mdi:clipboard-text', 'mdi:notebook', 'mdi:presentation',
    'mdi:human-male-board', 'mdi:trophy', 'mdi:star', 'mdi:puzzle',
    // 科技/AI
    'mdi:robot', 'mdi:chip', 'mdi:code-tags', 'mdi:database',
    'mdi:cloud', 'mdi:language-python', 'mdi:api', 'mdi:cog',
    'mdi:monitor', 'mdi:cellphone', 'mdi:wifi', 'mdi:bluetooth',
    // 商務
    'mdi:chart-bar', 'mdi:chart-line', 'mdi:chart-pie', 'mdi:finance',
    'mdi:briefcase', 'mdi:handshake', 'mdi:target', 'mdi:trending-up',
    'mdi:cash-multiple', 'mdi:account-group', 'mdi:calendar', 'mdi:clock-outline',
    // 溝通/社交
    'mdi:chat', 'mdi:email', 'mdi:phone', 'mdi:video',
    'mdi:share-variant', 'mdi:thumb-up', 'mdi:heart', 'mdi:bell',
    // 箭頭/指示
    'mdi:arrow-right-bold', 'mdi:arrow-left-bold', 'mdi:arrow-up-bold', 'mdi:arrow-down-bold',
    'mdi:chevron-right', 'mdi:check-circle', 'mdi:close-circle', 'mdi:alert-circle',
    // 媒體/內容
    'mdi:image', 'mdi:play-circle', 'mdi:music', 'mdi:file-document',
    'mdi:folder', 'mdi:download', 'mdi:upload', 'mdi:link',
    // 物件/其他
    'mdi:earth', 'mdi:map-marker', 'mdi:home', 'mdi:magnify',
    'mdi:lock', 'mdi:shield-check', 'mdi:fire', 'mdi:flash',
];

export class IconLibrary {
    constructor(slideManager) {
        this.slideManager = slideManager;
        this.overlay = document.getElementById('iconLibOverlay');
        this.body = document.getElementById('iconLibBody');
        this.searchInput = document.getElementById('iconSearchInput');
        this.setFilter = document.getElementById('iconSetFilter');
        this.colorPicker = document.getElementById('iconColorPicker');
        this.sizeSelect = document.getElementById('iconSizeSelect');
        this._debounceTimer = null;

        this.bindEvents();
    }

    bindEvents() {
        // 開關 Modal
        document.getElementById('openIconLibBtn')?.addEventListener('click', () => this.open());
        document.getElementById('iconLibClose')?.addEventListener('click', () => this.close());
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // 搜尋（debounce 300ms）
        this.searchInput?.addEventListener('input', () => {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => this.search(), 300);
        });

        // 切換圖庫重新搜尋
        this.setFilter?.addEventListener('change', () => this.search());

        // 顏色變更時重新渲染目前結果
        this.colorPicker?.addEventListener('input', () => {
            if (this._lastResults) {
                this.renderResults(this._lastResults);
            } else {
                this.showDefaults();
            }
        });
    }

    open() {
        this.overlay.classList.add('active');
        this.showDefaults();
        setTimeout(() => this.searchInput?.focus(), 100);
    }

    close() {
        this.overlay.classList.remove('active');
    }

    showDefaults() {
        this._lastResults = null;
        this.renderResults(DEFAULT_ICONS, true);
    }

    async search() {
        const query = this.searchInput?.value?.trim();
        if (!query || query.length < 2) {
            this.showDefaults();
            return;
        }

        this.body.innerHTML = `
            <div class="icon-lib-loading">
                <span class="material-symbols-outlined spinning">progress_activity</span>
                <p>搜尋中…</p>
            </div>`;

        try {
            const prefix = this.setFilter?.value || '';
            let url = `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=60`;
            if (prefix) url += `&prefix=${prefix}`;

            const res = await fetch(url);
            const data = await res.json();

            if (!data.icons || data.icons.length === 0) {
                this.body.innerHTML = `
                    <div class="icon-lib-empty">
                        <span class="material-symbols-outlined" style="font-size:48px;color:#d1d5db;">search_off</span>
                        <p>找不到「${query}」的結果</p>
                        <p style="font-size:0.75rem;color:#94a3b8;">試試其他英文關鍵字</p>
                    </div>`;
                return;
            }

            this._lastResults = data.icons;
            this.renderResults(data.icons);
        } catch (err) {
            console.error('[IconLib] search error:', err);
            this.body.innerHTML = `
                <div class="icon-lib-empty">
                    <span class="material-symbols-outlined" style="font-size:48px;color:#fca5a5;">cloud_off</span>
                    <p>搜尋失敗，請檢查網路連線</p>
                </div>`;
        }
    }

    renderResults(icons, isDefault = false) {
        const color = this.colorPicker?.value || '#1e293b';
        const heading = isDefault
            ? '<div class="icon-lib-section-title">常用 Icon — 點擊直接插入，或搜尋更多</div>'
            : '';
        this.body.innerHTML = `
            ${heading}
            <div class="icon-lib-grid">
                ${icons.map(icon => {
            const svgUrl = `https://api.iconify.design/${icon}.svg?color=${encodeURIComponent(color)}&width=48&height=48`;
            const label = icon.split(':')[1] || icon;
            return `<button class="icon-lib-item" data-icon="${icon}" title="${icon}">
                        <img src="${svgUrl}" alt="${label}" loading="lazy">
                        <span>${label.length > 12 ? label.substring(0, 12) + '…' : label}</span>
                    </button>`;
        }).join('')}
            </div>`;

        // 點擊插入
        this.body.querySelectorAll('.icon-lib-item').forEach(btn => {
            btn.addEventListener('click', () => this.insertIcon(btn.dataset.icon));
        });
    }

    async insertIcon(iconName) {
        const color = this.colorPicker?.value || '#1e293b';
        const size = parseInt(this.sizeSelect?.value || '80');

        try {
            const svgUrl = `https://api.iconify.design/${iconName}.svg?color=${encodeURIComponent(color)}&width=${size}&height=${size}`;
            const res = await fetch(svgUrl);
            const svgText = await res.text();

            const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;

            const element = {
                type: 'image',
                x: 150,
                y: 150,
                width: size,
                height: size,
                src: dataUrl,
                iconName: iconName
            };

            this.slideManager.addElement(element);
            this.close();

            if (window.app?.showToast) {
                window.app.showToast(`已插入 icon: ${iconName.split(':')[1] || iconName}`);
            }
        } catch (err) {
            console.error('[IconLib] insert error:', err);
        }
    }
}
