/**
 * SlideAPI — AI Agent 控制接口
 * 暴露到 window.SlideAPI，讓外部 AI Agent 可程式化操作簡報
 *
 * 用法：
 *   SlideAPI.getSlide(0)
 *   SlideAPI.editSlide(5, { title: '新標題', body: '新內容' })
 *   SlideAPI.addContentSlides(10, '請新增兩頁關於 AI 倫理的內容')
 *   SlideAPI.deleteSlide(3)
 *   SlideAPI.addNews('AI 最新趨勢', { count: 4 })
 */

export class SlideAPI {
    constructor(slideManager) {
        this.sm = slideManager;
    }

    // ── 查詢 ──

    /** 總頁數 */
    getSlideCount() {
        return this.sm.slides.length;
    }

    /** 取得指定頁（0-indexed） */
    getSlide(index) {
        if (index < 0 || index >= this.sm.slides.length) return null;
        return JSON.parse(JSON.stringify(this.sm.slides[index]));
    }

    /** 取得當前頁 index */
    getCurrentIndex() {
        return this.sm.currentIndex;
    }

    /** 所有頁摘要 */
    getSlideSummary() {
        return this.sm.slides.map((s, i) => {
            const texts = (s.elements || [])
                .filter(e => e.type === 'text')
                .map(e => (e.content || '').replace(/<[^>]+>/g, '').trim())
                .filter(Boolean);
            return { index: i, texts, notes: s.notes || '', elementCount: (s.elements || []).length };
        });
    }

    // ── 修改 ──

    /** 修改指定頁的文字內容 */
    editSlide(index, updates = {}) {
        if (index < 0 || index >= this.sm.slides.length) throw new Error(`頁碼超出範圍: ${index}`);
        const slide = this.sm.slides[index];

        if (updates.title) {
            const titleEl = (slide.elements || []).find(e => e.type === 'text' && e.fontSize >= 26);
            if (titleEl) titleEl.content = titleEl.content.replace(/>[^<]*</, `>${updates.title}<`);
        }

        if (updates.body) {
            const bodyEl = (slide.elements || []).find(e => e.type === 'text' && e.fontSize < 26);
            if (bodyEl) bodyEl.content = updates.body;
        }

        if (updates.notes !== undefined) {
            slide.notes = updates.notes;
        }

        if (updates.background) {
            slide.background = updates.background;
        }

        this._refresh(index);
        return { success: true, slide: this.getSlide(index) };
    }

    /** AI 重寫指定頁內容 */
    async editSlideContent(index, instruction) {
        if (index < 0 || index >= this.sm.slides.length) throw new Error(`頁碼超出範圍: ${index}`);
        const { ai } = await import('./supabase.js');

        const slide = this.sm.slides[index];
        const texts = (slide.elements || [])
            .filter(e => e.type === 'text')
            .map(e => (e.content || '').replace(/<[^>]+>/g, '').trim())
            .filter(Boolean);

        const result = await ai.chat([
            { role: 'system', content: '你是簡報編輯助手。根據指令修改投影片內容。回傳 JSON: { "title": "新標題", "body": "<div>新內容 HTML</div>" }' },
            { role: 'user', content: `目前內容：${texts.join(' | ')}\n\n指令：${instruction}` }
        ], { model: 'claude-sonnet-4-5', temperature: 0.4, maxTokens: 1000 });

        const json = JSON.parse(result.replace(/```json\n?|\n?```/g, '').trim());
        return this.editSlide(index, json);
    }

    // ── 新增 ──

    /** 在指定位置插入投影片 */
    addSlides(afterIndex, slides) {
        const idx = Math.min(afterIndex + 1, this.sm.slides.length);
        const gen = () => 'api' + Math.random().toString(36).substring(2, 11);

        const newSlides = slides.map(s => ({
            id: gen(),
            background: s.background || '#ffffff',
            elements: s.elements || [{
                id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50,
                content: `<div style="font-size:28px;font-weight:700;color:#0f172a;">${s.title || '新投影片'}</div>`,
                fontSize: 28
            }, ...(s.body ? [{
                id: gen(), type: 'text', x: 60, y: 100, width: 840, height: 400,
                content: `<div style="font-size:18px;color:#334155;line-height:1.8;">${s.body}</div>`,
                fontSize: 18
            }] : [])],
            notes: s.notes || ''
        }));

        for (let i = 0; i < newSlides.length; i++) {
            this.sm.slides.splice(idx + i, 0, newSlides[i]);
        }

        this._refresh(idx);
        return { success: true, insertedCount: newSlides.length, startIndex: idx };
    }

    /** AI 生成並插入 */
    async addContentSlides(afterIndex, prompt) {
        const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
        const generator = new AiSlideGenerator(this.sm);

        const slides = await generator.generateContent({
            topic: prompt, level: '一般', pageCount: 2, outline: prompt
        });

        const idx = Math.min(afterIndex + 1, this.sm.slides.length);
        for (let i = 0; i < slides.length; i++) {
            this.sm.slides.splice(idx + i, 0, slides[i]);
        }

        this._refresh(idx);
        return { success: true, insertedCount: slides.length, startIndex: idx };
    }

    // ── 刪除 ──

    /** 刪除指定頁 */
    deleteSlide(index) {
        if (index < 0 || index >= this.sm.slides.length) throw new Error(`頁碼超出範圍: ${index}`);
        if (this.sm.slides.length <= 1) throw new Error('至少需要保留一頁');
        this.sm.slides.splice(index, 1);
        this._refresh(Math.min(index, this.sm.slides.length - 1));
        return { success: true, remainingCount: this.sm.slides.length };
    }

    // ── 新聞 ──

    /** 搜尋並插入新聞 */
    async addNews(topic, opts = {}) {
        const { NewsCrawler } = await import('./newsCrawler.js');
        const crawler = new NewsCrawler();
        const items = await crawler.fetchNews(topic, opts);
        const slides = crawler.buildNewsSlides(items, opts.count || 4);

        const idx = this.sm.currentIndex + 1;
        for (let i = 0; i < slides.length; i++) {
            this.sm.slides.splice(idx + i, 0, slides[i]);
        }

        this._refresh(idx);
        return { success: true, newsCount: items.length, slideCount: slides.length };
    }

    // ── 設計 ──

    /** 套用設計主題 */
    async applyDesign(themeId = 'biz', layoutId = 'classic-center') {
        const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
        const generator = new AiSlideGenerator(this.sm);
        const slides = await generator.applyDesign([...this.sm.slides], themeId, layoutId);
        this.sm.slides = slides;
        this._refresh(0);
        return { success: true };
    }

    /** 生成講師備忘錄 */
    async generateTeachingNotes() {
        const { AiSlideGenerator } = await import('./aiSlideGenerator.js');
        const generator = new AiSlideGenerator(this.sm);
        await generator.generateTeachingNotes(this.sm.slides);
        this.sm.save();
        return { success: true, slidesWithNotes: this.sm.slides.filter(s => s.notes).length };
    }

    // ── 導航 ──

    /** 跳到指定頁 */
    navigateTo(index) {
        this.sm.navigateTo(index);
        return { success: true, currentIndex: this.sm.currentIndex };
    }

    // ── 內部 ──

    _refresh(goTo) {
        if (goTo !== undefined) this.sm.currentIndex = goTo;
        this.sm.renderThumbnails();
        this.sm.renderCurrentSlide();
        this.sm.updateCounter();
        this.sm.save();
    }
}
