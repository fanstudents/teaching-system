/**
 * 互動式教學簡報系統 - 主程式入口
 */

import { SlideManager } from './slideManager.js?v=20260224';
import { Editor } from './editor.js?v=20260224';
import { DragDrop } from './dragDrop.js?v=20260224';
import { showToast, showConfirm, showInput } from './ui.js?v=20260224';
import { MatchingGame } from './interactive/matching.js?v=20260224';
import { FillBlank } from './interactive/fillBlank.js?v=20260224';
import { CardCopy } from './interactive/cardCopy.js?v=20260224';
import { Showcase } from './interactive/showcase.js?v=20260224';
import { OrderingGame } from './interactive/ordering.js?v=20260224';
import { QuizGame } from './interactive/quiz.js?v=20260224';
import { PollGame } from './interactive/poll.js?v=20260224';
import { CountdownTimer } from './interactive/countdown.js?v=20260224';
import { TrueFalseGame } from './interactive/truefalse.js?v=20260228';
import { OpenTextGame } from './interactive/opentext.js?v=20260228';
import { ScaleGame } from './interactive/scale.js?v=20260228';
import { BuzzerGame } from './interactive/buzzer.js?v=20260228';
import { WordCloudGame } from './interactive/wordcloud.js?v=20260228';
import { HotspotGame } from './interactive/hotspot.js?v=20260228';

import { HomeworkSubmission } from './homework.js?v=20260224';
import { db, realtime, generateSessionCode, ai } from './supabase.js';
import { SLIDE_TEMPLATES } from './templates.js?v=20260224';
import { IconLibrary } from './iconLibrary.js?v=20260224';
import { SlideExporter } from './exportSlides.js?v=20260226';

class App {
    constructor() {
        // 初始化模組
        this.slideManager = new SlideManager();
        this.editor = new Editor(this.slideManager);
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
        document.getElementById('presentBtn').addEventListener('click', () => {
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

        // 複製文字卡片
        document.getElementById('copyCardBtn').addEventListener('click', () => {
            this.editor.addCopyCard();
        });

        // 圖表
        document.getElementById('addBarChartBtn')?.addEventListener('click', () => this.editor.addChart('bar'));
        document.getElementById('addHBarChartBtn')?.addEventListener('click', () => this.editor.addChart('horizontal-bar'));
        document.getElementById('addDonutChartBtn')?.addEventListener('click', () => this.editor.addChart('donut'));

        // 作業提交
        document.getElementById('addHomeworkBtn').addEventListener('click', () => {
            this.showHomeworkDialog();
        });

        // 展示牆
        document.getElementById('addShowcaseBtn')?.addEventListener('click', () => {
            this.addShowcaseElement();
        });

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
        const toggle = document.getElementById('speakerNotesToggle');
        const panel = document.getElementById('speakerNotesPanel');
        const textarea = document.getElementById('speakerNotesText');

        if (!toggle || !panel || !textarea) return;

        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.toggle('open');
            textarea.style.display = isOpen ? 'block' : 'none';
            if (isOpen) textarea.focus();
        });

        // 儲存備註（debounced）
        let noteTimer = null;
        textarea.addEventListener('input', () => {
            const slide = this.slideManager.slides[this.slideManager.currentIndex];
            if (slide) slide.notes = textarea.value;
            clearTimeout(noteTimer);
            noteTimer = setTimeout(() => this.slideManager.save(), 800);
        });
    }

    updateSpeakerNotes() {
        const textarea = document.getElementById('speakerNotesText');
        if (!textarea) return;
        const slide = this.slideManager.slides[this.slideManager.currentIndex];
        textarea.value = slide?.notes || '';
    }

    /* =========================================
       AI 出題
       ========================================= */
    openAiQuizModal() {
        const overlay = document.getElementById('aiQuizOverlay');
        if (!overlay) return;
        overlay.style.display = 'flex';

        document.getElementById('aiQuizClose')?.addEventListener('click', () => {
            overlay.style.display = 'none';
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });

        const genBtn = document.getElementById('aiQuizGenerate');
        // 移除舊的 listener（避免重複綁定）
        const newBtn = genBtn.cloneNode(true);
        genBtn.parentNode.replaceChild(newBtn, genBtn);
        newBtn.addEventListener('click', () => this.generateAiQuiz());
    }

    async generateAiQuiz() {
        const topic = document.getElementById('aiQuizTopic').value.trim();
        const count = parseInt(document.getElementById('aiQuizCount').value) || 3;
        const difficulty = document.getElementById('aiQuizDifficulty').value;
        const status = document.getElementById('aiQuizStatus');

        if (!topic) {
            status.textContent = '⚠️ 請輸入主題';
            status.style.color = '#dc2626';
            return;
        }

        const diffMap = { easy: '簡單', medium: '中等', hard: '困難' };
        status.textContent = '⏳ AI 正在生成題目…';
        status.style.color = '#64748b';

        const btn = document.getElementById('aiQuizGenerate');
        btn.disabled = true;
        btn.style.opacity = '0.5';

        try {
            const prompt = `你是一個教育內容專家。請根據以下條件生成選擇題：
    主題：${topic}
    題數：${count}
    難度：${diffMap[difficulty] || '中等'}

    要求：
    - 每題 4 個選項，僅 1 個正確
    - 用繁體中文
    - 回傳純 JSON 陣列，不要有任何其他文字
    - 格式：[{"question": "題目", "options": [{"text": "選項A", "correct": true}, {"text": "選項B", "correct": false}, ...]}]`;

            const result = await ai.chat([
                { role: 'system', content: '你是教育內容生成器，只回傳 JSON，不加任何額外說明。' },
                { role: 'user', content: prompt }
            ], { model: 'openai/gpt-4o-mini', temperature: 0.8 });

            // 解析 JSON
            const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
            const questions = JSON.parse(jsonStr);

            if (!Array.isArray(questions) || questions.length === 0) {
                throw new Error('AI 回傳格式不正確');
            }

            // 為每題建立一張投影片
            for (const q of questions) {
                const gen = () => this.slideManager.generateId();
                const slide = {
                    id: gen(),
                    elements: [
                        {
                            id: gen(),
                            type: 'quiz',
                            x: 50, y: 50,
                            width: 600, height: 400,
                            question: q.question,
                            multiple: false,
                            options: q.options.map(o => ({
                                text: o.text,
                                correct: !!o.correct
                            }))
                        }
                    ],
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
            grid.innerHTML = `
            <div class="tpl-category-tabs">
                ${categories.map(c => `<button class="tpl-tab ${c === filter ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('')}
            </div>
            <div class="tpl-grid-inner">
                ${templates.map(t => {
                // 產生小預覽
                const bg = t.create(() => '0').background || '#fff';
                const bgStyle = bg.startsWith('linear') ? bg : bg;
                return `
                    <div class="template-card" data-tpl="${t.id}" title="${t.name}">
                        <div class="tpl-preview" style="background:${bgStyle};"></div>
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

        // UI — 按鈕恢復
        const btn = document.getElementById('broadcastBtn');
        const icon = document.getElementById('broadcastBtnIcon');
        const label = document.getElementById('broadcastBtnLabel');
        btn.classList.remove('broadcasting');
        icon.textContent = 'cell_tower';
        label.textContent = '廣播';

        // UI — 隱藏狀態列
        const bar = document.getElementById('broadcastBar');
        bar.classList.remove('active');
        document.querySelector('.admin-main').style.marginTop = '';

        this.showToast('📡 廣播已停止');
        this.sessionCode = null;
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

        slide.elements.forEach(element => {
            const el = this.slideManager.createElementNode(element);
            if (el) {
                // 保留 position:absolute；僅加上 presentation-element 禁用編輯交互
                el.classList.add('presentation-element');
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
            if (this.broadcasting && this.sessionCode) {
                this.poll.loadVotesForPresenter(this.sessionCode);
            }
            if (this.countdown) this.countdown.observeNewElements();
        }, 100);

        // 背景音樂
        this.updateBGM();

        // QR Code（廣播中 + 互動頁才顯示）
        this.updateQRCode();
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
                if (this.presentationIndex < this.slideManager.slides.length - 1) {
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

            // Delete / Backspace 刪除選取元素
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // 正在編輯文字時不攔截
                const active = document.activeElement;
                if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
                    return;
                }
                if (this.editor?.selectedElement) {
                    e.preventDefault();
                    this.editor.deleteSelectedElement();
                }
                // 不再 fallback 刪除投影片，避免誤刪
            }

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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new App();
    });
} else {
    window.app = new App();
}

// Q&A 全域函式
window.__markQAAnswered = function (qid) {
    if (!window.app || !window.app._qaQuestions) return;
    const q = window.app._qaQuestions.find(q => q.id === qid);
    if (q) { q.answered = !q.answered; window.app.renderQAList(); window.app.updateQABadge(); }
};
