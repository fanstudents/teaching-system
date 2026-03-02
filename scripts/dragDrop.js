/**
 * 拖曳模組
 * 負責元素的拖曳移動與縮放
 */

export class DragDrop {
    constructor(slideManager, editor) {
        this.slideManager = slideManager;
        this.editor = editor;

        this.canvasContentEl = document.getElementById('canvasContent');

        this.isDragging = false;
        this.isResizing = false;
        this.activeElement = null;
        this.activeHandle = null;

        this.startX = 0;
        this.startY = 0;
        this.startLeft = 0;
        this.startTop = 0;
        this.startWidth = 0;
        this.startHeight = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // 使用 pointer events + setPointerCapture 確保不會丟失 pointerup
        this.canvasContentEl.addEventListener('pointerdown', this.handleMouseDown.bind(this));
        document.addEventListener('pointermove', this.handleMouseMove.bind(this));
        document.addEventListener('pointerup', this.handleMouseUp.bind(this));
        // macOS 觸控板快速拖曳時會觸發 pointercancel 而非 pointerup
        document.addEventListener('pointercancel', this.handleMouseUp.bind(this));

        // 阻止瀏覽器原生拖曳（圖片等）
        this.canvasContentEl.addEventListener('dragstart', e => e.preventDefault());

        // 安全重置
        window.addEventListener('blur', () => this.forceReset());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.forceReset();
        });

        // 雙擊編輯文字
        this.canvasContentEl.addEventListener('dblclick', this.handleDoubleClick.bind(this));

        // 點擊空白處取消選取
        document.getElementById('slideCanvas').addEventListener('click', (e) => {
            if (e.target.id === 'slideCanvas' || e.target.id === 'canvasContent') {
                this.editor.deselectAll();
            }
        });

        // 鍵盤事件
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    forceReset() {
        if (this.isDragging && this.activeElement) {
            this.activeElement.style.cursor = 'move';
        }
        this.isDragging = false;
        this.isResizing = false;
        this.activeElement = null;
        this.activeHandle = null;
        this._pointerId = null;
        document.querySelectorAll('.snap-guide').forEach(g => g.remove());
    }

    handleMouseDown(e) {
        const element = e.target.closest('.editable-element');
        const handle = e.target.closest('.resize-handle');

        if (handle && this.editor.selectedElement) {
            // 開始 resize
            this.isResizing = true;
            this.activeElement = this.editor.selectedElement;
            this.activeHandle = handle.dataset.handle;

            this.startX = e.clientX;
            this.startY = e.clientY;
            this.startLeft = parseInt(this.activeElement.style.left) || 0;
            this.startTop = parseInt(this.activeElement.style.top) || 0;
            this.startWidth = this.activeElement.offsetWidth;
            this.startHeight = this.activeElement.offsetHeight;

            // 鎖定 pointer — 確保 pointerup 不會丟失
            this._pointerId = e.pointerId;
            try { handle.setPointerCapture(e.pointerId); } catch (_) { }

            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (element) {
            // 如果此元素正在編輯中，或者雙擊後需要正常進行文字編輯，略過拖曳與 preventDefault
            if (element.contentEditable === 'true' || element.classList.contains('editing')) {
                return;
            }

            // 選取並開始拖曳
            this.editor.selectElement(element);

            // 如果是互動元件內的元素，不拖曳
            if (e.target.closest('.matching-item') || e.target.closest('.fill-blank-input')) {
                return;
            }

            this.isDragging = true;
            this.activeElement = element;

            this.startX = e.clientX;
            this.startY = e.clientY;
            this.startLeft = parseInt(element.style.left) || 0;
            this.startTop = parseInt(element.style.top) || 0;

            // 鎖定 pointer — 確保 pointerup 不會丟失
            this._pointerId = e.pointerId;
            try { element.setPointerCapture(e.pointerId); } catch (_) { }

            element.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }

    handleMouseMove(e) {
        // ★ 終極保險：如果滑鼠按鈕已放開但 isDragging 仍為 true，強制停止
        if ((this.isDragging || this.isResizing) && e.buttons === 0) {
            this.forceReset();
            return;
        }

        if (this.isDragging && this.activeElement) {
            e.preventDefault();
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;

            let newLeft = this.startLeft + dx;
            let newTop = this.startTop + dy;

            // 邊界限制
            const canvas = this.canvasContentEl;
            const maxLeft = canvas.offsetWidth - this.activeElement.offsetWidth;
            const maxTop = canvas.offsetHeight - this.activeElement.offsetHeight;

            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));

            // ── 對齊輔助線 ──
            const SNAP = 5;
            const elW = this.activeElement.offsetWidth;
            const elH = this.activeElement.offsetHeight;
            const elCX = newLeft + elW / 2;
            const elCY = newTop + elH / 2;
            const canvasW = canvas.offsetWidth;
            const canvasH = canvas.offsetHeight;

            // 移除舊輔助線
            canvas.querySelectorAll('.snap-guide').forEach(g => g.remove());

            const guides = [];

            // 畫布中心吸附
            if (Math.abs(elCX - canvasW / 2) < SNAP) {
                newLeft = canvasW / 2 - elW / 2;
                guides.push({ type: 'v', pos: canvasW / 2 });
            }
            if (Math.abs(elCY - canvasH / 2) < SNAP) {
                newTop = canvasH / 2 - elH / 2;
                guides.push({ type: 'h', pos: canvasH / 2 });
            }

            // 其他元素吸附
            const siblings = canvas.querySelectorAll('.slide-element');
            siblings.forEach(sib => {
                if (sib === this.activeElement) return;
                const sL = sib.offsetLeft, sT = sib.offsetTop;
                const sW = sib.offsetWidth, sH = sib.offsetHeight;
                const sCX = sL + sW / 2, sCY = sT + sH / 2;

                // 垂直對齊（左、中、右）
                if (Math.abs(newLeft - sL) < SNAP) { newLeft = sL; guides.push({ type: 'v', pos: sL }); }
                else if (Math.abs(elCX - sCX) < SNAP) { newLeft = sCX - elW / 2; guides.push({ type: 'v', pos: sCX }); }
                else if (Math.abs(newLeft + elW - (sL + sW)) < SNAP) { newLeft = sL + sW - elW; guides.push({ type: 'v', pos: sL + sW }); }

                // 水平對齊（上、中、下）
                if (Math.abs(newTop - sT) < SNAP) { newTop = sT; guides.push({ type: 'h', pos: sT }); }
                else if (Math.abs(elCY - sCY) < SNAP) { newTop = sCY - elH / 2; guides.push({ type: 'h', pos: sCY }); }
                else if (Math.abs(newTop + elH - (sT + sH)) < SNAP) { newTop = sT + sH - elH; guides.push({ type: 'h', pos: sT + sH }); }
            });

            // 繪製輔助線
            guides.forEach(g => {
                const line = document.createElement('div');
                line.className = 'snap-guide';
                if (g.type === 'v') {
                    line.style.cssText = `position:absolute;left:${g.pos}px;top:0;width:1px;height:100%;background:#f43f5e;z-index:9999;pointer-events:none;opacity:0.6;`;
                } else {
                    line.style.cssText = `position:absolute;top:${g.pos}px;left:0;height:1px;width:100%;background:#f43f5e;z-index:9999;pointer-events:none;opacity:0.6;`;
                }
                canvas.appendChild(line);
            });

            this.activeElement.style.left = `${newLeft}px`;
            this.activeElement.style.top = `${newTop}px`;
        }

        if (this.isResizing && this.activeElement) {
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;

            let newWidth = this.startWidth;
            let newHeight = this.startHeight;
            let newLeft = this.startLeft;
            let newTop = this.startTop;

            const handle = this.activeHandle;

            // 根據 handle 位置計算新尺寸
            if (handle.includes('e')) {
                newWidth = Math.max(50, this.startWidth + dx);
            }
            if (handle.includes('w')) {
                newWidth = Math.max(50, this.startWidth - dx);
                newLeft = this.startLeft + (this.startWidth - newWidth);
            }
            if (handle.includes('s')) {
                newHeight = Math.max(30, this.startHeight + dy);
            }
            if (handle.includes('n')) {
                newHeight = Math.max(30, this.startHeight - dy);
                newTop = this.startTop + (this.startHeight - newHeight);
            }

            this.activeElement.style.width = `${newWidth}px`;
            this.activeElement.style.height = `${newHeight}px`;
            this.activeElement.style.left = `${newLeft}px`;
            this.activeElement.style.top = `${newTop}px`;
        }
    }

    handleMouseUp(e) {
        if (this.isDragging && this.activeElement) {
            this.activeElement.style.cursor = 'move';

            // 更新資料
            const id = this.activeElement.dataset.id;
            this.slideManager.updateElement(id, {
                x: parseInt(this.activeElement.style.left),
                y: parseInt(this.activeElement.style.top)
            });

            // 更新屬性面板
            const propX = document.getElementById('propX');
            const propY = document.getElementById('propY');
            if (propX) propX.value = parseInt(this.activeElement.style.left);
            if (propY) propY.value = parseInt(this.activeElement.style.top);
        }

        if (this.isResizing && this.activeElement) {
            const id = this.activeElement.dataset.id;
            this.slideManager.updateElement(id, {
                x: parseInt(this.activeElement.style.left),
                y: parseInt(this.activeElement.style.top),
                width: this.activeElement.offsetWidth,
                height: this.activeElement.offsetHeight
            });

            // 更新屬性面板
            const propX = document.getElementById('propX');
            const propY = document.getElementById('propY');
            const propW = document.getElementById('propW');
            const propH = document.getElementById('propH');
            if (propX) propX.value = parseInt(this.activeElement.style.left);
            if (propY) propY.value = parseInt(this.activeElement.style.top);
            if (propW) propW.value = this.activeElement.offsetWidth;
            if (propH) propH.value = this.activeElement.offsetHeight;
        }

        this.isDragging = false;
        this.isResizing = false;
        this.activeElement = null;
        this.activeHandle = null;

        // 清除對齊輔助線
        document.querySelectorAll('.snap-guide').forEach(g => g.remove());
    }

    handleDoubleClick(e) {
        const element = e.target.closest('.editable-element');
        if (!element) return;

        const type = element.dataset.type;

        if (type === 'text') {
            // 啟用文字編輯
            element.contentEditable = 'true';
            element.classList.add('editing');
            element.focus();

            // 選取全部文字
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);

            // 失去焦點時儲存
            const saveContent = () => {
                element.contentEditable = 'false';
                element.classList.remove('editing');

                const id = element.dataset.id;
                this.slideManager.updateElement(id, { content: element.innerHTML });

                element.removeEventListener('blur', saveContent);
            };

            element.addEventListener('blur', saveContent);
        }
    }

    handleKeyDown(e) {
        // Delete 或 Backspace 刪除選中元素
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.editor.selectedElement) {
            // 確保不是在編輯文字
            if (document.activeElement.contentEditable !== 'true' &&
                !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                this.editor.deleteSelected();
            }
        }

        // 方向鍵移動元素
        if (this.editor.selectedElement && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            if (document.activeElement.contentEditable !== 'true') {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                const element = this.editor.selectedElement;
                let x = parseInt(element.style.left) || 0;
                let y = parseInt(element.style.top) || 0;

                switch (e.key) {
                    case 'ArrowUp': y -= step; break;
                    case 'ArrowDown': y += step; break;
                    case 'ArrowLeft': x -= step; break;
                    case 'ArrowRight': x += step; break;
                }

                element.style.left = `${x}px`;
                element.style.top = `${y}px`;

                const id = element.dataset.id;
                this.slideManager.updateElement(id, { x, y });
            }
        }
    }
}
