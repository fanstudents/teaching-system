/**
 * 作業提交模組
 * 支援文字、圖片、影片、音檔、連結等多種格式
 */
import { db, storage } from './supabase.js';
import { showToast } from './ui.js';



export class HomeworkSubmission {
    constructor() {
        this.submissions = [];
        this.loadSubmissions();
    }

    /* ── 資料持久化 ── */

    loadSubmissions() {
        const saved = localStorage.getItem('homework_submissions');
        if (saved) {
            try { this.submissions = JSON.parse(saved); }
            catch { this.submissions = []; }
        }
    }

    saveSubmissions() {
        localStorage.setItem('homework_submissions', JSON.stringify(this.submissions));
    }

    /* ── 輕量使用者識別 ── */

    getUser() {
        const saved = sessionStorage.getItem('homework_user');
        if (saved) {
            try { return JSON.parse(saved); }
            catch { /* ignore */ }
        }
        return null;
    }

    saveUser(name) {
        const user = { name, joinedAt: new Date().toISOString() };
        sessionStorage.setItem('homework_user', JSON.stringify(user));
        return user;
    }

    /* ── 主對話框 ── */

    showSubmitDialog(assignmentOrTitle = '作業提交', submissionMode = null) {
        // 支援傳入字串或 assignment 物件
        const assignment = typeof assignmentOrTitle === 'object' ? assignmentOrTitle : null;
        const assignmentTitle = assignment?.title || (typeof assignmentOrTitle === 'string' ? assignmentOrTitle : '作業提交');
        const assignmentId = assignment?.id || null;
        const assignmentDesc = assignment?.description || '';
        const assignmentDue = assignment?.due_date ? new Date(assignment.due_date) : null;
        // submissionMode 可從 assignment 物件取得
        const mode = submissionMode || assignment?.submissionMode || null;

        return new Promise((resolve, reject) => {
            const user = this.getUser();
            const overlay = document.createElement('div');
            overlay.className = 'homework-overlay active';

            const dueHtml = assignmentDue
                ? `<div style="font-size:0.78rem;color:#e37400;margin-top:4px;">⏰ 繳交期限：${assignmentDue.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>`
                : '';
            const descHtml = assignmentDesc
                ? `<div style="font-size:0.82rem;color:#5f6368;margin-top:4px;line-height:1.5;">${assignmentDesc}</div>`
                : '';

            // 根據 mode 生成不同的內容區
            let contentHtml = '';
            if (mode === 'image_only') {
                contentHtml = `
                    <div class="homework-content" id="homeworkContent">
                        <div class="homework-panel active" data-panel="image">
                            <div class="homework-upload-area" id="imageUploadArea">
                                <div class="upload-icon">📷</div>
                                <p>點擊、拖曳或 Ctrl+V 貼上圖片</p>
                                <span class="upload-hint">支援 JPG、PNG、GIF（上限 2MB，自動壓縮）</span>
                                <input type="file" id="homeworkImageInput" accept="image/*" hidden>
                            </div>
                            <div class="homework-preview" id="imagePreview"></div>
                        </div>
                    </div>`;
            } else if (mode === 'image_prompt') {
                contentHtml = `
                    <div class="homework-content" id="homeworkContent">
                        <div class="homework-panel active" data-panel="image_prompt">
                            <div class="homework-upload-area" id="imageUploadArea">
                                <div class="upload-icon">📷</div>
                                <p>點擊、拖曳或 Ctrl+V 貼上圖片</p>
                                <span class="upload-hint">支援 JPG、PNG、GIF（上限 2MB，自動壓縮）</span>
                                <input type="file" id="homeworkImageInput" accept="image/*" hidden>
                            </div>
                            <div class="homework-preview" id="imagePreview"></div>
                            <div style="margin-top:12px;">
                                <label style="font-size:0.85rem;font-weight:600;color:#1e293b;display:block;margin-bottom:6px;">💬 提示詞 (Prompt)</label>
                                <textarea class="homework-textarea" id="homeworkPromptText"
                                          placeholder="請貼上你使用的 Prompt..." style="min-height:80px;"></textarea>
                            </div>
                        </div>
                    </div>`;
            } else if (mode === 'text_only') {
                contentHtml = `
                    <div class="homework-content" id="homeworkContent">
                        <div class="homework-panel active" data-panel="text">
                            <textarea class="homework-textarea" id="homeworkText"
                                      placeholder="在這裡輸入您的作業內容..."></textarea>
                        </div>
                    </div>`;
            } else {
                // 原始全功能模式
                contentHtml = `
                    <div class="homework-tabs">
                        <button class="homework-tab active" data-type="text">📝 文字</button>
                        <button class="homework-tab" data-type="image">🖼️ 圖片</button>
                        <button class="homework-tab" data-type="video">🎬 影片</button>
                        <button class="homework-tab" data-type="audio">🎵 音檔</button>
                        <button class="homework-tab" data-type="link">🔗 連結</button>
                    </div>
                    <div class="homework-content" id="homeworkContent">
                        <div class="homework-panel active" data-panel="text">
                            <textarea class="homework-textarea" id="homeworkText"
                                      placeholder="在這裡輸入您的作業內容..."></textarea>
                        </div>
                        <div class="homework-panel" data-panel="image">
                            <div class="homework-upload-area" id="imageUploadArea">
                                <div class="upload-icon">📷</div>
                                <p>點擊、拖曳或 Ctrl+V 貼上圖片</p>
                                <span class="upload-hint">支援 JPG、PNG、GIF（上限 2MB，自動壓縮）</span>
                                <input type="file" id="homeworkImageInput" accept="image/*" hidden>
                            </div>
                            <div class="homework-preview" id="imagePreview"></div>
                        </div>
                        <div class="homework-panel" data-panel="video">
                            <div class="homework-upload-area" id="videoUploadArea">
                                <div class="upload-icon">🎥</div>
                                <p>點擊或拖曳影片到這裡</p>
                                <span class="upload-hint">支援 MP4、WebM</span>
                                <input type="file" id="homeworkVideoInput" accept="video/*" hidden>
                            </div>
                            <div class="homework-preview" id="videoPreview"></div>
                        </div>
                        <div class="homework-panel" data-panel="audio">
                            <div class="homework-upload-area" id="audioUploadArea">
                                <div class="upload-icon">🎙️</div>
                                <p>點擊或拖曳音檔到這裡</p>
                                <span class="upload-hint">支援 MP3、WAV、M4A</span>
                                <input type="file" id="homeworkAudioInput" accept="audio/*" hidden>
                            </div>
                            <div class="homework-preview" id="audioPreview"></div>
                        </div>
                        <div class="homework-panel" data-panel="link">
                            <input type="url" class="homework-link-input" id="homeworkLink"
                                   placeholder="https://...">
                            <p class="homework-link-hint">貼上 YouTube、Google Drive、Dropbox 或其他連結</p>
                        </div>
                    </div>`;
            }

            overlay.innerHTML = `
                <div class="homework-modal">
                    <div class="homework-header">
                        <h3>${assignmentTitle}</h3>
                        ${descHtml}
                        ${dueHtml}
                        <button class="homework-close">×</button>
                    </div>
                    <div class="homework-body">
                        ${!user ? `
                        <div class="homework-name-section">
                            <label class="homework-name-label">你的名字</label>
                            <input type="text" class="homework-name-input" id="homeworkUserName"
                                   placeholder="請輸入姓名以識別作品" autofocus required>
                        </div>` : `
                        <div class="homework-user-badge">
                            <span class="user-avatar">${user.name.charAt(0)}</span>
                            <span>${user.name}</span>
                            <button class="change-user-btn" id="changeUserBtn">切換</button>
                        </div>`}
                        ${contentHtml}
                    </div>
                    <div class="homework-footer">
                        <button class="homework-submit-btn" id="homeworkSubmitBtn">提交作業</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            let currentType = mode === 'image_only' ? 'image'
                : mode === 'image_prompt' ? 'image'
                    : mode === 'text_only' ? 'text'
                        : 'text';
            let uploadedData = null;

            // ── 切換使用者 ──
            const changeBtn = overlay.querySelector('#changeUserBtn');
            if (changeBtn) {
                changeBtn.addEventListener('click', () => {
                    sessionStorage.removeItem('homework_user');
                    overlay.remove();
                    this.showSubmitDialog(assignmentOrTitle, mode).then(resolve).catch(reject);
                });
            }

            // ── Tab 切換（僅全功能模式）──
            if (!mode) {
                overlay.querySelectorAll('.homework-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        overlay.querySelectorAll('.homework-tab').forEach(t => t.classList.remove('active'));
                        overlay.querySelectorAll('.homework-panel').forEach(p => p.classList.remove('active'));
                        tab.classList.add('active');
                        currentType = tab.dataset.type;
                        overlay.querySelector(`[data-panel="${currentType}"]`).classList.add('active');
                        uploadedData = null;
                    });
                });
            }

            // ── 檔案上傳 ──
            this.setupUploadArea(overlay, 'imageUploadArea', 'homeworkImageInput', 'imagePreview',
                (data) => { uploadedData = data; });
            if (!mode) {
                this.setupUploadArea(overlay, 'videoUploadArea', 'homeworkVideoInput', 'videoPreview',
                    (data) => { uploadedData = data; });
                this.setupUploadArea(overlay, 'audioUploadArea', 'homeworkAudioInput', 'audioPreview',
                    (data) => { uploadedData = data; });
            }

            // ── 關閉 ──
            overlay.querySelector('.homework-close').addEventListener('click', () => {
                overlay.remove();
                reject('Cancelled');
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) { overlay.remove(); reject('Cancelled'); }
            });

            // ── 提交 ──
            overlay.querySelector('#homeworkSubmitBtn').addEventListener('click', async () => {
                // 確認使用者身份
                let currentUser = this.getUser();
                const nameInput = overlay.querySelector('#homeworkUserName');
                if (!currentUser) {
                    if (!nameInput || !nameInput.value.trim()) {
                        nameInput?.focus();
                        nameInput?.classList.add('shake');
                        setTimeout(() => nameInput?.classList.remove('shake'), 500);
                        return;
                    }
                    currentUser = this.saveUser(nameInput.value.trim());
                }

                // 取得內容
                let content = null;
                let promptText = '';
                if (mode === 'image_only') {
                    if (!uploadedData) { showToast('請上傳圖片', { type: 'error' }); return; }
                    content = uploadedData;
                    currentType = 'image';
                } else if (mode === 'image_prompt') {
                    promptText = overlay.querySelector('#homeworkPromptText')?.value?.trim() || '';
                    if (!uploadedData) { showToast('請上傳圖片', { type: 'error' }); return; }
                    if (!promptText) { showToast('請輸入提示詞', { type: 'error' }); return; }
                    content = { image: uploadedData, prompt: promptText };
                    currentType = 'image';
                } else if (mode === 'text_only') {
                    content = overlay.querySelector('#homeworkText').value.trim();
                    if (!content) { showToast('請輸入內容', { type: 'error' }); return; }
                    currentType = 'text';
                } else {
                    // 全功能模式
                    switch (currentType) {
                        case 'text':
                            content = overlay.querySelector('#homeworkText').value.trim();
                            if (!content) { showToast('請輸入內容', { type: 'error' }); return; }
                            break;
                        case 'link':
                            content = overlay.querySelector('#homeworkLink').value.trim();
                            if (!content) { showToast('請輸入連結', { type: 'error' }); return; }
                            break;
                        case 'image':
                        case 'video':
                        case 'audio':
                            if (!uploadedData) { showToast('請上傳檔案', { type: 'error' }); return; }
                            content = uploadedData;
                            break;
                    }
                }

                // 顯示提交中狀態
                const submitBtn = overlay.querySelector('#homeworkSubmitBtn');
                submitBtn.disabled = true;
                submitBtn.textContent = '提交中...';

                const submission = await this.submit(assignmentTitle, currentType, content, currentUser, assignmentId);

                // ── 顯示提交後預覽 ──
                this._showPostSubmitPreview(overlay, submission, uploadedData, promptText, () => {
                    // 修改回調：重新開啟提交畫面
                    overlay.remove();
                    this.showSubmitDialog(assignmentOrTitle, submissionMode).then(resolve).catch(reject);
                }, () => {
                    // 完成回調
                    overlay.remove();
                    resolve(submission);
                });
            });
        });
    }

    /* ── 上傳相關 ── */

    setupUploadArea(overlay, areaId, inputId, previewId, onUpload) {
        const area = overlay.querySelector(`#${areaId}`);
        const input = overlay.querySelector(`#${inputId}`);
        const preview = overlay.querySelector(`#${previewId}`);
        if (!area || !input) return;

        area.addEventListener('click', () => {
            if (window.app) window.app._fileInputActive = true;
            input.click();
        });

        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('drag-over');
        });
        area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) this.processFile(file, area, preview, onUpload);
        });

        input.addEventListener('change', (e) => {
            if (window.app) window.app._fileInputActive = false;
            const file = e.target.files[0];
            if (file) this.processFile(file, area, preview, onUpload);
        });
        input.addEventListener('cancel', () => {
            if (window.app) window.app._fileInputActive = false;
        });

        // Ctrl+V 貼上圖片 / 貼上圖片 URL
        const handlePaste = (e) => {
            const items = e.clipboardData?.items;
            if (items) {
                for (const item of items) {
                    if (item.type.startsWith('image/')) {
                        e.preventDefault(); e.stopPropagation();
                        this.processFile(item.getAsFile(), area, preview, onUpload);
                        return;
                    }
                }
            }
            const text = e.clipboardData?.getData('text/plain')?.trim();
            if (text && /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(text)) {
                e.preventDefault(); e.stopPropagation();
                this._loadImageUrl(text, area, preview, onUpload);
            }
        };
        area.setAttribute('tabindex', '0');
        area.addEventListener('paste', handlePaste);
        overlay.addEventListener('paste', handlePaste);
    }

    processFile(file, area, preview, onUpload) {
        if (!file) return;
        // 大小限制
        if (file.size > 10 * 1024 * 1024) {
            showToast('檔案過大（上限 10MB）', { type: 'error' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const isImage = file.type.startsWith('image/');
            const needsCompress = isImage && (file.size > 2 * 1024 * 1024);

            if (isImage && needsCompress) {
                // 壓縮圖片
                const img = new Image();
                img.onload = () => {
                    const MAX = 1200;
                    let w = img.naturalWidth, h = img.naturalHeight;
                    if (w > MAX || h > MAX) {
                        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                        else { w = Math.round(w * MAX / h); h = MAX; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const data = {
                        name: file.name,
                        type: 'image/jpeg',
                        size: dataUrl.length,
                        data: dataUrl
                    };
                    onUpload(data);
                    this._showPreview(file, dataUrl, area, preview);
                };
                img.src = e.target.result;
            } else {
                const data = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: e.target.result
                };
                onUpload(data);
                this._showPreview(file, e.target.result, area, preview);
            }
        };
        reader.readAsDataURL(file);
        this._pendingFile = file;
    }

    _loadImageUrl(url, area, preview, onUpload) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const MAX = 1200;
            let w = img.naturalWidth, h = img.naturalHeight;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else { w = Math.round(w * MAX / h); h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const data = { name: 'pasted-image.jpg', type: 'image/jpeg', size: dataUrl.length, data: dataUrl };
            onUpload(data);
            area.style.display = 'none';
            preview.innerHTML = `<img src="${dataUrl}" alt="pasted" style="max-width:100%;max-height:240px;border-radius:12px;">`;
            preview.innerHTML += `<button class="change-file-btn" onclick="this.closest('.homework-panel').querySelector('.homework-upload-area').style.display='flex';this.closest('.homework-preview').innerHTML='';">更換檔案</button>`;
        };
        img.onerror = () => {
            // CORS 失敗，直接用 URL
            const data = { name: 'pasted-url.jpg', type: 'image/jpeg', size: 0, data: url };
            onUpload(data);
            area.style.display = 'none';
            preview.innerHTML = `<img src="${url}" alt="pasted" style="max-width:100%;max-height:240px;border-radius:12px;">`;
            preview.innerHTML += `<button class="change-file-btn" onclick="this.closest('.homework-panel').querySelector('.homework-upload-area').style.display='flex';this.closest('.homework-preview').innerHTML='';">更換檔案</button>`;
        };
        img.src = url;
    }

    _showPreview(file, dataUrl, area, preview) {
        area.style.display = 'none';
        preview.innerHTML = '';

        if (file.type.startsWith('image/')) {
            preview.innerHTML = `<img src="${dataUrl}" alt="${file.name}" style="max-width:100%;max-height:240px;border-radius:12px;">`;
        } else if (file.type.startsWith('video/')) {
            preview.innerHTML = `<video src="${dataUrl}" controls style="max-width:100%;max-height:240px;border-radius:12px;"></video>`;
        } else if (file.type.startsWith('audio/')) {
            preview.innerHTML = `
                <div class="audio-preview-item">
                    <span class="audio-icon">🎵</span>
                    <span>${file.name}</span>
                    <audio src="${dataUrl}" controls></audio>
                </div>`;
        }

        preview.innerHTML += `<button class="change-file-btn" onclick="this.closest('.homework-panel').querySelector('.homework-upload-area').style.display='flex';this.closest('.homework-preview').innerHTML='';">更換檔案</button>`;
    }

    /* ── 提交 ── */

    async submit(assignmentTitle, type, content, user, assignmentId = null) {
        let fileUrl = null;
        let fileKey = null;

        // 如果有檔案要上傳到 Supabase Storage
        if (this._pendingFile && (type === 'image' || type === 'video' || type === 'audio')) {
            try {
                const ext = this._pendingFile.name.split('.').pop();
                const key = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
                const { data, error } = await storage.upload('homework', key, this._pendingFile);
                if (!error && data) {
                    fileKey = data.key || key;
                    fileUrl = storage.getPublicUrl('homework', fileKey);
                }
            } catch (e) {
                console.warn('Storage upload failed, using DataURL fallback:', e);
            }
            this._pendingFile = null;
        }

        const submission = {
            id: 'sub_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            assignmentTitle,
            type,
            content: typeof content === 'object' ? JSON.stringify(content) : content,
            user: { name: user.name },
            submittedAt: new Date().toISOString(),
            fileUrl,
            fileKey,
            assignmentId
        };

        this.submissions.push(submission);
        this.saveSubmissions();

        // 寫入 Supabase DB（每次提交建立新記錄，保留版本歷史）
        try {
            const joinCode = new URLSearchParams(location.search).get('code')
                || new URLSearchParams(location.search).get('session')
                || '';
            const versionTs = Date.now();
            const row = {
                student_name: user.name,
                student_email: user.email || '',
                assignment_title: assignmentTitle,
                type,
                content: submission.content,
                file_url: fileUrl || '',
                file_key: fileKey || '',
                submitted_at: submission.submittedAt,
                session_id: joinCode || null,
                // 用 assignmentId__v{timestamp} 讓每次提交都是唯一記錄
                element_id: assignmentId ? `${assignmentId}__v${versionTs}` : `hw__v${versionTs}`,
                state: { version: versionTs, base_element_id: assignmentId || '' }
            };
            const result = await db.insert('submissions', row);
            if (result.error) {
                console.warn('[Homework] DB insert error:', result.error);
            } else {
                console.log('[Homework] ✅ saved to DB');
            }
        } catch (e) {
            console.warn('[Homework] DB insert failed:', e);
        }

        return submission;
    }

    /**
     * 提交後預覽畫面 — 替換 modal 內容
     */
    _showPostSubmitPreview(overlay, submission, uploadedData, promptText, onEdit, onDone) {
        const modal = overlay.querySelector('.homework-modal');
        if (!modal) { onDone(); return; }

        // 構建預覽 HTML
        let previewHtml = '';
        const sub = submission;
        const contentStr = typeof sub.content === 'string' ? sub.content : JSON.stringify(sub.content || '');

        if (sub.type === 'text') {
            const escaped = contentStr.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            previewHtml = `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;font-size:0.9rem;line-height:1.6;color:#1e293b;max-height:200px;overflow-y:auto;white-space:pre-wrap;">${escaped}</div>`;
        } else if (sub.type === 'image') {
            // 優先用 fileUrl，fallback 用 uploadedData
            let imgSrc = sub.fileUrl || '';
            if (!imgSrc && uploadedData?.data) imgSrc = uploadedData.data;
            if (!imgSrc) {
                try { const p = JSON.parse(contentStr); imgSrc = p.data || p.image?.data || ''; } catch { }
            }
            if (imgSrc) {
                previewHtml = `<div style="text-align:center;"><img src="${imgSrc}" style="max-width:100%;max-height:220px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.08);"></div>`;
            }
            if (promptText) {
                previewHtml += `<div style="margin-top:10px;padding:10px 14px;background:#f0f4ff;border-radius:8px;border:1px solid #c7d2fe;">
                    <div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:4px;">💬 Prompt</div>
                    <div style="font-size:0.85rem;color:#1e293b;white-space:pre-wrap;">${promptText.replace(/</g, '&lt;')}</div>
                </div>`;
            }
        } else if (sub.type === 'link') {
            previewHtml = `<div style="padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;"><span style="font-size:14px;">🔗</span> <a href="${contentStr}" target="_blank" style="color:#4A7AE8;word-break:break-all;">${contentStr}</a></div>`;
        } else if (sub.type === 'video' || sub.type === 'audio') {
            const src = sub.fileUrl || uploadedData?.data || '';
            if (sub.type === 'video' && src) {
                previewHtml = `<video src="${src}" controls style="max-width:100%;max-height:200px;border-radius:10px;"></video>`;
            } else if (sub.type === 'audio' && src) {
                previewHtml = `<div style="text-align:center;padding:20px;"><span style="font-size:2rem;">🎵</span><br><audio src="${src}" controls style="margin-top:10px;width:100%;"></audio></div>`;
            }
        }

        if (!previewHtml) {
            previewHtml = `<div style="text-align:center;color:#64748b;padding:20px;">已提交</div>`;
        }

        // 替換 modal body + footer
        const body = modal.querySelector('.homework-body');
        const footer = modal.querySelector('.homework-footer');
        const header = modal.querySelector('.homework-header h3');
        if (header) header.textContent = '✅ 提交成功！';

        if (body) {
            body.innerHTML = `
                <div style="text-align:center;margin-bottom:16px;">
                    <div style="font-size:2.5rem;margin-bottom:6px;">🎉</div>
                    <div style="font-size:0.95rem;font-weight:600;color:#059669;">你的作業已成功提交</div>
                    <div style="font-size:0.8rem;color:#94a3b8;margin-top:4px;">提交時間：${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style="margin-bottom:12px;">
                    <div style="font-size:0.8rem;font-weight:600;color:#64748b;margin-bottom:6px;">📋 提交內容預覽</div>
                    ${previewHtml}
                </div>
            `;
        }

        if (footer) {
            footer.innerHTML = `
                <button id="hwEditBtn" style="padding:8px 18px;border:1px solid #d1d5db;border-radius:8px;background:white;color:#374151;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">✏️ 修改作業</button>
                <button id="hwDoneBtn" style="padding:8px 24px;border:none;border-radius:8px;background:#059669;color:white;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">完成</button>
            `;
            footer.querySelector('#hwEditBtn').addEventListener('click', onEdit);
            footer.querySelector('#hwDoneBtn').addEventListener('click', onDone);
        }
    }

    showSuccessToast() {
        const toast = document.createElement('div');
        toast.className = 'homework-toast success';
        toast.innerHTML = '✅ 作業提交成功！';
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /* ── 查詢 ── */

    getAllSubmissions() { return this.submissions; }
    getSubmissionsByUser(name) { return this.submissions.filter(s => s.user.name === name); }
    getSubmissionsByAssignment(title) { return this.submissions.filter(s => s.assignmentTitle === title); }

    deleteSubmission(id) {
        const index = this.submissions.findIndex(s => s.id === id);
        if (index > -1) {
            this.submissions.splice(index, 1);
            this.saveSubmissions();
            return true;
        }
        return false;
    }
}
