/**
 * 開放問答互動模組（含重新作答）
 */
import { stateManager } from './stateManager.js';

export class OpenTextGame {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        document.querySelectorAll('.opentext-container').forEach(c => {
            if (!c.dataset._otReady) { c.dataset._otReady = '1'; this.setupContainer(c); }
        });
    }

    async setupContainer(container) {
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        const textarea = container.querySelector('.opentext-input');
        const submitBtn = container.querySelector('.opentext-submit');
        const resultEl = container.querySelector('.opentext-result');
        let submitted = false;

        // 注入重新作答按鈕
        const resetBtn = document.createElement('button');
        resetBtn.className = 'interactive-reset-btn';
        resetBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>重新作答';
        container.style.position = 'relative';
        container.appendChild(resetBtn);

        const showSubmitted = (text) => {
            submitted = true;
            if (textarea) { textarea.value = text; textarea.disabled = true; }
            if (submitBtn) submitBtn.disabled = true;
            if (resultEl) { resultEl.className = 'opentext-result success'; resultEl.textContent = '\u2713 已送出'; }
            resetBtn.classList.add('visible');
        };

        const resetUI = () => {
            submitted = false;
            if (textarea) { textarea.value = ''; textarea.disabled = false; }
            if (submitBtn) submitBtn.disabled = false;
            if (resultEl) { resultEl.className = 'opentext-result'; resultEl.textContent = ''; }
            resetBtn.classList.remove('visible');
        };

        // 載入歷史
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev?.state?.text) { showSubmitted(prev.state.text); }
        }

        submitBtn?.addEventListener('click', async () => {
            if (submitted) return;
            const text = textarea?.value?.trim();
            if (!text) return;
            showSubmitted(text);
            const title = container.querySelector('.opentext-question')?.textContent || '開放問答';
            const points = parseInt(container.closest('[data-points]')?.dataset.points) || 1;
            const _r = await stateManager.save(elementId, {
                type: 'opentext', title, content: text,
                isCorrect: null, score: null, points, participated: true, state: { text },
            });
            if (_r?.isRetry) stateManager.showRetryBanner(container);
        });

        resetBtn.addEventListener('click', async () => {
            resetUI();
            if (elementId) await stateManager.clear(elementId);
        });
    }
}
