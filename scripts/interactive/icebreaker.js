/**
 * 破冰元件 — 在線學員牆
 * 即時顯示目前已上線的學員頭像 + 名字，帶動態入場動畫
 */
import { stateManager } from './stateManager.js';

export class IcebreakerGame {
    constructor() {
        this._pollInterval = null;
        this._currentStudents = [];
    }

    /**
     * 學員端 / 播放模式渲染
     */
    async render(container, element) {
        const title = element.icebreakerTitle || '🎉 歡迎來到課堂！';
        const subtitle = element.icebreakerSubtitle || '看看誰已經上線了？';
        const layout = element.icebreakerLayout || 'grid'; // 'grid' | 'bubble'

        container.innerHTML = `
            <div class="icebreaker-widget" data-layout="${layout}">
                <div class="icebreaker-header">
                    <div class="icebreaker-title">${this._esc(title)}</div>
                    <div class="icebreaker-subtitle">${this._esc(subtitle)}</div>
                    <div class="icebreaker-count">
                        <span class="icebreaker-dot"></span>
                        <span class="icebreaker-count-text">0 人在線</span>
                    </div>
                </div>
                <div class="icebreaker-grid"></div>
            </div>
        `;

        this._startPolling(container, element);
    }

    /**
     * 輪詢在線學員
     */
    _startPolling(container, element) {
        if (this._pollInterval) clearInterval(this._pollInterval);

        const update = () => this._updateStudents(container, element);
        update();
        this._pollInterval = setInterval(update, 4000);
    }

    async _updateStudents(container, element) {
        // 從 stateManager 的 channel 或直接讀取 heartbeat 資料
        const grid = container.querySelector('.icebreaker-grid');
        const countText = container.querySelector('.icebreaker-count-text');
        if (!grid) return;

        // 嘗試從全域 onlineStudents 讀取（由 app.js 廣播管理）
        let students = [];
        if (window._onlineStudents) {
            students = [...window._onlineStudents.values()];
        } else if (window._icebreakerStudents) {
            students = window._icebreakerStudents;
        }

        // 偵測新加入的學員
        const prevIds = new Set(this._currentStudents.map(s => s.email || s.id));
        const newStudents = students.filter(s => !prevIds.has(s.email || s.id));
        this._currentStudents = students;

        if (countText) {
            countText.textContent = `${students.length} 人在線`;
        }

        // 20+ 人自動切換精簡模式
        const widget = container.querySelector('.icebreaker-widget');
        if (widget) {
            widget.classList.toggle('icebreaker-compact', students.length >= 20);
        }

        // 只新增，不重繪全部（避免動畫閃爍）
        const existingIds = new Set();
        grid.querySelectorAll('.icebreaker-avatar').forEach(el => {
            existingIds.add(el.dataset.id);
        });

        // 移除已離線的
        grid.querySelectorAll('.icebreaker-avatar').forEach(el => {
            const id = el.dataset.id;
            if (!students.find(s => (s.email || s.id) === id)) {
                el.classList.add('icebreaker-exit');
                setTimeout(() => el.remove(), 300);
            }
        });

        // 新增剛上線的
        for (const s of students) {
            const id = s.email || s.id;
            if (existingIds.has(id)) continue;

            const card = document.createElement('div');
            card.className = 'icebreaker-avatar icebreaker-enter';
            card.dataset.id = id;

            const initials = this._getInitials(s.name || s.email || '?');
            const hue = this._nameToHue(s.name || s.email || '');
            const isNew = newStudents.some(ns => (ns.email || ns.id) === id);

            card.innerHTML = `
                <div class="icebreaker-avatar-circle" style="--hue:${hue}">
                    <span class="icebreaker-initials">${this._esc(initials)}</span>
                </div>
                <div class="icebreaker-name">${this._esc(this._truncName(s.name || s.email || '匿名'))}</div>
                ${isNew ? '<div class="icebreaker-new-badge">NEW</div>' : ''}
            `;

            grid.appendChild(card);
            // 觸發入場動畫
            requestAnimationFrame(() => card.classList.remove('icebreaker-enter'));
        }
    }

    /**
     * 編輯器預覽
     */
    renderPreview(container, element) {
        const title = element.icebreakerTitle || '🎉 歡迎來到課堂！';
        const subtitle = element.icebreakerSubtitle || '看看誰已經上線了？';
        const demoNames = ['Alice', '小明', 'Bob', '小華', 'Carol', '大偉', '小美', '阿強'];

        container.innerHTML = `
            <div class="icebreaker-widget icebreaker-preview">
                <div class="icebreaker-header">
                    <div class="icebreaker-title">${this._esc(title)}</div>
                    <div class="icebreaker-subtitle">${this._esc(subtitle)}</div>
                    <div class="icebreaker-count">
                        <span class="icebreaker-dot"></span>
                        <span class="icebreaker-count-text">${demoNames.length} 人在線</span>
                    </div>
                </div>
                <div class="icebreaker-grid">
                    ${demoNames.map(name => {
                        const hue = this._nameToHue(name);
                        const initials = this._getInitials(name);
                        return `
                            <div class="icebreaker-avatar">
                                <div class="icebreaker-avatar-circle" style="--hue:${hue}">
                                    <span class="icebreaker-initials">${this._esc(initials)}</span>
                                </div>
                                <div class="icebreaker-name">${this._esc(name)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    destroy() {
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
    }

    _getInitials(name) {
        if (!name) return '?';
        // CJK: first char; Latin: first 2 chars
        const trimmed = name.trim();
        if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(trimmed)) {
            return trimmed.slice(-2); // 中文取後兩字
        }
        return trimmed.slice(0, 2).toUpperCase();
    }

    _nameToHue(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash) % 360;
    }

    _truncName(name) {
        return name.length > 6 ? name.slice(0, 6) + '…' : name;
    }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
