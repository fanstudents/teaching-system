/**
 * 互動式教學簡報系統 - 主程式入口
 */

import { SlideManager } from './slideManager.js?v=20260304';
import { Editor } from './editor.js?v=20260304';
import { DragDrop } from './dragDrop.js?v=20260304';
import { showToast, showConfirm, showInput } from './ui.js?v=20260304';
import { MatchingGame } from './interactive/matching.js?v=20260304';
import { FillBlank } from './interactive/fillBlank.js?v=20260304';
import { CardCopy } from './interactive/cardCopy.js?v=20260304';
import { Showcase } from './interactive/showcase.js?v=20260304';
import { OrderingGame } from './interactive/ordering.js?v=20260304';
import { QuizGame } from './interactive/quiz.js?v=20260304';
import { PollGame } from './interactive/poll.js?v=20260304';
import { CountdownTimer } from './interactive/countdown.js?v=20260304';
import { TrueFalseGame } from './interactive/truefalse.js?v=20260304';
import { OpenTextGame } from './interactive/opentext.js?v=20260304';
import { ScaleGame } from './interactive/scale.js?v=20260304';
import { BuzzerGame } from './interactive/buzzer.js?v=20260304';
import { WordCloudGame } from './interactive/wordcloud.js?v=20260304';
import { HotspotGame } from './interactive/hotspot.js?v=20260304';
import { DocumentViewer } from './interactive/documentViewer.js?v=20260304';

import { HomeworkSubmission } from './homework.js?v=20260304';
import { db, realtime, generateSessionCode, ai } from './supabase.js';
import { SLIDE_TEMPLATES } from './templates.js?v=20260304';
import { IconLibrary } from './iconLibrary.js?v=20260304';
import { SlideExporter } from './exportSlides.js?v=20260304';

class App {
    constructor() {
        // 初始化模組
        this.slideManager = new SlideManager();
        this.editor = new Editor(this.slideManager);
        window.__editorRef = this.editor;
        this.dragDrop = new DragDrop(this.slideManager, this.editor);
        this.iconLibrary = new IconLibrary(this.slideManager);
        this.matchingGame = new MatchingGame();
        this.fillBlank = new FillBlank();
        this.cardCopy = new CardCopy();
        this.showcase = new Showcase(this.slideManager);
        this.ordering = new OrderingGame();
        this.quiz = new QuizGame();
        this.poll = new PollGame();
        this.countdown = new CountdownTimer();
        this.trueFalse = new TrueFalseGame();
        this.openText = new OpenTextGame();
        this.scale = new ScaleGame();
        this.buzzer = new BuzzerGame();
        this.wordCloud = new WordCloudGame();
        this.hotspot = new HotspotGame();
        this.documentViewer = new DocumentViewer();
        this.homework = new HomeworkSubmission();

        // Undo/Redo 歷史
        this.undoStack = [];
        this.redoStack = [];
        this._lastUndoTime = 0;

        // 自動將每次 save 加入 undo 歷史 (debounced 500ms)
        const origSave = this.slideManager.save.bind(this.slideManager);
        this.slideManager.save = (...args) => {
            const now = Date.now();
            if (now - this._lastUndoTime > 500) {
                this.saveState();
                this._lastUndoTime = now;
            }
            return origSave(...args);
        };

        // 廣播狀態
        this.broadcasting = false;
        this.sessionCode = null;

        // 綁定事件
        this.bindRibbonTabs();
        this.bindToolbarEvents();
        this.bindUIEvents();
        this.bindBroadcastEvents();
        this.bindSpeakerNotes();
        this.bindProjectSwitcher();
        this.bindShareEntryLink();
        this.bindLogoBack();

        // 載入已儲存的資料 (等 DB 初始化完成)
        this.slideManager._initPromise.then(async () => {
            // 先讀取 URL ?id= 設定正確的 projectId，避免先載入預設專案再切換
            const urlParams = new URLSearchParams(location.search);
            const hashParams = new URLSearchParams(location.hash.replace('#', ''));
            const projectId = urlParams.get('id') || hashParams.get('id');
            if (projectId) {
                this.slideManager.currentProjectId = projectId;
                localStorage.setItem('current_project_id', projectId);
            } else if (!this.slideManager.currentProjectId) {
                // 沒有 ?id= 且沒有已載入的專案 → 回到專案管理
                location.href = 'manage.html';
                return;
            }

            await this.slideManager.load();
            this.updateProjectName();
            this.renderProjectList();
        });

        // 備註同步
        window.addEventListener('slideRendered', () => this.updateSpeakerNotes());

        // 教學簡報系統已啟動
    }

    updateUserStatus(user) {
        if (user) {
            const avatar = document.getElementById('userAvatar');
            const name = document.getElementById('userName');
            if (avatar) avatar.textContent = user.name.charAt(0).toUpperCase();
            if (name) name.textContent = user.name;
        }
    }

    /* =========================================
       Ribbon 頁籤切換
       ========================================= */
    bindRibbonTabs() {
        const tabs = document.querySelectorAll('.ribbon-tab');
        const panels = document.querySelectorAll('.ribbon-panel');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                const panelId = `ribbon-${tab.dataset.tab}`;
                document.getElementById(panelId)?.classList.add('active');
            });
        });
    }

    /* =========================================
       工具列事件綁定
       ========================================= */
    bindToolbarEvents() {
        // === 首頁 Tab ===

        // 復原/重做
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (undoBtn) undoBtn.addEventListener('click', () => this.undo());
        if (redoBtn) redoBtn.addEventListener('click', () => this.redo());

        // 文字格式按鈕
        const boldBtn = document.getElementById('boldBtn');
        const italicBtn = document.getElementById('italicBtn');
        const underlineBtn = document.getElementById('underlineBtn');
        if (boldBtn) boldBtn.addEventListener('click', () => this.applyTextFormat('bold'));
        if (italicBtn) italicBtn.addEventListener('click', () => this.applyTextFormat('italic'));
        if (underlineBtn) underlineBtn.addEventListener('click', () => this.applyTextFormat('underline'));

        // 對齊
        const alignLeftBtn = document.getElementById('alignLeftBtn');
        const alignCenterBtn = document.getElementById('alignCenterBtn');
        const alignRightBtn = document.getElementById('alignRightBtn');
        if (alignLeftBtn) alignLeftBtn.addEventListener('click', () => this.applyTextAlign('left'));
        if (alignCenterBtn) alignCenterBtn.addEventListener('click', () => this.applyTextAlign('center'));
        if (alignRightBtn) alignRightBtn.addEventListener('click', () => this.applyTextAlign('right'));

        // 字型大小
        const fontSizeSelect = document.getElementById('fontSize');
        if (fontSizeSelect) {
            fontSizeSelect.addEventListener('change', (e) => {
                this.applyFontSize(parseInt(e.target.value));
            });
        }

        // 字體
        const fontFamilySelect = document.getElementById('fontFamily');
        if (fontFamilySelect) {
            fontFamilySelect.addEventListener('change', (e) => {
                this.applyFontFamily(e.target.value);
            });
        }

        // 文字顏色
        const fontColorPicker = document.getElementById('fontColorPicker');
        if (fontColorPicker) {
            fontColorPicker.addEventListener('input', (e) => {
                this.applyFontColor(e.target.value);
                document.getElementById('fontColorIndicator').style.background = e.target.value;
            });
        }

        // 複製/刪除/圖層
        const duplicateBtn = document.getElementById('duplicateBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const layerUpBtn = document.getElementById('layerUpBtn');
        const layerDownBtn = document.getElementById('layerDownBtn');
        if (duplicateBtn) duplicateBtn.addEventListener('click', () => this.duplicateElement());
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.editor.deleteSelected());
        if (layerUpBtn) layerUpBtn.addEventListener('click', () => this.moveLayer('up'));
        if (layerDownBtn) layerDownBtn.addEventListener('click', () => this.moveLayer('down'));

        // 簡報模式
        document.getElementById('presentBtn')?.addEventListener('click', () => {
            this.startPresentation();
        });

        // === 插入 Tab ===

        // 新增文字
        document.getElementById('addTextBtn').addEventListener('click', () => {
            this.editor.addText();
        });

        // 新增圖形
        document.getElementById('addShapeBtn').addEventListener('click', (e) => {
            this.showShapePicker(e.currentTarget);
        });

        // 上傳圖片
        document.getElementById('uploadImageBtn').addEventListener('click', () => {
            document.getElementById('imageUpload').click();
        });

        // 新增影片
        document.getElementById('addVideoBtn').addEventListener('click', () => {
            this.showVideoModal();
        });

        // 新增音檔
        document.getElementById('addAudioBtn').addEventListener('click', () => {
            document.getElementById('audioUpload').click();
        });

        // 連連看
        document.getElementById('addMatchingBtn').addEventListener('click', () => {
            this.editor.addMatching();
        });

        // 填空題
        document.getElementById('addFillBlankBtn').addEventListener('click', () => {
            this.editor.addFillBlank();
        });

        // 排列順序
        document.getElementById('addOrderingBtn').addEventListener('click', () => {
            this.editor.addOrdering();
        });

        // 選擇題
        document.getElementById('addQuizBtn')?.addEventListener('click', () => {
            this.editor.addQuiz();
        });

        // 投票
        document.getElementById('addPollBtn')?.addEventListener('click', () => {
            this.editor.addPoll();
        });

        // 是非題
        document.getElementById('addTrueFalseBtn')?.addEventListener('click', () => {
            this.editor.addTrueFalse();
        });

        // 開放問答
        document.getElementById('addOpenTextBtn')?.addEventListener('click', () => {
            this.editor.addOpenText();
        });

        // 量表評分
        document.getElementById('addScaleBtn')?.addEventListener('click', () => {
            this.editor.addScale();
        });

        // 搶答
        document.getElementById('addBuzzerBtn')?.addEventListener('click', () => {
            this.editor.addBuzzer();
        });

        // 文字雲
        document.getElementById('addWordCloudBtn')?.addEventListener('click', () => {
            this.editor.addWordCloud();
        });

        // 圖片標註
        document.getElementById('addHotspotBtn')?.addEventListener('click', () => {
            this.editor.addHotspot();
        });

        // AI 出題
        document.getElementById('aiQuizBtn')?.addEventListener('click', () => {
            this.openAiQuizModal();
        });

        // 背景音樂設定（上傳檔案）
        document.getElementById('bgmSettingBtn')?.addEventListener('click', () => {
            const current = localStorage.getItem('ix_bgm_url');
            if (current) {
                const action = confirm('已設定背景音樂。\n\n確定 → 重新上傳\n取消 → 清除音樂');
                if (!action) {
                    localStorage.removeItem('ix_bgm_url');
                    alert('已清除背景音樂');
                    return;
                }
            }
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'audio/*';
            input.addEventListener('change', () => {
                const file = input.files[0];
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) { alert('檔案太大（上限 10MB）'); return; }
                const reader = new FileReader();
                reader.onload = () => {
                    localStorage.setItem('ix_bgm_url', reader.result);
                    alert('✓ 已設定背景音樂：' + file.name);
                };
                reader.readAsDataURL(file);
            });
            input.click();
        });

        // AI 生成簡報
        document.getElementById('aiGenerateBtn')?.addEventListener('click', () => {
            this.openAiGenerateModal();
        });

        // AI 五階段按鈕
        document.getElementById('aiPhaseContentBtn')?.addEventListener('click', () => {
            this._loadOverlayPrompt('aiContentPrompt', 'slide_content');
            document.getElementById('aiContentOverlay').style.display = 'flex';
        });
        document.getElementById('aiContentClose')?.addEventListener('click', () => {
            document.getElementById('aiContentOverlay').style.display = 'none';
        });
        document.getElementById('aiContentStart')?.addEventListener('click', () => this.startAiPhase1());

        document.getElementById('aiPhaseVisualBtn')?.addEventListener('click', () => {
            document.getElementById('aiVisualSlideCount').textContent = this.slideManager.slides.length;
            this._loadOverlayPrompt('aiVisualPrompt', 'slide_visual');
            document.getElementById('aiVisualOverlay').style.display = 'flex';
        });
        document.getElementById('aiVisualClose')?.addEventListener('click', () => {
            document.getElementById('aiVisualOverlay').style.display = 'none';
        });
        document.getElementById('aiVisualStart')?.addEventListener('click', () => this.startAiPhase2Visual());

        document.getElementById('aiPhaseInteractiveBtn')?.addEventListener('click', () => {
            document.getElementById('aiInteractiveSlideCount').textContent = this.slideManager.slides.length;
            this._loadOverlayPrompt('aiInteractivePrompt', 'slide_interactive');
            document.getElementById('aiInteractiveOverlay').style.display = 'flex';
        });
        document.getElementById('aiInteractiveClose')?.addEventListener('click', () => {
            document.getElementById('aiInteractiveOverlay').style.display = 'none';
        });
        document.getElementById('aiInteractiveStart')?.addEventListener('click', () => this.startAiPhase3Interactive());

        document.getElementById('aiPhaseAnimBtn')?.addEventListener('click', () => {
            document.getElementById('aiAnimSlideCount').textContent = this.slideManager.slides.length;
            document.getElementById('aiAnimOverlay').style.display = 'flex';
        });
        document.getElementById('aiAnimClose')?.addEventListener('click', () => {
            document.getElementById('aiAnimOverlay').style.display = 'none';
        });
        document.getElementById('aiAnimStart')?.addEventListener('click', () => this.startAiPhase4Anim());

        document.getElementById('aiPhaseDesignBtn')?.addEventListener('click', () => {
            this.openAiDesignModal();
        });
        document.getElementById('aiDesignClose')?.addEventListener('click', () => {
            document.getElementById('aiDesignOverlay').style.display = 'none';
        });
        document.getElementById('aiDesignStart')?.addEventListener('click', () => this.startAiPhase5Design());

        // Phase 6: 講師教學大綱
        document.getElementById('aiPhaseNotesBtn')?.addEventListener('click', () => {
            document.getElementById('aiNotesOverlay').style.display = 'flex';
            this._loadOverlayPrompt('aiNotesPrompt', 'slide_teaching_notes');
        });
        document.getElementById('aiNotesClose')?.addEventListener('click', () => {
            document.getElementById('aiNotesOverlay').style.display = 'none';
        });
        document.getElementById('aiNotesStart')?.addEventListener('click', () => this.startAiPhase6Notes());

        // 問卷驅動
        document.getElementById('aiSurveyAdjustBtn')?.addEventListener('click', () => {
            document.getElementById('aiSurveyOverlay').style.display = 'flex';
            this._loadOverlayPrompt('aiSurveyPrompt', 'slide_survey_adjust');
        });
        document.getElementById('aiSurveyClose')?.addEventListener('click', () => {
            document.getElementById('aiSurveyOverlay').style.display = 'none';
        });
        document.getElementById('aiSurveyLoadBtn')?.addEventListener('click', () => this.loadSurveyData());
        document.getElementById('aiSurveyStart')?.addEventListener('click', () => this.startSurveyAdjust());

        // 複製文字卡片
        document.getElementById('copyCardBtn').addEventListener('click', () => {
            this.editor.addCopyCard();
        });

        // 文件檢視器
        document.getElementById('addDocumentBtn')?.addEventListener('click', () => {
            this.editor.addDocument();
        });

        // 圖表
        document.getElementById('addBarChartBtn')?.addEventListener('click', () => this.editor.addChart('bar'));
        document.getElementById('addHBarChartBtn')?.addEventListener('click', () => this.editor.addChart('horizontal-bar'));
        document.getElementById('addDonutChartBtn')?.addEventListener('click', () => this.editor.addChart('donut'));

        // 流動線條
        document.getElementById('addFlowLineBtn')?.addEventListener('click', () => this.editor.addFlowLine());

        // 作業提交
        document.getElementById('addHomeworkBtn').addEventListener('click', () => {
            this.showHomeworkDialog();
        });

        // 展示牆
        document.getElementById('addShowcaseBtn')?.addEventListener('click', () => {
            this.addShowcaseElement();
        });

        // 新聞模組
        document.getElementById('addNewsBtn')?.addEventListener('click', () => {
            document.getElementById('newsOverlay').style.display = 'flex';
            // 自動帶入簡報主題
            const titleEl = document.querySelector('.header-presentation-title');
            if (titleEl && !document.getElementById('newsTopicInput').value) {
                document.getElementById('newsTopicInput').value = titleEl.textContent.trim();
            }
        });
        document.getElementById('newsOverlayClose')?.addEventListener('click', () => {
            document.getElementById('newsOverlay').style.display = 'none';
        });
        document.getElementById('newsSearchBtn')?.addEventListener('click', () => this.searchAndInsertNews());

        // === PDF 匯入 ===
        this._pdfFile = null;
        const pdfOverlay = document.getElementById('pdfImportOverlay');
        const pdfDropZone = document.getElementById('pdfDropZone');
        const pdfUploadInput = document.getElementById('pdfUpload');
        const pdfConfirmBtn = document.getElementById('pdfImportConfirm');

        document.getElementById('importPdfBtn')?.addEventListener('click', () => {
            this._pdfFile = null;
            pdfDropZone.classList.remove('has-file');
            pdfDropZone.querySelector('p').textContent = '拖拽 PDF 檔案到此處，或點擊選擇';
            pdfConfirmBtn.disabled = true;
            document.getElementById('pdfImportProgress').classList.remove('active');
            document.getElementById('pdfProgressFill').style.width = '0%';
            pdfOverlay.classList.add('active');
        });

        // 拖拽
        pdfDropZone?.addEventListener('dragover', (e) => { e.preventDefault(); pdfDropZone.classList.add('drag-over'); });
        pdfDropZone?.addEventListener('dragleave', () => pdfDropZone.classList.remove('drag-over'));
        pdfDropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            pdfDropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                this._pdfFile = file;
                pdfDropZone.classList.add('has-file');
                pdfDropZone.querySelector('p').textContent = `📄 ${file.name}（${(file.size / 1024 / 1024).toFixed(1)} MB）`;
                pdfConfirmBtn.disabled = false;
            }
        });
        pdfDropZone?.addEventListener('click', () => pdfUploadInput.click());
        pdfUploadInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this._pdfFile = file;
                pdfDropZone.classList.add('has-file');
                pdfDropZone.querySelector('p').textContent = `📄 ${file.name}（${(file.size / 1024 / 1024).toFixed(1)} MB）`;
                pdfConfirmBtn.disabled = false;
            }
        });

        // 關閉
        document.getElementById('pdfImportClose')?.addEventListener('click', () => pdfOverlay.classList.remove('active'));
        document.getElementById('pdfImportCancel')?.addEventListener('click', () => pdfOverlay.classList.remove('active'));

        // 確認匯入
        pdfConfirmBtn?.addEventListener('click', async () => {
            if (!this._pdfFile) return;
            const mode = document.querySelector('input[name="pdfMode"]:checked')?.value || 'image';
            const progress = document.getElementById('pdfImportProgress');
            const progressText = document.getElementById('pdfProgressText');
            const progressFill = document.getElementById('pdfProgressFill');

            progress.classList.add('active');
            pdfConfirmBtn.disabled = true;

            try {
                const count = await this.slideManager.importFromPDF(this._pdfFile, mode, (done, total, msg) => {
                    progressText.textContent = msg;
                    progressFill.style.width = `${(done / total) * 100}%`;
                });
                progressFill.style.width = '100%';
                progressText.textContent = `✅ 已匯入 ${count} 頁投影片`;
                this.showToast(`已匯入 ${count} 頁投影片`);
                setTimeout(() => pdfOverlay.classList.remove('active'), 1500);
            } catch (err) {
                progressText.textContent = `❌ 匯入失敗：${err.message}`;
                pdfConfirmBtn.disabled = false;
            }
        });

        // === 活動開場封面頁 ===
        const eventOverlay = document.getElementById('eventOpenerOverlay');
        document.getElementById('insertEventOpenerBtn')?.addEventListener('click', () => {
            if (eventOverlay) eventOverlay.style.display = 'flex';
        });
        document.getElementById('eventOpenerClose')?.addEventListener('click', () => {
            if (eventOverlay) eventOverlay.style.display = 'none';
        });
        eventOverlay?.addEventListener('click', (e) => {
            if (e.target === eventOverlay) eventOverlay.style.display = 'none';
        });
        document.getElementById('eventOpenerInsert')?.addEventListener('click', async () => {
            const title = document.getElementById('eventOpenerTitle')?.value?.trim();
            if (!title) { this.showToast('請輸入課程標題'); return; }
            const subtitle = document.getElementById('eventOpenerSubtitle')?.value?.trim() || '';
            const wifi = document.getElementById('eventOpenerWifi')?.value?.trim() || '';
            const password = document.getElementById('eventOpenerPassword')?.value?.trim() || '';
            const instructorName = document.getElementById('eventOpenerInstructor')?.value?.trim() || '';

            // 讀取講師頭像
            let avatarSrc = '';
            const avatarFile = document.getElementById('eventOpenerAvatar')?.files?.[0];
            if (avatarFile) {
                avatarSrc = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.readAsDataURL(avatarFile);
                });
            }

            const gen = () => this.slideManager.generateId();
            const elements = [];

            // 背景漸層裝飾色塊（深色底 + 幾何裝飾）
            elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)' });
            // 頂部裝飾線
            elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 50, width: 80, height: 4, background: '#818cf8' });
            elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 50, width: 4, height: 30, background: '#818cf8' });
            // 左下裝飾
            elements.push({ id: gen(), type: 'shape', shapeType: 'circle', x: 30, y: 400, width: 100, height: 100, background: 'rgba(99,102,241,0.1)' });

            // ── 右上角：課前入口 QR Code ──
            const projectId = this.slideManager.projectId || '';
            const preClassUrl = `${location.origin}/audience.html?id=${projectId}&phase=pre`;
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(preClassUrl)}&bgcolor=ffffff&color=312e81`;
            // QR Code 背景卡片
            elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 740, y: 25, width: 190, height: 190, background: 'rgba(255,255,255,0.08)', borderRadius: 14 });
            elements.push({
                id: gen(), type: 'image', x: 775, y: 35, width: 120, height: 120,
                src: qrApiUrl, label: '課前入口 QR Code'
            });
            elements.push({
                id: gen(), type: 'text', x: 740, y: 160, width: 190, height: 20,
                content: `<span style="font-size:11px;color:#a5b4fc;text-align:center;display:block;">📱 掃描進入課前頁</span>`,
                fontSize: 11
            });
            elements.push({
                id: gen(), type: 'text', x: 740, y: 180, width: 190, height: 20,
                content: `<span style="font-size:9px;color:rgba(255,255,255,0.3);text-align:center;display:block;">完成問卷 · 準備上課</span>`,
                fontSize: 9
            });

            // 主標題
            elements.push({
                id: gen(), type: 'text', x: 60, y: 100, width: 650, height: 70,
                content: `<b style="font-size:42px;color:#ffffff;letter-spacing:2px;">${title}</b>`,
                fontSize: 42, bold: true, textAlign: 'left'
            });

            // 副標題
            if (subtitle) {
                elements.push({
                    id: gen(), type: 'text', x: 60, y: 180, width: 650, height: 35,
                    content: `<span style="font-size:20px;color:#a5b4fc;">${subtitle}</span>`,
                    fontSize: 20, textAlign: 'left'
                });
            }

            // Wi-Fi 資訊卡片
            if (wifi) {
                const yWifi = subtitle ? 250 : 220;
                // 卡片背景
                elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: yWifi, width: 380, height: password ? 110 : 70, background: 'rgba(255,255,255,0.08)', borderRadius: 12 });
                // Wi-Fi 圖標 + 標題
                elements.push({
                    id: gen(), type: 'text', x: 80, y: yWifi + 12, width: 340, height: 30,
                    content: `<span style="font-size:14px;color:#818cf8;">📶 Wi-Fi 連線資訊</span>`,
                    fontSize: 14
                });
                // SSID
                elements.push({
                    id: gen(), type: 'text', x: 80, y: yWifi + 40, width: 340, height: 26,
                    content: `<span style="font-size:16px;color:#e0e7ff;">名稱：<b style="color:#fff;">${wifi}</b></span>`,
                    fontSize: 16
                });
                // 密碼
                if (password) {
                    elements.push({
                        id: gen(), type: 'text', x: 80, y: yWifi + 68, width: 340, height: 26,
                        content: `<span style="font-size:16px;color:#e0e7ff;">密碼：<b style="color:#fff;">${password}</b></span>`,
                        fontSize: 16
                    });
                }
            }

            // ── 講師資訊（右下角）──
            if (instructorName || avatarSrc) {
                const yInst = 440;
                // 講師卡片背景
                elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 680, y: yInst, width: 250, height: 70, background: 'rgba(255,255,255,0.06)', borderRadius: 10 });
                if (avatarSrc) {
                    elements.push({
                        id: gen(), type: 'image', x: 695, y: yInst + 10, width: 50, height: 50,
                        src: avatarSrc, label: '講師頭像', borderRadius: 25
                    });
                }
                if (instructorName) {
                    const textX = avatarSrc ? 755 : 695;
                    elements.push({
                        id: gen(), type: 'text', x: textX, y: yInst + 12, width: 160, height: 22,
                        content: `<span style="font-size:10px;color:#818cf8;">講師</span>`,
                        fontSize: 10
                    });
                    elements.push({
                        id: gen(), type: 'text', x: textX, y: yInst + 32, width: 160, height: 26,
                        content: `<b style="font-size:16px;color:#ffffff;">${instructorName}</b>`,
                        fontSize: 16
                    });
                }
            }

            // 「課程即將開始」提示
            const yBottom = instructorName || avatarSrc ? 420 : 440;
            elements.push({ id: gen(), type: 'shape', shapeType: 'circle', x: 60, y: yBottom, width: 12, height: 12, background: '#34d399' });
            elements.push({
                id: gen(), type: 'text', x: 82, y: yBottom - 4, width: 400, height: 24,
                content: `<span style="font-size:15px;color:#6ee7b7;">課程即將開始，請稍候 ...</span>`,
                fontSize: 15
            });

            // 底部分隔線
            elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: yBottom + 30, width: 840, height: 1, background: 'rgba(255,255,255,0.1)' });
            // 底部日期
            const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
            elements.push({
                id: gen(), type: 'text', x: 60, y: yBottom + 40, width: 400, height: 22,
                content: `<span style="font-size:13px;color:rgba(255,255,255,0.4);">${today}</span>`,
                fontSize: 13
            });

            // 插入為第 1 頁
            const slide = { id: gen(), elements, background: '#0f172a' };
            this.slideManager.slides.unshift(slide);
            this.slideManager.currentIndex = 0;
            this.slideManager.renderCurrentSlide();
            this.slideManager.renderThumbnails();
            this.slideManager.updateCounter();
            this.slideManager.save();

            if (eventOverlay) eventOverlay.style.display = 'none';
            this.showToast('✅ 已在第 1 頁插入活動開場封面');
        });

        // === 匯出 ===
        this._exporter = new SlideExporter(this.slideManager);
        const exportOverlay = document.getElementById('exportOverlay');
        const exportStatusText = document.getElementById('exportStatusText');
        const exportProgressFill = document.getElementById('exportProgressFill');
        const exportConfigArea = document.getElementById('exportConfigArea');
        const exportProgressArea = document.getElementById('exportProgressArea');
        const exportFooter = document.getElementById('exportFooter');

        const exportModalBtn = document.getElementById('exportModalBtn');
        const exportFormatSelect = document.getElementById('exportFormatSelect');
        const exportRangeInput = document.getElementById('exportRangeInput');
        const exportConfirmBtn = document.getElementById('exportConfirmBtn');
        const exportCancelBtn = document.getElementById('exportCancelBtn');

        // 打開 Modal
        exportModalBtn?.addEventListener('click', () => {
            exportConfigArea.style.display = 'block';
            exportProgressArea.style.display = 'none';
            exportFooter.style.display = 'flex';
            exportOverlay.classList.add('active');
        });

        // 關閉 Modal
        const closeExportModal = () => exportOverlay.classList.remove('active');
        document.getElementById('exportOverlayClose')?.addEventListener('click', closeExportModal);
        exportCancelBtn?.addEventListener('click', closeExportModal);

        // 範圍切換邏輯
        document.querySelectorAll('input[name="exportRange"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    exportRangeInput.disabled = false;
                    exportRangeInput.focus();
                } else {
                    exportRangeInput.disabled = true;
                }
            });
        });

        const runExport = async () => {
            const method = exportFormatSelect.value;
            const rangeType = document.querySelector('input[name="exportRange"]:checked').value;
            const rangeStr = exportRangeInput.value.trim();

            // 解析範圍 (只選出特定 slides)
            let selectedSlides = [];
            const allSlides = this.slideManager.slides;

            if (rangeType === 'all') {
                selectedSlides = [...allSlides];
            } else if (rangeType === 'current') {
                const curSlide = this.slideManager.getCurrentSlide();
                if (curSlide) selectedSlides.push(curSlide);
            } else if (rangeType === 'custom') {
                if (!rangeStr) {
                    this.showToast('請輸入自訂範圍', 'error');
                    return;
                }
                const parsed = this._exporter.parseRange(rangeStr, allSlides.length);
                if (parsed.length === 0) {
                    this.showToast('無法解析範圍格式，請確認輸入正確', 'error');
                    return;
                }
                selectedSlides = parsed.map(idx => allSlides[idx]);
            }

            if (selectedSlides.length === 0) {
                this.showToast('找不到符合條件的投影片', 'error');
                return;
            }

            // 切換為進度顯示狀態
            exportConfigArea.style.display = 'none';
            exportFooter.style.display = 'none';
            exportProgressArea.style.display = 'block';

            exportStatusText.textContent = '準備中...';
            exportProgressFill.style.width = '0%';
            try {
                // 將 selectedSlides 傳遞給 exporter
                await this._exporter[method](selectedSlides, (done, total, msg) => {
                    exportStatusText.textContent = msg;
                    exportProgressFill.style.width = `${Math.round((done / total) * 100)}%`;
                });
                exportStatusText.textContent = '✅ 匯出完成！';
                exportProgressFill.style.width = '100%';
                setTimeout(() => exportOverlay.classList.remove('active'), 1500);
            } catch (err) {
                exportStatusText.textContent = `❌ 匯出失敗：${err.message}`;
                console.error('Export error:', err);
                exportFooter.style.display = 'flex'; // 出錯可讓用戶點取消
            }
        };

        exportConfirmBtn?.addEventListener('click', runExport);

        // 儲存
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.slideManager.save();
            this.showToast('已儲存');
        });

        // === 設計 Tab ===

        // 背景色板
        document.querySelectorAll('.theme-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                const bg = swatch.dataset.bg;
                this.applySlideBackground(bg);
            });
        });

        // 自訂背景色
        const bgColorPicker = document.getElementById('bgColorPicker');
        if (bgColorPicker) {
            bgColorPicker.addEventListener('input', (e) => {
                this.applySlideBackground(e.target.value);
            });
        }

        // 重設背景
        const resetBgBtn = document.getElementById('resetBgBtn');
        if (resetBgBtn) {
            resetBgBtn.addEventListener('click', () => {
                this.applySlideBackground('#ffffff');
                document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
                document.querySelector('.theme-swatch[data-bg="#ffffff"]')?.classList.add('active');
            });
        }

        // 過場動畫按鈕
        document.querySelectorAll('.transition-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.transition-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const slide = this.slideManager.getCurrentSlide();
                if (slide) {
                    slide.transition = btn.dataset.transition;
                    this.slideManager.save();
                    // 立即預覽
                    this.slideManager.renderCurrentSlide();
                }
            });
        });

        // 切換投影片時同步過場按鈕狀態
        window.addEventListener('slideRendered', (e) => {
            const slide = e.detail;
            if (slide) {
                const t = slide.transition || 'fade';
                document.querySelectorAll('.transition-btn').forEach(b => b.classList.remove('active'));
                document.querySelector(`.transition-btn[data-transition="${t}"]`)?.classList.add('active');
            }
        });
    }

    /* =========================================
       文字格式操作
       ========================================= */
    applyTextFormat(format) {
        const el = this.editor.selectedElement;
        if (!el || el.dataset.type !== 'text') return;

        const id = el.dataset.id;
        const slide = this.slideManager.getCurrentSlide();
        const elementData = slide.elements.find(e => e.id === id);
        if (!elementData) return;

        switch (format) {
            case 'bold':
                elementData.bold = !elementData.bold;
                el.style.fontWeight = elementData.bold ? 'bold' : 'normal';
                break;
            case 'italic':
                elementData.italic = !elementData.italic;
                el.style.fontStyle = elementData.italic ? 'italic' : 'normal';
                break;
            case 'underline':
                elementData.underline = !elementData.underline;
                el.style.textDecoration = elementData.underline ? 'underline' : 'none';
                break;
        }
        this.slideManager.save();
    }

    applyTextAlign(align) {
        const el = this.editor.selectedElement;
        if (!el || el.dataset.type !== 'text') return;

        const id = el.dataset.id;
        el.style.textAlign = align;
        this.slideManager.updateElement(id, { textAlign: align });
    }

    applyFontSize(size) {
        const el = this.editor.selectedElement;
        if (!el || el.dataset.type !== 'text') return;

        const id = el.dataset.id;
        el.style.fontSize = `${size}px`;
        this.slideManager.updateElement(id, { fontSize: size });
    }

    applyFontFamily(family) {
        const el = this.editor.selectedElement;
        if (!el || el.dataset.type !== 'text') return;

        const id = el.dataset.id;
        el.style.fontFamily = family;
        this.slideManager.updateElement(id, { fontFamily: family });
    }

    applyFontColor(color) {
        const el = this.editor.selectedElement;
        if (!el || el.dataset.type !== 'text') return;

        const id = el.dataset.id;
        el.style.color = color;
        this.slideManager.updateElement(id, { color: color });
    }

    /* =========================================
       投影片背景
       ========================================= */
    applySlideBackground(bg) {
        const slide = this.slideManager.getCurrentSlide();
        if (!slide) return;

        slide.background = bg;
        const canvas = document.getElementById('slideCanvas');
        if (bg.startsWith('linear-gradient')) {
            canvas.style.background = bg;
        } else {
            canvas.style.background = bg;
        }
        this.slideManager.save();
        this.slideManager.renderThumbnails();
    }

    /* =========================================
       元素操作
       ========================================= */
    duplicateElement() {
        const el = this.editor.selectedElement;
        if (!el) return;

        const id = el.dataset.id;
        const slide = this.slideManager.getCurrentSlide();
        const elementData = slide.elements.find(e => e.id === id);
        if (!elementData) return;

        const newElement = JSON.parse(JSON.stringify(elementData));
        newElement.id = this.slideManager.generateId();
        newElement.x += 20;
        newElement.y += 20;

        this.slideManager.addElement(newElement);
    }

    moveLayer(direction) {
        const el = this.editor.selectedElement;
        if (!el) return;
        this.slideManager.moveElementLayer(el.dataset.id, direction);
    }

    duplicateCurrentSlide() {
        const slide = this.slideManager.getCurrentSlide();
        if (!slide) return;
        const dup = JSON.parse(JSON.stringify(slide));
        dup.id = this.slideManager.generateId();
        dup.elements.forEach(e => { e.id = this.slideManager.generateId(); });
        this.slideManager.slides.splice(this.slideManager.currentIndex + 1, 0, dup);
        this.slideManager.navigateTo(this.slideManager.currentIndex + 1);
        this.slideManager.renderThumbnails();
        this.slideManager.updateCounter();
        this.slideManager.save();
        this.showToast('已複製投影片');
    }

    deleteCurrentSlide() {
        if (this.slideManager.slides.length <= 1) {
            this.showToast('至少保留一張投影片');
            return;
        }
        this.slideManager.slides.splice(this.slideManager.currentIndex, 1);
        if (this.slideManager.currentIndex >= this.slideManager.slides.length) {
            this.slideManager.currentIndex = this.slideManager.slides.length - 1;
        }
        this.slideManager.renderCurrentSlide();
        this.slideManager.renderThumbnails();
        this.slideManager.updateCounter();
        this.slideManager.save();
        this.showToast('已刪除投影片');
    }

    /* =========================================
       Undo / Redo (簡化版)
       ========================================= */
    saveState() {
        const state = JSON.stringify(this.slideManager.slides);
        this.undoStack.push(state);
        if (this.undoStack.length > 50) this.undoStack.shift();
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const currentState = JSON.stringify(this.slideManager.slides);
        this.redoStack.push(currentState);

        const prevState = this.undoStack.pop();
        this.slideManager.slides = JSON.parse(prevState);
        this.slideManager.renderCurrentSlide();
        this.slideManager.renderThumbnails();
        this.slideManager.updateCounter();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const currentState = JSON.stringify(this.slideManager.slides);
        this.undoStack.push(currentState);

        const nextState = this.redoStack.pop();
        this.slideManager.slides = JSON.parse(nextState);
        this.slideManager.renderCurrentSlide();
        this.slideManager.renderThumbnails();
        this.slideManager.updateCounter();
    }

    /* =========================================
       作業功能
       ========================================= */
    showHomeworkDialog() {
        this.addHomeworkElement();
    }

    addHomeworkElement() {
        // 建立配置 dialog
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `
            <div class="modal" style="max-width:420px;width:92vw;background:#fff;border-radius:16px;overflow:hidden;">
                <div class="modal-header">
                    <h3 style="margin:0;font-size:1.1rem;">📝 新增作業元素</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body" style="padding:16px;">
                    <label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:6px;">作業標題</label>
                    <input type="text" id="hwConfigTitle" value="課堂作業" 
                           style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:0.9rem;margin-bottom:12px;">
                    
                    <label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:6px;">作業說明</label>
                    <textarea id="hwConfigDesc" rows="2"
                              style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:0.85rem;resize:vertical;margin-bottom:12px;"
                               placeholder="請根據今天所學的內容，完成以下作業..."></textarea>
                    
                    <label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:6px;">作業範例 <span style="font-weight:400;color:#9ca3af;font-size:0.78rem;">（選填）</span></label>
                    <textarea id="hwConfigExample" rows="3"
                              style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:0.85rem;resize:vertical;margin-bottom:12px;"
                              placeholder="提供作業範例或步驟說明，幫助學生了解預期成果..."></textarea>
                    
                    <label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:8px;">繳交格式</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;" id="hwModeGrid">
                        <label class="hw-mode-card" data-mode="image_only" style="display:flex;flex-direction:column;align-items:center;padding:14px 8px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all .15s;">
                            <input type="radio" name="hwMode" value="image_only" style="display:none;">
                            <span style="font-size:1.6rem;margin-bottom:4px;">🖼️</span>
                            <span style="font-size:0.82rem;font-weight:600;">純圖片</span>
                            <span style="font-size:0.7rem;color:#6b7280;">上傳圖片即完成</span>
                        </label>
                        <label class="hw-mode-card" data-mode="image_prompt" style="display:flex;flex-direction:column;align-items:center;padding:14px 8px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all .15s;">
                            <input type="radio" name="hwMode" value="image_prompt" style="display:none;">
                            <span style="font-size:1.6rem;margin-bottom:4px;">📷💬</span>
                            <span style="font-size:0.82rem;font-weight:600;">圖片 + 提示詞</span>
                            <span style="font-size:0.7rem;color:#6b7280;">圖片和 Prompt 都要交</span>
                        </label>
                        <label class="hw-mode-card" data-mode="text_only" style="display:flex;flex-direction:column;align-items:center;padding:14px 8px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all .15s;">
                            <input type="radio" name="hwMode" value="text_only" style="display:none;">
                            <span style="font-size:1.6rem;margin-bottom:4px;">📝</span>
                            <span style="font-size:0.82rem;font-weight:600;">純文字</span>
                            <span style="font-size:0.7rem;color:#6b7280;">輸入文字即完成</span>
                        </label>
                        <label class="hw-mode-card" data-mode="" style="display:flex;flex-direction:column;align-items:center;padding:14px 8px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all .15s;">
                            <input type="radio" name="hwMode" value="" checked style="display:none;">
                            <span style="font-size:1.6rem;margin-bottom:4px;">📋</span>
                            <span style="font-size:0.82rem;font-weight:600;">全功能</span>
                            <span style="font-size:0.7rem;color:#6b7280;">文字/圖/影/音/連結</span>
                        </label>
                    </div>
                </div>
                <div class="modal-footer" style="padding:12px 16px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e5e7eb;">
                    <button class="btn" onclick="this.closest('.modal-overlay').remove()" style="padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:white;cursor:pointer;">取消</button>
                    <button id="hwConfigConfirm" class="btn" style="padding:8px 20px;border:none;border-radius:6px;background:#4A7AE8;color:white;font-weight:600;cursor:pointer;">插入作業</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 模式卡片選取效果 + 自動更新範例
        const cards = overlay.querySelectorAll('.hw-mode-card');
        const exampleTextarea = overlay.querySelector('#hwConfigExample');
        const examplePlaceholders = {
            image_only: '範例說明（學生將看到此示範）：\n\n🖼️ 請上傳一張用 AI 生成的圖片\n\n✅ 範例圖片：一張用 Midjourney 生成的未來城市插畫',
            image_prompt: '範例說明（學生將看到此示範）：\n\n💬 Prompt 範例：\n「A futuristic city with flying cars, cyberpunk style, neon lights, 4K」\n\n🖼️ 範例圖片：使用上述 Prompt 在 Midjourney 生成的結果\n\n💡 提示：好的 Prompt 應包含主題、風格、細節描述',
            text_only: '範例說明（學生將看到此示範）：\n\n📝 範例回答：\n「今天學到了 Prompt Engineering 的三個核心技巧：\n1. 角色設定 - 告訴 AI 你希望它扮演什麼角色\n2. 具體描述 - 用明確的語言描述你要的結果\n3. 限制條件 - 設定字數、格式等限制」',
            '': '範例說明（學生將看到此示範）：\n\n你可以提交文字、圖片、影片、音檔或連結'
        };
        const selectCard = (card) => {
            cards.forEach(c => { c.style.borderColor = '#e5e7eb'; c.style.background = 'white'; });
            card.style.borderColor = '#4A7AE8';
            card.style.background = '#eff6ff';
            card.querySelector('input').checked = true;
            // 自動更新範例 placeholder
            const mode = card.dataset.mode ?? '';
            if (exampleTextarea && !exampleTextarea.value.trim()) {
                exampleTextarea.placeholder = examplePlaceholders[mode] || examplePlaceholders[''];
            }
        };
        cards.forEach(card => card.addEventListener('click', () => selectCard(card)));
        // 預設選「全功能」
        selectCard(cards[3]);

        // 確認
        overlay.querySelector('#hwConfigConfirm').addEventListener('click', () => {
            const title = overlay.querySelector('#hwConfigTitle').value.trim() || '課堂作業';
            const desc = overlay.querySelector('#hwConfigDesc').value.trim();
            const example = overlay.querySelector('#hwConfigExample').value.trim();
            const mode = overlay.querySelector('input[name="hwMode"]:checked')?.value || '';
            overlay.remove();

            const modeLabels = { image_only: '📷 上傳圖片', image_prompt: '📷💬 圖片+提示詞', text_only: '📝 文字繳交', '': '📋 全功能' };
            const element = {
                type: 'homework',
                x: 30,
                y: 30,
                width: 900,
                height: 540,
                title,
                description: desc,
                example: example || null,
                submissionMode: mode || null,
                modeLabel: modeLabels[mode] || '📋 全功能'
            };
            this.slideManager.addElement(element);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    async searchAndInsertNews() {
        const topic = document.getElementById('newsTopicInput').value.trim();
        if (!topic) { alert('請輸入搜尋主題'); return; }

        const btn = document.getElementById('newsSearchBtn');
        const statusEl = document.getElementById('newsStatus');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;animation:spin 1s linear infinite;">progress_activity</span> 搜尋中...';

        try {
            const { NewsCrawler } = await import('./newsCrawler.js');
            const crawler = new NewsCrawler();
            crawler.onProgress = (percent, msg) => {
                statusEl.textContent = `${Math.round(percent)}% - ${msg}`;
            };

            const perPage = parseInt(document.getElementById('newsPerPage').value) || 4;
            const pages = parseInt(document.getElementById('newsPages').value) || 1;
            const dateRange = document.getElementById('newsDateRange')?.value || '14d';

            const newsItems = await crawler.fetchNews(topic, { count: perPage, pages, dateRange });
            const newSlides = crawler.buildNewsSlides(newsItems, perPage);

            // 在當前位置之後插入
            const insertIdx = this.slideManager.currentIndex + 1;
            for (let i = 0; i < newSlides.length; i++) {
                this.slideManager.slides.splice(insertIdx + i, 0, newSlides[i]);
            }

            this.slideManager.currentIndex = insertIdx;
            this.slideManager.renderThumbnails();
            this.slideManager.renderCurrentSlide();
            this.slideManager.updateCounter();
            this.slideManager.save();

            const newsPages = newSlides.map((s, sIdx) => {
                const newsEl = (s.elements || []).find(e => e.type === 'news');
                const titles = newsEl?.items?.map(n => n.title).slice(0, 2).join('、') || '新聞';
                return { page: insertIdx + sIdx + 1, desc: titles.substring(0, 40) };
            });
            const report = this._buildResultReport('新聞插入', [{
                label: `已在第 ${insertIdx + 1}${newSlides.length > 1 ? `-${insertIdx + newSlides.length}` : ''} 頁插入 ${newsItems.length} 則新聞`,
                pages: newsPages
            }]);
            statusEl.innerHTML = report;
        } catch (err) {
            console.error('新聞搜尋失敗:', err);
            statusEl.innerHTML = `<span style="color:#dc2626;">搜尋失敗: ${err.message}</span>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">newspaper</span> 搜尋並插入新聞';
        }
    }

    async addShowcaseElement() {
        // 收集所有 slides 中的 homework 元素
        const homeworks = [];
        this.slideManager.slides.forEach((slide, si) => {
            (slide.elements || []).forEach(el => {
                if (el.type === 'homework') {
                    homeworks.push({ id: el.id, title: el.title || '課堂作業', slideIndex: si });
                }
            });
        });

        let assignmentTitle = '';
        let linkedHomeworkId = null;

        if (homeworks.length > 0) {
            // 顯示選擇 dialog
            const result = await new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'modal-overlay active';
                const listHtml = homeworks.map((hw, i) => `
                    <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;transition:all .15s;" class="hw-pick-card" data-idx="${i}">
                        <input type="radio" name="hwPick" value="${i}" ${i === 0 ? 'checked' : ''} style="display:none;">
                        <span style="font-size:1.2rem;">📝</span>
                        <div>
                            <div style="font-weight:600;font-size:0.9rem;">${hw.title}</div>
                            <div style="font-size:0.75rem;color:#6b7280;">投影片 ${hw.slideIndex + 1}</div>
                        </div>
                    </label>
                `).join('');
                overlay.innerHTML = `
                    <div class="modal" style="max-width:380px;width:90%;">
                        <div class="modal-header"><h3 style="margin:0;font-size:1.1rem;">🖼️ 新增作業牆</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button></div>
                        <div class="modal-body" style="padding:16px;">
                            <p style="font-size:0.85rem;color:#64748b;margin:0 0 10px;">選擇要展示的作業：</p>
                            <div style="display:flex;flex-direction:column;gap:6px;">${listHtml}</div>
                        </div>
                        <div class="modal-footer" style="padding:12px 16px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e5e7eb;">
                            <button class="btn" onclick="this.closest('.modal-overlay').remove()" style="padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:white;cursor:pointer;">取消</button>
                            <button id="hwPickConfirm" class="btn" style="padding:8px 20px;border:none;border-radius:6px;background:#4A7AE8;color:white;font-weight:600;cursor:pointer;">插入作業牆</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);
                const cards = overlay.querySelectorAll('.hw-pick-card');
                cards.forEach(c => c.addEventListener('click', () => {
                    cards.forEach(cc => { cc.style.borderColor = '#e5e7eb'; cc.style.background = 'white'; });
                    c.style.borderColor = '#4A7AE8';
                    c.style.background = '#eff6ff';
                    c.querySelector('input').checked = true;
                }));
                if (cards[0]) { cards[0].style.borderColor = '#4A7AE8'; cards[0].style.background = '#eff6ff'; }
                overlay.querySelector('#hwPickConfirm').addEventListener('click', () => {
                    const idx = parseInt(overlay.querySelector('input[name="hwPick"]:checked')?.value);
                    overlay.remove();
                    resolve(isNaN(idx) ? null : homeworks[idx]);
                });
                overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
            });
            if (!result) return;
            assignmentTitle = result.title;
            linkedHomeworkId = result.id;
        } else {
            const title = await showInput('請輸入要展示的作業名稱（例如：AI 應用心得）', { title: '新增作品展示' });
            if (!title) return;
            assignmentTitle = title.trim();
        }

        const element = {
            type: 'showcase',
            x: 30,
            y: 30,
            width: 900,
            height: 470,
            assignmentTitle,
            linkedHomeworkId,
            linkedHomeworkTitle: assignmentTitle
        };
        this.slideManager.addElement(element);
    }

    /* =========================================
       UI 事件
       ========================================= */
    bindUIEvents() {
        // 收合/展開投影片面板
        const slidePanel = document.getElementById('slidePanel');
        const collapseBtn = document.getElementById('panelCollapseBtn');
        const expandBtn = document.getElementById('panelExpandBtn');
        if (collapseBtn && slidePanel) {
            collapseBtn.addEventListener('click', () => {
                slidePanel.classList.add('collapsed');
                if (expandBtn) expandBtn.style.display = 'flex';
            });
        }
        if (expandBtn && slidePanel) {
            expandBtn.addEventListener('click', () => {
                slidePanel.classList.remove('collapsed');
                expandBtn.style.display = 'none';
            });
        }

        // 新增投影片 → 開啟模板選擇器
        document.getElementById('addSlideBtn').addEventListener('click', () => {
            this.openTemplatePicker();
        });

        // 投影片導航
        document.getElementById('prevSlideBtn').addEventListener('click', () => {
            this.slideManager.prev();
        });
        document.getElementById('nextSlideBtn').addEventListener('click', () => {
            this.slideManager.next();
        });

        // 形狀選擇器
        document.getElementById('shapePicker').addEventListener('click', (e) => {
            const option = e.target.closest('.shape-option');
            if (option) {
                this.editor.addShape(option.dataset.shape);
                this.hideShapePicker();
            }
        });

        // 點擊其他地方關閉形狀選擇器
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#shapePicker') && !e.target.closest('#addShapeBtn')) {
                this.hideShapePicker();
            }
        });

        // 模態框事件
        this.bindModalEvents();

        // 簡報模式事件
        this.bindPresentationEvents();

        // 鍵盤快捷鍵
        this.bindKeyboardShortcuts();
    }

    showShapePicker(button) {
        const picker = document.getElementById('shapePicker');
        const rect = button.getBoundingClientRect();
        picker.style.top = `${rect.bottom + 8}px`;
        picker.style.left = `${rect.left}px`;
        picker.classList.add('active');
    }

    hideShapePicker() {
        document.getElementById('shapePicker').classList.remove('active');
    }

    showVideoModal() {
        const overlay = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');

        title.textContent = '嵌入影片';
        body.innerHTML = `
            <div class="form-group">
                <label class="form-label">影片網址</label>
                <input type="text" class="form-input" id="videoUrl" placeholder="輸入 YouTube 或其他影片網址">
            </div>
            <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 8px;">
                支援 YouTube、Vimeo 等影片平台
            </p>
        `;

        overlay.classList.add('active');

        document.getElementById('modalConfirm').onclick = () => {
            const url = document.getElementById('videoUrl').value.trim();
            if (url) this.editor.addVideo(url);
            this.hideModal();
        };
    }

    bindModalEvents() {
        const overlay = document.getElementById('modalOverlay');
        document.getElementById('modalClose').addEventListener('click', () => this.hideModal());
        document.getElementById('modalCancel').addEventListener('click', () => this.hideModal());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hideModal();
        });
    }

    hideModal() {
        document.querySelector('.modal-overlay')?.classList.remove('active');
    }

    /* =========================================
       專案切換器
       ========================================= */
    updateProjectName() {
        const el = document.getElementById('projectName');
        if (el) el.textContent = this.slideManager.getCurrentProjectName();
    }

    /* =========================================
       返回管理頁
       ========================================= */
    bindLogoBack() {
        const backBtn = document.getElementById('backToManage');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.slideManager.save();
                location.href = 'manage.html';
            });
        }
    }

    bindProjectSwitcher() {
        const btn = document.getElementById('projectCurrentBtn');
        const dropdown = document.getElementById('projectDropdown');
        const listEl = document.getElementById('projectList');
        if (!btn || !dropdown) return;

        // Toggle dropdown
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('open');
            if (isOpen) {
                dropdown.classList.remove('open');
            } else {
                this.renderProjectList();
                dropdown.classList.add('open');
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#projectSwitcher')) {
                dropdown.classList.remove('open');
            }
        });

        // New project button — open modal
        document.getElementById('newProjectBtn')?.addEventListener('click', async () => {
            ['cpName', 'cpCourseLink', 'cpInstructor'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const err = document.getElementById('cpError');
            if (err) err.style.display = 'none';
            const modal = document.getElementById('createProjectModal');
            if (modal) modal.style.display = 'flex';
        });
    }

    renderProjectList() {
        const listEl = document.getElementById('projectList');
        if (!listEl) return;
        const projects = SlideManager.getProjects();
        const currentId = this.slideManager.currentProjectId;

        listEl.innerHTML = projects.map(p => `
                <div class="project-item ${p.id === currentId ? 'active' : ''}" data-id="${p.id}">
                    <span class="project-item-name">${p.name}</span>
                    <div class="project-item-actions">
                        <button class="project-item-btn rename" title="重新命名">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="project-item-btn delete" title="刪除">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </div>
            `).join('');

        // Click to switch
        listEl.querySelectorAll('.project-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                if (e.target.closest('.project-item-btn')) return;
                const id = item.dataset.id;
                if (id === currentId) return;
                this.slideManager.save();
                await this.slideManager.switchProject(id);
                this.updateProjectName();
                document.getElementById('projectDropdown').classList.remove('open');
                this.showToast(`已切換到「${SlideManager.getProjects().find(p => p.id === id)?.name}」`);
            });

            // Rename
            item.querySelector('.rename')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = item.dataset.id;
                const proj = SlideManager.getProjects().find(p => p.id === id);
                const newName = await showInput('重新命名', { title: '重新命名專案', defaultValue: proj?.name || '' });
                if (!newName) return;
                await SlideManager.renameProject(id, newName);
                this.updateProjectName();
                this.renderProjectList();
            });

            // Delete
            item.querySelector('.delete')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = item.dataset.id;
                const projects = SlideManager.getProjects();
                if (projects.length <= 1) {
                    showToast('至少需要保留一個專案', { type: 'error' });
                    return;
                }
                const proj = projects.find(p => p.id === id);
                const ok = await showConfirm(`確定刪除「${proj?.name}」？此操作無法復原。`, { title: '刪除專案', confirmText: '刪除', danger: true });
                if (!ok) return;
                await SlideManager.deleteProject(id);
                if (id === this.slideManager.currentProjectId) {
                    const remaining = SlideManager.getProjects();
                    await this.slideManager.switchProject(remaining[0].id);
                    this.updateProjectName();
                }
                this.renderProjectList();
                showToast('專案已刪除');
            });
        });
    }

    bindShareEntryLink() {
        const btn = document.getElementById('shareEntryLinkBtn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const projects = SlideManager.getProjects();
            const proj = projects.find(p => p.id === this.slideManager.currentProjectId);
            if (!proj) {
                this.showToast('請先建立專案');
                return;
            }

            // joinCode 已由 DB 管理，直接使用
            if (!proj.joinCode) {
                this.showToast('專案缺少入口碼，請重新建立');
                return;
            }

            const baseUrl = location.origin + location.pathname.replace(/\/[^/]*$/, '/');
            const portalUrl = `${baseUrl}portal.html?code=${proj.joinCode}`;
            const phaseLabels = { 'pre-class': '課前準備', 'in-class': '課程進行中', 'post-class': '課後回顧' };
            const currentPhase = proj.currentPhase || 'pre-class';

            // Create inline modal
            const existingModal = document.getElementById('shareEntryModal');
            if (existingModal) existingModal.remove();

            const modal = document.createElement('div');
            modal.id = 'shareEntryModal';
            modal.style.cssText = `
                    position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.4);
                    display:flex;align-items:center;justify-content:center;
                    backdrop-filter:blur(2px);
                `;
            modal.innerHTML = `
                    <div style="
                        background:#fff;border-radius:16px;padding:28px 24px;
                        max-width:480px;width:92%;box-shadow:0 12px 40px rgba(0,0,0,0.15);
                        font-family:'Noto Sans TC',sans-serif;
                    ">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                            <span style="font-size:1.1rem;font-weight:700;">📎 學員入口連結</span>
                            <button id="shareModalClose" style="border:none;background:none;cursor:pointer;font-size:1.3rem;color:#9aa0a6;">✕</button>
                        </div>
                        <div style="margin-bottom:16px;">
                            <label style="font-size:0.82rem;font-weight:600;color:#5f6368;display:block;margin-bottom:6px;">Join Code</label>
                            <div style="font-size:2rem;font-weight:800;letter-spacing:6px;color:#1a1a2e;text-align:center;padding:8px 0;">${proj.joinCode}</div>
                        </div>
                        <div style="margin-bottom:20px;">
                            <label style="font-size:0.82rem;font-weight:600;color:#5f6368;display:block;margin-bottom:6px;">入口網址</label>
                            <div style="display:flex;gap:8px;">
                                <input id="shareUrlInput" readonly value="${portalUrl}" style="
                                    flex:1;padding:9px 12px;border:2px solid #e2e8f0;border-radius:8px;
                                    font-size:0.85rem;font-family:monospace;background:#f8f9fa;color:#334155;
                                ">
                                <button id="copyUrlBtn" style="
                                    padding:9px 16px;background:#1a1a2e;
                                    color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;
                                    font-size:0.85rem;white-space:nowrap;
                                ">複製</button>
                            </div>
                        </div>
                        <div>
                            <label style="font-size:0.82rem;font-weight:600;color:#5f6368;display:block;margin-bottom:6px;">目前課程階段</label>
                            <div style="display:flex;gap:8px;">
                                ${['pre-class', 'in-class', 'post-class'].map(phase => `
                                    <button class="phaseBtn" data-phase="${phase}" style="
                                        flex:1;padding:10px 8px;border:2px solid ${phase === currentPhase ? '#1a1a2e' : '#e2e8f0'};
                                        border-radius:8px;background:${phase === currentPhase ? '#f0f0f0' : '#fff'};
                                        font-weight:${phase === currentPhase ? '700' : '500'};
                                        color:${phase === currentPhase ? '#1a1a2e' : '#64748b'};
                                        cursor:pointer;font-size:0.82rem;transition:all 0.2s;
                                    ">${phaseLabels[phase]}</button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            document.body.appendChild(modal);

            // Close
            modal.querySelector('#shareModalClose').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

            // Copy
            modal.querySelector('#copyUrlBtn').addEventListener('click', () => {
                navigator.clipboard.writeText(portalUrl).then(() => {
                    this.showToast('已複製入口連結');
                }).catch(() => {
                    modal.querySelector('#shareUrlInput').select();
                    document.execCommand('copy');
                    this.showToast('已複製入口連結');
                });
            });

            // Phase switching
            modal.querySelectorAll('.phaseBtn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const phase = btn.dataset.phase;
                    proj.currentPhase = phase;
                    SlideManager._saveProjectsIndex(projects);
                    SlideManager.updateProjectPhase(proj.joinCode, phase);
                    // Update button styles
                    modal.querySelectorAll('.phaseBtn').forEach(b => {
                        const isActive = b.dataset.phase === phase;
                        b.style.borderColor = isActive ? '#1a1a2e' : '#e2e8f0';
                        b.style.background = isActive ? '#f0f0f0' : '#fff';
                        b.style.fontWeight = isActive ? '700' : '500';
                        b.style.color = isActive ? '#1a1a2e' : '#64748b';
                    });
                    this.showToast(`已切換至「${phaseLabels[phase]}」`);
                });
            });
        });
    }
    /* =========================================
       講師備註
       ========================================= */
    bindSpeakerNotes() {
        // ── 右側面板 tab 切換 ──
        const rightTabs = document.querySelectorAll('.right-panel-tab');
        const propsBody = document.getElementById('rightPanelProps');
        const notesBody = document.getElementById('rightPanelNotes');

        rightTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                rightTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const which = tab.dataset.rightTab;
                if (propsBody) propsBody.style.display = which === 'props' ? '' : 'none';
                if (notesBody) notesBody.style.display = which === 'notes' ? '' : 'none';
            });
        });

        // ── 備註 textarea ──
        const textarea = document.getElementById('speakerNotesRight');
        const checkbox = document.getElementById('slideNeedsNotes');
        const wordCount = document.getElementById('notesWordCount');

        if (!textarea) return;

        let noteTimer = null;
        textarea.addEventListener('input', () => {
            const slide = this.slideManager.slides[this.slideManager.currentIndex];
            if (slide) {
                slide.notes = textarea.value;
                // 自動勾選 needsNotes
                if (textarea.value.trim() && checkbox && !checkbox.checked) {
                    checkbox.checked = true;
                    slide.needsNotes = true;
                }
            }
            if (wordCount) wordCount.textContent = `${(textarea.value || '').length} 字`;
            clearTimeout(noteTimer);
            noteTimer = setTimeout(() => {
                this.slideManager.save();
                this.slideManager.renderThumbnails();
            }, 800);
        });

        // ── checkbox ──
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                const slide = this.slideManager.slides[this.slideManager.currentIndex];
                if (slide) {
                    slide.needsNotes = checkbox.checked;
                    this.slideManager.save();
                    this.slideManager.renderThumbnails();
                }
            });
        }

        // ── 舊的底部 toggle（保留向下相容）──
        const toggle = document.getElementById('speakerNotesToggle');
        const panel = document.getElementById('speakerNotesPanel');
        const oldTextarea = document.getElementById('speakerNotesText');

        if (toggle && panel && oldTextarea) {
            toggle.addEventListener('click', () => {
                const isOpen = panel.classList.toggle('open');
                oldTextarea.style.display = isOpen ? 'block' : 'none';
                if (isOpen) oldTextarea.focus();
            });
            oldTextarea.addEventListener('input', () => {
                const slide = this.slideManager.slides[this.slideManager.currentIndex];
                if (slide) slide.notes = oldTextarea.value;
                // 同步右側
                if (textarea) textarea.value = oldTextarea.value;
                if (wordCount) wordCount.textContent = `${(oldTextarea.value || '').length} 字`;
                clearTimeout(noteTimer);
                noteTimer = setTimeout(() => this.slideManager.save(), 800);
            });
        }
    }

    updateSpeakerNotes() {
        const slide = this.slideManager.slides[this.slideManager.currentIndex];
        const notes = slide?.notes || '';

        // 右側面板
        const textarea = document.getElementById('speakerNotesRight');
        if (textarea) textarea.value = notes;

        const checkbox = document.getElementById('slideNeedsNotes');
        if (checkbox) checkbox.checked = !!slide?.needsNotes;

        const wordCount = document.getElementById('notesWordCount');
        if (wordCount) wordCount.textContent = `${notes.length} 字`;

        // 底部（舊）
        const oldTextarea = document.getElementById('speakerNotesText');
        if (oldTextarea) oldTextarea.value = notes;
    }

    /* =========================================
       AI 出題
       ========================================= */
    openAiQuizModal() {
        const overlay = document.getElementById('aiQuizOverlay');
        if (!overlay) return;
        overlay.style.display = 'flex';

        // 關閉
        document.getElementById('aiQuizClose')?.addEventListener('click', () => {
            overlay.style.display = 'none';
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });

        // 題型按鈕切換
        document.querySelectorAll('.ai-quiz-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.ai-quiz-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // 場景 chip 切換
        document.querySelectorAll('.ai-quiz-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const input = document.getElementById('aiQuizScenario');
                if (chip.classList.contains('active')) {
                    chip.classList.remove('active');
                    input.value = '';
                } else {
                    document.querySelectorAll('.ai-quiz-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    input.value = chip.dataset.scenario;
                }
            });
        });

        // 生成按鈕
        const genBtn = document.getElementById('aiQuizGenerate');
        const newBtn = genBtn.cloneNode(true);
        genBtn.parentNode.replaceChild(newBtn, genBtn);
        newBtn.addEventListener('click', () => this.generateAiQuiz());
    }

    async generateAiQuiz() {
        const topic = document.getElementById('aiQuizTopic').value.trim();
        const count = parseInt(document.getElementById('aiQuizCount').value) || 3;
        const difficulty = document.getElementById('aiQuizDifficulty').value;
        const scenario = document.getElementById('aiQuizScenario').value.trim();
        const quizType = document.querySelector('.ai-quiz-type-btn.active')?.dataset.type || 'mixed';
        const status = document.getElementById('aiQuizStatus');

        if (!topic) {
            status.textContent = '⚠️ 請輸入主題';
            status.style.color = '#dc2626';
            return;
        }

        const diffMap = { easy: '初級（基本定義和核心概念）', medium: '中級（需要理解原理或比較異同）', hard: '高級（綜合多個概念或分析實際情境）' };
        const typeNameMap = { quiz: '選擇題', truefalse: '是非題', fillblank: '填空題', ordering: '排序題', matching: '配對題', mixed: '混合題型' };

        status.textContent = `⏳ AI 正在生成 ${typeNameMap[quizType]}…`;
        status.style.color = '#64748b';

        const btn = document.getElementById('aiQuizGenerate');
        btn.disabled = true;
        btn.style.opacity = '0.5';

        try {
            // 決定每題的題型
            const allTypes = ['quiz', 'truefalse', 'fillblank', 'ordering', 'matching'];
            let types;
            if (quizType === 'mixed') {
                types = Array.from({ length: count }, (_, i) => allTypes[i % allTypes.length]);
                // shuffle
                for (let i = types.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [types[i], types[j]] = [types[j], types[i]];
                }
            } else {
                types = Array(count).fill(quizType);
            }

            const scenarioClause = scenario ? `\n場景情境：所有題目必須設計在「${scenario}」的真實工作場景中，讓學員有代入感。` : '';

            const prompt = `你是一位資深教學評量設計師。請根據以下條件，設計高品質的互動題目。

══ 出題條件 ══
主題：${topic}
題數：${count}
難度：${diffMap[difficulty] || '中級'}${scenarioClause}

每題的指定題型（按順序）：
${types.map((t, i) => `第 ${i + 1} 題：${typeNameMap[t]}`).join('\n')}

══ 各題型格式規範 ══

【選擇題 quiz】
{"type":"quiz","question":"情境化題目","options":[{"text":"選項A","correct":true},{"text":"選項B","correct":false},{"text":"選項C","correct":false},{"text":"選項D","correct":false}]}
• 4 個選項，僅 1 個正確。干擾選項要看起來合理但有關鍵錯誤。

【是非題 truefalse】
{"type":"truefalse","statement":"一個對或錯的陳述句","correct":true}
• correct 為 true 表示該陳述正確，false 表示錯誤。陳述句要有深度，避免太明顯。

【填空題 fillblank】
{"type":"fillblank","sentence":"這是一段包含 ____ 的句子，其中 ____ 需要填入正確答案","blanks":["答案1","答案2"]}
• sentence 中用 ____ 標記空格位置。blanks 陣列按順序對應每個空格的正確答案。

【排序題 ordering】
{"type":"ordering","question":"請將以下步驟排列正確順序","items":["步驟A","步驟B","步驟C","步驟D"]}
• items 陣列中的順序就是正確順序（系統會自動打亂顯示）。4-6 個項目。

【配對題 matching】
{"type":"matching","question":"請將左邊與右邊配對","pairs":[{"left":"概念A","right":"定義A"},{"left":"概念B","right":"定義B"},{"left":"概念C","right":"定義C"}]}
• pairs 中 left 和 right 是正確配對。3-5 組。

══ 出題原則 ══
1. 使用「情境化」題幹，模擬真實場景
2. 全部使用繁體中文
3. 回傳純 JSON 陣列，不加任何額外說明

══ 回傳格式 ══
[{...}, {...}, ...]`;

            const result = await ai.chat([
                { role: 'system', content: '你是教育內容生成器，只回傳 JSON，不加任何額外說明。' },
                { role: 'user', content: prompt }
            ], { model: 'claude-haiku-4-5', temperature: 0.8 });

            const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
            const questions = JSON.parse(jsonStr);

            if (!Array.isArray(questions) || questions.length === 0) {
                throw new Error('AI 回傳格式不正確');
            }

            // 為每題建立投影片
            for (const q of questions) {
                const gen = () => this.slideManager.generateId();
                let element;

                switch (q.type) {
                    case 'truefalse':
                        element = {
                            id: gen(), type: 'truefalse',
                            x: 50, y: 50, width: 600, height: 400,
                            statement: q.statement,
                            correct: !!q.correct
                        };
                        break;

                    case 'fillblank':
                        element = {
                            id: gen(), type: 'fillblank',
                            x: 50, y: 50, width: 600, height: 400,
                            sentence: q.sentence,
                            blanks: q.blanks || []
                        };
                        break;

                    case 'ordering':
                        element = {
                            id: gen(), type: 'ordering',
                            x: 50, y: 50, width: 600, height: 400,
                            question: q.question,
                            items: q.items || []
                        };
                        break;

                    case 'matching':
                        element = {
                            id: gen(), type: 'matching',
                            x: 50, y: 50, width: 600, height: 400,
                            question: q.question,
                            pairs: (q.pairs || []).map(p => ({
                                left: p.left, right: p.right, matchId: gen()
                            }))
                        };
                        break;

                    case 'quiz':
                    default:
                        element = {
                            id: gen(), type: 'quiz',
                            x: 50, y: 50, width: 600, height: 400,
                            question: q.question,
                            multiple: false,
                            options: (q.options || []).map(o => ({
                                text: o.text, correct: !!o.correct
                            }))
                        };
                        break;
                }

                const slide = {
                    id: gen(),
                    elements: [element],
                    background: '#ffffff'
                };
                this.slideManager.slides.splice(this.slideManager.currentIndex + 1, 0, slide);
                this.slideManager.navigateTo(this.slideManager.currentIndex + 1);
            }

            this.slideManager.renderThumbnails();
            this.slideManager.updateCounter();
            this.slideManager.save();

            status.textContent = `✅ 已生成 ${questions.length} 題！`;
            status.style.color = '#16a34a';

            setTimeout(() => {
                document.getElementById('aiQuizOverlay').style.display = 'none';
            }, 800);

        } catch (err) {
            console.error('AI quiz generation error:', err);
            status.textContent = `❌ 生成失敗：${err.message}`;
            status.style.color = '#dc2626';
        } finally {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }

    /* =========================================
   AI 生成簡報
   ========================================= */
    openAiGenerateModal() {
        const overlay = document.getElementById('aiGenerateOverlay');
        if (!overlay) return;
        overlay.style.display = 'flex';
        document.getElementById('aiGenerateForm').style.display = 'flex';
        document.getElementById('aiGenerateProgress').style.display = 'none';

        document.getElementById('aiGenerateClose')?.addEventListener('click', () => {
            overlay.style.display = 'none';
        }, { once: true });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        }, { once: true });

        const startBtn = document.getElementById('aiGenerateStart');
        const newBtn = startBtn.cloneNode(true);
        startBtn.parentNode.replaceChild(newBtn, startBtn);
        newBtn.addEventListener('click', () => this.startAiGeneration());
    }

    async startAiGeneration() {
        const clientName = document.getElementById('aiGenClient').value.trim();
        const level = document.getElementById('aiGenLevel').value;
        const pageCount = parseInt(document.getElementById('aiGenPages').value) || 30;
        const outline = document.getElementById('aiGenOutline').value.trim();
        if (!outline) { alert('請輸入課程大綱'); return; }

        let pdfText = '';
        const pdfFile = document.getElementById('aiGenPdf').files[0];
        if (pdfFile) { try { pdfText = await pdfFile.text(); } catch (e) { /* skip */ } }

        document.getElementById('aiGenerateForm').style.display = 'none';
        document.getElementById('aiGenerateProgress').style.display = 'block';

        const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
        const generator = new AiSlideGenerator(this.slideManager);
        const emojis = { 1: '\ud83e\udde0', 2: '\ud83c\udfa8', 3: '\u2728' };
        const titles = { 1: 'AI 正在規劃內容結構...', 2: '正在套用設計模板...', 3: 'AI 正在美化排版...' };

        generator.onProgress = (phase, step, percent, message) => {
            document.getElementById('aiGenEmoji').textContent = emojis[phase] || '\ud83e\udde0';
            document.getElementById('aiGenPhaseTitle').textContent = titles[phase] || message;
            document.getElementById('aiGenStepLabel').textContent = message;
            document.getElementById('aiGenPercent').textContent = Math.round(percent) + '%';
            document.getElementById('aiGenBar').style.width = percent + '%';
            for (let i = 1; i <= 3; i++) {
                const dot = document.getElementById(`aiPhase${i}`);
                if (i < phase || (i === phase && step === 'done')) {
                    dot.style.background = '#6366f1'; dot.style.color = '#fff';
                } else if (i === phase) {
                    dot.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)'; dot.style.color = '#fff';
                } else {
                    dot.style.background = '#e2e8f0'; dot.style.color = '#94a3b8';
                }
            }
        };

        try {
            const slides = await generator.generate({ clientName, level, pageCount, outline, pdfText });
            this.slideManager.slides = slides;
            this.slideManager.currentIndex = 0;
            this.slideManager.renderThumbnails();
            this.slideManager.renderCurrentSlide();
            this.slideManager.updateCounter();
            this.slideManager.save();

            document.getElementById('aiGenEmoji').textContent = '\ud83c\udf89';
            document.getElementById('aiGenPhaseTitle').textContent = `已生成 ${slides.length} 頁簡報！`;
            document.getElementById('aiGenStepLabel').textContent = '即將關閉...';
            setTimeout(() => { document.getElementById('aiGenerateOverlay').style.display = 'none'; }, 1500);
        } catch (err) {
            console.error('AI generation error:', err);
            document.getElementById('aiGenEmoji').textContent = '\u274c';
            document.getElementById('aiGenPhaseTitle').textContent = '生成失敗';
            document.getElementById('aiGenStepLabel').textContent = err.message;
            document.getElementById('aiGenBar').style.background = '#ef4444';
        }
    }

    // ═══════════════════════════════════════
    // AI 三階段獨立方法
    // ═══════════════════════════════════════

    async startAiPhase1() {
        const topic = document.getElementById('aiContentTopic').value.trim();
        const level = document.getElementById('aiContentLevel').value;
        const pageCount = parseInt(document.getElementById('aiContentPages').value) || 30;
        const outline = document.getElementById('aiContentOutline').value.trim();
        if (!outline && !topic) { alert('請輸入課程主題或大綱'); return; }

        let pdfText = '';
        const pdfFile = document.getElementById('aiContentPdf')?.files[0];
        if (pdfFile) { try { pdfText = await pdfFile.text(); } catch (e) { /* skip */ } }

        const statusEl = document.getElementById('aiContentStatus');
        const btn = document.getElementById('aiContentStart');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;animation:spin 1s linear infinite;">progress_activity</span> 生成中...';
        statusEl.textContent = '正在連線 AI...';

        try {
            const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
            const generator = new AiSlideGenerator(this.slideManager);
            generator.onProgress = (percent, msg) => {
                statusEl.textContent = `${Math.round(percent)}% - ${msg}`;
            };

            const slides = await generator.generateContent({
                topic: topic || '課程', level, pageCount,
                outline: outline || topic, pdfText
            });

            this.slideManager.slides = slides;
            this.slideManager.currentIndex = 0;
            this.slideManager.renderThumbnails();
            this.slideManager.renderCurrentSlide();
            this.slideManager.updateCounter();
            this.slideManager.save();

            const report = this._buildResultReport('Phase 1 — 文案生成', [{
                label: `已生成 ${slides.length} 頁投影片`,
                pages: slides.map((s, i) => {
                    const title = (s.elements || []).find(e => e.type === 'text' && e.fontSize >= 26);
                    return { page: i + 1, desc: title ? title.content.replace(/<[^>]+>/g, '').substring(0, 30) : '投影片' };
                })
            }]);
            statusEl.innerHTML = report;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">edit_note</span> 生成文案';
        } catch (err) {
            console.error('Phase 1 error:', err);
            statusEl.innerHTML = `<span style="color:#dc2626;">✗ ${err.message}</span>`;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">edit_note</span> 重試';
        }
    }

    async startAiPhase2(customPrompt) {
        if (this.slideManager.slides.length === 0) { alert('請先生成投影片'); return; }

        const statusEl = document.getElementById('aiInteractiveStatus');
        const btn = document.getElementById('aiInteractiveStart');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;animation:spin 1s linear infinite;">progress_activity</span> 分析中...';
        statusEl.textContent = '正在分析投影片內容...';

        try {
            const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
            const generator = new AiSlideGenerator(this.slideManager);
            generator.onProgress = (percent, msg) => {
                statusEl.textContent = `${Math.round(percent)}% - ${msg}`;
            };

            const oldCount = parseInt(document.getElementById('aiInteractiveSlideCount')?.textContent || '0');
            const slides = await generator.insertInteractive([...this.slideManager.slides]);
            this.slideManager.slides = slides;
            this.slideManager.currentIndex = 0;
            this.slideManager.renderThumbnails();
            this.slideManager.renderCurrentSlide();
            this.slideManager.updateCounter();
            this.slideManager.save();

            const addedCount = slides.length - oldCount;
            const interactivePages = slides.map((s, i) => {
                const interactive = (s.elements || []).find(e => ['quiz', 'poll', 'ordering', 'matching', 'fillblank', 'truefalse', 'opentext', 'scale', 'buzzer', 'wordcloud'].includes(e.type));
                return interactive ? { page: i + 1, desc: `${interactive.type}：${interactive.question || interactive.title || ''}`.substring(0, 40) } : null;
            }).filter(Boolean);

            const report = this._buildResultReport('Phase 3 — 插入互動', [{
                label: `新增 ${addedCount} 頁互動元件`,
                pages: interactivePages
            }]);
            statusEl.innerHTML = report;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">touch_app</span> 插入互動';
        } catch (err) {
            console.error('Phase 2 error:', err);
            statusEl.innerHTML = `<span style="color:#dc2626;">✗ ${err.message}</span>`;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">touch_app</span> 重試';
        }
    }

    async startAiPhase4Anim() {
        if (this.slideManager.slides.length === 0) { alert('請先生成投影片'); return; }

        const statusEl = document.getElementById('aiAnimStatus');
        const btn = document.getElementById('aiAnimStart');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;animation:spin 1s linear infinite;">progress_activity</span> 分析中...';
        statusEl.textContent = '正在分析投影片版面...';

        try {
            const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
            const generator = new AiSlideGenerator(this.slideManager);
            generator.onProgress = (percent, msg) => {
                statusEl.textContent = `${Math.round(percent)}% - ${msg}`;
            };

            const slides = await generator.addAnimations([...this.slideManager.slides]);
            this.slideManager.slides = slides;
            this.slideManager.renderThumbnails();
            this.slideManager.renderCurrentSlide();
            this.slideManager.save();

            const animPages = slides.map((s, i) => {
                const maxOrder = Math.max(0, ...(s.elements || []).map(e => e.animOrder || 0));
                if (maxOrder > 0) {
                    const title = (s.elements || []).find(e => e.type === 'text' && e.fontSize >= 26);
                    return { page: i + 1, desc: `${maxOrder} 步動畫：${title ? title.content.replace(/<[^>]+>/g, '').substring(0, 25) : ''}` };
                }
                return null;
            }).filter(Boolean);

            const report = this._buildResultReport('Phase 4 — 動畫呈現', [{
                label: `已為 ${animPages.length} 頁設定逐步動畫`,
                pages: animPages
            }]);
            statusEl.innerHTML = report;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">animation</span> 設定動畫';
        } catch (err) {
            console.error('Phase 4 anim error:', err);
            statusEl.innerHTML = `<span style="color:#dc2626;">✗ ${err.message}</span>`;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">animation</span> 重試';
        }
    }

    async startAiPhase2Visual() {
        if (this.slideManager.slides.length === 0) { alert('請先生成投影片'); return; }

        const statusEl = document.getElementById('aiVisualStatus');
        const btn = document.getElementById('aiVisualStart');
        const customPrompt = document.getElementById('aiVisualPrompt')?.value?.trim() || null;
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;animation:spin 1s linear infinite;">progress_activity</span> 分析中...';
        statusEl.textContent = '正在分析哪些頁面需要圖表...';

        try {
            const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
            const generator = new AiSlideGenerator(this.slideManager);
            generator.onProgress = (percent, msg) => {
                statusEl.textContent = `${Math.round(percent)}% - ${msg}`;
            };

            const beforeSvgCount = this.slideManager.slides.reduce((n, s) => n + (s.elements || []).filter(e => e.type === 'svg').length, 0);
            const slides = await generator.generateVisuals([...this.slideManager.slides], customPrompt || undefined);
            this.slideManager.slides = slides;
            this.slideManager.currentIndex = 0;
            this.slideManager.renderThumbnails();
            this.slideManager.renderCurrentSlide();
            this.slideManager.updateCounter();
            this.slideManager.save();

            const svgPages = slides.map((s, i) => {
                const svgEls = (s.elements || []).filter(e => e.type === 'svg');
                return svgEls.length > 0 ? { page: i + 1, desc: svgEls.map(e => e.label || '圖表').join(', ') } : null;
            }).filter(Boolean);

            const report = this._buildResultReport('Phase 2 — 生成圖表', [{
                label: `已新增 ${svgPages.length} 個 SVG 圖表`,
                pages: svgPages
            }]);
            statusEl.innerHTML = report;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">insert_chart</span> 生成圖表';
        } catch (err) {
            console.error('Phase 2 visual error:', err);
            statusEl.innerHTML = `<span style="color:#dc2626;">✗ ${err.message}</span>`;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">insert_chart</span> 重試';
        }
    }

    async startAiPhase3Interactive() {
        if (this.slideManager.slides.length === 0) { alert('請先生成投影片'); return; }
        // Delegate to existing startAiPhase2 but pass custom prompt
        const customPrompt = document.getElementById('aiInteractivePrompt')?.value?.trim() || null;
        await this.startAiPhase2(customPrompt);
    }

    async openAiDesignModal() {
        const grid = document.getElementById('aiDesignThemeGrid');
        const layoutGrid = document.getElementById('aiDesignLayoutGrid');
        if (!grid) return;

        // Render layout cards
        const { LAYOUT_STYLES } = await import('./aiSlideGenerator.js');
        const { MASTER_THEMES } = await import('./templates.js');

        if (layoutGrid) {
            layoutGrid.innerHTML = LAYOUT_STYLES.map(l => `
                <div class="ai-layout-card" data-layout="${l.id}" title="${l.desc}">
                    <span class="material-symbols-outlined">${l.icon}</span>
                    <span>${l.name}</span>
                </div>
            `).join('');

            let selectedLayout = LAYOUT_STYLES[0].id;
            layoutGrid.querySelectorAll('.ai-layout-card').forEach(card => {
                card.addEventListener('click', () => {
                    layoutGrid.querySelectorAll('.ai-layout-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedLayout = card.dataset.layout;
                });
            });
            layoutGrid.querySelector('.ai-layout-card').classList.add('selected');
            this._selectedDesignLayout = () => selectedLayout;
        }

        // Render theme cards
        grid.innerHTML = MASTER_THEMES.map(t => `
            <button class="ai-theme-card" data-theme="${t.id}"
                style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;border:2px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;transition:all .2s;">
                <div style="width:100%;height:32px;border-radius:4px;background:${t.preview.bg};display:flex;align-items:center;padding-left:6px;">
                    <div style="width:12px;height:3px;border-radius:1px;background:${t.preview.accent};"></div>
                </div>
                <span style="font-size:.7rem;color:#475569;">${t.name}</span>
            </button>
        `).join('');

        let selectedTheme = MASTER_THEMES[0].id;
        grid.querySelectorAll('.ai-theme-card').forEach(card => {
            card.addEventListener('click', () => {
                grid.querySelectorAll('.ai-theme-card').forEach(c => c.style.borderColor = '#e2e8f0');
                card.style.borderColor = '#6366f1';
                selectedTheme = card.dataset.theme;
            });
        });
        grid.querySelector('.ai-theme-card').style.borderColor = '#6366f1';
        this._selectedDesignTheme = () => selectedTheme;

        // Load prompt
        this._loadOverlayPrompt('aiDesignPrompt', 'slide_design');

        document.getElementById('aiDesignOverlay').style.display = 'flex';
    }

    async startAiPhase5Design() {
        if (this.slideManager.slides.length === 0) { alert('請先生成投影片'); return; }

        const themeId = this._selectedDesignTheme?.() || 'biz';
        const layoutId = this._selectedDesignLayout?.() || 'classic-center';
        const customPrompt = document.getElementById('aiDesignPrompt')?.value?.trim() || null;
        const statusEl = document.getElementById('aiDesignStatus');
        const btn = document.getElementById('aiDesignStart');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;animation:spin 1s linear infinite;">progress_activity</span> 套用中...';
        statusEl.textContent = '正在套用風格...';

        try {
            const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
            const generator = new AiSlideGenerator(this.slideManager);
            generator.onProgress = (percent, msg) => {
                statusEl.textContent = `${Math.round(percent)}% - ${msg}`;
            };

            const slides = await generator.applyDesign([...this.slideManager.slides], themeId, layoutId, customPrompt || undefined);
            this.slideManager.slides = slides;
            this.slideManager.currentIndex = 0;
            this.slideManager.renderThumbnails();
            this.slideManager.renderCurrentSlide();
            this.slideManager.updateCounter();
            this.slideManager.save();

            const designPages = slides.map((s, i) => {
                const title = (s.elements || []).find(e => e.type === 'text' && e.fontSize >= 26);
                return { page: i + 1, desc: title ? title.content.replace(/<[^>]+>/g, '').substring(0, 30) : '投影片' };
            });
            const report = this._buildResultReport('Phase 5 — 美化設計', [{
                label: `已為 ${slides.length} 頁套用風格「${themeId}」+ 版型「${layoutId}」`,
                pages: designPages.slice(0, 15)
            }]);
            statusEl.innerHTML = report;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">auto_fix_high</span> 套用設計';
        } catch (err) {
            console.error('Phase 5 design error:', err);
            statusEl.innerHTML = `<span style="color:#dc2626;">✗ ${err.message}</span>`;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">auto_fix_high</span> 重試';
        }
    }

    async startAiPhase6Notes() {
        if (this.slideManager.slides.length === 0) { alert('請先生成投影片'); return; }

        const customPrompt = document.getElementById('aiNotesPrompt')?.value?.trim() || null;
        const statusEl = document.getElementById('aiNotesStatus');
        const btn = document.getElementById('aiNotesStart');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;animation:spin 1s linear infinite;">progress_activity</span> 生成中...';

        try {
            const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
            const generator = new AiSlideGenerator(this.slideManager);
            generator.onProgress = (percent, msg) => {
                statusEl.textContent = `${Math.round(percent)}% - ${msg}`;
            };

            await generator.generateTeachingNotes(this.slideManager.slides, customPrompt || undefined);
            this.slideManager.save();
            this.updateSpeakerNotes();

            const notesPages = this.slideManager.slides.map((s, i) => {
                if (!s.notes) return null;
                return { page: i + 1, desc: s.notes.substring(0, 40) + (s.notes.length > 40 ? '...' : '') };
            }).filter(Boolean);
            const report = this._buildResultReport('Phase 6 — 教學大綱', [{
                label: `已為 ${notesPages.length} 頁生成講師備忘錄`,
                pages: notesPages
            }]);
            statusEl.innerHTML = report;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">record_voice_over</span> 生成大綱';
        } catch (err) {
            console.error('Phase 6 notes error:', err);
            statusEl.innerHTML = `<span style="color:#dc2626;">✗ ${err.message}</span>`;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">record_voice_over</span> 重試';
        }
    }

    _surveyData = null;

    async loadSurveyData() {
        const preview = document.getElementById('surveyDataPreview');
        const startBtn = document.getElementById('aiSurveyStart');
        const statusEl = document.getElementById('aiSurveyStatus');
        const loadBtn = document.getElementById('aiSurveyLoadBtn');
        loadBtn.disabled = true;
        loadBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;animation:spin 1s linear infinite;">progress_activity</span> 載入中...';

        try {
            const { db } = await import('./supabase.js');
            const joinCode = this.slideManager.getCurrentJoinCode?.() || '';

            // 讀取問卷題目
            const { data: questions } = await db.select('survey_questions', {
                filter: joinCode ? { session_code: `eq.${joinCode}` } : {},
                order: 'sort_order.asc'
            });

            // 讀取回覆
            const { data: responses } = await db.select('survey_responses');

            if (!questions || questions.length === 0) {
                preview.innerHTML = '<span style="color:#f59e0b;">⚠ 尚未設定課前問卷題目，請先在課前設定中新增問卷。</span>';
                loadBtn.disabled = false;
                loadBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">download</span> 重新載入';
                return;
            }

            // 統計
            const stats = questions.map(q => {
                const qResponses = (responses || []).filter(r => r.question_id === q.id);
                const stat = {
                    question: q.question_text,
                    type: q.question_type,
                    totalResponses: qResponses.length
                };
                if (q.question_type === 'fillblank') {
                    stat.answers = qResponses.map(r => r.answer);
                } else {
                    const opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]');
                    stat.distribution = {};
                    opts.forEach(o => { stat.distribution[o] = qResponses.filter(r => r.answer === o).length; });
                }
                return stat;
            });

            this._surveyData = stats;

            // 顯示預覽
            preview.innerHTML = stats.map((s, i) => {
                let detail = '';
                if (s.distribution) {
                    detail = Object.entries(s.distribution).map(([k, v]) =>
                        `<span style="background:#e0e7ff;padding:2px 8px;border-radius:4px;margin:2px;">${k}: ${v}</span>`
                    ).join(' ');
                } else {
                    detail = `<span style="color:#94a3b8;">${s.totalResponses} 則文字回覆</span>`;
                }
                return `<div style="margin-bottom:8px;"><b>${i + 1}. ${s.question}</b> (${s.totalResponses} 人回覆)<br>${detail}</div>`;
            }).join('');

            startBtn.disabled = false;
            startBtn.style.opacity = '1';
            statusEl.innerHTML = `<span style="color:#059669;">✓ 已載入 ${stats.length} 題問卷數據（共 ${responses?.length || 0} 筆回覆）</span>`;
        } catch (err) {
            preview.innerHTML = `<span style="color:#dc2626;">載入失敗: ${err.message}</span>`;
        } finally {
            loadBtn.disabled = false;
            loadBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">download</span> 重新載入';
        }
    }

    async startSurveyAdjust() {
        if (!this._surveyData) { alert('請先載入問卷數據'); return; }
        if (this.slideManager.slides.length === 0) { alert('請先生成投影片'); return; }

        const customPrompt = document.getElementById('aiSurveyPrompt')?.value?.trim() || null;
        const statusEl = document.getElementById('aiSurveyStatus');
        const resultsEl = document.getElementById('aiSurveyResults');
        const btn = document.getElementById('aiSurveyStart');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;animation:spin 1s linear infinite;">progress_activity</span> 調整中...';

        try {
            const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
            const generator = new AiSlideGenerator(this.slideManager);
            generator.onProgress = (percent, msg) => {
                statusEl.textContent = `${Math.round(percent)}% - ${msg}`;
            };

            const { slides, adjustments } = await generator.adjustBySurvey(
                [...this.slideManager.slides], this._surveyData, customPrompt || undefined
            );

            this.slideManager.slides = slides;
            this.slideManager.renderThumbnails();
            this.slideManager.renderCurrentSlide();
            this.slideManager.updateCounter();
            this.slideManager.save();

            // 顯示調整結果
            if (Array.isArray(adjustments) && adjustments.length > 0) {
                resultsEl.style.display = 'block';
                resultsEl.innerHTML = `<div style="font-size:.82rem;font-weight:600;margin-bottom:6px;">AI 調整報告：</div>` +
                    adjustments.map(a => `<div style="padding:8px 12px;background:#f0fdf4;border-radius:6px;margin-bottom:4px;font-size:.78rem;">
                        <b>第 ${a.page} 頁</b>：${a.reason || '已調整'}
                    </div>`).join('');
            }

            statusEl.innerHTML = `<span style="color:#059669;">✓ 已調整 ${adjustments?.length || 0} 頁</span>`;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">tune</span> 根據問卷調整簡報';
        } catch (err) {
            console.error('Survey adjust error:', err);
            statusEl.innerHTML = `<span style="color:#dc2626;">✗ ${err.message}</span>`;
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">tune</span> 重試';
        }
    }

    _buildResultReport(title, sections) {
        const maxShow = 20;
        let html = `<div style="max-height:300px;overflow-y:auto;text-align:left;">`;
        html += `<div style="font-size:.9rem;font-weight:700;color:#059669;margin-bottom:8px;display:flex;align-items:center;gap:4px;"><span class="material-symbols-outlined" style="font-size:18px;">check_circle</span> ${title}</div>`;
        for (const sec of sections) {
            html += `<div style="font-size:.82rem;font-weight:600;color:#334155;margin-bottom:6px;">${sec.label}</div>`;
            if (sec.pages && sec.pages.length > 0) {
                html += `<div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px;">`;
                const show = sec.pages.slice(0, maxShow);
                for (const p of show) {
                    html += `<div style="font-size:.76rem;color:#475569;padding:4px 10px;background:#f0fdf4;border-radius:6px;border-left:3px solid #059669;"><b>第 ${p.page} 頁</b>：${p.desc}</div>`;
                }
                if (sec.pages.length > maxShow) {
                    html += `<div style="font-size:.72rem;color:#94a3b8;padding:2px 10px;">...及其他 ${sec.pages.length - maxShow} 頁</div>`;
                }
                html += `</div>`;
            }
        }
        html += `</div>`;
        return html;
    }

    async _loadOverlayPrompt(textareaId, promptKey) {
        const el = document.getElementById(textareaId);
        if (!el || el._loaded) return;
        try {
            const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
            const gen = new AiSlideGenerator(this.slideManager);
            const prompts = await gen._loadPrompts();
            el.value = prompts[promptKey] || '';
            el._loaded = true;
        } catch (e) {
            el.placeholder = '載入失敗';
        }
    }

    /* =========================================
   模板選擇器
   ========================================= */
    openTemplatePicker() {
        const overlay = document.getElementById('templatePickerOverlay');
        const grid = document.getElementById('templatePickerGrid');
        if (!overlay || !grid) {
            this.slideManager.createSlide(true);
            return;
        }

        // 取得所有分類
        const categories = ['全部', ...new Set(SLIDE_TEMPLATES.map(t => t.category || '其他'))];

        // 渲染分類 tabs + 模板
        const renderGrid = (filter) => {
            const templates = filter === '全部' ? SLIDE_TEMPLATES : SLIDE_TEMPLATES.filter(t => (t.category || '其他') === filter);

            // Mini wireframe layouts for each template
            const wireframes = {
                // 商務
                'biz-title': '<div style="padding:14px 18px;display:flex;flex-direction:column;justify-content:center;height:100%;"><div style="width:65%;height:7px;background:#fafaf9;opacity:0.6;border-radius:2px;margin-bottom:5px;"></div><div style="width:20px;height:2px;background:#b45309;opacity:0.7;margin-bottom:4px;"></div><div style="width:40%;height:4px;background:#fafaf9;opacity:0.2;border-radius:2px;"></div></div>',
                'biz-content': '<div style="padding:8px 14px;display:flex;flex-direction:column;height:100%;"><div style="width:100%;height:8px;background:#1c1917;border-radius:0;margin-bottom:6px;"></div><div style="display:flex;flex-direction:column;gap:3px;padding:4px;flex:1;justify-content:center;"><div style="width:60%;height:3px;background:currentColor;opacity:0.15;border-radius:2px;"></div><div style="width:80%;height:2px;background:currentColor;opacity:0.1;border-radius:2px;"></div><div style="width:70%;height:2px;background:currentColor;opacity:0.1;border-radius:2px;"></div></div></div>',
                'biz-cards': '<div style="padding:6px 10px;display:flex;gap:4px;height:100%;"><div style="width:100%;height:8px;background:#1c1917;position:absolute;top:0;left:0;right:0;"></div><div style="flex:1;background:#f5f5f4;border-radius:3px;margin-top:12px;display:flex;flex-direction:column;align-items:center;padding-top:6px;gap:2px;"><span class="material-symbols-outlined" style="font-size:10px;color:#b45309;opacity:0.6;">trending_up</span><div style="width:55%;height:2px;background:#1c1917;opacity:0.1;border-radius:2px;"></div></div><div style="flex:1;background:#f5f5f4;border-radius:3px;margin-top:12px;display:flex;flex-direction:column;align-items:center;padding-top:6px;gap:2px;"><span class="material-symbols-outlined" style="font-size:10px;color:#b45309;opacity:0.6;">shield</span><div style="width:55%;height:2px;background:#1c1917;opacity:0.1;border-radius:2px;"></div></div><div style="flex:1;background:#f5f5f4;border-radius:3px;margin-top:12px;display:flex;flex-direction:column;align-items:center;padding-top:6px;gap:2px;"><span class="material-symbols-outlined" style="font-size:10px;color:#b45309;opacity:0.6;">groups</span><div style="width:55%;height:2px;background:#1c1917;opacity:0.1;border-radius:2px;"></div></div></div>',
                // 清新
                'nature-title': '<div style="padding:14px 18px;display:flex;flex-direction:column;justify-content:center;height:100%;"><div style="width:2px;height:16px;background:#6b8f71;opacity:0.5;margin-bottom:4px;"></div><div style="width:60%;height:6px;background:#e8ede8;opacity:0.5;border-radius:2px;margin-bottom:4px;"></div><div style="width:35%;height:3px;background:#8faa8f;opacity:0.3;border-radius:2px;"></div></div>',
                'nature-content': '<div style="padding:10px 14px;display:flex;flex-direction:column;gap:3px;height:100%;justify-content:center;"><div style="width:55%;height:5px;background:#2d3b2d;opacity:0.4;border-radius:2px;margin-bottom:2px;"></div><div style="width:15px;height:2px;background:#6b8f71;opacity:0.5;border-radius:2px;margin-bottom:3px;"></div><div style="width:80%;height:2px;background:#44544a;opacity:0.15;border-radius:2px;"></div><div style="width:70%;height:2px;background:#44544a;opacity:0.12;border-radius:2px;"></div></div>',
                'nature-cards': '<div style="padding:6px 10px;display:flex;gap:4px;height:100%;align-items:center;"><div style="flex:1;background:#e8ede8;border-radius:4px;height:80%;display:flex;flex-direction:column;align-items:center;padding-top:8px;gap:2px;"><span class="material-symbols-outlined" style="font-size:10px;color:#4a6b4a;opacity:0.6;">lightbulb</span><div style="width:55%;height:2px;background:#2d3b2d;opacity:0.1;border-radius:2px;"></div></div><div style="flex:1;background:#e8ede8;border-radius:4px;height:80%;display:flex;flex-direction:column;align-items:center;padding-top:8px;gap:2px;"><span class="material-symbols-outlined" style="font-size:10px;color:#4a6b4a;opacity:0.6;">build</span><div style="width:55%;height:2px;background:#2d3b2d;opacity:0.1;border-radius:2px;"></div></div><div style="flex:1;background:#e8ede8;border-radius:4px;height:80%;display:flex;flex-direction:column;align-items:center;padding-top:8px;gap:2px;"><span class="material-symbols-outlined" style="font-size:10px;color:#4a6b4a;opacity:0.6;">verified</span><div style="width:55%;height:2px;background:#2d3b2d;opacity:0.1;border-radius:2px;"></div></div></div>',
                // 珊瑚
                'coral-title': '<div style="padding:14px 18px;display:flex;flex-direction:column;justify-content:center;height:100%;"><div style="width:60%;height:7px;background:#f5e6e8;opacity:0.5;border-radius:2px;margin-bottom:5px;"></div><div style="width:100%;height:1px;background:rgba(204,112,112,0.15);margin-bottom:4px;"></div><div style="width:35%;height:3px;background:#b08a8e;opacity:0.3;border-radius:2px;"></div></div>',
                'coral-content': '<div style="padding:10px 14px;display:flex;flex-direction:column;gap:3px;height:100%;justify-content:center;"><div style="width:50%;height:5px;background:#3d2529;opacity:0.4;border-radius:2px;margin-bottom:2px;"></div><div style="width:15px;height:2px;background:#c07070;opacity:0.5;border-radius:2px;margin-bottom:3px;"></div><div style="width:75%;height:2px;background:#5c3a3e;opacity:0.12;border-radius:2px;"></div><div style="width:65%;height:2px;background:#5c3a3e;opacity:0.1;border-radius:2px;"></div></div>',
                // 海洋
                'teal-title': '<div style="padding:14px 18px;display:flex;flex-direction:column;justify-content:center;height:100%;position:relative;"><div style="width:60%;height:7px;background:#e0f0f0;opacity:0.5;border-radius:2px;margin-bottom:5px;"></div><div style="width:20px;height:2px;background:#2a8a8a;opacity:0.5;margin-bottom:4px;"></div><div style="width:35%;height:3px;background:#78a8a8;opacity:0.25;border-radius:2px;"></div><div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:#2a8a8a;opacity:0.3;"></div></div>',
                'teal-cards': '<div style="padding:6px 10px;display:flex;flex-direction:column;gap:4px;height:100%;"><div style="width:45%;height:4px;background:#1a3c3c;opacity:0.35;border-radius:2px;margin-bottom:1px;"></div><div style="display:flex;gap:3px;flex:1;"><div style="flex:1;background:#e8f4f4;border-radius:3px;display:flex;flex-direction:column;align-items:center;padding-top:5px;gap:1px;"><span class="material-symbols-outlined" style="font-size:9px;color:#2a7a7a;opacity:0.5;">analytics</span><div style="width:50%;height:2px;background:#1a3c3c;opacity:0.08;border-radius:2px;"></div></div><div style="flex:1;background:#e8f4f4;border-radius:3px;display:flex;flex-direction:column;align-items:center;padding-top:5px;gap:1px;"><span class="material-symbols-outlined" style="font-size:9px;color:#2a7a7a;opacity:0.5;">psychology</span><div style="width:50%;height:2px;background:#1a3c3c;opacity:0.08;border-radius:2px;"></div></div><div style="flex:1;background:#e8f4f4;border-radius:3px;display:flex;flex-direction:column;align-items:center;padding-top:5px;gap:1px;"><span class="material-symbols-outlined" style="font-size:9px;color:#2a7a7a;opacity:0.5;">rocket_launch</span><div style="width:50%;height:2px;background:#1a3c3c;opacity:0.08;border-radius:2px;"></div></div></div></div>',
                // 深灰
                'char-title': '<div style="padding:14px 18px;display:flex;flex-direction:column;justify-content:center;height:100%;"><div style="width:60%;height:7px;background:#e8e8e8;opacity:0.45;border-radius:2px;margin-bottom:5px;"></div><div style="width:18px;height:2px;background:#6ebea8;opacity:0.5;margin-bottom:4px;"></div><div style="width:35%;height:3px;background:#888;opacity:0.2;border-radius:2px;"></div></div>',
                'char-sidebar': '<div style="display:flex;height:100%;"><div style="width:35%;background:#1a1a1a;display:flex;flex-direction:column;padding:8px;justify-content:center;"><div style="width:65%;height:4px;background:#e8e8e8;opacity:0.4;border-radius:2px;margin-bottom:3px;"></div><div style="width:12px;height:2px;background:#6ebea8;opacity:0.4;border-radius:2px;"></div></div><div style="flex:1;padding:8px;display:flex;flex-direction:column;gap:3px;justify-content:center;"><div style="width:55%;height:3px;background:#2a2a2a;opacity:0.3;border-radius:2px;"></div><div style="width:85%;height:2px;background:#444;opacity:0.1;border-radius:2px;"></div><div style="width:75%;height:2px;background:#444;opacity:0.08;border-radius:2px;"></div></div></div>',
                // 極簡
                'mini-title': '<div style="padding:14px 18px;display:flex;flex-direction:column;justify-content:center;height:100%;"><div style="width:55%;height:6px;background:#111;opacity:0.4;border-radius:2px;margin-bottom:4px;"></div><div style="width:16px;height:2px;background:#111;opacity:0.25;margin-bottom:4px;"></div><div style="width:30%;height:3px;background:#888;opacity:0.15;border-radius:2px;"></div></div>',
                'mini-split': '<div style="display:flex;height:100%;"><div style="flex:1;background:#111;display:flex;flex-direction:column;padding:10px;justify-content:center;"><div style="width:60%;height:5px;background:#fff;opacity:0.4;border-radius:2px;margin-bottom:3px;"></div><div style="width:12px;height:1px;background:#666;opacity:0.4;"></div></div><div style="flex:1;padding:10px;display:flex;flex-direction:column;gap:3px;justify-content:center;"><div style="width:70%;height:2px;background:#333;opacity:0.2;border-radius:2px;"></div><div style="width:60%;height:2px;background:#333;opacity:0.15;border-radius:2px;"></div></div></div>',
                // 藏青
                'navy-title': '<div style="padding:14px 18px;display:flex;flex-direction:column;justify-content:center;height:100%;"><div style="width:2px;height:14px;background:#b8960c;opacity:0.5;margin-bottom:2px;"></div><div style="width:55%;height:6px;background:#eae6d8;opacity:0.4;border-radius:2px;margin-bottom:4px;margin-left:8px;"></div><div style="width:35%;height:3px;background:#7a8aa0;opacity:0.2;border-radius:2px;margin-left:8px;"></div></div>',
                'navy-data': '<div style="padding:8px 10px;display:flex;flex-direction:column;gap:4px;height:100%;"><div style="width:40%;height:3px;background:#eae6d8;opacity:0.3;border-radius:2px;"></div><div style="display:flex;gap:3px;"><div style="flex:1;background:rgba(184,150,12,0.06);border-radius:3px;height:24px;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="font-size:8px;color:#b8960c;opacity:0.4;">target</span></div><div style="flex:1;background:rgba(184,150,12,0.06);border-radius:3px;height:24px;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="font-size:8px;color:#b8960c;opacity:0.4;">speed</span></div><div style="flex:1;background:rgba(184,150,12,0.06);border-radius:3px;height:24px;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="font-size:8px;color:#b8960c;opacity:0.4;">thumb_up</span></div></div></div>',
                // 暖橘
                'terra-title': '<div style="padding:14px 18px;display:flex;flex-direction:column;justify-content:center;height:100%;"><div style="width:60%;height:7px;background:#f0e4d7;opacity:0.5;border-radius:2px;margin-bottom:5px;"></div><div style="width:18px;height:2px;background:#c47d4e;opacity:0.5;margin-bottom:4px;"></div><div style="width:35%;height:3px;background:#a08670;opacity:0.25;border-radius:2px;"></div></div>',
                'terra-steps': '<div style="padding:8px 14px;display:flex;flex-direction:column;justify-content:center;height:100%;position:relative;"><div style="position:absolute;left:16px;top:12px;bottom:12px;width:2px;background:#e0d5ca;opacity:0.5;"></div><div style="display:flex;align-items:center;gap:4px;margin-bottom:5px;"><div style="width:7px;height:7px;border-radius:50%;background:#c47d4e;opacity:0.6;flex-shrink:0;z-index:1;"></div><div style="width:50%;height:3px;background:#3d2b1f;opacity:0.15;border-radius:2px;"></div></div><div style="display:flex;align-items:center;gap:4px;margin-bottom:5px;"><div style="width:7px;height:7px;border-radius:50%;background:#c47d4e;opacity:0.5;flex-shrink:0;z-index:1;"></div><div style="width:40%;height:3px;background:#3d2b1f;opacity:0.12;border-radius:2px;"></div></div><div style="display:flex;align-items:center;gap:4px;margin-bottom:5px;"><div style="width:7px;height:7px;border-radius:50%;background:#c47d4e;opacity:0.4;flex-shrink:0;z-index:1;"></div><div style="width:45%;height:3px;background:#3d2b1f;opacity:0.1;border-radius:2px;"></div></div><div style="display:flex;align-items:center;gap:4px;"><div style="width:7px;height:7px;border-radius:50%;background:#c47d4e;opacity:0.3;flex-shrink:0;z-index:1;"></div><div style="width:35%;height:3px;background:#3d2b1f;opacity:0.08;border-radius:2px;"></div></div></div>',
                // 酒紅
                'wine-title': '<div style="padding:14px 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;"><div style="width:60%;height:7px;background:#f5e8ec;opacity:0.45;border-radius:2px;margin-bottom:4px;"></div><div style="width:30px;height:1px;background:#8b3a50;opacity:0.4;margin-bottom:4px;"></div><div style="width:35%;height:3px;background:#9a7080;opacity:0.2;border-radius:2px;"></div></div>',
                'wine-compare': '<div style="padding:6px 10px;display:flex;gap:4px;height:100%;align-items:center;"><div style="flex:1;background:#faf0f2;border-radius:4px;height:80%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span class="material-symbols-outlined" style="font-size:10px;color:#8b3a50;opacity:0.5;">close</span><div style="width:50%;height:2px;background:#5a2030;opacity:0.08;border-radius:2px;"></div></div><span style="font-size:8px;color:#bbb;">VS</span><div style="flex:1;background:#f0f5f2;border-radius:4px;height:80%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span class="material-symbols-outlined" style="font-size:10px;color:#2a7a4a;opacity:0.5;">check_circle</span><div style="width:50%;height:2px;background:#1a4a2a;opacity:0.08;border-radius:2px;"></div></div></div>',
                // 通用
                'blank': '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0.18;"><span class="material-symbols-outlined" style="font-size:28px;">crop_landscape</span></div>',
                'blank-dark': '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="font-size:28px;color:rgba(255,255,255,0.25);">crop_landscape</span></div>',
                'section-break': '<div style="padding:10px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;"><div style="font-size:18px;font-weight:900;color:currentColor;opacity:0.06;line-height:1;">01</div><div style="width:45%;height:5px;background:currentColor;opacity:0.3;border-radius:2px;margin-top:2px;"></div></div>',
                'quote-card': '<div style="padding:10px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;"><div style="font-size:16px;opacity:0.1;line-height:1;">&ldquo;</div><div style="width:55%;height:3px;background:currentColor;opacity:0.15;border-radius:2px;margin:2px 0;"></div><div style="width:18px;height:1px;background:currentColor;opacity:0.08;margin-bottom:2px;"></div><div style="width:30%;height:2px;background:currentColor;opacity:0.08;border-radius:2px;"></div></div>',
                'qa-page': '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;"><div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.35);">Q&A</div><div style="width:40%;height:2px;background:rgba(255,255,255,0.1);border-radius:2px;"></div></div>',
                'end-page': '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;"><div style="width:40%;height:5px;background:rgba(255,255,255,0.3);border-radius:2px;"></div><div style="width:25px;height:1px;background:rgba(255,255,255,0.1);"></div><div style="width:30%;height:2px;background:rgba(255,255,255,0.1);border-radius:2px;"></div></div>',
                // 結構
                'timeline': '<div style="padding:6px 12px;display:flex;height:100%;"><div style="width:2px;background:#e2e8f0;margin:4px 6px 4px 8px;"></div><div style="flex:1;display:flex;flex-direction:column;gap:4px;justify-content:center;"><div style="display:flex;align-items:center;gap:3px;"><div style="width:6px;height:6px;border-radius:50%;background:#6366f1;flex-shrink:0;"></div><div style="width:60%;height:2px;background:#1e293b;opacity:0.12;border-radius:2px;"></div></div><div style="display:flex;align-items:center;gap:3px;"><div style="width:6px;height:6px;border-radius:50%;background:#8b5cf6;flex-shrink:0;"></div><div style="width:50%;height:2px;background:#1e293b;opacity:0.1;border-radius:2px;"></div></div><div style="display:flex;align-items:center;gap:3px;"><div style="width:6px;height:6px;border-radius:50%;background:#059669;flex-shrink:0;"></div><div style="width:55%;height:2px;background:#1e293b;opacity:0.08;border-radius:2px;"></div></div><div style="display:flex;align-items:center;gap:3px;"><div style="width:6px;height:6px;border-radius:50%;background:#d97706;flex-shrink:0;"></div><div style="width:45%;height:2px;background:#1e293b;opacity:0.06;border-radius:2px;"></div></div></div></div>',
                'comparison': '<div style="padding:6px 10px;display:flex;gap:4px;height:100%;align-items:center;"><div style="flex:1;background:#fef2f2;border-radius:4px;height:80%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span class="material-symbols-outlined" style="font-size:10px;color:#dc2626;opacity:0.5;">close</span><div style="width:50%;height:2px;background:#991b1b;opacity:0.08;border-radius:2px;"></div></div><span style="font-size:7px;color:#bbb;">VS</span><div style="flex:1;background:#ecfdf5;border-radius:4px;height:80%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span class="material-symbols-outlined" style="font-size:10px;color:#059669;opacity:0.5;">check_circle</span><div style="width:50%;height:2px;background:#065f46;opacity:0.08;border-radius:2px;"></div></div></div>',
                'stats': '<div style="padding:6px 10px;display:flex;flex-direction:column;gap:4px;height:100%;"><div style="width:40%;height:3px;background:#1e293b;opacity:0.25;border-radius:2px;"></div><div style="display:flex;gap:3px;flex:1;"><div style="flex:1;background:#eff6ff;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#2563eb;opacity:0.5;">95%</div><div style="flex:1;background:#ecfdf5;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#059669;opacity:0.5;">3.2x</div><div style="flex:1;background:#fefce8;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#d97706;opacity:0.5;">4.8</div></div></div>',
                'flow': '<div style="padding:10px 10px;display:flex;gap:2px;height:100%;align-items:center;"><div style="flex:1;background:#eff6ff;border-radius:3px;height:50%;"></div><span class="material-symbols-outlined" style="font-size:8px;color:#cbd5e1;">arrow_forward</span><div style="flex:1;background:#ecfdf5;border-radius:3px;height:50%;"></div><span class="material-symbols-outlined" style="font-size:8px;color:#cbd5e1;">arrow_forward</span><div style="flex:1;background:#fefce8;border-radius:3px;height:50%;"></div><span class="material-symbols-outlined" style="font-size:8px;color:#cbd5e1;">arrow_forward</span><div style="flex:1;background:#fce7f3;border-radius:3px;height:50%;"></div></div>',
                'layered-data': '<div style="padding:6px 10px;display:flex;flex-direction:column;gap:3px;height:100%;justify-content:center;"><div style="background:#eff6ff;border-radius:3px;height:20%;"></div><div style="background:#ecfdf5;border-radius:3px;height:20%;"></div><div style="background:#fefce8;border-radius:3px;height:20%;"></div><div style="background:#fce7f3;border-radius:3px;height:18%;"></div></div>',
            };

            // Fallback wireframe
            const defaultWireframe = (icon, isDark) => {
                const c = isDark ? 'rgba(255,255,255,' : 'rgba(0,0,0,';
                return '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;"><span class="material-symbols-outlined" style="font-size:20px;color:' + c + '0.2);">' + icon + '</span><div style="width:45%;height:3px;background:' + c + '0.1);border-radius:2px;"></div></div>';
            };

            grid.innerHTML = `
            <div class="tpl-category-tabs">
                ${categories.map(c => `<button class="tpl-tab ${c === filter ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('')}
            </div>
            <div class="tpl-grid-inner">
                ${templates.map(t => {
                const bg = t.create(() => '0').background || '#fff';
                const bgStyle = bg.startsWith('linear') ? bg : bg;
                const isDark = /^(linear-gradient.*(#0|#1|#2|#3|#4)|#0|#1|#2)/.test(bg);
                const wf = wireframes[t.id] || defaultWireframe(t.icon, isDark);
                return `
                    <div class="template-card" data-tpl="${t.id}" title="${t.name}">
                        <div class="tpl-preview" style="background:${bgStyle};color:${isDark ? '#fff' : '#1e293b'};">${wf}</div>
                        <div class="tpl-info">
                            <span class="material-symbols-outlined" style="font-size:16px;">${t.icon}</span>
                            <span>${t.name}</span>
                        </div>
                    </div>`;
            }).join('')}
            </div>
        `;

            // Tab 切換
            grid.querySelectorAll('.tpl-tab').forEach(tab => {
                tab.addEventListener('click', () => renderGrid(tab.dataset.cat));
            });

            // 選模板
            grid.querySelectorAll('.template-card').forEach(card => {
                card.addEventListener('click', () => {
                    const tplId = card.dataset.tpl;
                    const tpl = SLIDE_TEMPLATES.find(t => t.id === tplId);
                    if (tpl) {
                        const gen = () => this.slideManager.generateId();
                        const slideData = tpl.create(gen);
                        this.slideManager.slides.splice(this.slideManager.currentIndex + 1, 0, slideData);
                        this.slideManager.navigateTo(this.slideManager.currentIndex + 1);
                        this.slideManager.renderThumbnails();
                        this.slideManager.updateCounter();
                        this.slideManager.save();
                    }
                    this.closeTemplatePicker();
                });
            });
        };

        renderGrid('全部');
        overlay.style.display = 'flex';

        // 關閉
        document.getElementById('templatePickerClose')?.addEventListener('click', () => this.closeTemplatePicker());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeTemplatePicker();
        });
    }

    closeTemplatePicker() {
        const overlay = document.getElementById('templatePickerOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    /* =========================================
       廣播功能
       ========================================= */
    bindBroadcastEvents() {
        const btn = document.getElementById('broadcastBtn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (this.broadcasting) {
                this.stopBroadcast();
            } else {
                this.startBroadcast();
            }
        });

        // 狀態列按鈕
        document.getElementById('broadcastBarStop')?.addEventListener('click', () => this.stopBroadcast());
        document.getElementById('broadcastBarCopy')?.addEventListener('click', () => {
            if (this.sessionCode) {
                const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
                const audUrl = `${base}audience.html?code=${this.sessionCode}`;
                navigator.clipboard.writeText(audUrl).then(() => {
                    this.showToast('已複製互動連結');
                }).catch(() => {
                    navigator.clipboard.writeText(this.sessionCode).then(() => {
                        this.showToast('已複製課堂代碼');
                    });
                });
            }
        });
        document.getElementById('broadcastBarDashboard')?.addEventListener('click', () => {
            if (this.sessionCode) {
                window.open(`dashboard.html?code=${this.sessionCode}`, '_blank');
            }
        });
        document.getElementById('broadcastBarAudience')?.addEventListener('click', () => {
            if (this.sessionCode) {
                const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
                const audUrl = `${base}audience.html?code=${this.sessionCode}`;
                navigator.clipboard.writeText(audUrl).then(() => {
                    this.showToast('✓ 已複製觀眾互動連結');
                }).catch(() => {
                    prompt('複製此連結：', audUrl);
                });
            }
        });

        // 排行榜 toggle
        document.getElementById('lbToggle')?.addEventListener('click', () => {
            const lb = document.getElementById('presLeaderboard');
            const pm = document.getElementById('presentationMode');
            lb?.classList.toggle('open');
            pm?.classList.toggle('lb-active', lb?.classList.contains('open'));
        });
    }

    async startBroadcast() {
        const btn = document.getElementById('broadcastBtn');
        const icon = document.getElementById('broadcastBtnIcon');
        const label = document.getElementById('broadcastBtnLabel');

        // Loading 狀態
        btn.classList.add('broadcast-loading');
        icon.textContent = 'sync';
        label.textContent = '連線中…';

        try {
            // 使用專案的 join_code 作為廣播代碼
            // 確保講師和學員訂閱同一頻道
            const joinCode = this.slideManager.getCurrentJoinCode();
            this.sessionCode = joinCode || generateSessionCode();
            this.onlineStudents = new Map(); // name → timestamp
            this.showcase.setSessionCode(this.sessionCode);

            // 寫入 DB（先清除同 code 的舊記錄，再新增）
            await db.delete('sessions', { session_code: `eq.${this.sessionCode}` });
            const { error } = await db.insert('sessions', {
                session_code: this.sessionCode,
                title: document.querySelector('.file-name')?.textContent || '教學簡報',
                current_slide: '0',
                is_broadcasting: 'true'
            });
            if (error) {
                console.error('建立 session 失敗:', error);
                this.showToast('廣播啟動失敗：資料庫錯誤');
                btn.classList.remove('broadcast-loading');
                icon.textContent = 'cell_tower';
                label.textContent = '廣播';
                return;
            }

            // 連線 Realtime
            await realtime.connect();
            await realtime.subscribe(`session:${this.sessionCode}`);

            // 監聽學員上線/下線
            realtime.on('student_join', (msg) => {
                const p = msg.payload || msg;
                this.onlineStudents.set(p.studentId, {
                    name: p.studentName,
                    joinedAt: Date.now()
                });
                this.updateViewerCount();
                console.log('[Broadcast] student joined:', p.studentName);

                // 新學員加入時，重新廣播當前投影片讓他們看到畫面
                if (this.broadcasting) {
                    const idx = this.presentationIndex ?? this.slideManager.currentIndex;
                    this.broadcastSlideData(idx);
                }
            });

            realtime.on('student_leave', (msg) => {
                const p = msg.payload || msg;
                this.onlineStudents.delete(p.studentId);
                this.updateViewerCount();
                console.log('[Broadcast] student left:', p.studentName);
            });

            // 監聽心跳（學員每 15 秒發一次）
            realtime.on('student_heartbeat', (msg) => {
                const p = msg.payload || msg;
                if (p.studentId) {
                    this.onlineStudents.set(p.studentId, {
                        name: p.studentName,
                        joinedAt: Date.now()
                    });
                }
            });

            // 定期清除超時學員（30 分鐘沒心跳視為離線）
            this._heartbeatCleanup = setInterval(() => {
                const now = Date.now();
                let changed = false;
                for (const [id, info] of this.onlineStudents) {
                    if (now - info.joinedAt > 1800000) {
                        this.onlineStudents.delete(id);
                        changed = true;
                    }
                }
                if (changed) this.updateViewerCount();
            }, 60000);

            // 監聽投票事件
            realtime.on('poll_vote', (msg) => {
                const p = msg.payload || msg;
                console.log('[Broadcast] poll_vote:', p);
                this.poll.handleVoteEvent(p);
            });

            // 發送初始投影片資料
            this.slideManager.saveCurrentSlide();
            this.broadcastSlideData(0);

            this.broadcasting = true;

            // UI 更新 — 按鈕
            btn.classList.remove('broadcast-loading');
            btn.classList.add('broadcasting');
            icon.textContent = 'cell_tower';
            label.textContent = '廣播中';

            // UI 更新 — 狀態列
            const bar = document.getElementById('broadcastBar');
            document.getElementById('broadcastBarCode').textContent = this.sessionCode;
            bar.classList.add('active');
            document.querySelector('.admin-main').style.marginTop = '40px';
            this.updateViewerCount();

            this.showToast(`🟢 廣播已開始！課堂代碼：${this.sessionCode}`);
            console.log('[Broadcast] started, code:', this.sessionCode);

            // 啟動排行榜輪詢
            this.startLeaderboardPolling();

            // 自動進入全螢幕簡報模式
            this.startPresentation();
        } catch (err) {
            console.error('[Broadcast] start error:', err);
            this.showToast('廣播啟動失敗：' + err.message);
            btn.classList.remove('broadcast-loading');
            icon.textContent = 'cell_tower';
            label.textContent = '廣播';
        }
    }

    updateViewerCount() {
        const count = this.onlineStudents ? this.onlineStudents.size : 0;
        const text = count === 0 ? '目前沒有學員' : `${count} 人在線`;
        // 更新獨立的廣播 bar
        const barViewers = document.getElementById('broadcastBarViewers');
        if (barViewers) barViewers.textContent = text;
        // 更新 presTopBar 中的廣播資訊
        const presViewers = document.getElementById('presBroadcastViewers');
        if (presViewers) presViewers.textContent = text;
    }

    async stopBroadcast() {
        if (!this.broadcasting) return;

        // 清除心跳清理
        if (this._heartbeatCleanup) {
            clearInterval(this._heartbeatCleanup);
            this._heartbeatCleanup = null;
        }

        // 更新 DB
        await db.update('sessions', { is_broadcasting: 'false' },
            { session_code: `eq.${this.sessionCode}` });

        // 通知學員
        realtime.publish(`session:${this.sessionCode}`, 'session_end', {});
        realtime.unsubscribe(`session:${this.sessionCode}`);
        realtime.disconnect();

        this.broadcasting = false;
        this.onlineStudents = new Map();

        // 停止排行榜輪詢
        this.stopLeaderboardPolling();

        // UI — 按鈕恢復
        const btn = document.getElementById('broadcastBtn');
        const icon = document.getElementById('broadcastBtnIcon');
        const label = document.getElementById('broadcastBtnLabel');
        if (btn) btn.classList.remove('broadcasting');
        if (icon) icon.textContent = 'cell_tower';
        if (label) label.textContent = '廣播';

        // UI — 隱藏排行榜
        document.getElementById('presLeaderboard')?.classList.remove('open');
        document.getElementById('presentationMode')?.classList.remove('lb-active');

        // UI — 隱藏狀態列（雙重保險）
        const bar = document.getElementById('broadcastBar');
        if (bar) {
            bar.classList.remove('active');
            bar.style.display = 'none';
            setTimeout(() => { bar.style.display = ''; }, 100);
        }
        const adminMain = document.querySelector('.admin-main');
        if (adminMain) adminMain.style.marginTop = '';

        this.showToast('📡 廣播已停止');
        this.sessionCode = null;
    }

    // ─── 排行榜輪詢 ───
    startLeaderboardPolling() {
        this.stopLeaderboardPolling();
        this.updateLeaderboard(); // 立即更新一次
        this._lbTimer = setInterval(() => this.updateLeaderboard(), 5000);
    }

    stopLeaderboardPolling() {
        if (this._lbTimer) { clearInterval(this._lbTimer); this._lbTimer = null; }
    }

    async updateLeaderboard() {
        if (!this.sessionCode) return;
        try {
            const { stateManager } = await import('./interactive/stateManager.js');
            const board = await stateManager.getLeaderboard(this.sessionCode);
            const list = document.getElementById('lbList');
            if (!list) return;

            if (!board.length) {
                if (!list.querySelector('.lb-empty')) {
                    list.innerHTML = '<div class="lb-empty">尚無學員互動</div>';
                }
                return;
            }

            const maxPts = Math.max(...board.map(s => s.totalPoints), 1);
            const existingRows = list.querySelectorAll('.lb-row');
            const existingMap = new Map();
            existingRows.forEach(row => existingMap.set(row.dataset.email, row));

            // Remove empty placeholder
            list.querySelector('.lb-empty')?.remove();

            const newEmails = new Set(board.map(s => s.email));

            // Remove rows that no longer exist
            existingRows.forEach(row => {
                if (!newEmails.has(row.dataset.email)) row.remove();
            });

            // Update or create rows
            board.forEach((s, i) => {
                const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                const barPct = maxPts > 0 ? Math.round((s.totalPoints / maxPts) * 100) : 0;
                let row = existingMap.get(s.email);

                if (row) {
                    // Update existing row in place (smooth)
                    const rankEl = row.querySelector('.lb-rank');
                    if (rankEl) {
                        rankEl.textContent = i + 1;
                        rankEl.className = `lb-rank ${rankClass}`;
                    }
                    const nameEl = row.querySelector('.lb-name');
                    if (nameEl) nameEl.textContent = s.name;
                    const ptsEl = row.querySelector('.lb-pts');
                    if (ptsEl) ptsEl.textContent = s.totalPoints;
                    const barEl = row.querySelector('.lb-bar');
                    if (barEl) barEl.style.width = barPct + '%';
                } else {
                    // Create new row
                    row = document.createElement('div');
                    row.className = 'lb-row';
                    row.dataset.email = s.email;
                    row.innerHTML = `
                        <div class="lb-row-top">
                            <div class="lb-rank ${rankClass}">${i + 1}</div>
                            <div class="lb-name">${this._escHtml(s.name)}</div>
                            <div class="lb-pts">${s.totalPoints}</div>
                        </div>
                        <div class="lb-bar-wrap"><div class="lb-bar" style="width:0%"></div></div>
                    `;
                    list.appendChild(row);
                    // Animate bar in
                    requestAnimationFrame(() => {
                        row.querySelector('.lb-bar').style.width = barPct + '%';
                    });
                }

                // Ensure correct order
                const currentRows = list.querySelectorAll('.lb-row');
                if (currentRows[i] !== row) {
                    list.insertBefore(row, currentRows[i] || null);
                }
            });
        } catch (e) {
            console.warn('[Leaderboard] update failed:', e);
        }
    }

    _escHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * 廣播目前投影片資料 — 包含完整 slide data + index
     */
    broadcastSlideData(index) {
        if (!this.broadcasting) return;
        const slide = this.slideManager.slides[index];
        realtime.publish(`session:${this.sessionCode}`, 'slide_change', {
            slideIndex: index,
            slide: slide,
            totalSlides: this.slideManager.slides.length
        });
        // 同步 DB
        db.update('sessions', { current_slide: String(index) },
            { session_code: `eq.${this.sessionCode}` });
    }

    /* =========================================
       簡報模式
       ========================================= */
    startPresentation() {
        const presentationMode = document.getElementById('presentationMode');
        this.slideManager.saveCurrentSlide();
        this.presentationIndex = this.slideManager.currentIndex;
        this.initBGM();
        this.initReactions();
        this.initQA();
        this.renderPresentationSlide();
        presentationMode.classList.add('active');
        document.body.style.overflow = 'hidden';

        // 講師身份標示 + 廣播整合
        const badge = document.getElementById('presInstructorBadge');
        const presCode = document.getElementById('presBroadcastCode');
        const presViewers = document.getElementById('presBroadcastViewers');
        const presCopyBtn = document.getElementById('presCopyCodeBtn');
        const presStopBtn = document.getElementById('presStopBroadcastBtn');
        if (badge) badge.style.display = this.broadcasting ? 'flex' : 'none';

        // 儀表板按鈕（僅廣播中顯示）
        const dashBtn = document.getElementById('presDashboardBtn');
        if (dashBtn) {
            dashBtn.style.display = this.broadcasting ? 'flex' : 'none';
            dashBtn.onclick = () => {
                if (this.sessionCode) window.open(`dashboard.html?code=${this.sessionCode}`, '_blank');
            };
        }

        if (this.broadcasting) {
            // 隱藏獨立的廣播 bar
            const broadcastBar = document.getElementById('broadcastBar');
            if (broadcastBar) broadcastBar.classList.remove('active');
            document.querySelector('.admin-main').style.marginTop = '';

            // 在 presTopBar 顯示廣播資訊
            if (presCode) { presCode.style.display = 'inline'; presCode.textContent = this.sessionCode; }
            if (presViewers) { presViewers.style.display = 'inline'; this.updateViewerCount(); }
            if (presCopyBtn) {
                presCopyBtn.style.display = 'flex';
                presCopyBtn.onclick = () => {
                    navigator.clipboard.writeText(this.sessionCode).then(() => this.showToast('已複製代碼'));
                };
            }
            if (presStopBtn) {
                presStopBtn.style.display = 'flex';
                presStopBtn.onclick = () => {
                    this.stopBroadcast();
                    // 更新 presTopBar 隱藏廣播元素
                    if (badge) badge.style.display = 'none';
                    if (presCode) presCode.style.display = 'none';
                    if (presViewers) presViewers.style.display = 'none';
                    if (presCopyBtn) presCopyBtn.style.display = 'none';
                    if (presStopBtn) presStopBtn.style.display = 'none';
                    if (dashBtn) dashBtn.style.display = 'none';
                };
            }
        } else {
            if (presCode) presCode.style.display = 'none';
            if (presViewers) presViewers.style.display = 'none';
            if (presCopyBtn) presCopyBtn.style.display = 'none';
            if (presStopBtn) presStopBtn.style.display = 'none';
        }

        // 顯示場次資訊
        this._populatePresTopBar();

        // Top bar 滑鼠移動顯示
        this._presTopBarTimer = null;
        this._presMouseHandler = () => {
            const bar = document.getElementById('presTopBar');
            if (bar) { bar.style.opacity = '1'; bar.style.pointerEvents = 'auto'; }
            clearTimeout(this._presTopBarTimer);
            this._presTopBarTimer = setTimeout(() => {
                if (bar) { bar.style.opacity = '0'; bar.style.pointerEvents = 'none'; }
            }, 3000);
        };
        presentationMode.addEventListener('mousemove', this._presMouseHandler);
        // 初始顯示一下
        this._presMouseHandler();

        // 請求全螢幕
        const el = presentationMode;
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(() => { });
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
        }

        this.scalePresentationSlide();
        this._resizeHandler = this.scalePresentationSlide.bind(this);
        window.addEventListener('resize', this._resizeHandler);
    }

    async _populatePresTopBar() {
        const infoEl = document.getElementById('presInfoText');
        if (!infoEl) return;

        const proj = this.slideManager._projectsCache?.find(
            p => p.id === this.slideManager.currentProjectId
        );

        const parts = [];
        if (proj?.name) parts.push(proj.name);

        // 找今天對應的場次
        const today = new Date().toISOString().slice(0, 10);
        const sessions = proj?.sessions || [];
        const todaySession = sessions.find(s => s.date === today);
        if (todaySession) {
            if (todaySession.date) parts.push(todaySession.date);
            if (todaySession.time) parts.push(todaySession.time);
            if (todaySession.venue) parts.push(todaySession.venue);
        } else if (sessions.length > 0) {
            const sorted = [...sessions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            const nearest = sorted.find(s => s.date >= today) || sorted[sorted.length - 1];
            if (nearest) {
                if (nearest.date) parts.push(nearest.date);
                if (nearest.time) parts.push(nearest.time);
            }
        }

        infoEl.textContent = parts.length > 0 ? parts.join('  ·  ') : (proj?.name || '簡報模式');

        // Follow/Browse toggle
        window._setPresMode = (mode) => {
            const fBtn = document.getElementById('presFollowBtn');
            const bBtn = document.getElementById('presBrowseBtn');
            if (mode === 'follow') {
                fBtn.style.background = 'rgba(255,255,255,0.9)';
                fBtn.style.color = '#1e293b';
                bBtn.style.background = 'transparent';
                bBtn.style.color = 'rgba(255,255,255,0.7)';
            } else {
                bBtn.style.background = 'rgba(255,255,255,0.9)';
                bBtn.style.color = '#1e293b';
                fBtn.style.background = 'transparent';
                fBtn.style.color = 'rgba(255,255,255,0.7)';
            }
        };
    }

    // ── 背景音樂 ──
    initBGM() {
        if (this._bgmAudio) return;
        const bgmUrl = this.slideManager?.slides?.[0]?.bgmUrl || localStorage.getItem('ix_bgm_url') || '';
        if (!bgmUrl) return;
        this._bgmAudio = new Audio(bgmUrl);
        this._bgmAudio.loop = true;
        this._bgmAudio.volume = 0;
        this._bgmMuted = false;
        // 靜音按鈕
        const btn = document.createElement('button');
        btn.className = 'bgm-toggle';
        btn.innerHTML = '<span class="material-symbols-outlined">volume_up</span>';
        btn.addEventListener('click', () => {
            this._bgmMuted = !this._bgmMuted;
            btn.querySelector('.material-symbols-outlined').textContent = this._bgmMuted ? 'volume_off' : 'volume_up';
            if (this._bgmMuted) { this._bgmAudio.volume = 0; }
            else if (!this._bgmAudio.paused) { this._bgmAudio.volume = 0.3; }
        });
        document.getElementById('presentationMode')?.appendChild(btn);
        this._bgmToggle = btn;
    }

    updateBGM() {
        if (!this._bgmAudio) return;
        const slide = this.slideManager.slides[this.presentationIndex];
        if (!slide) return;
        const interactiveTypes = ['matching', 'fillblank', 'ordering', 'quiz', 'poll', 'truefalse', 'opentext', 'scale', 'buzzer', 'wordcloud', 'hotspot'];
        const hasInteractive = slide.elements.some(el => interactiveTypes.includes(el.type));
        if (hasInteractive) {
            this._bgmAudio.play().catch(() => { });
            if (!this._bgmMuted) {
                // 淡入
                let vol = this._bgmAudio.volume;
                const fadeIn = setInterval(() => {
                    vol = Math.min(vol + 0.05, 0.3);
                    this._bgmAudio.volume = vol;
                    if (vol >= 0.3) clearInterval(fadeIn);
                }, 50);
            }
            if (this._bgmToggle) this._bgmToggle.style.display = '';
        } else {
            // 淡出
            if (!this._bgmAudio.paused) {
                let vol = this._bgmAudio.volume;
                const fadeOut = setInterval(() => {
                    vol = Math.max(vol - 0.05, 0);
                    this._bgmAudio.volume = vol;
                    if (vol <= 0) { clearInterval(fadeOut); this._bgmAudio.pause(); }
                }, 50);
            }
            if (this._bgmToggle) this._bgmToggle.style.display = 'none';
        }
    }

    stopBGM() {
        if (this._bgmAudio) { this._bgmAudio.pause(); this._bgmAudio.currentTime = 0; }
        if (this._bgmToggle) { this._bgmToggle.remove(); this._bgmToggle = null; }
        this._bgmAudio = null;
    }

    // ═══════════ QR Code Overlay ═══════════
    updateQRCode() {
        let qrEl = document.getElementById('presQRCode');
        const slide = this.slideManager.slides[this.presentationIndex];
        const hasInteractive = slide?.elements?.some(el =>
            ['quiz', 'poll', 'truefalse', 'opentext', 'scale', 'buzzer', 'wordcloud',
                'hotspot', 'matching', 'fillblank', 'ordering'].includes(el.type));

        if (!this.broadcasting || !this.sessionCode || !hasInteractive) {
            if (qrEl) qrEl.style.display = 'none';
            return;
        }

        const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
        const audUrl = `${base}audience.html?code=${this.sessionCode}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(audUrl)}&bgcolor=ffffff&color=4f46e5`;

        if (!qrEl) {
            qrEl = document.createElement('div');
            qrEl.id = 'presQRCode';
            qrEl.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:10001;background:white;border-radius:12px;padding:8px;box-shadow:0 4px 20px rgba(0,0,0,0.15);opacity:0.85;transition:opacity 0.3s;cursor:pointer;';
            qrEl.innerHTML = `<img src="${qrSrc}" width="100" height="100" style="display:block;border-radius:6px;">
                <div style="text-align:center;font-size:10px;color:#6366f1;margin-top:4px;font-weight:600;">掃碼互動</div>`;
            qrEl.addEventListener('mouseenter', () => qrEl.style.opacity = '1');
            qrEl.addEventListener('mouseleave', () => qrEl.style.opacity = '0.85');
            qrEl.addEventListener('click', () => {
                navigator.clipboard.writeText(audUrl).then(() => this.showToast('✓ 已複製互動連結'));
            });
            document.getElementById('presentationMode').appendChild(qrEl);
        }
        qrEl.querySelector('img').src = qrSrc;
        qrEl.style.display = '';
    }

    removeQRCode() {
        const el = document.getElementById('presQRCode');
        if (el) el.remove();
    }

    // ═══════════ Emoji Reactions ═══════════
    initReactions() {
        if (!this.broadcasting || !this.sessionCode) return;
        // 監聽 reaction 事件
        this._reactionHandler = (payload) => {
            const emoji = payload?.payload?.emoji || payload?.new?.emoji;
            if (emoji) this.spawnEmojiParticle(emoji);
        };
        // 向 realtime channel 訂閱 reaction
        if (this._realtimeChannel) {
            this._realtimeChannel.on('broadcast', { event: 'reaction' }, this._reactionHandler);
        }
    }

    spawnEmojiParticle(emoji) {
        const container = document.getElementById('presentationMode');
        if (!container) return;
        const el = document.createElement('div');
        const x = 20 + Math.random() * 60; // 20%-80% of screen
        el.textContent = emoji;
        el.style.cssText = `position:fixed;bottom:0;left:${x}%;font-size:${28 + Math.random() * 20}px;z-index:10002;pointer-events:none;opacity:1;transition:none;`;
        container.appendChild(el);

        // Animate float up
        const duration = 2000 + Math.random() * 1500;
        const drift = (Math.random() - 0.5) * 100;
        el.animate([
            { transform: 'translateY(0) scale(1)', opacity: 1 },
            { transform: `translateY(-${300 + Math.random() * 400}px) translateX(${drift}px) scale(0.5)`, opacity: 0 }
        ], { duration, easing: 'ease-out' }).onfinish = () => el.remove();
    }

    stopReactions() {
        // Channel cleanup is handled by stopBroadcast
        this._reactionHandler = null;
    }

    // ═══════════ Q&A Panel ═══════════
    initQA() {
        if (!this.broadcasting || !this.sessionCode) return;
        this._qaQuestions = [];
        this._qaOpen = false;

        // 建立 Q&A 按鈕
        let qaBtn = document.getElementById('presQABtn');
        if (!qaBtn) {
            qaBtn = document.createElement('button');
            qaBtn.id = 'presQABtn';
            qaBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10001;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:none;cursor:pointer;font-size:20px;box-shadow:0 4px 16px rgba(99,102,241,0.3);display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';
            qaBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:24px;">forum</span>';
            qaBtn.addEventListener('click', () => this.toggleQAPanel());
            document.getElementById('presentationMode').appendChild(qaBtn);
        }

        // 建立面板
        let panel = document.getElementById('presQAPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'presQAPanel';
            panel.style.cssText = 'position:fixed;top:0;right:-380px;width:380px;height:100vh;background:white;z-index:10003;box-shadow:-4px 0 20px rgba(0,0,0,0.1);transition:right 0.3s ease;display:flex;flex-direction:column;';
            panel.innerHTML = `
                <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:8px;"><span class="material-symbols-outlined" style="font-size:20px;color:#6366f1;">question_answer</span><span style="font-size:16px;font-weight:600;">觀眾提問</span></div>
                    <button id="qaCloseBtn" style="background:none;border:none;cursor:pointer;font-size:20px;color:#94a3b8;">✕</button>
                </div>
                <div id="qaListContainer" style="flex:1;overflow-y:auto;padding:12px 16px;"></div>`;
            document.getElementById('presentationMode').appendChild(panel);
            document.getElementById('qaCloseBtn').addEventListener('click', () => this.toggleQAPanel());
        }

        // 監聽 Q&A 事件
        this._qaHandler = (payload) => {
            const data = payload?.payload || payload?.new;
            if (!data) return;
            if (data.type === 'question') {
                const existing = this._qaQuestions.find(q => q.id === data.id);
                if (!existing) {
                    this._qaQuestions.push({ id: data.id, text: data.text, author: data.author, votes: 1, answered: false, time: Date.now() });
                    this.updateQABadge();
                    this.renderQAList();
                }
            } else if (data.type === 'upvote') {
                const q = this._qaQuestions.find(q => q.id === data.questionId);
                if (q) { q.votes = (q.votes || 0) + 1; this.renderQAList(); }
            }
        };
        if (this._realtimeChannel) {
            this._realtimeChannel.on('broadcast', { event: 'qa' }, this._qaHandler);
        }
    }

    toggleQAPanel() {
        const panel = document.getElementById('presQAPanel');
        if (!panel) return;
        this._qaOpen = !this._qaOpen;
        panel.style.right = this._qaOpen ? '0' : '-380px';
        if (this._qaOpen) this.renderQAList();
    }

    updateQABadge() {
        const btn = document.getElementById('presQABtn');
        if (!btn) return;
        const count = this._qaQuestions.filter(q => !q.answered).length;
        const badge = btn.querySelector('.qa-badge') || document.createElement('span');
        badge.className = 'qa-badge';
        badge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:#ef4444;color:white;font-size:11px;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;';
        badge.textContent = count;
        if (count > 0) { btn.style.position = 'fixed'; btn.appendChild(badge); }
        else { badge.remove(); }
    }

    renderQAList() {
        const container = document.getElementById('qaListContainer');
        if (!container) return;
        const sorted = [...this._qaQuestions].sort((a, b) => b.votes - a.votes);
        if (sorted.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px 0;color:#94a3b8;font-size:14px;"><span class="material-symbols-outlined" style="font-size:32px;display:block;margin-bottom:8px;">chat_bubble_outline</span>尚無提問<br><span style="font-size:12px;">觀眾可在互動頁面發送提問</span></div>';
            return;
        }
        container.innerHTML = sorted.map(q => {
            const initial = (q.author || '匿')[0];
            const timeStr = q.time ? new Date(q.time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '';
            return `
            <div style="display:flex;gap:10px;margin-bottom:12px;align-items:flex-start;">
                <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#475569,#334155);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;">${initial}</div>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;">
                        <span style="font-size:13px;font-weight:600;color:#1e293b;">${q.author || '匿名'}</span>
                        <span style="font-size:10px;color:#94a3b8;">${timeStr}</span>
                    </div>
                    <div style="padding:10px 14px;border-radius:0 12px 12px 12px;background:${q.answered ? '#f0fdf4' : '#f1f5f9'};border:1px solid ${q.answered ? '#d1fae5' : '#e2e8f0'};">
                        <div style="font-size:14px;color:#1e293b;line-height:1.5;">${q.text}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;margin-top:6px;">
                        <span style="display:flex;align-items:center;gap:2px;font-size:12px;color:#6366f1;font-weight:500;cursor:default;"><span class="material-symbols-outlined" style="font-size:14px;">thumb_up</span> ${q.votes}</span>
                        <button onclick="window.__markQAAnswered('${q.id}')" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid ${q.answered ? '#86efac' : '#cbd5e1'};background:${q.answered ? '#d1fae5' : 'transparent'};color:${q.answered ? '#059669' : '#64748b'};cursor:pointer;">
                            ${q.answered ? '已回答' : '標記已答'}
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    removeQA() {
        document.getElementById('presQABtn')?.remove();
        document.getElementById('presQAPanel')?.remove();
        this._qaQuestions = [];
        this._qaOpen = false;
    }

    exitPresentation() {
        const presentationMode = document.getElementById('presentationMode');
        presentationMode.classList.remove('active');
        document.body.style.overflow = '';

        // 清除 mouse handler
        if (this._presMouseHandler) {
            presentationMode.removeEventListener('mousemove', this._presMouseHandler);
        }
        clearTimeout(this._presTopBarTimer);

        // 清除 showcase polling timers
        if (this.showcase) this.showcase.destroy();

        // 退出全螢幕
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }

        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }

        // 恢復廣播 bar（如果仍在廣播中）
        if (this.broadcasting) {
            const broadcastBar = document.getElementById('broadcastBar');
            if (broadcastBar) broadcastBar.classList.add('active');
            document.querySelector('.admin-main').style.marginTop = '40px';
        }

        // 隱藏 presTopBar 廣播元素
        ['presInstructorBadge', 'presBroadcastCode', 'presBroadcastViewers',
            'presCopyCodeBtn', 'presStopBroadcastBtn', 'presDashboardBtn'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

        // 停止背景音樂
        this.stopBGM();
        this.removeQRCode();
        this.stopReactions();
        this.removeQA();
    }

    scalePresentationSlide() {
        const presentationSlide = document.getElementById('presentationSlide');
        const scaleX = window.innerWidth / 960;
        const scaleY = window.innerHeight / 540;
        const scale = Math.min(scaleX, scaleY) * 0.95;
        presentationSlide.style.transform = `scale(${scale})`;
    }

    renderPresentationSlide() {
        const slide = this.slideManager.slides[this.presentationIndex];
        const presentationSlide = document.getElementById('presentationSlide');
        if (!slide) return;

        presentationSlide.innerHTML = '';

        // 套用背景
        if (slide.background && slide.background !== '#ffffff') {
            presentationSlide.style.background = slide.background;
        } else {
            presentationSlide.style.background = 'white';
        }

        // 計算此頁的動畫步驟總數
        const maxStep = Math.max(0, ...slide.elements.map(e => e.animOrder || 0));
        this._currentBuildStep = 0;
        this._maxBuildStep = maxStep;

        slide.elements.forEach(element => {
            const el = this.slideManager.createElementNode(element);
            if (el) {
                el.classList.add('presentation-element');
                // 有 animOrder 的元素先隱藏
                if (element.animOrder && element.animOrder > 0) {
                    el.style.opacity = '0';
                    el.style.transform = 'translateY(18px)';
                    el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                    el.dataset.animOrder = element.animOrder;
                }
                presentationSlide.appendChild(el);
            }
        });

        // 更新計數器
        const counter = document.getElementById('presCounterTop');
        if (counter) {
            counter.textContent = `${this.presentationIndex + 1} / ${this.slideManager.slides.length}`;
        }

        // 初始化互動元件
        setTimeout(() => {
            this.matchingGame.init();
            this.fillBlank.init();
            this.ordering.init();
            this.showcase.init();
            this.quiz.init();
            this.poll.init();
            if (this.trueFalse) this.trueFalse.init();
            if (this.openText) this.openText.init();
            if (this.scale) this.scale.init();
            if (this.buzzer) this.buzzer.init();
            if (this.wordCloud) this.wordCloud.init();
            if (this.hotspot) this.hotspot.init();
            if (this.documentViewer) this.documentViewer.init();
            if (this.broadcasting && this.sessionCode) {
                this.poll.loadVotesForPresenter(this.sessionCode);
            }
            if (this.countdown?.observeNewElements) this.countdown.observeNewElements();
        }, 100);

        // 背景音樂
        this.updateBGM();

        // QR Code（廣播中 + 互動頁才顯示）
        this.updateQRCode();
    }

    // 顯示下一個動畫步驟，回傳 true 表示還有步驟要顯示
    revealNextBuildStep() {
        if (this._currentBuildStep >= this._maxBuildStep) return false;
        this._currentBuildStep++;
        const step = this._currentBuildStep;
        const slide = document.getElementById('presentationSlide');
        if (!slide) return false;
        slide.querySelectorAll(`[data-anim-order="${step}"]`).forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
        return this._currentBuildStep < this._maxBuildStep;
    }

    bindPresentationEvents() {
        const presentationMode = document.getElementById('presentationMode');
        const exitBtn = document.getElementById('exitPresentation');
        const prevBtn = document.getElementById('presPrev');
        const nextBtn = document.getElementById('presNext');
        const fsToggle = document.getElementById('presFullscreenToggle');

        exitBtn.addEventListener('click', () => this.exitPresentation());

        prevBtn.addEventListener('click', () => {
            if (this.presentationIndex > 0) {
                this.presentationIndex--;
                this.renderPresentationSlide();
                this.broadcastSlideData(this.presentationIndex);
            }
        });

        nextBtn.addEventListener('click', () => {
            if (this.presentationIndex < this.slideManager.slides.length - 1) {
                this.presentationIndex++;
                this.renderPresentationSlide();
                this.broadcastSlideData(this.presentationIndex);
            }
        });

        // 全螢幕切換
        if (fsToggle) {
            fsToggle.addEventListener('click', () => {
                if (document.fullscreenElement || document.webkitFullscreenElement) {
                    if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                    fsToggle.querySelector('.material-symbols-outlined').textContent = 'fullscreen';
                } else {
                    const el = presentationMode;
                    if (el.requestFullscreen) el.requestFullscreen().catch(() => { });
                    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
                    fsToggle.querySelector('.material-symbols-outlined').textContent = 'fullscreen_exit';
                }
            });
        }

        // 監聽全螢幕狀態變化（使用者按瀏覽器 Esc 時）
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && presentationMode.classList.contains('active')) {
                // 廣播中 or 檔案選擇器導致的 fullscreen 退出 → 不退出簡報模式
                if (this.broadcasting || this._skipFullscreenExit || this._fileInputActive) {
                    this._skipFullscreenExit = false;
                    // 更新全螢幕按鈕圖示
                    const fsIcon = document.querySelector('#presFullscreenBtn .material-symbols-outlined');
                    if (fsIcon) fsIcon.textContent = 'fullscreen';
                    return;
                }
                // 延遲檢查：避免 file input 觸發的短暫 fullscreen 離開
                setTimeout(() => {
                    if (!document.fullscreenElement && presentationMode.classList.contains('active') && !this.broadcasting && !this._fileInputActive) {
                        this.exitPresentation();
                    }
                }, 500);
            }
        });

        // 工具列播放按鈕
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.startPresentation());
        }

        // F5 = 從頭播放, Shift+F5 = 從目前頁播放
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F5') {
                e.preventDefault();
                if (presentationMode.classList.contains('active')) return;
                if (e.shiftKey) {
                    // Shift+F5: 從目前投影片開始
                    this.startPresentation();
                } else {
                    // F5: 從第一頁開始
                    this.slideManager.switchSlide(0);
                    this.startPresentation();
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (!presentationMode.classList.contains('active')) return;

            if (e.key === 'Escape') {
                this.exitPresentation();
            } else if (e.key === 'ArrowRight' || e.key === ' ') {
                // 不在互動元素內才切換頁面
                const tag = document.activeElement?.tagName;
                if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(tag)) return;
                e.preventDefault();
                // 先顯示動畫步驟，全部顯示完再切下一頁
                if (this._maxBuildStep > 0 && this._currentBuildStep < this._maxBuildStep) {
                    this.revealNextBuildStep();
                } else if (this.presentationIndex < this.slideManager.slides.length - 1) {
                    this.presentationIndex++;
                    this.renderPresentationSlide();
                    this.broadcastSlideData(this.presentationIndex);
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (this.presentationIndex > 0) {
                    this.presentationIndex--;
                    this.renderPresentationSlide();
                    this.broadcastSlideData(this.presentationIndex);
                }
            }
        });
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('presentationMode').classList.contains('active')) return;
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            if (document.activeElement.contentEditable === 'true') return;

            // Ctrl/Cmd + S 儲存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.slideManager.save();
                this.showToast('已儲存');
            }

            // Ctrl/Cmd + Z 復原
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }

            // Ctrl/Cmd + Shift + Z 重做
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.redo();
            }

            // Ctrl/Cmd + Y 重做
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }

            // Ctrl/Cmd + D 複製元素
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.duplicateElement();
            }

            // Page Up / Page Down
            if (e.key === 'PageUp') {
                e.preventDefault();
                this.slideManager.prev();
            }
            if (e.key === 'PageDown') {
                e.preventDefault();
                this.slideManager.next();
            }

            // Arrow Up / Arrow Down（切換投影片）
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.slideManager.prev();
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.slideManager.next();
            }

            // F5 簡報模式
            if (e.key === 'F5') {
                e.preventDefault();
                this.startPresentation();
            }

            // Delete / Backspace — 由 dragDrop.js 統一處理（支援多選）

            // Escape 取消選取
            if (e.key === 'Escape') {
                if (this.editor?.selectedElement) {
                    this.editor.deselectAll?.();
                    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                }
            }

            // Ctrl/Cmd + C 複製投影片（無選取元素時）
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey) {
                if (!this.editor?.selectedElement) {
                    e.preventDefault();
                    const slide = this.slideManager.getCurrentSlide();
                    if (slide) {
                        this._copiedSlide = JSON.parse(JSON.stringify(slide));
                        this.showToast('已複製投影片');
                    }
                }
            }

            // Ctrl/Cmd + V 貼上投影片（無選取元素時）
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey) {
                if (!this.editor?.selectedElement && this._copiedSlide) {
                    e.preventDefault();
                    const dup = JSON.parse(JSON.stringify(this._copiedSlide));
                    dup.id = this.slideManager.generateId();
                    dup.elements.forEach(el => { el.id = this.slideManager.generateId(); });
                    this.slideManager.slides.splice(this.slideManager.currentIndex + 1, 0, dup);
                    this.slideManager.navigateTo(this.slideManager.currentIndex + 1);
                    this.slideManager.renderThumbnails();
                    this.slideManager.updateCounter();
                    this.slideManager.save();
                    this.showToast('已貼上投影片');
                }
            }

            // Ctrl/Cmd + N 新增投影片（模板選擇器）
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.openTemplatePicker();
            }

            // Ctrl/Cmd + Shift + D 複製投影片
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.duplicateCurrentSlide();
            }
        });
    }

    /* =========================================
       Toast 通知
       ========================================= */
    showToast(message) {
        let toast = document.querySelector('.toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-notification';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
}

// 啟動應用程式
async function initApp() {
    window.app = new App();
    // 掛載 AI Agent 控制接口
    try {
        const { SlideAPI } = await import('./slideAPI.js');
        window.SlideAPI = new SlideAPI(window.app.slideManager);
        console.log('✅ SlideAPI ready — window.SlideAPI');
    } catch (e) {
        console.warn('SlideAPI load failed:', e);
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Q&A 全域函式
window.__markQAAnswered = function (qid) {
    if (!window.app || !window.app._qaQuestions) return;
    const q = window.app._qaQuestions.find(q => q.id === qid);
    if (q) { q.answered = !q.answered; window.app.renderQAList(); window.app.updateQABadge(); }
};
