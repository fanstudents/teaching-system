/**
 * 文件檢視器互動模組
 * 點擊卡片 → 展開全螢幕 overlay → 支援 Markdown/HTML 渲染 + 下載
 */

export class DocumentViewer {
    constructor() {
        this._overlay = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());

        // 事件代理：點擊文件卡片
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.document-card-container');
            if (!card) return;

            // 編輯模式下雙擊才打開（避免干擾拖曳）
            const isEditor = !!document.getElementById('slideCanvas');
            if (isEditor) return;

            e.stopPropagation();
            const elementId = card.dataset.elementId;
            this.openViewer(elementId);
        });

        // 簡報模式也用雙擊打開
        document.addEventListener('dblclick', (e) => {
            const card = e.target.closest('.document-card-container');
            if (!card) return;
            e.stopPropagation();
            const elementId = card.dataset.elementId;
            this.openViewer(elementId);
        });
    }

    init() {
        // 不需要做什麼，事件代理已處理
    }

    /**
     * 取得元素資料
     */
    _getElementData(elementId) {
        // 嘗試從 slideManager 取得
        if (window._app?.slideManager) {
            const slide = window._app.slideManager.getCurrentSlide();
            if (slide) {
                return slide.elements.find(e => e.id === elementId);
            }
        }
        // 嘗試從 presenter 取得
        if (window._presenterApp?.slides) {
            for (const s of window._presenterApp.slides) {
                const found = s.elements?.find(e => e.id === elementId);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * 簡易 Markdown → HTML 轉換器
     */
    parseMarkdown(md) {
        if (!md) return '';

        // 如果已經有 HTML 標籤，直接回傳（使用者貼了 HTML）
        if (/<[a-z][\s\S]*>/i.test(md) && !md.includes('```')) {
            return md;
        }

        let html = md
            // Code blocks (must be first)
            .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
                `<pre><code class="lang-${lang || 'text'}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Headers
            .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // Bold + Italic
            .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Images
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:8px 0;">')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            // Blockquotes
            .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
            // Horizontal rules
            .replace(/^---$/gm, '<hr>')
            // Unordered list
            .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
            // Ordered list
            .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
            // Wrap consecutive <li> in <ul>
            .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
            .replace(/<\/ul>\s*<ul>/g, '');

        // Paragraphs: wrap lines that aren't already wrapped
        html = html.split('\n').map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            if (/^<[a-z]/.test(trimmed)) return trimmed;
            return `<p>${trimmed}</p>`;
        }).join('\n');

        return html;
    }

    /**
     * 打開文件檢視器
     */
    openViewer(elementId) {
        const data = this._getElementData(elementId);
        if (!data) return;

        // 移除舊的 overlay
        this.closeViewer();

        const content = this.parseMarkdown(data.docContent || '');
        const hasDownload = !!data.docDownloadUrl;

        const overlay = document.createElement('div');
        overlay.className = 'doc-viewer-overlay';
        overlay.innerHTML = `
            <div class="doc-viewer-backdrop"></div>
            <div class="doc-viewer-panel">
                <div class="doc-viewer-header">
                    <div class="doc-viewer-title-row">
                        <span class="material-symbols-outlined" style="font-size:22px;color:#0284c7;">description</span>
                        <h2 class="doc-viewer-title">${data.docTitle || '文件'}</h2>
                    </div>
                    <div class="doc-viewer-actions">
                        ${hasDownload ? `
                            <a class="doc-viewer-download-btn" href="${data.docDownloadUrl}" download="${data.docDownloadName || ''}" target="_blank" rel="noopener"
                               onclick="event.stopPropagation();">
                                <span class="material-symbols-outlined" style="font-size:18px;">download</span>
                                下載文件
                            </a>
                        ` : ''}
                        <button class="doc-viewer-close-btn">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div class="doc-viewer-body">
                    <div class="doc-viewer-content">${content}</div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this._overlay = overlay;

        // 動畫進入
        requestAnimationFrame(() => overlay.classList.add('open'));

        // 關閉事件
        overlay.querySelector('.doc-viewer-close-btn').addEventListener('click', () => this.closeViewer());
        overlay.querySelector('.doc-viewer-backdrop').addEventListener('click', () => this.closeViewer());

        // ESC 關閉
        this._escHandler = (e) => {
            if (e.key === 'Escape') this.closeViewer();
        };
        document.addEventListener('keydown', this._escHandler);
    }

    closeViewer() {
        if (this._overlay) {
            this._overlay.classList.remove('open');
            this._overlay.classList.add('closing');
            setTimeout(() => {
                this._overlay?.remove();
                this._overlay = null;
            }, 250);
        }
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    }
}
