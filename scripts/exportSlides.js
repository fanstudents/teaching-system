/**
 * 投影片匯出模組
 * 支援 PDF、PPTX、圖片 ZIP 匯出
 */
export class SlideExporter {

    /**
     * @param {import('./slideManager.js').SlideManager} slideManager
     */
    constructor(slideManager) {
        this.sm = slideManager;
        this.SLIDE_W = 960;
        this.SLIDE_H = 540;
    }

    /* ──────────────────────────────────────
     *  核心：把每張投影片截圖為 canvas
     * ────────────────────────────────────── */

    /**
     * 建立離屏容器、渲染投影片、用 html2canvas 截圖
     * @returns {Promise<HTMLCanvasElement>}
     */
    async _captureSlide(slide) {
        // 建離屏容器
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            position: 'fixed',
            left: '-9999px',
            top: '0',
            width: `${this.SLIDE_W}px`,
            height: `${this.SLIDE_H}px`,
            overflow: 'hidden',
            background: (slide.background && slide.background !== '#ffffff') ? slide.background : '#ffffff',
            fontFamily: "'Noto Sans TC', sans-serif",
            zIndex: '-1',
        });

        const content = document.createElement('div');
        Object.assign(content.style, {
            position: 'relative',
            width: '100%',
            height: '100%',
        });
        wrapper.appendChild(content);

        // 渲染元素
        if (slide.elements && slide.elements.length > 0) {
            for (const element of slide.elements) {
                const el = this.sm.createElementNode(element);
                if (el) {
                    // 移除編輯態的互動樣式
                    el.style.cursor = 'default';
                    el.style.outline = 'none';
                    el.contentEditable = 'false';
                    el.querySelectorAll('.resize-handle').forEach(h => h.remove());
                    content.appendChild(el);
                }
            }
        }

        document.body.appendChild(wrapper);

        // 等圖片載入
        const images = wrapper.querySelectorAll('img');
        if (images.length > 0) {
            await Promise.allSettled(
                Array.from(images).map(img =>
                    img.complete ? Promise.resolve() :
                        new Promise(r => { img.onload = r; img.onerror = r; })
                )
            );
        }

        // 短暫等待渲染
        await new Promise(r => setTimeout(r, 100));

        const canvas = await html2canvas(wrapper, {
            width: this.SLIDE_W,
            height: this.SLIDE_H,
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            logging: false,
        });

        document.body.removeChild(wrapper);
        return canvas;
    }

    /**
     * 解析使用者輸入的範圍字串 (如: "1-5, 8, 11-13")
     * @returns {number[]} 解析後的陣列 (0-indexed)
     */
    parseRange(rangeStr, total) {
        if (!rangeStr) return [];
        const parts = rangeStr.split(',');
        const result = new Set();

        for (let part of parts) {
            part = part.trim();
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let i = start; i <= end; i++) {
                        if (i >= 1 && i <= total) result.add(i - 1);
                    }
                }
            } else {
                const num = parseInt(part, 10);
                if (!isNaN(num) && num >= 1 && num <= total) {
                    result.add(num - 1);
                }
            }
        }

        return Array.from(result).sort((a, b) => a - b);
    }

    /**
     * 逐頁截圖指定的投影片，呼叫 onProgress 回報進度
     * @param {Array} slides - 要匯出的投影片陣列
     * @param {Function} onProgress
     * @returns {Promise<HTMLCanvasElement[]>}
     */
    async _captureSelected(slides, onProgress) {
        this.sm.saveCurrentSlide();
        const total = slides.length;
        const canvases = [];
        for (let i = 0; i < total; i++) {
            onProgress?.(i, total, `正在擷取第 ${i + 1} / ${total} 頁...`);
            const c = await this._captureSlide(slides[i]);
            canvases.push(c);
        }
        onProgress?.(total, total, '擷取完成');
        return canvases;
    }

    _getSafeFilename() {
        const name = this.sm.getCurrentProjectName() || '簡報';
        return name.replace(/[\/\\?%*:|"<>]/g, '-').trim() || '簡報';
    }

    /**
     * 統一下載 Blob — 強制使用 <a> + download 屬性
     */
    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        // 延遲清理，確保瀏覽器取得檔案
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 500);
    }

    /* ──────────────────────────────────────
     *  匯出 PDF
     * ────────────────────────────────────── */

    async exportPDF(slides, onProgress) {
        const canvases = await this._captureSelected(slides, onProgress);
        onProgress?.(canvases.length, canvases.length, '正在生成 PDF...');

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [this.SLIDE_W, this.SLIDE_H],
            hotfixes: ['px_scaling'],
        });

        canvases.forEach((canvas, i) => {
            if (i > 0) pdf.addPage([this.SLIDE_W, this.SLIDE_H], 'landscape');
            const imgData = canvas.toDataURL('image/jpeg', 0.92);
            pdf.addImage(imgData, 'JPEG', 0, 0, this.SLIDE_W, this.SLIDE_H);
        });

        // 用 output('blob') 取得 Blob，再用自訂下載確保檔名正確
        const pdfBlob = pdf.output('blob');
        this._downloadBlob(pdfBlob, `${this._getSafeFilename()}.pdf`);
    }

    /* ──────────────────────────────────────
     *  匯出 PPTX
     * ────────────────────────────────────── */

    async exportPPTX(slides, onProgress) {
        const canvases = await this._captureSelected(slides, onProgress);
        onProgress?.(canvases.length, canvases.length, '正在生成 PPTX...');

        const pptx = new PptxGenJS();
        pptx.defineLayout({ name: 'CUSTOM', width: 10, height: 5.625 }); // 16:9  in inches
        pptx.layout = 'CUSTOM';

        canvases.forEach(canvas => {
            const slide = pptx.addSlide();
            const imgData = canvas.toDataURL('image/png');
            slide.addImage({
                data: imgData,
                x: 0, y: 0,
                w: '100%', h: '100%',
            });
        });

        // 用 write('blob') 取得 Blob，再用自訂下載確保檔名正確
        const pptxBlob = await pptx.write({ outputType: 'blob' });
        this._downloadBlob(pptxBlob, `${this._getSafeFilename()}.pptx`);
    }

    /* ──────────────────────────────────────
     *  匯出圖片 ZIP（可拿去匯入 Google 簡報）
     * ────────────────────────────────────── */

    async exportImages(slides, onProgress) {
        const canvases = await this._captureSelected(slides, onProgress);
        onProgress?.(canvases.length, canvases.length, '正在打包圖片...');

        const zip = new JSZip();
        const folder = zip.folder('slides');

        for (let i = 0; i < canvases.length; i++) {
            const blob = await new Promise(r => canvases[i].toBlob(r, 'image/png'));
            folder.file(`slide_${String(i + 1).padStart(3, '0')}.png`, blob);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        this._downloadBlob(content, `${this._getSafeFilename()}_slides.zip`);
    }
}
