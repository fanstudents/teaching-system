/**
 * 元素編輯器模組
 * 負責新增各種元素到投影片
 */

export class Editor {
    constructor(slideManager) {
        this.slideManager = slideManager;
        this.selectedElement = null;
        this.selectedElements = new Set(); // 多選集合
        this._editingGroupId = null;      // 群組內部編輯模式

        this.canvasContentEl = document.getElementById('canvasContent');
        this.propertyContentEl = document.getElementById('propertyContent');
        this.imageUploadEl = document.getElementById('imageUpload');
        this.audioUploadEl = document.getElementById('audioUpload');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // 圖片上傳
        this.imageUploadEl.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageUpload(file);
            }
            e.target.value = '';
        });

        // 音檔上傳
        this.audioUploadEl.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleAudioUpload(file);
            }
            e.target.value = '';
        });

        // 貼上事件：剪貼簿圖片 or 內部元素
        document.addEventListener('paste', (e) => {
            // 如果正在編輯文字，不攔截
            const active = document.activeElement;
            if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

            const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
            let hasImage = false;

            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image/') === 0) {
                        const file = items[i].getAsFile();
                        if (file) {
                            e.preventDefault();
                            this.handleImageUpload(file);
                            hasImage = true;
                        }
                        break;
                    }
                }
            }

            // 剪貼簿沒有圖片 → 嘗試貼上內部複製的元素
            if (!hasImage && window._editorDragDrop?._copiedElements?.length > 0) {
                e.preventDefault();
                window._editorDragDrop._doPasteElements();
            }
        });
    }

    /**
     * 新增文字元素
     */
    addText() {
        const element = {
            type: 'text',
            x: 100,
            y: 100,
            width: 300,
            height: 50,
            content: '雙擊編輯文字',
            fontSize: 24,
            color: '#1e293b',
            bold: false,
            italic: false,
            underline: false
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增連結元素
     */
    addLink() {
        const element = {
            type: 'link',
            x: 100,
            y: 200,
            width: 380,
            height: 72,
            linkUrl: 'https://example.com',
            linkLabel: '點擊開啟連結',
            linkDesc: '',
            linkColor: '#1a73e8',
            linkIcon: 'open_in_new',
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    addLeaderboard() {
        const element = {
            type: 'leaderboard',
            x: 60,
            y: 40,
            width: 520,
            height: 420,
            lbTitle: '🏆 排行榜',
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 從素材庫插入 SVG 素材
     */
    addSvgAsset(svgContent, assetName) {
        const encoded = btoa(unescape(encodeURIComponent(svgContent)));
        const src = `data:image/svg+xml;base64,${encoded}`;

        // Parse viewBox to get aspect ratio
        const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
        let width = 400, height = 300;
        if (vbMatch) {
            const parts = vbMatch[1].split(/\s+/).map(Number);
            if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
                const aspect = parts[2] / parts[3];
                width = Math.min(500, Math.round(400 * aspect));
                height = Math.round(width / aspect);
            }
        }

        const element = {
            type: 'image',
            x: 60,
            y: 40,
            width,
            height,
            src,
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增形狀元素
     */
    addShape(shapeType) {
        const sizeMap = {
            rectangle: { width: 200, height: 120 },
            circle: { width: 150, height: 150 },
            triangle: { width: 100, height: 86 },
            arrow: { width: 150, height: 60 }
        };

        const size = sizeMap[shapeType] || { width: 150, height: 150 };

        const element = {
            type: 'shape',
            shapeType: shapeType,
            x: 150,
            y: 150,
            width: size.width,
            height: size.height
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 處理圖片上傳 — 壓縮 + 上傳到 Storage（fallback base64）
     */
    async handleImageUpload(file) {
        // 讀取原始圖片取得尺寸
        const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
        const img = await new Promise((resolve) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.src = dataUrl;
        });

        // 元素尺寸（在 canvas 上顯示的大小）
        let width = img.width;
        let height = img.height;
        const maxWidth = 400;
        const maxHeight = 300;
        if (width > maxWidth) { height = (height / width) * maxWidth; width = maxWidth; }
        if (height > maxHeight) { width = (width / height) * maxHeight; height = maxHeight; }

        // ── 壓縮圖片（max 1200px, JPEG 0.7）避免 base64 過大 ──
        const MAX_DIM = 1200;
        let cw = img.width, ch = img.height;
        if (cw > MAX_DIM || ch > MAX_DIM) {
            if (cw > ch) { ch = Math.round(ch * MAX_DIM / cw); cw = MAX_DIM; }
            else { cw = Math.round(cw * MAX_DIM / ch); ch = MAX_DIM; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
        const compressedBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.7));
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.7);
        console.log(`[Image] original ${(file.size / 1024).toFixed(0)}KB → compressed ${(compressedBlob.size / 1024).toFixed(0)}KB (${cw}x${ch})`);

        // ── 嘗試上傳到 Supabase Storage ──
        let src = compressedUrl; // fallback = compressed base64
        try {
            const { storage } = await import('./supabase.js');
            const key = `images/${this.slideManager.currentProjectId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
            const result = await storage.upload('homework', key, compressedBlob);
            if (result.data?.url) {
                src = result.data.url;
                console.log('[Image] uploaded to Storage:', src);
            }
        } catch (e) {
            console.warn('[Image] Storage upload failed, using compressed base64:', e.message);
        }

        const element = {
            type: 'image',
            x: 100,
            y: 100,
            width,
            height,
            src
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 處理音檔上傳
     */
    handleAudioUpload(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const element = {
                type: 'audio',
                x: 100,
                y: 100,
                width: 280,
                height: 60,
                src: e.target.result,
                filename: file.name
            };

            this.slideManager.addElement(element);
            this.selectElementById(element.id);
        };
        reader.readAsDataURL(file);
    }

    /**
     * 新增影片 (顯示對話框輸入 URL)
     */
    addVideo(url) {
        // 處理 YouTube URL
        let embedUrl = url;
        const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (youtubeMatch) {
            embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
        }

        const element = {
            type: 'video',
            x: 100,
            y: 100,
            width: 480,
            height: 270,
            embedUrl: embedUrl,
            originalUrl: url
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增連連看互動元件
     */
    addMatching() {
        const element = {
            type: 'matching',
            x: 50,
            y: 50,
            width: 600,
            height: 400,
            pairs: [
                { left: '貓', right: 'Cat' },
                { left: '狗', right: 'Dog' },
                { left: '鳥', right: 'Bird' }
            ]
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增填空題互動元件
     */
    addFillBlank() {
        const element = {
            type: 'fillblank',
            x: 50,
            y: 50,
            width: 600,
            height: 350,
            title: '英文填空練習',
            content: 'I ___1___ a student. She ___2___ a teacher.',
            blanks: [
                { answer: 'am' },
                { answer: 'is' }
            ]
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增排列順序互動元件
     */
    addOrdering() {
        const element = {
            type: 'ordering',
            x: 50,
            y: 50,
            width: 600,
            height: 400,
            steps: [
                '確認需求',
                '蒐集資料',
                '撰寫提示詞',
                '生成結果',
                '檢視與修改'
            ]
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增圖表元件
     */
    addChart(chartType = 'bar') {
        const element = {
            type: 'chart',
            x: 50,
            y: 50,
            width: 600,
            height: 380,
            chartType: chartType,
            chartTitle: '圖表標題',
            chartData: [
                { label: 'Q1', value: 120, color: '#3b82f6' },
                { label: 'Q2', value: 180, color: '#4285f4' },
                { label: 'Q3', value: 240, color: '#10b981' },
                { label: 'Q4', value: 320, color: '#f59e0b' },
            ]
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增選擇題互動元件
     */
    addQuiz() {
        const element = {
            type: 'quiz',
            x: 50,
            y: 50,
            width: 600,
            height: 400,
            question: 'AI 的全稱是什麼？',
            multiple: false,
            options: [
                { text: 'Artificial Intelligence', correct: true },
                { text: 'Automated Integration', correct: false },
                { text: 'Advanced Information', correct: false },
                { text: 'Algorithmic Inference', correct: false }
            ]
        };

        this.slideManager.addElement(element);
    }

    addPoll() {
        const element = {
            type: 'poll',
            x: 50,
            y: 50,
            width: 600,
            height: 400,
            question: '你目前最常使用的工具是？',
            options: [
                { text: '選項 A' },
                { text: '選項 B' },
                { text: '選項 C' },
                { text: '選項 D' }
            ]
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    addTrueFalse() {
        const element = {
            type: 'truefalse',
            x: 50, y: 50,
            width: 600, height: 350,
            question: 'AI 可以完全取代人類的創造力？',
            answer: false,
        };
        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    addOpenText() {
        const element = {
            type: 'opentext',
            x: 50, y: 50,
            width: 600, height: 380,
            question: '你對這堂課最大的收穫是什麼？',
            placeholder: '在這裡輸入你的回答...',
            maxLength: 500,
        };
        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    addScale() {
        const element = {
            type: 'scale',
            x: 50, y: 50,
            width: 600, height: 350,
            question: '你對這堂課的整體滿意度',
            min: 1, max: 10, step: 1,
            labelLeft: '不滿意',
            labelRight: '非常滿意',
        };
        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    addBuzzer() {
        const element = {
            type: 'buzzer',
            x: 50, y: 50,
            width: 600, height: 400,
            question: '搶答：誰先想到答案？',
        };
        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    addWordCloud() {
        const element = {
            type: 'wordcloud',
            x: 50, y: 50,
            width: 600, height: 400,
            question: '提到 AI，你想到哪些關鍵字？',
            maxWords: 3,
        };
        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    addHotspot() {
        const element = {
            type: 'hotspot',
            x: 50, y: 50,
            width: 600, height: 400,
            question: '圈出你認為有問題的地方',
            image: '',
            nodes: [],
        };
        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }


    /**
     * 新增可複製文字卡片
     */
    addCopyCard() {
        const element = {
            type: 'copycard',
            x: 100,
            y: 100,
            width: 500,
            height: 150,
            title: '點擊複製',
            content: '請在此輸入要讓學生複製的文字內容...',
            copied: false
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增文件檢視器
     */
    addDocument() {
        const element = {
            type: 'document',
            x: 100,
            y: 80,
            width: 260,
            height: 160,
            docTitle: '文件名稱',
            docContent: '# 文件標題\n\n這是一份文件範例，支援 **Markdown** 格式。\n\n## 章節一\n\n- 項目 A\n- 項目 B\n- 項目 C\n\n> 引用文字範例',
            docDownloadUrl: '',
            docDownloadName: ''
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增測驗分數牆
     */
    addAssessmentWall(wallType = 'pre') {
        const element = {
            type: 'assessmentWall',
            x: 50,
            y: 30,
            width: 860,
            height: 460,
            wallType,
            wallTitle: wallType === 'post' ? '📊 課後測驗分數分布' : '📊 課前測驗分數分布',
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增破冰元件（在線學員牆）
     */
    addIcebreaker() {
        const element = {
            type: 'icebreaker',
            x: 50,
            y: 30,
            width: 860,
            height: 460,
            icebreakerTitle: '🎉 歡迎來到課堂！',
            icebreakerSubtitle: '看看誰已經上線了？',
            icebreakerLayout: 'grid',
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增課前/課後評量元件
     */
    addAssessment(assessmentType = 'pre') {
        const element = {
            type: 'assessment',
            x: 50,
            y: 30,
            width: 860,
            height: 460,
            assessmentType,
            title: assessmentType === 'post' ? '📝 課後測驗' : '📝 課前測驗',
            questions: [],
            points: 15,
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 新增流動線條元素
     */
    addFlowLine() {
        const element = {
            type: 'flowline',
            x: 50,
            y: 100,
            width: 860,
            height: 340,
            waypoints: [
                { x: 0, y: 170 },
                { x: 215, y: 40 },
                { x: 430, y: 300 },
                { x: 645, y: 100 },
                { x: 860, y: 170 }
            ],
            lineColor: '#1a73e8',
            lineWidth: 3,
            glowColor: '#4285f4',
            flowSpeed: 2,
            flowDirection: 1,
            particleCount: 3,
            dashLength: 16,
            showArrow: false,
            curveMode: 'curved',   // 'curved' | 'straight'
            snapStartId: null,
            snapEndId: null
        };

        this.slideManager.addElement(element);
        this.selectElementById(element.id);
    }

    /**
     * 選取元素
     * @param {HTMLElement} element
     * @param {boolean} addToSelection - Shift+click 多選
     */
    selectElement(element, addToSelection = false) {
        // 強制讓其他正在編輯的元素 blur 以便存檔
        document.querySelectorAll('.editable-element.editing').forEach(el => {
            if (el !== element) el.blur();
        });

        if (addToSelection && element) {
            // Shift+click: 追加或移除
            if (this.selectedElements.has(element)) {
                this.selectedElements.delete(element);
                element.classList.remove('selected');
                element.querySelectorAll('.resize-handle').forEach(h => h.remove());
                // 如果 Set 剩一個，將其設為主選取
                if (this.selectedElements.size === 1) {
                    this.selectedElement = [...this.selectedElements][0];
                    this.showPropertyPanel(this.selectedElement);
                } else if (this.selectedElements.size === 0) {
                    this.selectedElement = null;
                    this.hidePropertyPanel();
                } else {
                    this.selectedElement = [...this.selectedElements][0];
                    this.showMultiSelectPanel();
                }
            } else {
                this.selectedElements.add(element);
                element.classList.add('selected');
                if (this.selectedElement && !this.selectedElements.has(this.selectedElement)) {
                    this.selectedElements.add(this.selectedElement);
                }
                this.selectedElement = element;
                if (this.selectedElements.size > 1) {
                    this.showMultiSelectPanel();
                } else {
                    this.showPropertyPanel(element);
                }
            }
            return;
        }

        // 單選模式
        // 檢查群組：如果元素有 groupId 且不在群組內部編輯模式，則選取整個群組
        if (element) {
            const id = element.dataset.id;
            const slide = this.slideManager.getCurrentSlide();
            if (slide) {
                const elData = slide.elements.find(e => e.id === id);
                if (elData?.groupId && this._editingGroupId !== elData.groupId) {
                    this._selectGroup(elData.groupId);
                    return;
                }
            }
        }

        // 取消先前選取
        document.querySelectorAll('.editable-element.selected').forEach(el => {
            if (el !== element) {
                el.classList.remove('selected');
                el.querySelectorAll('.resize-handle').forEach(h => h.remove());
            }
        });

        this.selectedElements.clear();
        this.selectedElement = element;

        if (element) {
            this.selectedElements.add(element);
            if (!element.classList.contains('selected')) {
                element.classList.add('selected');
                this.addResizeHandles(element);
            }
            this.showPropertyPanel(element);
        } else {
            this.hidePropertyPanel();
        }

        window.dispatchEvent(new CustomEvent('elementSelected', {
            detail: element ? { id: element.dataset.id, type: element.dataset.type } : null
        }));
    }

    /**
     * 根據 ID 選取元素
     */
    selectElementById(id) {
        setTimeout(() => {
            const el = this.canvasContentEl.querySelector(`[data-id="${id}"]`);
            if (el) {
                this.selectElement(el);
            }
        }, 10);
    }

    /**
     * 取消選取
     */
    deselectAll() {
        // 先強迫編輯中的元素失去焦點以觸發存檔
        document.querySelectorAll('.editable-element.editing').forEach(el => el.blur());

        document.querySelectorAll('.editable-element.selected').forEach(el => {
            el.classList.remove('selected');
            el.querySelectorAll('.resize-handle').forEach(h => h.remove());
        });

        this.selectedElement = null;
        this.selectedElements.clear();
        this._editingGroupId = null;
        this.hidePropertyPanel();

        window.dispatchEvent(new CustomEvent('elementSelected', { detail: null }));
    }

    /**
     * 新增 resize handles
     */
    addResizeHandles(element) {
        const positions = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
        positions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.dataset.handle = pos;
            element.appendChild(handle);
        });
    }

    /**
     * 顯示屬性面板
     */
    showPropertyPanel(element) {
        const type = element.dataset.type;
        const elementId = element.dataset.id;
        const slide = this.slideManager.getCurrentSlide();
        if (!slide) return;
        const elementData = slide.elements.find(el => el.id === elementId);

        if (!elementData) return;

        let html = '';

        // 位置與大小 (所有元素共用)
        html += `
            <div class="property-section">
                <div class="property-section-title">位置與大小</div>
                <div class="property-row">
                    <label>X</label>
                    <input type="number" id="propX" value="${elementData.x}">
                </div>
                <div class="property-row">
                    <label>Y</label>
                    <input type="number" id="propY" value="${elementData.y}">
                </div>
                <div class="property-row">
                    <label>寬度</label>
                    <input type="number" id="propW" value="${elementData.width}">
                </div>
                <div class="property-row">
                    <label>高度</label>
                    <input type="number" id="propH" value="${elementData.height}">
                </div>
            </div>
        `;

        // 圖片遮色片
        if (type === 'image') {
            const CLIP_MASKS = [
                { key: 'none', label: '無', path: 'none' },
                { key: 'circle', label: '圓形', path: 'circle(50%)' },
                { key: 'ellipse', label: '橢圓', path: 'ellipse(50% 40% at 50% 50%)' },
                { key: 'diagonal-lr', label: '斜切↘', path: 'polygon(0 0, 100% 0, 100% 80%, 0 100%)' },
                { key: 'diagonal-rl', label: '斜切↙', path: 'polygon(0 0, 100% 0, 100% 100%, 0 80%)' },
                { key: 'diamond', label: '菱形', path: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' },
                { key: 'hexagon', label: '六角', path: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' },
                { key: 'star', label: '星形', path: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' },
            ];
            const currentClip = elementData.clipPath || 'none';
            html += `
                <div class="property-section">
                    <div class="property-section-title">遮色片</div>
                    <div class="clip-mask-grid">
                        ${CLIP_MASKS.map(m => {
                const isActive = currentClip === m.path ? 'active' : '';
                return `<button class="clip-mask-btn ${isActive}" data-clip="${m.path}" title="${m.label}">
                                <div class="clip-mask-preview" style="clip-path:${m.path};"></div>
                                <span>${m.label}</span>
                            </button>`;
            }).join('')}
                    </div>
                </div>
            `;

            // Icon 顏色調整（僅限從 Icon 圖庫插入的圖片）
            if (elementData.iconName) {
                const currentIconColor = elementData.iconColor || '#1e293b';
                html += `
                    <div class="property-section">
                        <div class="property-section-title">Icon 顏色</div>
                        <div class="property-row">
                            <label>顏色</label>
                            <input type="color" id="propIconColor" value="${currentIconColor}">
                        </div>
                        <div style="font-size:0.7rem;color:#94a3b8;margin-top:4px;">${elementData.iconName}</div>
                    </div>
                `;
            }
        }

        // 文字專屬屬性
        if (type === 'text') {
            html += `
                <div class="property-section">
                    <div class="property-section-title">文字樣式</div>
                    <div class="property-row">
                        <label>大小</label>
                        <input type="number" id="propFontSize" value="${elementData.fontSize || 18}">
                    </div>
                    <div class="property-row">
                        <label>顏色</label>
                        <input type="color" id="propColor" value="${elementData.color || '#1e293b'}">
                    </div>
                    <div class="text-style-buttons">
                        <button class="style-btn ${elementData.bold ? 'active' : ''}" id="propBold"><b>B</b></button>
                        <button class="style-btn ${elementData.italic ? 'active' : ''}" id="propItalic"><i>I</i></button>
                        <button class="style-btn ${elementData.underline ? 'active' : ''}" id="propUnderline"><u>U</u></button>
                    </div>
                </div>
            `;
        }

        // Shape 填色
        if (type === 'shape') {
            const currentBg = elementData.background || '#e2e8f0';
            const FILL_PRESETS = [
                '#ffffff', '#f8f9fa', '#e2e8f0', '#1e293b', '#0f172a', '#18181b',
                '#2563eb', '#1a73e8', '#dc2626', '#16a34a', '#d97706', '#0284c7',
                'linear-gradient(135deg,#667eea,#764ba2)',
                'linear-gradient(135deg,#0ea5e9,#1a73e8)',
                'linear-gradient(135deg,#f472b6,#1a73e8)',
                'linear-gradient(135deg,#34d399,#059669)',
                'linear-gradient(135deg,#fbbf24,#ea580c)',
                'linear-gradient(135deg,#1a1a2e,#0f3460)',
                'rgba(255,255,255,0.05)',
                'rgba(255,255,255,0.12)',
                'rgba(37,99,235,0.2)',
                'rgba(147,51,234,0.2)',
                'rgba(5,150,105,0.2)',
                'rgba(220,38,38,0.2)',
            ];
            html += `
                <div class="property-section">
                    <div class="property-section-title">填色</div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
                        ${FILL_PRESETS.map(c => `<button class="shape-fill-swatch" data-fill="${c}" style="width:24px;height:24px;border-radius:6px;border:1.5px solid ${c === currentBg ? '#4A7AE8' : '#d1d5db'};background:${c};cursor:pointer;padding:0;"></button>`).join('')}
                    </div>
                    <div class="property-row">
                        <label>自訂</label>
                        <input type="color" id="propShapeFill" value="${currentBg.startsWith('#') ? currentBg : '#e2e8f0'}">
                    </div>
                    <div class="property-row">
                        <label>圓角</label>
                        <input type="number" id="propBorderRadius" value="${elementData.borderRadius || 0}" min="0">
                    </div>
                    <div class="property-row">
                        <label>透明度</label>
                        <input type="range" id="propOpacity" value="${elementData.opacity !== undefined ? elementData.opacity * 100 : 100}" min="0" max="100" style="flex:1;">
                    </div>
                </div>
            `;
        }

        // 連結元件
        if (type === 'link') {
            const LINK_COLORS = ['#1a73e8', '#3b82f6', '#0284c7', '#10b981', '#eab308', '#f59e0b', '#ef4444', '#ec4899', '#4285f4', '#475569'];
            const LINK_ICONS = [
                { icon: 'open_in_new', label: '開啟' },
                { icon: 'edit_note', label: '問卷' },
                { icon: 'school', label: '課程' },
                { icon: 'handshake', label: '服務' },
                { icon: 'share', label: '分享' },
                { icon: 'link', label: '連結' },
                { icon: 'download', label: '下載' },
                { icon: 'play_circle', label: '播放' },
                { icon: 'article', label: '文章' },
                { icon: 'calendar_today', label: '行事曆' },
            ];
            const curColor = elementData.linkColor || '#1a73e8';
            const curIcon = elementData.linkIcon || 'open_in_new';
            html += `
                <div class="property-section">
                    <div class="property-section-title">連結設定</div>
                    <div class="form-group">
                        <label class="form-label">連結網址</label>
                        <input type="url" class="form-input" id="linkUrl" value="${(elementData.linkUrl || '').replace(/"/g, '&quot;')}" placeholder="https://...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">顯示文字</label>
                        <input type="text" class="form-input" id="linkLabel" value="${(elementData.linkLabel || '').replace(/"/g, '&quot;')}" placeholder="點擊開啟連結">
                    </div>
                    <div class="form-group">
                        <label class="form-label">說明（選填）</label>
                        <input type="text" class="form-input" id="linkDesc" value="${(elementData.linkDesc || '').replace(/"/g, '&quot;')}" placeholder="連結的簡短說明">
                    </div>
                    <div class="form-group">
                        <label class="form-label">卡片顏色</label>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            ${LINK_COLORS.map(c => `<button class="link-color-btn${c === curColor ? ' active' : ''}" data-color="${c}" style="width:26px;height:26px;border-radius:50%;border:2px solid ${c === curColor ? '#1e293b' : 'transparent'};background:${c};cursor:pointer;"></button>`).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">圖示</label>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            ${LINK_ICONS.map(i => `<button class="link-icon-btn${i.icon === curIcon ? ' active' : ''}" data-icon="${i.icon}" title="${i.label}" style="width:34px;height:34px;border-radius:8px;border:2px solid ${i.icon === curIcon ? '#1a73e8' : '#e2e8f0'};background:${i.icon === curIcon ? '#e8f0fe' : '#f8fafc'};cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="font-size:18px;">${i.icon}</span></button>`).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">預覽圖（選填）</label>
                        ${elementData.linkImage ? `<div id="linkImagePreviewWrap" style="position:relative;margin-bottom:6px;"><img src="${elementData.linkImage}" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;" /><button id="linkImageRemove" style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.6);color:white;border:none;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">✕</button></div>` : ''}
                        <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1.5px dashed #cbd5e1;border-radius:8px;cursor:pointer;font-size:12px;color:#64748b;justify-content:center;">
                            <span class="material-symbols-outlined" style="font-size:16px;">upload</span>上傳圖片
                            <input type="file" id="linkImageUpload" accept="image/*" style="display:none;" />
                        </label>
                    </div>
                </div>
            `;
        }

        // 問卷元件
        if (type === 'survey') {
            const cfg = elementData.thankYouConfig || {};
            const ctaCards = cfg.ctaCards || [
                { title: '數位簡報室・更多課程', desc: '探索更多數位工具與 AI 應用課程', url: 'https://tbr.digital', icon: 'school', color: '#1a73e8' },
                { title: '企業顧問服務', desc: '內部培訓 ・ 諮詢 ・ 數位工具導入', url: 'https://tbr.digital/consulting', icon: 'handshake', color: '#eab308' },
                { title: '前往 Threads 分享心得', desc: '標記 @TBR.DIGITAL 讓老師看到你的感受！', url: 'https://www.threads.net/intent/post?text=' + encodeURIComponent('剛上完數位簡報室的課程！收穫滿滿 🎓✨ @TBR.DIGITAL'), icon: 'share', color: '#10b981' }
            ];
            const farewell = cfg.farewell || '🙌 歡迎來找老師聊聊天、私下互動\n或是開心地離開教室，回家注意安全！';
            const emailNotice = cfg.emailNotice || '我們會在課後兩天內，將這堂課的學習筆記整理寄到你的 Email，請務必留意課後信件 📬';
            const sectionTitle = cfg.sectionTitle || '✨ 修完這堂課，你還可以…';

            const ctaCardsHtml = ctaCards.map((c, i) => `
                <div class="survey-cta-card-editor" data-idx="${i}" style="padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                        <span class="material-symbols-outlined" style="font-size:16px;color:${c.color || '#1a73e8'};">${c.icon || 'link'}</span>
                        <strong style="font-size:12px;flex:1;">CTA #${i + 1}</strong>
                        <button class="survey-cta-remove" data-idx="${i}" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:14px;" title="移除">✕</button>
                    </div>
                    <input class="form-input survey-cta-title" data-idx="${i}" value="${(c.title || '').replace(/"/g, '&quot;')}" placeholder="標題" style="margin-bottom:4px;font-size:12px;">
                    <input class="form-input survey-cta-desc" data-idx="${i}" value="${(c.desc || '').replace(/"/g, '&quot;')}" placeholder="說明" style="margin-bottom:4px;font-size:12px;">
                    <input class="form-input survey-cta-url" data-idx="${i}" value="${(c.url || '').replace(/"/g, '&quot;')}" placeholder="網址" style="margin-bottom:4px;font-size:12px;">
                    <div style="display:flex;gap:4px;align-items:center;">
                        <label style="font-size:11px;color:#64748b;">圖示</label>
                        <input class="form-input survey-cta-icon" data-idx="${i}" value="${c.icon || 'link'}" placeholder="icon" style="width:80px;font-size:11px;">
                        <label style="font-size:11px;color:#64748b;">色</label>
                        <input type="color" class="survey-cta-color" data-idx="${i}" value="${c.color || '#1a73e8'}" style="width:28px;height:24px;border:none;cursor:pointer;">
                    </div>
                </div>
            `).join('');

            html += `
                <div class="property-section">
                    <div class="property-section-title">問卷設定</div>
                    <div class="form-group">
                        <label class="form-label">問卷標題</label>
                        <input type="text" class="form-input" id="surveyTitle" value="${(elementData.surveyTitle || '📋 課程回饋問卷').replace(/"/g, '&quot;')}" placeholder="📋 課程回饋問卷">
                    </div>
                </div>
                <div class="property-section">
                    <div class="property-section-title">感謝頁設定</div>
                    <div class="form-group">
                        <label class="form-label">區塊標題</label>
                        <input type="text" class="form-input" id="thankYouSectionTitle" value="${sectionTitle.replace(/"/g, '&quot;')}" placeholder="✨ 修完這堂課，你還可以…">
                    </div>
                    <div class="form-group">
                        <label class="form-label">CTA 卡片</label>
                        <div id="ctaCardsContainer">${ctaCardsHtml}</div>
                        <button id="addCtaCardBtn" style="width:100%;padding:6px;border:1.5px dashed #cbd5e1;border-radius:8px;background:none;color:#64748b;cursor:pointer;font-size:12px;margin-top:4px;">+ 新增卡片</button>
                    </div>
                    <div class="form-group">
                        <label class="form-label">告別訊息</label>
                        <textarea class="form-input" id="thankYouFarewell" rows="3" style="font-size:12px;">${farewell.replace(/"/g, '&quot;')}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email 通知文字</label>
                        <textarea class="form-input" id="thankYouEmail" rows="3" style="font-size:12px;">${emailNotice.replace(/"/g, '&quot;')}</textarea>
                    </div>
                </div>
            `;
        }

        // 測驗分數牆
        if (type === 'assessmentWall') {
            html += `
                <div class="property-section">
                    <div class="property-section-title">分數牆設定</div>
                    <div class="form-group">
                        <label class="form-label">標題</label>
                        <input type="text" class="form-input" id="wallTitle" value="${(elementData.wallTitle || '📊 測驗分數分布').replace(/"/g, '&quot;')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">對應測驗</label>
                        <select class="form-input" id="wallType">
                            <option value="pre" ${(elementData.wallType || 'pre') === 'pre' ? 'selected' : ''}>課前測驗</option>
                            <option value="post" ${elementData.wallType === 'post' ? 'selected' : ''}>課後測驗</option>
                        </select>
                    </div>
                </div>
            `;
        }

        // 破冰元件（在線學員牆）
        if (type === 'icebreaker') {
            html += `
                <div class="property-section">
                    <div class="property-section-title">破冰設定</div>
                    <div class="form-group">
                        <label class="form-label">標題</label>
                        <input type="text" class="form-input" id="icebreakerTitle" value="${(elementData.icebreakerTitle || '🎉 歡迎來到課堂！').replace(/"/g, '&quot;')}" placeholder="🎉 歡迎來到課堂！">
                    </div>
                    <div class="form-group">
                        <label class="form-label">副標題</label>
                        <input type="text" class="form-input" id="icebreakerSubtitle" value="${(elementData.icebreakerSubtitle || '看看誰已經上線了？').replace(/"/g, '&quot;')}" placeholder="看看誰已經上線了？">
                    </div>
                </div>
            `;
        }

        // 課前/課後評量元件
        if (type === 'assessment') {
            const aType = elementData.assessmentType || 'pre';
            const questions = elementData.questions || [];
            const qListHtml = questions.map((q, i) => {
                const isChoice = q.type !== 'truefalse';
                const diffLabels = ['', '易', '中', '難'];
                return `
                    <div class="assess-q-item" data-idx="${i}" style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;">
                        <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
                            <span style="font-size:11px;font-weight:700;color:#64748b;width:24px;">${i + 1}</span>
                            <span style="font-size:10px;padding:1px 5px;border-radius:3px;background:${isChoice ? '#dbeafe' : '#fef3c7'};color:${isChoice ? '#1e40af' : '#92400e'}">${isChoice ? '選擇' : '是非'}</span>
                            <span style="font-size:10px;padding:1px 5px;border-radius:3px;background:#f1f5f9;color:#64748b;">${diffLabels[q.difficulty] || '中'}</span>
                            ${q.concept ? `<span style="font-size:10px;padding:1px 5px;border-radius:3px;background:#ecfdf5;color:#059669;">${q.concept}</span>` : ''}
                            <button class="assess-q-del" data-idx="${i}" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#ef4444;font-size:12px;" title="刪除">✕</button>
                        </div>
                        <input class="form-input assess-q-text" data-idx="${i}" value="${(q.question || '').replace(/"/g, '&quot;')}" placeholder="題目" style="font-size:12px;margin-bottom:4px;">
                        ${isChoice ? (q.options || []).map((opt, j) => {
                            const optText = typeof opt === 'string' ? opt : opt.text || '';
                            return `<div style="display:flex;gap:4px;align-items:center;margin-bottom:2px;">
                                <span style="font-size:11px;color:${j === q.answer ? '#10b981' : '#94a3b8'};font-weight:700;width:16px;">${'ABCD'[j]}</span>
                                <input class="form-input assess-opt" data-idx="${i}" data-opt="${j}" value="${optText.replace(/"/g, '&quot;')}" style="flex:1;font-size:11px;padding:3px 6px;">
                                <input type="radio" name="assess-ans-${i}" data-idx="${i}" data-opt="${j}" class="assess-ans-radio" ${j === q.answer ? 'checked' : ''} style="cursor:pointer;" title="正確答案">
                            </div>`;
                        }).join('') : `
                            <div style="display:flex;gap:8px;align-items:center;">
                                <label style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:3px;">
                                    <input type="radio" name="assess-tf-${i}" data-idx="${i}" class="assess-tf-radio" value="true" ${q.answer === true ? 'checked' : ''}> 正確
                                </label>
                                <label style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:3px;">
                                    <input type="radio" name="assess-tf-${i}" data-idx="${i}" class="assess-tf-radio" value="false" ${q.answer === false ? 'checked' : ''}> 錯誤
                                </label>
                            </div>
                        `}
                    </div>
                `;
            }).join('');

            html += `
                <div class="property-section">
                    <div class="property-section-title">評量設定</div>
                    <div class="form-group">
                        <label class="form-label">標題</label>
                        <input type="text" class="form-input" id="assessmentTitle" value="${(elementData.title || '').replace(/"/g, '&quot;')}" placeholder="📝 課前測驗">
                    </div>
                    <div class="form-group">
                        <label class="form-label">類型</label>
                        <select id="assessmentType" style="width:100%;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;">
                            <option value="pre" ${aType === 'pre' ? 'selected' : ''}>課前測驗</option>
                            <option value="post" ${aType === 'post' ? 'selected' : ''}>課後測驗</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">計分（滿分）</label>
                        <input type="number" class="form-input" id="assessmentPoints" value="${elementData.points ?? 15}" min="1" max="100" style="width:80px;">
                    </div>
                </div>
                <div class="property-section">
                    <div class="property-section-title">題目 (${questions.length})</div>
                    <div id="assessQList" style="max-height:360px;overflow-y:auto;">${qListHtml}</div>
                    <div style="display:flex;gap:6px;margin-top:6px;">
                        <button id="assessAddChoice" style="flex:1;padding:5px;border:1.5px dashed #cbd5e1;border-radius:6px;background:none;color:#64748b;cursor:pointer;font-size:11px;">+ 選擇題</button>
                        <button id="assessAddTF" style="flex:1;padding:5px;border:1.5px dashed #cbd5e1;border-radius:6px;background:none;color:#64748b;cursor:pointer;font-size:11px;">+ 是非題</button>
                    </div>
                    <button id="assessAIGenerate" style="width:100%;margin-top:8px;padding:8px;border:none;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:white;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;">
                        <span class="material-symbols-outlined" style="font-size:16px;">auto_awesome</span>
                        AI 生成 15 題
                    </button>
                    <div id="assessAIStatus" style="font-size:11px;color:#64748b;margin-top:4px;text-align:center;"></div>
                </div>
                <div class="property-section">
                    <div class="property-section-title">題組管理</div>
                    <div style="display:flex;gap:6px;">
                        <button id="assessExportBtn" style="flex:1;padding:6px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;color:#475569;cursor:pointer;font-size:11px;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:4px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">content_copy</span> 匯出題組
                        </button>
                        <button id="assessImportBtn" style="flex:1;padding:6px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;color:#475569;cursor:pointer;font-size:11px;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:4px;">
                            <span class="material-symbols-outlined" style="font-size:14px;">content_paste</span> 貼上題組
                        </button>
                    </div>
                    <button id="assessImportProjectBtn" style="width:100%;margin-top:6px;padding:6px;border:1px solid #dbeafe;border-radius:6px;background:#eff6ff;color:#1d4ed8;cursor:pointer;font-size:11px;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:14px;">folder_open</span> 從其他專案匯入
                    </button>
                    <div id="assessImportStatus" style="font-size:11px;color:#64748b;margin-top:4px;text-align:center;"></div>
                </div>
            `;
        }

        // 圖表元件
        if (type === 'chart') {
            const CHART_COLORS = ['#3b82f6', '#4285f4', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
            html += `
                <div class="property-section">
                    <div class="property-section-title">圖表設定</div>
                    <div class="property-row">
                        <label>類型</label>
                        <select id="chartType" style="flex:1;padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;">
                            <option value="bar" ${(elementData.chartType || 'bar') === 'bar' ? 'selected' : ''}>長條圖</option>
                            <option value="horizontal-bar" ${elementData.chartType === 'horizontal-bar' ? 'selected' : ''}>橫條圖</option>
                            <option value="donut" ${elementData.chartType === 'donut' ? 'selected' : ''}>環形圖</option>
                        </select>
                    </div>
                    <div class="property-row">
                        <label>標題</label>
                        <input type="text" id="chartTitle" value="${elementData.chartTitle || ''}" placeholder="圖表標題">
                    </div>
                </div>
                <div class="property-section">
                    <div class="property-section-title">數據</div>
                    <div id="chartDataList" style="display:flex;flex-direction:column;gap:4px;">
                        ${(elementData.chartData || []).map((d, i) => `
                            <div class="chart-data-row" data-index="${i}" style="display:flex;gap:4px;align-items:center;">
                                <input type="color" class="cd-color" value="${d.color || CHART_COLORS[i % 8]}" style="width:24px;height:24px;border:none;padding:0;cursor:pointer;">
                                <input type="text" class="cd-label" value="${d.label}" placeholder="標籤" style="flex:1;padding:3px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;">
                                <input type="number" class="cd-value" value="${d.value}" style="width:60px;padding:3px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;">
                                <button class="cd-remove" style="width:20px;height:20px;border:none;background:none;cursor:pointer;color:#ef4444;font-size:14px;padding:0;">✕</button>
                            </div>
                        `).join('')}
                    </div>
                    <button id="addChartData" style="margin-top:6px;width:100%;padding:5px;border:1px dashed #d1d5db;border-radius:6px;background:none;cursor:pointer;color:#2563eb;font-size:12px;font-weight:600;">+ 新增數據</button>
                </div>
            `;
        }

        // 互動元件專屬
        const interactiveTypes = ['matching', 'fillblank', 'ordering', 'quiz', 'poll', 'truefalse', 'opentext', 'scale', 'buzzer', 'wordcloud', 'hotspot'];
        if (type === 'matching') {
            html += this.renderMatchingProperties(elementData);
        } else if (type === 'fillblank') {
            html += this.renderFillBlankProperties(elementData);
        } else if (type === 'ordering') {
            html += this.renderOrderingProperties(elementData);
        } else if (type === 'quiz') {
            html += this.renderQuizProperties(elementData);
        } else if (type === 'poll') {
            html += this.renderPollProperties(elementData);
        } else if (type === 'copycard') {
            html += this.renderCopyCardProperties(elementData);
        } else if (type === 'document') {
            const anchors = elementData.docAnchors || [];
            const anchorsHtml = anchors.map((a, i) => `
                <div class="doc-anchor-row" data-idx="${i}" style="display:flex;gap:6px;align-items:center;padding:6px 8px;background:${a.isError ? '#fef2f2' : '#f0fdf4'};border-radius:6px;border:1px solid ${a.isError ? '#fecaca' : '#bbf7d0'};">
                    <span style="font-size:11px;font-weight:700;color:${a.isError ? '#dc2626' : '#16a34a'};min-width:16px;">${i + 1}</span>
                    <input type="text" class="doc-anchor-text" value="${(a.text || '').replace(/"/g, '&quot;')}" placeholder="段落描述..."
                        style="flex:1;padding:3px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;background:white;">
                    <label style="display:flex;align-items:center;gap:3px;font-size:11px;color:#dc2626;white-space:nowrap;cursor:pointer;">
                        <input type="checkbox" class="doc-anchor-error" ${a.isError ? 'checked' : ''}> 錯誤
                    </label>
                    <button class="doc-anchor-del" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;" title="刪除">✕</button>
                </div>
            `).join('');

            const contentPreview = (elementData.docContent || '').substring(0, 60);

            html += `
                <div class="property-section">
                    <div class="property-section-title">文件檢視器設定</div>
                    <div class="form-group">
                        <label class="form-label">文件標題</label>
                        <input type="text" class="form-input" id="docTitle" value="${(elementData.docTitle || '').replace(/"/g, '&quot;')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">文件內容</label>
                        <div style="font-size:11px;color:#64748b;padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;min-height:32px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                            ${contentPreview ? contentPreview + '...' : '<span style="color:#94a3b8;">尚未輸入內容</span>'}
                        </div>
                        <button id="docOpenEditor" style="margin-top:6px;width:100%;padding:8px;border:1px solid #0284c7;border-radius:6px;background:#eff6ff;color:#0284c7;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;">
                            <span class="material-symbols-outlined" style="font-size:16px;">edit_note</span>
                            展開編輯器
                        </button>
                    </div>
                </div>

                <div class="property-section">
                    <div class="property-section-title" style="display:flex;align-items:center;gap:6px;">
                        <span class="material-symbols-outlined" style="font-size:16px;color:#f59e0b;">flag</span>
                        錨點（找錯練習）
                    </div>
                    <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;line-height:1.4;">
                        設定文件中的段落，標記哪些為「錯誤」。學員閱讀後勾選認為有錯的段落。
                    </div>
                    <div id="docAnchorsList" style="display:flex;flex-direction:column;gap:4px;">
                        ${anchorsHtml}
                    </div>
                    <button id="addDocAnchor" style="margin-top:6px;padding:6px;border:1px dashed #d1d5db;border-radius:6px;background:transparent;color:#64748b;cursor:pointer;font-size:12px;width:100%;transition:all .15s;">
                        + 新增錨點
                    </button>
                </div>
            `;
        } else if (type === 'showcase') {
            html += this.renderShowcaseProperties(elementData);
        } else if (type === 'truefalse') {
            const tl = elementData.trueLabel || '對';
            const fl = elementData.falseLabel || '錯';
            html += `
                <div class="property-section">
                    <div class="property-section-title">是非題設定</div>
                    <div class="form-group">
                        <label class="form-label">題目</label>
                        <input type="text" class="form-input" id="tfQuestion" value="${elementData.question || ''}">
                    </div>
                    <div class="property-row">
                        <label>選項 A 文字</label>
                        <input type="text" class="form-input" id="tfTrueLabel" value="${tl}" style="flex:1;" placeholder="對">
                    </div>
                    <div class="property-row">
                        <label>選項 B 文字</label>
                        <input type="text" class="form-input" id="tfFalseLabel" value="${fl}" style="flex:1;" placeholder="錯">
                    </div>
                    <div class="property-row">
                        <label>正確答案</label>
                        <select id="tfAnswer" style="flex:1;padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;">
                            <option value="true" ${elementData.answer ? 'selected' : ''}>${tl}</option>
                            <option value="false" ${!elementData.answer ? 'selected' : ''}>${fl}</option>
                        </select>
                    </div>
                    <div class="property-row">
                        <label>文字對齊</label>
                        <select id="tfTextAlign" style="flex:1;padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;">
                            <option value="center" ${(elementData.tfTextAlign || 'center') === 'center' ? 'selected' : ''}>置中</option>
                            <option value="left" ${elementData.tfTextAlign === 'left' ? 'selected' : ''}>靠左</option>
                        </select>
                    </div>
                    <div class="property-row">
                        <label>行高</label>
                        <input type="range" id="tfLineHeight" min="1" max="2.5" step="0.1" value="${elementData.tfLineHeight || 1.4}" style="flex:1;">
                        <span style="font-size:11px;color:#64748b;min-width:28px;text-align:right;">${elementData.tfLineHeight || 1.4}</span>
                    </div>
                </div>
            `;
        } else if (type === 'opentext') {
            html += `
                <div class="property-section">
                    <div class="property-section-title">開放問答設定</div>
                    <div class="form-group">
                        <label class="form-label">題目</label>
                        <input type="text" class="form-input" id="otQuestion" value="${elementData.question || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">提示文字</label>
                        <input type="text" class="form-input" id="otPlaceholder" value="${elementData.placeholder || ''}">
                    </div>
                    <div class="property-row">
                        <label>字數上限</label>
                        <input type="number" id="otMaxLength" value="${elementData.maxLength || 500}" min="50" step="50">
                    </div>
                </div>
            `;
        } else if (type === 'scale') {
            html += `
                <div class="property-section">
                    <div class="property-section-title">量表設定</div>
                    <div class="form-group">
                        <label class="form-label">題目</label>
                        <input type="text" class="form-input" id="scaleQuestion" value="${elementData.question || ''}">
                    </div>
                    <div class="property-row">
                        <label>最小值</label>
                        <input type="number" id="scaleMin" value="${elementData.min || 1}">
                    </div>
                    <div class="property-row">
                        <label>最大值</label>
                        <input type="number" id="scaleMax" value="${elementData.max || 10}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">左端標籤</label>
                        <input type="text" class="form-input" id="scaleLabelLeft" value="${elementData.labelLeft || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">右端標籤</label>
                        <input type="text" class="form-input" id="scaleLabelRight" value="${elementData.labelRight || ''}">
                    </div>
                </div>
            `;
        } else if (type === 'buzzer') {
            html += `
                <div class="property-section">
                    <div class="property-section-title">搶答設定</div>
                    <div class="form-group">
                        <label class="form-label">題目</label>
                        <input type="text" class="form-input" id="buzzerQuestion" value="${elementData.question || ''}">
                    </div>
                </div>
            `;
        } else if (type === 'wordcloud') {
            html += `
                <div class="property-section">
                    <div class="property-section-title">文字雲設定</div>
                    <div class="form-group">
                        <label class="form-label">題目</label>
                        <input type="text" class="form-input" id="wcQuestion" value="${elementData.question || ''}">
                    </div>
                    <div class="property-row">
                        <label>每人最多字數</label>
                        <input type="number" id="wcMaxWords" value="${elementData.maxWords || 3}" min="1" max="10">
                    </div>
                </div>
            `;
        } else if (type === 'hotspot') {
            const nodes = elementData.nodes || [];
            const nodesListHtml = nodes.map((n, i) => `
                <div class="hs-node-row" data-idx="${i}">
                    <span class="hs-node-label">${n.label}</span>
                    <label class="hs-node-correct-label">
                        <input type="checkbox" class="hs-node-correct" ${n.isCorrect ? 'checked' : ''}>
                        有問題
                    </label>
                    <button class="hs-node-delete" title="刪除">✕</button>
                </div>
            `).join('');
            html += `
                <div class="property-section">
                    <div class="property-section-title">圖片標註設定</div>
                    <div class="form-group">
                        <label class="form-label">題目</label>
                        <input type="text" class="form-input" id="hsQuestion" value="${elementData.question || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">圖片 URL</label>
                        <input type="text" class="form-input" id="hsImage" value="${elementData.image || ''}" placeholder="https://...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">節點（點擊預覽圖新增）</label>
                        <div class="hs-preview-wrap" id="hsPreviewWrap" style="position:relative;width:100%;aspect-ratio:3/2;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;cursor:crosshair;">
                            ${elementData.image ? '<img src="' + elementData.image + '" style="width:100%;height:100%;object-fit:contain;">' : '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#94a3b8;font-size:13px;">請先輸入圖片 URL</span>'}
                            ${nodes.map(n => '<div class="hs-preview-node" style="position:absolute;left:' + n.x + '%;top:' + n.y + '%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:' + (n.isCorrect ? '#10b981' : '#1a73e8') + ';color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">' + n.label + '</div>').join('')}
                        </div>
                    </div>
                    <div class="hs-nodes-list" id="hsNodesList">${nodesListHtml}</div>
                    ${nodes.length > 0 ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px;">綠色 = 正確答案（有問題的地方）</div>' : ''}
                </div>
            `;
        }

        // ── 統一計分設定（所有可計分互動元件） ──
        const scorableTypes = ['quiz', 'truefalse', 'buzzer', 'matching', 'fillblank', 'ordering', 'hotspot', 'poll', 'opentext', 'scale', 'wordcloud', 'copycard', 'document'];
        if (scorableTypes.includes(type)) {
            const defaultPoints = { quiz: 5, truefalse: 5, buzzer: 10, matching: 10, fillblank: 10, ordering: 10, hotspot: 5, poll: 1, opentext: 1, scale: 1, wordcloud: 1, copycard: 1, document: 5 };
            const pts = elementData.points ?? defaultPoints[type] ?? 1;
            const hasCorrect = ['quiz', 'truefalse', 'buzzer', 'matching', 'fillblank', 'ordering', 'hotspot', 'document'].includes(type);
            html += `
                <div class="property-section">
                    <div class="property-section-title" style="display:flex;align-items:center;gap:6px;">
                        <span class="material-symbols-outlined" style="font-size:16px;color:#f59e0b;">emoji_events</span>
                        計分設定
                    </div>
                    <div class="property-row">
                        <label>分數</label>
                        <input type="number" id="elementPoints" value="${pts}" min="0" max="100" step="1"
                            style="width:60px;text-align:center;">
                        <span style="font-size:12px;color:#94a3b8;">分</span>
                    </div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:4px;line-height:1.5;">
                        ${hasCorrect ? '答對得設定分數，答錯 0 分。部分正確依比例計算。' : '學員參與互動即得分。'}
                    </div>
                </div>
            `;
        }

        // 流動線條屬性面板
        if (type === 'flowline') {
            html += `
                <div class="property-section">
                    <div class="property-section-title">路徑預設形狀</div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;">
                        <button class="flow-shape-preset" data-shape="wave" style="flex:1;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:11px;font-family:inherit;">〰️ 波浪</button>
                        <button class="flow-shape-preset" data-shape="ellipse" style="flex:1;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:11px;font-family:inherit;">⭕ 橢圓</button>
                        <button class="flow-shape-preset" data-shape="rectangle" style="flex:1;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:11px;font-family:inherit;">⬜ 方形</button>
                        <button class="flow-shape-preset" data-shape="triangle" style="flex:1;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:11px;font-family:inherit;">🔺 三角</button>
                        <button class="flow-shape-preset" data-shape="zigzag" style="flex:1;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:11px;font-family:inherit;">⚡ 鋸齒</button>
                    </div>
                </div>
                <div class="property-section">
                    <div class="property-section-title">線條樣式</div>
                    <div class="property-row">
                        <label>線條色</label>
                        <input type="color" id="flowLineColor" value="${elementData.lineColor || '#1a73e8'}">
                    </div>
                    <div class="property-row">
                        <label>光暈色</label>
                        <input type="color" id="flowGlowColor" value="${elementData.glowColor || '#4285f4'}">
                    </div>
                    <div class="property-row">
                        <label>線寬</label>
                        <input type="range" id="flowLineWidth" value="${elementData.lineWidth || 3}" min="1" max="8" step="1" style="flex:1;">
                        <span id="flowLineWidthVal" style="font-size:12px;min-width:20px;text-align:center;">${elementData.lineWidth || 3}</span>
                    </div>
                    <div class="property-row">
                        <label>箭頭</label>
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1;">
                            <input type="checkbox" id="flowShowArrow" ${elementData.showArrow ? 'checked' : ''} style="accent-color:#1a73e8;">
                            <span style="font-size:12px;">顯示箭頭</span>
                        </label>
                    </div>
                    <div class="property-row">
                        <label>線型</label>
                        <select id="flowCurveMode" style="flex:1;padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;">
                            <option value="curved" ${(elementData.curveMode || 'curved') === 'curved' ? 'selected' : ''}>曲線</option>
                            <option value="straight" ${elementData.curveMode === 'straight' ? 'selected' : ''}>直線</option>
                        </select>
                    </div>
                </div>
                <div class="property-section">
                    <div class="property-section-title">流動效果</div>
                    <div class="property-row">
                        <label>流速</label>
                        <input type="range" id="flowSpeed" value="${elementData.flowSpeed || 2}" min="1" max="5" step="1" style="flex:1;">
                        <span id="flowSpeedVal" style="font-size:12px;min-width:20px;text-align:center;">${elementData.flowSpeed || 2}</span>
                    </div>
                    <div class="property-row">
                        <label>方向</label>
                        <select id="flowDirection" style="flex:1;padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;">
                            <option value="1" ${(elementData.flowDirection || 1) === 1 ? 'selected' : ''}>正向 →</option>
                            <option value="-1" ${elementData.flowDirection === -1 ? 'selected' : ''}>反向 ←</option>
                        </select>
                    </div>
                    <div class="property-row">
                        <label>粒子數</label>
                        <input type="range" id="flowParticleCount" value="${elementData.particleCount || 3}" min="1" max="6" step="1" style="flex:1;">
                        <span id="flowParticleCountVal" style="font-size:12px;min-width:20px;text-align:center;">${elementData.particleCount || 3}</span>
                    </div>
                </div>
                <div class="property-section">
                    <div class="property-section-title">路徑控制</div>
                    <div style="font-size:11px;color:#64748b;line-height:1.6;">
                        <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">info</span>
                        選取流動線後，拖曳<b style="color:#1a73e8;">紫色圓點</b>即可調整路徑。端點靠近其他元素時會自動吸附。
                    </div>
                    ${elementData.snapStartId || elementData.snapEndId ? `<div style="margin-top:6px;font-size:11px;color:#10b981;">✓ 已吸附元素，拖曳元素時線條會跟隨</div>` : ''}
                </div>
            `;
        }

        // 外觀設定（所有互動元件通用）
        if (interactiveTypes.includes(type)) {
            html += `
                <div class="property-section">
                    <div class="property-section-title">外觀設定</div>
                    <div class="property-row">
                        <label>標題字級</label>
                        <input type="number" id="propTitleFontSize" value="${elementData.titleFontSize || 18}" min="10" max="48" step="1">
                    </div>
                    <div class="property-row">
                        <label>選項字級</label>
                        <input type="number" id="propOptionFontSize" value="${elementData.optionFontSize || 15}" min="10" max="36" step="1">
                    </div>
                    <div class="property-row">
                        <label>內距</label>
                        <input type="range" id="propInteractivePadding" value="${elementData.interactivePadding || 16}" min="4" max="40" step="2" style="flex:1;">
                        <span style="font-size:11px;color:#94a3b8;min-width:30px;text-align:right;">${elementData.interactivePadding || 16}px</span>
                    </div>
                </div>
            `;
        }

        // 倒數計時器（所有互動元件通用）
        if (interactiveTypes.includes(type)) {
            html += `
                <div class="property-section">
                    <div class="property-section-title">倒數計時</div>
                    <div class="property-row">
                        <label>秒數（0=不計時）</label>
                        <input type="number" id="propTimeLimit" value="${elementData.timeLimit || 0}" min="0" step="5">
                    </div>
                </div>
            `;
        }

        // 圖層與刪除
        html += `
            <div class="property-section">
                <div class="property-section-title">圖層</div>
                <div class="layer-buttons">
                    <button class="layer-btn" id="layerUp">↑ 上移</button>
                    <button class="layer-btn" id="layerDown">↓ 下移</button>
                </div>
            </div>
            <button class="delete-element-btn" id="deleteElement">刪除元素</button>
        `;

        this.propertyContentEl.innerHTML = html;
        this.bindPropertyEvents(element, elementData);
    }

    /**
     * 渲染連連看屬性
     */
    renderMatchingProperties(elementData) {
        return `
            <div class="property-section">
                <div class="property-section-title">配對項目</div>
                <div class="pair-list" id="pairList">
                    ${(elementData.pairs || []).map((pair, i) => `
                        <div class="pair-item" data-index="${i}">
                            <input type="text" class="pair-left" value="${pair.left}" placeholder="左側">
                            <span class="pair-arrow">↔</span>
                            <input type="text" class="pair-right" value="${pair.right}" placeholder="右側">
                            <button class="remove-pair">✕</button>
                        </div>
                    `).join('')}
                </div>
                <button class="add-pair-btn" id="addPair">+ 新增配對</button>
            </div>
        `;
    }

    /**
     * 渲染填空題屬性
     */
    renderFillBlankProperties(elementData) {
        return `
            <div class="property-section">
                <div class="property-section-title">填空題設定</div>
                <div class="form-group">
                    <label class="form-label">標題</label>
                    <input type="text" class="form-input" id="blankTitle" value="${elementData.title || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">內容 (用 ___N___ 標記空格)</label>
                    <textarea class="form-input" id="blankContent" rows="3">${elementData.content || ''}</textarea>
                </div>
                <div class="property-section-title">答案設定</div>
                <div class="blank-list" id="blankList">
                    ${(elementData.blanks || []).map((blank, i) => `
                        <div class="blank-item" data-index="${i}">
                            <div class="blank-number">${i + 1}</div>
                            <input type="text" class="blank-answer" value="${blank.answer}" placeholder="正確答案">
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * 渲染複製卡片屬性
     */
    renderCopyCardProperties(elementData) {
        // 提取目前的變數
        const vars = [];
        const regex = /\{\{([^}]+)\}\}/g;
        let m;
        while ((m = regex.exec(elementData.content || '')) !== null) {
            if (!vars.includes(m[1])) vars.push(m[1]);
        }
        const varsHtml = vars.length > 0
            ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">${vars.map(v => `<span style="display:inline-flex;align-items:center;gap:2px;padding:2px 8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;font-size:11px;color:#1d4ed8;">⬡ ${v}</span>`).join('')}</div>`
            : '';

        return `
            <div class="property-section">
                <div class="property-section-title">複製卡片設定</div>
                <div class="form-group">
                    <label class="form-label">標題</label>
                    <input type="text" class="form-input" id="copyCardTitle" value="${(elementData.title || '點擊複製').replace(/"/g, '&quot;')}">
                </div>
                <div class="form-group">
                    <label class="form-label">要複製的文字內容</label>
                    <textarea class="form-input" id="copyCardContent" rows="5" placeholder="請輸入讓學生複製的內容...">${elementData.content || ''}</textarea>
                    <div style="margin-top:8px;padding:10px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;">
                        <div style="font-size:0.78rem;font-weight:600;color:#0369a1;margin-bottom:4px;">💡 變數功能</div>
                        <div style="font-size:0.72rem;color:#0c4a6e;line-height:1.6;">
                            用 <code style="background:#e0f2fe;padding:1px 4px;border-radius:3px;font-size:11px;">\{\{變數名\}\}</code> 建立可填寫欄位。<br>
                            例如：<code style="background:#e0f2fe;padding:1px 4px;border-radius:3px;font-size:11px;">我是\{\{職業\}\}，專長是\{\{技能\}\}</code><br>
                            學員需填完所有變數才能複製。
                        </div>
                        ${varsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 綁定屬性面板事件
     */
    bindPropertyEvents(element, elementData) {
        const elementId = element.dataset.id;

        // 位置大小
        ['propX', 'propY', 'propW', 'propH'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => {
                    const updates = {
                        x: parseInt(document.getElementById('propX').value),
                        y: parseInt(document.getElementById('propY').value),
                        width: parseInt(document.getElementById('propW').value),
                        height: parseInt(document.getElementById('propH').value)
                    };
                    this.slideManager.updateElement(elementId, updates);
                    element.style.left = `${updates.x}px`;
                    element.style.top = `${updates.y}px`;
                    element.style.width = `${updates.width}px`;
                    element.style.height = `${updates.height}px`;
                });
            }
        });

        // 文字樣式
        const fontSizeInput = document.getElementById('propFontSize');
        if (fontSizeInput) {
            fontSizeInput.addEventListener('change', () => {
                const fontSize = parseInt(fontSizeInput.value);
                this.slideManager.updateElement(elementId, { fontSize });
                element.style.fontSize = `${fontSize}px`;
            });
        }

        const colorInput = document.getElementById('propColor');
        if (colorInput) {
            colorInput.addEventListener('change', () => {
                const color = colorInput.value;
                this.slideManager.updateElement(elementId, { color });
                element.style.color = color;
            });
        }

        // 粗體/斜體/底線
        ['propBold', 'propItalic', 'propUnderline'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    btn.classList.toggle('active');
                    const updates = {};
                    if (id === 'propBold') {
                        updates.bold = btn.classList.contains('active');
                        element.style.fontWeight = updates.bold ? 'bold' : 'normal';
                    } else if (id === 'propItalic') {
                        updates.italic = btn.classList.contains('active');
                        element.style.fontStyle = updates.italic ? 'italic' : 'normal';
                    } else if (id === 'propUnderline') {
                        updates.underline = btn.classList.contains('active');
                        element.style.textDecoration = updates.underline ? 'underline' : 'none';
                    }
                    this.slideManager.updateElement(elementId, updates);
                });
            }
        });

        // 圖層
        const layerUp = document.getElementById('layerUp');
        const layerDown = document.getElementById('layerDown');
        if (layerUp) {
            layerUp.addEventListener('click', () => {
                this.slideManager.moveElementLayer(elementId, 'up');
                this.selectElementById(elementId);
            });
        }
        if (layerDown) {
            layerDown.addEventListener('click', () => {
                this.slideManager.moveElementLayer(elementId, 'down');
                this.selectElementById(elementId);
            });
        }

        // 刪除
        const deleteBtn = document.getElementById('deleteElement');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.slideManager.deleteElement(elementId);
                this.deselectAll();
            });
        }

        // 圖表事件
        const chartTypeSelect = document.getElementById('chartType');
        if (chartTypeSelect) {
            chartTypeSelect.addEventListener('change', () => {
                this.slideManager.updateElement(elementId, { chartType: chartTypeSelect.value });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        }
        const chartTitleInput = document.getElementById('chartTitle');
        if (chartTitleInput) {
            chartTitleInput.addEventListener('change', () => {
                this.slideManager.updateElement(elementId, { chartTitle: chartTitleInput.value });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        }
        document.querySelectorAll('.chart-data-row').forEach(row => {
            const i = parseInt(row.dataset.index);
            const update = () => {
                const data = [...(elementData.chartData || [])];
                data[i] = {
                    label: row.querySelector('.cd-label').value,
                    value: parseFloat(row.querySelector('.cd-value').value) || 0,
                    color: row.querySelector('.cd-color').value
                };
                this.slideManager.updateElement(elementId, { chartData: data });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            };
            row.querySelector('.cd-label')?.addEventListener('change', update);
            row.querySelector('.cd-value')?.addEventListener('change', update);
            row.querySelector('.cd-color')?.addEventListener('input', update);
            row.querySelector('.cd-remove')?.addEventListener('click', () => {
                const data = [...(elementData.chartData || [])];
                data.splice(i, 1);
                this.slideManager.updateElement(elementId, { chartData: data });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        });
        const addChartBtn = document.getElementById('addChartData');
        if (addChartBtn) {
            addChartBtn.addEventListener('click', () => {
                const COLORS = ['#3b82f6', '#4285f4', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
                const data = [...(elementData.chartData || [])];
                data.push({ label: `項目 ${data.length + 1}`, value: 50, color: COLORS[data.length % 8] });
                this.slideManager.updateElement(elementId, { chartData: data });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        }

        // 圖片遮色片事件
        document.querySelectorAll('.clip-mask-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const clipPath = btn.dataset.clip;
                this.slideManager.updateElement(elementId, { clipPath: clipPath === 'none' ? null : clipPath });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        });

        // Icon 顏色變更事件
        const iconColorInput = document.getElementById('propIconColor');
        if (iconColorInput && elementData.iconName) {
            iconColorInput.addEventListener('change', async () => {
                const newColor = iconColorInput.value;
                const iconName = elementData.iconName;
                const size = Math.max(elementData.width, elementData.height) || 80;
                try {
                    const svgUrl = `https://api.iconify.design/${iconName}.svg?color=${encodeURIComponent(newColor)}&width=${size}&height=${size}`;
                    const res = await fetch(svgUrl);
                    const svgText = await res.text();
                    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
                    this.slideManager.updateElement(elementId, { src: dataUrl, iconColor: newColor });
                    // 更新 DOM 中的 img
                    const imgEl = element.querySelector('img');
                    if (imgEl) imgEl.src = dataUrl;
                    this.slideManager.renderThumbnails();
                } catch (err) {
                    console.error('[IconColor] update error:', err);
                }
            });
        }

        // Shape 填色事件
        document.querySelectorAll('.shape-fill-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const fill = swatch.dataset.fill;
                this.slideManager.updateElement(elementId, { background: fill });
                element.style.background = fill;
                this.showPropertyPanel(element); // 刷新面板高亮
            });
        });
        const shapeFillInput = document.getElementById('propShapeFill');
        if (shapeFillInput) {
            shapeFillInput.addEventListener('input', () => {
                this.slideManager.updateElement(elementId, { background: shapeFillInput.value });
                element.style.background = shapeFillInput.value;
            });
        }
        const borderRadiusInput = document.getElementById('propBorderRadius');
        if (borderRadiusInput) {
            borderRadiusInput.addEventListener('change', () => {
                const r = parseInt(borderRadiusInput.value) || 0;
                this.slideManager.updateElement(elementId, { borderRadius: r });
                element.style.borderRadius = `${r}px`;
            });
        }
        const opacityInput = document.getElementById('propOpacity');
        if (opacityInput) {
            opacityInput.addEventListener('input', () => {
                const o = parseInt(opacityInput.value) / 100;
                this.slideManager.updateElement(elementId, { opacity: o });
                element.style.opacity = o;
            });
        }

        // 連連看配對事件
        this.bindMatchingEvents(elementId, elementData);

        // 填空題事件
        this.bindFillBlankEvents(elementId, elementData);

        // 排列順序事件
        this.bindOrderingEvents(elementId, elementData);

        // 複製卡片事件
        this.bindCopyCardEvents(elementId, elementData);

        // 選擇題事件
        this.bindQuizEvents(elementId, elementData);

        // 投票事件
        this.bindPollEvents(elementId, elementData);

        // 展示牆事件
        if (elementData.type === 'showcase') {
            this.bindShowcaseEvents(elementId, elementData, element);
        }

        // 新互動類型屬性綁定
        const rerender = () => { this.slideManager.renderCurrentSlide(); this.selectElementById(elementId); };
        const bindSimple = (inputId, key, parse) => {
            const el = document.getElementById(inputId);
            if (el) el.addEventListener('change', () => {
                this.slideManager.updateElement(elementId, { [key]: parse ? parse(el.value) : el.value });
                rerender();
            });
        };

        // 統一計分 points 綁定
        bindSimple('elementPoints', 'points', v => parseInt(v) || 0);
        if (elementData.type === 'truefalse') {
            bindSimple('tfQuestion', 'question');
            bindSimple('tfAnswer', 'answer', v => v === 'true');
            bindSimple('tfTrueLabel', 'trueLabel');
            bindSimple('tfFalseLabel', 'falseLabel');
            bindSimple('tfTextAlign', 'tfTextAlign');
            bindSimple('tfLineHeight', 'tfLineHeight', v => parseFloat(v) || 1.4);
            // 行高 slider 即時回饋
            const lhSlider = document.getElementById('tfLineHeight');
            if (lhSlider) {
                lhSlider.addEventListener('input', () => {
                    const span = lhSlider.nextElementSibling;
                    if (span) span.textContent = lhSlider.value;
                });
            }
        } else if (elementData.type === 'opentext') {
            bindSimple('otQuestion', 'question');
            bindSimple('otPlaceholder', 'placeholder');
            bindSimple('otMaxLength', 'maxLength', v => parseInt(v) || 500);
        } else if (elementData.type === 'scale') {
            bindSimple('scaleQuestion', 'question');
            bindSimple('scaleMin', 'min', v => parseInt(v) || 1);
            bindSimple('scaleMax', 'max', v => parseInt(v) || 10);
            bindSimple('scaleLabelLeft', 'labelLeft');
            bindSimple('scaleLabelRight', 'labelRight');
        } else if (elementData.type === 'buzzer') {
            bindSimple('buzzerQuestion', 'question');
        } else if (elementData.type === 'link') {
            bindSimple('linkUrl', 'linkUrl');
            bindSimple('linkLabel', 'linkLabel');
            bindSimple('linkDesc', 'linkDesc');
            // 顏色選擇
            document.querySelectorAll('.link-color-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    elementData.linkColor = btn.dataset.color;
                    this.slideManager.renderCurrentSlide();
                    this.slideManager.saveCurrentSlide();
                    this.selectElementById(elementId);
                });
            });
            // 圖示選擇
            document.querySelectorAll('.link-icon-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    elementData.linkIcon = btn.dataset.icon;
                    this.slideManager.renderCurrentSlide();
                    this.slideManager.saveCurrentSlide();
                    this.selectElementById(elementId);
                });
            });
            // 預覽圖上傳
            document.getElementById('linkImageUpload')?.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = new Image();
                    img.onload = () => {
                        const MAX = 1200;
                        let w = img.width, h = img.height;
                        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                        const c = document.createElement('canvas');
                        c.width = w; c.height = h;
                        c.getContext('2d').drawImage(img, 0, 0, w, h);
                        elementData.linkImage = c.toDataURL('image/jpeg', 0.88);
                        this.slideManager.renderCurrentSlide();
                        this.slideManager.saveCurrentSlide();
                        this.selectElementById(elementId);
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            });
            // 移除預覽圖
            document.getElementById('linkImageRemove')?.addEventListener('click', () => {
                delete elementData.linkImage;
                this.slideManager.renderCurrentSlide();
                this.slideManager.saveCurrentSlide();
                this.selectElementById(elementId);
            });
        } else if (elementData.type === 'survey') {
            bindSimple('surveyTitle', 'surveyTitle');

            // 感謝頁設定
            const ensureCfg = () => {
                if (!elementData.thankYouConfig) {
                    elementData.thankYouConfig = {
                        sectionTitle: '✨ 修完這堂課，你還可以…',
                        ctaCards: [
                            { title: '數位簡報室・更多課程', desc: '探索更多數位工具與 AI 應用課程', url: 'https://tbr.digital', icon: 'school', color: '#1a73e8' },
                            { title: '企業顧問服務', desc: '內部培訓 ・ 諮詢 ・ 數位工具導入', url: 'https://tbr.digital/consulting', icon: 'handshake', color: '#eab308' },
                            { title: '前往 Threads 分享心得', desc: '標記 @TBR.DIGITAL 讓老師看到你的感受！', url: 'https://www.threads.net/intent/post?text=' + encodeURIComponent('剛上完數位簡報室的課程！收穫滿滿 🎓✨ @TBR.DIGITAL'), icon: 'share', color: '#10b981' }
                        ],
                        farewell: '🙌 歡迎來找老師聊聊天、私下互動\n或是開心地離開教室，回家注意安全！',
                        emailNotice: '我們會在課後兩天內，將這堂課的學習筆記整理寄到你的 Email，請務必留意課後信件 📬'
                    };
                }
                return elementData.thankYouConfig;
            };

            // 區塊標題
            document.getElementById('thankYouSectionTitle')?.addEventListener('change', () => {
                const cfg = ensureCfg();
                cfg.sectionTitle = document.getElementById('thankYouSectionTitle').value;
                this.slideManager.saveCurrentSlide();
            });
            // 告別
            document.getElementById('thankYouFarewell')?.addEventListener('change', () => {
                const cfg = ensureCfg();
                cfg.farewell = document.getElementById('thankYouFarewell').value.replace(/\n/g, '<br>');
                this.slideManager.saveCurrentSlide();
            });
            // Email
            document.getElementById('thankYouEmail')?.addEventListener('change', () => {
                const cfg = ensureCfg();
                cfg.emailNotice = document.getElementById('thankYouEmail').value;
                this.slideManager.saveCurrentSlide();
            });
            // CTA 卡片欄位
            document.querySelectorAll('.survey-cta-title, .survey-cta-desc, .survey-cta-url, .survey-cta-icon, .survey-cta-color').forEach(input => {
                input.addEventListener('change', () => {
                    const cfg = ensureCfg();
                    const idx = parseInt(input.dataset.idx);
                    if (!cfg.ctaCards[idx]) return;
                    if (input.classList.contains('survey-cta-title')) cfg.ctaCards[idx].title = input.value;
                    if (input.classList.contains('survey-cta-desc')) cfg.ctaCards[idx].desc = input.value;
                    if (input.classList.contains('survey-cta-url')) cfg.ctaCards[idx].url = input.value;
                    if (input.classList.contains('survey-cta-icon')) cfg.ctaCards[idx].icon = input.value;
                    if (input.classList.contains('survey-cta-color')) cfg.ctaCards[idx].color = input.value;
                    this.slideManager.saveCurrentSlide();
                });
            });
            // 移除 CTA
            document.querySelectorAll('.survey-cta-remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    const cfg = ensureCfg();
                    const idx = parseInt(btn.dataset.idx);
                    cfg.ctaCards.splice(idx, 1);
                    this.slideManager.saveCurrentSlide();
                    this.slideManager.renderCurrentSlide();
                    this.selectElementById(elementId);
                });
            });
            // 新增 CTA
            document.getElementById('addCtaCardBtn')?.addEventListener('click', () => {
                const cfg = ensureCfg();
                cfg.ctaCards.push({ title: '新連結', desc: '', url: '#', icon: 'link', color: '#1a73e8' });
                this.slideManager.saveCurrentSlide();
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        } else if (elementData.type === 'assessmentWall') {
            bindSimple('wallTitle', 'wallTitle');
            bindSimple('wallType', 'wallType');
        } else if (elementData.type === 'icebreaker') {
            bindSimple('icebreakerTitle', 'icebreakerTitle');
            bindSimple('icebreakerSubtitle', 'icebreakerSubtitle');
        } else if (elementData.type === 'assessment') {
            // 基本欄位
            bindSimple('assessmentTitle', 'title');
            document.getElementById('assessmentType')?.addEventListener('change', () => {
                elementData.assessmentType = document.getElementById('assessmentType').value;
                this.slideManager.renderCurrentSlide();
                this.slideManager.saveCurrentSlide();
                this.selectElementById(elementId);
            });
            document.getElementById('assessmentPoints')?.addEventListener('change', () => {
                elementData.points = parseInt(document.getElementById('assessmentPoints').value) || 15;
                this.slideManager.saveCurrentSlide();
            });

            // 題目內容編輯
            document.querySelectorAll('.assess-q-text').forEach(inp => {
                inp.addEventListener('change', () => {
                    const idx = parseInt(inp.dataset.idx);
                    if (elementData.questions?.[idx]) {
                        elementData.questions[idx].question = inp.value;
                        this.slideManager.saveCurrentSlide();
                    }
                });
            });
            // 選項編輯
            document.querySelectorAll('.assess-opt').forEach(inp => {
                inp.addEventListener('change', () => {
                    const qi = parseInt(inp.dataset.idx);
                    const oi = parseInt(inp.dataset.opt);
                    if (elementData.questions?.[qi]) {
                        const q = elementData.questions[qi];
                        if (!q.options) q.options = [];
                        if (typeof q.options[oi] === 'string') {
                            q.options[oi] = inp.value;
                        } else if (q.options[oi]) {
                            q.options[oi].text = inp.value;
                        }
                        this.slideManager.saveCurrentSlide();
                    }
                });
            });
            // 正確答案
            document.querySelectorAll('.assess-ans-radio').forEach(radio => {
                radio.addEventListener('change', () => {
                    const qi = parseInt(radio.dataset.idx);
                    const oi = parseInt(radio.dataset.opt);
                    if (elementData.questions?.[qi]) {
                        elementData.questions[qi].answer = oi;
                        this.slideManager.saveCurrentSlide();
                        this.selectElementById(elementId);
                    }
                });
            });
            // 是非題答案
            document.querySelectorAll('.assess-tf-radio').forEach(radio => {
                radio.addEventListener('change', () => {
                    const qi = parseInt(radio.dataset.idx);
                    if (elementData.questions?.[qi]) {
                        elementData.questions[qi].answer = radio.value === 'true';
                        this.slideManager.saveCurrentSlide();
                    }
                });
            });
            // 刪除題目
            document.querySelectorAll('.assess-q-del').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    if (elementData.questions) {
                        elementData.questions.splice(idx, 1);
                        this.slideManager.renderCurrentSlide();
                        this.slideManager.saveCurrentSlide();
                        this.selectElementById(elementId);
                    }
                });
            });
            // 新增選擇題
            document.getElementById('assessAddChoice')?.addEventListener('click', () => {
                if (!elementData.questions) elementData.questions = [];
                const id = 'q' + Date.now().toString(36);
                elementData.questions.push({
                    id, type: 'choice', question: '新選擇題', difficulty: 2, concept: '',
                    options: ['選項 A', '選項 B', '選項 C', '選項 D'], answer: 0
                });
                this.slideManager.renderCurrentSlide();
                this.slideManager.saveCurrentSlide();
                this.selectElementById(elementId);
            });
            // 新增是非題
            document.getElementById('assessAddTF')?.addEventListener('click', () => {
                if (!elementData.questions) elementData.questions = [];
                const id = 'q' + Date.now().toString(36);
                elementData.questions.push({
                    id, type: 'truefalse', question: '新是非題', difficulty: 2, concept: '', answer: true
                });
                this.slideManager.renderCurrentSlide();
                this.slideManager.saveCurrentSlide();
                this.selectElementById(elementId);
            });
            // AI 生成
            document.getElementById('assessAIGenerate')?.addEventListener('click', async () => {
                const btn = document.getElementById('assessAIGenerate');
                const status = document.getElementById('assessAIStatus');
                btn.disabled = true;
                btn.style.opacity = '0.5';
                status.textContent = '⏳ AI 正在根據簡報內容生成題目…';
                status.style.color = '#64748b';

                try {
                    const { ai } = await import('./supabase.js');
                    // 蒐集簡報內容摘要
                    const slides = this.slideManager.slides || [];
                    const slideTexts = slides.map((s, i) => {
                        const texts = (s.elements || [])
                            .filter(e => e.type === 'text' || e.type === 'copycard')
                            .map(e => e.content || e.question || e.title || '')
                            .filter(t => t.length > 2);
                        return texts.length ? `[投影片${i + 1}] ${texts.join(' | ')}` : '';
                    }).filter(Boolean).join('\n');

                    const truncated = slideTexts.slice(0, 4000);
                    const assessType = elementData.assessmentType || 'pre';

                    const prompt = assessType === 'pre'
                        ? `你是一位教學評量設計專家。請根據以下課程資訊，設計 15 題具有「鑑別度」的「課前測驗」。

══ 課程主題 ══
${elementData.title || '未命名課程'}

══ 課程內容參考（僅供了解教學範圍，不可直接從中出題）══
${truncated}

══ 課前測驗設計原則 ══
目的：測量學員「上課前」對該領域的先備知識程度，用來與課後成績對比計算學習成效。
- ⚠️ 不可從簡報細節出題（學員還沒上課），只能根據「課程主題相關的領域通識」出題
- 以該領域的「常見認知」「普遍迷思」「基本概念」為出題依據
- 忽略簡報中與主題無關的內容（例如：計分規則、課程介紹、章節標題、互動操作說明等）

══ 鑑別度設計 ══
- 5 題「易」(difficulty:1)：該領域最基本的常識，不需專業背景也能答對
- 5 題「中」(difficulty:2)：需要對該領域有初步了解才能答對
- 5 題「難」(difficulty:3)：需要有實務經驗或深入學習才能答對，用來鑑別出已有基礎的學員

══ 題型 ══
- 約 10 題選擇題（4 選 1）+ 5 題是非題
- 選擇題要有鑑別度：正確答案不能太明顯，干擾項要合理
- 是非題要設計常見迷思陷阱

══ 回傳格式（純 JSON 陣列）══
[
  {"id":"q1","type":"choice","question":"題目","options":["A","B","C","D"],"answer":0,"difficulty":1,"concept":"知識點"},
  {"id":"q2","type":"truefalse","question":"陳述句","answer":true,"difficulty":2,"concept":"知識點"}
]

注意：
- answer 在選擇題中是正確選項的 index (0-3)
- answer 在是非題中是 true 或 false
- 全部使用繁體中文
- 只回傳 JSON，不加任何額外說明`
                        : `你是一位教學評量設計專家。請根據以下課程簡報內容，設計 15 題具有「鑑別度」的「課後測驗」。

══ 課程主題 ══
${elementData.title || '未命名課程'}

══ 課程簡報內容 ══
${truncated}

══ 課後測驗設計原則 ══
目的：測量學員「上完課後」是否真正掌握了課程內容，並能進一步應用。
- ⚠️ 題目不可與「課前測驗」的先備知識題重複！課前測試的是通識，課後測試的是「有上課才會知道的內容」
- 忽略簡報中與主題無關的內容（例如：計分規則、課程介紹、課堂互動說明、QR Code 操作等）
- 以「該領域的專業內容」為核心，從簡報中提取真正有價值的專業知識

══ 出題比例（重要！）══
1.【50% 簡報內容題】（7-8 題）
   - 直接從簡報中教授的專業知識出題
   - 測試學員是否吸收了課堂上講授的核心觀念、方法、工具、流程
   - 不是照抄簡報文字，而是換個角度考同一個知識點

2.【50% 延伸應用題】（7-8 題）
   - 基於課程主題，設計需要「思考、推理、應用」的題目
   - 包含：跨知識點整合、情境應用題、常見錯誤判斷、進階概念延伸
   - 這些題目的目的是鑑別「真的學會」vs「只是聽過」的學員

══ 鑑別度設計 ══
- 5 題「易」(difficulty:1)：上課有認真聽就能答對
- 5 題「中」(difficulty:2)：需要理解而非死記，能判斷概念間的差異
- 5 題「難」(difficulty:3)：需要融會貫通或能實際應用，用來鑑別出真正掌握的學員

══ 題型 ══
- 約 10 題選擇題（4 選 1）+ 5 題是非題
- 選擇題的干擾項要設計成「常見誤解」而非隨意填充
- 是非題要測試深層理解，避免表面判斷

══ 回傳格式（純 JSON 陣列）══
[
  {"id":"q1","type":"choice","question":"題目","options":["A","B","C","D"],"answer":0,"difficulty":1,"concept":"知識點"},
  {"id":"q2","type":"truefalse","question":"陳述句","answer":true,"difficulty":2,"concept":"知識點"}
]

注意：
- answer 在選擇題中是正確選項的 index (0-3)
- answer 在是非題中是 true 或 false
- 全部使用繁體中文
- 只回傳 JSON，不加任何額外說明`;

                    const result = await ai.chat([
                        { role: 'system', content: '你是教育評量生成器，只回傳 JSON，不加任何額外說明。' },
                        { role: 'user', content: prompt }
                    ], { model: 'claude-haiku-4-5', temperature: 0.7, maxTokens: 6000 });

                    const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
                    const questions = JSON.parse(jsonStr);

                    if (!Array.isArray(questions) || questions.length === 0) {
                        throw new Error('AI 回傳格式不正確');
                    }

                    // 標準化
                    elementData.questions = questions.map((q, i) => ({
                        id: q.id || `q${i + 1}`,
                        type: q.type === 'truefalse' ? 'truefalse' : 'choice',
                        question: q.question || '',
                        options: q.options || [],
                        answer: q.answer ?? 0,
                        difficulty: q.difficulty || 2,
                        concept: q.concept || '',
                    }));

                    this.slideManager.renderCurrentSlide();
                    this.slideManager.saveCurrentSlide();
                    this.selectElementById(elementId);

                    status.textContent = `✅ 已生成 ${questions.length} 題！`;
                    status.style.color = '#16a34a';
                } catch (err) {
                    console.error('Assessment AI generation error:', err);
                    status.textContent = `❌ 生成失敗：${err.message}`;
                    status.style.color = '#dc2626';
                } finally {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            });

            // 匯出題組到剪貼簿
            document.getElementById('assessExportBtn')?.addEventListener('click', async () => {
                const status = document.getElementById('assessImportStatus');
                const qs = elementData.questions || [];
                if (qs.length === 0) {
                    status.textContent = '⚠️ 目前沒有題目可匯出';
                    status.style.color = '#f59e0b';
                    return;
                }
                try {
                    const json = JSON.stringify({
                        _type: 'assessment_questions',
                        title: elementData.title || '',
                        assessmentType: elementData.assessmentType || 'pre',
                        questions: qs,
                    }, null, 2);
                    await navigator.clipboard.writeText(json);
                    status.textContent = `✅ 已複製 ${qs.length} 題到剪貼簿`;
                    status.style.color = '#16a34a';
                } catch (e) {
                    status.textContent = '❌ 複製失敗';
                    status.style.color = '#dc2626';
                }
            });

            // 從剪貼簿貼上題組
            document.getElementById('assessImportBtn')?.addEventListener('click', async () => {
                const status = document.getElementById('assessImportStatus');
                try {
                    const text = await navigator.clipboard.readText();
                    const data = JSON.parse(text);
                    if (data._type !== 'assessment_questions' || !Array.isArray(data.questions)) {
                        throw new Error('格式不正確');
                    }
                    elementData.questions = data.questions;
                    if (data.title) elementData.title = data.title;
                    this.slideManager.renderCurrentSlide();
                    this.slideManager.saveCurrentSlide();
                    this.selectElementById(elementId);
                    status.textContent = `✅ 已匯入 ${data.questions.length} 題`;
                    status.style.color = '#16a34a';
                } catch (e) {
                    status.textContent = '❌ 剪貼簿中沒有有效的題組資料';
                    status.style.color = '#dc2626';
                }
            });

            // 從其他專案匯入
            document.getElementById('assessImportProjectBtn')?.addEventListener('click', async () => {
                const status = document.getElementById('assessImportStatus');
                const btn = document.getElementById('assessImportProjectBtn');
                btn.disabled = true;
                status.textContent = '⏳ 載入專案列表…';
                status.style.color = '#64748b';

                try {
                    const { db } = await import('./supabase.js');
                    const projects = this.slideManager._projectsCache || [];
                    if (projects.length === 0) {
                        status.textContent = '⚠️ 沒有找到其他專案';
                        status.style.color = '#f59e0b';
                        btn.disabled = false;
                        return;
                    }

                    // 掃描所有專案找 assessment 元件
                    const found = [];
                    for (const proj of projects) {
                        if (proj.id === this.slideManager.currentProjectId) continue;
                        const slides = proj.slides || [];
                        for (const slide of slides) {
                            for (const el of (slide.elements || [])) {
                                if (el.type === 'assessment' && el.questions?.length > 0) {
                                    found.push({
                                        projectName: proj.name,
                                        projectId: proj.id,
                                        title: el.title || (el.assessmentType === 'post' ? '課後測驗' : '課前測驗'),
                                        type: el.assessmentType || 'pre',
                                        count: el.questions.length,
                                        questions: el.questions,
                                    });
                                }
                            }
                        }
                    }

                    if (found.length === 0) {
                        status.textContent = '⚠️ 其他專案中沒有找到評量題組';
                        status.style.color = '#f59e0b';
                        btn.disabled = false;
                        return;
                    }

                    // 建立選擇下拉
                    const wrap = document.createElement('div');
                    wrap.style.cssText = 'margin-top:6px;padding:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;';
                    wrap.innerHTML = `
                        <div style="font-size:11px;color:#64748b;margin-bottom:4px;">選擇題組：</div>
                        <select id="assessProjectSelect" style="width:100%;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;margin-bottom:6px;">
                            ${found.map((f, i) => `<option value="${i}">${f.projectName} — ${f.title} (${f.count}題)</option>`).join('')}
                        </select>
                        <button id="assessProjectConfirm" style="width:100%;padding:5px;border:none;border-radius:6px;background:#3b82f6;color:white;font-size:12px;cursor:pointer;font-family:inherit;">匯入此題組</button>
                    `;
                    btn.parentNode.insertBefore(wrap, btn.nextSibling);
                    status.textContent = '';

                    wrap.querySelector('#assessProjectConfirm').addEventListener('click', () => {
                        const idx = parseInt(wrap.querySelector('#assessProjectSelect').value);
                        const selected = found[idx];
                        if (selected) {
                            elementData.questions = JSON.parse(JSON.stringify(selected.questions));
                            elementData.title = selected.title;
                            this.slideManager.renderCurrentSlide();
                            this.slideManager.saveCurrentSlide();
                            this.selectElementById(elementId);
                            status.textContent = `✅ 已匯入「${selected.projectName}」的 ${selected.count} 題`;
                            status.style.color = '#16a34a';
                        }
                        wrap.remove();
                    });
                } catch (e) {
                    console.error('Assessment import error:', e);
                    status.textContent = '❌ 載入失敗';
                    status.style.color = '#dc2626';
                } finally {
                    btn.disabled = false;
                }
            });
        } else if (elementData.type === 'document') {
            bindSimple('docTitle', 'docTitle');

            // ── 彈出式編輯器 ──
            document.getElementById('docOpenEditor')?.addEventListener('click', () => {
                const freshData = this.slideManager.getCurrentSlide()?.elements?.find(e => e.id === elementId);
                const overlay = document.createElement('div');
                overlay.id = 'docEditorOverlay';
                overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
                overlay.innerHTML = `
                    <div style="background:white;border-radius:16px;width:min(92vw,860px);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                            <h3 style="margin:0;font-size:16px;color:#0f172a;display:flex;align-items:center;gap:8px;">
                                <span class="material-symbols-outlined" style="font-size:20px;color:#0284c7;">description</span>
                                文件內容編輯
                            </h3>
                            <div style="display:flex;gap:8px;">
                                <button id="docEditorFormat" style="padding:5px 12px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:6px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;" title="自動格式化純文字為 Markdown 段落">
                                    <span class="material-symbols-outlined" style="font-size:14px;">auto_fix_high</span> 自動排版
                                </button>
                                <button id="docEditorSave" style="padding:5px 16px;background:#0284c7;color:white;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">儲存</button>
                                <button id="docEditorCancel" style="padding:5px 16px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;cursor:pointer;">取消</button>
                            </div>
                        </div>
                        <div style="display:flex;border-bottom:1px solid #e2e8f0;">
                            <button class="doc-ed-tab active" data-tab="edit" style="flex:1;padding:8px;border:none;background:none;font-size:12px;font-weight:600;color:#0284c7;border-bottom:2px solid #0284c7;cursor:pointer;">
                                <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">edit</span> 編輯
                            </button>
                            <button class="doc-ed-tab" data-tab="preview" style="flex:1;padding:8px;border:none;background:none;font-size:12px;font-weight:500;color:#94a3b8;border-bottom:2px solid transparent;cursor:pointer;">
                                <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">visibility</span> 預覽
                            </button>
                        </div>
                        <div id="docEditorEditPane" style="flex:1;display:flex;flex-direction:column;min-height:0;">
                            <div style="padding:4px 20px;font-size:11px;color:#94a3b8;line-height:1.4;">支援 Markdown、HTML。貼上純文字後可按「自動排版」整理格式。</div>
                            <textarea id="docEditorTextarea" style="flex:1;margin:4px 20px 20px;padding:14px;border:1px solid #e2e8f0;border-radius:8px;font-family:'Fira Code','SF Mono',monospace;font-size:13px;line-height:1.7;resize:none;outline:none;min-height:380px;">${(freshData?.docContent || '').replace(/</g, '&lt;')}</textarea>
                        </div>
                        <div id="docEditorPreviewPane" style="flex:1;display:none;overflow-y:auto;padding:20px;min-height:380px;"></div>
                    </div>
                `;
                document.body.appendChild(overlay);

                const textarea = overlay.querySelector('#docEditorTextarea');
                const editPane = overlay.querySelector('#docEditorEditPane');
                const previewPane = overlay.querySelector('#docEditorPreviewPane');
                textarea?.focus();

                // 頁籤切換
                overlay.querySelectorAll('.doc-ed-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        overlay.querySelectorAll('.doc-ed-tab').forEach(t => {
                            t.style.color = '#94a3b8'; t.style.fontWeight = '500'; t.style.borderBottomColor = 'transparent';
                        });
                        tab.style.color = '#0284c7'; tab.style.fontWeight = '600'; tab.style.borderBottomColor = '#0284c7';

                        if (tab.dataset.tab === 'edit') {
                            editPane.style.display = 'flex';
                            previewPane.style.display = 'none';
                        } else {
                            editPane.style.display = 'none';
                            previewPane.style.display = 'block';
                            // 渲染預覽
                            const { DocumentViewer } = window._app?.documentViewer?.constructor
                                ? { DocumentViewer: window._app.documentViewer.constructor }
                                : {};
                            if (window._app?.documentViewer?.parseMarkdown) {
                                previewPane.innerHTML = `<div class="doc-viewer-content">${window._app.documentViewer.parseMarkdown(textarea.value)}</div>`;
                            } else {
                                previewPane.innerHTML = `<div style="padding:20px;line-height:1.7;">${textarea.value.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</div>`;
                            }
                        }
                    });
                });

                // 自動排版
                overlay.querySelector('#docEditorFormat')?.addEventListener('click', () => {
                    let text = textarea.value;
                    // 把連續的非空行用雙換行分段
                    text = text
                        .replace(/\r\n/g, '\n')
                        .replace(/\n{3,}/g, '\n\n')  // 壓縮多餘空行
                        .split('\n\n')
                        .map(para => para.replace(/\n/g, '  \n')) // 保留段內換行（Markdown soft break）
                        .join('\n\n');
                    textarea.value = text;
                });

                const close = () => overlay.remove();

                overlay.querySelector('#docEditorCancel').addEventListener('click', close);
                overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

                overlay.querySelector('#docEditorSave').addEventListener('click', () => {
                    const val = textarea.value;
                    this.slideManager.updateElement(elementId, { docContent: val });
                    close();
                    this.renderPropertyPanel(elementId);
                    this._bindPropertyEvents(elementId);
                    this.slideManager.renderCurrentSlide();
                    this.selectElementById(elementId);
                });
            });

            // ── 錨點 CRUD ──
            const getAnchors = () => {
                const d = this.slideManager.getCurrentSlide()?.elements?.find(e => e.id === elementId);
                return d?.docAnchors ? [...d.docAnchors] : [];
            };

            const refreshPanel = () => {
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            };

            // 錨點文字/勾選變更
            const syncAnchors = () => {
                const rows = document.querySelectorAll('.doc-anchor-row');
                const anchors = [...rows].map(row => ({
                    id: 'a' + row.dataset.idx,
                    text: row.querySelector('.doc-anchor-text')?.value || '',
                    isError: row.querySelector('.doc-anchor-error')?.checked || false,
                }));
                this.slideManager.updateElement(elementId, { docAnchors: anchors });
                refreshPanel();
            };

            document.querySelectorAll('.doc-anchor-text').forEach(inp => {
                inp.addEventListener('change', syncAnchors);
            });
            document.querySelectorAll('.doc-anchor-error').forEach(chk => {
                chk.addEventListener('change', syncAnchors);
            });

            // 刪除錨點
            document.querySelectorAll('.doc-anchor-del').forEach(btn => {
                btn.addEventListener('click', () => {
                    const anchors = getAnchors();
                    const idx = parseInt(btn.closest('.doc-anchor-row').dataset.idx);
                    anchors.splice(idx, 1);
                    this.slideManager.updateElement(elementId, { docAnchors: anchors });
                    refreshPanel();
                });
            });

            // 新增錨點
            document.getElementById('addDocAnchor')?.addEventListener('click', () => {
                const anchors = getAnchors();
                anchors.push({ id: 'a' + Date.now(), text: '', isError: false });
                this.slideManager.updateElement(elementId, { docAnchors: anchors });
                refreshPanel();
                setTimeout(() => {
                    const inputs = document.querySelectorAll('.doc-anchor-text');
                    inputs[inputs.length - 1]?.focus();
                }, 100);
            });
        } else if (elementData.type === 'wordcloud') {
            bindSimple('wcQuestion', 'question');
            bindSimple('wcMaxWords', 'maxWords', v => parseInt(v) || 3);
        } else if (elementData.type === 'hotspot') {
            bindSimple('hsQuestion', 'question');
            // 圖片 URL 改變時重新渲染
            const hsImageInput = document.getElementById('hsImage');
            if (hsImageInput) {
                hsImageInput.addEventListener('change', () => {
                    this.slideManager.updateElement(elementId, { image: hsImageInput.value });
                    this.slideManager.renderCurrentSlide();
                    this.selectElementById(elementId);
                });
            }
            // 點擊預覽圖新增節點
            const previewWrap = document.getElementById('hsPreviewWrap');
            if (previewWrap) {
                previewWrap.addEventListener('click', (e) => {
                    if (e.target.classList.contains('hs-preview-node')) return;
                    const rect = previewWrap.getBoundingClientRect();
                    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                    const nodes = [...(elementData.nodes || [])];
                    const label = String.fromCharCode(65 + nodes.length); // A, B, C...
                    nodes.push({ id: label, x, y, label, isCorrect: false });
                    this.slideManager.updateElement(elementId, { nodes });
                    this.slideManager.renderCurrentSlide();
                    this.selectElementById(elementId);
                });
            }
            // 節點正確/刪除
            const nodesList = document.getElementById('hsNodesList');
            if (nodesList) {
                nodesList.addEventListener('change', (e) => {
                    if (!e.target.classList.contains('hs-node-correct')) return;
                    const idx = parseInt(e.target.closest('.hs-node-row').dataset.idx);
                    const nodes = [...(elementData.nodes || [])];
                    if (nodes[idx]) nodes[idx].isCorrect = e.target.checked;
                    this.slideManager.updateElement(elementId, { nodes });
                    this.slideManager.renderCurrentSlide();
                    this.selectElementById(elementId);
                });
                nodesList.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('hs-node-delete')) return;
                    const idx = parseInt(e.target.closest('.hs-node-row').dataset.idx);
                    const nodes = [...(elementData.nodes || [])];
                    nodes.splice(idx, 1);
                    // 重新編號
                    nodes.forEach((n, i) => { n.label = String.fromCharCode(65 + i); n.id = n.label; });
                    this.slideManager.updateElement(elementId, { nodes });
                    this.slideManager.renderCurrentSlide();
                    this.selectElementById(elementId);
                });
            }
        }

        // 流動線條事件
        if (elementData.type === 'flowline') {
            const flowRerender = () => {
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            };
            const flowBind = (inputId, key, parse, valSpanId) => {
                const el = document.getElementById(inputId);
                if (!el) return;
                el.addEventListener('input', () => {
                    if (valSpanId) {
                        const span = document.getElementById(valSpanId);
                        if (span) span.textContent = el.value;
                    }
                    this.slideManager.updateElement(elementId, { [key]: parse ? parse(el.value) : el.value });
                    flowRerender();
                });
            };
            flowBind('flowLineColor', 'lineColor');
            flowBind('flowGlowColor', 'glowColor');
            flowBind('flowLineWidth', 'lineWidth', v => parseInt(v) || 3, 'flowLineWidthVal');
            flowBind('flowSpeed', 'flowSpeed', v => parseInt(v) || 2, 'flowSpeedVal');
            flowBind('flowParticleCount', 'particleCount', v => parseInt(v) || 3, 'flowParticleCountVal');

            const dirSelect = document.getElementById('flowDirection');
            if (dirSelect) {
                dirSelect.addEventListener('change', () => {
                    this.slideManager.updateElement(elementId, { flowDirection: parseInt(dirSelect.value) });
                    flowRerender();
                });
            }

            // 箭頭
            const arrowCheck = document.getElementById('flowShowArrow');
            if (arrowCheck) {
                arrowCheck.addEventListener('change', () => {
                    this.slideManager.updateElement(elementId, { showArrow: arrowCheck.checked });
                    flowRerender();
                });
            }

            // 曲線 / 直線
            const curveModeSelect = document.getElementById('flowCurveMode');
            if (curveModeSelect) {
                curveModeSelect.addEventListener('change', () => {
                    this.slideManager.updateElement(elementId, { curveMode: curveModeSelect.value });
                    flowRerender();
                });
            }

            // 路徑預設形狀
            document.querySelectorAll('.flow-shape-preset').forEach(btn => {
                btn.addEventListener('click', () => {
                    const shape = btn.dataset.shape;
                    const w = elementData.width;
                    const h = elementData.height;
                    let newPts = [];
                    const presetMode = shape === 'wave' ? 'curved' : (shape === 'ellipse' ? 'curved' : 'straight');

                    switch (shape) {
                        case 'wave':
                            newPts = [
                                { x: 0, y: h / 2 },
                                { x: w * 0.25, y: h * 0.1 },
                                { x: w * 0.5, y: h * 0.9 },
                                { x: w * 0.75, y: h * 0.1 },
                                { x: w, y: h / 2 }
                            ];
                            break;
                        case 'ellipse': {
                            const cx = w / 2, cy = h / 2;
                            const rx = w / 2 * 0.9, ry = h / 2 * 0.9;
                            const segments = 12;
                            for (let i = 0; i <= segments; i++) {
                                const angle = (2 * Math.PI * i) / segments;
                                newPts.push({
                                    x: Math.round(cx + rx * Math.cos(angle)),
                                    y: Math.round(cy + ry * Math.sin(angle))
                                });
                            }
                            break;
                        }
                        case 'rectangle': {
                            const m = 20; // margin
                            newPts = [
                                { x: m, y: m },
                                { x: w - m, y: m },
                                { x: w - m, y: h - m },
                                { x: m, y: h - m },
                                { x: m, y: m }
                            ];
                            break;
                        }
                        case 'triangle': {
                            const m = 20;
                            newPts = [
                                { x: w / 2, y: m },
                                { x: w - m, y: h - m },
                                { x: m, y: h - m },
                                { x: w / 2, y: m }
                            ];
                            break;
                        }
                        case 'zigzag': {
                            const segs = 6;
                            for (let i = 0; i <= segs; i++) {
                                newPts.push({
                                    x: Math.round(w * i / segs),
                                    y: i % 2 === 0 ? h * 0.2 : h * 0.8
                                });
                            }
                            break;
                        }
                    }

                    const updates = { waypoints: newPts };
                    // 橢圓用曲線，其他預設用直線（使用者仍可手動切換）
                    if (shape === 'ellipse' || shape === 'wave') updates.curveMode = 'curved';
                    else updates.curveMode = 'straight';

                    this.slideManager.updateElement(elementId, updates);
                    flowRerender();
                });
            });
        }

        // 外觀設定（標題字級 / 選項字級 / 內距）
        const titleFSInput = document.getElementById('propTitleFontSize');
        if (titleFSInput) {
            titleFSInput.addEventListener('change', () => {
                this.slideManager.updateElement(elementId, { titleFontSize: parseInt(titleFSInput.value) || 18 });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        }
        const optionFSInput = document.getElementById('propOptionFontSize');
        if (optionFSInput) {
            optionFSInput.addEventListener('change', () => {
                this.slideManager.updateElement(elementId, { optionFontSize: parseInt(optionFSInput.value) || 15 });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        }
        const paddingInput = document.getElementById('propInteractivePadding');
        if (paddingInput) {
            const paddingLabel = paddingInput.nextElementSibling;
            paddingInput.addEventListener('input', () => {
                if (paddingLabel) paddingLabel.textContent = paddingInput.value + 'px';
                const val = parseInt(paddingInput.value) || 16;
                this.slideManager.updateElement(elementId, { interactivePadding: val });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        }

        // 倒數計時器
        const timeLimitInput = document.getElementById('propTimeLimit');
        if (timeLimitInput) {
            timeLimitInput.addEventListener('change', () => {
                const val = parseInt(timeLimitInput.value) || 0;
                this.slideManager.updateElement(elementId, { timeLimit: val });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        }
    }

    /**
     * 綁定連連看事件
     */
    bindMatchingEvents(elementId, elementData) {
        const pairList = document.getElementById('pairList');
        const addPairBtn = document.getElementById('addPair');

        if (!pairList) return;

        // 更新配對
        pairList.querySelectorAll('.pair-item').forEach(item => {
            const index = parseInt(item.dataset.index);

            item.querySelector('.pair-left').addEventListener('change', (e) => {
                elementData.pairs[index].left = e.target.value;
                this.slideManager.updateElement(elementId, { pairs: elementData.pairs });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });

            item.querySelector('.pair-right').addEventListener('change', (e) => {
                elementData.pairs[index].right = e.target.value;
                this.slideManager.updateElement(elementId, { pairs: elementData.pairs });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });

            item.querySelector('.remove-pair').addEventListener('click', () => {
                elementData.pairs.splice(index, 1);
                this.slideManager.updateElement(elementId, { pairs: elementData.pairs });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        });

        if (addPairBtn) {
            addPairBtn.addEventListener('click', () => {
                elementData.pairs.push({ left: '新項目', right: 'New Item' });
                this.slideManager.updateElement(elementId, { pairs: elementData.pairs });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        }
    }

    /**
     * 綁定填空題事件
     */
    bindFillBlankEvents(elementId, elementData) {
        const titleInput = document.getElementById('blankTitle');
        const contentInput = document.getElementById('blankContent');
        const blankList = document.getElementById('blankList');

        if (titleInput) {
            titleInput.addEventListener('change', () => {
                this.slideManager.updateElement(elementId, { title: titleInput.value });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        }

        if (contentInput) {
            contentInput.addEventListener('change', () => {
                this.slideManager.updateElement(elementId, { content: contentInput.value });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        }

        if (blankList) {
            blankList.querySelectorAll('.blank-item').forEach(item => {
                const index = parseInt(item.dataset.index);
                item.querySelector('.blank-answer').addEventListener('change', (e) => {
                    if (elementData.blanks[index]) {
                        elementData.blanks[index].answer = e.target.value;
                        this.slideManager.updateElement(elementId, { blanks: elementData.blanks });
                    }
                });
            });
        }
    }

    /**
     * 渲染排列順序屬性
     */
    renderOrderingProperties(elementData) {
        return `
            <div class="property-section">
                <div class="property-section-title">排列步驟（按正確順序）</div>
                <div class="step-list" id="stepList">
                    ${(elementData.steps || []).map((step, i) => `
                        <div class="pair-item" data-index="${i}">
                            <span style="min-width:20px;color:#94a3b8;font-weight:700;">${i + 1}</span>
                            <input type="text" class="pair-left step-input" value="${step}" placeholder="步驟 ${i + 1}">
                            <button class="remove-pair remove-step">✕</button>
                        </div>
                    `).join('')}
                </div>
                <button class="add-pair-btn" id="addStep">+ 新增步驟</button>
            </div>
        `;
    }
    /**
     * 渲染選擇題屬性
     */
    renderQuizProperties(elementData) {
        const markers = 'ABCDEFGHIJ';
        return `
            <div class="property-section">
                <div class="property-section-title">題目設定</div>
                <div class="property-row">
                    <label>題目</label>
                    <input type="text" id="quizQuestion" value="${elementData.question || ''}" placeholder="請輸入題目">
                </div>
                <div class="property-row" style="margin-top:8px;">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                        <input type="checkbox" id="quizMultiple" ${elementData.multiple ? 'checked' : ''}>
                        多選題
                    </label>
                </div>
            </div>
            <div class="property-section">
                <div class="property-section-title">選項（勾選為正確答案）</div>
                <div class="pair-list" id="quizOptionList">
                    ${(elementData.options || []).map((opt, i) => `
                        <div class="pair-item" data-index="${i}">
                            <input type="checkbox" class="quiz-correct-cb" ${opt.correct ? 'checked' : ''}>
                            <span style="min-width:18px;color:#94a3b8;font-weight:700;font-size:0.8rem;">${markers[i]}</span>
                            <input type="text" class="pair-left quiz-opt-text" value="${opt.text}" placeholder="選項 ${markers[i]}">
                            <button class="remove-pair remove-quiz-opt">✕</button>
                        </div>
                    `).join('')}
                </div>
                <button class="add-pair-btn" id="addQuizOption">+ 新增選項</button>
            </div>
        `;
    }

    /**
     * 綁定選擇題事件
     */
    bindQuizEvents(elementId, elementData) {
        const questionInput = document.getElementById('quizQuestion');
        const multipleCheckbox = document.getElementById('quizMultiple');
        const optionList = document.getElementById('quizOptionList');
        const addOptionBtn = document.getElementById('addQuizOption');

        if (!questionInput) return;

        questionInput.addEventListener('change', () => {
            this.slideManager.updateElement(elementId, { question: questionInput.value });
            this.slideManager.renderCurrentSlide();
            this.selectElementById(elementId);
        });

        multipleCheckbox?.addEventListener('change', () => {
            this.slideManager.updateElement(elementId, { multiple: multipleCheckbox.checked });
            this.slideManager.renderCurrentSlide();
            this.selectElementById(elementId);
        });

        if (optionList) {
            optionList.querySelectorAll('.pair-item').forEach(item => {
                const index = parseInt(item.dataset.index);

                item.querySelector('.quiz-opt-text')?.addEventListener('change', (e) => {
                    elementData.options[index].text = e.target.value;
                    this.slideManager.updateElement(elementId, { options: elementData.options });
                    this.slideManager.renderCurrentSlide();
                    this.selectElementById(elementId);
                });

                item.querySelector('.quiz-correct-cb')?.addEventListener('change', (e) => {
                    elementData.options[index].correct = e.target.checked;
                    this.slideManager.updateElement(elementId, { options: elementData.options });
                    this.slideManager.renderCurrentSlide();
                    this.selectElementById(elementId);
                });

                item.querySelector('.remove-quiz-opt')?.addEventListener('click', () => {
                    elementData.options.splice(index, 1);
                    this.slideManager.updateElement(elementId, { options: elementData.options });
                    this.slideManager.renderCurrentSlide();
                    this.selectElementById(elementId);
                });
            });
        }

        addOptionBtn?.addEventListener('click', () => {
            const markers = 'ABCDEFGHIJ';
            const idx = elementData.options.length;
            elementData.options.push({ text: `選項 ${markers[idx] || idx + 1}`, correct: false });
            this.slideManager.updateElement(elementId, { options: elementData.options });
            this.slideManager.renderCurrentSlide();
            this.selectElementById(elementId);
        });
    }

    /**
     * 渲染投票屬性面板
     */
    renderPollProperties(elementData) {
        const markers = 'ABCDEFGHIJ';
        return `
            <div class="property-section">
                <div class="property-section-title">投票設定</div>
                <div class="property-row">
                    <label>題目</label>
                    <input type="text" id="pollQuestion" value="${elementData.question || ''}" placeholder="請輸入投票題目">
                </div>
            </div>
            <div class="property-section">
                <div class="property-section-title">選項</div>
                <div class="pair-list" id="pollOptionList">
                    ${(elementData.options || []).map((opt, i) => `
                        <div class="pair-item" data-index="${i}">
                            <span style="min-width:18px;color:#94a3b8;font-weight:700;font-size:0.8rem;">${markers[i]}</span>
                            <input type="text" class="pair-left poll-opt-text" value="${opt.text}" placeholder="選項 ${markers[i]}">
                            <button class="remove-pair remove-poll-opt">✕</button>
                        </div>
                    `).join('')}
                </div>
                <button class="add-pair-btn" id="addPollOption">+ 新增選項</button>
            </div>
        `;
    }

    /**
     * 渲染展示牆屬性面板
     */
    renderShowcaseProperties(elementData) {
        // 收集所有投影片中的作業
        const homeworks = [];
        this.slideManager.slides.forEach((slide, si) => {
            (slide.elements || []).forEach(el => {
                if (el.type === 'homework') {
                    homeworks.push({
                        id: el.id,
                        title: el.title || '課堂作業',
                        slideIndex: si
                    });
                }
            });
        });

        // 建立下拉選單選項
        const optionsHtml = homeworks.map(hw => {
            const isSelected = hw.id === elementData.linkedHomeworkId || hw.title === elementData.assignmentTitle;
            return `<option value="${hw.id}" data-title="${hw.title}" ${isSelected ? 'selected' : ''}>
                ${hw.title} (投影片 ${hw.slideIndex + 1})
            </option>`;
        }).join('');

        return `
            <div class="property-section">
                <div class="property-section-title">展示牆設定</div>
                <div class="property-row">
                    <label>綁定作業</label>
                    <select id="showcaseAssignment" style="flex:1;padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:0.85rem;">
                         <option value="">-- 請選擇作業 --</option>
                         ${optionsHtml}
                    </select>
                </div>
            </div>
        `;
    }

    /**
     * 綁定展示牆事件
     */
    bindShowcaseEvents(elementId, elementData, elementEl) {
        const selectEl = document.getElementById('showcaseAssignment');
        if (!selectEl) return;

        selectEl.addEventListener('change', () => {
            const selectedOption = selectEl.options[selectEl.selectedIndex];
            const linkedHomeworkId = selectedOption.value;
            let assignmentTitle = '';

            if (linkedHomeworkId) {
                assignmentTitle = selectedOption.dataset.title;
            }

            // 更新元素資料
            this.slideManager.updateElement(elementId, {
                linkedHomeworkId: linkedHomeworkId,
                assignmentTitle: assignmentTitle,
                linkedHomeworkTitle: assignmentTitle
            });

            // 找到 iframe 並透過 postMessage 傳遞變更，或者重新渲染 slide
            this.slideManager.renderCurrentSlide();
            this.selectElementById(elementId);
        });
    }

    /**
     * 綁定投票事件
     */
    bindPollEvents(elementId, elementData) {
        const questionInput = document.getElementById('pollQuestion');
        const optionList = document.getElementById('pollOptionList');
        const addOptionBtn = document.getElementById('addPollOption');

        if (!questionInput) return;

        questionInput.addEventListener('change', () => {
            this.slideManager.updateElement(elementId, { question: questionInput.value });
            this.slideManager.renderCurrentSlide();
            this.selectElementById(elementId);
        });

        if (optionList) {
            optionList.querySelectorAll('.pair-item').forEach(item => {
                const index = parseInt(item.dataset.index);

                item.querySelector('.poll-opt-text')?.addEventListener('change', (e) => {
                    elementData.options[index].text = e.target.value;
                    this.slideManager.updateElement(elementId, { options: elementData.options });
                    this.slideManager.renderCurrentSlide();
                    this.selectElementById(elementId);
                });

                item.querySelector('.remove-poll-opt')?.addEventListener('click', () => {
                    elementData.options.splice(index, 1);
                    this.slideManager.updateElement(elementId, { options: elementData.options });
                    this.slideManager.renderCurrentSlide();
                    this.selectElementById(elementId);
                });
            });
        }

        addOptionBtn?.addEventListener('click', () => {
            const markers = 'ABCDEFGHIJ';
            const idx = elementData.options.length;
            elementData.options.push({ text: `選項 ${markers[idx] || idx + 1}` });
            this.slideManager.updateElement(elementId, { options: elementData.options });
            this.slideManager.renderCurrentSlide();
            this.selectElementById(elementId);
        });
    }

    /**
     * 綁定排列順序事件
     */
    bindOrderingEvents(elementId, elementData) {
        const stepList = document.getElementById('stepList');
        const addStepBtn = document.getElementById('addStep');

        if (!stepList) return;

        stepList.querySelectorAll('.pair-item').forEach(item => {
            const index = parseInt(item.dataset.index);

            item.querySelector('.step-input').addEventListener('change', (e) => {
                elementData.steps[index] = e.target.value;
                this.slideManager.updateElement(elementId, { steps: elementData.steps });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });

            item.querySelector('.remove-step').addEventListener('click', () => {
                elementData.steps.splice(index, 1);
                this.slideManager.updateElement(elementId, { steps: elementData.steps });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        });

        if (addStepBtn) {
            addStepBtn.addEventListener('click', () => {
                elementData.steps.push('新步驟');
                this.slideManager.updateElement(elementId, { steps: elementData.steps });
                this.slideManager.renderCurrentSlide();
                this.selectElementById(elementId);
            });
        }
    }

    /**
     * 綁定複製卡片事件
     */
    bindCopyCardEvents(elementId, elementData) {
        const titleInput = document.getElementById('copyCardTitle');
        const contentInput = document.getElementById('copyCardContent');

        if (titleInput) {
            titleInput.addEventListener('change', () => {
                this.slideManager.updateElement(elementId, { title: titleInput.value });
                this.slideManager.renderCurrentSlide();
                // title 較短且是 change 事件，保留 selectElementById 刷新面板無妨
                this.selectElementById(elementId);
            });
        }

        if (contentInput) {
            contentInput.addEventListener('input', () => {
                this.slideManager.updateElement(elementId, { content: contentInput.value });
                this.slideManager.renderCurrentSlide();
                // 移除 this.selectElementById(elementId) 避免每次輸入都重建整個屬性面板導致失去焦點卡住
            });
        }
    }

    /**
     * 隱藏屬性面板
     */
    hidePropertyPanel() {
        this.propertyContentEl.innerHTML = '';
    }

    /**
     * 刪除選中元素（支援多選）
     */
    deleteSelected() {
        if (this.selectedElements.size > 0) {
            const ids = [...this.selectedElements]
                .map(el => el?.dataset?.id)
                .filter(Boolean);
            this.deselectAll();
            this.slideManager.deleteElementsBatch(ids);
        } else if (this.selectedElement?.dataset?.id) {
            const id = this.selectedElement.dataset.id;
            this.deselectAll();
            this.slideManager.deleteElement(id);
        }
    }

    /**
     * 多選屬性面板（對齊按鈕）
     */
    showMultiSelectPanel() {
        const count = this.selectedElements.size;
        this.propertyContentEl.innerHTML = `
            <div class="property-section">
                <div class="property-section-title">多選操作</div>
                <div style="font-size:13px;color:#475569;margin-bottom:12px;">已選取 <b>${count}</b> 個元素</div>
                <div class="property-section-title">對齊</div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px;">
                    <button class="layer-btn" id="alignLeft" title="靠左對齊">◧</button>
                    <button class="layer-btn" id="alignCenterH" title="水平置中">⬚</button>
                    <button class="layer-btn" id="alignRight" title="靠右對齊">◨</button>
                    <button class="layer-btn" id="alignTop" title="靠上對齊">⬒</button>
                    <button class="layer-btn" id="alignCenterV" title="垂直置中">⬔</button>
                    <button class="layer-btn" id="alignBottom" title="靠下對齊">⬓</button>
                </div>
                <div class="property-section-title" style="margin-top:8px;">分佈</div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-bottom:12px;">
                    <button class="layer-btn" id="distributeH">水平等距</button>
                    <button class="layer-btn" id="distributeV">垂直等距</button>
                </div>
                <div class="property-section-title" style="margin-top:8px;">群組</div>
                <button class="layer-btn" id="groupBtn" style="width:100%;padding:6px;">Ctrl+G 群組</button>
            </div>
            <button class="delete-element-btn" id="deleteMulti">刪除 ${count} 個元素</button>
        `;
        this._bindMultiSelectEvents();
    }

    /**
     * 綁定多選面板事件
     */
    _bindMultiSelectEvents() {
        const getSelectedData = () => {
            const slide = this.slideManager.getCurrentSlide();
            if (!slide) return [];
            return [...this.selectedElements].map(el => {
                const data = slide.elements.find(e => e.id === el.dataset.id);
                return data ? { el, data } : null;
            }).filter(Boolean);
        };

        const rerender = () => {
            this.slideManager.renderCurrentSlide();
            this.slideManager.renderThumbnails();
        };

        // 對齊
        document.getElementById('alignLeft')?.addEventListener('click', () => {
            const items = getSelectedData();
            const minX = Math.min(...items.map(i => i.data.x));
            items.forEach(i => this.slideManager.updateElement(i.data.id, { x: minX }));
            rerender();
        });
        document.getElementById('alignCenterH')?.addEventListener('click', () => {
            const items = getSelectedData();
            const centers = items.map(i => i.data.x + i.data.width / 2);
            const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
            items.forEach(i => this.slideManager.updateElement(i.data.id, { x: Math.round(avg - i.data.width / 2) }));
            rerender();
        });
        document.getElementById('alignRight')?.addEventListener('click', () => {
            const items = getSelectedData();
            const maxRight = Math.max(...items.map(i => i.data.x + i.data.width));
            items.forEach(i => this.slideManager.updateElement(i.data.id, { x: maxRight - i.data.width }));
            rerender();
        });
        document.getElementById('alignTop')?.addEventListener('click', () => {
            const items = getSelectedData();
            const minY = Math.min(...items.map(i => i.data.y));
            items.forEach(i => this.slideManager.updateElement(i.data.id, { y: minY }));
            rerender();
        });
        document.getElementById('alignCenterV')?.addEventListener('click', () => {
            const items = getSelectedData();
            const centers = items.map(i => i.data.y + i.data.height / 2);
            const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
            items.forEach(i => this.slideManager.updateElement(i.data.id, { y: Math.round(avg - i.data.height / 2) }));
            rerender();
        });
        document.getElementById('alignBottom')?.addEventListener('click', () => {
            const items = getSelectedData();
            const maxBottom = Math.max(...items.map(i => i.data.y + i.data.height));
            items.forEach(i => this.slideManager.updateElement(i.data.id, { y: maxBottom - i.data.height }));
            rerender();
        });

        // 分佈
        document.getElementById('distributeH')?.addEventListener('click', () => {
            const items = getSelectedData().sort((a, b) => a.data.x - b.data.x);
            if (items.length < 3) return;
            const minX = items[0].data.x;
            const maxRight = items[items.length - 1].data.x + items[items.length - 1].data.width;
            const totalWidth = items.reduce((s, i) => s + i.data.width, 0);
            const gap = (maxRight - minX - totalWidth) / (items.length - 1);
            let x = minX;
            items.forEach(i => {
                this.slideManager.updateElement(i.data.id, { x: Math.round(x) });
                x += i.data.width + gap;
            });
            rerender();
        });
        document.getElementById('distributeV')?.addEventListener('click', () => {
            const items = getSelectedData().sort((a, b) => a.data.y - b.data.y);
            if (items.length < 3) return;
            const minY = items[0].data.y;
            const maxBottom = items[items.length - 1].data.y + items[items.length - 1].data.height;
            const totalHeight = items.reduce((s, i) => s + i.data.height, 0);
            const gap = (maxBottom - minY - totalHeight) / (items.length - 1);
            let y = minY;
            items.forEach(i => {
                this.slideManager.updateElement(i.data.id, { y: Math.round(y) });
                y += i.data.height + gap;
            });
            rerender();
        });

        // 群組
        document.getElementById('groupBtn')?.addEventListener('click', () => this.groupSelected());

        // 刪除
        document.getElementById('deleteMulti')?.addEventListener('click', () => this.deleteSelected());
    }

    /**
     * 選取群組內所有元素
     */
    _selectGroup(groupId) {
        const slide = this.slideManager.getCurrentSlide();
        if (!slide) return;

        this.deselectAll();
        const groupEls = slide.elements.filter(e => e.groupId === groupId);
        const canvas = this.canvasContentEl;
        groupEls.forEach(elData => {
            const dom = canvas.querySelector(`[data-id="${elData.id}"]`);
            if (dom) {
                this.selectedElements.add(dom);
                dom.classList.add('selected');
            }
        });
        if (this.selectedElements.size > 0) {
            this.selectedElement = [...this.selectedElements][0];
            this.showMultiSelectPanel();
        }
    }

    /**
     * 群組選取的元素
     */
    groupSelected() {
        if (this.selectedElements.size < 2) return;
        const groupId = 'g_' + Date.now().toString(36);
        [...this.selectedElements].forEach(el => {
            this.slideManager.updateElement(el.dataset.id, { groupId });
        });
        this.slideManager.renderCurrentSlide();
        this.slideManager.renderThumbnails();
        this.slideManager.saveNow();
    }

    /**
     * 解散群組
     */
    ungroupSelected() {
        const slide = this.slideManager.getCurrentSlide();
        if (!slide) return;
        const groupIds = new Set();
        [...this.selectedElements].forEach(el => {
            const data = slide.elements.find(e => e.id === el.dataset.id);
            if (data?.groupId) groupIds.add(data.groupId);
        });
        groupIds.forEach(gid => {
            slide.elements.filter(e => e.groupId === gid).forEach(e => {
                this.slideManager.updateElement(e.id, { groupId: null });
            });
        });
        this.slideManager.renderCurrentSlide();
        this.slideManager.renderThumbnails();
        this.slideManager.saveNow();
    }
}
