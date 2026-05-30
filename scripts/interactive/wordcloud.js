/**
 * 文字雲互動模組（多詞輸入 + 重新作答 + 提交後展示文字雲 + AI 分類）
 */
import { stateManager } from './stateManager.js';
import { db, ai } from '../supabase.js';

export class WordCloudGame {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        // ★ 清除舊的定時刷新（防止 renderCurrentSlide 導致 N 個並發 interval）
        if (this._cloudIntervals) {
            this._cloudIntervals.forEach(id => clearInterval(id));
        }
        this._cloudIntervals = [];

        document.querySelectorAll('.wordcloud-container').forEach(c => {
            this.setupContainer(c);
        });
    }

    async setupContainer(container) {
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        const maxWords = parseInt(container.dataset.maxWords || '3', 10);
        let cloudEl = container.querySelector('.wordcloud-cloud');
        let submitted = false;

        // 判斷是否為講師端（簡報模式）
        const isPresenter = !!container.closest('.presentation-slide');

        // 確保 cloudEl 存在
        if (!cloudEl) {
            cloudEl = document.createElement('div');
            cloudEl.className = 'wordcloud-cloud';
        }

        // ── 講師端：純顯示文字雲 + AI 分類按鈕 ──
        if (isPresenter) {
            // 移除舊的輸入區（如果有）
            const oldInputArea = container.querySelector('.wordcloud-multi-input');
            if (oldInputArea) oldInputArea.remove();

            let bodyEl = container.querySelector('.wordcloud-body');
            if (!bodyEl) {
                bodyEl = document.createElement('div');
                bodyEl.className = 'wordcloud-body';
                container.appendChild(bodyEl);
            }
            bodyEl.innerHTML = '';
            bodyEl.appendChild(cloudEl);
            cloudEl.classList.add('wc-cloud-expanded');

            // ★ AI 分類面板（右側）
            let aiPanel = container.querySelector('.wc-ai-panel');
            if (!aiPanel) {
                aiPanel = document.createElement('div');
                aiPanel.className = 'wc-ai-panel';
                aiPanel.innerHTML = `
                    <button class="wc-ai-btn">📊 分類統計</button>
                    <div class="wc-ai-result"></div>
                `;
                bodyEl.appendChild(aiPanel);
            }

            // AI 分類按鈕
            const aiBtn = aiPanel.querySelector('.wc-ai-btn');
            const aiResult = aiPanel.querySelector('.wc-ai-result');
            aiBtn.addEventListener('click', () => this._runAICategorize(elementId, aiBtn, aiResult));

            // 載入 + 定時刷新文字雲
            this.renderCloud(elementId, cloudEl);
            const intervalId = setInterval(() => this.renderCloud(elementId, cloudEl), 4000);
            this._cloudIntervals.push(intervalId);
            return;
        }

        // ── 學員端：完整輸入 + 文字雲 ──

        // 重建輸入區：多個文字輸入框
        const oldInputArea = container.querySelector('.wordcloud-multi-input');
        if (oldInputArea) oldInputArea.remove();

        const inputArea = document.createElement('div');
        inputArea.className = 'wordcloud-multi-input';
        inputArea.innerHTML = `
            <div class="wc-inputs"></div>
            <div class="wc-footer">
                <span class="wc-count">0 / ${maxWords}</span>
                <button class="wordcloud-submit">送出</button>
            </div>
            <div class="wordcloud-result"></div>
        `;

        // 建立水平佈局包裝：左側輸入 + 右側文字雲
        let bodyEl = container.querySelector('.wordcloud-body');
        if (!bodyEl) {
            bodyEl = document.createElement('div');
            bodyEl.className = 'wordcloud-body';
            container.appendChild(bodyEl);
        }
        bodyEl.innerHTML = '';
        bodyEl.appendChild(inputArea);
        bodyEl.appendChild(cloudEl);

        const inputsWrap = inputArea.querySelector('.wc-inputs');
        const countEl = inputArea.querySelector('.wc-count');
        const submitBtn = inputArea.querySelector('.wordcloud-submit');
        const resultEl = inputArea.querySelector('.wordcloud-result');

        // 建立輸入欄位
        for (let i = 0; i < maxWords; i++) {
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'wordcloud-input';
            inp.placeholder = '關鍵字 ' + (i + 1);
            inp.addEventListener('input', updateCount);
            inputsWrap.appendChild(inp);
        }

        function updateCount() {
            const filled = [...inputsWrap.querySelectorAll('.wordcloud-input')]
                .filter(inp => inp.value.trim()).length;
            countEl.textContent = filled + ' / ' + maxWords;
        }

        // 重新作答按鈕
        const resetBtn = document.createElement('button');
        resetBtn.className = 'interactive-reset-btn';
        resetBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>重新作答';
        container.style.position = 'relative';
        container.appendChild(resetBtn);

        const showSubmitted = (wordList) => {
            submitted = true;
            const inputs = inputsWrap.querySelectorAll('.wordcloud-input');
            inputs.forEach((inp, i) => {
                inp.value = wordList[i] || '';
                inp.disabled = true;
            });
            if (submitBtn) submitBtn.disabled = true;
            if (resultEl) {
                resultEl.className = 'wordcloud-result success';
                resultEl.innerHTML = '✓ 已提交 <span class="wc-sync"><span class="material-symbols-outlined wc-sync-icon">sync</span>同步中</span>';
            }
            resetBtn.classList.add('visible');
            updateCount();

            // 提交後放大文字雲顯示區 + 隱藏輸入區
            inputArea.classList.add('wc-submitted');
            cloudEl.classList.add('wc-cloud-expanded');
        };

        const resetUI = () => {
            submitted = false;
            inputsWrap.querySelectorAll('.wordcloud-input').forEach(inp => {
                inp.value = '';
                inp.disabled = false;
            });
            if (submitBtn) submitBtn.disabled = false;
            if (resultEl) { resultEl.className = 'wordcloud-result'; resultEl.textContent = ''; }
            resetBtn.classList.remove('visible');
            inputArea.classList.remove('wc-submitted');
            cloudEl.classList.remove('wc-cloud-expanded');
            updateCount();
        };

        // 載入歷史
        if (elementId) {
            try {
                const prev = await stateManager.load(elementId);
                if (prev?.state?.words) { showSubmitted(prev.state.words); }
            } catch (e) {
                console.warn('[wordcloud] load history failed:', e);
            }
        }

        // 載入文字雲
        this.renderCloud(elementId, cloudEl);

        submitBtn?.addEventListener('click', async () => {
            if (submitted) return;
            const inputs = inputsWrap.querySelectorAll('.wordcloud-input');
            const collected = [...inputs].map(inp => inp.value.trim()).filter(w => w.length > 0);
            if (!collected.length) return;
            showSubmitted(collected);

            const title = container.querySelector('.wordcloud-question')?.textContent || '文字雲';
            const points = parseInt(container.closest('[data-points]')?.dataset.points) || 1;
            const _r = await stateManager.save(elementId, {
                type: 'wordcloud', title, content: collected.join(', '),
                isCorrect: null, score: null, points, participated: true, state: { words: collected },
            });
            if (_r?.isRetry) stateManager.showRetryBanner(container);
            setTimeout(() => this.renderCloud(elementId, cloudEl), 500);
        });

        resetBtn.addEventListener('click', async () => {
            resetUI();
            if (elementId) await stateManager.clear(elementId);
        });

        // 定時刷新文字雲
        if (cloudEl) {
            const intervalId = setInterval(() => this.renderCloud(elementId, cloudEl), 4000);
            this._cloudIntervals.push(intervalId);
        }
    }

    async renderCloud(elementId, cloudEl) {
        if (!cloudEl || !elementId) return;
        try {
            const { data } = await db.select('submissions', {
                filter: { element_id: 'eq.' + elementId },
                select: 'content',
            });
            if (!data || !data.length) {
                cloudEl.innerHTML = '<span class="wordcloud-empty">等待學員提交...</span>';
                return;
            }

            const freq = {};
            data.forEach(s => {
                if (!s.content) return;
                s.content.split(/[,\s、，]+/).forEach(w => {
                    w = w.trim();
                    if (w) freq[w] = (freq[w] || 0) + 1;
                });
            });

            const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 50);
            const maxFreq = Math.max(...entries.map(e => e[1]), 1);
            const colors = ['#0969da', '#cf222e', '#1a7f37', '#9a6700', '#1a73e8', '#0e7490', '#bf5600', '#6e40c9', '#0550ae', '#953800'];

            cloudEl.innerHTML = entries.map(([word, count], i) => {
                const size = Math.min(0.85 + (count / maxFreq) * 2.2, 2.8);
                const color = colors[i % colors.length];
                const opacity = 0.7 + (count / maxFreq) * 0.3;
                return `<span class="wordcloud-word" style="font-size:${size}rem;color:${color};opacity:${opacity};" title="${count} 次">${this.esc(word)}</span>`;
            }).join(' ');
        } catch (e) {
            console.warn('wordcloud render error:', e);
        }
    }

    esc(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * AI 分類：將文字雲內容發送給 AI，回傳分類 + 百分比
     */
    async _runAICategorize(elementId, btn, resultEl) {
        btn.disabled = true;
        btn.textContent = '⏳ 分析中...';
        resultEl.innerHTML = '<div style="color:#94a3b8;font-size:12px;">統計分類中...</div>';

        try {
            const { data } = await db.select('submissions', {
                filter: { element_id: 'eq.' + elementId },
                select: 'content',
            });
            if (!data?.length) {
                resultEl.innerHTML = '<div style="color:#94a3b8;font-size:12px;">尚無資料</div>';
                btn.disabled = false;
                btn.textContent = '📊 分類統計';
                return;
            }

            const allWords = [];
            data.forEach(s => {
                if (!s.content) return;
                s.content.split(/[,\s、，]+/).forEach(w => {
                    w = w.trim();
                    if (w) allWords.push(w);
                });
            });

            const prompt = `以下是學員提交的關鍵字（共 ${allWords.length} 個）：

${allWords.join('、')}

請將這些關鍵字歸納為最多 5 個主要類別，無法歸類的放入「其他」。
每個類別給出：
1. 類別名稱（2-4 字）
2. 包含的關鍵字列表
3. 佔比百分比（四捨五入到整數，所有類別加總 = 100）

規則：
- 最多 5 個主類別 + 1 個「其他」，共不超過 6 個
- 「其他」一定要有，即使只有 0%
- 百分比加總必須 = 100

JSON 格式回覆：
{"categories":[{"name":"類別名","words":["詞1"],"percent":35}]}
只回覆 JSON。`;

            const response = await ai.chat([
                { role: 'system', content: '你是資料分類助手。只回覆 JSON。' },
                { role: 'user', content: prompt }
            ], { temperature: 0.3, maxTokens: 1024 });

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('分類格式錯誤');
            const result = JSON.parse(jsonMatch[0]);
            let categories = (result.categories || []).slice(0, 7);

            // 確保有「其他」
            if (!categories.find(c => c.name === '其他')) {
                categories.push({ name: '其他', words: [], percent: 0 });
            }

            const catColors = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#94a3b8'];
            resultEl.innerHTML = categories.map((cat, i) => {
                const color = catColors[i % catColors.length];
                const isOther = cat.name === '其他';
                return `
                    <div class="wc-ai-cat">
                        <div class="wc-ai-cat-header">
                            <span style="${isOther ? 'opacity:0.6;' : ''}">${this.esc(cat.name)}</span>
                            <span class="wc-ai-pct" style="color:${color};">${cat.percent}%</span>
                        </div>
                        <div class="wc-ai-bar"><div class="wc-ai-bar-fill" style="width:${cat.percent}%;background:${color};"></div></div>
                    </div>`;
            }).join('');
        } catch (e) {
            console.error('[wordcloud categorize]', e);
            resultEl.innerHTML = `<div style="color:#ef4444;font-size:12px;">❌ ${e.message}</div>`;
        }
        btn.disabled = false;
        btn.textContent = '🔄 重新統計';
    }
}
