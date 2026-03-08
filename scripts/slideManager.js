/**
 * 投影片管理模組
 * 負責投影片的新增、刪除、切換與縮略圖渲染
 */

export class SlideManager {
    constructor() {
        SlideManager._instance = this;
        this.slides = [];
        this.sections = []; // [{ name, startIndex }]
        this.currentIndex = 0;
        this.slideListEl = document.getElementById('slideList');

        // Undo / Redo（最多 15 步）
        this._undoStack = [];
        this._redoStack = [];
        this._isUndoRedo = false;
        this._maxHistory = 15;
        this.canvasContentEl = document.getElementById('canvasContent');
        this.currentSlideEl = document.getElementById('currentSlide');
        this.totalSlidesEl = document.getElementById('totalSlides');

        // 多選投影片
        this.selectedSlideIndices = new Set();
        this._lastClickedIndex = -1;

        // 鍵盤刪除多選投影片
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedSlideIndices.size > 0) {
                // 確保不是正在編輯文字
                const tag = document.activeElement?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
                // 如果編輯器有選取中的元素，則不刪除投影片（應刪除元素）
                if (window.__editorRef?.selectedElement) return;
                e.preventDefault();
                this.deleteSelectedSlides();
            }

            // Undo: Ctrl+Z / Cmd+Z
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
                const tag = document.activeElement?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
                e.preventDefault();
                this.undo();
            }
            // Redo: Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y / Cmd+Y
            if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
                const tag = document.activeElement?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
                e.preventDefault();
                this.redo();
            }
        });

        // 專案管理 — DB 為 source of truth，內存快取
        this.currentProjectId = localStorage.getItem('current_project_id') || null;
        this._projectsCache = [];
        this._dbReady = false;
        this._saveTimer = null;
        this._initPromise = this._initFromDB();
    }

    /* ========================================
       專案管理 (Multi-Project) — DB-First
       ======================================== */

    /**
     * 非同步初始化：從 DB 載入專案清單，遷移 localStorage 舊資料
     */
    async _initFromDB() {
        try {
            const { db } = await import('./supabase.js');
            this._db = db;

            // 並行載入專案 + 場次（省掉串行等待）
            const [raw, rawSessions] = await Promise.all([
                db.select('projects', { order: 'created_at.asc' }),
                db.select('project_sessions', { order: 'created_at.asc' }).catch(e => {
                    console.warn('Failed to load sessions:', e);
                    return { data: [] };
                })
            ]);

            const dbProjects = raw?.data || (Array.isArray(raw) ? raw : []);
            this._projectsCache = dbProjects.map(p => ({
                id: p.id,
                name: p.name,
                joinCode: p.join_code,
                courseLink: p.course_link || '',
                instructor: p.instructor || '',
                organization: p.organization || '',
                organizationId: p.organization_id || null,
                courseId: p.course_id || '',
                purchaseLink: p.purchase_link || '',
                currentPhase: p.current_phase || 'pre-class',
                sessions: [],
                createdAt: p.created_at,
                updatedAt: p.updated_at
            }));

            // 將場次掛到對應專案
            const allSessions = rawSessions?.data || (Array.isArray(rawSessions) ? rawSessions : []);
            for (const s of allSessions) {
                const proj = this._projectsCache.find(p => p.id === s.project_id);
                if (proj) {
                    proj.sessions.push({
                        id: s.id,
                        projectId: s.project_id,
                        sessionCode: s.session_code,
                        joinCode: s.join_code,
                        date: s.date,
                        time: s.time,
                        venue: s.venue,
                        venueAddress: s.venue_address || '',
                        status: s.status,
                        currentPhase: s.current_phase || 'pre-class',
                        preSurveyEnabled: s.pre_survey_enabled || false,
                        preClassNotes: s.pre_class_notes || '',
                        postEmailTemplate: s.post_email_template || {},
                        studentPortalUrl: s.student_portal_url || '',
                        maxCapacity: s.max_capacity || 0
                    });
                }
            }

            // 遷移 localStorage 舊資料（僅首次）
            if (!localStorage.getItem('_db_migrated')) {
                await this._migrateLocalStorage();
                localStorage.setItem('_db_migrated', '1');
            }

            // 確認 currentProjectId 存在
            if (this._projectsCache.length === 0) {
                const proj = await SlideManager.createProject('AI 職場應用');
                this._projectsCache.push(proj);
                this.currentProjectId = proj.id;
            } else if (!this.currentProjectId || !this._projectsCache.find(p => p.id === this.currentProjectId)) {
                this.currentProjectId = this._projectsCache[0].id;
            }
            localStorage.setItem('current_project_id', this.currentProjectId);
            this._dbReady = true;

            // 啟動自動存檔（每 10 秒）
            this.startAutoSave();

        } catch (e) {
            console.warn('DB init failed, falling back to localStorage:', e);
            // Fallback: 用舊的 localStorage 方式
            this._projectsCache = this._getLocalProjects();
            if (this._projectsCache.length === 0) {
                const proj = this._createLocalProject('AI 職場應用');
                this._projectsCache.push(proj);
                this.currentProjectId = proj.id;
            } else if (!this.currentProjectId || !this._projectsCache.find(p => p.id === this.currentProjectId)) {
                this.currentProjectId = this._projectsCache[0].id;
            }
            localStorage.setItem('current_project_id', this.currentProjectId);
        }
    }

    /**
     * 遷移 localStorage → DB
     */
    async _migrateLocalStorage() {
        // 遷移舊的 projects_index 裡有但 DB 沒有的專案
        const localProjects = this._getLocalProjects();
        for (const lp of localProjects) {
            const existsInDB = this._projectsCache.find(p => p.joinCode === lp.joinCode);
            if (existsInDB) {
                // 遷移投影片資料
                const localSlides = localStorage.getItem(`project_${lp.id}`);
                if (localSlides && existsInDB) {
                    try {
                        const parsed = JSON.parse(localSlides);
                        // 只在 DB 沒有資料時才遷移
                        const { data: dbRow } = await this._db.select('projects', {
                            filter: { id: `eq.${existsInDB.id}` },
                            select: 'slides_data'
                        });
                        if (dbRow?.[0] && (!dbRow[0].slides_data || Object.keys(dbRow[0].slides_data).length === 0)) {
                            await this._db.update('projects', {
                                slides_data: parsed
                            }, { id: `eq.${existsInDB.id}` });
                        }
                    } catch (e) { console.warn('Migration: slides_data sync skipped:', e.message); }
                }
            } else {
                // DB 沒有這個專案 → 新建並遷移
                try {
                    const result = await this._db.insert('projects', {
                        name: lp.name,
                        join_code: lp.joinCode || SlideManager._generateJoinCode(),
                        current_phase: lp.currentPhase || 'pre-class'
                    });
                    if (result?.[0]) {
                        const newProj = {
                            id: result[0].id,
                            name: result[0].name,
                            joinCode: result[0].join_code,
                            currentPhase: result[0].current_phase,
                            createdAt: result[0].created_at,
                            updatedAt: result[0].updated_at
                        };
                        this._projectsCache.push(newProj);
                        // 遷移投影片資料
                        const localSlides = localStorage.getItem(`project_${lp.id}`);
                        if (localSlides) {
                            await this._db.update('projects', { slides_data: JSON.parse(localSlides) }, { id: `eq.${newProj.id}` });
                        }
                        // 映射舊 ID → 新 ID
                        if (this.currentProjectId === lp.id) {
                            this.currentProjectId = newProj.id;
                        }
                    }
                } catch (e) {
                    console.warn('Migration failed for project:', lp.name, e);
                }
            }
        }
        // 遷移舊的 presentation_data
        const oldData = localStorage.getItem('presentation_data');
        if (oldData) {
            const firstProj = this._projectsCache[0];
            if (firstProj) {
                try {
                    await this._db.update('projects', { slides_data: JSON.parse(oldData) }, { id: `eq.${firstProj.id}` });
                } catch (e) { console.warn('Migration: old presentation_data sync failed:', e.message); }
            }
            localStorage.removeItem('presentation_data');
        }

        // ── 遷移完成，清除 localStorage 舊資料 ──
        try {
            const localProjects = this._getLocalProjects();
            for (const lp of localProjects) {
                localStorage.removeItem(`project_${lp.id}`);
            }
            localStorage.removeItem('projects_index');
            // localStorage legacy data cleared
        } catch (e) {
            console.warn('localStorage cleanup failed:', e);
        }
    }

    _getLocalProjects() {
        try {
            return JSON.parse(localStorage.getItem('projects_index') || '[]');
        } catch { return []; }
    }

    _createLocalProject(name) {
        const joinCode = SlideManager._generateJoinCode();
        return {
            id: 'proj_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            name,
            joinCode,
            currentPhase: 'pre-class',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * getProjects() — 同步，回傳快取
     */
    static getProjects() {
        return SlideManager._instance?._projectsCache || [];
    }

    static _saveProjectsIndex(projects) {
        if (SlideManager._instance) {
            SlideManager._instance._projectsCache = projects;
        }
    }

    /**
     * 建立新專案 (async, DB-first)
     * @param {object} data - { name, courseLink, instructor, organization }
     */
    static async createProject(data) {
        const { name, courseLink = '', instructor = '', organization = '', organizationId = null } = typeof data === 'string' ? { name: data } : data;
        const inst = SlideManager._instance;

        try {
            const { db } = await import('./supabase.js');
            const insertPayload = {
                name,
                join_code: SlideManager._generateJoinCode(), // legacy compat
                current_phase: 'pre-class',
                course_link: courseLink,
                instructor,
                organization
            };
            if (organizationId) insertPayload.organization_id = organizationId;
            const result = await db.insert('projects', insertPayload);
            if (result?.[0]) {
                const proj = {
                    id: result[0].id,
                    name: result[0].name,
                    joinCode: result[0].join_code,
                    currentPhase: result[0].current_phase,
                    courseLink: result[0].course_link || '',
                    instructor: result[0].instructor || '',
                    organization: result[0].organization || '',
                    sessions: [],
                    createdAt: result[0].created_at,
                    updatedAt: result[0].updated_at
                };
                if (inst) inst._projectsCache.push(proj);
                return proj;
            }
        } catch (e) {
            console.warn('DB createProject failed:', e);
        }

        // Fallback: 本地建立
        const proj = {
            id: 'proj_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            name,
            joinCode: SlideManager._generateJoinCode(),
            courseLink,
            instructor,
            organization,
            sessions: [],
            currentPhase: 'pre-class',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (inst) inst._projectsCache.push(proj);
        return proj;
    }

    /**
     * 建立新場次 (async, DB-first)
     * @param {string} projectId
     * @param {object} data - { date, time, venue }
     * @returns {Promise<object>} session object
     */
    static async createSession(projectId, data) {
        const { date = '', time = '09:30 — 16:30', venue = '' } = data;
        // session_code = YYYYMMDD from date input
        const sessionCode = date.replace(/[\/-\s]/g, '') || `S${Date.now().toString(36)}`;
        const inst = SlideManager._instance;

        try {
            const { db } = await import('./supabase.js');
            const result = await db.insert('project_sessions', {
                project_id: projectId,
                session_code: sessionCode,
                date,
                time,
                venue,
                status: 'active',
                current_phase: 'pre-class'
            });
            if (result?.[0]) {
                const session = {
                    id: result[0].id,
                    projectId: result[0].project_id,
                    sessionCode: result[0].session_code,
                    date: result[0].date,
                    time: result[0].time,
                    venue: result[0].venue,
                    status: result[0].status,
                    currentPhase: result[0].current_phase || 'pre-class'
                };
                if (inst) {
                    const proj = inst._projectsCache.find(p => p.id === projectId);
                    if (proj) {
                        if (!proj.sessions) proj.sessions = [];
                        proj.sessions.push(session);
                    }
                }
                return session;
            }
        } catch (e) {
            console.warn('DB createSession failed:', e);
        }

        // Fallback
        const session = {
            id: 'sess_' + Date.now().toString(36),
            projectId,
            sessionCode,
            date,
            time,
            venue,
            status: 'active',
            currentPhase: 'pre-class'
        };
        if (inst) {
            const proj = inst._projectsCache.find(p => p.id === projectId);
            if (proj) {
                if (!proj.sessions) proj.sessions = [];
                proj.sessions.push(session);
            }
        }
        return session;
    }

    /**
     * 更新場次資料
     */
    static async updateSession(sessionId, data) {
        const inst = SlideManager._instance;
        try {
            const { db } = await import('./supabase.js');
            const updates = {};
            if (data.date !== undefined) updates.date = data.date;
            if (data.time !== undefined) updates.time = data.time;
            if (data.venue !== undefined) updates.venue = data.venue;
            if (data.currentPhase !== undefined) updates.current_phase = data.currentPhase;
            if (data.venueAddress !== undefined) updates.venue_address = data.venueAddress;
            if (data.preSurveyEnabled !== undefined) updates.pre_survey_enabled = data.preSurveyEnabled;
            if (data.preClassNotes !== undefined) updates.pre_class_notes = data.preClassNotes;
            if (data.postEmailTemplate !== undefined) updates.post_email_template = data.postEmailTemplate;
            if (data.studentPortalUrl !== undefined) updates.student_portal_url = data.studentPortalUrl;
            if (data.maxCapacity !== undefined) updates.max_capacity = data.maxCapacity;
            await db.update('project_sessions', updates, { id: `eq.${sessionId}` });
            // Update cache
            if (inst) {
                for (const proj of inst._projectsCache) {
                    const s = (proj.sessions || []).find(s => s.id === sessionId);
                    if (s) {
                        Object.assign(s, data);
                        break;
                    }
                }
            }
            return true;
        } catch (e) {
            console.warn('DB updateSession failed:', e);
            return false;
        }
    }

    /**
     * 取得專案的所有場次
     */
    static async getSessionsByProject(projectId) {
        try {
            const { db } = await import('./supabase.js');
            const { data } = await db.select('project_sessions', {
                filter: { project_id: `eq.${projectId}` },
                order: 'created_at.asc'
            });
            return (data || []).map(s => ({
                id: s.id,
                projectId: s.project_id,
                sessionCode: s.session_code,
                joinCode: s.join_code,
                date: s.date,
                time: s.time,
                venue: s.venue,
                status: s.status,
                currentPhase: s.current_phase || 'pre-class'
            }));
        } catch (e) {
            console.warn('getSessionsByProject failed:', e);
            return [];
        }
    }

    static _generateJoinCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    static async updateProjectPhase(joinCode, phase) {
        try {
            const { db } = await import('./supabase.js');
            await db.update('projects', { current_phase: phase }, { join_code: `eq.${joinCode}` });
            // 更新快取
            const inst = SlideManager._instance;
            if (inst) {
                const p = inst._projectsCache.find(p => p.joinCode === joinCode);
                if (p) p.currentPhase = phase;
            }
        } catch (e) {
            console.warn('Phase update failed:', e);
        }
    }

    /**
     * 更新專案資料（通用）
     */
    static async updateProject(projectId, data) {
        const inst = SlideManager._instance;
        try {
            const { db } = await import('./supabase.js');
            const updates = { updated_at: new Date().toISOString() };
            if (data.name !== undefined) updates.name = data.name;
            if (data.courseId !== undefined) updates.course_id = data.courseId;
            if (data.purchaseLink !== undefined) updates.purchase_link = data.purchaseLink;
            if (data.organizationId !== undefined) updates.organization_id = data.organizationId;
            if (data.courseLink !== undefined) updates.course_link = data.courseLink;
            if (data.instructor !== undefined) updates.instructor = data.instructor;
            if (data.organization !== undefined) updates.organization = data.organization;
            if (data.description !== undefined) updates.description = data.description;
            await db.update('projects', updates, { id: `eq.${projectId}` });
            // Update cache
            if (inst) {
                const p = inst._projectsCache.find(p => p.id === projectId);
                if (p) Object.assign(p, data);
            }
            return true;
        } catch (e) {
            console.warn('DB updateProject failed:', e);
            return false;
        }
    }

    static async deleteProject(id) {
        const inst = SlideManager._instance;

        try {
            const { db } = await import('./supabase.js');
            await db.delete('projects', { id: `eq.${id}` });
        } catch (e) {
            console.warn('DB deleteProject failed:', e);
        }

        // 更新快取
        if (inst) {
            inst._projectsCache = inst._projectsCache.filter(p => p.id !== id);
        }
        localStorage.removeItem(`project_${id}`);
    }

    static async renameProject(id, newName) {
        const inst = SlideManager._instance;

        try {
            const { db } = await import('./supabase.js');
            await db.update('projects', {
                name: newName,
                updated_at: new Date().toISOString()
            }, { id: `eq.${id}` });
        } catch (e) {
            console.warn('DB renameProject failed:', e);
        }

        // 更新快取
        if (inst) {
            const p = inst._projectsCache.find(p => p.id === id);
            if (p) {
                p.name = newName;
                p.updatedAt = new Date().toISOString();
            }
        }
    }

    getCurrentProjectName() {
        const p = this._projectsCache.find(p => p.id === this.currentProjectId);
        return p ? p.name : '未命名專案';
    }

    getCurrentJoinCode() {
        const p = this._projectsCache.find(p => p.id === this.currentProjectId);
        if (!p) return null;
        return p.joinCode;
    }

    async switchProject(id) {
        this.currentProjectId = id;
        localStorage.setItem('current_project_id', id);
        await this.load();
    }

    /**
     * 建立新投影片
     */
    createSlide(insertAfterCurrent = false, blank = false) {
        const gen = () => this.generateId();
        const slide = {
            id: gen(),
            elements: blank ? [] : [
                // 左側裝飾線
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 60, width: 4, height: 60, background: '#4A7AE8' },
                // 標題文字
                { id: gen(), type: 'text', x: 80, y: 55, width: 800, height: 60, content: '<b style="font-size:36px;color:#1a1a2e;letter-spacing:0.5px;">標題文字</b>', fontSize: 36, bold: true },
                // 副標題/內容文字
                { id: gen(), type: 'text', x: 80, y: 130, width: 800, height: 40, content: '<span style="font-size:18px;color:#6c7a8d;">在此輸入內容描述</span>', fontSize: 18, color: '#6c7a8d' },
                // 底部分隔線
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 490, width: 840, height: 2, background: '#e8ecf1' },
            ],
            background: '#ffffff'
        };

        if (insertAfterCurrent && this.slides.length > 0) {
            this.slides.splice(this.currentIndex + 1, 0, slide);
            this._adjustSectionIndices(this.currentIndex + 1, 1);
            this.navigateTo(this.currentIndex + 1);
        } else {
            this.slides.push(slide);
            this.navigateTo(this.slides.length - 1);
        }

        this.renderThumbnails();
        this.updateCounter();
        this.saveNow();

        return slide;
    }

    /**
     * 刪除投影片
     */
    deleteSlide(index) {
        if (this.slides.length <= 1) {
            console.warn('至少需要保留一張投影片');
            return false;
        }

        this.slides.splice(index, 1);
        this._adjustSectionIndices(index, -1);

        // 調整當前索引
        if (this.currentIndex >= this.slides.length) {
            this.currentIndex = this.slides.length - 1;
        }

        this.renderThumbnails();
        this.renderCurrentSlide();
        this.updateCounter();
        this.saveNow();

        return true;
    }

    /**
     * 複製投影片
     */
    duplicateSlide(index) {
        const sourceSlide = this.slides[index];
        const newSlide = {
            id: this.generateId(),
            elements: JSON.parse(JSON.stringify(sourceSlide.elements)),
            background: sourceSlide.background
        };

        // 為複製的元素生成新 ID
        newSlide.elements.forEach(el => {
            el.id = this.generateId();
        });

        this.slides.splice(index + 1, 0, newSlide);
        this.navigateTo(index + 1);
        this.renderThumbnails();
        this.updateCounter();
        this.saveNow();

        return newSlide;
    }

    /**
     * 切換到指定投影片
     */
    navigateTo(index) {
        if (index < 0 || index >= this.slides.length) return;

        // 儲存當前投影片狀態（debounced 寫 DB，避免快速切頁造成寫入風暴）
        this.saveCurrentSlide();
        this.save();

        this.currentIndex = index;
        this.renderCurrentSlide();

        // ★ 輕量更新：只切換 active class，不重建全部縮略圖
        const thumbs = this.slideListEl.querySelectorAll('.slide-thumbnail');
        thumbs.forEach((t, i) => {
            t.classList.toggle('active', i === index);
        });
        // 滾動到可視範圍
        if (thumbs[index]) {
            thumbs[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        this.updateCounter();
    }

    /**
     * 上一張
     */
    prev() {
        if (this.currentIndex > 0) {
            this.navigateTo(this.currentIndex - 1);
        }
    }

    /**
     * 下一張
     */
    next() {
        if (this.currentIndex < this.slides.length - 1) {
            this.navigateTo(this.currentIndex + 1);
        }
    }

    /**
     * 取得當前投影片
     */
    getCurrentSlide() {
        return this.slides[this.currentIndex];
    }

    /**
     * 新增元素到當前投影片
     */
    addElement(element) {
        const slide = this.getCurrentSlide();
        if (!slide) return;

        element.id = element.id || this.generateId();
        slide.elements.push(element);
        this.renderCurrentSlide();
        this.renderThumbnails();
        this.saveNow(); // 立即寫 DB

        return element;
    }

    /**
     * 更新元素
     */
    updateElement(elementId, updates) {
        const slide = this.getCurrentSlide();
        if (!slide) return;

        const element = slide.elements.find(el => el.id === elementId);
        if (element) {
            Object.assign(element, updates);
            this.save();
        }

        return element;
    }

    /**
     * 刪除元素
     */
    deleteElement(elementId) {
        const slide = this.getCurrentSlide();
        if (!slide) return;

        const index = slide.elements.findIndex(el => el.id === elementId);
        if (index > -1) {
            slide.elements.splice(index, 1);
            this.renderCurrentSlide();
            this.renderThumbnails();
            this.saveNow();
        }
    }

    /**
     * 批次刪除多個元素（只重新渲染一次）
     */
    deleteElementsBatch(ids) {
        const slide = this.getCurrentSlide();
        if (!slide) return;
        let changed = false;
        ids.forEach(id => {
            const index = slide.elements.findIndex(el => el.id === id);
            if (index > -1) {
                slide.elements.splice(index, 1);
                changed = true;
            }
        });
        if (changed) {
            this.renderCurrentSlide();
            this.renderThumbnails();
            this.saveNow();
        }
    }

    /**
     * 調整元素圖層順序
     */
    moveElementLayer(elementId, direction) {
        const slide = this.getCurrentSlide();
        if (!slide) return;

        const index = slide.elements.findIndex(el => el.id === elementId);
        if (index === -1) return;

        const newIndex = direction === 'up'
            ? Math.min(index + 1, slide.elements.length - 1)
            : Math.max(index - 1, 0);

        if (newIndex !== index) {
            const element = slide.elements.splice(index, 1)[0];
            slide.elements.splice(newIndex, 0, element);
            this.renderCurrentSlide();
            this.save();
        }
    }

    /**
     * 儲存當前投影片狀態
     */
    saveCurrentSlide() {
        // 從 DOM 讀取元素狀態更新到資料
        const slide = this.getCurrentSlide();
        if (!slide) return;

        const elementNodes = this.canvasContentEl.querySelectorAll('.editable-element');
        elementNodes.forEach(node => {
            const elementId = node.dataset.id;
            const element = slide.elements.find(el => el.id === elementId);
            if (element) {
                element.x = parseInt(node.style.left) || 0;
                element.y = parseInt(node.style.top) || 0;
                element.width = node.offsetWidth;
                element.height = node.offsetHeight;

                // 文字內容
                if (element.type === 'text') {
                    element.content = node.innerHTML;
                }
                // 複製卡片內容
                if (element.type === 'copyCard') {
                    const titleEl = node.querySelector('.copy-card-title');
                    const contentEl = node.querySelector('.copy-card-content');
                    if (titleEl) element.title = titleEl.textContent;
                    if (contentEl) element.content = contentEl.textContent;
                }
            }
        });
    }

    /**
     * 渲染當前投影片
     */
    renderCurrentSlide() {
        // ★ Re-entrancy guard—避免過度遞迴導致 Chrome crash
        if (this._isRendering) return;
        this._isRendering = true;

        // ★ Rate limiter—每秒最多 50 次
        const now = Date.now();
        if (!this._renderWindow) this._renderWindow = { start: now, count: 0 };
        if (now - this._renderWindow.start > 1000) {
            this._renderWindow = { start: now, count: 0 };
        }
        this._renderWindow.count++;
        if (this._renderWindow.count > 50) {
            console.warn('[SlideManager] renderCurrentSlide rate limit exceeded:', this._renderWindow.count);
            this._isRendering = false;
            return;
        }

        try {
            const slide = this.getCurrentSlide();
            if (!slide) return;

            // 套用背景
            const canvas = document.getElementById('slideCanvas');
            if (slide.background && slide.background !== '#ffffff') {
                canvas.style.background = slide.background;
            } else {
                canvas.style.background = 'white';
            }

            // 清空畫布
            this.canvasContentEl.innerHTML = '';

            if (slide.elements.length === 0) {
                this.canvasContentEl.innerHTML = '<p class="placeholder-text">點擊上方工具列新增內容</p>';
                return;
            }

            // 渲染每個元素
            slide.elements.forEach(element => {
                const el = this.createElementNode(element);
                if (el) {
                    this.canvasContentEl.appendChild(el);
                }
            });

            // 過場動畫
            const transType = slide.transition || 'fade';
            ['slide-transition-fade', 'slide-transition-slide-left', 'slide-transition-zoom'].forEach(c =>
                this.canvasContentEl.classList.remove(c)
            );
            void this.canvasContentEl.offsetWidth; // force reflow
            this.canvasContentEl.classList.add(`slide-transition-${transType}`);

            // 觸發自訂事件
            window.dispatchEvent(new CustomEvent('slideRendered', { detail: slide }));
        } finally {
            this._isRendering = false;
        }
    }

    /**
     * 建立元素 DOM 節點
     */
    createElementNode(element) {
        const el = document.createElement('div');
        el.className = `editable-element ${element.type}-element`;
        el.dataset.id = element.id;
        el.dataset.type = element.type;

        el.style.left = `${element.x}px`;
        el.style.top = `${element.y}px`;
        el.style.width = `${element.width}px`;
        el.style.height = `${element.height}px`;

        switch (element.type) {
            case 'text':
                el.innerHTML = element.content || '雙擊編輯文字';
                el.style.fontSize = `${element.fontSize || 18}px`;
                el.style.color = element.color || '#2d3748';
                el.style.fontWeight = element.bold ? 'bold' : 'normal';
                el.style.fontStyle = element.italic ? 'italic' : 'normal';
                el.style.textDecoration = element.underline ? 'underline' : 'none';
                if (element.textAlign) el.style.textAlign = element.textAlign;
                if (element.fontFamily) el.style.fontFamily = element.fontFamily;
                break;

            case 'shape':
                el.classList.add(element.shapeType);
                el.style.background = element.background || '';
                if (element.borderRadius) el.style.borderRadius = `${element.borderRadius}px`;
                if (element.opacity !== undefined) el.style.opacity = element.opacity;
                break;

            case 'chart':
                el.classList.add('chart-element');
                this.renderChartElement(el, element);
                break;

            case 'image': {
                const clipStyle = element.clipPath ? `clip-path:${element.clipPath};` : '';
                const src = element.src || '';
                // SVG data URI → inline 渲染（動畫重播 + 連結可點擊）
                if (src.startsWith('data:image/svg+xml;base64,')) {
                    try {
                        const svgStr = decodeURIComponent(escape(atob(src.split(',')[1])));
                        el.innerHTML = `<div style="${clipStyle}width:100%;height:100%;overflow:hidden;">${svgStr}</div>`;
                        const svgEl = el.querySelector('svg');
                        if (svgEl) {
                            svgEl.setAttribute('width', '100%');
                            svgEl.setAttribute('height', '100%');
                            svgEl.style.display = 'block';
                        }
                    } catch (_) {
                        el.innerHTML = `<img src="${src}" draggable="false" alt="" style="${clipStyle}width:100%;height:100%;object-fit:cover;">`;
                    }
                } else {
                    el.innerHTML = `<img src="${src}" draggable="false" alt="" style="${clipStyle}width:100%;height:100%;object-fit:cover;">`;
                }
                break;
            }

            case 'video':
                if (element.embedUrl) {
                    el.innerHTML = `<iframe src="${element.embedUrl}" allowfullscreen></iframe>`;
                } else if (element.src) {
                    el.innerHTML = `<video src="${element.src}" controls></video>`;
                } else {
                    el.innerHTML = `
                        <div class="video-placeholder">
                            <span class="icon">▶</span>
                            <span>點擊設定影片</span>
                        </div>
                    `;
                }
                break;

            case 'audio':
                el.innerHTML = `
                    <div class="audio-icon">♪</div>
                    <audio src="${element.src}" controls></audio>
                `;
                break;

            case 'link': {
                el.classList.add('link-element');
                const url = element.linkUrl || '#';
                const label = element.linkLabel || '開啟連結';
                const desc = element.linkDesc || '';
                const lColor = element.linkColor || '#6366f1';
                const lIcon = element.linkIcon || 'open_in_new';
                const lImage = element.linkImage || '';

                if (lImage) {
                    // 圖片卡片模式
                    el.innerHTML = `
                        <div class="link-card link-card--image" data-url="${url.replace(/"/g, '&quot;')}" style="--link-color:${lColor};flex-direction:column;padding:0;overflow:hidden;">
                            <div style="position:relative;width:100%;padding-top:56.25%;overflow:hidden;">
                                <img src="${lImage}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
                                <div style="position:absolute;top:8px;left:8px;width:28px;height:28px;border-radius:8px;background:${lColor};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);">
                                    <span class="material-symbols-outlined" style="font-size:16px;color:white;">${lIcon}</span>
                                </div>
                            </div>
                            <div style="padding:10px 14px;">
                                <div class="link-card-label">${label}</div>
                                ${desc ? `<div class="link-card-desc">${desc}</div>` : ''}
                                <div class="link-card-url" style="margin-top:4px;">${url}</div>
                            </div>
                        </div>
                    `;
                } else {
                    // 原始橫向模式
                    el.innerHTML = `
                        <div class="link-card" data-url="${url.replace(/"/g, '&quot;')}" style="--link-color:${lColor};">
                            <div class="link-card-icon" style="background:${lColor};">
                                <span class="material-symbols-outlined">${lIcon}</span>
                            </div>
                            <div class="link-card-body">
                                <div class="link-card-label">${label}</div>
                                ${desc ? `<div class="link-card-desc">${desc}</div>` : ''}
                                <div class="link-card-url">${url}</div>
                            </div>
                            <div class="link-card-arrow" style="color:${lColor};">
                                <span class="material-symbols-outlined">arrow_forward</span>
                            </div>
                        </div>
                    `;
                }
                // 簡報模式才可點擊
                const card = el.querySelector('.link-card');
                if (card) {
                    card.addEventListener('click', (e) => {
                        if (el.closest('.presentation-slide') || el.closest('.aud-interaction-wrap')) {
                            e.stopPropagation();
                            window.open(url, '_blank');
                        }
                    });
                }
                break;
            }
            case 'leaderboard': {
                el.classList.add('leaderboard-element');
                el.style.overflow = 'hidden';
                const title = element.lbTitle || '🏆 排行榜';
                // 判斷是否在廣播模式（不用 closest，因為此時元素尚未插入 DOM）
                const hasSession = !!window.app?.sessionCode;
                const placeholder = [
                    { name: '冠軍同學', totalPoints: 850 },
                    { name: '亞軍同學', totalPoints: 720 },
                    { name: '季軍同學', totalPoints: 680 },
                    { name: '同學 D', totalPoints: 550 },
                    { name: '同學 E', totalPoints: 420 },
                ];
                this._renderLeaderboardContent(el, title, hasSession ? [] : placeholder);

                if (hasSession) {
                    const sessionCode = window.app.sessionCode;
                    const projectId = this.currentProjectId || null;
                    const self = this;

                    // 立即載入 + 5 秒輪詢
                    const fetchAndRender = () => {
                        import('./interactive/stateManager.js').then(({ stateManager }) => {
                            stateManager.getLeaderboard(sessionCode, projectId).then(data => {
                                if (data.length > 0) self._renderLeaderboardContent(el, title, data);
                            });
                        });
                    };

                    fetchAndRender();
                    const lbTimer = setInterval(fetchAndRender, 5000);

                    // 清理：當元素被移除時停止輪詢
                    const observer = new MutationObserver(() => {
                        if (!document.contains(el)) {
                            clearInterval(lbTimer);
                            observer.disconnect();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }
                break;
            }

            case 'survey': {
                el.classList.add('survey-element');
                el.style.overflow = 'hidden';
                const isLive = el.closest('.presentation-slide') || el.closest('.aud-interaction-wrap');
                if (isLive) {
                    import('./interactive/survey.js').then(({ SurveyGame }) => {
                        new SurveyGame().render(el, element);
                    });
                } else {
                    import('./interactive/survey.js').then(({ SurveyGame }) => {
                        new SurveyGame().renderPreview(el, element);
                    });
                }
                break;
            }

            case 'matching':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderMatchingElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'fillblank':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderFillBlankElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'ordering':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderOrderingElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'document':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderDocumentElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'copycard':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderCopyCardElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'quiz':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderQuizElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'poll':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderPollElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'truefalse':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderTrueFalseElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'opentext':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderOpenTextElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'scale':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderScaleElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'buzzer':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderBuzzerElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'wordcloud':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderWordCloudElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'hotspot':
                el.classList.add('interactive-element');
                this._applyInteractiveStyles(el, element);
                this.renderHotspotElement(el, element);
                this._addScoreBadge(el, element);
                break;

            case 'news':
                el.classList.add('interactive-element');
                {
                    const items = element.items || [];
                    el.innerHTML = `
                        <div style="padding:16px;display:flex;flex-direction:column;gap:12px;height:100%;overflow-y:auto;">
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                                <span class="material-symbols-outlined" style="font-size:22px;color:#0891b2;">newspaper</span>
                                <span style="font-size:1.1rem;font-weight:700;color:#0f172a;">最新相關新聞</span>
                            </div>
                            ${items.map((n, i) => `
                                <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;border-left:3px solid #0891b2;">
                                    <div style="font-size:.92rem;font-weight:600;color:#0f172a;line-height:1.5;margin-bottom:6px;">${n.title}</div>
                                    ${n.summary ? `<div style="font-size:.78rem;color:#475569;line-height:1.6;margin-bottom:6px;">${n.summary}</div>` : ''}
                                    <div style="display:flex;justify-content:space-between;align-items:center;">
                                        <span style="font-size:.7rem;color:#94a3b8;">${n.source || ''}</span>
                                        ${n.url ? `<a href="${n.url}" target="_blank" rel="noopener" style="font-size:.7rem;color:#0891b2;text-decoration:none;" onclick="event.stopPropagation()">查看原文 →</a>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
                break;

            case 'svg':
                {
                    const svgCode = element.svgContent || '';
                    const label = element.label || '圖表';
                    el.innerHTML = `
                        <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;">
                            <div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;">
                                ${svgCode || '<span style="color:#94a3b8;font-size:14px;">SVG 圖表</span>'}
                            </div>
                            ${label ? `<div style="font-size:11px;color:#94a3b8;text-align:center;padding:4px 0;">${label}</div>` : ''}
                        </div>
                    `;
                    // 讓 SVG 自適應容器
                    const svgEl = el.querySelector('svg');
                    if (svgEl) {
                        svgEl.style.width = '100%';
                        svgEl.style.height = '100%';
                        svgEl.style.maxWidth = '100%';
                        svgEl.style.maxHeight = '100%';
                    }
                }
                break;

            case 'showcase':
                el.classList.add('interactive-element', 'showcase-container');
                el.dataset.assignmentTitle = element.assignmentTitle || element.linkedHomeworkTitle || '';
                if (element.linkedHomeworkId) el.dataset.linkedHomeworkId = element.linkedHomeworkId;
                el.innerHTML = `
                    <div class="showcase-placeholder">
                        <span class="material-symbols-outlined" style="font-size:2rem;">gallery_thumbnail</span>
                        <div style="font-weight:600;margin:8px 0 4px;">作品展示牆</div>
                        <div style="color:#64748b;font-size:0.85rem;">${element.assignmentTitle || element.linkedHomeworkTitle || '未設定作業名稱'}</div>
                    </div>
                `;
                break;

            case 'homework':
                el.classList.add('interactive-element', 'homework-element');
                el.dataset.submissionMode = element.submissionMode || '';
                el.dataset.homeworkTitle = element.title || '課堂作業';
                el.dataset.homeworkDesc = element.description || '';
                el.dataset.homeworkExample = element.example || '';
                {
                    const modeNames = { image_only: '圖片上傳', image_prompt: '圖片 + 提示詞', text_only: '文字繳交' };
                    const modeIcons = { image_only: 'image', image_prompt: 'photo_camera', text_only: 'edit_note' };
                    const modeName = modeNames[element.submissionMode] || '全功能';
                    const modeIconName = modeIcons[element.submissionMode] || 'upload_file';
                    const exampleHtml = element.example ? `
                        <div class="hw-example-block">
                            <button class="hw-example-toggle" type="button">
                                <span class="material-symbols-outlined" style="font-size:16px;">lightbulb</span>
                                查看範例
                            </button>
                        </div>` : '';

                    // inline 繳交表單 HTML
                    let inlineFormHtml = '';
                    const mode = element.submissionMode || '';
                    const uploadBlock = (id) => `
                        <div class="hw-upload-zone" id="hwUpload_${id}" tabindex="0">
                            <span class="material-symbols-outlined" style="font-size:24px;color:#64748b;">cloud_upload</span>
                            <span>點擊、拖曳或 Ctrl+V 貼上圖片</span>
                            <span style="font-size:11px;color:#94a3b8;margin-top:2px;">也可貼上圖片網址（上限 2MB，自動壓縮）</span>
                            <input type="file" accept="image/*" class="hw-file-input" hidden>
                        </div>
                        <div class="hw-preview" id="hwPreview_${id}"></div>`;

                    if (mode === 'image_only') {
                        inlineFormHtml = uploadBlock(element.id);
                    } else if (mode === 'image_prompt') {
                        inlineFormHtml = `${uploadBlock(element.id)}
                            <textarea class="hw-inline-textarea" id="hwPrompt_${element.id}" placeholder="請貼上你使用的 Prompt..." rows="2"></textarea>`;
                    } else if (mode === 'text_only') {
                        inlineFormHtml = `
                            <textarea class="hw-inline-textarea" id="hwText_${element.id}" placeholder="在這裡輸入你的作業內容..." rows="3"></textarea>`;
                    } else {
                        inlineFormHtml = `
                            <div class="hw-full-tabs">
                                <button class="hw-tab active" data-type="text"><span class="material-symbols-outlined" style="font-size:14px;">edit_note</span> 文字</button>
                                <button class="hw-tab" data-type="image"><span class="material-symbols-outlined" style="font-size:14px;">image</span> 圖片</button>
                                <button class="hw-tab" data-type="link"><span class="material-symbols-outlined" style="font-size:14px;">link</span> 連結</button>
                            </div>
                            <div class="hw-full-panel active" data-panel="text">
                                <textarea class="hw-inline-textarea" id="hwText_${element.id}" placeholder="在這裡輸入你的作業內容..." rows="3"></textarea>
                            </div>
                            <div class="hw-full-panel" data-panel="image">
                                ${uploadBlock(element.id)}
                            </div>
                            <div class="hw-full-panel" data-panel="link">
                                <input type="url" class="hw-inline-textarea" id="hwLink_${element.id}" placeholder="https://..." style="padding:10px;">
                            </div>`;
                    }

                    // 取得使用者資訊
                    const currentUserObj = window.app?.homework?.getUser();
                    const userName = currentUserObj?.name || '';
                    const userBadgeHtml = userName
                        ? `<div style="display:flex;align-items:center;gap:5px;font-size:12px;color:#6366f1;background:#f0f0ff;padding:4px 10px;border-radius:20px;font-weight:500;">
                            <span class="material-symbols-outlined" style="font-size:14px;">person</span>${userName}
                          </div>`
                        : '';

                    el.innerHTML = `
                        <div class="hw-card">
                            <div class="hw-card-header" style="display:flex;align-items:center;justify-content:space-between;">
                                <div style="display:flex;align-items:center;gap:10px;">
                                    <div class="hw-card-icon"><span class="material-symbols-outlined">assignment</span></div>
                                    <div class="hw-card-info">
                                        <div class="hw-card-title">${element.title || '課堂作業'}</div>
                                        <div class="hw-card-mode"><span class="material-symbols-outlined" style="font-size:13px;">${modeIconName}</span> ${modeName}</div>
                                    </div>
                                </div>
                                <div style="display:flex;align-items:center;gap:8px;">
                                    <div class="hw-counter-badge" data-element-id="${element.id}" style="display:flex;align-items:center;gap:4px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;padding:4px 10px;font-size:12px;color:#16a34a;font-weight:600;">
                                        <span class="material-symbols-outlined" style="font-size:14px;">group</span>
                                        <span class="hw-counter-num">0</span> 人已繳交
                                    </div>
                                    ${userBadgeHtml}
                                </div>
                            </div>
                            ${element.description ? `<div class="hw-card-desc">${element.description}</div>` : ''}
                            ${exampleHtml}

                            <div class="hw-inline-form">
                                ${inlineFormHtml}
                                <div class="hw-error-msg" style="display:none;"></div>
                                <button class="hw-submit-btn" type="button">
                                    <span class="material-symbols-outlined" style="font-size:16px;">send</span> 提交作業
                                </button>
                            </div>
                            <div class="hw-submitted-badge" style="display:none;">
                                <span class="material-symbols-outlined">check_circle</span>
                                <span>已成功繳交</span>
                            </div>
                        </div>
                    `;

                    // ★ 即時計數器 — 監聽 hw_submitted 事件
                    const counterBadge = el.querySelector('.hw-counter-badge');
                    const counterNum = el.querySelector('.hw-counter-num');
                    if (counterBadge && window.app?.realtime) {
                        // 初始載入已提交數量
                        (async () => {
                            try {
                                const { db } = await import('./supabase.js');
                                const sessionCode = new URLSearchParams(location.search).get('code')
                                    || new URLSearchParams(location.search).get('session') || '';
                                if (sessionCode) {
                                    const result = await db.select('submissions', {
                                        filter: {
                                            session_id: `eq.${sessionCode}`,
                                            'state->>base_element_id': `eq.${element.id}`
                                        },
                                        columns: 'student_name'
                                    });
                                    const unique = new Set((result.data || []).map(r => r.student_name));
                                    counterNum.textContent = unique.size;
                                }
                            } catch (e) { /* ignore */ }
                        })();
                    }

                    // helper: inline error msg (取代 alert)
                    const showHwError = (msg) => {
                        const errEl = el.querySelector('.hw-error-msg');
                        if (!errEl) return;
                        errEl.textContent = msg;
                        errEl.style.display = 'block';
                        setTimeout(() => { errEl.style.display = 'none'; }, 3000);
                    };

                    // 範例 — 彈窗顯示
                    const exToggle = el.querySelector('.hw-example-toggle');
                    if (exToggle && element.example) {
                        exToggle.addEventListener('click', (e) => {
                            e.stopPropagation();
                            // 建立 modal overlay
                            const overlay = document.createElement('div');
                            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
                            overlay.innerHTML = `
                                <div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
                                    <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
                                        <div style="display:flex;align-items:center;gap:8px;"><span class="material-symbols-outlined" style="font-size:20px;color:#f59e0b;">lightbulb</span><span style="font-size:15px;font-weight:600;">作業範例</span></div>
                                        <button style="background:none;border:none;cursor:pointer;font-size:20px;color:#94a3b8;line-height:1;" class="hw-ex-close">✕</button>
                                    </div>
                                    <div style="padding:20px;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">${element.example.replace(/</g, '&lt;')}</div>
                                </div>`;
                            document.body.appendChild(overlay);
                            overlay.querySelector('.hw-ex-close').addEventListener('click', () => overlay.remove());
                            overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
                        });
                    }

                    // 全功能 tab 切換
                    el.querySelectorAll('.hw-tab').forEach(tab => {
                        tab.addEventListener('click', (e) => {
                            e.stopPropagation();
                            el.querySelectorAll('.hw-tab').forEach(t => t.classList.remove('active'));
                            el.querySelectorAll('.hw-full-panel').forEach(p => p.classList.remove('active'));
                            tab.classList.add('active');
                            el.querySelector(`[data-panel="${tab.dataset.type}"]`).classList.add('active');
                        });
                    });

                    // 圖片上傳
                    const uploadZone = el.querySelector('.hw-upload-zone');
                    let uploadedData = null;
                    if (uploadZone) {
                        const fileInput = uploadZone.querySelector('.hw-file-input');
                        const preview = el.querySelector('.hw-preview');
                        uploadZone.addEventListener('click', (e) => {
                            e.stopPropagation();
                            // 防止全螢幕播放模式下觸發 file input 導致退出簡報
                            if (window.app) window.app._fileInputActive = true;
                            fileInput.click();
                        });
                        uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); uploadZone.classList.add('dragover'); });
                        uploadZone.addEventListener('dragleave', (e) => { e.stopPropagation(); uploadZone.classList.remove('dragover'); });
                        uploadZone.addEventListener('drop', (e) => {
                            e.preventDefault(); e.stopPropagation(); uploadZone.classList.remove('dragover');
                            if (e.dataTransfer.files[0]) compressAndProcess(e.dataTransfer.files[0]);
                        });
                        fileInput.addEventListener('change', (e) => {
                            if (window.app) window.app._fileInputActive = false;
                            if (e.target.files[0]) compressAndProcess(e.target.files[0]);
                        });
                        // 處理使用者取消檔案選擇的情況
                        fileInput.addEventListener('cancel', () => {
                            if (window.app) window.app._fileInputActive = false;
                        });

                        // Ctrl+V 貼上圖片 / 貼上圖片 URL
                        uploadZone.addEventListener('paste', (e) => {
                            e.preventDefault(); e.stopPropagation();
                            // 剪貼簿圖片
                            const items = e.clipboardData?.items;
                            if (items) {
                                for (const item of items) {
                                    if (item.type.startsWith('image/')) {
                                        compressAndProcess(item.getAsFile());
                                        return;
                                    }
                                }
                            }
                            // 剪貼簿文字 → 嘗試當作圖片 URL
                            const text = e.clipboardData?.getData('text/plain')?.trim();
                            if (text && /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(text)) {
                                loadImageUrl(text);
                            }
                        });
                        // 也監聽 document paste (當 uploadZone 可見時)
                        el.addEventListener('paste', (e) => {
                            if (!uploadZone || uploadZone.style.display === 'none') return;
                            const items = e.clipboardData?.items;
                            if (items) {
                                for (const item of items) {
                                    if (item.type.startsWith('image/')) {
                                        e.preventDefault(); e.stopPropagation();
                                        compressAndProcess(item.getAsFile());
                                        return;
                                    }
                                }
                            }
                            const text = e.clipboardData?.getData('text/plain')?.trim();
                            if (text && /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(text)) {
                                e.preventDefault(); e.stopPropagation();
                                loadImageUrl(text);
                            }
                        });

                        function loadImageUrl(url) {
                            const img = new Image();
                            img.crossOrigin = 'anonymous';
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const MAX = 1200;
                                let w = img.naturalWidth, h = img.naturalHeight;
                                if (w > MAX || h > MAX) {
                                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                                    else { w = Math.round(w * MAX / h); h = MAX; }
                                }
                                canvas.width = w; canvas.height = h;
                                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                uploadedData = dataUrl;
                                preview.innerHTML = `<img src="${dataUrl}" style="max-width:100%;max-height:120px;border-radius:8px;">`;
                                uploadZone.style.display = 'none';
                            };
                            img.onerror = () => {
                                // 非同源，直接用 URL
                                uploadedData = url;
                                preview.innerHTML = `<img src="${url}" style="max-width:100%;max-height:120px;border-radius:8px;">`;
                                uploadZone.style.display = 'none';
                            };
                            img.src = url;
                        }

                        // 圖片壓縮 + preview
                        function compressAndProcess(file) {
                            if (!file || !file.type.startsWith('image/')) return;
                            // 大小限制警告
                            if (file.size > 10 * 1024 * 1024) {
                                showHwError('檔案過大（上限 10MB）');
                                return;
                            }
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                const img = new Image();
                                img.onload = () => {
                                    const MAX = 1200;
                                    let w = img.naturalWidth, h = img.naturalHeight;
                                    const needsResize = w > MAX || h > MAX || file.size > 2 * 1024 * 1024;
                                    if (!needsResize) {
                                        // 小檔直接用原圖
                                        uploadedData = ev.target.result;
                                        preview.innerHTML = `<img src="${uploadedData}" style="max-width:100%;max-height:120px;border-radius:8px;">`;
                                        uploadZone.style.display = 'none';
                                        return;
                                    }
                                    if (w > MAX || h > MAX) {
                                        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                                        else { w = Math.round(w * MAX / h); h = MAX; }
                                    }
                                    const canvas = document.createElement('canvas');
                                    canvas.width = w; canvas.height = h;
                                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                    uploadedData = dataUrl;
                                    preview.innerHTML = `<img src="${dataUrl}" style="max-width:100%;max-height:120px;border-radius:8px;">`;
                                    uploadZone.style.display = 'none';
                                };
                                img.src = ev.target.result;
                            };
                            reader.readAsDataURL(file);
                        }
                    }

                    // 提交
                    const submitBtn = el.querySelector('.hw-submit-btn');
                    if (submitBtn) {
                        submitBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            if (!window.app?.homework) return;
                            const hw = window.app.homework;

                            // 使用登入時的姓名（不再需要 inline 輸入）
                            let currentUser = hw.getUser();
                            if (!currentUser) {
                                showHwError('請先登入後再提交作業');
                                return;
                            }

                            let content = null;
                            let type = 'text';
                            if (mode === 'image_only') {
                                if (!uploadedData) { showHwError('請上傳圖片'); return; }
                                content = uploadedData; type = 'image';
                            } else if (mode === 'image_prompt') {
                                const promptVal = el.querySelector(`#hwPrompt_${element.id}`)?.value?.trim();
                                if (!uploadedData) { showHwError('請上傳圖片'); return; }
                                if (!promptVal) { showHwError('請輸入提示詞'); return; }
                                content = { image: uploadedData, prompt: promptVal }; type = 'image';
                            } else if (mode === 'text_only') {
                                content = el.querySelector(`#hwText_${element.id}`)?.value?.trim();
                                if (!content) { showHwError('請輸入內容'); return; }
                            } else {
                                const activePanel = el.querySelector('.hw-full-panel.active');
                                const panelType = activePanel?.dataset.panel || 'text';
                                if (panelType === 'text') {
                                    content = el.querySelector(`#hwText_${element.id}`)?.value?.trim();
                                    if (!content) { showHwError('請輸入內容'); return; }
                                } else if (panelType === 'image') {
                                    if (!uploadedData) { showHwError('請上傳圖片'); return; }
                                    content = uploadedData; type = 'image';
                                } else if (panelType === 'link') {
                                    content = el.querySelector(`#hwLink_${element.id}`)?.value?.trim();
                                    if (!content) { showHwError('請輸入連結'); return; }
                                    type = 'link';
                                }
                            }

                            // ★ Loading 狀態 — 防止重複提交
                            submitBtn.disabled = true;
                            const origText = submitBtn.innerHTML;
                            submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;animation:spin 1s linear infinite;">progress_activity</span> 上傳中…';

                            try {
                                // ★ 圖片先上傳到 Storage，DB 只存 URL
                                if (type === 'image' && content) {
                                    const { storage } = await import('./supabase.js');
                                    const sessionCode = new URLSearchParams(location.search).get('code')
                                        || new URLSearchParams(location.search).get('session') || 'default';
                                    const folderPrefix = `${sessionCode}/${element.id || 'general'}`;
                                    const base64Str = typeof content === 'object' ? content.image : content;
                                    if (base64Str && base64Str.startsWith('data:')) {
                                        const blob = await fetch(base64Str).then(r => r.blob());
                                        const key = `${folderPrefix}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
                                        let uploaded = false;
                                        for (let attempt = 0; attempt < 3 && !uploaded; attempt++) {
                                            try {
                                                if (attempt > 0) await new Promise(r => setTimeout(r, 1000));
                                                const { data, error } = await storage.upload('homework', key, blob);
                                                if (!error && data) {
                                                    const publicUrl = data.url || storage.getPublicUrl('homework', key);
                                                    if (typeof content === 'object') {
                                                        content = { image: publicUrl, prompt: content.prompt };
                                                    } else {
                                                        content = publicUrl;
                                                    }
                                                    uploaded = true;
                                                } else {
                                                    throw new Error(error?.message || 'Upload failed');
                                                }
                                            } catch (uploadErr) {
                                                console.warn(`[HW] Storage upload attempt ${attempt + 1} failed:`, uploadErr);
                                                if (attempt === 2) {
                                                    showHwError('圖片上傳失敗，請重試');
                                                    submitBtn.disabled = false;
                                                    submitBtn.innerHTML = origText;
                                                    return;
                                                }
                                            }
                                        }
                                    }
                                }

                                await hw.submit(element.title || '課堂作業', type, content, currentUser, element.id);
                            } catch (submitErr) {
                                console.error('[HW] submit failed:', submitErr);
                                showHwError('提交失敗，請重試');
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = origText;
                                return;
                            }

                            submitBtn.disabled = false;
                            submitBtn.innerHTML = origText;
                            el.querySelector('.hw-inline-form').style.display = 'none';

                            // 構建預覽內容
                            const badge = el.querySelector('.hw-submitted-badge');
                            let previewHtml = '';
                            const contentStr = typeof content === 'object' ? JSON.stringify(content) : (content || '');

                            if (type === 'image') {
                                let imgSrc = '';
                                let promptVal = '';
                                if (typeof content === 'string' && content.startsWith('http')) imgSrc = content;
                                else if (uploadedData && uploadedData.data) imgSrc = uploadedData.data;
                                else if (typeof uploadedData === 'string') imgSrc = uploadedData;
                                if (typeof content === 'object' && content.image) {
                                    imgSrc = imgSrc || content.image;
                                    promptVal = content.prompt || '';
                                }
                                if (imgSrc) previewHtml += `<img src="${imgSrc}" style="max-width:100%;max-height:120px;object-fit:contain;border-radius:6px;display:block;margin:0 auto;">`;
                                if (promptVal) previewHtml += `<div style="margin-top:4px;padding:6px 8px;background:#f0f4ff;border-radius:4px;border:1px solid #e0e7ff;font-size:11px;color:#334155;line-height:1.4;white-space:pre-wrap;max-height:60px;overflow-y:auto;"><span style="font-size:9px;color:#6366f1;font-weight:600;">Prompt</span><br>${promptVal.replace(/</g, '&lt;')}</div>`;
                            } else if (type === 'link') {
                                previewHtml = `<div style="padding:4px;word-break:break-all;"><a href="${contentStr}" target="_blank" style="color:#4A7AE8;font-size:12px;">${contentStr}</a></div>`;
                            } else {
                                previewHtml = `<div style="font-size:12px;color:#334155;line-height:1.4;white-space:pre-wrap;max-height:80px;overflow-y:auto;">${contentStr.replace(/</g, '&lt;')}</div>`;
                            }

                            badge.innerHTML = `
                                <div style="width:100%;max-width:400px;margin:0 auto;">
                                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;">
                                        <span class="material-symbols-outlined" style="color:#22c55e;font-size:16px;">check_circle</span>
                                        <span style="font-size:12px;font-weight:600;color:#1e293b;">已成功繳交</span>
                                        <span style="font-size:10px;color:#94a3b8;margin-left:auto;">${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div style="margin-bottom:6px;">${previewHtml}</div>
                                    <button class="hw-resubmit-btn" type="button" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;background:white;color:#475569;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
                                        <span class="material-symbols-outlined" style="font-size:14px;">edit</span> 修改作業
                                    </button>
                                </div>`;
                            badge.style.display = 'flex';
                            badge.style.flexDirection = 'column';
                            badge.style.alignItems = 'stretch';

                            // 修改按鈕 — 重新顯示表單
                            badge.querySelector('.hw-resubmit-btn')?.addEventListener('click', () => {
                                badge.style.display = 'none';
                                el.querySelector('.hw-inline-form').style.display = 'block';
                            });
                        });
                    }
                }
                break;
        }

        // 流動線條 — 獨立於 switch 外處理（因為不是 interactive-element）
        if (element.type === 'flowline') {
            this.renderFlowLineElement(el, element);
        }

        // 倒數計時器（適用所有互動元件）
        if (element.timeLimit && element.timeLimit > 0) {
            el.dataset.timeLimit = element.timeLimit;
        }

        return el;
    }

    /**
     * 渲染流動線條元素（SVG + CSS animation）
     */
    renderFlowLineElement(el, element) {
        const w = element.width;
        const h = element.height;
        let pts = [...(element.waypoints || [])];
        if (pts.length < 2) return;

        // 吸附：如果設定了 snapStartId / snapEndId，計算目標元素邊緣的座標
        const slide = this.getCurrentSlide();
        if (element.snapStartId && slide) {
            const target = slide.elements.find(e => e.id === element.snapStartId);
            if (target) {
                const sp = this._getSnapPoint(element, target, 'start');
                pts[0] = { x: sp.x - element.x, y: sp.y - element.y };
            }
        }
        if (element.snapEndId && slide) {
            const target = slide.elements.find(e => e.id === element.snapEndId);
            if (target) {
                const sp = this._getSnapPoint(element, target, 'end');
                pts[pts.length - 1] = { x: sp.x - element.x, y: sp.y - element.y };
            }
        }

        const color = element.lineColor || '#6366f1';
        const glow = element.glowColor || '#818cf8';
        const lw = element.lineWidth || 3;
        const speed = element.flowSpeed || 2;
        const dir = element.flowDirection || 1;
        const pCount = element.particleCount || 3;
        const dash = element.dashLength || 16;
        const showArrow = element.showArrow || false;
        const curveMode = element.curveMode || 'curved';

        // 產生路徑
        const pathD = this._flowLinePath(pts, curveMode);

        // 計算路徑長度（粗估）
        let totalLen = 0;
        for (let i = 1; i < pts.length; i++) {
            totalLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        totalLen = Math.max(totalLen, 200);

        // 動畫持續時間
        const dur = (6 - speed) * 1.5 + 1;

        // 箭頭 marker 定義
        const arrowMarker = showArrow ? `
            <marker id="flowArrow_${element.id}" markerWidth="10" markerHeight="8"
                refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L10,4 L0,8 L2,4 Z" fill="${color}"/>
            </marker>` : '';
        const markerEnd = showArrow ? `marker-end="url(#flowArrow_${element.id})"` : '';

        // 建構粒子 path 元素
        let particlePaths = '';
        for (let i = 0; i < pCount; i++) {
            const delay = (dur / pCount) * i;
            const opacity = 0.5 + (0.5 / pCount) * (pCount - i);
            const particleDash = dash + i * 4;
            const gap = totalLen;
            const animDir = dir === -1 ? 'reverse' : 'normal';
            particlePaths += `
                <path d="${pathD}" fill="none" stroke="${color}" stroke-width="${lw}"
                    stroke-linecap="round"
                    stroke-dasharray="${particleDash} ${gap}"
                    opacity="${opacity.toFixed(2)}"
                    style="animation: flowlineDash ${dur.toFixed(1)}s linear ${delay.toFixed(1)}s infinite ${animDir};">
                    <set attributeName="stroke-dashoffset" to="${gap + particleDash}"/>
                </path>`;
        }

        // 端點裝飾圓
        const startPt = pts[0];
        const endPt = pts[pts.length - 1];

        // viewBox 加大以容納箭頭和光暈
        const pad = 20;
        el.style.overflow = 'visible';
        el.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
                viewBox="0 0 ${w} ${h}" style="width:100%;height:100%;overflow:visible;">
                <defs>
                    <filter id="flowGlow_${element.id}" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    ${arrowMarker}
                </defs>
                <!-- 底部光暈線 -->
                <path d="${pathD}" fill="none" stroke="${glow}" stroke-width="${lw + 6}"
                    stroke-linecap="round" opacity="0.15"
                    filter="url(#flowGlow_${element.id})"/>
                <!-- 底部靜態線 -->
                <path d="${pathD}" fill="none" stroke="${color}" stroke-width="${lw}"
                    stroke-linecap="round" opacity="0.2" ${markerEnd}/>
                <!-- 流動粒子 -->
                ${particlePaths}
                <!-- 端點 -->
                <circle cx="${startPt.x}" cy="${startPt.y}" r="${lw + 2}" fill="${color}" opacity="0.6"/>
                ${showArrow ? '' : `<circle cx="${endPt.x}" cy="${endPt.y}" r="${lw + 2}" fill="${color}" opacity="0.6"/>`}
            </svg>
        `;

        // 加入可拖曳的 waypoint handles（編輯器模式時顯示）
        pts.forEach((pt, i) => {
            const handle = document.createElement('div');
            handle.className = 'flowline-waypoint-handle';
            handle.dataset.flowlineId = element.id;
            handle.dataset.waypointIndex = i;
            const isEndpoint = (i === 0 || i === pts.length - 1);
            handle.style.cssText = `
                position:absolute;
                left:${pt.x - 7}px;
                top:${pt.y - 7}px;
                width:14px;height:14px;
                border-radius:50%;
                background:${isEndpoint ? '#6366f1' : '#a5b4fc'};
                border:2px solid #fff;
                cursor:grab;
                z-index:20;
                pointer-events:auto;
                box-shadow:0 1px 4px rgba(0,0,0,0.3);
                transition:transform 0.1s;
            `;
            if (isEndpoint) {
                handle.style.width = '16px';
                handle.style.height = '16px';
                handle.style.left = `${pt.x - 8}px`;
                handle.style.top = `${pt.y - 8}px`;
            }
            el.appendChild(handle);
        });
    }

    /**
     * 當元素移動後，更新所有連接到該元素的 flowline 吸附點
     */
    updateFlowLineSnaps(movedElementId) {
        const slide = this.getCurrentSlide();
        if (!slide) return;

        const flowlines = slide.elements.filter(e => e.type === 'flowline' &&
            (e.snapStartId === movedElementId || e.snapEndId === movedElementId));

        if (flowlines.length === 0) return;

        for (const fl of flowlines) {
            const pts = [...fl.waypoints];
            let changed = false;

            if (fl.snapStartId === movedElementId) {
                const target = slide.elements.find(e => e.id === movedElementId);
                if (target) {
                    const sp = this._getSnapPoint(fl, target, 'start');
                    pts[0] = { x: sp.x - fl.x, y: sp.y - fl.y };
                    changed = true;
                }
            }
            if (fl.snapEndId === movedElementId) {
                const target = slide.elements.find(e => e.id === movedElementId);
                if (target) {
                    const sp = this._getSnapPoint(fl, target, 'end');
                    pts[pts.length - 1] = { x: sp.x - fl.x, y: sp.y - fl.y };
                    changed = true;
                }
            }

            if (changed) {
                fl.waypoints = pts;
            }
        }

        // 直接更新 DOM 中的 SVG path（避免觸發 renderCurrentSlide）
        for (const fl of flowlines) {
            const flEl = this.canvasContentEl.querySelector(`[data-id="${fl.id}"]`);
            if (flEl) {
                const svg = flEl.querySelector('svg');
                const path = svg?.querySelector('path');
                if (path && fl.waypoints.length >= 2) {
                    const pts = fl.waypoints;
                    let d = `M ${pts[0].x} ${pts[0].y}`;
                    if (fl.lineStyle === 'curve') {
                        for (let i = 1; i < pts.length; i++) {
                            const prev = pts[i - 1];
                            const cur = pts[i];
                            const cpx1 = prev.x + (cur.x - prev.x) * 0.5;
                            const cpy1 = prev.y;
                            const cpx2 = prev.x + (cur.x - prev.x) * 0.5;
                            const cpy2 = cur.y;
                            d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${cur.x} ${cur.y}`;
                        }
                    } else {
                        for (let i = 1; i < pts.length; i++) {
                            d += ` L ${pts[i].x} ${pts[i].y}`;
                        }
                    }
                    path.setAttribute('d', d);
                    // 同步動畫虛線 path
                    const animPath = svg.querySelector('.flow-dash');
                    if (animPath) animPath.setAttribute('d', d);
                }
            }
        }
        this.renderThumbnails();
        this.save();
    }

    /**
     * 計算吸附點（目標元素最近邊緣中心）
     */
    _getSnapPoint(flowEl, target, which) {
        // flowLine 的起點或終點的絕對座標
        const pts = flowEl.waypoints || [];
        const refPt = which === 'start' ? pts[pts.length - 1] : pts[0];
        const refAbsX = flowEl.x + refPt.x;
        const refAbsY = flowEl.y + refPt.y;

        // 目標元素四個邊的中心點
        const cx = target.x + target.width / 2;
        const cy = target.y + target.height / 2;
        const edges = [
            { x: cx, y: target.y },                        // top
            { x: cx, y: target.y + target.height },        // bottom
            { x: target.x, y: cy },                        // left
            { x: target.x + target.width, y: cy },         // right
        ];

        // 選最近的邊
        let best = edges[0], bestDist = Infinity;
        for (const e of edges) {
            const d = Math.hypot(e.x - refAbsX, e.y - refAbsY);
            if (d < bestDist) { bestDist = d; best = e; }
        }
        return best;
    }

    /**
     * 將 waypoints 轉為 SVG path (curved 或 straight)
     */
    _flowLinePath(pts, mode = 'curved') {
        if (pts.length < 2) return '';
        if (pts.length === 2 || mode === 'straight') {
            let d = `M${pts[0].x},${pts[0].y}`;
            for (let i = 1; i < pts.length; i++) {
                d += ` L${pts[i].x},${pts[i].y}`;
            }
            return d;
        }

        let d = `M${pts[0].x},${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(i - 1, 0)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(i + 2, pts.length - 1)];

            const tension = 0.3;
            const cp1x = p1.x + (p2.x - p0.x) * tension;
            const cp1y = p1.y + (p2.y - p0.y) * tension;
            const cp2x = p2.x - (p3.x - p1.x) * tension;
            const cp2y = p2.y - (p3.y - p1.y) * tension;

            d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x},${p2.y}`;
        }

        return d;
    }

    /**
     * 渲染圖表元素
     */
    renderChartElement(el, element) {
        const chartType = element.chartType || 'bar';
        const data = element.chartData || [];
        const title = element.chartTitle || '';
        const w = element.width || 600;
        const h = element.height || 400;

        if (chartType === 'bar') {
            const maxVal = Math.max(...data.map(d => d.value), 1);
            const barAreaH = h - 80;
            const barW = Math.min(60, (w - 40) / data.length - 10);
            const gap = (w - 40 - barW * data.length) / (data.length + 1);

            let barsHTML = '';
            data.forEach((d, i) => {
                const barH = Math.max(4, (d.value / maxVal) * (barAreaH - 30));
                const x = 20 + gap * (i + 1) + barW * i;
                const y = barAreaH - barH + 40;
                barsHTML += `
                    <div style="position:absolute;left:${x}px;bottom:${h - barAreaH - 40}px;width:${barW}px;height:${barH}px;background:${d.color || '#3b82f6'};border-radius:4px 4px 0 0;transition:height 0.3s;"></div>
                    <div style="position:absolute;left:${x}px;top:${y - 20}px;width:${barW}px;text-align:center;font-size:11px;color:#64748b;font-weight:600;">${d.value}</div>
                    <div style="position:absolute;left:${x}px;bottom:${h - barAreaH - 60}px;width:${barW}px;text-align:center;font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.label}</div>
                `;
            });

            el.innerHTML = `
                <div style="width:100%;height:100%;position:relative;font-family:system-ui;">
                    <div style="padding:8px 12px;font-size:14px;font-weight:700;color:#1e293b;">${title}</div>
                    <div style="position:absolute;left:20px;right:20px;bottom:${h - barAreaH - 40}px;height:1px;background:#e2e8f0;"></div>
                    ${barsHTML}
                </div>
            `;
        } else if (chartType === 'horizontal-bar') {
            const maxVal = Math.max(...data.map(d => d.value), 1);
            const rowH = Math.min(36, (h - 50) / data.length - 4);
            let barsHTML = '';
            data.forEach((d, i) => {
                const barW2 = Math.max(4, (d.value / maxVal) * (w - 160));
                const y = 50 + i * (rowH + 8);
                barsHTML += `
                    <div style="position:absolute;left:10px;top:${y}px;width:80px;font-size:12px;color:#475569;text-align:right;line-height:${rowH}px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${d.label}</div>
                    <div style="position:absolute;left:100px;top:${y}px;width:${barW2}px;height:${rowH}px;background:${d.color || '#3b82f6'};border-radius:0 4px 4px 0;transition:width 0.3s;"></div>
                    <div style="position:absolute;left:${105 + barW2}px;top:${y}px;font-size:11px;color:#64748b;font-weight:600;line-height:${rowH}px;">${d.value}</div>
                `;
            });
            el.innerHTML = `
                <div style="width:100%;height:100%;position:relative;font-family:system-ui;">
                    <div style="padding:8px 12px;font-size:14px;font-weight:700;color:#1e293b;">${title}</div>
                    ${barsHTML}
                </div>
            `;
        } else if (chartType === 'donut') {
            const total = data.reduce((s, d) => s + d.value, 0) || 1;
            let pct = 0;
            const segments = data.map(d => {
                const start = pct;
                pct += (d.value / total) * 100;
                return `${d.color || '#e2e8f0'} ${start}% ${pct}%`;
            }).join(', ');
            const size = Math.min(w, h) - 80;
            const cx = (w - size) / 2;
            const cy = 40 + ((h - 40 - size) / 2);

            let legendHTML = '';
            data.forEach((d, i) => {
                legendHTML += `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#475569;"><div style="width:10px;height:10px;border-radius:3px;background:${d.color};flex-shrink:0;"></div>${d.label} (${Math.round(d.value / total * 100)}%)</div>`;
            });

            el.innerHTML = `
                <div style="width:100%;height:100%;position:relative;font-family:system-ui;">
                    <div style="padding:8px 12px;font-size:14px;font-weight:700;color:#1e293b;">${title}</div>
                    <div style="position:absolute;left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;border-radius:50%;background:conic-gradient(${segments});"></div>
                    <div style="position:absolute;left:${cx + size * 0.25}px;top:${cy + size * 0.25}px;width:${size * 0.5}px;height:${size * 0.5}px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#1e293b;">${total}</div>
                    <div style="position:absolute;right:12px;top:50px;display:flex;flex-direction:column;gap:4px;">${legendHTML}</div>
                </div>
            `;
        }
    }

    /**
     * 套用互動元件的自訂外觀（CSS custom properties）
     */
    _applyInteractiveStyles(el, element) {
        const tfs = element.titleFontSize || 18;
        const ofs = element.optionFontSize || 15;
        const pad = element.interactivePadding || 16;
        el.style.setProperty('--ia-title-fs', tfs + 'px');
        el.style.setProperty('--ia-option-fs', ofs + 'px');
        el.style.setProperty('--ia-padding', pad + 'px');

        // 計分分數 (供互動模組讀取)
        const defaultPts = { quiz: 5, truefalse: 5, buzzer: 10, matching: 10, fillblank: 10, ordering: 10, hotspot: 5, poll: 1, opentext: 1, scale: 1, wordcloud: 1, copycard: 1, document: 5 };
        const pts = element.points ?? defaultPts[element.type] ?? 0;
        el.dataset.points = pts;
    }

    /**
     * 在互動元件上加入分數徽章（獨立定位，不依賴 interactive-label）
     */
    _addScoreBadge(el, element) {
        const pts = parseInt(el.dataset.points) || 0;
        if (pts <= 0) return;
        const badge = document.createElement('div');
        badge.className = 'element-score-badge';
        badge.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px;">stars</span> 1~${pts}分`;
        el.appendChild(badge);
    }

    /**
     * 渲染排行榜內容（獎台 + 列表）
     */
    _renderLeaderboardContent(el, title, data) {
        const medals = ['🥇', '🥈', '🥉'];
        const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
        const podiumHeights = [140, 110, 90];
        const podiumOrder = [1, 0, 2]; // 亞、冠、季（視覺位置）

        const top3 = data.slice(0, 3);
        const rest = data.slice(3, 10);

        // 獎台 HTML (2nd, 1st, 3rd 排列)
        let podiumHtml = '<div class="lb-podium">';
        podiumOrder.forEach(rank => {
            const s = top3[rank];
            if (!s) {
                podiumHtml += '<div class="lb-podium-slot lb-empty-slot"></div>';
                return;
            }
            const h = podiumHeights[rank];
            const color = podiumColors[rank];
            const medal = medals[rank];
            const nameStr = s.name?.length > 6 ? s.name.slice(0, 6) + '…' : (s.name || '—');
            podiumHtml += `
                <div class="lb-podium-slot">
                    <div class="lb-podium-avatar" style="border-color:${color}">
                        <span class="lb-medal">${medal}</span>
                    </div>
                    <div class="lb-podium-name">${nameStr}</div>
                    <div class="lb-podium-pts">${s.totalPoints} 分</div>
                    <div class="lb-podium-bar" style="height:${h}px;background:linear-gradient(135deg, ${color}40, ${color}20);border-top:3px solid ${color};">
                        <span class="lb-podium-rank">${rank + 1}</span>
                    </div>
                </div>
            `;
        });
        podiumHtml += '</div>';

        // 列表 HTML
        let listHtml = '';
        if (rest.length > 0) {
            listHtml = '<div class="lb-rest">';
            rest.forEach((s, i) => {
                const rank = i + 4;
                listHtml += `
                    <div class="lb-row">
                        <span class="lb-row-rank">${rank}</span>
                        <span class="lb-row-name">${s.name || '—'}</span>
                        <span class="lb-row-pts">${s.totalPoints} 分</span>
                    </div>
                `;
            });
            listHtml += '</div>';
        }

        el.innerHTML = `
            <div class="lb-widget">
                <div class="lb-widget-title">
                    <span class="lb-trophy">🏆</span>
                    <span>${title}</span>
                </div>
                ${podiumHtml}
                ${listHtml}
                ${data.length === 0 ? '<div class="lb-no-data">尚無排行資料</div>' : ''}
            </div>
        `;
    }

    /**
     * 渲染連連看元素
     */
    renderMatchingElement(el, element) {
        el.innerHTML = `
            <div class="interactive-label">連連看</div>
            <div class="matching-container">
                <svg class="matching-lines"></svg>
                <div class="matching-column left-column">
                    ${(element.pairs || []).map((pair, i) => `
                        <div class="matching-item" data-index="${i}" data-side="left">
                            ${pair.left}
                            <div class="matching-dot left"></div>
                        </div>
                    `).join('')}
                </div>
                <div class="matching-column right-column">
                    ${this.shuffleArray([...(element.pairs || [])]).map((pair, i) => `
                        <div class="matching-item" data-answer="${pair.left}" data-side="right">
                            ${pair.right}
                            <div class="matching-dot right"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * 渲染排列順序元素
     */
    renderOrderingElement(el, element) {
        const steps = element.steps || ['步驟一', '步驟二', '步驟三'];
        // 打亂順序作為左側選項
        const shuffled = this.shuffleArray([...steps]);

        el.innerHTML = `
            <div class="interactive-label">排列順序</div>
            <div class="ordering-container">
                <div class="ordering-source">
                    <div class="ordering-source-title">拖曳選項</div>
                    ${shuffled.map((text, i) => `
                        <div class="ordering-chip" draggable="true" data-value="${text}">
                            <span class="chip-icon">${String.fromCharCode(65 + i)}</span>
                            ${text}
                        </div>
                    `).join('')}
                </div>
                <div class="ordering-slots">
                    <div class="ordering-slots-title">正確順序</div>
                    ${steps.map((text, i) => `
                        <div class="ordering-slot" data-correct-order="${text}">
                            <span class="slot-number">${i + 1}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * 渲染填空題元素
     */
    renderFillBlankElement(el, element) {
        let contentHtml = element.content || '';

        // 將 ___N___ 替換為輸入框
        (element.blanks || []).forEach((blank, i) => {
            contentHtml = contentHtml.replace(
                `___${i + 1}___`,
                `<input type="text" class="fill-blank-input" data-index="${i}" data-answer="${blank.answer}" placeholder="?">`
            );
        });

        el.innerHTML = `
            <div class="interactive-label">填空題</div>
            <div class="fill-blank-container">
                <div class="fill-blank-title">${element.title || '填空練習'}</div>
                <div class="fill-blank-content">${contentHtml}</div>
                <button class="fill-blank-check-btn">檢查答案</button>
                <div class="fill-blank-result"></div>
            </div>
        `;
    }

    /**
     * 渲染可複製文字卡片
     */
    /**
     * 渲染選擇題元素
     */
    renderQuizElement(el, element) {
        const markers = 'ABCDEFGHIJ';
        const isMultiple = element.multiple || false;
        const options = element.options || [];

        el.innerHTML = `
            <div class="quiz-container" data-multiple="${isMultiple}">
                <div class="quiz-question">${element.question || '請選擇正確答案'}</div>
                <div class="quiz-options">
                    ${options.map((opt, i) => `
                        <div class="quiz-option" data-correct="${opt.correct ? 'true' : 'false'}">
                            <span class="option-marker">${markers[i] || String(i + 1)}</span>
                            <span>${opt.text}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="quiz-footer">
                    <span class="quiz-result"></span>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button class="quiz-retry">重試</button>
                        ${isMultiple ? '<button class="quiz-submit">提交</button>' : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderCopyCardElement(el, element) {
        const rawContent = element.content || '';
        // 提取 {{變數}} 名稱
        const varRegex = /\{\{([^}]+)\}\}/g;
        const vars = [];
        let m;
        while ((m = varRegex.exec(rawContent)) !== null) {
            if (!vars.includes(m[1])) vars.push(m[1]);
        }
        const hasVars = vars.length > 0;

        // 將 {{var}} 替換為可見的 inline input
        let displayHtml = rawContent.replace(/\n/g, '<br>');
        if (hasVars) {
            displayHtml = displayHtml.replace(/\{\{([^}]+)\}\}/g, (_, name) => {
                return `<input type="text" class="cc-var-input" data-var="${name}" placeholder="${name}" autocomplete="off">`;
            });
        }

        el.innerHTML = `
            <div class="interactive-label">複製文字</div>
            <div class="copy-card-container" data-copy-template="${rawContent.replace(/"/g, '&quot;')}">
                <div class="copy-card-title">${element.title || '點擊複製'}</div>
                <div class="copy-card-content">${displayHtml}</div>
                ${hasVars ? `<div class="cc-var-hint">請填寫所有欄位後再複製</div>` : ''}
                <button class="copy-card-btn" ${hasVars ? 'disabled' : ''}>
                    <span class="copy-icon">⧉</span>
                    <span class="copy-text">點擊複製</span>
                </button>
                <div class="copy-card-feedback"></div>
            </div>
        `;

        const container = el.querySelector('.copy-card-container');
        const copyBtn = el.querySelector('.copy-card-btn');
        const feedbackEl = el.querySelector('.copy-card-feedback');
        const hintEl = el.querySelector('.cc-var-hint');

        // 變數輸入監聽：全填滿才啟用複製
        if (hasVars) {
            const inputs = el.querySelectorAll('.cc-var-input');
            const checkFilled = () => {
                const allFilled = [...inputs].every(inp => inp.value.trim() !== '');
                copyBtn.disabled = !allFilled;
                if (hintEl) {
                    hintEl.style.display = allFilled ? 'none' : '';
                }
            };
            inputs.forEach(inp => {
                inp.addEventListener('input', checkFilled);
                inp.addEventListener('click', (e) => e.stopPropagation());
            });
        }

        // 複製事件
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            let textToCopy = rawContent;

            // 替換變數
            if (hasVars) {
                const inputs = el.querySelectorAll('.cc-var-input');
                inputs.forEach(inp => {
                    const varName = inp.dataset.var;
                    textToCopy = textToCopy.replaceAll(`{{${varName}}}`, inp.value.trim());
                });
            }

            try {
                await navigator.clipboard.writeText(textToCopy);
                feedbackEl.textContent = '✓ 已複製到剪貼簿！';
                feedbackEl.classList.add('success');
                copyBtn.classList.add('copied');

                // 計分
                const elementId = el.dataset?.id || el.closest('[data-id]')?.dataset.id || '';
                if (elementId) {
                    const { stateManager } = await import('./interactive/stateManager.js');
                    const points = parseInt(el.dataset?.points) || 1;
                    await stateManager.save(elementId, {
                        type: 'copycard',
                        title: element.title || '複製文字',
                        content: textToCopy.substring(0, 100),
                        isCorrect: null, score: null,
                        points, participated: true,
                        state: { copied: true },
                    });
                }

                setTimeout(() => {
                    feedbackEl.textContent = '';
                    feedbackEl.classList.remove('success');
                    copyBtn.classList.remove('copied');
                }, 2000);
            } catch (err) {
                feedbackEl.textContent = '複製失敗，請手動選取文字';
                feedbackEl.classList.add('error');
            }
        });
    }

    /**
     * 渲染文件檢視器卡片
     */
    renderDocumentElement(el, element) {
        const hasDownload = !!element.docDownloadUrl;
        const anchorCount = (element.docAnchors || []).length;
        el.innerHTML = `
            <div class="interactive-label">文件檢視</div>
            <div class="document-card-container" data-element-id="${element.id}" onclick="if(window._openDocViewer)window._openDocViewer('${element.id}')" style="
                display:flex;flex-direction:column;align-items:center;justify-content:center;
                gap:10px;height:100%;cursor:pointer;pointer-events:auto;
                background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);
                border-radius:12px;border:1.5px solid #bae6fd;
                transition:transform .15s,box-shadow .15s;position:relative;
            ">
                <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#0284c7,#0ea5e9);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(2,132,199,0.25);">
                    <span class="material-symbols-outlined" style="font-size:28px;color:#fff;">description</span>
                </div>
                <div style="font-weight:600;font-size:0.95rem;color:#0c4a6e;text-align:center;line-height:1.4;padding:0 12px;">${element.docTitle || '文件名稱'}</div>
                <div style="font-size:0.72rem;color:#7dd3fc;display:flex;align-items:center;gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:14px;">visibility</span>
                    點擊查看文件
                </div>
                ${hasDownload ? `<div style="position:absolute;top:8px;right:8px;"><span class="material-symbols-outlined" style="font-size:16px;color:#0ea5e9;">download</span></div>` : ''}
                ${anchorCount > 0 ? `<div style="position:absolute;top:8px;left:8px;background:#f59e0b;color:white;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;display:flex;align-items:center;gap:3px;">
                    <span class="material-symbols-outlined" style="font-size:12px;">flag</span>${anchorCount} 錨點
                </div>` : ''}
            </div>
        `;
    }

    /**
     * 渲染投票元素
     */
    renderPollElement(el, element) {
        const markers = 'ABCDEFGHIJ';
        const options = element.options || [];

        el.innerHTML = `
            <div class="poll-container" data-element-id="${element.id}">
                <div class="poll-question">${element.question || '請投票'}</div>
                <div class="poll-options">
                    ${options.map((opt, i) => `
                        <div class="poll-option" data-index="${i}">
                            <span class="option-marker">${markers[i] || String(i + 1)}</span>
                            <span>${opt.text}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="poll-footer">
                    <span class="poll-total"></span>
                </div>
            </div>
        `;
    }

    renderTrueFalseElement(el, element) {
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const tl = element.trueLabel || '對';
        const fl = element.falseLabel || '錯';
        const align = element.tfTextAlign || 'center';
        const lh = element.tfLineHeight || 1.4;
        const alignItems = align === 'left' ? 'flex-start' : 'center';
        const containerStyle = `text-align:${align};--tf-text-align:${align};--tf-align-items:${alignItems};--tf-line-height:${lh};`;
        el.innerHTML = `
            <div class="interactive-label">是非題</div>
            <div class="truefalse-container" data-answer="${element.answer ? 'true' : 'false'}" data-true-label="${esc(tl)}" data-false-label="${esc(fl)}" style="${containerStyle}">
                <div class="tf-question" style="text-align:${align};">${element.question || '對或錯？'}</div>
                <div class="tf-buttons">
                    <button class="tf-btn tf-btn-true">
                        <span class="tf-label">${esc(tl)}</span>
                    </button>
                    <button class="tf-btn tf-btn-false">
                        <span class="tf-label">${esc(fl)}</span>
                    </button>
                </div>
                <div class="tf-result"></div>
                <div class="tf-reveal-area"></div>
                <div class="tf-stats-area"></div>
            </div>
        `;
    }

    renderOpenTextElement(el, element) {
        const maxLen = element.maxLength || 500;
        el.innerHTML = `
            <div class="interactive-label">開放問答</div>
            <div class="opentext-container">
                <div class="opentext-question">${element.question || '請輸入你的想法'}</div>
                <textarea class="opentext-input" placeholder="${element.placeholder || '在這裡輸入你的回答...'}" maxlength="${maxLen}"></textarea>
                <div class="opentext-footer">
                    <span class="opentext-counter">0 / ${maxLen}</span>
                    <button class="opentext-submit">送出</button>
                </div>
                <div class="opentext-result"></div>
            </div>
        `;
        // 字數計數器
        const textarea = el.querySelector('.opentext-input');
        const counter = el.querySelector('.opentext-counter');
        textarea?.addEventListener('input', () => {
            if (counter) counter.textContent = textarea.value.length + ' / ' + maxLen;
        });
    }

    renderScaleElement(el, element) {
        const min = element.min || 1;
        const max = element.max || 10;
        const step = element.step || 1;
        const defaultVal = Math.round((min + max) / 2);
        const labelLeft = element.labelLeft || '';
        const labelRight = element.labelRight || '';
        el.innerHTML = `
            <div class="interactive-label">量表評分</div>
            <div class="scale-container">
                <div class="scale-question">${element.question || '請評分'}</div>
                <div class="scale-slider-wrap">
                    ${labelLeft ? '<span class="scale-label-edge">' + labelLeft + '</span>' : ''}
                    <input type="range" class="scale-slider" min="${min}" max="${max}" step="${step}" value="${defaultVal}">
                    ${labelRight ? '<span class="scale-label-edge">' + labelRight + '</span>' : ''}
                </div>
                <div class="scale-value">${defaultVal}</div>
                <button class="scale-submit">提交</button>
                <div class="scale-result"></div>
            </div>
        `;
    }

    renderBuzzerElement(el, element) {
        el.innerHTML = `
            <div class="interactive-label">搶答</div>
            <div class="buzzer-container">
                <div class="buzzer-question">${element.question || '準備好了嗎？'}</div>
                <div class="buzzer-input-row">
                    <input type="text" class="buzzer-text-input" placeholder="輸入你的答案..." />
                    <button class="buzzer-submit-btn"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">campaign</span> 搶答</button>
                </div>
                <div class="buzzer-result"></div>
                <div class="buzzer-ranking"></div>
            </div>
        `;
    }

    renderWordCloudElement(el, element) {
        const maxWords = element.maxWords || 3;
        el.innerHTML = `
            <div class="interactive-label">文字雲</div>
            <div class="wordcloud-container" data-max-words="${maxWords}">
                <div class="wordcloud-question">${element.question || '輸入你想到的關鍵字'}</div>
                <div class="wordcloud-cloud"></div>
            </div>
        `;
    }

    renderHotspotElement(el, element) {
        const src = element.image || element.src || '';
        const nodes = element.nodes || [];
        const nodesJson = JSON.stringify(nodes).replace(/"/g, '&quot;');
        const nodesHtml = nodes.map(n =>
            `<div class="hs-node" data-id="${n.id}" style="left:${n.x}%;top:${n.y}%;">${n.label}</div>`
        ).join('');
        el.innerHTML = `
            <div class="interactive-label">圖片標註</div>
            <div class="hotspot-container" data-nodes="${nodesJson}">
                <div class="hotspot-question">${element.question || '圈出你認為有問題的地方'}</div>
                <div class="hotspot-image-wrap" style="position:relative;">
                    ${src ? '<img src="' + src + '" class="hotspot-image" draggable="false" />' : '<div class="hotspot-placeholder">（請設定圖片）</div>'}
                    ${nodesHtml}
                </div>
                <div class="hotspot-actions">
                    <button class="hs-submit-btn" disabled>確認送出</button>
                </div>
                <div class="hotspot-result"></div>
            </div>
        `;
    }

    /**
     * 渲染縮略圖
     */
    renderThumbnails() {
        this.slideListEl.innerHTML = '';

        // 建立 section startIndex → section 的對照
        const sectionMap = new Map();
        (this.sections || []).forEach(s => sectionMap.set(s.startIndex, s));

        this.slides.forEach((slide, index) => {
            // 如果此 index 有 section header，先插入
            if (sectionMap.has(index)) {
                const sec = sectionMap.get(index);
                const header = document.createElement('div');
                header.className = 'slide-section-header';
                header.dataset.startIndex = index;
                header.innerHTML = `
                    <span class="section-color-bar"></span>
                    <span class="section-name" title="雙擊編輯">${sec.name || '未命名分組'}</span>
                    <button class="section-remove-btn" title="移除分組標頭">×</button>
                `;
                // 雙擊編輯名稱
                header.querySelector('.section-name').addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    const nameEl = e.target;
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = sec.name || '';
                    input.className = 'section-name-input';
                    nameEl.replaceWith(input);
                    input.focus();
                    input.select();
                    const commit = () => {
                        sec.name = input.value.trim() || '未命名分組';
                        this.saveNow();
                        this.renderThumbnails();
                    };
                    input.addEventListener('blur', commit);
                    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') input.blur(); });
                });
                // 刪除分組
                header.querySelector('.section-remove-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.sections = this.sections.filter(s => s.startIndex !== index);
                    this.saveNow();
                    this.renderThumbnails();
                });

                // ── 拖曳移動分組標籤 ──
                header.draggable = true;
                header.addEventListener('dragstart', (e) => {
                    this._dragSectionIndex = index; // 記錄來源 startIndex
                    this._dragIndex = undefined;    // 清除 slide drag
                    header.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', `section:${index}`);
                });
                header.addEventListener('dragend', () => {
                    header.classList.remove('dragging');
                    this._dragSectionIndex = undefined;
                });

                this.slideListEl.appendChild(header);
            }

            const thumb = document.createElement('div');
            thumb.className = `slide-thumbnail ${index === this.currentIndex ? 'active' : ''}`;
            thumb.dataset.index = index;
            thumb.draggable = true;

            // ── Drag & Drop 排序 ──
            thumb.addEventListener('dragstart', (e) => {
                this._dragIndex = index;
                thumb.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index);
            });
            thumb.addEventListener('dragend', () => {
                thumb.classList.remove('dragging');
                this.slideListEl.querySelectorAll('.slide-thumbnail').forEach(t => t.classList.remove('drag-over-top', 'drag-over-bottom'));
            });
            thumb.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const rect = thumb.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                thumb.classList.remove('drag-over-top', 'drag-over-bottom');
                if (e.clientY < mid) {
                    thumb.classList.add('drag-over-top');
                } else {
                    thumb.classList.add('drag-over-bottom');
                }
            });
            thumb.addEventListener('dragleave', () => {
                thumb.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            thumb.addEventListener('drop', (e) => {
                e.preventDefault();

                // ── 分組標籤拖放 ──
                if (this._dragSectionIndex !== undefined) {
                    const fromIdx = this._dragSectionIndex;
                    const toIdx = index;
                    if (fromIdx === toIdx) { this.renderThumbnails(); return; }
                    const sec = this.sections.find(s => s.startIndex === fromIdx);
                    if (sec) {
                        // 目標位置不能已有另一個 section
                        const conflict = this.sections.find(s => s.startIndex === toIdx);
                        if (conflict && conflict !== sec) {
                            // swap positions
                            conflict.startIndex = fromIdx;
                        }
                        sec.startIndex = toIdx;
                        this.sections.sort((a, b) => a.startIndex - b.startIndex);
                        this.saveNow();
                        this.renderThumbnails();
                    }
                    this._dragSectionIndex = undefined;
                    return;
                }

                // ── 投影片排序 ──
                const fromIndex = this._dragIndex;
                const rect = thumb.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                let toIndex = e.clientY < mid ? index : index + 1;
                if (fromIndex === toIndex || fromIndex + 1 === toIndex) {
                    this.renderThumbnails();
                    return;
                }
                // 重新排列 slides 陣列
                const [moved] = this.slides.splice(fromIndex, 1);
                if (toIndex > fromIndex) toIndex--;
                this.slides.splice(toIndex, 0, moved);
                // 更新 currentIndex
                if (this.currentIndex === fromIndex) {
                    this.currentIndex = toIndex;
                } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
                    this.currentIndex--;
                } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
                    this.currentIndex++;
                }
                this.renderThumbnails();
                this.renderCurrentSlide();
                this.updateCounter();
                this.save();
            });

            // 渲染縮略圖預覽容器（960×540 原尺寸，靠 CSS transform 縮小）
            const previewContainer = document.createElement('div');
            previewContainer.className = 'slide-thumbnail-preview';

            // 同步投影片背景
            if (slide.background && slide.background !== '#ffffff') {
                previewContainer.style.background = slide.background;
            }

            // 渲染投影片內容（使用原始像素座標）
            if (slide.elements && slide.elements.length > 0) {
                slide.elements.forEach(element => {
                    const miniEl = document.createElement('div');
                    miniEl.className = `mini-element mini-${element.type}`;
                    miniEl.style.left = `${element.x}px`;
                    miniEl.style.top = `${element.y}px`;
                    miniEl.style.width = `${element.width}px`;
                    miniEl.style.height = `${element.height}px`;

                    if (element.type === 'text') {
                        const plainText = (element.content || '').replace(/<[^>]*>/g, '').substring(0, 80);
                        let textColor = element.color || '';
                        if (!textColor) {
                            const colorMatch = (element.content || '').match(/color:\s*([^;"']+)/);
                            if (colorMatch) textColor = colorMatch[1].trim();
                        }
                        const colorStyle = textColor ? `color:${textColor};` : '';
                        const boldStyle = element.bold ? 'font-weight:700;' : '';
                        const alignStyle = element.textAlign ? `text-align:${element.textAlign};` : '';
                        const fs = element.fontSize || 18;
                        miniEl.innerHTML = `<span class="mini-text-content" style="${colorStyle}${boldStyle}${alignStyle}font-size:${fs}px;">${plainText}</span>`;
                    } else if (element.type === 'image') {
                        miniEl.innerHTML = `<img src="${element.src}" style="width:100%;height:100%;object-fit:cover;">`;
                    } else if (element.type === 'shape') {
                        miniEl.style.background = element.background || '#4285f4';
                        if (element.shapeType === 'circle') miniEl.style.borderRadius = '50%';
                    } else if (element.type === 'video') {
                        miniEl.style.background = '#1a1a2e';
                        miniEl.innerHTML = '<span style="color:#fff;font-size:24px;display:flex;align-items:center;justify-content:center;height:100%;">▶</span>';
                    } else if (element.type === 'matching') {
                        miniEl.style.background = '#e3f2fd';
                        miniEl.style.border = '2px solid #42a5f5';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#1565c0;font-size:16px;">🔗 連連看</span>';
                    } else if (element.type === 'fillblank') {
                        miniEl.style.background = '#f3e5f5';
                        miniEl.style.border = '2px solid #ab47bc';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#7b1fa2;font-size:16px;">✏️ 填空題</span>';
                    } else if (element.type === 'homework') {
                        miniEl.style.background = '#e8f5e9';
                        miniEl.style.border = '2px solid #66bb6a';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#2e7d32;font-size:16px;">📄 作業</span>';
                    } else if (element.type === 'copycard') {
                        miniEl.style.background = '#fff3e0';
                        miniEl.style.border = '2px solid #ffa726';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#e65100;font-size:16px;">📋 卡片</span>';
                    } else if (element.type === 'quiz') {
                        miniEl.style.background = '#fce4ec';
                        miniEl.style.border = '2px solid #ec407a';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#c2185b;font-size:16px;">❓ 測驗</span>';
                    } else if (element.type === 'poll') {
                        miniEl.style.background = '#ede7f6';
                        miniEl.style.border = '2px solid #7e57c2';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#512da8;font-size:16px;">📊 投票</span>';
                    } else if (element.type === 'ordering') {
                        miniEl.style.background = '#e0f7fa';
                        miniEl.style.border = '2px solid #26c6da';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#00838f;font-size:16px;">🔢 排序</span>';
                    } else if (element.type === 'showcase') {
                        miniEl.style.background = '#f3e5f5';
                        miniEl.style.border = '2px solid #ba68c8';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#7b1fa2;font-size:16px;">🖼️ 展示</span>';
                    } else if (element.type === 'audio') {
                        miniEl.style.background = '#fff8e1';
                        miniEl.style.border = '2px solid #ffd54f';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#f57f17;font-size:16px;">♪ 音訊</span>';
                    } else if (element.type === 'embed') {
                        miniEl.style.background = '#e8eaf6';
                        miniEl.style.border = '2px solid #7986cb';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#283593;font-size:16px;">🔲 嵌入</span>';
                    } else if (element.type === 'truefalse') {
                        miniEl.style.background = '#e8f5e9';
                        miniEl.style.border = '2px solid #66bb6a';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#2e7d32;font-size:16px;">⚖️ 是非</span>';
                    } else if (element.type === 'opentext') {
                        miniEl.style.background = '#e3f2fd';
                        miniEl.style.border = '2px solid #42a5f5';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#1565c0;font-size:16px;">💬 開放題</span>';
                    } else if (element.type === 'scale') {
                        miniEl.style.background = '#fff3e0';
                        miniEl.style.border = '2px solid #ff9800';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#e65100;font-size:16px;">📏 量表</span>';
                    } else if (element.type === 'buzzer') {
                        miniEl.style.background = '#fce4ec';
                        miniEl.style.border = '2px solid #f44336';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#c62828;font-size:16px;">🔔 搶答</span>';
                    } else if (element.type === 'wordcloud') {
                        miniEl.style.background = '#e0f2f1';
                        miniEl.style.border = '2px solid #26a69a';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#00695c;font-size:16px;">☁️ 文字雲</span>';
                    } else if (element.type === 'hotspot') {
                        miniEl.style.background = '#fbe9e7';
                        miniEl.style.border = '2px solid #ff7043';
                        miniEl.innerHTML = '<span class="mini-text-content" style="color:#bf360c;font-size:16px;">📍 熱點</span>';
                    } else if (element.type === 'line') {
                        miniEl.style.borderTop = `${element.strokeWidth || 2}px ${element.lineStyle || 'solid'} ${element.color || '#4285f4'}`;
                        miniEl.style.height = '0';
                    }

                    previewContainer.appendChild(miniEl);
                });
            } else {
                previewContainer.innerHTML = '<span class="empty-slide-hint">空白</span>';
            }

            thumb.appendChild(previewContainer);

            // 投影片編號
            const numEl = document.createElement('div');
            numEl.className = 'slide-thumbnail-number';
            numEl.textContent = index + 1;
            thumb.appendChild(numEl);

            // 備註標記
            if (slide.notes || slide.needsNotes) {
                const badge = document.createElement('div');
                badge.className = 'slide-notes-badge';
                badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:10px;">sticky_note_2</span>';
                badge.title = slide.notes ? '已有備註' : '標記為需要備註';
                thumb.appendChild(badge);
            }

            // 動態計算縮放比例
            requestAnimationFrame(() => {
                const thumbW = thumb.clientWidth || 160;
                const scale = thumbW / 960;
                previewContainer.style.transform = `scale(${scale})`;
            });

            thumb.addEventListener('click', (e) => {
                // 取消選取畫布上的元素，讓 Delete 可以刪除頁面
                window.dispatchEvent(new CustomEvent('thumbnailClicked'));
                if (e.shiftKey && this._lastClickedIndex >= 0) {
                    // Shift+Click: 範圍選取
                    const from = Math.min(this._lastClickedIndex, index);
                    const to = Math.max(this._lastClickedIndex, index);
                    if (!e.metaKey && !e.ctrlKey) this.selectedSlideIndices.clear();
                    for (let i = from; i <= to; i++) this.selectedSlideIndices.add(i);
                    this._updateMultiSelectUI();
                } else if (e.metaKey || e.ctrlKey) {
                    // Cmd/Ctrl+Click: 切換單張選取
                    if (this.selectedSlideIndices.has(index)) {
                        this.selectedSlideIndices.delete(index);
                    } else {
                        this.selectedSlideIndices.add(index);
                    }
                    this._lastClickedIndex = index;
                    this._updateMultiSelectUI();
                } else {
                    // 普通 Click: 清除多選，選取當前，切換投影片
                    this.selectedSlideIndices.clear();
                    this.selectedSlideIndices.add(index);
                    this._lastClickedIndex = index;
                    this.navigateTo(index);
                    this._updateMultiSelectUI();
                }
            });

            // 右鍵選單
            thumb.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showThumbnailContextMenu(e, index);
            });

            this.slideListEl.appendChild(thumb);
        });
    }

    /**
     * 更新多選 UI
     */
    _updateMultiSelectUI() {
        this.slideListEl.querySelectorAll('.slide-thumbnail').forEach((thumb, i) => {
            thumb.classList.toggle('multi-selected', this.selectedSlideIndices.has(i));
        });
    }

    /**
     * 批次刪除已選投影片
     */
    deleteSelectedSlides() {
        if (this.selectedSlideIndices.size === 0) return;
        // 至少保留一張
        if (this.selectedSlideIndices.size >= this.slides.length) {
            console.warn('至少需要保留一張投影片');
            // 保留第一張不在選取中的，或保留第一張
            const keepIndex = [...Array(this.slides.length).keys()].find(i => !this.selectedSlideIndices.has(i));
            if (keepIndex === undefined) {
                // 全選 → 保留第一張
                this.selectedSlideIndices.delete(0);
            }
        }

        // 由大到小刪除
        const sorted = [...this.selectedSlideIndices].sort((a, b) => b - a);
        for (const idx of sorted) {
            if (this.slides.length <= 1) break;
            this.slides.splice(idx, 1);
        }

        // 修正 currentIndex
        if (this.currentIndex >= this.slides.length) {
            this.currentIndex = this.slides.length - 1;
        }

        this.selectedSlideIndices.clear();
        this._lastClickedIndex = -1;
        this.renderThumbnails();
        this.renderCurrentSlide();
        this.updateCounter();
        this.save();
    }

    /**
     * 顯示縮略圖右鍵選單
     */
    showThumbnailContextMenu(e, index) {
        // 移除已存在的選單
        document.querySelectorAll('.context-menu').forEach(m => m.remove());

        // 如果右鍵的投影片不在多選中，清除多選並選取該張
        const isMulti = this.selectedSlideIndices.size > 1 && this.selectedSlideIndices.has(index);
        if (!isMulti) {
            this.selectedSlideIndices.clear();
            this._updateMultiSelectUI();
        }

        const menu = document.createElement('div');
        menu.className = 'context-menu active';
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;

        if (isMulti) {
            const count = this.selectedSlideIndices.size;
            menu.innerHTML = `
                <div class="context-menu-item danger" data-action="delete-multi">🗑 刪除 ${count} 張投影片</div>
            `;
        } else {
            const hasSection = (this.sections || []).some(s => s.startIndex === index);
            menu.innerHTML = `
                <div class="context-menu-item" data-action="duplicate">📋 複製投影片</div>
                <div class="context-menu-item" data-action="insert">➕ 插入新投影片</div>
                <div class="context-menu-divider"></div>
                ${hasSection
                    ? '<div class="context-menu-item" data-action="remove-section">🏷️ 移除分組標頭</div>'
                    : '<div class="context-menu-item" data-action="add-section">🏷️ 新增分組標頭</div>'
                }
                <div class="context-menu-divider"></div>
                <div class="context-menu-item danger" data-action="delete">🗑 刪除</div>
            `;
        }

        document.body.appendChild(menu);

        menu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'duplicate') {
                this.duplicateSlide(index);
            } else if (action === 'insert') {
                this.navigateTo(index);
                this.createSlide(true);
            } else if (action === 'delete') {
                this.deleteSlide(index);
            } else if (action === 'delete-multi') {
                this.deleteSelectedSlides();
            } else if (action === 'add-section') {
                this.addSection(index);
            } else if (action === 'remove-section') {
                this.removeSection(index);
            }
            menu.remove();
        });

        // 點擊其他地方關閉
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 10);
    }

    // ── Section 管理 ──

    addSection(slideIndex, name) {
        if (!this.sections) this.sections = [];
        // 避免重複
        if (this.sections.some(s => s.startIndex === slideIndex)) return;
        const defaultName = prompt('請輸入分組名稱：', '新分組');
        if (defaultName === null) return; // 使用者取消
        this.sections.push({ name: defaultName || '新分組', startIndex: slideIndex });
        this.sections.sort((a, b) => a.startIndex - b.startIndex);
        this.saveNow();
        this.renderThumbnails();
    }

    removeSection(slideIndex) {
        this.sections = (this.sections || []).filter(s => s.startIndex !== slideIndex);
        this.saveNow();
        this.renderThumbnails();
    }

    getSectionForSlide(slideIndex) {
        if (!this.sections || this.sections.length === 0) return null;
        let current = null;
        for (const sec of this.sections) {
            if (sec.startIndex <= slideIndex) {
                current = sec;
            } else {
                break;
            }
        }
        if (!current) return null;
        // 計算組內位置
        const nextSec = this.sections.find(s => s.startIndex > current.startIndex);
        const endIndex = nextSec ? nextSec.startIndex : this.slides.length;
        const posInSection = slideIndex - current.startIndex + 1;
        const sectionTotal = endIndex - current.startIndex;
        return { name: current.name, pos: posInSection, total: sectionTotal, startIndex: current.startIndex };
    }

    /** 投影片增刪時更新 section indices */
    _adjustSectionIndices(changeIndex, delta) {
        if (!this.sections) return;
        this.sections.forEach(s => {
            if (s.startIndex >= changeIndex) {
                s.startIndex = Math.max(0, s.startIndex + delta);
            }
        });
        // 去重
        const seen = new Set();
        this.sections = this.sections.filter(s => {
            if (seen.has(s.startIndex)) return false;
            seen.add(s.startIndex);
            return true;
        });
    }

    /**
     * 更新計數器
     */
    updateCounter() {
        this.currentSlideEl.textContent = this.currentIndex + 1;
        this.totalSlidesEl.textContent = this.slides.length;
    }

    /**
     * 生成唯一 ID
     */
    generateId() {
        return 'el_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    /**
     * 洗牌陣列
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * 儲存到 DB（debounce）+ localStorage 快取
     */
    save() {
        // ★ 先從 DOM 讀取最新狀態到 memory
        this.saveCurrentSlide();

        // ★ 記錄 undo snapshot（undo/redo 還原時不記錄）
        if (!this._isUndoRedo) {
            this.pushSnapshot();
        }

        const data = {
            slides: this.slides,
            sections: this.sections,
            currentIndex: this.currentIndex,
            thankYouConfig: this.thankYouConfig || null,
            surveyConfig: this.surveyConfig || null,
            savedAt: new Date().toISOString()
        };

        // localStorage 快取（即時）— quota 超過時 silently skip
        try {
            localStorage.setItem(`project_${this.currentProjectId}`, JSON.stringify(data));
        } catch (_) { /* quota exceeded, rely on DB */ }

        // 更新快取的 updatedAt
        const p = this._projectsCache.find(p => p.id === this.currentProjectId);
        if (p) p.updatedAt = data.savedAt;

        // DB 存寫（debounce 500ms，避免頻繁寫入）
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this._saveToDB(data);
        }, 500);
    }

    /**
     * 立即儲存到 DB（用於重要操作：新增/刪除元素、投影片等）
     */
    saveNow() {
        this.saveCurrentSlide();

        if (!this._isUndoRedo) {
            this.pushSnapshot();
        }

        const data = {
            slides: this.slides,
            sections: this.sections,
            currentIndex: this.currentIndex,
            savedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(`project_${this.currentProjectId}`, JSON.stringify(data));
        } catch (_) { /* quota exceeded */ }

        const p = this._projectsCache.find(p => p.id === this.currentProjectId);
        if (p) p.updatedAt = data.savedAt;

        // 立即寫 DB（清除任何 pending debounce）
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveToDB(data);
    }

    /**
     * 將當前狀態推入 undo 堆疊（snapshot）
     */
    pushSnapshot() {
        const snapshot = {
            slides: JSON.parse(JSON.stringify(this.slides)),
            currentIndex: this.currentIndex
        };
        this._undoStack.push(snapshot);
        if (this._undoStack.length > this._maxHistory) {
            this._undoStack.shift();
        }
        // 新操作 → 清空 redo
        this._redoStack = [];
    }

    /**
     * 復原（Undo）
     */
    undo() {
        if (this._undoStack.length === 0) return;

        // 先從 DOM 同步最新狀態
        this.saveCurrentSlide();

        // 當前狀態推入 redo
        this._redoStack.push({
            slides: JSON.parse(JSON.stringify(this.slides)),
            currentIndex: this.currentIndex
        });

        // 從 undo 堆疊還原
        const snapshot = this._undoStack.pop();
        this._restoreSnapshot(snapshot);
    }

    /**
     * 重做（Redo）
     */
    redo() {
        if (this._redoStack.length === 0) return;

        // 先從 DOM 同步最新狀態
        this.saveCurrentSlide();

        // 當前狀態推入 undo
        this._undoStack.push({
            slides: JSON.parse(JSON.stringify(this.slides)),
            currentIndex: this.currentIndex
        });

        // 從 redo 堆疊還原
        const snapshot = this._redoStack.pop();
        this._restoreSnapshot(snapshot);
    }

    /**
     * 從 snapshot 還原狀態
     */
    _restoreSnapshot(snapshot) {
        this.slides = snapshot.slides;
        this.currentIndex = snapshot.currentIndex;

        // 重新渲染
        this.renderCurrentSlide();
        this.renderThumbnails();
        this.updateCounter();

        // 存檔（帶 flag 避免重複記錄 snapshot）
        this._isUndoRedo = true;
        this.save();
        this._isUndoRedo = false;
    }

    async _saveToDB(data) {
        if (!this._db || !this.currentProjectId) {
            console.warn('[SaveDB] skip — no db or no project ID', { db: !!this._db, pid: this.currentProjectId });
            return;
        }
        // ★ 正在存檔中就跳過（避免併發）
        if (this._isSaving) return;
        this._isSaving = true;
        try {
            // ★ 樂觀鎖：遞增版本號
            this._dbVersion = (this._dbVersion || 0) + 1;
            data._version = this._dbVersion;

            let payload = JSON.stringify(data);
            let payloadSize = payload.length;

            // ★ 如果 payload > 4MB，自動去除所有 base64 圖片
            if (payloadSize > 4 * 1024 * 1024) {
                console.warn(`[SaveDB] payload ${(payloadSize / 1024 / 1024).toFixed(1)}MB 太大，正在壓縮…`);
                const lightData = {
                    ...data,
                    slides: data.slides.map(s => ({
                        ...s,
                        elements: (s.elements || []).map(el => {
                            if (el.type === 'image' && el.src?.startsWith('data:') && el.src.length > 50000) {
                                // 用一個小的灰色 placeholder 替代
                                return { ...el, src: 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==' };
                            }
                            return el;
                        })
                    }))
                };
                payload = JSON.stringify(lightData);
                payloadSize = payload.length;
                data = lightData;
                console.log(`[SaveDB] 壓縮後 ${(payloadSize / 1024).toFixed(1)}KB`);
            }

            console.log('[SaveDB] saving to project', this.currentProjectId, `(${(payloadSize / 1024).toFixed(1)}KB, ${data.slides?.length || 0} slides)`);

            const result = await this._db.update('projects', {
                slides_data: data,
                updated_at: new Date().toISOString()
            }, { id: `eq.${this.currentProjectId}` });

            if (result.error) {
                console.error('[SaveDB] ❌ DB returned error:', result.error);
                this._showSaveError('資料庫儲存失敗：' + (result.error?.message || JSON.stringify(result.error)));
            } else {
                console.log('[SaveDB] ✅ saved OK', { savedAt: data.savedAt, version: data._version });
                this._lastSaveOk = true;
            }
        } catch (e) {
            console.error('[SaveDB] ❌ exception:', e);
            this._showSaveError('資料庫連線失敗：' + e.message);
        } finally {
            this._isSaving = false;
        }
    }

    /**
     * ★ 自動壓縮 slides 中所有 base64 圖片（一次性遷移）
     * 在 load() 後呼叫，將 > 50KB 的 base64 圖片用 canvas 壓縮
     */
    async _compressBase64Images() {
        let count = 0;
        const MAX_DIM = 1200;
        for (const slide of this.slides) {
            for (const el of (slide.elements || [])) {
                if (el.type !== 'image' || !el.src?.startsWith('data:')) continue;
                if (el.src.length < 50000) continue; // < 50KB 不處理

                try {
                    const img = await new Promise((resolve, reject) => {
                        const i = new Image();
                        i.onload = () => resolve(i);
                        i.onerror = reject;
                        i.src = el.src;
                    });
                    let cw = img.width, ch = img.height;
                    if (cw > MAX_DIM || ch > MAX_DIM) {
                        if (cw > ch) { ch = Math.round(ch * MAX_DIM / cw); cw = MAX_DIM; }
                        else { cw = Math.round(cw * MAX_DIM / ch); ch = MAX_DIM; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = cw;
                    canvas.height = ch;
                    canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
                    const compressed = canvas.toDataURL('image/jpeg', 0.6);
                    if (compressed.length < el.src.length) {
                        console.log(`[Compress] ${(el.src.length / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB`);
                        el.src = compressed;
                        count++;
                    }
                } catch (e) {
                    console.warn('[Compress] failed for image:', e.message);
                }
            }
        }
        if (count > 0) {
            console.log(`[Compress] ✅ 已壓縮 ${count} 張圖片，立即儲存`);
            this.saveNow();
        }
    }

    _showSaveError(msg) {
        this._lastSaveOk = false;
        // 顯示持久性的紅色 toast
        let toast = document.querySelector('.save-error-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'save-error-toast';
            toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#dc2626;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:90vw;word-break:break-word;';
            document.body.appendChild(toast);
        }
        toast.textContent = '⚠️ ' + msg;
        toast.style.display = 'block';
        clearTimeout(this._saveErrorTimer);
        this._saveErrorTimer = setTimeout(() => { toast.style.display = 'none'; }, 8000);
    }

    /**
     * 載入投影片（比較 DB 與 localStorage 時間戳，取較新的）
     */
    async load() {
        // 等待 DB 初始化完成
        if (this._initPromise) await this._initPromise;

        let dbData = null;
        let localData = null;

        // 1. 嘗試從 DB 載入
        if (this._db && this.currentProjectId) {
            try {
                const { data: rows } = await this._db.select('projects', {
                    filter: { id: `eq.${this.currentProjectId}` },
                    select: 'slides_data'
                });
                if (rows?.[0]?.slides_data && rows[0].slides_data.slides) {
                    dbData = rows[0].slides_data;
                }
            } catch (e) {
                console.warn('DB load failed:', e);
            }
        }

        // 2. 從 localStorage 載入
        const localRaw = localStorage.getItem(`project_${this.currentProjectId}`);
        if (localRaw) {
            try { localData = JSON.parse(localRaw); } catch { /* ignore */ }
        }

        // 3. ★ DB-First 策略：DB 永遠優先，localStorage 只作離線備援
        let chosen = null;
        if (dbData) {
            const dbSlideCount = dbData.slides?.length || 0;
            const dbElementCount = (dbData.slides || []).reduce((sum, s) => sum + (s.elements?.length || 0), 0);
            console.log(`[Load] ✅ Using DB data (${dbSlideCount} slides, ${dbElementCount} elements, savedAt: ${dbData.savedAt}, v${dbData._version || 0})`);
            chosen = dbData;
            // ★ 記錄 DB 版本號
            this._dbVersion = dbData._version || 0;
            // 同步 DB → localStorage（作為離線備援）
            try { localStorage.setItem(`project_${this.currentProjectId}`, JSON.stringify(dbData)); } catch (_) { }
        } else if (localData) {
            // DB 無資料時才使用 localStorage（離線模式）
            console.warn('[Load] ⚠️ DB 無資料，使用 localStorage 離線備援');
            chosen = localData;
            // 嘗試回寫 DB
            if (this._db) this._saveToDB(localData);
        }

        if (chosen && chosen.slides && chosen.slides.length > 0) {
            this.slides = chosen.slides;
            this.sections = chosen.sections || [];
            this.currentIndex = chosen.currentIndex || 0;
            this.thankYouConfig = chosen.thankYouConfig || null;
            this.surveyConfig = chosen.surveyConfig || null;
            this.renderThumbnails();
            this.renderCurrentSlide();
            this.updateCounter();
            // ★ 自動壓縮舊的 base64 圖片（一次性遷移）
            this._compressBase64Images();
            return true;
        }

        // 無儲存資料時載入空白投影片
        this.loadBlankSlide();
        return false;
    }

    /**
     * 每 10 秒自動存檔到 DB
     */
    startAutoSave() {
        if (this._autoSaveInterval) clearInterval(this._autoSaveInterval);
        this._autoSaveInterval = setInterval(() => {
            if (this._dbReady && this.currentProjectId && this.slides.length > 0) {
                // ★ 先讀取 DOM 狀態
                this.saveCurrentSlide();
                const data = {
                    slides: this.slides,
                    sections: this.sections,
                    currentIndex: this.currentIndex,
                    savedAt: new Date().toISOString()
                };
                this._saveToDB(data);
            }
        }, 10000);

        // ★ 每 5 分鐘自動備份
        this._backupInterval = setInterval(() => {
            this._createBackup();
        }, 5 * 60 * 1000);

        // ★ 頁面關閉前立即存檔 + 備份
        window.addEventListener('beforeunload', () => {
            if (this.currentProjectId && this.slides.length > 0) {
                this.saveCurrentSlide();
                const data = {
                    slides: this.slides,
                    sections: this.sections,
                    currentIndex: this.currentIndex,
                    savedAt: new Date().toISOString()
                };
                // 用 localStorage 即時寫入（同步，不會被頁面關閉中斷）
                try { localStorage.setItem(`project_${this.currentProjectId}`, JSON.stringify(data)); } catch (_) { }
                // 嘗試用 sendBeacon 通知 DB（best effort）
                if (this._db && navigator.sendBeacon) {
                    try {
                        this._saveToDB(data);
                    } catch (e) { /* best effort */ }
                }
            }
        });
    }

    /**
     * 建立備份快照（localStorage + DB 雙重備份）
     */
    _createBackup() {
        if (!this.currentProjectId || this.slides.length <= 1) return;

        this.saveCurrentSlide();
        const data = {
            slides: this.slides,
            sections: this.sections,
            currentIndex: this.currentIndex,
            savedAt: new Date().toISOString(),
            slideCount: this.slides.length
        };

        // ── localStorage 備份（只保留 1 份，去除 base64 圖片避免爆容量）──
        const prefix = `backup_${this.currentProjectId}_`;
        try {
            // 清除所有舊備份
            const existing = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(prefix)) existing.push(key);
            }
            existing.forEach(k => localStorage.removeItem(k));

            // 去除 base64 圖片 src（太大會爆 localStorage 5MB 配額）
            const lightSlides = data.slides.map(s => ({
                ...s,
                elements: (s.elements || []).map(el => {
                    if (el.type === 'image' && el.src?.startsWith('data:')) {
                        return { ...el, src: '[base64-stripped]' };
                    }
                    return el;
                })
            }));
            const lightData = { ...data, slides: lightSlides };

            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            localStorage.setItem(`${prefix}${ts}`, JSON.stringify(lightData));
            console.log(`[Backup] localStorage 備份完成 (${this.slides.length} slides)`);
        } catch (e) {
            console.warn('[Backup] localStorage 備份失敗:', e.message);
            // 超出配額就清除所有備份
            try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const k = localStorage.key(i);
                    if (k?.startsWith('backup_')) localStorage.removeItem(k);
                }
            } catch (_) { }
        }

        // ── DB 備份（嘗試寫入 project_backups 表，只保留 20 筆）──
        if (this._db) {
            // 去除 base64 圖片，避免備份表膨脹
            const lightData = {
                ...data,
                slides: data.slides.map(s => ({
                    ...s,
                    elements: (s.elements || []).map(el => {
                        if (el.type === 'image' && el.src?.startsWith('data:') && el.src.length > 1000) {
                            return { ...el, src: '[backup-stripped]' };
                        }
                        return el;
                    })
                }))
            };

            this._db.insert('project_backups', {
                project_id: this.currentProjectId,
                slides_data: lightData,
                slide_count: this.slides.length,
                created_at: new Date().toISOString()
            }).then(() => {
                // ★ 輪替：只保留最新 20 筆，刪除舊的
                this._db.select('project_backups', {
                    filter: { project_id: `eq.${this.currentProjectId}` },
                    select: 'id',
                    order: 'created_at.desc',
                    limit: 100,
                    offset: 20
                }).then(({ data: old }) => {
                    if (old?.length > 0) {
                        const ids = old.map(r => r.id);
                        this._db.delete('project_backups', {
                            id: `in.(${ids.join(',')})`
                        }).then(() => {
                            console.log(`[Backup] 已清除 ${ids.length} 筆舊備份`);
                        }).catch(() => { });
                    }
                }).catch(() => { });
            }).catch(() => {
                // project_backups 表可能不存在，靜默失敗
            });
        }
    }

    /**
     * 載入空白投影片（新專案用）
     */
    loadBlankSlide() {
        const gen = () => this.generateId();
        this.slides = [{
            id: gen(),
            elements: [],
            background: '#ffffff'
        }];
        this.currentIndex = 0;
        this.renderThumbnails();
        this.renderCurrentSlide();
        this.updateCounter();
        this.save();
    }

    /**
     * 載入示範投影片 — 行銷數據分析（保留供相容）
     */
    loadDemoSlides() {
        const gen = () => this.generateId();
        this.slides = [
            /* ── Slide 1: 封面 ── */
            {
                id: gen(),
                elements: [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)' },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 60, width: 4, height: 120, background: '#38bdf8' },
                    { id: gen(), type: 'text', x: 80, y: 55, width: 500, height: 70, content: '<b style="font-size:44px;color:#f1f5f9;letter-spacing:1px;">行銷數據分析</b>', fontSize: 44, bold: true },
                    { id: gen(), type: 'text', x: 80, y: 130, width: 500, height: 40, content: '<span style="font-size:20px;color:#94a3b8;">用數據驅動決策，讓行銷效益最大化</span>', fontSize: 20 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 190, width: 50, height: 3, background: '#38bdf8' },
                    { id: gen(), type: 'image', x: 580, y: 40, width: 340, height: 340, src: 'assets/images/marketing_dashboard.png' },
                    { id: gen(), type: 'text', x: 80, y: 400, width: 400, height: 30, content: '<span style="font-size:16px;color:#64748b;">講師：樊松蒲</span>', fontSize: 16 },
                    { id: gen(), type: 'text', x: 80, y: 435, width: 400, height: 30, content: '<span style="font-size:14px;color:#475569;">2026 企業數位行銷內訓</span>', fontSize: 14 }
                ],
                background: '#0f172a'
            },

            /* ── Slide 2: 課程大綱 ── */
            {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 35, width: 700, height: 50, content: '<b style="font-size:32px;color:#1e293b;">課程大綱</b>', fontSize: 32, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 85, width: 50, height: 3, background: '#38bdf8' },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 110, width: 400, height: 75, background: '#f0f9ff' },
                    { id: gen(), type: 'text', x: 80, y: 118, width: 360, height: 60, content: '<div><b style="color:#0284c7;font-size:15px;">01</b> <span style="font-size:16px;color:#1e293b;">認識行銷數據 — 數據來源與類型</span></div>', fontSize: 16 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 500, y: 110, width: 400, height: 75, background: '#faf5ff' },
                    { id: gen(), type: 'text', x: 520, y: 118, width: 360, height: 60, content: '<div><b style="color:#7c3aed;font-size:15px;">02</b> <span style="font-size:16px;color:#1e293b;">核心指標 — KPI 與 ROI 解析</span></div>', fontSize: 16 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 205, width: 400, height: 75, background: '#f0fdf4' },
                    { id: gen(), type: 'text', x: 80, y: 213, width: 360, height: 60, content: '<div><b style="color:#16a34a;font-size:15px;">03</b> <span style="font-size:16px;color:#1e293b;">轉換漏斗 — 從曝光到成交</span></div>', fontSize: 16 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 500, y: 205, width: 400, height: 75, background: '#fffbeb' },
                    { id: gen(), type: 'text', x: 520, y: 213, width: 360, height: 60, content: '<div><b style="color:#d97706;font-size:15px;">04</b> <span style="font-size:16px;color:#1e293b;">社群媒體數據實戰</span></div>', fontSize: 16 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 300, width: 400, height: 75, background: '#fef2f2' },
                    { id: gen(), type: 'text', x: 80, y: 308, width: 360, height: 60, content: '<div><b style="color:#dc2626;font-size:15px;">05</b> <span style="font-size:16px;color:#1e293b;">互動練習 — 指標配對 / 填空</span></div>', fontSize: 16 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 500, y: 300, width: 400, height: 75, background: '#f1f5f9' },
                    { id: gen(), type: 'text', x: 520, y: 308, width: 360, height: 60, content: '<div><b style="color:#475569;font-size:15px;">06</b> <span style="font-size:16px;color:#1e293b;">課程小結與 Q&A</span></div>', fontSize: 16 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 400, width: 840, height: 1, background: '#e2e8f0' }
                ],
                background: '#ffffff'
            },

            /* ── Slide 3: 認識行銷數據 ── */
            {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 35, width: 700, height: 50, content: '<b style="font-size:32px;color:#1e293b;">什麼是行銷數據？</b>', fontSize: 32, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 85, width: 50, height: 3, background: '#38bdf8' },
                    { id: gen(), type: 'text', x: 60, y: 110, width: 530, height: 200, content: '<div style="font-size:16px;line-height:2;color:#334155;"><b>行銷數據</b>是從各類行銷活動中蒐集的量化資訊，用於衡量成效與優化決策。<br><br>常見數據來源：<br>• <b>網站流量</b> — GA4 / Search Console<br>• <b>社群數據</b> — 觸及、互動、分享<br>• <b>廣告數據</b> — 曝光、點擊、轉換<br>• <b>CRM 數據</b> — 客戶行為與生命週期</div>', fontSize: 16 },
                    { id: gen(), type: 'image', x: 620, y: 110, width: 280, height: 200, src: 'assets/images/data_growth_chart.png' },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 340, width: 850, height: 80, background: '#f0f9ff' },
                    { id: gen(), type: 'text', x: 80, y: 352, width: 810, height: 55, content: '<div style="font-size:15px;color:#0284c7;line-height:1.8;"><b>關鍵觀念：</b>數據本身沒有意義，需要透過分析轉化為 <b>洞察 (Insight)</b>，才能驅動有效的行銷決策。</div>', fontSize: 15 }
                ],
                background: '#ffffff'
            },

            /* ── Slide 4: 核心指標 ── */
            {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 35, width: 700, height: 50, content: '<b style="font-size:32px;color:#1e293b;">行銷核心指標</b>', fontSize: 32, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 85, width: 50, height: 3, background: '#38bdf8' },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 110, width: 270, height: 110, background: '#f0f9ff' },
                    { id: gen(), type: 'text', x: 75, y: 118, width: 240, height: 95, content: '<div style="text-align:center;"><b style="font-size:18px;color:#0284c7;">CTR</b><br><span style="font-size:13px;color:#64748b;">點擊率<br>Click-Through Rate<br>衡量廣告吸引力</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 345, y: 110, width: 270, height: 110, background: '#faf5ff' },
                    { id: gen(), type: 'text', x: 360, y: 118, width: 240, height: 95, content: '<div style="text-align:center;"><b style="font-size:18px;color:#7c3aed;">CPC</b><br><span style="font-size:13px;color:#64748b;">單次點擊成本<br>Cost Per Click<br>廣告成本效益</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 630, y: 110, width: 270, height: 110, background: '#f0fdf4' },
                    { id: gen(), type: 'text', x: 645, y: 118, width: 240, height: 95, content: '<div style="text-align:center;"><b style="font-size:18px;color:#16a34a;">ROAS</b><br><span style="font-size:13px;color:#64748b;">廣告投報率<br>Return on Ad Spend<br>每 $1 廣告產出</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 240, width: 270, height: 110, background: '#fffbeb' },
                    { id: gen(), type: 'text', x: 75, y: 248, width: 240, height: 95, content: '<div style="text-align:center;"><b style="font-size:18px;color:#d97706;">CVR</b><br><span style="font-size:13px;color:#64748b;">轉換率<br>Conversion Rate<br>訪客 → 客戶比例</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 345, y: 240, width: 270, height: 110, background: '#fef2f2' },
                    { id: gen(), type: 'text', x: 360, y: 248, width: 240, height: 95, content: '<div style="text-align:center;"><b style="font-size:18px;color:#dc2626;">CAC</b><br><span style="font-size:13px;color:#64748b;">客戶取得成本<br>Customer Acq. Cost<br>獲取一位新客的費用</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 630, y: 240, width: 270, height: 110, background: '#f1f5f9' },
                    { id: gen(), type: 'text', x: 645, y: 248, width: 240, height: 95, content: '<div style="text-align:center;"><b style="font-size:18px;color:#475569;">LTV</b><br><span style="font-size:13px;color:#64748b;">顧客終身價值<br>Lifetime Value<br>長期貢獻利潤</span></div>', fontSize: 13 },
                    { id: gen(), type: 'text', x: 60, y: 380, width: 840, height: 45, content: '<div style="font-size:15px;color:#334155;line-height:1.8;">黃金公式：<b style="color:#0284c7;">LTV > 3× CAC</b> 代表商業模式健康，低於此比例需要優化獲客策略。</div>', fontSize: 15 }
                ],
                background: '#ffffff'
            },

            /* ── Slide 5: 轉換漏斗 ── */
            {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 35, width: 700, height: 50, content: '<b style="font-size:32px;color:#1e293b;">行銷轉換漏斗</b>', fontSize: 32, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 85, width: 50, height: 3, background: '#38bdf8' },
                    { id: gen(), type: 'text', x: 60, y: 100, width: 500, height: 25, content: '<span style="font-size:15px;color:#64748b;">從曝光到成交，每一步都需要數據追蹤</span>', fontSize: 15 },
                    { id: gen(), type: 'image', x: 60, y: 140, width: 280, height: 280, src: 'assets/images/marketing_funnel.png' },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 380, y: 140, width: 530, height: 60, background: '#f0f9ff' },
                    { id: gen(), type: 'text', x: 400, y: 148, width: 490, height: 45, content: '<div><b style="color:#0284c7;font-size:15px;">曝光 Awareness</b><br><span style="font-size:13px;color:#64748b;">廣告觸及、SEO 排名、社群分享</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 380, y: 210, width: 530, height: 60, background: '#faf5ff' },
                    { id: gen(), type: 'text', x: 400, y: 218, width: 490, height: 45, content: '<div><b style="color:#7c3aed;font-size:15px;">興趣 Interest</b><br><span style="font-size:13px;color:#64748b;">頁面停留時間、內容互動、訂閱電子報</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 380, y: 280, width: 530, height: 60, background: '#fffbeb' },
                    { id: gen(), type: 'text', x: 400, y: 288, width: 490, height: 45, content: '<div><b style="color:#d97706;font-size:15px;">考慮 Consideration</b><br><span style="font-size:13px;color:#64748b;">加入購物車、對比產品、詢問客服</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 380, y: 350, width: 530, height: 60, background: '#f0fdf4' },
                    { id: gen(), type: 'text', x: 400, y: 358, width: 490, height: 45, content: '<div><b style="color:#16a34a;font-size:15px;">轉換 Conversion</b><br><span style="font-size:13px;color:#64748b;">完成購買、填寫表單、註冊帳號</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 440, width: 850, height: 1, background: '#e2e8f0' }
                ],
                background: '#ffffff'
            },

            /* ── Slide 6: 社群媒體數據 ── */
            {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 35, width: 700, height: 50, content: '<b style="font-size:32px;color:#1e293b;">社群媒體數據分析</b>', fontSize: 32, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 85, width: 50, height: 3, background: '#38bdf8' },
                    { id: gen(), type: 'image', x: 560, y: 110, width: 350, height: 300, src: 'assets/images/social_media_analytics.png' },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 110, width: 470, height: 65, background: '#f0f9ff' },
                    { id: gen(), type: 'text', x: 80, y: 118, width: 430, height: 50, content: '<div><b style="font-size:15px;color:#0284c7;">觸及率 Reach Rate</b><br><span style="font-size:13px;color:#64748b;">內容被多少人看到，衡量品牌能見度</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 185, width: 470, height: 65, background: '#faf5ff' },
                    { id: gen(), type: 'text', x: 80, y: 193, width: 430, height: 50, content: '<div><b style="font-size:15px;color:#7c3aed;">互動率 Engagement Rate</b><br><span style="font-size:13px;color:#64748b;">按讚 + 留言 + 分享 / 觸及人數</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 260, width: 470, height: 65, background: '#f0fdf4' },
                    { id: gen(), type: 'text', x: 80, y: 268, width: 430, height: 50, content: '<div><b style="font-size:15px;color:#16a34a;">粉絲成長率 Follower Growth</b><br><span style="font-size:13px;color:#64748b;">每月淨增粉絲 / 總粉絲數</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 335, width: 470, height: 65, background: '#fffbeb' },
                    { id: gen(), type: 'text', x: 80, y: 343, width: 430, height: 50, content: '<div><b style="font-size:15px;color:#d97706;">點擊率 Link CTR</b><br><span style="font-size:13px;color:#64748b;">連結點擊 / 總曝光，衡量導流效果</span></div>', fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 430, width: 850, height: 1, background: '#e2e8f0' }
                ],
                background: '#ffffff'
            },

            /* ── Slide 7: 連連看互動 ── */
            {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 30, width: 700, height: 50, content: '<b style="font-size:30px;color:#1e293b;">互動練習：行銷指標配對</b>', fontSize: 30, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 75, width: 50, height: 3, background: '#7c3aed' },
                    { id: gen(), type: 'text', x: 60, y: 90, width: 840, height: 28, content: '<span style="font-size:15px;color:#64748b;">請將左邊的行銷指標與右邊的定義連起來</span>', fontSize: 15 },
                    {
                        id: gen(), type: 'matching', x: 60, y: 130, width: 840, height: 320,
                        pairs: [
                            { left: 'CTR', right: '點擊率' },
                            { left: 'ROAS', right: '廣告投報率' },
                            { left: 'CAC', right: '客戶取得成本' },
                            { left: 'LTV', right: '顧客終身價值' }
                        ]
                    }
                ],
                background: '#f8fafc'
            },

            /* ── Slide 8: 填空題 ── */
            {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 30, width: 700, height: 50, content: '<b style="font-size:30px;color:#1e293b;">小測驗：行銷漏斗</b>', fontSize: 30, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 75, width: 50, height: 3, background: '#16a34a' },
                    { id: gen(), type: 'text', x: 60, y: 90, width: 840, height: 28, content: '<span style="font-size:15px;color:#64748b;">根據前面所學，填入正確的漏斗階段名稱</span>', fontSize: 15 },
                    {
                        id: gen(), type: 'fillblank', x: 60, y: 130, width: 840, height: 320,
                        title: '行銷轉換漏斗填空',
                        content: '行銷轉換漏斗的四個階段是：\n\n1. ___1___ — 讓潛在客戶看到品牌\n2. ___2___ — 引起好奇，開始關注\n3. ___3___ — 比較產品，加入購物車\n4. ___4___ — 完成購買或註冊',
                        blanks: [
                            { answer: '曝光' },
                            { answer: '興趣' },
                            { answer: '考慮' },
                            { answer: '轉換' }
                        ]
                    }
                ],
                background: '#f8fafc'
            },

            /* ── Slide 9: 複製卡片 ── */
            {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 30, width: 700, height: 50, content: '<b style="font-size:30px;color:#1e293b;">GA4 UTM 追蹤範本</b>', fontSize: 30, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 75, width: 50, height: 3, background: '#d97706' },
                    { id: gen(), type: 'text', x: 60, y: 90, width: 840, height: 28, content: '<span style="font-size:15px;color:#64748b;">點擊複製按鈕，直接貼到你的行銷連結後面</span>', fontSize: 15 },
                    {
                        id: gen(), type: 'copycard', x: 60, y: 135, width: 840, height: 300,
                        title: 'UTM 追蹤參數範本',
                        content: '?utm_source=facebook\n&utm_medium=paid_social\n&utm_campaign=2026_spring_promo\n&utm_content=banner_v2\n&utm_term=ai_marketing_course\n\n完整連結範例：\nhttps://yoursite.com/landing?utm_source=facebook&utm_medium=paid_social&utm_campaign=2026_spring_promo'
                    }
                ],
                background: '#f8fafc'
            },

            /* ── Slide 10: 總結 ── */
            {
                id: gen(),
                elements: [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)' },
                    { id: gen(), type: 'text', x: 60, y: 40, width: 700, height: 50, content: '<b style="font-size:32px;color:#f1f5f9;">課程回顧與重點整理</b>', fontSize: 32, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 90, width: 50, height: 3, background: '#38bdf8' },
                    { id: gen(), type: 'text', x: 60, y: 115, width: 840, height: 220, content: '<div style="font-size:17px;line-height:2.2;color:#cbd5e1;"><b style="color:#38bdf8;">✓ 數據是行銷決策的基礎</b>，不靠直覺靠數字<br><b style="color:#7c3aed;">✓ 掌握核心指標</b>，CTR / ROAS / CAC / LTV<br><b style="color:#16a34a;">✓ 理解轉換漏斗</b>，從曝光到成交每步追蹤<br><b style="color:#d97706;">✓ 社群數據分析</b>，觸及、互動、成長率<br><b style="color:#dc2626;">✓ 持續優化</b>，用 A/B Test 驗證每個假設</div>', fontSize: 17 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 200, y: 360, width: 560, height: 80, background: 'rgba(255,255,255,0.08)' },
                    { id: gen(), type: 'text', x: 220, y: 370, width: 520, height: 60, content: '<div style="text-align:center;font-size:28px;color:#f1f5f9;"><b>Q & A 時間</b><br><span style="font-size:16px;color:#94a3b8;">歡迎提出任何問題！</span></div>', fontSize: 28 },
                    { id: gen(), type: 'text', x: 60, y: 470, width: 840, height: 30, content: '<div style="text-align:center;font-size:14px;color:#64748b;">感謝參與！課程資料將於課後寄送至各位信箱</div>', fontSize: 14 }
                ],
                background: '#0f172a'
            }
        ];
        this.currentIndex = 0;
        this.renderThumbnails();
        this.renderCurrentSlide();
        this.updateCounter();
        this.save();
    }

    /**
     * 匯出專案資料
     */
    export() {
        this.saveCurrentSlide();
        return JSON.stringify({
            slides: this.slides,
            exportedAt: new Date().toISOString()
        }, null, 2);
    }

    /**
     * 匯入專案資料
     */
    import(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.slides = data.slides || [];
            this.sections = data.sections || [];
            this.currentIndex = 0;

            if (this.slides.length === 0) {
                this.createSlide();
            } else {
                this.renderThumbnails();
                this.renderCurrentSlide();
                this.updateCounter();
            }
            this.save();
            return true;
        } catch (e) {
            console.error('匯入失敗:', e);
            return false;
        }
    }

    /**
     * 從 PDF 匯入投影片
     * @param {File} file — PDF 檔案
     * @param {'image'|'text'|'ai'} mode — 匯入模式
     * @param {function} onProgress — 進度回調 (done, total, message)
     */
    async importFromPDF(file, mode = 'image', onProgress = () => { }) {
        // 動態載入 pdf.js（使用 <script> 標籤載入，避免 ESM worker 跨域問題）
        if (!window.pdfjsLib) {
            onProgress(0, 1, '載入 PDF 解析引擎...');
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
                script.onload = () => {
                    // 設定 worker（使用同版本 CDN）
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
                    resolve();
                };
                script.onerror = () => reject(new Error('PDF 引擎載入失敗'));
                document.head.appendChild(script);
            });
        }

        if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== 'function') {
            throw new Error('PDF 解析引擎載入失敗，請重新整理頁面後再試');
        }

        const pdfjsLib = window.pdfjsLib;

        // 讀取檔案為 ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;

        // ── 載入 AI prompts（從 system_prompts DB）──
        let visualPrompt = null;
        let interactivePrompt = null;
        if (mode === 'ai') {
            try {
                const { db } = await import('./supabase.js');
                const { data: rows } = await db.select('system_prompts', {
                    filter: { id: 'in.(pdf-import-visual,pdf-import-interactive)' },
                    select: 'id,prompt_text'
                });
                if (rows && rows.length > 0) {
                    for (const row of rows) {
                        if (row.id === 'pdf-import-visual') visualPrompt = row.prompt_text;
                        if (row.id === 'pdf-import-interactive') interactivePrompt = row.prompt_text;
                    }
                }
            } catch (e) {
                console.warn('讀取 system_prompts 失敗，使用預設 prompt:', e);
            }
        }

        // 預設 prompt（fallback）
        if (!visualPrompt) {
            visualPrompt = `你是專業的簡報設計師。根據提供的文字內容，設計一張精美的投影片。

## 畫布：960×540px，座標原點在左上角

## 回傳格式（僅回傳純 JSON，不要 markdown code block）
{ "background": "#色碼", "elements": [ ... ] }

## 元素類型
1. text: { "type":"text", "x":數字, "y":數字, "width":數字, "height":數字, "content":"HTML字串", "fontSize":數字 }
2. shape: { "type":"shape", "shapeType":"rectangle", "x":數字, "y":數字, "width":數字, "height":數字, "background":"#色碼" }

## 5 種版型（根據內容自動判斷）

### 版型 A — 封面（首頁/標題頁）
- 深色漸層背景 background: "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)"
- 左側裝飾條 shape (x:60, y:60, width:4, height:120, background:#38bdf8)
- 大標題 text (x:80, y:55, fontSize:44, color:#f1f5f9, bold)
- 副標題 text (x:80, y:135, fontSize:20, color:#94a3b8)

### 版型 B — 目錄（多個段落標題）
- 白色背景
- 頁面標題 text (x:60, y:35, fontSize:32, color:#1e293b, bold)
- 裝飾線 shape (x:60, y:85, width:50, height:3, background:#38bdf8)
- 多個色塊卡片 shape (background:#f0f9ff/#faf5ff/#f0fdf4) + 卡片文字 text，交錯排列

### 版型 C — 內容頁（標題 + 內文/列表）
- 白色背景
- 頁面標題 text (x:60, y:35, fontSize:32, color:#1e293b, bold)
- 裝飾線 shape (x:60, y:85, width:50, height:3, background:#38bdf8)
- 內文 text (x:60, y:110, fontSize:16, line-height:1.8, color:#334155)
- 重點框 shape (background:#f0f9ff) + 重點文字 text (color:#0284c7)

### 版型 D — 卡片式（多個指標/概念並排）
- 白色背景 + 標題
- 2-3 欄色塊卡片並排（每個 width 約 270-400px）
- 顏色交替：#f0f9ff, #faf5ff, #f0fdf4, #fffbeb

### 版型 E — 總結頁
- 深色背景，類似封面
- 重點條列 text (color:#cbd5e1, line-height:2.2)
- 每點前加粗的彩色標記

## 設計規則
- height 要足夠：每行文字約 30px，用 行數×30 估算
- 文字按邏輯分開：標題、副標、內文各為獨立 text 元素
- shape 色塊放在對應 text 之前（z-index 用陣列順序控制）
- 所有文字 content 用 HTML inline style，例如 "<b style=\\"font-size:32px;color:#1e293b\\">標題</b>"
- 列表用 bullet "•" + <br> 換行
- 內容有多段時，用多個 text 元素分段排列，不要全擠在一個 text 裡`;
        }
        if (!interactivePrompt) {
            interactivePrompt = [
                '你是教學設計專家。根據提供的投影片內容，設計一個互動練習來驗證學員理解程度。',
                '',
                '## 可用的互動元素類型',
                '### quiz — 選擇題',
                '{ "type": "quiz", "question": "問題", "multiple": false, "options": [{"text":"A","correct":false},{"text":"B","correct":true},{"text":"C","correct":false},{"text":"D","correct":false}] }',
                '### matching — 配對',
                '{ "type": "matching", "pairs": [{"left":"術語","right":"定義"}] }',
                '### fillblank — 填空',
                '{ "type": "fillblank", "title": "標題", "content": "有 ___1___ 需填入", "blanks": [{"answer":"答案"}] }',
                '### ordering — 排序',
                '{ "type": "ordering", "steps": ["步驟1","步驟2","步驟3"] }',
                '### poll — 投票',
                '{ "type": "poll", "question": "問題", "options": [{"text":"A"},{"text":"B"},{"text":"C"}] }',
                '',
                '## 設計原則',
                '1. 術語多→matching；流程→ordering；知識點→quiz；記憶→fillblank；開放性→poll',
                '2. 題目必須來自提供的投影片文字，用繁體中文',
                '',
                '## 回傳格式（僅回傳純 JSON）',
                '{ "slideTitle": "標題", "interactiveElement": { /* 上述之一 */ }, "rationale": "原因" }'
            ].join('\n');
        }

        onProgress(0, totalPages, `解析 PDF（共 ${totalPages} 頁）...`);

        const gen = () => this.generateId();
        const newSlides = [];
        // 記錄每頁的文字摘要（第二段用）
        const pageSummaries = [];

        // ════════════════════════════════
        // 第一段：解析每頁 → 根據模式處理
        // ════════════════════════════════
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            onProgress(pageNum - 1, totalPages, `處理第 ${pageNum} / ${totalPages} 頁...`);

            const page = await pdf.getPage(pageNum);

            if (mode === 'image') {
                // ── 截圖模式：渲染為圖片 ──
                const scale = 2;
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');

                await page.render({ canvasContext: ctx, viewport }).promise;
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                newSlides.push({
                    id: gen(),
                    elements: [
                        { id: gen(), type: 'image', x: 0, y: 0, width: 960, height: 540, src: dataUrl }
                    ],
                    background: '#ffffff'
                });

            } else if (mode === 'text' || mode === 'ai') {
                // ── 文字擷取 ──
                const textContent = await page.getTextContent();
                const rawText = textContent.items.map(item => item.str).filter(s => s.trim()).join('\n');
                pageSummaries.push({ pageNum, text: rawText.substring(0, 500) });

                if (mode === 'ai' && rawText.trim().length > 0) {
                    // ── AI 重新設計模式（純文字，不需截圖）──
                    onProgress(pageNum - 0.5, totalPages, `AI 設計第 ${pageNum}/${totalPages} 頁...`);

                    try {
                        const { ai } = await import('./supabase.js');
                        const isFirst = pageNum === 1;
                        const isLast = pageNum === totalPages;
                        const hint = isFirst ? '（這是第一頁，請用封面版型）'
                            : isLast ? '（這是最後一頁，如果是總結/Q&A 請用總結版型）'
                                : '';

                        const aiResult = await ai.chat([
                            { role: 'system', content: visualPrompt },
                            { role: 'user', content: `以下是 PDF 第 ${pageNum}/${totalPages} 頁的文字內容${hint}：\n\n${rawText}\n\n請根據內容重新設計為一張精美投影片，回傳 JSON。` }
                        ], { temperature: 0.3, maxTokens: 3000 });

                        let parsed;
                        try {
                            const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
                            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResult);
                        } catch { parsed = null; }

                        if (parsed && parsed.elements && parsed.elements.length > 0) {
                            const elements = parsed.elements.map(el => ({ ...el, id: gen() }));
                            newSlides.push({ id: gen(), elements, background: parsed.background || '#ffffff' });
                        } else if (parsed && parsed.title) {
                            // Fallback: 舊格式 title+bullets
                            const elements = [
                                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 55, width: 4, height: 50, background: '#6366f1' },
                                { id: gen(), type: 'text', x: 80, y: 50, width: 800, height: 55, content: `<b style="font-size:32px;color:#18181b;">${parsed.title}</b>`, fontSize: 32, bold: true },
                            ];
                            let yPos = 120;
                            if (parsed.subtitle) {
                                elements.push({ id: gen(), type: 'text', x: 80, y: yPos, width: 800, height: 35, content: `<span style="font-size:18px;color:#71717a;">${parsed.subtitle}</span>`, fontSize: 18 });
                                yPos += 50;
                            }
                            if (parsed.bullets && parsed.bullets.length > 0) {
                                const bulletText = parsed.bullets.map(b => `• ${b}`).join('<br>');
                                const bulletHeight = Math.min(parsed.bullets.length * 36, 350);
                                elements.push({ id: gen(), type: 'text', x: 80, y: yPos, width: 800, height: bulletHeight, content: `<span style="font-size:18px;color:#27272a;line-height:2;">${bulletText}</span>`, fontSize: 18 });
                            }
                            newSlides.push({ id: gen(), elements, background: '#ffffff' });
                        } else {
                            this._buildTextSlideFromRaw(newSlides, rawText, gen);
                        }
                    } catch (aiErr) {
                        console.warn('AI 整理失敗，使用文字模式:', aiErr);
                        this._buildTextSlideFromRaw(newSlides, rawText, gen);
                    }
                } else if (mode === 'text') {
                    // ── 純文字模式 ──
                    this._buildTextSlideFromRaw(newSlides, rawText, gen);
                }
            }
        }

        // ════════════════════════════════
        // 第二段：自動插入互動元件
        // 每 15-20 頁插入一頁互動投影片
        // ════════════════════════════════
        if (mode === 'ai' && newSlides.length >= 5 && pageSummaries.length > 0) {
            const INTERVAL = 15; // 每 15 頁一個互動
            const interactiveCount = Math.max(1, Math.floor(newSlides.length / INTERVAL));

            onProgress(totalPages, totalPages, `⚡ 正在生成 ${interactiveCount} 個互動練習...`);

            const { ai } = await import('./supabase.js');

            for (let i = 0; i < interactiveCount; i++) {
                const insertAfter = Math.min((i + 1) * INTERVAL, newSlides.length);
                // 蒐集該區段的內容摘要
                const startPage = i * INTERVAL;
                const endPage = Math.min((i + 1) * INTERVAL, pageSummaries.length);
                const contextText = pageSummaries.slice(startPage, endPage)
                    .map(p => `[第${p.pageNum}頁] ${p.text}`)
                    .join('\n\n');

                onProgress(totalPages, totalPages, `⚡ 生成互動練習 ${i + 1}/${interactiveCount}...`);

                try {
                    const aiResult = await ai.chat([
                        { role: 'system', content: interactivePrompt },
                        { role: 'user', content: `以下是第 ${startPage + 1} 到第 ${endPage} 頁的投影片內容：\n\n${contextText}\n\n請根據這些內容設計一個互動練習。` }
                    ], { temperature: 0.4, maxTokens: 1500 });

                    let parsed;
                    try {
                        const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
                        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResult);
                    } catch { parsed = null; }

                    if (parsed && parsed.interactiveElement) {
                        const el = parsed.interactiveElement;
                        const slideTitle = parsed.slideTitle || '互動練習';

                        // 建立互動投影片
                        const elements = [
                            { id: gen(), type: 'text', x: 60, y: 30, width: 700, height: 50, content: `<b style="font-size:28px;color:#18181b;">${slideTitle}</b>`, fontSize: 28, bold: true },
                            { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 75, width: 50, height: 3, background: '#6366f1' },
                        ];

                        // 根據類型設定互動元件的位置和大小
                        const interactiveEl = {
                            id: gen(),
                            x: 50, y: 100, width: 860, height: 400,
                            ...el,
                        };
                        elements.push(interactiveEl);

                        const interactiveSlide = { id: gen(), elements, background: '#f8fafc' };
                        // 插入到指定位置
                        newSlides.splice(insertAfter + i, 0, interactiveSlide);
                    }
                } catch (err) {
                    console.warn(`互動元件 ${i + 1} 生成失敗:`, err);
                }
            }
        }

        // 新增到投影片 Array
        if (newSlides.length > 0) {
            this.slides.push(...newSlides);
            this.navigateTo(this.slides.length - newSlides.length);
            this.renderThumbnails();
            this.updateCounter();
            this.save();
        }

        const interactiveAdded = mode === 'ai' ? newSlides.filter(s => s.elements.some(e => ['quiz', 'matching', 'fillblank', 'ordering', 'poll'].includes(e.type))).length : 0;
        onProgress(totalPages, totalPages, `✅ 完成！已匯入 ${newSlides.length - interactiveAdded} 頁` + (interactiveAdded > 0 ? `，自動加入 ${interactiveAdded} 個互動練習` : ''));
        return newSlides.length;
    }

    /**
     * 將文字行組建為投影片（內部用）
     */
    _buildTextSlide(slidesArr, lines, gen) {
        if (lines.length === 0) return;

        const elements = [];
        // 找出最大字體的行作為標題
        const maxFontLine = lines.reduce((a, b) => (b.fontSize > a.fontSize ? b : a), lines[0]);
        const titleIdx = lines.indexOf(maxFontLine);

        // 標題
        elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 55, width: 4, height: 50, background: '#6366f1' });
        elements.push({
            id: gen(), type: 'text',
            x: 80, y: 50, width: 800, height: 55,
            content: `<b style="font-size:32px;color:#18181b;">${maxFontLine.text.trim()}</b>`,
            fontSize: 32, bold: true
        });

        // 其他內容
        const otherLines = lines.filter((_, i) => i !== titleIdx).filter(l => l.text.trim());
        if (otherLines.length > 0) {
            const bodyText = otherLines.map(l => l.text.trim()).join('<br>');
            const bodyHeight = Math.min(otherLines.length * 30, 350);
            elements.push({
                id: gen(), type: 'text',
                x: 80, y: 130, width: 800, height: bodyHeight,
                content: `<span style="font-size:18px;color:#27272a;line-height:1.8;">${bodyText}</span>`,
                fontSize: 18
            });
        }

        elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 490, width: 840, height: 2, background: '#e4e4e7' });

        slidesArr.push({ id: gen(), elements, background: '#ffffff' });
    }

    /**
     * 從純文字字串建立投影片（AI fallback / 純文字模式）
     */
    _buildTextSlideFromRaw(slidesArr, rawText, gen) {
        if (!rawText || !rawText.trim()) return;

        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        const title = lines[0];
        const body = lines.slice(1);

        const elements = [];

        // 裝飾條
        elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 55, width: 4, height: 50, background: '#6366f1' });

        // 標題
        elements.push({
            id: gen(), type: 'text',
            x: 80, y: 50, width: 800, height: 55,
            content: `<b style="font-size:32px;color:#18181b;">${title}</b>`,
            fontSize: 32, bold: true
        });

        // 內文
        if (body.length > 0) {
            const bodyHtml = body.map(l => l).join('<br>');
            const bodyHeight = Math.min(body.length * 30, 380);
            elements.push({
                id: gen(), type: 'text',
                x: 80, y: 130, width: 800, height: bodyHeight,
                content: `<span style="font-size:16px;color:#334155;line-height:1.8;">${bodyHtml}</span>`,
                fontSize: 16
            });
        }

        elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 490, width: 840, height: 2, background: '#e4e4e7' });

        slidesArr.push({ id: gen(), elements, background: '#ffffff' });
    }
}

