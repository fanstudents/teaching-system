/**
 * 作業展示模組 — 投影片內嵌的作品展示牆
 * 自動從 DB 拉取提交，渲染繳交狀態 + 作品 grid
 */
import { db } from '../supabase.js';

export class Showcase {
    constructor() {
        this.cache = {};       // assignment_title → submissions[]
        this.pollingTimers = {};
        this.sessionCode = null;
        this.totalStudents = 0;
    }

    setSessionCode(code) {
        this.sessionCode = code;
    }

    /**
     * 初始化頁面上所有 .showcase-container
     */
    init() {
        this.destroy();
        this._lastDataHash = {};  // 強制重新渲染
        const containers = document.querySelectorAll('.showcase-container');
        containers.forEach(c => this.setupContainer(c));
    }

    /**
     * 清除所有 polling timers
     */
    destroy() {
        Object.values(this.pollingTimers).forEach(id => clearInterval(id));
        this.pollingTimers = {};
    }

    /**
     * 設定單一展示容器
     */
    async setupContainer(container) {
        const title = container.dataset.assignmentTitle || '';
        console.log('[Showcase] setupContainer title:', title, 'sessionCode:', this.sessionCode);
        if (!title) return;

        // 每個容器有唯一 ID，避免多個同 title 容器互相覆蓋 hash
        if (!container._showcaseId) {
            container._showcaseId = title + '_' + Math.random().toString(36).substr(2, 6);
        }
        const cid = container._showcaseId;

        // 清除舊 hash，確保新容器一定會渲染
        if (this._lastDataHash) delete this._lastDataHash[cid];

        container.innerHTML = `
            <div class="showcase-loading">
                <span class="material-symbols-outlined showcase-spin">progress_activity</span>
                <span>載入作品中…</span>
            </div>`;

        await this.fetchAndRender(container, title);

        if (this.pollingTimers[cid]) clearInterval(this.pollingTimers[cid]);
        const timerId = setInterval(() => this.fetchAndRender(container, title), 5000);
        this.pollingTimers[cid] = timerId;
    }

    /**
     * 從 DB 拉取並渲染
     */
    async fetchAndRender(container, assignmentTitle) {
        const cid = container._showcaseId || assignmentTitle;
        try {
            let { data, error } = await db.select('submissions', {
                filter: { assignment_title: `eq.${assignmentTitle}` },
                order: 'submitted_at.asc'
            });

            // 如果精確匹配無結果，且有 sessionCode，用 session_id 回撈（僅作業類型）
            if ((!data || data.length === 0) && this.sessionCode) {
                console.log('[Showcase] title match empty, trying session_id:', this.sessionCode);
                const fallback = await db.select('submissions', {
                    filter: {
                        session_id: `eq.${this.sessionCode}`,
                        type: 'in.(text,image,video,audio,link)'
                    },
                    order: 'submitted_at.asc'
                });
                console.log('[Showcase] session_id fallback result:', fallback.data?.length, 'rows');
                if (fallback.data && fallback.data.length > 0) {
                    data = fallback.data;
                    error = fallback.error;
                }
            }

            if (error || !data) {
                this.renderError(container, '無法載入作品');
                return;
            }

            if (this.sessionCode) {
                try {
                    const { data: students } = await db.select('students', {
                        filter: { session_code: `eq.${this.sessionCode}` },
                        select: 'id'
                    });
                    this.totalStudents = students?.length || 0;
                } catch { /* non-critical */ }
            }

            // 比較資料是否有變化，沒變就不重新渲染（避免重設捲動位置）
            const dataHash = JSON.stringify(data.map(s => s.id + (s.submitted_at || '')));
            if (this._lastDataHash && this._lastDataHash[cid] === dataHash) {
                return; // 資料沒變，跳過
            }
            if (!this._lastDataHash) this._lastDataHash = {};
            this._lastDataHash[cid] = dataHash;

            this.cache[assignmentTitle] = data;
            console.log('[Showcase] submissions for', assignmentTitle, data);

            // 保存捲動位置
            const grid = container.querySelector('.showcase-grid');
            const savedScroll = grid ? grid.scrollLeft : 0;

            this.render(container, data, assignmentTitle);

            // 恢復捲動位置
            requestAnimationFrame(() => {
                const newGrid = container.querySelector('.showcase-grid');
                if (newGrid && savedScroll > 0) {
                    newGrid.scrollLeft = savedScroll;
                }
            });
        } catch (e) {
            console.warn('[Showcase] fetch error:', e);
            if (this.cache[assignmentTitle]) {
                this.render(container, this.cache[assignmentTitle], assignmentTitle);
            } else {
                this.renderError(container, '連線失敗');
            }
        }
    }

    /* ───── 渲染 ───── */

    render(container, submissions, assignmentTitle) {
        const count = submissions.length;

        const statusHtml = submissions.map(s => `
            <div class="showcase-status-chip" title="${s.student_name}">
                <span class="showcase-chip-avatar">${(s.student_name || '?')[0]}</span>
                <span class="showcase-chip-name">${s.student_name || '匿名'}</span>
            </div>
        `).join('');

        const cardsHtml = submissions.map((s, i) => {
            const preview = this.getPreview(s);
            return `
                <div class="showcase-work-card" data-index="${i}">
                    <div class="showcase-work-header">
                        <span class="showcase-work-avatar">${(s.student_name || '?')[0]}</span>
                        <div style="flex:1;min-width:0;">
                            <div class="showcase-work-name">${s.student_name || '匿名'}</div>
                            <div style="font-size:10px;color:#94a3b8;">${this.formatTime(s.submitted_at || s.created_at)}</div>
                        </div>
                    </div>
                    <div class="showcase-work-body">${preview}</div>
                </div>`;
        }).join('');

        const total = this.totalStudents;
        const notSubmitted = Math.max(0, total - count);
        const countLabel = total > 0
            ? `已繳 ${count} / 應繳 ${total}　<span class="showcase-header-pending">${notSubmitted} 人未繳</span>`
            : `${count} 份繳交`;

        container.innerHTML = `
            <div class="showcase-header-bar">
                <div class="showcase-header-left">
                    <span class="material-symbols-outlined" style="font-size:18px;">gallery_thumbnail</span>
                    <span class="showcase-header-title">${assignmentTitle}</span>
                </div>
                <span class="showcase-header-count">${countLabel}</span>
            </div>
            <div class="showcase-status-row">${statusHtml}</div>
            <div class="showcase-grid">${cardsHtml || '<div class="showcase-empty">尚無人繳交</div>'}</div>
        `;

        container.querySelectorAll('.showcase-work-card').forEach(card => {
            card.addEventListener('click', () => {
                const idx = parseInt(card.dataset.index);
                this.openFocus(submissions, idx, container);
            });
        });
    }

    /* ───── 圖片來源提取 ───── */

    _extractImageSrc(s) {
        const content = s.content || '';
        let src = '';
        let promptText = '';

        if (s.file_url && s.file_url.startsWith('http')) src = s.file_url;
        if (!src && content.startsWith('data:image/')) src = content;
        if (!src && content.startsWith('{')) {
            try {
                const p = JSON.parse(content);
                src = p.data || p.image?.data
                    || (typeof p.image === 'string' && p.image.startsWith('data:') ? p.image : '')
                    || '';
                promptText = p.prompt || '';
            } catch { /* */ }
        }
        if (!src && (content.startsWith('http://') || content.startsWith('https://'))) src = content;
        // 即使 src 已從 file_url 取得，仍嘗試提取 prompt
        if (src && !promptText && content.startsWith('{')) {
            try { promptText = JSON.parse(content).prompt || ''; } catch { /* */ }
        }
        if (!src) {
            console.warn('[Showcase] image src not found:', {
                file_url: s.file_url, content_start: content.substring(0, 100)
            });
        }
        return { src, promptText };
    }

    /* ───── 卡片預覽 ───── */

    getPreview(submission) {
        const s = submission;
        const content = s.content || '';

        switch (s.type) {
            case 'text':
                return `<div class="showcase-preview-text">${this.escapeHtml(content).substring(0, 200)}${content.length > 200 ? '…' : ''}</div>`;

            case 'image': {
                const { src, promptText } = this._extractImageSrc(s);
                let html = '';
                if (src) {
                    html += `<img src="${src}" class="showcase-preview-img" alt="作品" loading="lazy">`;
                } else {
                    html += `<div style="text-align:center;padding:16px;color:#94a3b8;"><span class="material-symbols-outlined" style="font-size:28px;">image</span><br>圖片載入中</div>`;
                }
                if (promptText) {
                    html += `<div class="showcase-preview-prompt">
                        <span style="font-size:10px;color:#6366f1;font-weight:600;">Prompt</span>
                        <div style="font-size:12px;color:#334155;line-height:1.5;margin-top:2px;white-space:pre-wrap;">${this.escapeHtml(promptText)}</div>
                    </div>`;
                }
                return html;
            }

            case 'video': {
                let src = s.file_url || '';
                if (!src) { try { src = JSON.parse(content).data || ''; } catch { src = ''; } }
                if (src) return `<video src="${src}" style="width:100%;max-height:160px;border-radius:6px;object-fit:cover;" muted></video>`;
                return `<div style="text-align:center;padding:16px;color:#64748b;"><span class="material-symbols-outlined" style="font-size:28px;">videocam</span><br>影片</div>`;
            }

            case 'audio': {
                let src = s.file_url || '';
                if (!src) { try { src = JSON.parse(content).data || ''; } catch { src = ''; } }
                return `<div style="text-align:center;padding:12px;">
                    <span class="material-symbols-outlined" style="font-size:28px;color:#6366f1;">headphones</span>
                    ${src ? `<audio src="${src}" controls style="width:100%;margin-top:8px;height:32px;"></audio>` : '<div style="color:#94a3b8;font-size:12px;margin-top:4px;">音檔</div>'}
                </div>`;
            }

            case 'link':
                return `<div style="padding:8px;word-break:break-all;">
                    <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;color:#6366f1;">link</span>
                    <a href="${content}" target="_blank" style="color:#4A7AE8;font-size:12px;">${this.truncate(content, 60)}</a>
                </div>`;

            case 'matching':
            case 'fillblank':
                return `<div class="showcase-preview-score ${s.is_correct === 'true' ? 'perfect' : ''}">
                    <span class="score-big">${s.score || '—'}</span>
                    <span class="score-label">分</span>
                </div>`;

            default:
                return `<div class="showcase-preview-text">${this.escapeHtml(content).substring(0, 120)}</div>`;
        }
    }

    /* ───── 聚焦放大 ───── */

    openFocus(submissions, index, container) {
        document.querySelector('.showcase-focus-overlay')?.remove();
        const s = submissions[index];
        if (!s) return;
        const total = submissions.length;

        const overlay = document.createElement('div');
        overlay.className = 'showcase-focus-overlay';
        overlay.style.zIndex = '999999'; // 確保高於 .presentation-mode (z-index:2000)

        const fullContent = this.getFullContent(s);

        overlay.innerHTML = `
            <div class="showcase-focus-backdrop"></div>
            <div class="showcase-focus-card">
                <div class="showcase-focus-header">
                    <div class="showcase-focus-user">
                        <div class="showcase-focus-avatar">${(s.student_name || '?')[0]}</div>
                        <div>
                            <h3>${s.student_name || '匿名'}</h3>
                            <span>${this.formatTime(s.submitted_at || s.created_at)}</span>
                        </div>
                    </div>
                    <span class="showcase-focus-counter">${index + 1} / ${total}</span>
                </div>
                <div class="showcase-focus-body">${fullContent}</div>
                <div class="showcase-focus-nav">
                    <button class="showcase-focus-btn prev" ${index === 0 ? 'disabled' : ''}><span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span> 上一位</button>
                    <button class="showcase-focus-btn close"><span class="material-symbols-outlined" style="font-size:16px;">close</span> 關閉</button>
                    <button class="showcase-focus-btn next" ${index === total - 1 ? 'disabled' : ''}>下一位 <span class="material-symbols-outlined" style="font-size:16px;">arrow_forward</span></button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        overlay.querySelector('.showcase-focus-btn.close').onclick = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 200);
        };
        overlay.querySelector('.showcase-focus-backdrop').onclick = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 200);
        };
        overlay.querySelector('.showcase-focus-btn.prev').onclick = () => {
            overlay.remove();
            this.openFocus(submissions, index - 1, container);
        };
        overlay.querySelector('.showcase-focus-btn.next').onclick = () => {
            overlay.remove();
            this.openFocus(submissions, index + 1, container);
        };

        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                overlay.classList.remove('active');
                setTimeout(() => overlay.remove(), 200);
                document.removeEventListener('keydown', keyHandler);
            } else if (e.key === 'ArrowLeft' && index > 0) {
                overlay.remove();
                document.removeEventListener('keydown', keyHandler);
                this.openFocus(submissions, index - 1, container);
            } else if (e.key === 'ArrowRight' && index < total - 1) {
                overlay.remove();
                document.removeEventListener('keydown', keyHandler);
                this.openFocus(submissions, index + 1, container);
            }
        };
        document.addEventListener('keydown', keyHandler);
    }

    /* ───── 聚焦完整內容 ───── */

    getFullContent(s) {
        const content = s.content || '';
        switch (s.type) {
            case 'text':
                return `<div class="showcase-full-text">${this.escapeHtml(content)}</div>`;
            case 'image': {
                const { src, promptText } = this._extractImageSrc(s);
                let html = src ? `<img src="${src}" class="showcase-full-img">` : '<p>圖片無法顯示</p>';
                if (promptText) {
                    html += `<div style="margin-top:14px;padding:14px 18px;background:#f0f4ff;border-radius:10px;border:1px solid #c7d2fe;">
                        <div style="font-size:12px;color:#6366f1;font-weight:700;margin-bottom:6px;">💬 Prompt</div>
                        <div style="font-size:15px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${this.escapeHtml(promptText)}</div>
                    </div>`;
                }
                return html;
            }
            case 'video': {
                let src = s.file_url || '';
                if (!src) { try { src = JSON.parse(content).data || ''; } catch { src = ''; } }
                return src ? `<video src="${src}" controls class="showcase-full-video"></video>` : '<p>影片無法顯示</p>';
            }
            case 'audio': {
                let src = s.file_url || '';
                if (!src) { try { src = JSON.parse(content).data || ''; } catch { src = ''; } }
                return `<div class="showcase-full-audio"><span class="material-symbols-outlined" style="font-size:2.5rem;">headphones</span><br><audio src="${src}" controls></audio></div>`;
            }
            case 'link':
                return `<div class="showcase-full-link"><a href="${content}" target="_blank">${content}</a></div>`;
            case 'matching':
            case 'fillblank':
                return `<div class="showcase-full-score ${s.is_correct === 'true' ? 'perfect' : ''}">
                    <div class="score-value">${s.score || '—'}</div>
                    <div class="score-detail">${content}</div>
                </div>`;
            default:
                return `<div class="showcase-full-text">${this.escapeHtml(content)}</div>`;
        }
    }

    renderError(container, msg) {
        container.innerHTML = `<div class="showcase-error"><span class="material-symbols-outlined">error</span> ${msg}</div>`;
    }

    destroy() {
        Object.values(this.pollingTimers).forEach(id => clearInterval(id));
        this.pollingTimers = {};
    }

    escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    truncate(str, max) {
        return str.length > max ? str.substring(0, max) + '…' : str;
    }

    formatTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
}
