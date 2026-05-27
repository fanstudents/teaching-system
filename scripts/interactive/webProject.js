/**
 * 網頁作品展示 互動模組
 *
 * 學員上傳 HTML/CSS/JS 檔案，自動合併為單一 HTML，
 * 教師可即時預覽每位學員的網頁作品。
 */
import { stateManager } from './stateManager.js';
import { db } from '../supabase.js';

/* ── helpers ── */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mi = (n, s = 18) => `<span class="material-symbols-outlined" style="font-size:${s}px;vertical-align:middle">${n}</span>`;

const MAX_TOTAL_SIZE = 5 * 1024 * 1024; // 5 MB

const TEXT_EXTS = new Set(['html', 'htm', 'css', 'js', 'json', 'svg']);
const ALLOWED_EXTS = new Set([...TEXT_EXTS, 'png', 'jpg', 'jpeg', 'gif', 'webp']);

function getExt(name) {
    return (name.split('.').pop() || '').toLowerCase();
}

function fmtSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 將多檔合併為單一自包含 HTML */
function combineProject(files) {
    // files: Map<filename, {name, type, content}>
    // content: text string for text files, data URL for images
    let htmlFile = null;
    let htmlName = null;

    // 優先找 index.html
    for (const [name, f] of files) {
        const lower = name.toLowerCase();
        if (lower === 'index.html' || lower === 'index.htm') {
            htmlFile = f.content; htmlName = name; break;
        }
    }
    // 沒有 index.html → 用第一個 .html
    if (!htmlFile) {
        for (const [name, f] of files) {
            const ext = getExt(name);
            if (ext === 'html' || ext === 'htm') {
                htmlFile = f.content; htmlName = name; break;
            }
        }
    }
    if (!htmlFile) return null;

    let html = htmlFile;

    // helper: 用 filename 取得內容
    const get = (href) => {
        const stripped = href.replace(/^\.\//, '');
        // 嘗試精確匹配，再試不帶路徑
        const f = files.get(stripped) || files.get(stripped.split('/').pop());
        return f ? f.content : null;
    };

    // Inline CSS: <link rel="stylesheet" href="X">
    html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi, (match, href) => {
        const css = get(href);
        return css ? `<style>/* ${esc(href)} */\n${css}</style>` : match;
    });
    // <link href="X" rel="stylesheet">
    html = html.replace(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi, (match, href) => {
        const css = get(href);
        return css ? `<style>/* ${esc(href)} */\n${css}</style>` : match;
    });

    // Inline JS: <script src="X"></script>
    html = html.replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (match, src) => {
        const js = get(src);
        return js ? `<script>/* ${src} */\n${js}<\/script>` : match;
    });

    // Inline images in <img src="">
    html = html.replace(/(<img[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (match, pre, src, post) => {
        const dataUrl = get(src);
        if (dataUrl && dataUrl.startsWith('data:')) return pre + dataUrl + post;
        return match;
    });

    // Inline CSS url() references
    html = html.replace(/url\(["']?([^"')]+)["']?\)/gi, (match, ref) => {
        const dataUrl = get(ref);
        if (dataUrl && dataUrl.startsWith('data:')) return `url(${dataUrl})`;
        return match;
    });

    return html;
}

/** 讀取單一 File 物件 → Promise<{name, type, content}> */
function readFile(file) {
    return new Promise((resolve, reject) => {
        const ext = getExt(file.name);
        if (!ALLOWED_EXTS.has(ext)) { resolve(null); return; }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`無法讀取 ${file.name}`));

        if (TEXT_EXTS.has(ext)) {
            reader.onload = () => resolve({ name: file.name, type: 'text', content: reader.result });
            reader.readAsText(file);
        } else {
            reader.onload = () => resolve({ name: file.name, type: 'image', content: reader.result });
            reader.readAsDataURL(file);
        }
    });
}

/* ═══════════════════════════════════════════════ */
export class WebProjectGame {
    constructor() {
        this._intervals = new Map();
    }

    /* ── 編輯器預覽 ── */
    renderPreview(el, element) {
        el.innerHTML = `
            <div class="wp-preview-card">
                <div class="wp-preview-header">
                    ${mi('web', 28)}
                    <span>網頁作品展示</span>
                </div>
                <div class="wp-preview-task">${esc(element.question || '（尚未設定任務描述）')}</div>
                <div class="wp-preview-meta">
                    <span>${mi('upload_file', 14)} .html .css .js .json .svg .png .jpg .gif</span>
                </div>
            </div>`;
    }

    /* ── 簡報模式（學員 & 教師共用入口）── */
    render(el, element) {
        const elementId = el.closest('[data-id]')?.dataset.id || el.dataset.elementId || '';
        el.dataset.elementId = elementId;
        el.classList.add('web-project-container');

        const hwUser = sessionStorage.getItem('homework_user');
        const isPresenter = !!el.closest('.presentation-slide');
        const isStudent = (hwUser && !isPresenter);

        if (isStudent) this._renderStudent(el, element, elementId);
        else this._renderTeacher(el, element, elementId);
    }

    /* ═══════════════════════════════════════════════ */
    /*               學 員 端                          */
    /* ═══════════════════════════════════════════════ */
    async _renderStudent(el, element, elementId) {
        el.innerHTML = `
            <div class="wp-student">
                <div class="wp-student-layout">
                    <div class="wp-student-left">
                        <div class="wp-task-section">
                            <div class="wp-task-label">
                                ${mi('assignment', 18)} 任務說明
                                <button class="wp-copy-task-btn" title="複製題目">${mi('content_copy', 14)} 複製</button>
                            </div>
                            <div class="wp-task-text">${esc(element.question || '')}</div>
                        </div>
                    </div>
                    <div class="wp-student-right">
                        <div class="wp-upload-zone" id="wpDropZone">
                            <div class="wp-upload-icon">${mi('cloud_upload', 48)}</div>
                            <div class="wp-upload-text">拖放檔案到這裡，或點擊選擇</div>
                            <div class="wp-upload-hint">支援 .html, .css, .js, .json, .svg, .png, .jpg, .gif</div>
                            <input type="file" class="wp-file-input" multiple accept=".html,.htm,.css,.js,.json,.svg,.png,.jpg,.jpeg,.gif,.webp">
                            <button class="wp-folder-btn">${mi('folder_open', 16)} 選擇資料夾</button>
                            <input type="file" class="wp-folder-input" webkitdirectory style="display:none">
                        </div>
                        <div class="wp-file-list"></div>
                        <div class="wp-preview-mini"></div>
                        <div class="wp-submit-bar">
                            <span class="wp-file-count">尚未選擇檔案</span>
                            <button class="wp-submit-btn" disabled>${mi('send', 16)} 提交作品</button>
                        </div>
                    </div>
                </div>
            </div>`;

        // ── refs ──
        const dropZone = el.querySelector('.wp-upload-zone');
        const fileInput = el.querySelector('.wp-file-input');
        const folderBtn = el.querySelector('.wp-folder-btn');
        const folderInput = el.querySelector('.wp-folder-input');
        const fileListEl = el.querySelector('.wp-file-list');
        const previewMini = el.querySelector('.wp-preview-mini');
        const submitBtn = el.querySelector('.wp-submit-btn');
        const fileCountEl = el.querySelector('.wp-file-count');

        /** @type {Map<string, {name: string, type: string, content: string, size: number}>} */
        const projectFiles = new Map();

        // ── 複製題目 ──
        el.querySelector('.wp-copy-task-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = element.question || '';
            navigator.clipboard.writeText(text).then(() => {
                const btn = el.querySelector('.wp-copy-task-btn');
                btn.innerHTML = `${mi('check', 14)} 已複製`;
                setTimeout(() => { btn.innerHTML = `${mi('content_copy', 14)} 複製`; }, 1500);
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
                document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
                const btn = el.querySelector('.wp-copy-task-btn');
                btn.innerHTML = `${mi('check', 14)} 已複製`;
                setTimeout(() => { btn.innerHTML = `${mi('content_copy', 14)} 複製`; }, 1500);
            });
        });

        // ── 更新檔案列表 UI ──
        const renderFileList = () => {
            if (projectFiles.size === 0) {
                fileListEl.innerHTML = '';
                fileCountEl.textContent = '尚未選擇檔案';
                submitBtn.disabled = true;
                return;
            }

            let totalSize = 0;
            const rows = [];
            for (const [name, f] of projectFiles) {
                totalSize += f.size;
                const icon = f.type === 'image' ? 'image' : getExt(name) === 'html' || getExt(name) === 'htm' ? 'html' : getExt(name) === 'css' ? 'css' : getExt(name) === 'js' ? 'javascript' : 'description';
                rows.push(`
                    <div class="wp-file-row" data-name="${esc(name)}">
                        <span class="wp-file-icon">${mi(icon === 'html' ? 'code' : icon === 'css' ? 'palette' : icon === 'javascript' ? 'data_object' : icon === 'image' ? 'image' : 'description', 14)}</span>
                        <span class="wp-file-name" title="${esc(name)}">${esc(name)}</span>
                        <span class="wp-file-size">${fmtSize(f.size)}</span>
                        <button class="wp-file-remove" data-name="${esc(name)}" title="移除">${mi('close', 14)}</button>
                    </div>`);
            }

            fileListEl.innerHTML = rows.join('');

            const hasHtml = [...projectFiles.keys()].some(n => getExt(n) === 'html' || getExt(n) === 'htm');
            const overSize = totalSize > MAX_TOTAL_SIZE;

            fileCountEl.innerHTML = `${projectFiles.size} 個檔案，共 ${fmtSize(totalSize)}` +
                (overSize ? ` <span style="color:#ef4444">（超過 5MB 限制！）</span>` : '') +
                (!hasHtml ? ` <span style="color:#f97316">（需要至少一個 .html 檔）</span>` : '');
            submitBtn.disabled = !hasHtml || overSize;

            // 綁定移除按鈕
            fileListEl.querySelectorAll('.wp-file-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    projectFiles.delete(btn.dataset.name);
                    renderFileList();
                });
            });
        };

        // ── 加入檔案 ──
        const addFiles = async (fileList) => {
            const promises = [];
            for (const file of fileList) {
                const ext = getExt(file.name);
                if (!ALLOWED_EXTS.has(ext)) continue;
                // 從資料夾上傳時取相對路徑，否則只取檔名
                const relPath = file.webkitRelativePath
                    ? file.webkitRelativePath.split('/').slice(1).join('/')  // 去掉第一層資料夾名
                    : file.name;
                promises.push(
                    readFile(file).then(result => {
                        if (result) {
                            result.name = relPath || file.name;
                            result.size = file.size;
                            projectFiles.set(result.name, result);
                        }
                    }).catch(err => console.warn('讀取檔案失敗:', err))
                );
            }
            await Promise.all(promises);
            renderFileList();
        };

        // ── 事件綁定 ──
        // 點擊 drop zone → 觸發 file input
        dropZone.addEventListener('click', (e) => {
            if (e.target.closest('.wp-folder-btn')) return;
            fileInput.click();
        });
        fileInput.addEventListener('change', () => { if (fileInput.files.length) addFiles(fileInput.files); });

        // 資料夾
        folderBtn.addEventListener('click', (e) => { e.stopPropagation(); folderInput.click(); });
        folderInput.addEventListener('change', () => { if (folderInput.files.length) addFiles(folderInput.files); });

        // Drag & Drop
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('wp-drag-over'); });
        dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('wp-drag-over'); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('wp-drag-over');
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        });

        // ── 提交 ──
        const doSubmit = async () => {
            const hasHtml = [...projectFiles.keys()].some(n => getExt(n) === 'html' || getExt(n) === 'htm');
            if (!hasHtml) { alert('需要至少一個 .html 檔案'); return; }

            const combined = combineProject(projectFiles);
            if (!combined) { alert('合併失敗：無法解析 HTML 檔案'); return; }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `${mi('hourglass_top', 16)} 提交中...`;

            const title = element.question?.substring(0, 50) || '網頁作品';
            const filenames = [...projectFiles.keys()];

            await stateManager.clear(elementId);
            await stateManager.save(elementId, {
                type: 'webProject',
                title,
                content: combined,
                isCorrect: null,
                score: null,
                points: 0,
                participated: true,
                state: {
                    files: filenames,
                    status: 'submitted',
                    combinedSize: combined.length,
                },
            });

            submitBtn.innerHTML = `${mi('check', 16)} 已提交`;
            showMiniPreview(combined);
        };

        submitBtn.addEventListener('click', () => doSubmit());

        // ── Mini Preview ──
        const showMiniPreview = (html) => {
            const escaped = html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            previewMini.innerHTML = `
                <div class="wp-mini-preview-wrapper">
                    <div class="wp-mini-preview-label">${mi('visibility', 14)} 作品預覽</div>
                    <iframe class="wp-mini-iframe" sandbox="allow-scripts" srcdoc="${escaped}"></iframe>
                    <button class="wp-reupload-btn">${mi('upload', 16)} 重新上傳</button>
                </div>`;
            previewMini.querySelector('.wp-reupload-btn')?.addEventListener('click', () => {
                previewMini.innerHTML = '';
                projectFiles.clear();
                renderFileList();
                submitBtn.disabled = true;
                submitBtn.innerHTML = `${mi('send', 16)} 提交作品`;
                dropZone.style.display = '';
                fileListEl.style.display = '';
            });
            // 隱藏上傳區
            dropZone.style.display = 'none';
            fileListEl.style.display = 'none';
        };

        // ── 載入歷史 ──
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev?.content && prev?.state?.status === 'submitted') {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `${mi('check', 16)} 已提交`;
                showMiniPreview(prev.content);
            }
        }
    }

    /* ═══════════════════════════════════════════════ */
    /*               教 師 端                          */
    /* ═══════════════════════════════════════════════ */
    async _renderTeacher(el, element, elementId) {
        const sessionCode = sessionStorage.getItem('_session_code')
            || new URLSearchParams(location.search).get('code') || '';

        el.innerHTML = `
            <div class="wp-teacher">
                <div class="wp-teacher-header">
                    <div class="wp-teacher-title">${mi('web', 22)} 網頁作品展示</div>
                    <div class="wp-teacher-actions">
                        <button class="wp-btn wp-btn-refresh">${mi('refresh', 16)} 刷新</button>
                    </div>
                </div>
                <div class="wp-teacher-count">共 0 份作品</div>
                <div class="wp-teacher-grid"></div>
                <div class="wp-teacher-empty">${mi('pending', 22)} 等待學員提交作品...</div>
            </div>`;

        const gridEl = el.querySelector('.wp-teacher-grid');
        const emptyEl = el.querySelector('.wp-teacher-empty');
        const countEl = el.querySelector('.wp-teacher-count');
        const refreshBtn = el.querySelector('.wp-btn-refresh');

        let lastHash = '';

        const loadSubmissions = async () => {
            const filter = { element_id: 'eq.' + elementId, type: 'eq.webProject' };
            if (sessionCode) filter.session_id = 'eq.' + sessionCode;

            const { data } = await db.select('submissions', { filter, order: 'created_at.asc' });
            const subs = data || [];

            // Hash check — 避免無謂 DOM 重建
            const hash = subs.map(s => s.id + (s.submitted_at || '')).join('|');
            if (hash === lastHash) return;
            lastHash = hash;

            countEl.textContent = `共 ${subs.length} 份作品`;

            if (subs.length === 0) {
                gridEl.innerHTML = '';
                emptyEl.style.display = '';
            } else {
                emptyEl.style.display = 'none';
                gridEl.innerHTML = subs.map((s, i) => {
                    let state = {};
                    try { state = typeof s.state === 'string' ? JSON.parse(s.state) : (s.state || {}); } catch { state = {}; }
                    const name = s.student_name || s.student_email?.split('@')[0] || `學員${i + 1}`;
                    const files = state.files || [];
                    const size = state.combinedSize || 0;

                    return `
                        <div class="wp-card" data-id="${s.id}">
                            <div class="wp-card-header">
                                <span class="wp-card-name">${mi('person', 16)} ${esc(name)}</span>
                            </div>
                            <div class="wp-card-info">
                                <span>${mi('description', 12)} ${files.length} 個檔案</span>
                                <span>${mi('data_usage', 12)} ${fmtSize(size)}</span>
                            </div>
                            <div class="wp-card-files" title="${esc(files.join(', '))}">${files.slice(0, 5).map(f => esc(f)).join(', ')}${files.length > 5 ? '…' : ''}</div>
                            <button class="wp-card-preview-btn" data-submission-id="${s.id}">${mi('visibility', 14)} 預覽</button>
                        </div>`;
                }).join('');
            }
        };

        await loadSubmissions();

        // ── 刷新 ──
        refreshBtn.addEventListener('click', () => { lastHash = ''; loadSubmissions(); });

        // ── 預覽 Modal ──
        gridEl.addEventListener('click', async (e) => {
            const btn = e.target.closest('.wp-card-preview-btn');
            if (!btn) return;
            const subId = btn.dataset.submissionId;

            // 從 DB 讀取完整 content
            const { data } = await db.select('submissions', { filter: { id: 'eq.' + subId }, limit: 1 });
            if (!data?.length) return;
            const sub = data[0];
            const name = sub.student_name || sub.student_email?.split('@')[0] || '學員';
            const html = sub.content || '';
            const escaped = html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

            const modal = document.createElement('div');
            modal.className = 'wp-preview-modal';
            modal.innerHTML = `
                <div class="wp-modal-header">
                    <span>${mi('web', 20)} ${esc(name)} 的作品</span>
                    <button class="wp-modal-close">${mi('close', 22)}</button>
                </div>
                <iframe class="wp-modal-iframe" sandbox="allow-scripts allow-same-origin" srcdoc="${escaped}"></iframe>`;
            document.body.appendChild(modal);

            // 關閉
            const close = () => { modal.remove(); document.removeEventListener('keydown', onEsc); };
            modal.querySelector('.wp-modal-close').addEventListener('click', close);
            modal.addEventListener('click', (ev) => { if (ev.target === modal) close(); });
            const onEsc = (ev) => { if (ev.key === 'Escape') close(); };
            document.addEventListener('keydown', onEsc);
        });

        // ── 自動刷新 ──
        const tid = setInterval(() => loadSubmissions(), 6000);
        this._intervals.set(elementId + '_teacher', tid);
    }

    /* ── 清理 ── */
    destroy() {
        for (const [, id] of this._intervals) clearInterval(id);
        this._intervals.clear();
    }
}
