/**
 * 新聞爬取模組
 * 使用 AI 搜尋並彙整與簡報主題相關的最新新聞
 */

import { ai } from './supabase.js';

export class NewsCrawler {
    constructor() {
        this.onProgress = null;
    }

    _emit(percent, msg) {
        if (this.onProgress) this.onProgress(percent, msg);
    }

    /**
     * 根據主題搜尋最新新聞
     * @param {string} topic - 搜尋主題
     * @param {object} opts
     * @param {number} opts.count - 每頁新聞數（3-5）
     * @param {number} opts.pages - 生成幾頁（預設 1）
     * @param {string} opts.dateRange - 日期範圍：'3d' | '14d' | '30d'（預設 '14d'）
     * @returns {Promise<Array<{title: string, url: string, summary: string, source: string}>>}
     */
    async fetchNews(topic, opts = {}) {
        const count = opts.count || 4;
        const pages = opts.pages || 1;
        const totalItems = count * pages;
        const dateRange = opts.dateRange || '14d';

        const dateLabel = { '3d': '最近 3 天', '14d': '最近 14 天', '30d': '最近一個月' }[dateRange] || '最近 14 天';
        const today = new Date().toISOString().split('T')[0];

        this._emit(10, `正在搜尋「${topic}」${dateLabel}的新聞...`);

        const prompt = `你是一位資深科技新聞編輯。請根據以下主題，整理出${dateLabel}內發生的具體新聞事件。

搜尋主題：${topic}
時間範圍：${dateLabel}（截至 ${today}）
需求數量：${totalItems} 則

──── 嚴格要求 ────

1. 每則新聞必須是「具體事件」，不要泛泛的趨勢描述
   ✅ 好的標題範例：
   「OpenAI 正式發布 GPT-5，推理能力提升 40%」
   「Google DeepMind 公布 Gemini 2.0，支援百萬 token 上下文」
   「NVIDIA 股價單日暴跌 12%，因中國 AI 晶片出口管制升級」
   「微軟宣布 Copilot 整合 Teams，企業用戶即日可用」
   
   ❌ 不要的標題範例：
   「AI 助力企業提升效率」
   「AI 技術持續發展改變職場」
   「人工智慧在各行業的應用前景」

2. 每則新聞包含：
   • title：繁體中文標題（具體事件、有數據或公司名稱）
   • searchQuery：用於搜尋該新聞的英文關鍵字（3-5 個單字，例如 "OpenAI GPT-5 release"）
   • summary：繁體中文 30-50 字重點摘要，說明影響或意義
   • source：最可能的來源媒體名稱

3. 新聞必須在${dateLabel}範圍內
4. 必須與「${topic}」直接相關
5. 對學生學習有實質幫助，能作為上課討論案例

──── 回傳格式（只回 JSON）────

[
  {
    "title": "具體事件標題",
    "searchQuery": "English search keywords",
    "summary": "30-50字重點摘要",
    "source": "來源名稱"
  }
]`;

        this._emit(30, '正在查詢新聞資料...');

        let result;
        try {
            result = await ai.chat([
                { role: 'system', content: '你是專業科技新聞研究員，擅長搜尋整理最新資訊。只回傳 JSON 陣列，不加任何其他文字或 markdown。' },
                { role: 'user', content: prompt }
            ], { model: 'claude-sonnet-4-5', temperature: 0.3, maxTokens: 6000 });
        } catch (e) {
            console.error('AI 新聞查詢失敗:', e);
            throw new Error('AI 新聞查詢失敗，請檢查網路或 API 設定');
        }

        this._emit(70, '正在解析新聞資料...');

        // 清理 AI 回傳的 JSON
        let jsonStr = result
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        // 嘗試提取 JSON 陣列
        const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (arrMatch) jsonStr = arrMatch[0];

        let news;
        try {
            news = JSON.parse(jsonStr);
        } catch (e) {
            console.error('JSON 解析失敗:', jsonStr.substring(0, 200));
            throw new Error('新聞資料解析失敗，請重試');
        }

        if (!Array.isArray(news) || news.length === 0) {
            throw new Error('未找到相關新聞，請嘗試調整主題或日期範圍');
        }

        // 過濾確保每則都有 title，並生成 Google News 搜尋連結
        const valid = news
            .filter(n => n && n.title)
            .map(n => ({
                ...n,
                url: n.url || (n.searchQuery
                    ? `https://news.google.com/search?q=${encodeURIComponent(n.searchQuery)}&hl=zh-TW`
                    : `https://news.google.com/search?q=${encodeURIComponent(n.title)}&hl=zh-TW`)
            }));
        if (valid.length === 0) throw new Error('搜尋結果無有效新聞');

        this._emit(90, `已找到 ${valid.length} 則相關新聞`);
        return valid;
    }

    /**
     * 將新聞轉換為投影片元素
     * @param {Array} newsItems
     * @param {number} perSlide - 每頁顯示幾則
     * @returns {Array} slides
     */
    buildNewsSlides(newsItems, perSlide = 4) {
        const slides = [];
        for (let i = 0; i < newsItems.length; i += perSlide) {
            const chunk = newsItems.slice(i, i + perSlide);
            const slide = {
                id: this._genId(),
                background: '#ffffff',
                elements: [{
                    id: this._genId(),
                    type: 'news',
                    x: 30, y: 20, width: 900, height: 520,
                    items: chunk.map(n => ({
                        title: n.title,
                        url: n.url || '',
                        summary: n.summary || '',
                        source: n.source || ''
                    }))
                }]
            };
            slides.push(slide);
        }

        this._emit(100, `已生成 ${slides.length} 頁新聞投影片`);
        return slides;
    }

    _genId() {
        return 'n' + Math.random().toString(36).substring(2, 11);
    }
}
