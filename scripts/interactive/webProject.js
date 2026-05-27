/**
 * 網頁作品展示 互動模組
 *
 * 學員三種方式提交：上傳資料夾、貼上連結、透過 AI 工具 API 提交
 * 教師即時預覽每位學員的網頁作品
 */
import { stateManager } from './stateManager.js';
import { db } from '../supabase.js';

/* ── helpers ── */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mi = (n, s = 18) => `<span class="material-symbols-outlined" style="font-size:${s}px;vertical-align:middle">${n}</span>`;
const MAX_TOTAL_SIZE = 5 * 1024 * 1024;
const TEXT_EXTS = new Set(['html', 'htm', 'css', 'js', 'json', 'svg', 'txt']);
const ALLOWED_EXTS = new Set([...TEXT_EXTS, 'png', 'jpg', 'jpeg', 'gif', 'webp']);
function getExt(name) { return (name.split('.').pop() || '').toLowerCase(); }
function fmtSize(b) { return b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`; }

function combineProject(files) {
    let htmlFile = null;
    for (const [name, f] of files) {
        if (/^index\.html?$/i.test(name)) { htmlFile = f.content; break; }
    }
    if (!htmlFile) {
        for (const [, f] of files) {
            if (/\.(html?)$/i.test(f.name)) { htmlFile = f.content; break; }
        }
    }
    if (!htmlFile) return null;
    let html = htmlFile;
    const get = (href) => {
        const s = href.replace(/^\.\//, '');
        const f = files.get(s) || files.get(s.split('/').pop());
        return f ? f.content : null;
    };
    html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi, (m, h) => { const c = get(h); return c ? `<style>/* ${h} */\n${c}</style>` : m; });
    html = html.replace(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi, (m, h) => { const c = get(h); return c ? `<style>/* ${h} */\n${c}</style>` : m; });
    html = html.replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (m, s) => { const c = get(s); return c ? `<script>/* ${s} */\n${c}<\/script>` : m; });
    html = html.replace(/(<img[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (m, a, s, b) => { const d = get(s); return d?.startsWith('data:') ? a + d + b : m; });
    html = html.replace(/url\(["']?([^"')]+)["']?\)/gi, (m, r) => { const d = get(r); return d?.startsWith('data:') ? `url(${d})` : m; });
    return html;
}

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
    constructor() { this._intervals = new Map(); }

    renderPreview(el, element) {
        el.innerHTML = `
            <div class="wp-preview">
                <div class="wp-preview-header">${mi('web', 28)}<span>網頁作品展示</span></div>
                <div class="wp-preview-task">${esc(element.question || '（尚未設定任務描述）')}</div>
                <div class="wp-preview-meta"><span>${mi('upload_file', 14)} 上傳資料夾 / 貼連結 / AI 提交</span></div>
            </div>`;
    }

    render(el, element) {
        const elementId = el.closest('[data-id]')?.dataset.id || el.dataset.elementId || '';
        el.dataset.elementId = elementId;
        el.classList.add('web-project-container');
        const hwUser = sessionStorage.getItem('homework_user');
        const isPresenter = !!el.closest('.presentation-slide');
        if (hwUser && !isPresenter) this._renderStudent(el, element, elementId);
        else this._renderTeacher(el, element, elementId);
    }

    /* ═══════════════════════════════════════════════ */
    /*               學 員 端                          */
    /* ═══════════════════════════════════════════════ */
    async _renderStudent(el, element, elementId) {
        // 取學員資訊
        let user = {};
        try { user = JSON.parse(sessionStorage.getItem('homework_user') || '{}'); } catch {}
        const sess = (() => { try { return JSON.parse(sessionStorage.getItem('ix_student_session') || '{}'); } catch { return {}; } })();
        const sessionCode = sess.sessionCode || sessionStorage.getItem('_session_code') || '';
        const studentName = user.name || sess.studentName || '';
        const studentEmail = user.email || sess.studentEmail || '';

        // API prompt
        const apiEndpoint = 'https://wsaknnhjgiqmkendeyrj.supabase.co/functions/v1/submit-web-project';
        const apiPrompt = `請幫我將上面的網頁程式碼提交到教學系統。

使用以下 API：

POST ${apiEndpoint}
Content-Type: application/json

{
  "session_id": "${sessionCode}",
  "element_id": "${elementId}",
  "student_name": "${studentName || '（請填你的名字）'}",
  "student_email": "${studentEmail || '（請填你的 Email）'}",
  "html": "（把你的 HTML 放這裡）",
  "css": "（把你的 CSS 放這裡，沒有就填空字串）",
  "js": "（把你的 JS 放這裡，沒有就填空字串）",
  "title": "我的網頁作品"
}

請用 fetch 發送 POST 請求，把 HTML、CSS、JS 分別放到對應的欄位。系統會自動合併。`;

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
                        <!-- 模式切換 -->
                        <div class="wp-mode-tabs">
                            <button class="wp-mode-tab active" data-mode="upload">${mi('folder_open', 15)} 上傳檔案</button>
                            <button class="wp-mode-tab" data-mode="url">${mi('link', 15)} 貼連結</button>
                            <button class="wp-mode-tab" data-mode="api">${mi('smart_toy', 15)} AI 提交</button>
                        </div>

                        <!-- ① 上傳模式 -->
                        <div class="wp-mode-panel" data-panel="upload">
                            <div class="wp-upload-zone">
                                <div class="wp-upload-icon">${mi('cloud_upload', 40)}</div>
                                <div class="wp-upload-text">拖放檔案或點擊選擇</div>
                                <div class="wp-upload-hint">.html .css .js .json .svg .png .jpg .gif</div>
                                <input type="file" class="wp-file-input" multiple accept=".html,.htm,.css,.js,.json,.svg,.png,.jpg,.jpeg,.gif,.webp">
                                <button class="wp-folder-btn">${mi('folder_open', 14)} 選擇資料夾</button>
                                <input type="file" class="wp-folder-input" webkitdirectory style="display:none">
                            </div>
                            <div class="wp-file-list"></div>
                        </div>

                        <!-- ② 連結模式 -->
                        <div class="wp-mode-panel" data-panel="url" style="display:none">
                            <div class="wp-url-section">
                                <label class="wp-url-label">${mi('link', 16)} 已部署的網頁連結</label>
                                <input type="url" class="wp-url-input" placeholder="https://your-project.vercel.app">
                                <div class="wp-url-hint">GitHub Pages、Vercel、Netlify 等</div>
                            </div>
                        </div>

                        <!-- ③ AI 提交模式 -->
                        <div class="wp-mode-panel" data-panel="api" style="display:none">
                            <div class="wp-api-section">
                                <div class="wp-api-title">${mi('smart_toy', 18)} 透過 AI 工具提交</div>
                                <div class="wp-api-desc">在 Claude / ChatGPT 產生網頁後，複製以下提示貼到對話中，AI 會自動幫你提交：</div>
                                <pre class="wp-api-prompt">${esc(apiPrompt)}</pre>
                                <button class="wp-api-copy-btn">${mi('content_copy', 16)} 一鍵複製提示</button>
                            </div>
                        </div>

                        <div class="wp-preview-mini"></div>
                        <div class="wp-submit-bar">
                            <span class="wp-file-count">選擇上方的提交方式</span>
                            <button class="wp-submit-btn" disabled>${mi('send', 16)} 提交作品</button>
                        </div>
                    </div>
                </div>
            </div>`;

        // ── refs ──
        const modeTabs = el.querySelectorAll('.wp-mode-tab');
        const panels = el.querySelectorAll('.wp-mode-panel');
        const dropZone = el.querySelector('.wp-upload-zone');
        const fileInput = el.querySelector('.wp-file-input');
        const folderBtn = el.querySelector('.wp-folder-btn');
        const folderInput = el.querySelector('.wp-folder-input');
        const fileListEl = el.querySelector('.wp-file-list');
        const urlInput = el.querySelector('.wp-url-input');
        const previewMini = el.querySelector('.wp-preview-mini');
        const submitBtn = el.querySelector('.wp-submit-btn');
        const fileCountEl = el.querySelector('.wp-file-count');

        let currentMode = 'upload';
        const projectFiles = new Map();

        // ── 複製 API Prompt ──
        el.querySelector('.wp-api-copy-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(apiPrompt).then(() => {
                const btn = el.querySelector('.wp-api-copy-btn');
                btn.innerHTML = `${mi('check', 16)} 已複製！`;
                setTimeout(() => { btn.innerHTML = `${mi('content_copy', 16)} 一鍵複製提示`; }, 2000);
            });
        });

        // ── 模式切換 ──
        modeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                currentMode = tab.dataset.mode;
                modeTabs.forEach(t => t.classList.toggle('active', t === tab));
                panels.forEach(p => p.style.display = p.dataset.panel === currentMode ? '' : 'none');
                updateSubmitState();
            });
        });

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
            });
        });

        // ── 提交狀態 ──
        const updateSubmitState = () => {
            if (currentMode === 'api') {
                submitBtn.style.display = 'none';
                fileCountEl.textContent = '複製提示後貼到 AI 對話中即可';
                return;
            }
            submitBtn.style.display = '';
            if (currentMode === 'url') {
                const url = urlInput.value.trim();
                const valid = url && /^https?:\/\//i.test(url);
                submitBtn.disabled = !valid;
                fileCountEl.textContent = valid ? '已輸入連結' : '請輸入 https:// 連結';
            } else {
                const hasHtml = [...projectFiles.keys()].some(n => /\.(html?)$/i.test(n));
                let total = 0; projectFiles.forEach(f => total += f.size);
                const over = total > MAX_TOTAL_SIZE;
                submitBtn.disabled = !hasHtml || over;
                if (projectFiles.size === 0) fileCountEl.textContent = '尚未選擇檔案';
                else fileCountEl.innerHTML = `${projectFiles.size} 個檔案，${fmtSize(total)}` +
                    (over ? ' <span style="color:#ef4444">（超過 5MB！）</span>' : '') +
                    (!hasHtml ? ' <span style="color:#f97316">（需要 .html 檔）</span>' : '');
            }
        };
        urlInput.addEventListener('input', updateSubmitState);

        // ── 檔案列表 ──
        const renderFileList = () => {
            if (!projectFiles.size) { fileListEl.innerHTML = ''; updateSubmitState(); return; }
            fileListEl.innerHTML = [...projectFiles].map(([name, f]) => {
                const ic = f.type === 'image' ? 'image' : /\.html?$/i.test(name) ? 'code' : /\.css$/i.test(name) ? 'palette' : /\.js$/i.test(name) ? 'data_object' : 'description';
                return `<div class="wp-file-item"><div class="wp-file-item-left">${mi(ic, 14)}<span title="${esc(name)}">${esc(name)}</span></div><div class="wp-file-item-right"><span class="wp-file-size">${fmtSize(f.size)}</span><button class="wp-file-remove" data-name="${esc(name)}">${mi('close', 14)}</button></div></div>`;
            }).join('');
            updateSubmitState();
            fileListEl.querySelectorAll('.wp-file-remove').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); projectFiles.delete(b.dataset.name); renderFileList(); }));
        };

        // ── 加入檔案 ──
        const addFiles = async (fileList) => {
            const tasks = [];
            for (const file of fileList) {
                if (!ALLOWED_EXTS.has(getExt(file.name))) continue;
                const rel = file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name;
                tasks.push(readFile(file).then(r => { if (r) { r.name = rel || file.name; r.size = file.size; projectFiles.set(r.name, r); } }).catch(() => {}));
            }
            await Promise.all(tasks);
            renderFileList();
        };

        dropZone.addEventListener('click', e => { if (!e.target.closest('.wp-folder-btn')) fileInput.click(); });
        fileInput.addEventListener('change', () => { if (fileInput.files.length) addFiles(fileInput.files); });
        folderBtn.addEventListener('click', e => { e.stopPropagation(); folderInput.click(); });
        folderInput.addEventListener('change', () => { if (folderInput.files.length) addFiles(folderInput.files); });
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

        // ── 提交 ──
        submitBtn.addEventListener('click', async () => {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `${mi('hourglass_top', 16)} 提交中...`;
            const title = element.question?.substring(0, 50) || '網頁作品';
            let content, stateData;

            if (currentMode === 'url') {
                content = urlInput.value.trim();
                stateData = { mode: 'url', url: content, status: 'submitted' };
            } else {
                const combined = combineProject(projectFiles);
                if (!combined) { alert('合併失敗：找不到 HTML 檔案'); submitBtn.disabled = false; submitBtn.innerHTML = `${mi('send', 16)} 提交作品`; return; }
                content = combined;
                stateData = { mode: 'upload', files: [...projectFiles.keys()], status: 'submitted', combinedSize: combined.length };
            }

            await stateManager.clear(elementId);
            await stateManager.save(elementId, { type: 'webProject', title, content, isCorrect: null, score: null, points: 0, participated: true, state: stateData });
            submitBtn.innerHTML = `${mi('check', 16)} 已提交`;
            showPreview(content, stateData.mode);
        });

        // ── Preview ──
        const showPreview = (content, mode) => {
            previewMini.style.display = 'block';
            if (mode === 'url') {
                previewMini.innerHTML = `
                    <div class="wp-preview-mini-label">${mi('visibility', 14)} 作品預覽</div>
                    <iframe class="wp-mini-iframe" src="${esc(content)}" sandbox="allow-scripts allow-same-origin"></iframe>
                    <button class="wp-resubmit-btn">${mi('upload', 16)} 重新提交</button>`;
            } else {
                const escaped = content.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
                previewMini.innerHTML = `
                    <div class="wp-preview-mini-label">${mi('visibility', 14)} 作品預覽</div>
                    <iframe class="wp-mini-iframe" sandbox="allow-scripts" srcdoc="${escaped}"></iframe>
                    <button class="wp-resubmit-btn">${mi('upload', 16)} 重新提交</button>`;
            }
            el.querySelectorAll('.wp-mode-panel').forEach(p => p.style.display = 'none');
            el.querySelector('.wp-mode-tabs').style.display = 'none';

            previewMini.querySelector('.wp-resubmit-btn')?.addEventListener('click', () => {
                previewMini.style.display = 'none'; previewMini.innerHTML = '';
                projectFiles.clear(); renderFileList(); urlInput.value = '';
                submitBtn.innerHTML = `${mi('send', 16)} 提交作品`;
                el.querySelector('.wp-mode-tabs').style.display = '';
                panels.forEach(p => p.style.display = p.dataset.panel === currentMode ? '' : 'none');
                updateSubmitState();
            });
        };

        // ── 載入歷史 ──
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev?.content && prev?.state?.status === 'submitted') {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `${mi('check', 16)} 已提交`;
                showPreview(prev.content, prev.state.mode || 'upload');
            }
        }
    }

    /* ═══════════════════════════════════════════════ */
    /*               教 師 端                          */
    /* ═══════════════════════════════════════════════ */
    async _renderTeacher(el, element, elementId) {
        const sessionCode = window._activeSessionUUID
            || sessionStorage.getItem('_session_code')
            || new URLSearchParams(location.search).get('code') || '';

        el.innerHTML = `
            <div class="wp-teacher">
                <div class="wp-teacher-header">
                    <div class="wp-teacher-title">${mi('web', 22)} 網頁作品展示</div>
                    <div class="wp-teacher-count">共 0 份作品</div>
                </div>
                <div class="wp-teacher-grid"></div>
                <div class="wp-teacher-empty">${mi('pending', 22)} 等待學員提交作品...</div>
            </div>`;

        const gridEl = el.querySelector('.wp-teacher-grid');
        const emptyEl = el.querySelector('.wp-teacher-empty');
        const countEl = el.querySelector('.wp-teacher-count');
        let lastHash = '';

        const loadSubmissions = async () => {
            const filter = { type: 'eq.webProject' };
            if (elementId) filter.element_id = 'eq.' + elementId;
            if (sessionCode) filter.session_id = 'eq.' + sessionCode;
            const { data } = await db.select('submissions', { filter, order: 'created_at.asc' });
            const subs = data || [];
            const hash = subs.map(s => s.id + (s.submitted_at || s.created_at || '')).join('|');
            if (hash === lastHash) return;
            lastHash = hash;
            countEl.textContent = `共 ${subs.length} 份作品`;

            if (!subs.length) { gridEl.innerHTML = ''; emptyEl.style.display = ''; return; }
            emptyEl.style.display = 'none';
            gridEl.innerHTML = subs.map((s, i) => {
                let st = {}; try { st = typeof s.state === 'string' ? JSON.parse(s.state) : (s.state || {}); } catch {}
                const name = s.student_name || s.student_email?.split('@')[0] || `學員${i + 1}`;
                const mode = st.mode || 'upload';
                const files = st.files || [];
                const size = st.combinedSize || 0;
                const modeIcon = mode === 'url' ? '🔗' : mode === 'api' ? '🤖' : `${files.length}`;
                const modeLabel = mode === 'url' ? '外部連結' : mode === 'api' ? 'AI 提交' : `${files.length} 個檔案 · ${fmtSize(size)}`;
                return `
                    <div class="wp-grid-card" style="animation-delay:${i * 0.06}s">
                        <div class="wp-grid-card-header">
                            <span class="wp-grid-card-name">${mi('person', 16)} ${esc(name)}</span>
                            <span class="wp-grid-card-badge">${modeIcon}</span>
                        </div>
                        <div class="wp-grid-card-meta">${mi(mode === 'url' ? 'link' : mode === 'api' ? 'smart_toy' : 'description', 12)} ${modeLabel}</div>
                        <div class="wp-grid-card-actions">
                            <button class="wp-preview-btn" data-sid="${s.id}" data-mode="${mode}">${mi('visibility', 14)} 預覽</button>
                        </div>
                    </div>`;
            }).join('');
        };

        await loadSubmissions();

        gridEl.addEventListener('click', async e => {
            const btn = e.target.closest('.wp-preview-btn');
            if (!btn) return;
            const { data } = await db.select('submissions', { filter: { id: 'eq.' + btn.dataset.sid }, limit: 1 });
            if (!data?.length) return;
            const sub = data[0], mode = btn.dataset.mode;
            const name = sub.student_name || sub.student_email?.split('@')[0] || '學員';
            const content = sub.content || '';
            const modal = document.createElement('div');
            modal.className = 'wp-preview-modal';

            const modeTag = mode === 'url' ? ' <span style="font-size:0.72rem;color:#94a3b8;margin-left:8px">🔗 外部連結</span>'
                : mode === 'api' ? ' <span style="font-size:0.72rem;color:#94a3b8;margin-left:8px">🤖 AI 提交</span>' : '';

            if (mode === 'url') {
                modal.innerHTML = `<div class="wp-modal-header"><span>${mi('web', 20)} ${esc(name)} 的作品${modeTag}</span><button class="wp-modal-close">${mi('close', 22)}</button></div>
                    <iframe class="wp-modal-iframe" src="${esc(content)}" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
            } else {
                const escaped = content.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
                modal.innerHTML = `<div class="wp-modal-header"><span>${mi('web', 20)} ${esc(name)} 的作品${modeTag}</span><button class="wp-modal-close">${mi('close', 22)}</button></div>
                    <iframe class="wp-modal-iframe" sandbox="allow-scripts allow-same-origin" srcdoc="${escaped}"></iframe>`;
            }
            document.body.appendChild(modal);
            const close = () => { modal.remove(); document.removeEventListener('keydown', onEsc); };
            modal.querySelector('.wp-modal-close').addEventListener('click', close);
            modal.addEventListener('click', ev => { if (ev.target === modal) close(); });
            const onEsc = ev => { if (ev.key === 'Escape') close(); };
            document.addEventListener('keydown', onEsc);
        });

        const tid = setInterval(() => loadSubmissions(), 6000);
        this._intervals.set(elementId + '_teacher', tid);
    }

    destroy() {
        for (const [, id] of this._intervals) clearInterval(id);
        this._intervals.clear();
    }
}
