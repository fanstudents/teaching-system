/**
 * PPTX Importer — 原生解析 .pptx 檔案
 * 從 XML 中提取文字、圖片、形狀，轉成 960×540 畫布元素
 */

export class PptxImporter {
    constructor() {
        this.CANVAS_W = 960;
        this.CANVAS_H = 540;
        // PPTX 標準尺寸（EMU）: 10" × 7.5" @ 914400 EMU/inch
        this.DEFAULT_CX = 12192000;
        this.DEFAULT_CY = 6858000;
    }

    /**
     * 匯入 .pptx 檔案，回傳 slides 陣列
     * @param {File} file
     * @param {Function} onProgress - (current, total, msg)
     * @returns {Promise<Array<{id: string, elements: Array, background: string}>>}
     */
    async import(file, onProgress) {
        onProgress?.(0, 1, '解壓縮 PPTX...');
        const zip = await JSZip.loadAsync(file);

        // 讀取簡報尺寸
        const presMeta = await this._parsePresentationSize(zip);
        this.slideW = presMeta.cx || this.DEFAULT_CX;
        this.slideH = presMeta.cy || this.DEFAULT_CY;

        // 讀取媒體檔案（圖片）
        const mediaMap = await this._extractMedia(zip);

        // 讀取 slide layouts / masters 的背景（可選）
        // 先取得投影片列表
        const slideEntries = this._getSlideEntries(zip);
        const total = slideEntries.length;
        const slides = [];

        for (let i = 0; i < total; i++) {
            onProgress?.(i, total, `解析投影片 ${i + 1}/${total}...`);
            const slideXml = await zip.file(slideEntries[i]).async('text');
            const rels = await this._loadRels(zip, slideEntries[i]);
            const slide = this._parseSlide(slideXml, rels, mediaMap, i);
            slides.push(slide);
        }

        onProgress?.(total, total, '匯入完成');
        return slides;
    }

    // ── 取得簡報尺寸 ──
    async _parsePresentationSize(zip) {
        try {
            const xml = await zip.file('ppt/presentation.xml')?.async('text');
            if (!xml) return {};
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const sldSz = doc.querySelector('sldSz');
            if (!sldSz) return {};
            return {
                cx: parseInt(sldSz.getAttribute('cx')) || this.DEFAULT_CX,
                cy: parseInt(sldSz.getAttribute('cy')) || this.DEFAULT_CY,
            };
        } catch { return {}; }
    }

    // ── 取得排序後的投影片路徑 ──
    _getSlideEntries(zip) {
        const entries = [];
        zip.forEach((path) => {
            if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
                entries.push(path);
            }
        });
        return entries.sort((a, b) => {
            const na = parseInt(a.match(/slide(\d+)/)[1]);
            const nb = parseInt(b.match(/slide(\d+)/)[1]);
            return na - nb;
        });
    }

    // ── 提取所有媒體檔案為 data URI ──
    async _extractMedia(zip) {
        const map = new Map(); // filename → dataURI
        const mediaFolder = zip.folder('ppt/media');
        if (!mediaFolder) return map;

        const promises = [];
        zip.forEach((path, entry) => {
            if (path.startsWith('ppt/media/') && !entry.dir) {
                const filename = path.split('/').pop();
                const ext = filename.split('.').pop().toLowerCase();
                const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', emf: 'image/emf', wmf: 'image/wmf', tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp' }[ext] || 'image/png';

                promises.push(
                    entry.async('base64').then(b64 => {
                        map.set(filename, `data:${mime};base64,${b64}`);
                    })
                );
            }
        });
        await Promise.all(promises);
        return map;
    }

    // ── 載入投影片的 .rels（圖片引用映射）──
    async _loadRels(zip, slidePath) {
        // ppt/slides/slide1.xml → ppt/slides/_rels/slide1.xml.rels
        const relsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
        const map = new Map(); // rId → target filename
        try {
            const xml = await zip.file(relsPath)?.async('text');
            if (!xml) return map;
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            doc.querySelectorAll('Relationship').forEach(rel => {
                const id = rel.getAttribute('Id');
                const target = rel.getAttribute('Target') || '';
                // Target 可能是 ../media/image1.png
                const filename = target.split('/').pop();
                map.set(id, filename);
            });
        } catch { }
        return map;
    }

    // ── EMU 轉畫布座標 ──
    _emuToX(emu) { return Math.round((emu / this.slideW) * this.CANVAS_W); }
    _emuToY(emu) { return Math.round((emu / this.slideH) * this.CANVAS_H); }
    _emuToW(emu) { return Math.round((emu / this.slideW) * this.CANVAS_W); }
    _emuToH(emu) { return Math.round((emu / this.slideH) * this.CANVAS_H); }
    // EMU → pt（字型大小）: 1 pt = 12700 EMU
    _emuToPt(emu) { return Math.round(emu / 12700); }

    // ── 解析單張投影片 ──
    _parseSlide(xmlStr, rels, mediaMap, idx) {
        const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
        const elements = [];
        const genId = () => Math.random().toString(36).slice(2, 10);

        // 解析背景
        let background = '#ffffff';
        const bgFill = doc.querySelector('bg > bgPr > solidFill > srgbClr');
        if (bgFill) {
            background = '#' + bgFill.getAttribute('val');
        }
        const bgGrad = doc.querySelector('bg > bgPr > gradFill');
        if (bgGrad) {
            const stops = bgGrad.querySelectorAll('gs');
            if (stops.length >= 2) {
                const colors = [];
                stops.forEach(gs => {
                    const clr = gs.querySelector('srgbClr');
                    if (clr) colors.push('#' + clr.getAttribute('val'));
                });
                if (colors.length >= 2) {
                    background = `linear-gradient(135deg, ${colors.join(', ')})`;
                }
            }
        }

        // 解析所有 shape tree 下的元素
        const spTree = doc.querySelector('spTree');
        if (!spTree) return { id: genId(), elements, background };

        // 取得所有 sp (shape), pic (picture), grpSp (group)
        for (const node of spTree.children) {
            const tag = node.localName;
            try {
                if (tag === 'sp') {
                    const el = this._parseShape(node, genId);
                    if (el) elements.push(el);
                } else if (tag === 'pic') {
                    const el = this._parsePicture(node, rels, mediaMap, genId);
                    if (el) elements.push(el);
                } else if (tag === 'grpSp') {
                    // 遞迴解析 group 內的元素
                    const groupEls = this._parseGroup(node, rels, mediaMap, genId);
                    elements.push(...groupEls);
                }
            } catch (e) {
                console.warn(`[PptxImporter] Skip element:`, e.message);
            }
        }

        return { id: genId(), elements, background };
    }

    // ── 解析形狀 (sp) — 可能是文字方塊或純形狀 ──
    _parseShape(node, genId) {
        const pos = this._getPosition(node);
        if (!pos) return null;

        // 取得文字內容
        const txBody = node.querySelector('txBody');
        const hasText = txBody && txBody.querySelector('r');

        if (hasText) {
            return this._parseTextBox(node, txBody, pos, genId);
        }

        // 純形狀
        const fill = this._getFillColor(node);
        const border = this._getStroke(node);
        if (!fill && !border) return null; // 無填色也無邊框 → 隱形，略過

        // 依 prstGeom 還原幾何：橢圓→圓形、圓角矩形→帶圓角，其餘→矩形
        const geo = this._getGeometry(node, pos);

        const el = {
            id: genId(),
            type: 'shape',
            shapeType: geo.shapeType,
            x: pos.x,
            y: pos.y,
            width: pos.w,
            height: pos.h,
            background: fill || 'transparent', // 只有邊框的外框（如手機外框、紅色標示框）
            borderRadius: geo.borderRadius,
        };
        if (border) el.border = border;
        return el;
    }

    // ── 取得外框線（僅描邊、無填色的形狀也要保留）──
    _getStroke(node) {
        const ln = node.querySelector('spPr > ln');
        if (!ln) return null;
        if (ln.querySelector('noFill')) return null; // 明確設定無線條

        let color = null;
        const srgb = ln.querySelector('solidFill > srgbClr');
        if (srgb) {
            color = '#' + srgb.getAttribute('val');
        } else {
            const scheme = ln.querySelector('solidFill > schemeClr');
            if (scheme) {
                const map = {
                    dk1: '#1a1a2e', dk2: '#44546a', lt1: '#ffffff', lt2: '#e7e6e6',
                    accent1: '#4472c4', accent2: '#ed7d31', accent3: '#a5a5a5',
                    accent4: '#ffc000', accent5: '#5b9bd5', accent6: '#70ad47',
                    tx1: '#1a1a2e', tx2: '#44546a', bg1: '#ffffff', bg2: '#e7e6e6',
                };
                color = map[scheme.getAttribute('val')] || null;
            }
        }
        if (!color) return null;

        const w = parseInt(ln.getAttribute('w')) || 12700; // EMU，預設 1pt
        const px = Math.max(1, Math.round(w / 9525));       // EMU → px
        return `${px}px solid ${color}`;
    }

    // ── 依 prstGeom 判斷形狀類型與圓角 ──
    _getGeometry(node, pos) {
        const geom = node.querySelector('prstGeom');
        const prst = geom?.getAttribute('prst') || 'rect';

        if (prst === 'ellipse') {
            return { shapeType: 'circle', borderRadius: 0 };
        }

        if (prst === 'roundRect') {
            // PowerPoint 圓角比例：adj/100000 × 短邊（預設 adj=16667）
            let adj = 16667;
            if (geom) {
                for (const gd of geom.querySelectorAll('gd')) {
                    if (gd.getAttribute('name') === 'adj') {
                        const m = (gd.getAttribute('fmla') || '').match(/val\s+(-?\d+)/);
                        if (m) adj = parseInt(m[1]);
                        break;
                    }
                }
            }
            const short = Math.min(pos.w, pos.h);
            const r = Math.round(short * (adj / 100000));
            return { shapeType: 'rectangle', borderRadius: Math.min(r, Math.floor(short / 2)) };
        }

        return { shapeType: 'rectangle', borderRadius: 0 };
    }

    // ── 解析文字方塊 ──
    _parseTextBox(node, txBody, pos, genId) {
        const paragraphs = txBody.querySelectorAll('p');
        let htmlContent = '';
        let maxFontSize = 18;

        for (const p of paragraphs) {
            const runs = p.querySelectorAll('r');
            if (runs.length === 0) {
                htmlContent += '<br>';
                continue;
            }

            let pHtml = '';
            for (const r of runs) {
                const text = r.querySelector('t')?.textContent || '';
                if (!text) continue;

                const rPr = r.querySelector('rPr');
                const styles = this._getRunStyles(rPr);
                if (styles.fontSize > maxFontSize) maxFontSize = styles.fontSize;

                let span = this._escHtml(text);
                if (styles.bold) span = `<b>${span}</b>`;
                if (styles.italic) span = `<i>${span}</i>`;

                const inlineStyles = [];
                if (styles.fontSize) inlineStyles.push(`font-size:${styles.fontSize}px`);
                if (styles.color) inlineStyles.push(`color:${styles.color}`);
                if (styles.fontFamily) inlineStyles.push(`font-family:${styles.fontFamily}`);

                if (inlineStyles.length > 0) {
                    span = `<span style="${inlineStyles.join(';')}">${span}</span>`;
                }
                pHtml += span;
            }

            // 段落對齊
            const pPr = p.querySelector('pPr');
            const algn = pPr?.getAttribute('algn') || '';
            const align = { ctr: 'center', r: 'right', just: 'justify' }[algn] || '';
            if (align) {
                pHtml = `<div style="text-align:${align}">${pHtml}</div>`;
            } else {
                pHtml = `<div>${pHtml}</div>`;
            }
            htmlContent += pHtml;
        }

        if (!htmlContent.replace(/<[^>]*>/g, '').trim()) return null;

        return {
            id: genId(),
            type: 'text',
            x: pos.x,
            y: pos.y,
            width: pos.w,
            height: pos.h,
            content: htmlContent,
            fontSize: maxFontSize,
        };
    }

    // ── 解析圖片 (pic) ──
    _parsePicture(node, rels, mediaMap, genId) {
        const pos = this._getPosition(node);
        if (!pos) return null;

        // 找到 blipFill > blip 的 r:embed
        const blip = node.querySelector('blipFill blip');
        if (!blip) return null;

        const rEmbed = blip.getAttribute('r:embed') || blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
        if (!rEmbed) return null;

        const filename = rels.get(rEmbed);
        if (!filename) return null;

        const src = mediaMap.get(filename);
        if (!src) return null;

        return {
            id: genId(),
            type: 'image',
            src,
            x: pos.x,
            y: pos.y,
            width: pos.w,
            height: pos.h,
        };
    }

    // ── 解析 group ──
    _parseGroup(grpNode, rels, mediaMap, genId) {
        const elements = [];
        // Group 有自己的 offset，需要加上
        const grpOff = grpNode.querySelector(':scope > grpSpPr > xfrm > off');
        const grpChOff = grpNode.querySelector(':scope > grpSpPr > xfrm > chOff');
        const grpExt = grpNode.querySelector(':scope > grpSpPr > xfrm > ext');
        const grpChExt = grpNode.querySelector(':scope > grpSpPr > xfrm > chExt');

        // 計算縮放比例
        let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;
        if (grpOff && grpChOff && grpExt && grpChExt) {
            const gx = parseInt(grpOff.getAttribute('x')) || 0;
            const gy = parseInt(grpOff.getAttribute('y')) || 0;
            const cx = parseInt(grpChOff.getAttribute('x')) || 0;
            const cy = parseInt(grpChOff.getAttribute('y')) || 0;
            const gw = parseInt(grpExt.getAttribute('cx')) || 1;
            const gh = parseInt(grpExt.getAttribute('cy')) || 1;
            const cw = parseInt(grpChExt.getAttribute('cx')) || 1;
            const ch = parseInt(grpChExt.getAttribute('cy')) || 1;
            scaleX = gw / cw;
            scaleY = gh / ch;
            offsetX = gx - cx * scaleX;
            offsetY = gy - cy * scaleY;
        }

        for (const child of grpNode.children) {
            const tag = child.localName;
            let el = null;
            if (tag === 'sp') {
                el = this._parseShape(child, genId);
            } else if (tag === 'pic') {
                el = this._parsePicture(child, rels, mediaMap, genId);
            } else if (tag === 'grpSp') {
                elements.push(...this._parseGroup(child, rels, mediaMap, genId));
                continue;
            }
            if (el) {
                // 套用 group 偏移和縮放
                el.x = this._emuToX(offsetX) + Math.round(el.x * scaleX);
                el.y = this._emuToY(offsetY) + Math.round(el.y * scaleY);
                el.width = Math.round(el.width * scaleX);
                el.height = Math.round(el.height * scaleY);
                elements.push(el);
            }
        }
        return elements;
    }

    // ── 共用：取得位置 ──
    _getPosition(node) {
        // 先找 spPr > xfrm，再找 grpSpPr > xfrm
        const xfrm = node.querySelector(':scope > spPr > xfrm')
            || node.querySelector(':scope > nvSpPr > spPr > xfrm')
            || node.querySelector(':scope > nvPicPr')?.parentNode?.querySelector('spPr > xfrm');

        if (!xfrm) {
            // fallback: 直接找 off 和 ext
            const off = node.querySelector('spPr off') || node.querySelector('off');
            const ext = node.querySelector('spPr ext') || node.querySelector('ext');
            if (!off || !ext) return null;
            return {
                x: this._emuToX(parseInt(off.getAttribute('x')) || 0),
                y: this._emuToY(parseInt(off.getAttribute('y')) || 0),
                w: this._emuToW(parseInt(ext.getAttribute('cx')) || 100),
                h: this._emuToH(parseInt(ext.getAttribute('cy')) || 100),
            };
        }

        const off = xfrm.querySelector('off');
        const ext = xfrm.querySelector('ext');
        if (!off || !ext) return null;

        return {
            x: this._emuToX(parseInt(off.getAttribute('x')) || 0),
            y: this._emuToY(parseInt(off.getAttribute('y')) || 0),
            w: this._emuToW(parseInt(ext.getAttribute('cx')) || 100),
            h: this._emuToH(parseInt(ext.getAttribute('cy')) || 100),
        };
    }

    // ── 取得填充顏色 ──
    _getFillColor(node) {
        const solid = node.querySelector('spPr > solidFill > srgbClr');
        if (solid) return '#' + solid.getAttribute('val');

        const schemeClr = node.querySelector('spPr > solidFill > schemeClr');
        if (schemeClr) {
            // scheme color 映射（常見的）
            const map = {
                dk1: '#1a1a2e', dk2: '#44546a', lt1: '#ffffff', lt2: '#e7e6e6',
                accent1: '#4472c4', accent2: '#ed7d31', accent3: '#a5a5a5',
                accent4: '#ffc000', accent5: '#5b9bd5', accent6: '#70ad47',
                tx1: '#1a1a2e', tx2: '#44546a', bg1: '#ffffff', bg2: '#e7e6e6',
            };
            const val = schemeClr.getAttribute('val');
            return map[val] || null;
        }
        return null;
    }

    // ── 取得文字 run 的樣式 ──
    _getRunStyles(rPr) {
        const styles = { bold: false, italic: false, fontSize: 18, color: '', fontFamily: '' };
        if (!rPr) return styles;

        if (rPr.getAttribute('b') === '1') styles.bold = true;
        if (rPr.getAttribute('i') === '1') styles.italic = true;

        const sz = rPr.getAttribute('sz');
        if (sz) styles.fontSize = Math.round(parseInt(sz) / 100); // sz 是 hundredths of a point

        const solidFill = rPr.querySelector('solidFill > srgbClr');
        if (solidFill) styles.color = '#' + solidFill.getAttribute('val');

        // scheme color for text
        const schemeClr = rPr.querySelector('solidFill > schemeClr');
        if (schemeClr && !styles.color) {
            const map = { dk1: '#1a1a2e', dk2: '#44546a', lt1: '#ffffff', lt2: '#e7e6e6', tx1: '#1a1a2e', tx2: '#44546a' };
            styles.color = map[schemeClr.getAttribute('val')] || '';
        }

        const latin = rPr.querySelector('latin');
        if (latin) styles.fontFamily = latin.getAttribute('typeface') || '';

        return styles;
    }

    _escHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
