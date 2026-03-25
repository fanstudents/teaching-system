// mdParser.js — Markdown + :::component 解析器（非 ES module 版）
(function() {
'use strict';

// ═════════════════════════════════════════
// 支援的互動元件清單
// ═════════════════════════════════════════
const INTERACTIVE_TYPES = new Set([
    'quiz', 'poll', 'truefalse', 'fillblank', 'ordering', 'matching',
    'opentext', 'scale', 'buzzer', 'wordcloud', 'hotspot',
    'icebreaker', 'leaderboard', 'assessment',
    'copycard', 'document', 'homework', 'showcase'
]);

// 支援的投影片類型
const SLIDE_TYPES = new Set([
    'cover', 'section', 'content', 'two-column', 'three-card',
    'comparison', 'quote', 'numbered-list', 'thank-you', 'interactive'
]);

// ═════════════════════════════════════════
// Markdown → HTML 基本轉換
// ═════════════════════════════════════════
function mdToHtml(text) {
    if (!text) return '';
    let html = text
        // 粗體
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        // 斜體
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        // 行內 code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // 連結
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // 圖片
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1"/>');
    return html;
}

// ═════════════════════════════════════════
// :::component 區塊解析
// ═════════════════════════════════════════
function parseComponentBlock(type, body) {
    const component = { type, props: {} };
    const lines = body.split('\n');
    let currentKey = null;
    let listItems = [];
    let inList = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // YAML-like key: value
        const kvMatch = trimmed.match(/^(\w+)\s*:\s*(.*)$/);
        if (kvMatch && !trimmed.startsWith('-')) {
            // 儲存前一個 list
            if (inList && currentKey) {
                component.props[currentKey] = listItems;
                listItems = [];
                inList = false;
            }
            currentKey = kvMatch[1];
            const value = kvMatch[2].trim();
            if (value === '' || value === '|') {
                // 下一行可能是 list 或 multiline
                inList = value !== '|'; // 空值表示接下來可能是 list
                if (value === '|') {
                    // multiline block
                    component.props[currentKey] = '';
                }
            } else {
                component.props[currentKey] = value;
            }
        } else if (trimmed.startsWith('- ')) {
            inList = true;
            listItems.push(trimmed.substring(2).trim());
        } else if (currentKey && component.props[currentKey] === '') {
            // multiline content
            component.props[currentKey] += (component.props[currentKey] ? '\n' : '') + trimmed;
        }
    }

    // 最後的 list
    if (inList && currentKey) {
        component.props[currentKey] = listItems;
    }

    return component;
}

// ═════════════════════════════════════════
// 主解析函式
// ═════════════════════════════════════════
function parseMd(markdown) {
    if (!markdown || !markdown.trim()) return [];

    // 用 --- 分割投影片
    const rawSlides = markdown.split(/\n---\n/).map(s => s.trim()).filter(Boolean);

    return rawSlides.map((raw, index) => {
        const slide = {
            index,
            type: index === 0 ? 'cover' : 'content',
            heading: '',
            subheading: '',
            bodyLines: [],
            components: [],
            columns: null,     // for two-column
            cards: null,       // for three-card
            quoteText: '',     // for quote
            quoteAuthor: '',   // for quote
        };

        const lines = raw.split('\n');
        let i = 0;

        // 讀取 front matter (slide: type)
        if (lines[0] && lines[0].match(/^slide\s*:\s*(\S+)/)) {
            const typeMatch = lines[0].match(/^slide\s*:\s*(\S+)/);
            if (typeMatch && SLIDE_TYPES.has(typeMatch[1])) {
                slide.type = typeMatch[1];
            }
            i = 1;
        }

        // 解析剩餘內容
        let inComponent = false;
        let componentType = '';
        let componentBody = '';

        for (; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // :::component 開始
            if (!inComponent && trimmed.match(/^:::(\w+)$/)) {
                const cType = trimmed.match(/^:::(\w+)$/)[1];
                if (INTERACTIVE_TYPES.has(cType)) {
                    inComponent = true;
                    componentType = cType;
                    componentBody = '';
                    continue;
                }
            }

            // ::: 結束
            if (inComponent && trimmed === ':::') {
                slide.components.push(parseComponentBlock(componentType, componentBody));
                inComponent = false;
                componentType = '';
                componentBody = '';
                continue;
            }

            // 在 component 區塊內
            if (inComponent) {
                componentBody += line + '\n';
                continue;
            }

            // 空行跳過
            if (!trimmed) continue;

            // # 標題
            if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
                slide.heading = mdToHtml(trimmed.substring(2));
                continue;
            }

            // ## 副標題
            if (trimmed.startsWith('## ')) {
                slide.subheading = mdToHtml(trimmed.substring(3));
                continue;
            }

            // ### 小標題 → 當作 body
            if (trimmed.startsWith('### ')) {
                slide.bodyLines.push({ type: 'subheading', content: mdToHtml(trimmed.substring(4)) });
                continue;
            }

            // > 引言
            if (trimmed.startsWith('> ')) {
                const quoteContent = trimmed.substring(2);
                // 嘗試分離引言和作者
                const authorMatch = quoteContent.match(/^(.+?)\s*—\s*(.+)$/);
                if (authorMatch) {
                    slide.quoteText = mdToHtml(authorMatch[1]);
                    slide.quoteAuthor = mdToHtml(authorMatch[2]);
                } else {
                    slide.quoteText = mdToHtml(quoteContent);
                }
                if (slide.type === 'content' && !slide.heading) slide.type = 'quote';
                slide.bodyLines.push({ type: 'quote', content: mdToHtml(quoteContent) });
                continue;
            }

            // ||| 雙欄分隔（two-column）
            if (trimmed === '|||') {
                if (!slide.columns) {
                    slide.columns = [[], []];
                    slide.type = 'two-column';
                }
                // 切換到右欄（已有左欄內容時）
                continue;
            }

            // - 列表項目
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const content = mdToHtml(trimmed.substring(2));
                if (slide.columns) {
                    const col = slide.columns[1].length === 0 && !slide.bodyLines.some(l => l.type === 'column-break') ? 0 : 1;
                    slide.columns[col].push(content);
                } else {
                    slide.bodyLines.push({ type: 'bullet', content });
                }
                continue;
            }

            // 數字列表
            const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
            if (numMatch) {
                slide.bodyLines.push({ type: 'numbered', num: numMatch[1], content: mdToHtml(numMatch[2]) });
                if (slide.bodyLines.filter(l => l.type === 'numbered').length >= 2) {
                    slide.type = 'numbered-list';
                }
                continue;
            }

            // *斜體* 開頭常用於副標題/描述
            if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
                slide.subheading = slide.subheading || mdToHtml(trimmed);
                continue;
            }

            // 其他文字 → body paragraph
            slide.bodyLines.push({ type: 'text', content: mdToHtml(trimmed) });
        }

        // 處理 two-column：把 ||| 前後的 bodyLines 分到 columns
        if (slide.type === 'two-column' && !slide.columns) {
            slide.columns = [[], []];
        }
        if (slide.columns && slide.bodyLines.length > 0) {
            let col = 0;
            const newBody = [];
            for (const line of slide.bodyLines) {
                if (line.type === 'column-break') {
                    col = 1;
                } else {
                    slide.columns[col].push(line.content);
                }
            }
            slide.bodyLines = newBody;
        }

        // 自動偵測 slide type
        if (slide.components.length > 0 && slide.type === 'content') {
            slide.type = 'interactive';
        }

        return slide;
    });
}

// ═════════════════════════════════════════
// 範例 Markdown 模板
// ═════════════════════════════════════════
const EXAMPLE_TEMPLATE = `slide: cover

# AI 辦公室應用實戰
*講師：范老師 ｜ 企業內訓*

---
slide: section

# 第一章
## 為什麼企業要導入 AI？

---
slide: content

## AI 帶來的三大改變

- **降低 80% 重複性工作** → 自動化報表、郵件、排程
- **提升決策品質** → 數據驅動，減少主觀判斷偏差
- **加速產品迭代** → AI 輔助開發，週期從月到週

---
slide: two-column

## 傳統 vs AI 工作流程

|||
**傳統方式**
- 手動整理報表：4 小時
- 人工回覆客服：全天候值班
- 會議紀錄：手動整理
|||
**AI 方式**
- 自動化分析：10 分鐘
- AI 客服：24/7 即時回應
- AI 摘要：會後自動產出
|||

---
slide: interactive

## 課堂小測驗

:::quiz
question: AI 的全名是什麼？
options:
  - Artificial Intelligence ✓
  - Automatic Integration
  - Advanced Information
  - Applied Intelligence
:::

---
slide: interactive

## 你最常使用哪個 AI 工具？

:::poll
question: 你目前最常使用的 AI 工具是？
options:
  - ChatGPT
  - Claude
  - Gemini
  - Copilot
  - 都沒用過
:::

---
slide: interactive

## 說到 AI 你想到什麼？

:::wordcloud
question: 說到 AI，你第一個聯想到什麼？
:::

---
slide: interactive

## 今日重點筆記

:::copycard
title: AI 辦公應用三大心法
content: |
  1. 善用 Prompt Engineering 提高效率
  2. 從小任務開始，逐步擴大應用範圍
  3. AI 不是取代人類，而是增強能力
:::

---
slide: quote

> 最好的學習方式就是立刻動手做 — 費曼

---
slide: thank-you

# 謝謝大家！
## 開始你的 AI 之旅 🚀
`;

// Export to window
window.MdParser = { parseMd, EXAMPLE_TEMPLATE, INTERACTIVE_TYPES, SLIDE_TYPES, mdToHtml, parseComponentBlock };
})();
