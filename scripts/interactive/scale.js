/**
 * 量表評分互動模組（含重新作答）
 */
import { stateManager } from './stateManager.js';

export class ScaleGame {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        document.querySelectorAll('.scale-container').forEach(c => {
            if (!c.dataset._scReady) { c.dataset._scReady = '1'; this.setupContainer(c); }
        });
    }

    async setupContainer(container) {
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        const slider = container.querySelector('.scale-slider');
        const valueDisplay = container.querySelector('.scale-value');
        const submitBtn = container.querySelector('.scale-submit');
        const resultEl = container.querySelector('.scale-result');
        let submitted = false;

        // 注入重新作答按鈕
        const resetBtn = document.createElement('button');
        resetBtn.className = 'interactive-reset-btn';
        resetBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>重新作答';
        container.style.position = 'relative';
        container.appendChild(resetBtn);

        slider?.addEventListener('input', () => {
            if (valueDisplay) valueDisplay.textContent = slider.value;
        });

        const showSubmitted = (value) => {
            submitted = true;
            if (slider) { slider.value = value; slider.disabled = true; }
            if (valueDisplay) valueDisplay.textContent = value;
            if (submitBtn) submitBtn.disabled = true;
            if (resultEl) { resultEl.className = 'scale-result success'; resultEl.textContent = '\u2713 已提交：' + value; }
            resetBtn.classList.add('visible');
        };

        const resetUI = () => {
            submitted = false;
            if (slider) { slider.value = slider.getAttribute('value') || '5'; slider.disabled = false; }
            if (valueDisplay) valueDisplay.textContent = slider?.value || '5';
            if (submitBtn) submitBtn.disabled = false;
            if (resultEl) { resultEl.className = 'scale-result'; resultEl.textContent = ''; }
            resetBtn.classList.remove('visible');
        };

        // 載入歷史
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev?.state?.value !== undefined) { showSubmitted(prev.state.value); }
        }

        submitBtn?.addEventListener('click', async () => {
            if (submitted) return;
            const value = parseInt(slider?.value || '5', 10);
            showSubmitted(value);
            const title = container.querySelector('.scale-question')?.textContent || '量表評分';
            const points = parseInt(container.closest('[data-points]')?.dataset.points) || 1;
            await stateManager.save(elementId, {
                type: 'scale', title, content: String(value),
                isCorrect: null, score: null, points, participated: true, state: { value },
            });
        });

        resetBtn.addEventListener('click', async () => {
            resetUI();
            if (elementId) await stateManager.clear(elementId);
        });
    }
}
