/**
 * 圖片標註互動模組 — 節點選擇版
 * 學員點選預設節點（可多選）→ 確認送出 → 揭曉答案
 */
import { stateManager } from './stateManager.js';

export class HotspotGame {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        document.querySelectorAll('.hotspot-container').forEach(c => {
            if (!c.dataset._hsReady) { c.dataset._hsReady = '1'; this.setupContainer(c); }
        });
    }

    async setupContainer(container) {
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        let nodes = [];
        try { nodes = JSON.parse(container.dataset.nodes || '[]'); } catch { nodes = []; }

        const resultEl = container.querySelector('.hotspot-result');
        const submitBtn = container.querySelector('.hs-submit-btn');
        let submitted = false;
        const selected = new Set();

        // 重新作答按鈕
        const resetBtn = document.createElement('button');
        resetBtn.className = 'interactive-reset-btn';
        resetBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>重新作答';
        container.style.position = 'relative';
        container.appendChild(resetBtn);

        const nodeEls = container.querySelectorAll('.hs-node');

        const updateSubmitBtn = () => {
            if (submitBtn) submitBtn.disabled = selected.size === 0;
        };

        const showSubmitted = (selectedIds) => {
            submitted = true;
            selectedIds.forEach(id => selected.add(id));

            const correctIds = nodes.filter(n => n.isCorrect).map(n => n.id);
            let correctCount = 0;

            nodeEls.forEach(el => {
                const id = el.dataset.id;
                const node = nodes.find(n => n.id === id);
                el.classList.remove('hs-selected');

                if (selectedIds.includes(id)) {
                    // 使用者選了這個
                    if (node?.isCorrect) {
                        el.classList.add('hs-correct');
                        correctCount++;
                    } else {
                        el.classList.add('hs-wrong');
                    }
                } else if (node?.isCorrect) {
                    // 使用者沒選但它是正確的
                    el.classList.add('hs-missed');
                }
                el.style.pointerEvents = 'none';
            });

            if (submitBtn) { submitBtn.disabled = true; submitBtn.style.display = 'none'; }
            if (resultEl) {
                const total = correctIds.length;
                const allRight = correctCount === total && selected.size === total;
                resultEl.className = 'hotspot-result ' + (allRight ? 'success' : 'error');
                resultEl.innerHTML = allRight
                    ? '<span class="material-symbols-outlined">check_circle</span> 全部答對！'
                    : `<span class="material-symbols-outlined">info</span> 答對 ${correctCount} / ${total} 個`;
            }
            resetBtn.classList.add('visible');
        };

        const resetUI = () => {
            submitted = false;
            selected.clear();
            nodeEls.forEach(el => {
                el.classList.remove('hs-selected', 'hs-correct', 'hs-wrong', 'hs-missed');
                el.style.pointerEvents = '';
            });
            if (submitBtn) { submitBtn.disabled = true; submitBtn.style.display = ''; }
            if (resultEl) { resultEl.className = 'hotspot-result'; resultEl.innerHTML = ''; }
            resetBtn.classList.remove('visible');
        };

        // 載入歷史
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev?.state?.selectedIds) {
                showSubmitted(prev.state.selectedIds);
            }
        }

        // 節點點擊 — 切換選中
        nodeEls.forEach(el => {
            el.addEventListener('click', () => {
                if (submitted) return;
                const id = el.dataset.id;
                if (selected.has(id)) {
                    selected.delete(id);
                    el.classList.remove('hs-selected');
                } else {
                    selected.add(id);
                    el.classList.add('hs-selected');
                }
                updateSubmitBtn();
            });
        });

        // 確認送出
        submitBtn?.addEventListener('click', async () => {
            if (submitted || selected.size === 0) return;
            const selectedIds = [...selected];
            showSubmitted(selectedIds);

            const correctIds = nodes.filter(n => n.isCorrect).map(n => n.id);
            const correctCount = selectedIds.filter(id => correctIds.includes(id)).length;
            const allRight = correctCount === correctIds.length && selectedIds.length === correctIds.length;

            const title = container.querySelector('.hotspot-question')?.textContent || '圖片標註';
            await stateManager.save(elementId, {
                type: 'hotspot', title,
                content: selectedIds.join(', '),
                isCorrect: allRight,
                score: Math.round((correctCount / Math.max(correctIds.length, 1)) * 100),
                state: { selectedIds },
            });
        });

        // 重新作答
        resetBtn.addEventListener('click', async () => {
            resetUI();
            if (elementId) await stateManager.clear(elementId);
        });
    }
}
