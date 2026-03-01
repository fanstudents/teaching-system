/**
 * 複製卡片模組
 */

export class CardCopy {
    constructor(slideManager) {
        this.slideManager = slideManager;
        this.copiedElements = [];

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Ctrl+C / Cmd+C 複製
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                this.copy();
            }

            // Ctrl+V / Cmd+V 貼上
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                this.paste();
            }
        });
    }

    /**
     * 複製選中的元素
     */
    copy() {
        const selectedElement = document.querySelector('.editable-element.selected');
        if (!selectedElement) {
            this.showToast('請先選取要複製的元素');
            return;
        }

        const elementId = selectedElement.dataset.id;
        const slide = this.slideManager.getCurrentSlide();
        const element = slide.elements.find(el => el.id === elementId);

        if (element) {
            this.copiedElements = [JSON.parse(JSON.stringify(element))];
            this.showToast('已複製元素');
        }
    }

    /**
     * 貼上元素到當前投影片
     */
    paste() {
        if (this.copiedElements.length === 0) {
            this.showToast('剪貼簿是空的');
            return;
        }

        this.copiedElements.forEach(element => {
            const newElement = JSON.parse(JSON.stringify(element));
            newElement.id = this.slideManager.generateId();

            // 偏移位置避免重疊
            newElement.x += 20;
            newElement.y += 20;

            this.slideManager.addElement(newElement);
        });

        this.showToast('已貼上元素');
    }

    /**
     * 複製元素到新投影片
     */
    copyToNewSlide() {
        const selectedElement = document.querySelector('.editable-element.selected');
        if (!selectedElement) {
            this.showToast('請先選取要複製的元素');
            return;
        }

        const elementId = selectedElement.dataset.id;
        const slide = this.slideManager.getCurrentSlide();
        const element = slide.elements.find(el => el.id === elementId);

        if (!element) return;

        // 建立新投影片
        const newSlide = this.slideManager.createSlide(true);

        // 複製元素到新投影片
        const newElement = JSON.parse(JSON.stringify(element));
        newElement.id = this.slideManager.generateId();
        newSlide.elements.push(newElement);

        this.slideManager.renderCurrentSlide();
        this.slideManager.renderThumbnails();
        this.slideManager.save();

        this.showToast('已複製到新投影片');
    }

    /**
     * 複製整張投影片
     */
    duplicateCurrentSlide() {
        const currentIndex = this.slideManager.currentIndex;
        this.slideManager.duplicateSlide(currentIndex);
        this.showToast('已複製投影片');
    }

    /**
     * 顯示提示訊息
     */
    showToast(message) {
        // 移除已存在的 toast
        const existingToast = document.querySelector('.copy-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        // 入場動畫
        setTimeout(() => toast.classList.add('show'), 10);

        // 自動移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}
