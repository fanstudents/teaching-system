/**
 * 網頁作品展示 互動模組
 * 三種提交方式同時呈現：上傳資料夾 / 貼連結 / AI 提交
 */
import { stateManager } from './stateManager.js';
import { db } from '../supabase.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mi = (n, s = 18) => `<span class="material-symbols-outlined" style="font-size:${s}px;vertical-align:middle">${n}</span>`;
const MAX_TOTAL_SIZE = 5 * 1024 * 1024;
const TEXT_EXTS = new Set(['html', 'htm', 'css', 'js', 'json', 'svg', 'txt']);
const ALLOWED_EXTS = new Set([...TEXT_EXTS, 'png', 'jpg', 'jpeg', 'gif', 'webp']);
const getExt = n => (n.split('.').pop() || '').toLowerCase();
const fmtSize = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

function combineProject(files) {
    let html = null;
    for (const [n, f] of files) { if (/^index\.html?$/i.test(n)) { html = f.content; break; } }
    if (!html) for (const [, f] of files) { if (/\.html?$/i.test(f.name)) { html = f.content; break; } }
    if (!html) return null;
    const get = h => { const s = h.replace(/^\.\//, ''); const f = files.get(s) || files.get(s.split('/').pop()); return f?.content || null; };
    html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi, (m, h) => { const c = get(h); return c ? `<style>${c}</style>` : m; });
    html = html.replace(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi, (m, h) => { const c = get(h); return c ? `<style>${c}</style>` : m; });
    html = html.replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (m, s) => { const c = get(s); return c ? `<script>${c}<\/script>` : m; });
    html = html.replace(/(<img[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (m, a, s, b) => { const d = get(s); return d?.startsWith('data:') ? a + d + b : m; });
    html = html.replace(/url\(["']?([^"')]+)["']?\)/gi, (m, r) => { const d = get(r); return d?.startsWith('data:') ? `url(${d})` : m; });
    return html;
}

function readFile(file) {
    return new Promise((resolve) => {
        const ext = getExt(file.name);
        if (!ALLOWED_EXTS.has(ext)) { resolve(null); return; }
        const reader = new FileReader();
        reader.onerror = () => resolve(null);
        if (TEXT_EXTS.has(ext)) {
            reader.onload = () => resolve({ name: file.name, type: 'text', content: reader.result });
            reader.readAsText(file);
        } else {
            reader.onload = () => resolve({ name: file.name, type: 'image', content: reader.result });
            reader.readAsDataURL(file);
        }
    });
}

export class WebProjectGame {
    constructor() { this._intervals = new Map(); }

    renderPreview(el, element) {
        el.innerHTML = `<div class="wp-preview">
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
    async _renderStudent(el, element, elementId) {
        let user = {}; try { user = JSON.parse(sessionStorage.getItem('homework_user') || '{}'); } catch {}
        const sess = (() => { try { return JSON.parse(sessionStorage.getItem('ix_student_session') || '{}'); } catch { return {}; } })();
        const sessionCode = sess.sessionCode || sessionStorage.getItem('_session_code') || '';
        const studentName = user.name || sess.studentName || '';
        const studentEmail = user.email || sess.studentEmail || '';

        const SUBMIT_URL = 'https://wsaknnhjgiqmkendeyrj.supabase.co/functions/v1/submit-web-project';

        const buildApiPrompt = () => {
            const task = element.question || '請幫我建立一個網頁';
            return `${task}

完成後用此 API 提交作品：
POST ${SUBMIT_URL}
Body: {"session_id":"${sessionCode}","element_id":"${elementId}","student_name":"${studentName}","student_email":"${studentEmail}","html":"完整HTML","css":"CSS內容","js":"JS內容"}`;
        };

        el.innerHTML = `
        <div class="wp-student">
            <!-- 任務說明 -->
            <div class="wp-task-bar">
                <span class="wp-task-bar-icon">${mi('assignment', 16)}</span>
                <span class="wp-task-bar-text">${esc(element.question || '請上傳你的網頁作品')}</span>
                <button class="wp-copy-task-btn" title="複製題目">${mi('content_copy', 14)}</button>
            </div>

            <!-- 三欄卡片 -->
            <div class="wp-cards">
                <!-- ① 上傳資料夾 -->
                <div class="wp-card-method wp-card-upload">
                    <div class="wp-card-icon-wrap wp-icon-blue">${mi('folder_zip', 28)}</div>
                    <div class="wp-card-title">上傳檔案</div>
                    <div class="wp-card-desc">選擇包含 HTML/CSS/JS 的資料夾或檔案</div>
                    <input type="file" class="wp-folder-input" webkitdirectory style="display:none">
                    <input type="file" class="wp-file-input" multiple accept=".html,.htm,.css,.js,.json,.svg,.png,.jpg,.jpeg,.gif,.webp" style="display:none">
                    <button class="wp-card-action-btn wp-folder-select-btn">${mi('folder_open', 16)} 選擇資料夾</button>
                    <button class="wp-card-action-btn wp-file-select-btn wp-card-action-secondary">${mi('upload_file', 14)} 或選擇檔案</button>
                    <div class="wp-file-list"></div>
                    <div class="wp-file-status"></div>
                    <textarea class="wp-prompt-input" data-for="upload" placeholder="貼上你下給 AI 的提示詞（選填）" rows="2"></textarea>
                    <button class="wp-card-submit-btn wp-upload-submit" disabled>${mi('send', 14)} 提交作品</button>
                </div>

                <!-- ② 貼上連結 -->
                <div class="wp-card-method wp-card-link">
                    <div class="wp-card-icon-wrap wp-icon-green">${mi('link', 28)}</div>
                    <div class="wp-card-title">貼上連結</div>
                    <div class="wp-card-desc">已部署到 Vercel / GitHub Pages 等平台</div>
                    <input type="url" class="wp-url-input" placeholder="https://your-project.vercel.app">
                    <textarea class="wp-prompt-input" data-for="url" placeholder="貼上你下給 AI 的提示詞（選填）" rows="2"></textarea>
                    <button class="wp-card-submit-btn wp-url-submit" disabled>${mi('send', 14)} 提交作品</button>
                </div>

                <!-- ③ AI 提交 -->
                <div class="wp-card-method wp-card-ai">
                    <div class="wp-card-icon-wrap wp-icon-purple">${mi('smart_toy', 28)}</div>
                    <div class="wp-card-title">AI 自動提交</div>
                    <div class="wp-card-desc">讓 AI 幫你產生作品並提交到講師端</div>
                    <div class="wp-ai-steps">
                        <div class="wp-ai-step"><span class="wp-step-num">1</span> 點擊下方複製提示詞</div>
                        <div class="wp-ai-step"><span class="wp-step-num">2</span> 貼到 Claude / ChatGPT 對話</div>
                        <div class="wp-ai-step"><span class="wp-step-num">3</span> AI 完成後會自動提交作品</div>
                    </div>
                    <button class="wp-card-action-btn wp-ai-copy-prompt">${mi('content_copy', 16)} 一鍵複製提示詞</button>
                    <div class="wp-ai-hint">${mi('info', 12)} 提交後此頁會自動顯示預覽</div>
                </div>
            </div>

            <!-- 預覽區 -->
            <div class="wp-preview-mini"></div>
        </div>`;

        // ── refs ──
        const folderInput = el.querySelector('.wp-folder-input');
        const fileInput = el.querySelector('.wp-file-input');
        const fileListEl = el.querySelector('.wp-file-list');
        const fileStatusEl = el.querySelector('.wp-file-status');
        const uploadSubmitBtn = el.querySelector('.wp-upload-submit');
        const urlInput = el.querySelector('.wp-url-input');
        const urlSubmitBtn = el.querySelector('.wp-url-submit');
        const previewMini = el.querySelector('.wp-preview-mini');
        const projectFiles = new Map();

        // ── 複製題目 ──
        el.querySelector('.wp-copy-task-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            navigator.clipboard.writeText(element.question || '').then(() => {
                const btn = el.querySelector('.wp-copy-task-btn');
                btn.innerHTML = mi('check', 14);
                setTimeout(() => btn.innerHTML = mi('content_copy', 14), 1500);
            });
        });

        // ── 複製 AI 提示詞（含 fetch 指令） ──
        el.querySelector('.wp-ai-copy-prompt')?.addEventListener('click', e => {
            e.stopPropagation();
            navigator.clipboard.writeText(buildApiPrompt()).then(() => {
                const btn = el.querySelector('.wp-ai-copy-prompt');
                btn.innerHTML = `${mi('check', 16)} 已複製！貼到 AI 對話即可`;
                setTimeout(() => btn.innerHTML = `${mi('content_copy', 16)} 一鍵複製提示詞`, 3000);
            });
        });

        // ── 檔案處理 ──
        const addFiles = async (fileList) => {
            for (const file of fileList) {
                if (!ALLOWED_EXTS.has(getExt(file.name))) continue;
                const rel = file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name;
                const r = await readFile(file);
                if (r) { r.name = rel || file.name; r.size = file.size; projectFiles.set(r.name, r); }
            }
            renderFileList();
        };

        const renderFileList = () => {
            if (!projectFiles.size) {
                fileListEl.innerHTML = '';
                fileStatusEl.textContent = '';
                uploadSubmitBtn.disabled = true;
                return;
            }
            const names = [...projectFiles.keys()];
            let total = 0; projectFiles.forEach(f => total += f.size);
            const hasHtml = names.some(n => /\.html?$/i.test(n));
            const over = total > MAX_TOTAL_SIZE;

            fileListEl.innerHTML = names.slice(0, 6).map(n =>
                `<div class="wp-file-chip">${mi(/\.html?$/i.test(n) ? 'code' : /\.css$/i.test(n) ? 'palette' : /\.js$/i.test(n) ? 'data_object' : 'description', 12)} ${esc(n.length > 15 ? n.slice(0, 12) + '…' : n)}</div>`
            ).join('') + (names.length > 6 ? `<div class="wp-file-chip">+${names.length - 6}</div>` : '');

            fileStatusEl.innerHTML = `${names.length} 個檔案 · ${fmtSize(total)}` +
                (over ? ' <span style="color:#ef4444">超過限制</span>' : '') +
                (!hasHtml ? ' <span style="color:#f97316">需要 .html</span>' : '');
            uploadSubmitBtn.disabled = !hasHtml || over;
        };

        el.querySelector('.wp-folder-select-btn').addEventListener('click', () => folderInput.click());
        el.querySelector('.wp-file-select-btn').addEventListener('click', () => fileInput.click());
        folderInput.addEventListener('change', () => { if (folderInput.files.length) addFiles(folderInput.files); });
        fileInput.addEventListener('change', () => { if (fileInput.files.length) addFiles(fileInput.files); });

        // Drag & Drop on upload card
        const uploadCard = el.querySelector('.wp-card-upload');
        uploadCard.addEventListener('dragover', e => { e.preventDefault(); uploadCard.classList.add('dragover'); });
        uploadCard.addEventListener('dragleave', () => uploadCard.classList.remove('dragover'));
        uploadCard.addEventListener('drop', e => { e.preventDefault(); uploadCard.classList.remove('dragover'); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

        // ── URL 模式 ──
        urlInput.addEventListener('input', () => {
            urlSubmitBtn.disabled = !/^https?:\/\//i.test(urlInput.value.trim());
        });

        // ── 提交共用 ──
        let submitCount = 0;
        const doSubmit = async (content, stateData, btn) => {
            btn.disabled = true;
            btn.innerHTML = `${mi('hourglass_top', 14)} 提交中...`;
            const title = element.question?.substring(0, 50) || '網頁作品';
            submitCount++;
            stateData._version = submitCount;
            await stateManager.clear(elementId);
            await stateManager.save(elementId, { type: 'webProject', title, content, isCorrect: null, score: null, points: 0, participated: true, state: stateData });
            btn.innerHTML = `${mi('check', 14)} 已提交！`;
            showPreview(content, stateData.mode);
        };

        uploadSubmitBtn.addEventListener('click', () => {
            const combined = combineProject(projectFiles);
            if (!combined) { alert('合併失敗：找不到 HTML'); return; }
            const prompt = el.querySelector('.wp-prompt-input[data-for="upload"]')?.value.trim() || '';
            doSubmit(combined, { mode: 'upload', files: [...projectFiles.keys()], status: 'submitted', combinedSize: combined.length, prompt }, uploadSubmitBtn);
        });

        urlSubmitBtn.addEventListener('click', () => {
            const url = urlInput.value.trim();
            const prompt = el.querySelector('.wp-prompt-input[data-for="url"]')?.value.trim() || '';
            doSubmit(url, { mode: 'url', url, status: 'submitted', prompt }, urlSubmitBtn);
        });

        // ── 提交後顯示作品牆 ──
        const showPreview = (content, mode, silent = false) => {
            const modeLabel = mode === 'api' ? '🤖 AI 提交成功！' : mode === 'url' ? '🔗 連結已提交！' : '📁 檔案已提交！';
            const modeEmoji = mode === 'url' ? '🔗' : mode === 'api' ? '🤖' : '📁';
            el.querySelector('.wp-cards').style.display = 'none';
            previewMini.style.display = 'flex';
            previewMini.style.flexDirection = 'column';
            previewMini.style.flex = '1';
            previewMini.style.minHeight = '0';
            previewMini.style.gap = '10px';

            // 我的作品 thumb
            const myThumbAttr = mode === 'url'
                ? `src="${esc(content)}" sandbox="allow-scripts allow-same-origin"`
                : `sandbox="allow-scripts" srcdoc="${content.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
            let myTitle = '';
            const tm = content.match(/<title[^>]*>([^<]*)<\/title>/i);
            if (tm) myTitle = tm[1].trim();
            // 抓提示詞
            const myPrompt = el.querySelector('.wp-prompt-input[data-for="upload"]')?.value.trim()
                || el.querySelector('.wp-prompt-input[data-for="url"]')?.value.trim() || '';

            previewMini.innerHTML = `
                <div class="wp-my-card">
                    <div class="wp-my-card-thumb">
                        <iframe class="wp-thumb-iframe" ${myThumbAttr} loading="lazy" tabindex="-1"></iframe>
                        <span class="wp-thumb-badge">${modeEmoji}</span>
                        <div class="wp-thumb-overlay">
                            <button class="wp-my-open-btn">${mi('open_in_full', 14)}</button>
                        </div>
                    </div>
                    <div class="wp-my-card-info">
                        <div class="wp-my-card-status">${mi('check_circle', 14)} <b>${modeLabel}</b></div>
                        ${myTitle ? `<div class="wp-my-card-title">${esc(myTitle)}</div>` : ''}
                        ${myPrompt ? `<div class="wp-my-card-prompt">${mi('chat', 11)} ${esc(myPrompt)}</div>` : ''}
                        <div class="wp-my-card-actions">
                            <button class="wp-my-open-new">${mi('open_in_new', 13)} 新分頁</button>
                            <button class="wp-resubmit-btn">${mi('refresh', 13)} 重新提交</button>
                        </div>
                    </div>
                </div>
                <div class="wp-preview-mini-header" style="padding:0;">
                    <span class="wp-preview-mini-label">${mi('group', 14)} 全班作品</span>
                    <span class="wp-gallery-stats" style="font-size:0.72rem;color:#64748b;"></span>
                </div>
                <div class="wp-teacher-grid wp-student-gallery" style="flex:1;overflow-y:auto;min-height:0;"></div>`;

            const galleryGrid = previewMini.querySelector('.wp-student-gallery');
            const galleryStats = previewMini.querySelector('.wp-gallery-stats');
            const galleryCache = new Map();
            let galleryHash = '';

            const loadGallery = async () => {
                const filter = { type: 'eq.webProject' };
                if (elementId) filter.element_id = 'eq.' + elementId;
                if (sessionCode) filter.session_id = 'eq.' + sessionCode;
                const { data } = await db.select('submissions', { filter, order: 'created_at.asc' });
                const subs = data || [];
                const hash = subs.map(s => s.id + (s.submitted_at || s.created_at || '')).join('|');
                if (hash === galleryHash) return;
                galleryHash = hash;

                subs.forEach(s => galleryCache.set(s.id, s.content || ''));
                galleryStats.textContent = `共 ${subs.length} 份作品`;

                galleryGrid.innerHTML = subs.map((s, i) => {
                    let st = {}; try { st = typeof s.state === 'string' ? JSON.parse(s.state) : (s.state || {}); } catch {}
                    const name = s.student_name || s.student_email?.split('@')[0] || `學員${i + 1}`;
                    const md = st.mode || 'upload';
                    const me = md === 'url' ? '🔗' : md === 'api' ? '🤖' : '📁';
                    const isMe = s.student_email === studentEmail;
                    const c = s.content || '';
                    let ta = '';
                    if (md === 'url' && c.startsWith('http')) {
                        ta = `src="${esc(c)}" sandbox="allow-scripts allow-same-origin"`;
                    } else if (c) {
                        ta = `sandbox="allow-scripts" srcdoc="${c.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
                    }
                    let pt = '';
                    const ttm = c.match(/<title[^>]*>([^<]*)<\/title>/i);
                    if (ttm) pt = ttm[1].trim();

                    const ver = st._version || 1;
                    const vb = ver > 1 ? `<span class="wp-thumb-version">第${ver}版</span>` : '';

                    return `<div class="wp-grid-card${isMe ? ' wp-grid-card-me' : ''}" style="animation-delay:${i * 0.05}s">
                        <div class="wp-thumb-wrapper">
                            ${ta ? `<iframe class="wp-thumb-iframe" ${ta} loading="lazy" tabindex="-1"></iframe>` : `<div class="wp-thumb-placeholder">${mi('web', 32)}</div>`}
                            <div class="wp-thumb-overlay">
                                <button class="wp-preview-btn" data-sid="${s.id}" data-mode="${md}">${mi('open_in_full', 16)}</button>
                            </div>
                            <span class="wp-thumb-badge">${me}</span>
                            ${isMe ? '<span class="wp-thumb-me">我</span>' : ''}
                            ${vb}
                        </div>
                        <div class="wp-grid-card-body">
                            <div class="wp-grid-card-name">${esc(name)}</div>
                            ${pt ? `<div class="wp-grid-card-title">${esc(pt)}</div>` : ''}
                        </div>
                    </div>`;
                }).join('');
            };

            loadGallery();
            const galleryPollId = setInterval(loadGallery, 6000);
            this._intervals.set(elementId + '_gallery', galleryPollId);

            // 點擊卡片 → 新分頁
            galleryGrid.addEventListener('click', e => {
                const card = e.target.closest('.wp-grid-card');
                if (!card) return;
                const btn = card.querySelector('.wp-preview-btn');
                if (!btn) return;
                const cached = galleryCache.get(btn.dataset.sid);
                if (!cached) return;
                if (btn.dataset.mode === 'url') { window.open(cached, '_blank'); return; }
                const blob = new Blob([cached], { type: 'text/html;charset=utf-8' });
                window.open(URL.createObjectURL(blob), '_blank');
            });

            // 我的卡片：新分頁
            previewMini.querySelector('.wp-my-open-btn')?.addEventListener('click', () => {
                if (mode === 'url') { window.open(content, '_blank'); return; }
                const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
                window.open(URL.createObjectURL(blob), '_blank');
            });
            previewMini.querySelector('.wp-my-open-new')?.addEventListener('click', () => {
                if (mode === 'url') { window.open(content, '_blank'); return; }
                const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
                window.open(URL.createObjectURL(blob), '_blank');
            });

            // 重新提交
            previewMini.querySelector('.wp-resubmit-btn')?.addEventListener('click', () => {
                clearInterval(galleryPollId);
                this._intervals.delete(elementId + '_gallery');
                previewMini.style.display = 'none'; previewMini.innerHTML = '';
                el.querySelector('.wp-cards').style.display = '';
                projectFiles.clear(); renderFileList(); urlInput.value = '';
                uploadSubmitBtn.disabled = true; uploadSubmitBtn.innerHTML = `${mi('send', 14)} 提交作品`;
                urlSubmitBtn.disabled = true; urlSubmitBtn.innerHTML = `${mi('send', 14)} 提交作品`;
            });

            // toast（僅首次提交顯示）
            if (!silent) {
                const toast = document.createElement('div');
                toast.textContent = modeLabel;
                Object.assign(toast.style, {
                    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                    background: '#16a34a', color: '#fff', padding: '10px 24px', borderRadius: '10px',
                    fontSize: '14px', fontWeight: '600', zIndex: '99999', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    animation: 'fadeIn .3s ease',
                });
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }
        };

        // ── 載入歷史 ──
        let shown = false;
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev?.content && prev?.state?.status === 'submitted') {
                showPreview(prev.content, prev.state.mode || 'upload', true);
                shown = true;
            }
        }

        // ── 輪詢偵測 API 提交 ──
        if (!shown && elementId && studentEmail) {
            const pollApi = async () => {
                try {
                    const filter = { type: 'eq.webProject', element_id: 'eq.' + elementId, student_email: 'eq.' + studentEmail };
                    if (sessionCode) filter.session_id = 'eq.' + sessionCode;
                    const { data } = await db.select('submissions', { filter, limit: 1, order: 'created_at.desc' });
                    if (data?.length) {
                        const sub = data[0];
                        let st = {}; try { st = typeof sub.state === 'string' ? JSON.parse(sub.state) : (sub.state || {}); } catch {}
                        if (st.mode === 'api' && sub.content) {
                            clearInterval(apiPollId);
                            showPreview(sub.content, 'api');
                        }
                    }
                } catch {}
            };
            const apiPollId = setInterval(pollApi, 5000);
            this._intervals.set(elementId + '_api_poll', apiPollId);
        }
    }

    /* ═══════════════════════════════════════════════ */
    async _renderTeacher(el, element, elementId) {
        // 解析 session code：優先用 join_code，若只有 UUID 則查 project_sessions 轉換
        let sessionCode = window.app?.sessionCode || '';
        if (!sessionCode) {
            const uuid = window._activeSessionUUID || sessionStorage.getItem('_session_code') || new URLSearchParams(location.search).get('sid') || '';
            if (uuid) {
                // 嘗試當 join_code 用；同時查 project_sessions 取真正的 join_code
                try {
                    const { data } = await db.select('project_sessions', { filter: { id: `eq.${uuid}` }, select: 'join_code', limit: 1 });
                    sessionCode = data?.[0]?.join_code || uuid;
                } catch { sessionCode = uuid; }
            }
        }
        el.innerHTML = `<div class="wp-teacher">
            <div class="wp-teacher-header">
                <div class="wp-teacher-title">${mi('web', 22)} 網頁作品展示</div>
                <div class="wp-teacher-stats"></div>
            </div>
            <div class="wp-teacher-grid"></div>
            <div class="wp-teacher-empty">${mi('pending', 22)} 等待學員提交作品...</div>
        </div>`;

        const gridEl = el.querySelector('.wp-teacher-grid');
        const emptyEl = el.querySelector('.wp-teacher-empty');
        const statsEl = el.querySelector('.wp-teacher-stats');
        let lastHash = '';
        const contentCache = new Map();

        const load = async () => {
            const filter = { type: 'eq.webProject' };
            if (elementId) filter.element_id = 'eq.' + elementId;
            if (sessionCode) filter.session_id = 'eq.' + sessionCode;
            const { data } = await db.select('submissions', { filter, order: 'created_at.asc' });
            const subs = data || [];
            const hash = subs.map(s => s.id + (s.submitted_at || s.created_at || '')).join('|');
            if (hash === lastHash) return;
            lastHash = hash;
            // 統計模式
            const modes = { upload: 0, url: 0, api: 0 };
            subs.forEach(s => {
                contentCache.set(s.id, s.content || '');
                let st = {}; try { st = typeof s.state === 'string' ? JSON.parse(s.state) : (s.state || {}); } catch {}
                modes[st.mode || 'upload']++;
            });
            const statsParts = [`共 ${subs.length} 份`];
            if (modes.upload) statsParts.push(`📁 ${modes.upload}`);
            if (modes.url) statsParts.push(`🔗 ${modes.url}`);
            if (modes.api) statsParts.push(`🤖 ${modes.api}`);
            statsEl.innerHTML = statsParts.join('<span class="wp-stats-sep">·</span>');
            if (!subs.length) { gridEl.innerHTML = ''; emptyEl.style.display = ''; return; }
            emptyEl.style.display = 'none';
            gridEl.innerHTML = subs.map((s, i) => {
                let st = {}; try { st = typeof s.state === 'string' ? JSON.parse(s.state) : (s.state || {}); } catch {}
                const name = s.student_name || s.student_email?.split('@')[0] || `學員${i + 1}`;
                const mode = st.mode || 'upload';
                const modeEmoji = mode === 'url' ? '🔗' : mode === 'api' ? '🤖' : '📁';
                const files = st.files || [];
                const size = st.combinedSize || 0;
                const label = mode === 'url' ? '外部連結' : mode === 'api' ? 'AI 提交' : `${files.length} 檔 · ${fmtSize(size)}`;
                const content = s.content || '';
                const prompt = st.prompt || '';

                let pageTitle = '';
                const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
                if (titleMatch) pageTitle = titleMatch[1].trim();

                let thumbAttr = '';
                if (mode === 'url' && content.startsWith('http')) {
                    thumbAttr = `src="${esc(content)}" sandbox="allow-scripts allow-same-origin"`;
                } else if (content) {
                    thumbAttr = `sandbox="allow-scripts" srcdoc="${content.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
                }

                const promptPreview = prompt ? `<div class="wp-grid-card-prompt" title="${esc(prompt)}">${mi('chat', 11)} ${esc(prompt)}</div>` : '';
                const version = st._version || 1;
                const versionBadge = version > 1 ? `<span class="wp-thumb-version">第${version}版</span>` : '';

                return `<div class="wp-grid-card" style="animation-delay:${i * 0.06}s">
                    <div class="wp-thumb-wrapper">
                        ${thumbAttr ? `<iframe class="wp-thumb-iframe" ${thumbAttr} loading="lazy" tabindex="-1"></iframe>` : `<div class="wp-thumb-placeholder">${mi('web', 32)}</div>`}
                        <div class="wp-thumb-overlay">
                            <button class="wp-preview-btn" data-sid="${s.id}" data-mode="${mode}">${mi('open_in_full', 16)}</button>
                        </div>
                        <span class="wp-thumb-badge">${modeEmoji}</span>
                        ${versionBadge}
                    </div>
                    <div class="wp-grid-card-body">
                        <div class="wp-grid-card-name">${esc(name)}</div>
                        ${pageTitle ? `<div class="wp-grid-card-title">${esc(pageTitle)}</div>` : ''}
                        ${promptPreview}
                        <div class="wp-grid-card-meta">${label}</div>
                    </div>
                </div>`;
            }).join('');
        };
        await load();

        gridEl.addEventListener('click', e => {
            const card = e.target.closest('.wp-grid-card');
            if (!card) return;
            const btn = card.querySelector('.wp-preview-btn');
            if (!btn) return;
            const sid = btn.dataset.sid, mode = btn.dataset.mode;
            const cached = contentCache.get(sid);
            if (!cached) return;

            const winFeatures = 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no';
            if (mode === 'url') {
                window.open(cached, '_blank', winFeatures);
            } else {
                const blob = new Blob([cached], { type: 'text/html;charset=utf-8' });
                window.open(URL.createObjectURL(blob), '_blank', winFeatures);
            }
        });

        const tid = setInterval(load, 6000);
        this._intervals.set(elementId + '_teacher', tid);
    }

    destroy() { for (const [, id] of this._intervals) clearInterval(id); this._intervals.clear(); }
}
