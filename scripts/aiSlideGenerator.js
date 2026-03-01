/**
 * AI 簡報生成器 — 三階段生成
 * Phase 1: 內容規劃（AI 產生頁面結構）
 * Phase 2: 模板套用（程式套用設計元素）
 * Phase 3: 排版美化（AI 微調文字與配色）
 */

import { db, ai } from './supabase.js';

export class AiSlideGenerator {
    constructor(slideManager) {
        this.slideManager = slideManager;
        this.onProgress = null; // callback: (phase, step, percent, message) => void
    }

    /**
     * 主流程
     */
    async generate({ clientName, level, pageCount, outline, pdfText }) {
        const fullOutline = pdfText ? `${outline}\n\n【PDF 內容摘要】\n${pdfText}` : outline;

        // 讀取 prompt
        const prompts = await this._loadPrompts();

        // Phase 1: 內容規劃
        this._emit(1, 'start', 0, '正在分析大綱，規劃頁面結構...');
        const slidesPlan = await this._phase1(prompts.slide_phase1, {
            clientName, level, pageCount, outline: fullOutline
        });
        this._emit(1, 'done', 33, `已規劃 ${slidesPlan.length} 頁內容`);

        // Phase 2: 模板套用
        this._emit(2, 'start', 33, '正在套用模板與設計元素...');
        const slides = this._phase2(slidesPlan);
        this._emit(2, 'done', 66, `已套用 ${slides.length} 頁模板`);

        // Phase 3: 排版美化
        this._emit(3, 'start', 66, '正在用 AI 美化排版...');
        const finalSlides = await this._phase3(prompts.slide_phase3, slides, slidesPlan);
        this._emit(3, 'done', 100, '簡報生成完成！');

        return finalSlides;
    }

    // ── Phase 1: AI 內容規劃 ──
    async _phase1(promptTemplate, vars) {
        const prompt = this._replaceVars(promptTemplate, vars);

        const result = await ai.chat([
            { role: 'system', content: '你是專業簡報規劃師。只回傳 JSON 陣列，不加任何其他文字或 markdown 標記。' },
            { role: 'user', content: prompt }
        ], { model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 8000 });

        const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
        const plan = JSON.parse(jsonStr);
        if (!Array.isArray(plan)) throw new Error('AI 回傳格式不正確');
        return plan;
    }

    // ── Phase 2: 模板套用（純程式） ──
    _phase2(plan) {
        const gen = () => this.slideManager.generateId();
        return plan.map((page, idx) => {
            const slide = { id: gen(), background: '#ffffff', elements: [] };
            this._emit(2, 'progress', 33 + (idx / plan.length) * 33,
                `套用模板 ${idx + 1}/${plan.length}：${page.title || ''}`);

            switch (page.slideType) {
                case 'cover':
                    return this._tmplCover(gen, page);
                case 'section':
                    return this._tmplSection(gen, page);
                case 'content':
                    return this._tmplContent(gen, page);
                case 'dark-content':
                    return this._tmplDarkContent(gen, page);
                case 'two-column':
                    return this._tmplTwoColumn(gen, page);
                case 'three-card':
                    return this._tmplThreeCard(gen, page);
                case 'comparison':
                    return this._tmplComparison(gen, page);
                case 'quote':
                    return this._tmplQuote(gen, page);
                case 'numbered-list':
                    return this._tmplNumberedList(gen, page);
                case 'practice':
                    return this._tmplPractice(gen, page);
                case 'key-points':
                    return this._tmplKeyPoints(gen, page);
                case 'quiz':
                    return this._tmplQuiz(gen, page);
                case 'poll':
                    return this._tmplPoll(gen, page);
                case 'ordering':
                    return this._tmplOrdering(gen, page);
                case 'thank-you':
                    return this._tmplThankYou(gen, page);
                default:
                    return this._tmplContent(gen, page);
            }
        });
    }

    // ── Phase 3: AI 排版美化 ──
    async _phase3(promptTemplate, slides, plan) {
        // 只傳 title + content 給 AI 美化，避免 token 太大
        const simplified = plan.map((p, i) => ({
            index: i,
            slideType: p.slideType,
            title: p.title,
            content: p.content
        }));

        // 分批處理（每批 15 頁）
        const batchSize = 15;
        const batches = [];
        for (let i = 0; i < simplified.length; i += batchSize) {
            batches.push(simplified.slice(i, i + batchSize));
        }

        for (let bi = 0; bi < batches.length; bi++) {
            this._emit(3, 'progress', 66 + ((bi + 1) / batches.length) * 34,
                `美化中 ${bi + 1}/${batches.length} 批...`);

            try {
                const prompt = this._replaceVars(promptTemplate, {
                    slidesJson: JSON.stringify(batches[bi], null, 2)
                });

                const result = await ai.chat([
                    { role: 'system', content: '你是簡報美化專家。只回傳修改後的 JSON 陣列。' },
                    { role: 'user', content: prompt }
                ], { model: 'gpt-4o-mini', temperature: 0.5, maxTokens: 8000 });

                const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
                const enhanced = JSON.parse(jsonStr);

                if (Array.isArray(enhanced)) {
                    for (const item of enhanced) {
                        const idx = item.index ?? batches[bi].indexOf(
                            batches[bi].find(b => b.title === item.title)
                        );
                        const globalIdx = bi * batchSize + (typeof idx === 'number' ? idx : 0);
                        if (globalIdx >= 0 && globalIdx < slides.length) {
                            this._applyEnhancement(slides[globalIdx], item);
                        }
                    }
                }
            } catch (e) {
                console.warn('Phase 3 batch failed, skipping:', e);
            }
        }

        return slides;
    }

    _applyEnhancement(slide, enhanced) {
        if (!slide || !enhanced) return;
        // 找到主標題文字元素並更新 content
        const titleEl = slide.elements?.find(el =>
            el.type === 'text' && el.fontSize >= 26
        );
        if (titleEl && enhanced.title) {
            // 保留原始 HTML 結構，只替換文字
            titleEl.content = titleEl.content.replace(
                />(.*?)</,
                `>${enhanced.title}<`
            );
        }
        // 找到內容文字元素
        const contentEl = slide.elements?.find(el =>
            el.type === 'text' && el.fontSize < 26 && el.fontSize >= 13 && el.height > 100
        );
        if (contentEl && enhanced.content) {
            contentEl.content = contentEl.content.replace(
                />(.*?)</s,
                `>${enhanced.content}<`
            );
        }
    }

    // ── Template Helpers ──

    _tmplCover(gen, p) {
        const bg = 'linear-gradient(135deg, #0f172a, #1e40af)';
        return {
            id: gen(), background: bg,
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: bg },
                {
                    id: gen(), type: 'text', x: 80, y: 160, width: 800, height: 80,
                    content: `<b style="font-size:42px;color:#fff">${p.title || ''}</b>`, fontSize: 42, bold: true
                },
                {
                    id: gen(), type: 'text', x: 80, y: 260, width: 800, height: 50,
                    content: `<span style="font-size:20px;color:rgba(255,255,255,.7)">${p.content || ''}</span>`, fontSize: 20
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 320, width: 100, height: 3, background: '#60a5fa' },
            ]
        };
    }

    _tmplSection(gen, p) {
        const bg = 'linear-gradient(135deg, #1a1a2e, #16213e)';
        return {
            id: gen(), background: bg,
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: bg },
                {
                    id: gen(), type: 'text', x: 80, y: 140, width: 800, height: 40,
                    content: `<span style="font-size:14px;color:rgba(255,255,255,.5);letter-spacing:3px">${p.day || ''}</span>`, fontSize: 14
                },
                {
                    id: gen(), type: 'text', x: 80, y: 190, width: 800, height: 80,
                    content: `<b style="font-size:40px;color:#fff">${p.title || ''}</b>`, fontSize: 40
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 290, width: 120, height: 4, background: '#60a5fa' },
            ]
        };
    }

    _tmplContent(gen, p) {
        return {
            id: gen(), background: '#ffffff',
            elements: [
                {
                    id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50,
                    content: `<b style="font-size:28px;color:#1e293b">${p.title || ''}</b>`, fontSize: 28, bold: true
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 85, width: 80, height: 3, background: '#2563eb' },
                {
                    id: gen(), type: 'text', x: 60, y: 110, width: 840, height: 400,
                    content: `<div style="font-size:18px;color:#475569;line-height:2.2">${p.content || ''}</div>`, fontSize: 18
                },
            ]
        };
    }

    _tmplDarkContent(gen, p) {
        return {
            id: gen(), background: '#0f172a',
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#0f172a' },
                {
                    id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50,
                    content: `<b style="font-size:28px;color:#f1f5f9">${p.title || ''}</b>`, fontSize: 28, bold: true
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 85, width: 80, height: 3, background: '#2563eb' },
                {
                    id: gen(), type: 'text', x: 60, y: 110, width: 840, height: 400,
                    content: `<div style="font-size:18px;color:#cbd5e1;line-height:2.2">${p.content || ''}</div>`, fontSize: 18
                },
            ]
        };
    }

    _tmplTwoColumn(gen, p) {
        const [left = '', right = ''] = (p.content || '').split('|||');
        return {
            id: gen(), background: '#ffffff',
            elements: [
                {
                    id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 45,
                    content: `<b style="font-size:26px;color:#1e293b">${p.title || ''}</b>`, fontSize: 26
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 425, height: 420, background: '#f8fafc', borderRadius: 16 },
                {
                    id: gen(), type: 'text', x: 60, y: 100, width: 385, height: 390,
                    content: `<div style="font-size:15px;color:#475569;line-height:2">${left}</div>`, fontSize: 15
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 85, width: 425, height: 420, background: '#f8fafc', borderRadius: 16 },
                {
                    id: gen(), type: 'text', x: 515, y: 100, width: 385, height: 390,
                    content: `<div style="font-size:15px;color:#475569;line-height:2">${right}</div>`, fontSize: 15
                },
            ]
        };
    }

    _tmplThreeCard(gen, p) {
        const cards = (p.content || '').split('|||').slice(0, 3);
        const colors = ['#eff6ff', '#f0fdf4', '#fefce8'];
        return {
            id: gen(), background: '#ffffff',
            elements: [
                {
                    id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 45,
                    content: `<b style="font-size:26px;color:#1e293b">${p.title || ''}</b>`, fontSize: 26
                },
                ...cards.flatMap((c, i) => [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 30 + i * 310, y: 85, width: 290, height: 420, background: colors[i] || '#f8fafc', borderRadius: 16 },
                    {
                        id: gen(), type: 'text', x: 50 + i * 310, y: 100, width: 250, height: 390,
                        content: `<div style="font-size:14px;color:#475569;line-height:2">${c}</div>`, fontSize: 14
                    }
                ])
            ]
        };
    }

    _tmplComparison(gen, p) {
        const [left = '', right = ''] = (p.content || '').split('|||');
        return {
            id: gen(), background: '#ffffff',
            elements: [
                {
                    id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 45,
                    content: `<b style="font-size:26px;color:#1e293b;text-align:center;display:block">${p.title || ''}</b>`, fontSize: 26
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 425, height: 420, background: '#fef2f2', borderRadius: 16 },
                {
                    id: gen(), type: 'text', x: 60, y: 100, width: 385, height: 390,
                    content: `<div style="font-size:14px;color:#475569;line-height:2.2">${left}</div>`, fontSize: 14
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 85, width: 425, height: 420, background: '#ecfdf5', borderRadius: 16 },
                {
                    id: gen(), type: 'text', x: 515, y: 100, width: 385, height: 390,
                    content: `<div style="font-size:14px;color:#475569;line-height:2.2">${right}</div>`, fontSize: 14
                },
            ]
        };
    }

    _tmplQuote(gen, p) {
        const bg = 'linear-gradient(135deg, #667eea, #764ba2)';
        return {
            id: gen(), background: bg,
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: bg },
                {
                    id: gen(), type: 'text', x: 80, y: 120, width: 800, height: 60,
                    content: '<span style="font-size:72px;color:rgba(255,255,255,.3)">\u275d</span>', fontSize: 72
                },
                {
                    id: gen(), type: 'text', x: 100, y: 180, width: 760, height: 180,
                    content: `<span style="font-size:26px;color:#fff;font-style:italic;line-height:1.8">${p.content || ''}</span>`, fontSize: 26
                },
                {
                    id: gen(), type: 'text', x: 100, y: 400, width: 760, height: 30,
                    content: `<span style="font-size:16px;color:rgba(255,255,255,.6)">\u2014 ${p.title || ''}</span>`, fontSize: 16
                },
            ]
        };
    }

    _tmplNumberedList(gen, p) {
        const items = (p.content || '').split('<br>').filter(Boolean);
        const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626'];
        return {
            id: gen(), background: '#ffffff',
            elements: [
                {
                    id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 45,
                    content: `<b style="font-size:26px;color:#1e293b">${p.title || ''}</b>`, fontSize: 26
                },
                ...items.slice(0, 5).flatMap((item, i) => [
                    { id: gen(), type: 'shape', shapeType: 'circle', x: 60, y: 90 + i * 85, width: 50, height: 50, background: colors[i] || '#2563eb' },
                    {
                        id: gen(), type: 'text', x: 60, y: 95 + i * 85, width: 50, height: 40,
                        content: `<b style="font-size:20px;color:#fff;text-align:center;display:block">${i + 1}</b>`, fontSize: 20
                    },
                    {
                        id: gen(), type: 'text', x: 130, y: 95 + i * 85, width: 770, height: 45,
                        content: `<span style="font-size:16px;color:#1e293b">${item.trim()}</span>`, fontSize: 16
                    },
                ])
            ]
        };
    }

    _tmplPractice(gen, p) {
        return {
            id: gen(), background: '#ffffff',
            elements: [
                {
                    id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 50,
                    content: `<b style="font-size:26px;color:#1e293b">\ud83c\udfaf ${p.title || '課堂練習'}</b>`, fontSize: 26
                },
                {
                    id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 880, height: 420,
                    background: 'linear-gradient(135deg, #eff6ff, #e0e7ff)', borderRadius: 16
                },
                {
                    id: gen(), type: 'text', x: 70, y: 110, width: 820, height: 380,
                    content: `<div style="font-size:16px;color:#1e293b;line-height:2.4">${p.content || ''}</div>`, fontSize: 16
                },
            ]
        };
    }

    _tmplKeyPoints(gen, p) {
        return {
            id: gen(), background: '#0f172a',
            elements: [
                {
                    id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540,
                    background: 'linear-gradient(135deg, #0f172a, #1e293b)'
                },
                {
                    id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 50,
                    content: `<b style="font-size:26px;color:#fbbf24">\u2b50 ${p.title || '重點回顧'}</b>`, fontSize: 26
                },
                {
                    id: gen(), type: 'text', x: 60, y: 90, width: 840, height: 420,
                    content: `<div style="font-size:17px;color:#e2e8f0;line-height:2.4">${p.content || ''}</div>`, fontSize: 17
                },
            ]
        };
    }

    _tmplQuiz(gen, p) {
        const qd = p.quizData || {};
        // options 需要是 [{ text, correct }] 格式
        let options = qd.options || ['選項 A', '選項 B', '選項 C', '選項 D'];
        if (typeof options[0] === 'string') {
            const correctIdx = qd.correctIndex ?? 0;
            options = options.map((text, i) => ({ text, correct: i === correctIdx }));
        }
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'quiz', x: 50, y: 30, width: 860, height: 460,
                question: qd.question || p.title || '問題',
                options
            }]
        };
    }

    _tmplPoll(gen, p) {
        const pd = p.pollData || {};
        // options 需要是 [{ text }] 格式
        let options = pd.options || ['選項 A', '選項 B', '選項 C'];
        if (typeof options[0] === 'string') {
            options = options.map(text => ({ text }));
        }
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'poll', x: 50, y: 30, width: 860, height: 460,
                question: pd.question || p.title || '投票',
                options
            }]
        };
    }

    _tmplOrdering(gen, p) {
        const od = p.orderingData || {};
        return {
            id: gen(), background: '#ffffff',
            elements: [{
                id: gen(), type: 'ordering', x: 50, y: 30, width: 860, height: 460,
                steps: od.steps || ['步驟 1', '步驟 2', '步驟 3', '步驟 4']
            }]
        };
    }

    _tmplThankYou(gen, p) {
        const bg = 'linear-gradient(135deg, #0f172a, #1e40af)';
        return {
            id: gen(), background: bg,
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: bg },
                {
                    id: gen(), type: 'text', x: 80, y: 140, width: 800, height: 80,
                    content: '<b style="font-size:48px;color:#fff;text-align:center;display:block">Thank You \ud83c\udf89</b>', fontSize: 48
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 380, y: 240, width: 200, height: 3, background: '#60a5fa' },
                {
                    id: gen(), type: 'text', x: 80, y: 270, width: 800, height: 60,
                    content: `<span style="font-size:22px;color:rgba(255,255,255,.7);text-align:center;display:block">${p.content || ''}</span>`, fontSize: 22
                },
            ]
        };
    }

    // ── Utilities ──

    async _loadPrompts() {
        // fallback prompts（DB 讀取失敗時使用）
        const FALLBACK = {
            slide_phase1: `你是一位專業的簡報內容規劃師。根據以下資訊設計簡報結構：

客戶：{{clientName}}
程度：{{level}}
頁數要求：{{pageCount}}
大綱/描述：
{{outline}}

請按照以下格式回傳 JSON 陣列，不要有任何其他文字：
[
  {
    "slideType": "cover|section|content|two-column|three-card|comparison|quote|numbered-list|practice|key-points|quiz|poll|ordering|dark-content|thank-you",
    "title": "頁面標題",
    "content": "頁面內容（用 <br> 分隔行）",
    "day": "所屬天數或章節（選填）",
    "quizData": { "question": "", "options": ["A","B","C","D"], "correctIndex": 0 },
    "pollData": { "question": "", "options": ["A","B","C"] },
    "orderingData": { "steps": ["步驟1","步驟2","步驟3"] }
  }
]

設計原則：
1. 第一頁用 cover，最後一頁用 thank-you
2. 每個大章節開頭用 section
3. 每 4-5 頁內容後插入一個互動（quiz/poll/ordering）
4. 用 three-card 或 comparison 呈現比較類內容
5. 重要概念用 key-points 或 dark-content 突出
6. content 文字用 <br> 換行，不要用 \\n`,

            slide_phase3: `你是簡報設計美化專家。以下是一組投影片的 JSON 資料，請改善每頁的：
1. 文字內容（加入適當的 emoji、粗體、重點標記）
2. 文字排版（確保行距適當，不要太擠）
3. 配色建議（如果有需要調整背景色或文字色）

只回傳修改後的 JSON 陣列，不要有任何其他文字。
保持原本的 slideType 和結構，只修改 title 和 content 的文字。

投影片資料：
{{slidesJson}}`
        };

        try {
            const { data, error } = await db.select('system_prompts');
            if (error) throw new Error(error.message);
            const map = {};
            for (const r of (data || [])) map[r.id] = r.prompt_text;
            // 合併 fallback（DB 優先）
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

    _emit(phase, step, percent, message) {
        if (this.onProgress) this.onProgress(phase, step, percent, message);
    }
}
