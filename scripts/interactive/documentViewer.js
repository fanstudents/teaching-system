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
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());

        // 事件代理：點擊文件卡片
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.document-card-container');
            if (!card) return;

            // 編輯模式下不打開
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
     * 判斷是不是講師
     */
    _isPresenter() {
        return !!window._app?.broadcasting || !!document.getElementById('slideCanvas');
    }

    /**
     * 打開文件檢視器
     */
    async openViewer(elementId) {
        const data = this._getElementData(elementId);
        if (!data) return;

        // 移除舊的 overlay
        this.closeViewer();

        const content = this.parseMarkdown(data.docContent || '');
        const hasDownload = !!data.docDownloadUrl;
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

        // 錨點 HTML
        let anchorsSection = '';
        if (hasAnchors) {
            const anchorCards = anchors.map((a, i) => {
                const checked = prevSel.includes(a.id);
                return `<div class="doc-anchor-card ${checked ? 'checked' : ''}" data-anchor-id="${a.id}" data-idx="${i}">
                    <div class="doc-anchor-check">
                        <span class="material-symbols-outlined">${checked ? 'check_box' : 'check_box_outline_blank'}</span>
                    </div>
                    <div class="doc-anchor-label">${this._esc(a.text || `段落 ${i + 1}`)}</div>
                </div>`;
            }).join('');

            anchorsSection = `
                <div class="doc-anchors-section">
                    <div class="doc-anchors-title">
                        <span class="material-symbols-outlined" style="font-size:18px;color:#f59e0b;">flag</span>
                        請勾選你認為有錯誤的段落
                    </div>
                    <div class="doc-anchors-grid">${anchorCards}</div>
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
                    ${anchorsSection}
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

        // ── 錨點互動 ──
        if (hasAnchors) {
            const selectedSet = new Set(prevSel);

            // 勾選切換
            overlay.querySelectorAll('.doc-anchor-card').forEach(card => {
                card.addEventListener('click', () => {
                    if (card.classList.contains('revealed')) return; // 已公布
                    const id = card.dataset.anchorId;
                    if (selectedSet.has(id)) {
                        selectedSet.delete(id);
                        card.classList.remove('checked');
                        card.querySelector('.doc-anchor-check .material-symbols-outlined').textContent = 'check_box_outline_blank';
                    } else {
                        selectedSet.add(id);
                        card.classList.add('checked');
                        card.querySelector('.doc-anchor-check .material-symbols-outlined').textContent = 'check_box';
                    }
                });
            });

            // 學員提交
            const submitBtn = overlay.querySelector('#docSubmitAnchors');
            if (submitBtn) {
                submitBtn.addEventListener('click', async () => {
                    const selected = [...selectedSet];
                    const correctErrors = anchors.filter(a => a.isError).map(a => a.id);
                    const correctCount = selected.filter(id => correctErrors.includes(id)).length;
                    const wrongCount = selected.filter(id => !correctErrors.includes(id)).length;
                    const total = correctErrors.length;
                    const allRight = correctCount === total && wrongCount === 0;
                    const score = total > 0 ? Math.round(((correctCount - wrongCount * 0.5) / total) * 100) : 100;
                    const points = parseInt(document.querySelector(`[data-id="${elementId}"]`)?.dataset.points) || 5;

                    await stateManager.save(elementId, {
                        type: 'document',
                        title: data.docTitle || '文件',
                        content: `${selected.length} 項`,
                        isCorrect: allRight,
                        score: Math.max(0, score),
                        points,
                        state: { selectedAnchors: selected },
                    });

                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">check</span> 已提交';
                    submitBtn.classList.add('submitted');

                    // 鎖定所有卡片
                    overlay.querySelectorAll('.doc-anchor-card').forEach(c => c.style.pointerEvents = 'none');
                });
            }

            // 講師公布答案
            const revealBtn = overlay.querySelector('#docRevealBtn');
            if (revealBtn) {
                revealBtn.addEventListener('click', async () => {
                    revealBtn.disabled = true;
                    revealBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">hourglass_top</span> 載入中...';

                    // 揭曉正確答案
                    overlay.querySelectorAll('.doc-anchor-card').forEach(card => {
                        card.classList.add('revealed');
                        const id = card.dataset.anchorId;
                        const anchor = anchors.find(a => a.id === id);
                        if (anchor?.isError) {
                            card.classList.add('is-error');
                        } else {
                            card.classList.add('is-correct');
                        }
                    });

                    // 載入統計
                    await this._loadStats(elementId, anchors, overlay);
                    revealBtn.style.display = 'none';
                });
            }
        }
    }

    /**
     * 載入統計資料
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
