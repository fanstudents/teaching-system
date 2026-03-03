/**
 * 文字雲互動模組（多詞輸入 + 重新作答 + 提交後展示文字雲）
 */
import { stateManager } from './stateManager.js';
import { db } from '../supabase.js';

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
        // 確保 cloudEl 存在
        if (!cloudEl) {
            cloudEl = document.createElement('div');
            cloudEl.className = 'wordcloud-cloud';
            container.appendChild(cloudEl);
        }
        container.insertBefore(inputArea, cloudEl);

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

            // 立即將自己的詞渲染到文字雲（不等 DB）
            const colors = ['#0969da', '#cf222e', '#1a7f37', '#9a6700', '#7c3aed', '#0e7490'];
            const localHtml = wordList.map((w, i) =>
                '<span class="wordcloud-word" style="font-size:1.6rem;color:' + colors[i % colors.length] + ';">' + this.esc(w) + '</span>'
            ).join(' ');
            if (cloudEl.querySelector('.wordcloud-empty') || !cloudEl.children.length) {
                cloudEl.innerHTML = localHtml;
            }
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
            const prev = await stateManager.load(elementId);
            if (prev?.state?.words) { showSubmitted(prev.state.words); }
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
            await stateManager.save(elementId, {
                type: 'wordcloud', title, content: collected.join(', '),
                isCorrect: null, score: null, state: { words: collected },
            });
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
                // 如果本地已有提交的詞，不覆蓋
                if (!cloudEl.querySelector('.wordcloud-empty') && cloudEl.querySelector('.wordcloud-word')) return;
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
            const colors = ['#0969da', '#cf222e', '#1a7f37', '#9a6700', '#7c3aed', '#0e7490', '#bf5600', '#6e40c9', '#0550ae', '#953800'];

            cloudEl.innerHTML = entries.map(([word, count], i) => {
                const size = 0.85 + (count / maxFreq) * 2.2;
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
}
