/**
 * 文件檢視器互動模組
 * 點擊卡片 → 展開全螢幕 overlay → 支援 Markdown/HTML 渲染 + 下載
 * 支援錨點（找錯練習）：學員勾選 → 講師公布 → 統計
 */
import { stateManager } from './stateManager.js';

export class DocumentViewer {
    constructor() {
        this._overlay = null;
        this.setupEventListeners();

        // 全域函數：供 inline onclick 呼叫（最穩定的方式）
        window._openDocViewer = (elementId) => {
            const isEditing = !!document.getElementById('slideCanvas')
                && !document.getElementById('presentationMode')?.classList.contains('active');
            if (isEditing) return;
            this.openViewer(elementId);
        };
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    /**
     * 直接綁定 click 到每個文件卡片（與其他互動模組相同方式）
     */
    init() {
        // init 只設定 pointer-events，click 由 inline onclick 處理（避免重複觸發）
        const cards = document.querySelectorAll('.document-card-container');
        cards.forEach(card => {
            card.style.pointerEvents = 'auto';
            card.style.cursor = 'pointer';
            if (card.parentElement) card.parentElement.style.pointerEvents = 'auto';
        });
    }

    /**
     * 取得元素資料
     */
    _getElementData(elementId) {
        // 搜尋所有投影片（簡報模式可能在不同頁）
        if (window.app?.slideManager?.slides) {
            for (const s of window.app.slideManager.slides) {
                const found = s.elements?.find(e => e.id === elementId);
                if (found) return found;
            }
        }
        // 嘗試從 presenter（學員端）取得
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
     * 判斷是不是講師
     */
    _isPresenter() {
        return !!window._app?.broadcasting || !!document.getElementById('slideCanvas');
    }

    /**
     * 打開文件檢視器
     */
    async openViewer(elementId) {
        // 防止重複開啟
        if (this._overlay) return;

        const data = this._getElementData(elementId);
        if (!data) return;

        const content = this.parseMarkdown(data.docContent || '');
        const anchors = data.docAnchors || [];
        const hasAnchors = anchors.length > 0;
        const isPresenter = this._isPresenter();

        // 載入學員之前的作答
        let prevSel = [];
        if (hasAnchors && !isPresenter) {
            const prev = await stateManager.load(elementId);
            if (prev?.state?.selectedAnchors) prevSel = prev.state.selectedAnchors;
        }

        const overlay = document.createElement('div');
        overlay.className = 'doc-viewer-overlay';

        // ── 段落式內容渲染（可點擊標記錯誤）──
        let contentHtml;
        if (hasAnchors) {
            // 有錨點 → 段落化，每段可點擊標記
            const paragraphs = this._splitIntoParagraphs(content);
            contentHtml = `
                <div class="doc-para-hint">
                    <span class="material-symbols-outlined" style="font-size:16px;">touch_app</span>
                    點擊你認為有錯誤的段落
                </div>
                <div class="doc-para-list">
                    ${paragraphs.map((p, i) => {
                const checked = prevSel.includes(i);
                return `<div class="doc-para-item ${checked ? 'marked' : ''}" data-para-idx="${i}">
                            <div class="doc-para-badge">${i + 1}</div>
                            <div class="doc-para-text">${p}</div>
                            <div class="doc-para-mark">
                                <span class="material-symbols-outlined">${checked ? 'flag' : 'outlined_flag'}</span>
                            </div>
                        </div>`;
            }).join('')}
                </div>
                <div class="doc-para-actions">
                    ${isPresenter ? `
                        <button class="doc-reveal-btn" id="docRevealBtn">
                            <span class="material-symbols-outlined" style="font-size:18px;">visibility</span>
                            公布答案 & 統計
                        </button>
                    ` : `
                        <button class="doc-submit-anchors" id="docSubmitAnchors">
                            <span class="material-symbols-outlined" style="font-size:18px;">send</span>
                            提交我的選擇
                        </button>
                    `}
                    <div class="doc-stats-panel" id="docStatsPanel" style="display:none;"></div>
                </div>
            `;
        } else {
            contentHtml = content;
        }

        overlay.innerHTML = `
            <div class="doc-viewer-backdrop"></div>
            <div class="doc-viewer-panel">
                <div class="doc-viewer-header">
                    <div class="doc-viewer-title-row">
                        <span class="material-symbols-outlined" style="font-size:22px;color:#0284c7;">description</span>
                        <h2 class="doc-viewer-title">${data.docTitle || '文件'}</h2>
                    </div>
                    <div class="doc-viewer-actions">
                        ${data.docContent ? `
                            <button class="doc-viewer-download-btn" id="docAutoDownload" onclick="event.stopPropagation();">
                                <span class="material-symbols-outlined" style="font-size:18px;">download</span>
                                下載文件
                            </button>
                        ` : ''}
                        <button class="doc-viewer-close-btn">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div class="doc-viewer-body">
                    <div class="doc-viewer-content">${contentHtml}</div>
                </div>
            </div>
        `;

        // 掛在簡報模式容器內，確保 z-index 生效
        const presMode = document.getElementById('presentationMode');
        const mountPoint = presMode?.classList.contains('active') ? presMode : document.body;
        mountPoint.appendChild(overlay);
        this._overlay = overlay;
        console.log('[DocViewer] overlay appended to', mountPoint.id || 'body', 'content length:', content.length);

        // 動畫進入
        requestAnimationFrame(() => {
            overlay.classList.add('open');
            console.log('[DocViewer] .open class added');
        });

        // 關閉事件
        overlay.querySelector('.doc-viewer-close-btn').addEventListener('click', () => this.closeViewer());
        overlay.querySelector('.doc-viewer-backdrop').addEventListener('click', () => this.closeViewer());

        // ESC 關閉
        this._escHandler = (e) => {
            if (e.key === 'Escape') this.closeViewer();
        };
        document.addEventListener('keydown', this._escHandler);

        // 自動下載
        const dlBtn = overlay.querySelector('#docAutoDownload');
        if (dlBtn) {
            dlBtn.addEventListener('click', () => {
                const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${this._esc(data.docTitle || '文件')}</title><style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1e293b;}h1,h2,h3{color:#0f172a;}code{background:#f1f5f9;padding:2px 6px;border-radius:4px;}pre{background:#f1f5f9;padding:16px;border-radius:8px;overflow-x:auto;}blockquote{border-left:4px solid #0284c7;margin:0;padding:0 16px;color:#475569;}img{max-width:100%;border-radius:8px;}</style></head><body>${content}</body></html>`;
                const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${data.docTitle || '文件'}.html`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        // ── 段落點擊互動 ──
        if (hasAnchors) {
            const selectedSet = new Set(prevSel);

            // 段落點擊切換
            overlay.querySelectorAll('.doc-para-item').forEach(item => {
                item.addEventListener('click', () => {
                    if (item.classList.contains('revealed')) return;
                    const idx = parseInt(item.dataset.paraIdx);
                    const icon = item.querySelector('.doc-para-mark .material-symbols-outlined');
                    if (selectedSet.has(idx)) {
                        selectedSet.delete(idx);
                        item.classList.remove('marked');
                        if (icon) icon.textContent = 'outlined_flag';
                    } else {
                        selectedSet.add(idx);
                        item.classList.add('marked');
                        if (icon) icon.textContent = 'flag';
                    }
                });
            });

            // 學員提交
            const submitBtn = overlay.querySelector('#docSubmitAnchors');
            if (submitBtn) {
                submitBtn.addEventListener('click', async () => {
                    const selected = [...selectedSet];
                    const errorIndices = anchors.map((a, i) => a.isError ? i : -1).filter(i => i >= 0);
                    const correctCount = selected.filter(i => errorIndices.includes(i)).length;
                    const wrongCount = selected.filter(i => !errorIndices.includes(i)).length;
                    const total = errorIndices.length;
                    const allRight = correctCount === total && wrongCount === 0;
                    const score = total > 0 ? Math.round(((correctCount - wrongCount * 0.5) / total) * 100) : 100;
                    const points = parseInt(document.querySelector(`[data-id="${elementId}"]`)?.dataset.points) || 5;

                    const _r = await stateManager.save(elementId, {
                        type: 'document',
                        title: data.docTitle || '文件',
                        content: `標記 ${selected.length} 段`,
                        isCorrect: allRight,
                        score: Math.max(0, score),
                        points,
                        state: { selectedAnchors: selected },
                    });

                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">check</span> 已提交';
                    submitBtn.classList.add('submitted');
                    if (_r?.isRetry) stateManager.showRetryBanner(overlay.querySelector('.doc-para-actions'));

                    // 鎖定段落
                    overlay.querySelectorAll('.doc-para-item').forEach(c => c.style.pointerEvents = 'none');
                });
            }

            // 講師公布答案
            const revealBtn = overlay.querySelector('#docRevealBtn');
            if (revealBtn) {
                revealBtn.addEventListener('click', async () => {
                    revealBtn.disabled = true;
                    revealBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">hourglass_top</span> 載入中...';

                    // 揭曉：標記正確/錯誤段落
                    overlay.querySelectorAll('.doc-para-item').forEach(item => {
                        item.classList.add('revealed');
                        const idx = parseInt(item.dataset.paraIdx);
                        const anchor = anchors[idx];
                        if (anchor?.isError) {
                            item.classList.add('is-error');
                        } else {
                            item.classList.add('is-correct');
                        }
                    });

                    await this._loadStatsForParagraphs(elementId, anchors, overlay);
                    revealBtn.style.display = 'none';
                });
            }
        }
    }

    /**
     * 將 HTML 內容拆分為段落陣列
     */
    _splitIntoParagraphs(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const paragraphs = [];
        // 取得所有直接子元素（p, h1-h6, li, blockquote, pre, div 等）
        const children = temp.children;
        if (children.length > 0) {
            for (const child of children) {
                const text = child.innerHTML?.trim();
                if (text) paragraphs.push(text);
            }
        }
        // 如果解析不到子元素（純文字），按換行拆
        if (paragraphs.length === 0) {
            const lines = html.split(/<br\s*\/?>\s*<br\s*\/?>/gi);
            for (const line of lines) {
                const t = line.trim();
                if (t) paragraphs.push(t);
            }
        }
        // 最後防護：至少回傳整段
        if (paragraphs.length === 0 && html.trim()) {
            paragraphs.push(html.trim());
        }
        return paragraphs;
    }

    /**
     * 載入段落統計資料（以段落 index 為 key）
     */
    async _loadStatsForParagraphs(elementId, anchors, overlay) {
        const statsPanel = overlay.querySelector('#docStatsPanel');
        if (!statsPanel) return;

        try {
            const { db } = await import('../supabase.js');
            const sessionCode = window.app?.sessionCode || '';
            const { data: rows } = await db.select('submissions', {
                filter: {
                    element_id: `eq.${elementId}`,
                    ...(sessionCode ? { session_id: `eq.${sessionCode}` } : {}),
                },
            });

            const submissions = Array.isArray(rows) ? rows : [];
            const totalStudents = submissions.length;

            if (totalStudents === 0) {
                statsPanel.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:16px;">尚無學員作答</div>';
                statsPanel.style.display = 'block';
                return;
            }

            // 統計每段被標記的次數
            const countMap = {};
            anchors.forEach((_, i) => { countMap[i] = 0; });

            for (const sub of submissions) {
                let st = sub.state;
                if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
                const sel = st?.selectedAnchors || [];
                sel.forEach(idx => {
                    if (countMap[idx] !== undefined) countMap[idx]++;
                });
            }

            const statsHtml = anchors.map((a, i) => {
                const count = countMap[i] || 0;
                const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
                const barColor = a.isError ? '#ef4444' : '#22c55e';
                const tag = a.isError
                    ? '<span class="doc-stat-tag error">有錯</span>'
                    : '<span class="doc-stat-tag correct">正確</span>';
                return `
                    <div class="doc-stat-row">
                        <div class="doc-stat-label">
                            <span class="doc-stat-num">${i + 1}</span>
                            ${tag}
                        </div>
                        <div class="doc-stat-bar-wrap">
                            <div class="doc-stat-bar" style="width:${pct}%;background:${barColor};"></div>
                        </div>
                        <div class="doc-stat-pct">${count}人 (${pct}%)</div>
                    </div>
                `;
            }).join('');

            statsPanel.innerHTML = `
                <div class="doc-stats-header">
                    <span class="material-symbols-outlined" style="font-size:18px;color:#6366f1;">bar_chart</span>
                    標記統計（共 ${totalStudents} 人作答）
                </div>
                ${statsHtml}
            `;
            statsPanel.style.display = 'block';
        } catch (e) {
            console.warn('[docViewer] stats load error:', e);
        }
    }

    /**
     * 載入統計資料（舊版 — 保留向下相容）
     */
    async _loadStats(elementId, anchors, overlay) {
        const statsPanel = overlay.querySelector('#docStatsPanel');
        if (!statsPanel) return;

        try {
            const { db } = await import('../supabase.js');
            const sessionCode = window._app?.sessionCode || '';
            const { data: rows } = await db.select('submissions', {
                filter: {
                    element_id: `eq.${elementId}`,
                    ...(sessionCode ? { session_id: `eq.${sessionCode}` } : {}),
                },
            });

            const submissions = Array.isArray(rows) ? rows : [];
            const totalStudents = submissions.length;

            if (totalStudents === 0) {
                statsPanel.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:16px;">尚無學員作答</div>';
                statsPanel.style.display = 'block';
                return;
            }

            // 統計每個錨點被選取的次數
            const countMap = {};
            anchors.forEach(a => { countMap[a.id] = 0; });

            for (const sub of submissions) {
                let st = sub.state;
                if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = {}; } }
                const sel = st?.selectedAnchors || [];
                sel.forEach(id => {
                    if (countMap[id] !== undefined) countMap[id]++;
                });
            }

            const statsHtml = anchors.map((a, i) => {
                const count = countMap[a.id] || 0;
                const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
                const barColor = a.isError ? '#ef4444' : '#22c55e';
                const tag = a.isError
                    ? '<span class="doc-stat-tag error">錯誤</span>'
                    : '<span class="doc-stat-tag correct">正確</span>';
                return `
                    <div class="doc-stat-row">
                        <div class="doc-stat-label">
                            <span class="doc-stat-num">${i + 1}</span>
                            ${tag}
                            <span class="doc-stat-text">${this._esc(a.text || `段落 ${i + 1}`)}</span>
                        </div>
                        <div class="doc-stat-bar-wrap">
                            <div class="doc-stat-bar" style="width:${pct}%;background:${barColor};"></div>
                        </div>
                        <div class="doc-stat-pct">${count}人 (${pct}%)</div>
                    </div>
                `;
            }).join('');

            statsPanel.innerHTML = `
                <div class="doc-stats-header">
                    <span class="material-symbols-outlined" style="font-size:18px;color:#6366f1;">bar_chart</span>
                    勾選統計（共 ${totalStudents} 人作答）
                </div>
                ${statsHtml}
            `;
            statsPanel.style.display = 'block';
        } catch (e) {
            console.warn('[DocumentViewer] stats error:', e);
            statsPanel.innerHTML = '<div style="color:#dc2626;padding:12px;">統計載入失敗</div>';
            statsPanel.style.display = 'block';
        }
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

    _esc(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
