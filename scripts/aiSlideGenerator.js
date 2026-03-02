/**
 * AI 簡報生成器 — 六階段獨立方法
 * Phase 1: generateContent      — 純文字白底投影片
 * Phase 2: generateVisuals      — 生成 SVG 圖表/示意圖
 * Phase 3: insertInteractive    — 每 8-12 頁插入互動元件
 * Phase 4: addAnimations        — 逐步動畫呈現
 * Phase 5: applyDesign          — 佈局風格 + 色系美化
 * Phase 6: generateTeachingNotes — 講師教學大綱備忘錄
 * Extra:   adjustBySurvey       — 課前問卷驅動調整
 */

import { db, ai } from './supabase.js';
import { MASTER_THEMES } from './templates.js';

// ═══════════════════════════════════════
// 佈局風格定義（5 種）
// ═══════════════════════════════════════
export const LAYOUT_STYLES = [
    {
        id: 'classic-center',
        name: '經典居中',
        icon: 'format_align_center',
        desc: '標題置頂居中，內容寬版對齊，底部裝飾線',
        colors: { bg: '#ffffff', bgDark: '#1e293b', accent: '#3b82f6', card: '#f1f5f9' },
        layout: {
            title: { x: 60, y: 28, w: 840, h: 50, align: 'center' },
            accentLine: { x: 420, y: 82, w: 120, h: 3 },
            content: { x: 60, y: 110, w: 840, h: 400 },
            card: { y: 120, gap: 20, cols: 3 },
        }
    },
    {
        id: 'left-sidebar',
        name: '左欄標題',
        icon: 'view_sidebar',
        desc: '標題在左側 30%，內容佔右側 70%，適合圖文並排',
        colors: { bg: '#ffffff', bgDark: '#0f172a', accent: '#7c3aed', card: '#f5f3ff' },
        layout: {
            title: { x: 30, y: 30, w: 250, h: 480, align: 'left', vertical: true },
            accentLine: { x: 300, y: 30, w: 3, h: 480 },
            content: { x: 330, y: 30, w: 600, h: 480 },
            card: { y: 40, gap: 16, cols: 2, offsetX: 330 },
        }
    },
    {
        id: 'bold-header',
        name: '大標題分割',
        icon: 'vertical_split',
        desc: '標題佔上方 40%，內容置底，強烈視覺層次',
        colors: { bg: '#fafafa', bgDark: '#18181b', accent: '#e11d48', card: '#fff1f2' },
        layout: {
            title: { x: 60, y: 60, w: 840, h: 160, align: 'left', fontSize: 38 },
            accentLine: { x: 60, y: 235, w: 80, h: 4 },
            content: { x: 60, y: 260, w: 840, h: 260 },
            card: { y: 270, gap: 20, cols: 3 },
        }
    },
    {
        id: 'magazine',
        name: '雜誌版面',
        icon: 'auto_awesome_mosaic',
        desc: '不對稱佈局，圖文穿插，現代感強',
        colors: { bg: '#ffffff', bgDark: '#1a1a2e', accent: '#f59e0b', card: '#fffbeb' },
        layout: {
            title: { x: 40, y: 30, w: 500, h: 50, align: 'left' },
            accentLine: { x: 40, y: 85, w: 50, h: 3 },
            content: { x: 40, y: 110, w: 500, h: 400 },
            sidebar: { x: 580, y: 30, w: 350, h: 480 },
            card: { y: 120, gap: 16, cols: 2, offsetX: 40 },
        }
    },
    {
        id: 'minimal',
        name: '極簡留白',
        icon: 'crop_free',
        desc: '大量留白，內容集中，乾淨專業',
        colors: { bg: '#ffffff', bgDark: '#111827', accent: '#0d9488', card: '#f0fdfa' },
        layout: {
            title: { x: 120, y: 80, w: 720, h: 50, align: 'left' },
            accentLine: { x: 120, y: 138, w: 40, h: 3 },
            content: { x: 120, y: 170, w: 720, h: 320 },
            card: { y: 180, gap: 24, cols: 2, offsetX: 120 },
        }
    }
];

export class AiSlideGenerator {
    constructor(slideManager) {
        this.slideManager = slideManager;
        this.onProgress = null; // callback: (percent, message) => void
    }

    // ═══════════════════════════════════════
    // Phase 1: 生成純文字白底投影片
    // ═══════════════════════════════════════
    async generateContent({ topic, level, pageCount, outline, pdfText }) {
        // 截斷防超限：大綱限 3000 字，PDF 限 2000 字
        const trimmedOutline = (outline || '').substring(0, 3000);
        const trimmedPdf = pdfText ? pdfText.substring(0, 2000) : '';
        const fullOutline = trimmedPdf
            ? `${trimmedOutline}\n\n【PDF 內容摘要】\n${trimmedPdf}`
            : trimmedOutline;
        const prompts = await this._loadPrompts();

        const BATCH_SIZE = 10;
        const totalBatches = Math.ceil(pageCount / BATCH_SIZE);
        const allPlan = [];

        this._emit(0, `正在分析大綱，規劃 ${pageCount} 頁結構（共 ${totalBatches} 批）...`);

        for (let batch = 0; batch < totalBatches; batch++) {
            const batchStart = batch * BATCH_SIZE + 1;
            const batchEnd = Math.min((batch + 1) * BATCH_SIZE, pageCount);
            const batchCount = batchEnd - batchStart + 1;

            const batchProgress = (batch / totalBatches) * 30;
            this._emit(batchProgress, `規劃第 ${batchStart}-${batchEnd} 頁（第 ${batch + 1}/${totalBatches} 批）...`);

            // 後續批次只帶最近 10 頁的標題摘要（避免上下文過長）
            let contextHint = '';
            if (allPlan.length > 0) {
                const recentTitles = allPlan.slice(-10).map((p, i) => {
                    const realIdx = allPlan.length - 10 + i;
                    return `第${(realIdx < 0 ? allPlan.length + realIdx : realIdx) + 1}頁: ${p.title}`;
                }).join('\n');
                contextHint = `\n\n【最近完成的頁面標題（共已完成 ${allPlan.length} 頁）】\n${recentTitles}\n\n請從第 ${batchStart} 頁繼續，不要重複已有的內容。`;
            }

            const prompt = this._replaceVars(prompts.slide_content, {
                topic, level, pageCount: batchCount, outline: fullOutline
            }) + contextHint;

            const result = await ai.chat([
                { role: 'system', content: '你是專業簡報規劃師。只回傳 JSON 陣列，不加任何其他文字或 markdown 標記。' },
                { role: 'user', content: prompt }
            ], { model: 'claude-sonnet-4-5', temperature: 0.7, maxTokens: 16000 });

            const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
            const batchPlan = JSON.parse(jsonStr);
            if (!Array.isArray(batchPlan)) throw new Error(`第 ${batch + 1} 批 AI 回傳格式不正確`);

            allPlan.push(...batchPlan);
        }

        this._emit(30, `已規劃 ${allPlan.length} 頁，正在生成投影片...`);

        // 轉為純白底投影片
        const gen = () => this.slideManager.generateId();
        const slides = allPlan.map((page, idx) => {
            this._emit(30 + (idx / allPlan.length) * 60, `生成第 ${idx + 1}/${allPlan.length} 頁...`);
            page._index = idx;
            return this._makeWhiteSlide(gen, page);
        });

        this._emit(100, `已生成 ${slides.length} 頁純文案投影片`);
        return slides;
    }

    // 白底純文字投影片（所有類型增加視覺層次）
    _makeWhiteSlide(gen, page) {
        const type = page.slideType || 'content';
        // 裝飾配色輪替 — 依 page index 做變化
        const accents = [
            { bar: '#4f46e5', bg: '#eef2ff', light: '#e0e7ff', dot: '#818cf8' },
            { bar: '#0891b2', bg: '#ecfeff', light: '#cffafe', dot: '#22d3ee' },
            { bar: '#059669', bg: '#ecfdf5', light: '#d1fae5', dot: '#34d399' },
            { bar: '#b45309', bg: '#fffbeb', light: '#fef3c7', dot: '#fbbf24' },
            { bar: '#7c3aed', bg: '#f5f3ff', light: '#ede9fe', dot: '#a78bfa' },
            { bar: '#dc2626', bg: '#fef2f2', light: '#fee2e2', dot: '#f87171' },
        ];
        const c = accents[(page._index || 0) % accents.length];

        if (type === 'cover') {
            return {
                id: gen(), background: '#ffffff',
                elements: [
                    // 左側粗色帶
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 8, height: 540, background: c.bar },
                    // 底部裝飾色塊
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 490, width: 960, height: 50, background: c.bg },
                    // 右上角裝飾圓
                    { id: gen(), type: 'shape', shapeType: 'circle', x: 820, y: 30, width: 100, height: 100, background: c.light, opacity: 0.5 },
                    {
                        id: gen(), type: 'text', x: 80, y: 160, width: 720, height: 80,
                        content: `<b style="font-size:42px;color:#1e293b">${page.title || ''}</b>`, fontSize: 42, bold: true
                    },
                    {
                        id: gen(), type: 'text', x: 80, y: 260, width: 720, height: 50,
                        content: `<span style="font-size:20px;color:#64748b">${page.content || ''}</span>`, fontSize: 20
                    },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 320, width: 100, height: 4, background: c.bar, borderRadius: 2 },
                ]
            };
        }

        if (type === 'section') {
            return {
                id: gen(), background: '#ffffff',
                elements: [
                    // 上方色帶
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 6, background: c.bar },
                    // 裝飾背景區塊
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 100, width: 840, height: 200, background: c.bg, borderRadius: 16 },
                    {
                        id: gen(), type: 'text', x: 80, y: 120, width: 800, height: 30,
                        content: `<span style="font-size:14px;color:${c.bar};letter-spacing:3px;font-weight:600">${page.day || ''}</span>`, fontSize: 14
                    },
                    {
                        id: gen(), type: 'text', x: 80, y: 160, width: 800, height: 80,
                        content: `<b style="font-size:36px;color:#1e293b">${page.title || ''}</b>`, fontSize: 36
                    },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 260, width: 80, height: 4, background: c.bar, borderRadius: 2 },
                ]
            };
        }

        if (type === 'thank-you') {
            return {
                id: gen(), background: '#ffffff',
                elements: [
                    // 中央裝飾卡片
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 180, y: 120, width: 600, height: 300, background: c.bg, borderRadius: 20 },
                    // 頂部裝飾線
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 330, y: 130, width: 300, height: 4, background: c.bar, borderRadius: 2 },
                    {
                        id: gen(), type: 'text', x: 200, y: 180, width: 560, height: 70,
                        content: '<b style="font-size:42px;color:#1e293b;text-align:center;display:block">Thank You</b>', fontSize: 42
                    },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 380, y: 265, width: 200, height: 2, background: '#cbd5e1' },
                    {
                        id: gen(), type: 'text', x: 200, y: 290, width: 560, height: 50,
                        content: `<span style="font-size:18px;color:#64748b;text-align:center;display:block">${page.content || ''}</span>`, fontSize: 18
                    },
                    // 底部色帶
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 500, width: 960, height: 40, background: c.bg },
                ]
            };
        }

        if (type === 'two-column') {
            const [left = '', right = ''] = (page.content || '').split('|||');
            return {
                id: gen(), background: '#ffffff',
                elements: [
                    // 頂部色帶
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 22, width: 5, height: 50, background: c.bar, borderRadius: 2 },
                    {
                        id: gen(), type: 'text', x: 78, y: 25, width: 820, height: 45,
                        content: `<b style="font-size:26px;color:#1e293b">${page.title || ''}</b>`, fontSize: 26
                    },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 425, height: 420, background: c.bg, borderRadius: 16 },
                    {
                        id: gen(), type: 'text', x: 60, y: 100, width: 385, height: 390,
                        content: `<div style="font-size:15px;color:#475569;line-height:2">${left}</div>`, fontSize: 15
                    },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 85, width: 425, height: 420, background: c.light, borderRadius: 16 },
                    {
                        id: gen(), type: 'text', x: 515, y: 100, width: 385, height: 390,
                        content: `<div style="font-size:15px;color:#475569;line-height:2">${right}</div>`, fontSize: 15
                    },
                ]
            };
        }

        if (type === 'three-card') {
            const cards = (page.content || '').split('|||').slice(0, 3);
            const cardColors = [c.bg, c.light, c.bg];
            return {
                id: gen(), background: '#ffffff',
                elements: [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 22, width: 5, height: 50, background: c.bar, borderRadius: 2 },
                    {
                        id: gen(), type: 'text', x: 78, y: 25, width: 820, height: 45,
                        content: `<b style="font-size:26px;color:#1e293b">${page.title || ''}</b>`, fontSize: 26
                    },
                    ...cards.flatMap((cd, i) => [
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 30 + i * 310, y: 85, width: 290, height: 420, background: cardColors[i] || c.bg, borderRadius: 16 },
                        // 卡片頂部色條
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 30 + i * 310, y: 85, width: 290, height: 5, background: c.bar, borderRadius: 16 },
                        {
                            id: gen(), type: 'text', x: 50 + i * 310, y: 105, width: 250, height: 385,
                            content: `<div style="font-size:14px;color:#475569;line-height:2">${cd}</div>`, fontSize: 14
                        }
                    ])
                ]
            };
        }

        if (type === 'comparison') {
            const [left = '', right = ''] = (page.content || '').split('|||');
            return {
                id: gen(), background: '#ffffff',
                elements: [
                    {
                        id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 45,
                        content: `<b style="font-size:26px;color:#1e293b;text-align:center;display:block">${page.title || ''}</b>`, fontSize: 26
                    },
                    // VS 分隔
                    { id: gen(), type: 'shape', shapeType: 'circle', x: 440, y: 260, width: 50, height: 50, background: '#1e293b' },
                    {
                        id: gen(), type: 'text', x: 440, y: 268, width: 50, height: 30,
                        content: '<b style="font-size:14px;color:#fff;text-align:center;display:block">VS</b>', fontSize: 14
                    },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 395, height: 420, background: '#fef2f2', borderRadius: 16 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 395, height: 5, background: '#ef4444', borderRadius: 16 },
                    {
                        id: gen(), type: 'text', x: 60, y: 105, width: 355, height: 385,
                        content: `<div style="font-size:14px;color:#475569;line-height:2.2">${left}</div>`, fontSize: 14
                    },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 85, width: 425, height: 420, background: '#ecfdf5', borderRadius: 16 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 85, width: 425, height: 5, background: '#059669', borderRadius: 16 },
                    {
                        id: gen(), type: 'text', x: 515, y: 105, width: 385, height: 385,
                        content: `<div style="font-size:14px;color:#475569;line-height:2.2">${right}</div>`, fontSize: 14
                    },
                ]
            };
        }

        if (type === 'quote') {
            return {
                id: gen(), background: '#ffffff',
                elements: [
                    // 引用背景卡片
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 80, width: 840, height: 380, background: c.bg, borderRadius: 20 },
                    // 左側裝飾豎條
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 70, y: 100, width: 5, height: 200, background: c.bar, borderRadius: 2 },
                    {
                        id: gen(), type: 'text', x: 90, y: 100, width: 780, height: 60,
                        content: `<span style="font-size:72px;color:${c.light}">\\u275d</span>`, fontSize: 72
                    },
                    {
                        id: gen(), type: 'text', x: 110, y: 160, width: 740, height: 180,
                        content: `<span style="font-size:24px;color:#1e293b;font-style:italic;line-height:1.8">${page.content || ''}</span>`, fontSize: 24
                    },
                    {
                        id: gen(), type: 'text', x: 110, y: 380, width: 740, height: 30,
                        content: `<span style="font-size:16px;color:#94a3b8">\\u2014 ${page.title || ''}</span>`, fontSize: 16
                    },
                ]
            };
        }

        if (type === 'numbered-list') {
            const items = (page.content || '').split('<br>').filter(Boolean);
            const textWidth = page.needsVisual ? 420 : 780;
            const elements = [
                // 左側色帶
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 45, height: 540, background: c.bg },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 22, width: 5, height: 50, background: c.bar, borderRadius: 2 },
                {
                    id: gen(), type: 'text', x: 78, y: 25, width: 820, height: 45,
                    content: `<b style="font-size:26px;color:#1e293b">${page.title || ''}</b>`, fontSize: 26
                },
                ...items.slice(0, 5).flatMap((item, i) => [
                    { id: gen(), type: 'shape', shapeType: 'circle', x: 60, y: 90 + i * 85, width: 40, height: 40, background: c.bar },
                    {
                        id: gen(), type: 'text', x: 60, y: 94 + i * 85, width: 40, height: 32,
                        content: `<b style="font-size:18px;color:#fff;text-align:center;display:block">${i + 1}</b>`, fontSize: 18
                    },
                    {
                        id: gen(), type: 'text', x: 120, y: 94 + i * 85, width: textWidth, height: 40,
                        content: `<span style="font-size:16px;color:#1e293b">${item.trim()}</span>`, fontSize: 16
                    },
                ])
            ];
            // 預留圖表空間
            if (page.needsVisual) {
                elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 520, y: 85, width: 400, height: 420, background: '#f8fafc', borderRadius: 12, border: '2px dashed #cbd5e1', _placeholder: 'visual' });
            }
            return { id: gen(), background: '#ffffff', elements };
        }

        // Default: key-points, practice, dark-content, content
        // 加入左側色帶 + 背景卡片區塊
        const contentWidth = page.needsVisual ? 420 : 840;
        const cardWidth = page.needsVisual ? 450 : 880;
        const elements = [
            // 左側細色帶
            { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 5, height: 540, background: c.bar },
            // 標題左側色塊
            { id: gen(), type: 'shape', shapeType: 'rectangle', x: 45, y: 25, width: 5, height: 50, background: c.bar, borderRadius: 2 },
            {
                id: gen(), type: 'text', x: 62, y: 30, width: 840, height: 50,
                content: `<b style="font-size:28px;color:#1e293b">${page.title || ''}</b>`, fontSize: 28, bold: true
            },
            // 內容背景卡片
            { id: gen(), type: 'shape', shapeType: 'rectangle', x: 45, y: 95, width: cardWidth, height: 420, background: c.bg, borderRadius: 12 },
            {
                id: gen(), type: 'text', x: 62, y: 110, width: contentWidth, height: 390,
                content: `<div style="font-size:17px;color:#475569;line-height:2.2">${page.content || ''}</div>`, fontSize: 17
            },
            // 右下角裝飾圓
            { id: gen(), type: 'shape', shapeType: 'circle', x: 880, y: 470, width: 50, height: 50, background: c.light, opacity: 0.4 },
        ];
        // 預留圖表空間
        if (page.needsVisual) {
            elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 520, y: 95, width: 400, height: 420, background: '#f8fafc', borderRadius: 12, border: '2px dashed #cbd5e1', _placeholder: 'visual' });
        }
        return { id: gen(), background: '#ffffff', elements };
    }

    // ═══════════════════════════════════════
    // Phase 2: 生成 SVG 圖表/示意圖
    // ═══════════════════════════════════════
    async generateVisuals(slides, customPrompt) {
        const prompts = await this._loadPrompts();
        this._emit(0, '正在分析哪些頁面需要視覺化...');

        const BATCH_SIZE = 25;
        const totalBatches = Math.ceil(slides.length / BATCH_SIZE);
        const allVisuals = [];

        for (let batch = 0; batch < totalBatches; batch++) {
            const start = batch * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, slides.length);

            this._emit((batch / totalBatches) * 30, `分析第 ${start + 1}-${end} 頁（第 ${batch + 1}/${totalBatches} 批）...`);

            // 提取該批次的文字摘要
            const summaries = slides.slice(start, end).map((s, i) => {
                const texts = (s.elements || [])
                    .filter(e => e.type === 'text')
                    .map(e => (e.content || '').replace(/<[^>]+>/g, '').trim())
                    .filter(Boolean)
                    .join(' ')
                    .substring(0, 200);
                return `[Slide ${start + i + 1}] ${texts}`;
            }).join('\n');

            const prompt = customPrompt || this._replaceVars(prompts.slide_visual, {
                slideCount: end - start,
                slideSummaries: summaries
            });

            try {
                const result = await ai.chat([
                    { role: 'system', content: '你是專業的資訊視覺化設計師。只回傳 JSON 陣列，不加任何其他文字。' },
                    { role: 'user', content: prompt }
                ], { model: 'claude-sonnet-4-5', temperature: 0.6, maxTokens: 16000 });

                const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
                const batchVisuals = JSON.parse(jsonStr);
                if (Array.isArray(batchVisuals)) {
                    // 修正 slideIndex 為全域索引
                    for (const v of batchVisuals) {
                        v.slideIndex = (v.slideIndex || 0) + start;
                    }
                    allVisuals.push(...batchVisuals);
                }
            } catch (e) {
                console.warn(`第 ${batch + 1} 批視覺化分析失敗:`, e);
            }
        }

        this._emit(40, `AI 建議為 ${allVisuals.length} 頁新增圖表...`);

        const gen = () => this.slideManager.generateId();
        const newSlides = [...slides];

        for (let vi = 0; vi < allVisuals.length; vi++) {
            const v = allVisuals[vi];
            const idx = v.slideIndex;
            if (idx < 0 || idx >= newSlides.length) continue;

            this._emit(40 + (vi / allVisuals.length) * 50, `生成第 ${idx + 1} 頁圖表...`);

            // 用 AI 生成 SVG
            try {
                const svgResult = await ai.chat([
                    {
                        role: 'system', content: `你是頂級的 SVG 資訊圖表設計師，擅長將資料轉為清晰美觀的向量圖形。

══ SVG 規格 ══
1. viewBox="0 0 400 300"（固定尺寸）
2. 只回傳 <svg>...</svg>，不加 <?xml> 或 markdown
3. 字體：font-family="system-ui, -apple-system, sans-serif"
4. 文字大小：標題 16px，標籤 11-13px，數據 12px
5. 可用中文標籤

══ 配色指南 ══
• 主色系：#6366f1(靛藍), #8b5cf6(紫), #0d9488(青), #f59e0b(琥珀), #ef4444(珊瑚)
• 背景：透明（不要加背景矩形）
• 避免過於飽和的原色（純紅/純藍/純綠）
• 使用漸層或半透明增加質感

══ 設計規則 ══
• 節點/方框：圓角 rx="6"
• 連接線/箭頭：使用 stroke-width="2"
• 文字要居中對齊
• 流程圖箭頭要有 marker-end
• 留白充足，不要擠在一起` },
                    {
                        role: 'user', content: `請生成以下圖表的 SVG：

類型：${v.chartType || v.type}
主題：${v.title || v.description}
具體資料：${v.dataPoints || v.content || v.description}

注意：圖表必須包含具體的節點名稱、數據標籤，不能只有佔位符。`
                    }
                ], { model: 'claude-sonnet-4-5', temperature: 0.5, maxTokens: 4000 });

                const svgCode = svgResult.replace(/```[a-z]*\n?|\n?```/g, '').trim();
                if (!svgCode.includes('<svg')) continue;

                // 將 SVG 插入該頁（偵測預留位置）
                const slide = newSlides[idx];
                const placeholderIdx = slide.elements.findIndex(e => e._placeholder === 'visual');
                let svgX = 500, svgY = 120, svgW = 400, svgH = 300;
                if (placeholderIdx >= 0) {
                    const ph = slide.elements[placeholderIdx];
                    svgX = ph.x + 10;
                    svgY = ph.y + 10;
                    svgW = ph.width - 20;
                    svgH = ph.height - 20;
                    slide.elements.splice(placeholderIdx, 1); // 移除 placeholder
                }
                const svgElement = {
                    id: gen(),
                    type: 'svg',
                    x: svgX, y: svgY,
                    width: svgW, height: svgH,
                    svgContent: svgCode,
                    label: v.title || '圖表'
                };
                slide.elements.push(svgElement);
            } catch (e) {
                console.warn(`SVG 生成失敗 (slide ${idx}):`, e);
            }
        }

        this._emit(100, `已為 ${allVisuals.length} 頁新增圖表`);
        return newSlides;
    }

    // ═══════════════════════════════════════
    // Phase 3: 插入互動元件
    // ═══════════════════════════════════════
    async insertInteractive(slides, customPrompt) {
        const prompts = await this._loadPrompts();
        this._emit(0, '正在分析投影片內容...');

        // 提取每頁的文字摘要
        const summaries = slides.map((s, i) => {
            const texts = (s.elements || [])
                .filter(e => e.type === 'text')
                .map(e => e.content?.replace(/<[^>]+>/g, '') || '')
                .join(' ')
                .substring(0, 100);
            return `第${i + 1}頁: ${texts}`;
        }).join('\n');

        this._emit(20, '正在分析適合插入互動元件的位置...');
        const prompt = customPrompt || this._replaceVars(prompts.slide_interactive, {
            slideCount: slides.length,
            slideSummaries: summaries
        });

        const result = await ai.chat([
            { role: 'system', content: '你是教學互動設計專家。只回傳 JSON 陣列，不加任何其他文字或 markdown。' },
            { role: 'user', content: prompt }
        ], { model: 'claude-haiku-4-5', temperature: 0.6, maxTokens: 6000 });

        const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
        const insertions = JSON.parse(jsonStr);
        if (!Array.isArray(insertions)) throw new Error('AI 回傳格式不正確');

        this._emit(60, `AI 建議插入 ${insertions.length} 個互動元件...`);

        // 從後往前插入（避免 index 位移）
        const gen = () => this.slideManager.generateId();
        const sorted = insertions.sort((a, b) => (b.afterSlide || 0) - (a.afterSlide || 0));

        for (const ins of sorted) {
            const idx = Math.min(ins.afterSlide || 0, slides.length);
            let newSlide;

            switch (ins.type) {
                case 'quiz': newSlide = this._buildQuiz(gen, ins); break;
                case 'poll': newSlide = this._buildPoll(gen, ins); break;
                case 'ordering': newSlide = this._buildOrdering(gen, ins); break;
                case 'matching': newSlide = this._buildMatching(gen, ins); break;
                case 'fillblank': newSlide = this._buildFillBlank(gen, ins); break;
                case 'truefalse': newSlide = this._buildTrueFalse(gen, ins); break;
                case 'opentext': newSlide = this._buildOpenText(gen, ins); break;
                case 'scale': newSlide = this._buildScale(gen, ins); break;
                case 'buzzer': newSlide = this._buildBuzzer(gen, ins); break;
                case 'wordcloud': newSlide = this._buildWordcloud(gen, ins); break;
                default: newSlide = this._buildQuiz(gen, ins);
            }

            slides.splice(idx, 0, newSlide);
        }

        this._emit(100, `已插入 ${insertions.length} 個互動元件`);
        return slides;
    }

    _buildQuiz(gen, ins) {
        let options = ins.options || ['選項 A', '選項 B', '選項 C', '選項 D'];
        const correctIdx = ins.correctIndex ?? 0;
        if (typeof options[0] === 'string') {
            options = options.map((text, i) => ({ text, correct: i === correctIdx }));
        }
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'quiz', x: 50, y: 30, width: 860, height: 460,
                question: ins.question || ins.title || '問題', options
            }]
        };
    }

    _buildPoll(gen, ins) {
        let options = ins.options || ['選項 A', '選項 B', '選項 C'];
        if (typeof options[0] === 'string') options = options.map(text => ({ text }));
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'poll', x: 50, y: 30, width: 860, height: 460,
                question: ins.question || ins.title || '投票', options
            }]
        };
    }

    _buildOrdering(gen, ins) {
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'ordering', x: 50, y: 30, width: 860, height: 460,
                steps: ins.steps || ['步驟 1', '步驟 2', '步驟 3', '步驟 4']
            }]
        };
    }

    _buildMatching(gen, ins) {
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'matching', x: 50, y: 30, width: 860, height: 460,
                pairs: ins.pairs || [{ left: 'A', right: '1' }, { left: 'B', right: '2' }]
            }]
        };
    }

    _buildFillBlank(gen, ins) {
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'fillblank', x: 50, y: 30, width: 860, height: 460,
                title: ins.title || '填空題',
                content: ins.content || '',
                blanks: ins.blanks || [{ answer: '' }]
            }]
        };
    }

    _buildTrueFalse(gen, ins) {
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'truefalse', x: 50, y: 30, width: 860, height: 460,
                question: ins.question || '是非題',
                answer: ins.answer ?? true
            }]
        };
    }

    _buildOpenText(gen, ins) {
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'opentext', x: 50, y: 30, width: 860, height: 460,
                question: ins.question || '開放問答',
                placeholder: ins.placeholder || '請輸入你的回答...',
                maxLength: ins.maxLength || 500
            }]
        };
    }

    _buildScale(gen, ins) {
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'scale', x: 50, y: 30, width: 860, height: 460,
                question: ins.question || '評分',
                min: ins.min || 1, max: ins.max || 10, step: 1,
                labelLeft: ins.labelLeft || '不同意', labelRight: ins.labelRight || '非常同意'
            }]
        };
    }

    _buildBuzzer(gen, ins) {
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'buzzer', x: 50, y: 30, width: 860, height: 460,
                question: ins.question || '搶答題'
            }]
        };
    }

    _buildWordcloud(gen, ins) {
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'wordcloud', x: 50, y: 30, width: 860, height: 460,
                question: ins.question || '文字雲',
                maxWords: ins.maxWords || 3
            }]
        };
    }

    // ═══════════════════════════════════════
    // Phase 4: 動畫呈現（逐步顯示）
    // ═══════════════════════════════════════
    async addAnimations(slides) {
        this._emit(0, '正在分析投影片結構...');

        const result = slides.map((slide, idx) => {
            this._emit((idx / slides.length) * 100, `分析第 ${idx + 1}/${slides.length} 頁...`);
            return this._assignAnimOrder(slide);
        });

        this._emit(100, '動畫設定完成');
        return result;
    }

    _assignAnimOrder(slide) {
        const newSlide = JSON.parse(JSON.stringify(slide));
        const elements = newSlide.elements || [];

        // 跳過互動元件頁面
        const hasInteractive = elements.some(e =>
            ['quiz', 'poll', 'ordering', 'matching', 'wordcloud', 'hotspot', 'truefalse', 'opentext', 'scale', 'buzzer', 'fillblank'].includes(e.type)
        );
        if (hasInteractive) return newSlide;

        // 找出各類元素
        const titleEls = elements.filter(e => e.type === 'text' && e.fontSize >= 26);
        const subtitleEls = elements.filter(e => e.type === 'text' && e.fontSize >= 18 && e.fontSize < 26 && e.height < 100);
        const contentEls = elements.filter(e => e.type === 'text' && e.fontSize < 18 && e.height > 80);
        const mediumTextEls = elements.filter(e => e.type === 'text' && e.fontSize >= 13 && e.fontSize < 26 && e.height >= 40 && e.height <= 100);
        const shapes = elements.filter(e => e.type === 'shape');
        const images = elements.filter(e => e.type === 'image');

        // 判斷版面類型
        const isListPage = elements.some(e =>
            e.type === 'text' && e.content && (e.content.includes('<br>') || e.content.includes('•'))
        );
        const cardCount = shapes.filter(s =>
            s.shapeType === 'rectangle' && s.borderRadius && s.height > 100 && s.width < 500
        ).length;
        const isCardPage = cardCount >= 2;
        const isColumnPage = shapes.filter(s =>
            s.shapeType === 'rectangle' && s.width > 300 && s.height > 300
        ).length >= 2;
        const isTimelinePage = shapes.some(s =>
            s.shapeType === 'circle' && s.width <= 30
        ) && shapes.filter(s => s.shapeType === 'circle').length >= 3;

        // 封面/章節頁：標題不加動畫
        if (titleEls.length > 0 && elements.length <= 5 && !isListPage && !isCardPage) {
            // 簡單的封面/章節頁，不加動畫
            return newSlide;
        }

        let step = 0;

        // 卡片頁：每張卡片是一步
        if (isCardPage) {
            const cardShapes = shapes
                .filter(s => s.shapeType === 'rectangle' && s.borderRadius && s.height > 100 && s.width < 500)
                .sort((a, b) => a.x - b.x);

            for (const card of cardShapes) {
                step++;
                // 卡片本身
                const cardIdx = elements.indexOf(card);
                if (cardIdx >= 0) newSlide.elements[cardIdx].animOrder = step;
                // 卡片上的文字（位置重疊的）
                elements.forEach((e, i) => {
                    if (e.type === 'text' && e.x >= card.x - 20 && e.x <= card.x + card.width && e.y >= card.y) {
                        newSlide.elements[i].animOrder = step;
                    }
                });
            }
            return newSlide;
        }

        // 時間軸頁：每個節點是一步
        if (isTimelinePage) {
            const circles = elements
                .filter(e => e.type === 'shape' && e.shapeType === 'circle' && e.width <= 30)
                .sort((a, b) => a.y - b.y);

            for (const circle of circles) {
                step++;
                const ci = elements.indexOf(circle);
                if (ci >= 0) newSlide.elements[ci].animOrder = step;
                // 對應的文字（y 座標接近的）
                elements.forEach((e, i) => {
                    if (e.type === 'text' && Math.abs(e.y - circle.y) < 20 && e.x > circle.x) {
                        newSlide.elements[i].animOrder = step;
                    }
                });
            }
            return newSlide;
        }

        // 左右欄頁：左右各一步
        if (isColumnPage) {
            const colShapes = shapes
                .filter(s => s.shapeType === 'rectangle' && s.width > 300 && s.height > 300)
                .sort((a, b) => a.x - b.x);

            for (const col of colShapes) {
                step++;
                const ci = elements.indexOf(col);
                if (ci >= 0) newSlide.elements[ci].animOrder = step;
                elements.forEach((e, i) => {
                    if (e.type === 'text' && e.x >= col.x && e.x < col.x + col.width + 40) {
                        if (e.fontSize < 26) newSlide.elements[i].animOrder = step;
                    }
                });
            }
            return newSlide;
        }

        // 分層數據頁：每層一步
        const layerShapes = shapes
            .filter(s => s.shapeType === 'rectangle' && s.width > 800 && s.height >= 80 && s.height <= 120)
            .sort((a, b) => a.y - b.y);
        if (layerShapes.length >= 3) {
            for (const layer of layerShapes) {
                step++;
                const li = elements.indexOf(layer);
                if (li >= 0) newSlide.elements[li].animOrder = step;
                elements.forEach((e, i) => {
                    if (e.type === 'text' && e.y >= layer.y - 5 && e.y <= layer.y + layer.height) {
                        newSlide.elements[i].animOrder = step;
                    }
                });
            }
            return newSlide;
        }

        // 一般內容頁：副標題 step1, 內容 step2
        if (contentEls.length > 0 || mediumTextEls.length > 0) {
            step++;
            subtitleEls.forEach(e => {
                const i = elements.indexOf(e);
                if (i >= 0) newSlide.elements[i].animOrder = step;
            });
            // 裝飾線
            shapes.filter(s => s.height <= 5 && s.width < 200).forEach(s => {
                const i = elements.indexOf(s);
                if (i >= 0) newSlide.elements[i].animOrder = step;
            });

            step++;
            contentEls.forEach(e => {
                const i = elements.indexOf(e);
                if (i >= 0) newSlide.elements[i].animOrder = step;
            });
            mediumTextEls.forEach(e => {
                const i = elements.indexOf(e);
                if (i >= 0) newSlide.elements[i].animOrder = step;
            });
        }

        // 圖片
        images.forEach(img => {
            step++;
            const i = elements.indexOf(img);
            if (i >= 0) newSlide.elements[i].animOrder = step;
        });

        return newSlide;
    }

    // ═══════════════════════════════════════
    // Phase 5: 佈局風格 + 色系美化
    // ═══════════════════════════════════════
    async applyDesign(slides, themeId, layoutId, customPrompt) {
        const theme = MASTER_THEMES.find(t => t.id === themeId);
        if (!theme) throw new Error(`找不到母板: ${themeId}`);
        const layout = LAYOUT_STYLES.find(l => l.id === layoutId) || LAYOUT_STYLES[0];

        const prompts = await this._loadPrompts();
        this._emit(0, `正在套用「${theme.name}」+「${layout.name}」...`);

        // Step 1: 程式化套用色系
        const styledSlides = slides.map((slide, idx) => {
            this._emit((idx / slides.length) * 30, `套用色系 ${idx + 1}/${slides.length}...`);
            return this._applyThemeToSlide(slide, theme);
        });

        // Step 2: 程式化套用佈局
        this._emit(30, `套用「${layout.name}」佈局...`);
        const layoutSlides = styledSlides.map((slide, idx) => {
            this._emit(30 + (idx / styledSlides.length) * 30, `佈局調整 ${idx + 1}/${styledSlides.length}...`);
            return this._applyLayoutToSlide(slide, layout);
        });

        // Step 3: AI 美化排版（分批處理）
        this._emit(60, '正在用 AI 優化排版...');
        const DESIGN_BATCH = 30;
        const designBatches = Math.ceil(layoutSlides.length / DESIGN_BATCH);

        for (let batch = 0; batch < designBatches; batch++) {
            const start = batch * DESIGN_BATCH;
            const end = Math.min(start + DESIGN_BATCH, layoutSlides.length);

            this._emit(60 + (batch / designBatches) * 35, `AI 美化第 ${start + 1}-${end} 頁（第 ${batch + 1}/${designBatches} 批）...`);

            const simplified = layoutSlides.slice(start, end).map((s, i) => {
                const texts = (s.elements || [])
                    .filter(e => e.type === 'text')
                    .map(e => e.content?.replace(/<[^>]+>/g, '') || '')
                    .join(' ')
                    .substring(0, 120);
                return { index: start + i, texts };
            });

            try {
                const prompt = customPrompt || this._replaceVars(prompts.slide_design, {
                    themeName: theme.name,
                    layoutName: layout.name,
                    themeColors: JSON.stringify(theme.colors),
                    layoutDesc: layout.desc,
                    slidesJson: JSON.stringify(simplified, null, 2)
                });

                const result = await ai.chat([
                    { role: 'system', content: '你是簡報排版美化專家。只回傳修改後的 JSON。' },
                    { role: 'user', content: prompt }
                ], { model: 'claude-sonnet-4-5', temperature: 0.5, maxTokens: 16000 });

                const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
                const enhanced = JSON.parse(jsonStr);

                if (Array.isArray(enhanced)) {
                    for (const item of enhanced) {
                        const idx = item.index;
                        if (idx >= 0 && idx < layoutSlides.length && item.title) {
                            const titleEl = layoutSlides[idx].elements?.find(el =>
                                el.type === 'text' && el.fontSize >= 26
                            );
                            if (titleEl) {
                                titleEl.content = titleEl.content.replace(/>(.*?)</, `>${item.title}<`);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn(`AI 美化第 ${batch + 1} 批失敗，已套用基本色系:`, e);
            }
        }

        this._emit(100, `已套用「${theme.name}」+「${layout.name}」`);
        return layoutSlides;
    }

    _applyLayoutToSlide(slide, layoutStyle) {
        const newSlide = JSON.parse(JSON.stringify(slide));
        const elements = newSlide.elements || [];
        const L = layoutStyle.layout;

        // 跳過互動元件頁面
        const hasInteractive = elements.some(e =>
            ['quiz', 'poll', 'ordering', 'matching', 'wordcloud', 'hotspot', 'truefalse', 'opentext', 'scale', 'buzzer', 'fillblank'].includes(e.type)
        );
        if (hasInteractive) return newSlide;

        // 調整 title 位置
        const titleEl = elements.find(e => e.type === 'text' && e.fontSize >= 26);
        if (titleEl && L.title) {
            titleEl.x = L.title.x;
            titleEl.y = L.title.y;
            titleEl.width = L.title.w;
            titleEl.height = L.title.h;
            if (L.title.fontSize) titleEl.fontSize = L.title.fontSize;
        }

        // 調整裝飾線
        const accentLine = elements.find(e => e.type === 'shape' && e.shapeType === 'rectangle' && e.height <= 5 && e.width < 300);
        if (accentLine && L.accentLine) {
            accentLine.x = L.accentLine.x;
            accentLine.y = L.accentLine.y;
            accentLine.width = L.accentLine.w;
            accentLine.height = L.accentLine.h;
        }

        // 調整內容文字
        const contentEls = elements.filter(e => e.type === 'text' && e.fontSize < 26 && e.height > 80);
        if (contentEls.length > 0 && L.content) {
            for (const el of contentEls) {
                el.x = L.content.x;
                el.y = L.content.y;
                el.width = L.content.w;
                el.height = L.content.h;
            }
        }

        // 調整卡片位置
        if (L.card) {
            const cardShapes = elements.filter(e =>
                e.type === 'shape' && e.shapeType === 'rectangle' && e.borderRadius && e.height > 100 && e.width < 500
            ).sort((a, b) => a.x - b.x);

            if (cardShapes.length >= 2) {
                const cols = L.card.cols || 3;
                const offsetX = L.card.offsetX || 60;
                const totalW = (L.content?.w || 840);
                const gap = L.card.gap || 20;
                const cardW = (totalW - gap * (cols - 1)) / cols;

                cardShapes.forEach((card, i) => {
                    if (i >= cols) return;
                    card.x = offsetX + i * (cardW + gap);
                    card.y = L.card.y;
                    card.width = cardW;
                });

                // 移動卡片上的文字
                for (const card of cardShapes) {
                    elements.forEach(e => {
                        if (e.type === 'text' && e !== titleEl) {
                            // 如果文字原本在某個卡片範圍內，跟著移動
                        }
                    });
                }
            }
        }

        return newSlide;
    }

    _applyThemeToSlide(slide, theme) {
        const c = theme.colors;
        const newSlide = JSON.parse(JSON.stringify(slide)); // deep clone

        // 跳過互動元件（quiz/poll/ordering）
        const hasInteractive = (newSlide.elements || []).some(e =>
            ['quiz', 'poll', 'ordering', 'matching', 'wordcloud'].includes(e.type)
        );
        if (hasInteractive) return newSlide;

        // 判斷這頁是封面/章節/內容
        const isTitle = (newSlide.elements || []).some(e => e.type === 'text' && e.fontSize >= 36);
        const isDark = isTitle; // 封面和章節用深色底

        newSlide.background = isDark ? c.bgDark : c.bgLight;

        for (const el of (newSlide.elements || [])) {
            if (el.type === 'shape' && el.shapeType === 'rectangle') {
                // 全版背景
                if (el.width >= 900 && el.height >= 500) {
                    el.background = isDark ? c.bgDark : c.bgLight;
                }
                // 裝飾線
                else if (el.height <= 5) {
                    el.background = c.accent;
                }
                // 卡片背景
                else if (el.height > 100) {
                    el.background = isDark ? `rgba(255,255,255,0.04)` : c.cardBg;
                }
            }
            if (el.type === 'shape' && el.shapeType === 'circle') {
                el.background = c.accent;
            }
            if (el.type === 'text') {
                // 替換文字顏色
                const textColor = isDark ? c.textLight : c.textDark;
                const subtextColor = isDark ? c.subtextLight : c.subtextDark;
                el.content = (el.content || '')
                    .replace(/color:#[0-9a-fA-F]{3,6}/g, (match) => {
                        const origColor = match.replace('color:', '');
                        // 判進淺色文字還是深色文字
                        if (this._isLightColor(origColor)) {
                            return `color:${textColor}`;
                        }
                        if (el.fontSize >= 26) return `color:${textColor}`;
                        return `color:${subtextColor}`;
                    });
            }
        }

        return newSlide;
    }

    _isLightColor(hex) {
        if (!hex || !hex.startsWith('#')) return false;
        const c = hex.replace('#', '');
        const r = parseInt(c.substr(0, 2), 16) || 0;
        const g = parseInt(c.substr(2, 2), 16) || 0;
        const b = parseInt(c.substr(4, 2), 16) || 0;
        return (r * 299 + g * 587 + b * 114) / 1000 > 180;
    }

    // ═══════════════════════════════════════
    // Phase 6: 講師教學大綱備忘錄
    // ═══════════════════════════════════════
    async generateTeachingNotes(slides, customPrompt) {
        const prompts = await this._loadPrompts();
        const promptTemplate = customPrompt || prompts.slide_teaching_notes || '';
        const total = slides.length;
        this._emit(0, `正在為 ${total} 頁投影片生成講師教學大綱...`);

        // 批次處理（每 5 頁一批）
        const BATCH = 5;
        for (let i = 0; i < total; i += BATCH) {
            const batch = slides.slice(i, Math.min(i + BATCH, total));
            const summaries = batch.map((s, bi) => {
                const idx = i + bi + 1;
                const texts = (s.elements || []).filter(e => e.type === 'text').map(e => (e.content || '').replace(/<[^>]+>/g, '').trim()).filter(Boolean);
                return `[第 ${idx} 頁] ${texts.join(' | ') || '(無文字內容)'}`;
            }).join('\n');

            const prompt = this._replaceVars(promptTemplate, {
                slideCount: total,
                slideSummaries: summaries,
                batchStart: i + 1,
                batchEnd: Math.min(i + BATCH, total)
            });

            try {
                const result = await ai.chat([
                    { role: 'system', content: '你是資深講師教練，擅長設計教學流程。只回傳 JSON。' },
                    { role: 'user', content: prompt }
                ], { model: 'claude-sonnet-4-5', temperature: 0.5, maxTokens: 3000 });

                const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
                const notes = JSON.parse(jsonStr);

                if (Array.isArray(notes)) {
                    for (const note of notes) {
                        const slideIdx = (note.page || note.index || 1) - 1;
                        if (slideIdx >= 0 && slideIdx < total) {
                            slides[slideIdx].notes = note.notes || note.content || '';
                        }
                    }
                }
            } catch (e) {
                console.warn(`教學大綱批次 ${i + 1}-${i + BATCH} 生成失敗:`, e);
            }

            this._emit(Math.round(((i + BATCH) / total) * 100), `已處理 ${Math.min(i + BATCH, total)} / ${total} 頁`);
        }

        this._emit(100, `已為 ${total} 頁生成講師教學大綱`);
        return slides;
    }

    // ═══════════════════════════════════════
    // Extra: 課前問卷驅動簡報調整
    // ═══════════════════════════════════════
    async adjustBySurvey(slides, surveyData, customPrompt) {
        const prompts = await this._loadPrompts();
        const promptTemplate = customPrompt || prompts.slide_survey_adjust || '';
        this._emit(0, '正在分析問卷結果與簡報內容...');

        // 建立投影片摘要
        const slideSummaries = slides.map((s, i) => {
            const texts = (s.elements || []).filter(e => e.type === 'text').map(e => (e.content || '').replace(/<[^>]+>/g, '').trim()).filter(Boolean);
            return `[第 ${i + 1} 頁] ${texts.join(' | ') || '(無文字)'}`;
        }).join('\n');

        const prompt = this._replaceVars(promptTemplate, {
            slideCount: slides.length,
            slideSummaries,
            surveyStats: JSON.stringify(surveyData, null, 2)
        });

        this._emit(30, '正在讓 AI 分析並調整簡報...');

        const result = await ai.chat([
            { role: 'system', content: '你是教學設計顧問。根據問卷數據調整簡報，只回傳 JSON。' },
            { role: 'user', content: prompt }
        ], { model: 'claude-sonnet-4-5', temperature: 0.4, maxTokens: 4000 });

        const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
        const adjustments = JSON.parse(jsonStr);

        this._emit(70, '正在套用調整建議...');

        if (Array.isArray(adjustments)) {
            for (const adj of adjustments) {
                const idx = (adj.page || adj.index || 1) - 1;
                if (idx < 0 || idx >= slides.length) continue;
                const slide = slides[idx];

                // 修改文字內容
                if (adj.newContent) {
                    const textEls = (slide.elements || []).filter(e => e.type === 'text');
                    const bodyEl = textEls.find(e => e.fontSize < 26) || textEls[0];
                    if (bodyEl) {
                        bodyEl.content = adj.newContent;
                    }
                }

                // 修改標題
                if (adj.newTitle) {
                    const titleEl = (slide.elements || []).find(e => e.type === 'text' && e.fontSize >= 26);
                    if (titleEl) {
                        titleEl.content = titleEl.content.replace(/>[^<]*</, `>${adj.newTitle}<`);
                    }
                }
            }
        }

        this._emit(100, `已根據問卷資料調整 ${Array.isArray(adjustments) ? adjustments.length : 0} 頁`);
        return { slides, adjustments };
    }

    // ═══════════════════════════════════════
    // Legacy: 一鍵全流程（保留相容性）
    // ═══════════════════════════════════════
    async generate({ clientName, level, pageCount, outline, pdfText }) {
        const slides = await this.generateContent({
            topic: clientName, level, pageCount, outline, pdfText
        });
        const withVisuals = await this.generateVisuals(slides);
        const withInteractive = await this.insertInteractive(withVisuals);
        return withInteractive;
    }

    // ── Utilities ──

    async _loadPrompts() {
        const FALLBACK = {
            slide_content: `你是一位頂尖的教學簡報內容架構師，擅長將複雜主題轉化為清晰、引人入勝的教學流程。

══ 任務資訊 ══
課程主題：{{topic}}
學員程度：{{level}}
目標頁數：{{pageCount}}
大綱/描述：
{{outline}}

══ 可用版型 ══
cover        → 封面頁（標題 + 副標題 + 講師資訊）
section      → 章節分隔頁（大標題 + 簡短描述）
content      → 標準內容頁（標題 + 3-5 個要點）
two-column   → 雙欄比較（左右分欄，用 ||| 分隔）
three-card   → 三卡片併排（三個並列概念或步驟）
comparison   → 對比頁（兩方比較，優缺點分析）
quote        → 引言頁（名言金句 + 出處）
numbered-list→ 步驟流程頁（有序步驟）
thank-you    → 結尾頁（總結 + 行動呼籲）

══ 內容設計原則 ══
1. 結構：第 1 頁必須是 cover，最後一頁必須是 thank-you
2. 節奏：每 3-5 頁內容後插入一個 section 作為章節分隔
3. 版型多樣：不要連續使用同一版型超過 2 次
4. 文字密度：每頁保持 3-5 個要點，用精準的短句而非長段落
5. 教學策略：先建立動機（為什麼要學）→ 核心概念 → 實務應用 → 總結鞏固
6. 案例導向：每個核心概念搭配 1 個具體案例、數據或場景
7. 兩欄/比較頁用 ||| 分隔左右，例如：「優點一<br>優點二 ||| 缺點一<br>缺點二」
8. 內容用 <br> 換行，嚴禁使用 \\n

══ 產出品質標準 ══
- 標題要有衝擊力，用動詞或問句開頭（例：「為什麼 80% 的企業選擇雲端？」）
- 要點用「動詞 + 重點 + 效果」結構（例：「採用微服務架構 → 部署速度提升 5 倍」）
- 引言頁（quote）引用業界知名人物或數據
- 避免空泛描述，每頁都要有「帶走一個收穫」的具體內容

══ 回傳格式（純 JSON 陣列）══
[
  {
    "slideType": "cover|section|content|two-column|three-card|comparison|quote|numbered-list|thank-you",
    "title": "頁面標題",
    "content": "頁面內容",
    "day": "所屬天數或章節（選填）",
    "needsVisual": true或false
  }
]

══ needsVisual 判斷原則 ══
- true：該頁內容適合搭配圖表、流程圖、示意圖等視覺化輔助（如：流程、比較、數據、架構）
- false：封面頁、章節分隔頁、引言頁、結尾頁、三卡片頁、雙欄比較頁（這些版型不適合配圖）
- 約 30-50% 的 content / numbered-list 頁面標記為 true

⚠️ 此階段專注內容結構，不需加入互動元件（quiz/poll 等），將由後續階段處理。`,

            slide_visual: `你是專業的教學視覺化設計師，擅長用圖表和示意圖將抽象概念變得一目了然。

以下是一份 {{slideCount}} 頁教學簡報的內容摘要：

{{slideSummaries}}

══ 你的任務 ══
分析每頁內容，找出「用圖表比文字更有效」的頁面，為其設計專業圖表。

══ 圖表類型指南 ══

| 類型 | 最佳用途 | 資料結構描述 |
|------|----------|-------------|
| flowchart | 流程、決策路徑、SOP | 描述節點名稱、箭頭方向、分支條件 |
| hierarchy | 組織架構、分類體系 | 描述根節點、子節點、層級關係 |
| comparison | 兩方比較、優劣分析 | 描述左右兩方名稱、各自 3-4 個特點 |
| stats | 數據趨勢、百分比分布 | 描述具體數字、單位、趨勢方向 |
| timeline | 發展歷程、里程碑 | 描述時間點、事件名稱、關鍵數據 |
| infographic | 綜合資訊、多維數據 | 描述指標名稱、數值、圖標建議 |
| cycle | 循環流程、迭代過程 | 描述各階段名稱、順序、關聯 |
| venn | 概念重疊、交集關係 | 描述各集合名稱、共同特點 |

══ 選擇原則 ══
1. 只為「視覺化效果明顯優於文字」的頁面建議圖表
2. 封面、章節頁、結尾頁不需要圖表
3. 整份簡報建議 3-6 個圖表（{{slideCount}} 頁以下取 2-3 個）
4. description 必須包含足夠的「資料細節」讓 SVG 生成器能畫出具體圖表
   ✅ 好："流程圖：需求分析 → 系統設計 → 開發測試 → 上線部署 → 迭代優化，各階段標注預計天數"
   ❌ 差："畫一個流程圖"

══ 回傳格式（純 JSON 陣列）══
[
  {
    "slideIndex": 5,
    "chartType": "flowchart",
    "title": "圖表標題",
    "description": "詳細描述圖表的內容結構、節點名稱、數據數值、顏色建議",
    "dataPoints": "列出圖表中的具體數據或節點（用於 SVG 生成）"
  }
]`,

            slide_interactive: `你是擁有 10 年經驗的教學互動設計師，深諳成人學習理論和課堂動態。

以下是一份 {{slideCount}} 頁簡報的內容摘要：

{{slideSummaries}}

══ 可用互動元件 ══

【測驗類】考核理解程度，有標準答案
1. quiz（選擇題）—— 最常用，4 選 1
   JSON: { "type": "quiz", "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0 }
   💡 設計要點：題幹要情境化（避免「以下何者正確？」），選項長度接近，干擾選項要有一定吸引力

2. truefalse（是非題）—— 用於戳破常見迷思
   JSON: { "type": "truefalse", "question": "...", "answer": true }
   💡 設計要點：聚焦一個常見誤解，答案揭曉時能引發「原來如此！」的效果

3. fillblank（填空題）—— 強化關鍵詞記憶
   JSON: { "type": "fillblank", "title": "...", "content": "___1___ 架構的優點是 ___2___", "blanks": [{"answer": "微服務"}, {"answer": "獨立部署"}] }
   💡 設計要點：空格不超過 3 個，答案要明確唯一

4. ordering（排順序）—— 練習流程/SOP
   JSON: { "type": "ordering", "title": "...", "steps": ["步驟1", "步驟2", "步驟3", "步驟4"] }
   💡 設計要點：4-6 個步驟為佳，步驟之間的順序邏輯要清晰

5. matching（連連看）—— 概念配對
   JSON: { "type": "matching", "pairs": [{"left": "術語", "right": "定義"}, ...] }
   💡 設計要點：4-6 組配對，左右不要有明顯的文字對應線索

【互動類】收集意見，無標準答案
6. poll（投票）—— 調查偏好、經驗
   JSON: { "type": "poll", "question": "...", "options": ["A", "B", "C"] }
   💡 設計要點：選項要互斥且完整，避免「其他」作為選項

7. scale（量表評分）—— 量化感受
   JSON: { "type": "scale", "question": "...", "labelLeft": "完全不了解", "labelRight": "非常熟悉" }
   💡 設計要點：搭配前後使用可追蹤學習成效變化

8. opentext（開放問答）—— 反思、心得
   JSON: { "type": "opentext", "question": "...", "placeholder": "提示文字" }
   💡 設計要點：題目要有引導性，例如「你認為最大的挑戰是什麼？為什麼？」

9. wordcloud（文字雲）—— 腦力激盪、破冰
   JSON: { "type": "wordcloud", "question": "...", "maxWords": 3 }
   💡 設計要點：題目要夠開放，激發多元回應

10. buzzer（搶答）—— 活絡氣氛、競爭遊戲
    JSON: { "type": "buzzer", "question": "搶答題目" }
    💡 設計要點：題目要明確、答案唯一，適合用在複習階段

══ 插入策略 ══
1. 頻率：每 8-12 頁內容插入 1 個互動元件
2. 位置：不要在第 1 頁和最後一頁附近插入
3. 課程節奏：
   • 開場（前 5 頁）→ wordcloud 或 scale（破冰、了解程度）
   • 每章節結束 → quiz / truefalse / fillblank（確認理解）
   • 比較/選擇主題後 → poll（收集意見）或 matching（概念配對）
   • 長段落知識後 → ordering（整理消化）
   • 課程結尾 → opentext 或 scale（反思、回饋）
4. 多樣性：不要連續使用相同類型
5. 題目品質：
   • 測驗類要有「教學價值」，不是為了出題而出題
   • 情境化題幹：「小明的公司需要…，以下哪個方案最適合？」
   • 避免送分題和過於刁鑽的題目

══ 回傳格式（純 JSON 陣列）══
[
  { "afterSlide": 8, "type": "quiz", "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0 }
]`,

            slide_design: `你是簡報排版美化專家與教學設計顧問。正在為簡報套用視覺設計。

══ 設計主題 ══
風格名稱：{{themeName}}
佈局名稱：{{layoutName}}
色系配置：{{themeColors}}
佈局說明：{{layoutDesc}}

══ 投影片摘要 ══
{{slidesJson}}

══ 你的任務 ══
針對每頁的標題進行文字優化，讓簡報更吸引人。

══ 標題優化原則 ══
1. 精練有力：控制在 12-18 字之間
2. 技巧應用：
   • 用問句引發好奇：「為什麼 90% 的專案都超時？」
   • 用數字增加可信度：「3 個步驟掌握 API 設計」
   • 用對比製造張力：「從 0 到 1：建構你的第一個微服務」
   • 用動詞開頭增加行動感：「掌握 5 個核心原則」
3. 保持原意：優化文字但不改變核心訊息
4. 不要加入 emoji
5. 封面和結尾頁的標題可以更有創意

══ 回傳格式（純 JSON 陣列，只回傳需要修改的頁面）══
[
  { "index": 0, "title": "優化後的標題" }
]`,

            slide_teaching_notes: `你是一位擁有 20 年經驗的資深講師教練，擅長幫助講師準備生動、有效的課堂教學。

以下是一份簡報的第 {{batchStart}} 到第 {{batchEnd}} 頁（共 {{slideCount}} 頁）：

{{slideSummaries}}

══ 為每一頁生成講師教學備忘錄 ══

每頁備忘錄必須包含以下 4 個區塊：

【講解重點】
• 1-2 句告訴講師：這頁的核心訊息是什麼？學員要帶走什麼？
• 如果涉及概念，提供「一句話版本」讓講師能快速解釋

【舉例建議】
• 提供 1-2 個貼近學員生活或工作場景的具體案例
• 優先使用：日常生活比喻、知名企業案例、數據佐證
• 格式：「你可以舉這個例子：……」

【表達技巧】
• 建議的開場白或過場語（可直接唸出來的台詞）
• 語氣、節奏建議（例如：「停頓 3 秒讓學員思考」）
• 建議時間：X 分鐘

【互動提示】
• 何時向學員提問？問什麼？
• 如何引導討論或回應冷場？
• 過場指引：如何從這頁銜接到下一頁

══ 回傳格式（純 JSON 陣列）══
[
  {
    "page": 1,
    "notes": "【講解重點】...\\n\\n【舉例建議】...\\n\\n【表達技巧】...\\n\\n【互動提示】..."
  }
]

⚠️ 只回傳 JSON，不加 markdown 標記。`,

            slide_survey_adjust: `你是教學設計顧問，擅長根據學員數據動態調整教學策略。

══ 簡報概覽（共 {{slideCount}} 頁）══
{{slideSummaries}}

══ 課前問卷統計結果 ══
{{surveyStats}}

══ 分析維度 ══
請從以下角度分析問卷數據並提出調整建議：

1. 學員程度分布
   • 多數是初學者 → 加入更多基礎解釋、生活化比喻、降低專業術語密度
   • 多數已有經驗 → 聚焦進階技巧、實戰案例、常見坑洞

2. 需求偏好
   • 如果學員需求集中在特定主題 → 強化該主題的頁面內容
   • 如果有分歧 → 建議加入延伸閱讀或分組討論

3. 學習目標
   • 根據學員的目標調整案例選擇和練習設計
   • 強化「學完可以立即用」的實務應用頁面

══ 調整規則 ══
1. 不修改互動元件頁面（quiz/poll/ordering 等）
2. 只修改需要調整的頁面（通常 3-8 頁）
3. newContent 必須是完整的 HTML，包含適當的 font-size、color、line-height
4. 調整後的內容要保持原始結構，但加入更適合學員程度的素材

══ 回傳格式（純 JSON 陣列）══
[
  {
    "page": 5,
    "reason": "分析發現 65% 學員為初學者，需要更淺顯的說明和實際案例",
    "newTitle": "調整後的標題（選填）",
    "newContent": "<div style='font-size:18px;color:#334155;line-height:1.8;'>調整後的內容 HTML（包含精心設計的重點和案例）</div>"
  }
]

⚠️ 只回傳 JSON。`
        };

        try {
            const { data, error } = await db.select('system_prompts');
            if (error) throw new Error(error.message);
            const map = {};
            for (const r of (data || [])) map[r.id] = r.prompt_text;
            for (const [k, v] of Object.entries(FALLBACK)) {
                if (!map[k]) {
                    console.warn(`[AiSlideGenerator] prompt "${k}" 不在 DB 中，使用 fallback`);
                    map[k] = v;
                }
            }
            return map;
        } catch (e) {
            console.warn('Failed to load prompts from DB, using fallbacks:', e);
            return FALLBACK;
        }
    }

    _replaceVars(template, vars) {
        if (!template) return '';
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
    }

    _emit(percent, message) {
        if (this.onProgress) this.onProgress(percent, message);
    }
}
