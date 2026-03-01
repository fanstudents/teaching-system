/**
 * 排列順序互動模組 — 拖曳排序（v2 — polished UX + 狀態持久化）
 *
 * ✦ 左側打亂的選項 chip，拖曳到右側 slot
 * ✦ 錯誤的 chip 可拖回左側（或點擊退回）
 * ✦ 正確的 chip 鎖定不可再拖
 * ✦ FLIP 動畫 + spring 彈性
 * ✦ touch 完整支援
 */
import { stateManager } from './stateManager.js';

export class OrderingGame {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        document.querySelectorAll('.ordering-container').forEach(c => this.setupContainer(c));
    }

    /* ====================================================
       Container Setup
       ==================================================== */
    async setupContainer(container) {
        const sourcePool = container.querySelector('.ordering-source');
        const targetSlots = container.querySelector('.ordering-slots');
        if (!sourcePool || !targetSlots) return;

        const chips = Array.from(sourcePool.querySelectorAll('.ordering-chip'));
        const slots = Array.from(targetSlots.querySelectorAll('.ordering-slot'));
        const totalCount = slots.length;
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';

        // ── 載入歷史狀態 ──
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev && prev.state && prev.state.completed) {
                // 恢復 chips 到 slots
                const order = prev.state.order || [];
                slots.forEach((slot, idx) => {
                    const val = order[idx];
                    if (val) {
                        const chip = sourcePool.querySelector(`.ordering-chip[data-value="${val}"]`) ||
                            Array.from(chips).find(c => c.dataset.value === val);
                        if (chip) {
                            slot.appendChild(chip);
                        }
                    }
                });

                // 鎖定所有 slot 為已完成
                slots.forEach(slot => {
                    slot.classList.add('correct', 'locked');
                    const chip = slot.querySelector('.ordering-chip');
                    if (chip) {
                        chip.classList.add('locked');
                        chip.setAttribute('draggable', 'false');
                    }
                });
                // 顯示已完成結果
                let resultEl = container.querySelector('.ordering-result');
                if (!resultEl) {
                    resultEl = document.createElement('div');
                    resultEl.className = 'ordering-result success';
                    container.appendChild(resultEl);
                }
                resultEl.innerHTML = '<span class="material-symbols-outlined">check_circle</span> 已完成 — 排列正確！';
                container.classList.add('all-correct');
                return; // 已完成，不再綁定拖曳事件
            }
        }

        // State
        let draggedChip = null;
        let originParent = null;   // where the chip came from
        let ghostEl = null;
        let pointerOffsetX = 0;
        let pointerOffsetY = 0;

        /* ── Utility: FLIP 動畫 ── */
        const flipAnimate = (el, duration = 320) => {
            const first = el.getBoundingClientRect();
            // force reflow to capture "last" position
            requestAnimationFrame(() => {
                const last = el.getBoundingClientRect();
                const dx = first.left - last.left;
                const dy = first.top - last.top;
                if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
                el.style.transition = 'none';
                el.style.transform = `translate(${dx}px, ${dy}px)`;
                requestAnimationFrame(() => {
                    el.style.transition = `transform ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
                    el.style.transform = '';
                    el.addEventListener('transitionend', function handler() {
                        el.style.transition = '';
                        el.removeEventListener('transitionend', handler);
                    });
                });
            });
        };

        /* ── Ghost 拖曳影像 ── */
        const createGhost = (chip, x, y) => {
            ghostEl = chip.cloneNode(true);
            ghostEl.className = 'ordering-ghost';
            ghostEl.style.width = chip.offsetWidth + 'px';
            document.body.appendChild(ghostEl);
            positionGhost(x, y);
        };

        const positionGhost = (x, y) => {
            if (!ghostEl) return;
            ghostEl.style.left = (x - pointerOffsetX) + 'px';
            ghostEl.style.top = (y - pointerOffsetY) + 'px';
        };

        const removeGhost = () => {
            if (ghostEl) { ghostEl.remove(); ghostEl = null; }
        };

        /* ── 高亮 drop target ── */
        const highlightTargets = (x, y) => {
            // 高亮 slots
            slots.forEach(s => {
                if (s.classList.contains('locked')) return;
                const r = s.getBoundingClientRect();
                const isOver = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
                s.classList.toggle('drag-over', isOver);
            });
            // 高亮 source pool（如果從 slot 拖回）
            if (originParent !== sourcePool) {
                const r = sourcePool.getBoundingClientRect();
                const isOver = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
                sourcePool.classList.toggle('drag-over-return', isOver);
            }
        };

        const clearHighlights = () => {
            slots.forEach(s => s.classList.remove('drag-over'));
            sourcePool.classList.remove('drag-over-return');
        };

        /* ── Hit test: 找被 drop 到的 slot 或 source ── */
        const getDropTarget = (x, y) => {
            // 檢查 slots
            for (const slot of slots) {
                if (slot.classList.contains('locked')) continue;
                const r = slot.getBoundingClientRect();
                if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { type: 'slot', el: slot };
            }
            // 檢查回到 source pool
            const r = sourcePool.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { type: 'source', el: sourcePool };
            return null;
        };

        /* ── 處理 drop ── */
        const handleDrop = (target) => {
            if (!draggedChip || !target) {
                returnChipToOrigin();
                return;
            }

            if (target.type === 'source') {
                // 退回 source pool
                const slot = draggedChip.closest('.ordering-slot');
                if (slot) {
                    slot.classList.remove('correct', 'incorrect');
                }
                sourcePool.appendChild(draggedChip);
                flipAnimate(draggedChip);
                clearResult(container);
                return;
            }

            if (target.type === 'slot') {
                const slot = target.el;
                // 如果 slot 有舊的 chip → 退回 source
                const existing = slot.querySelector('.ordering-chip');
                if (existing && existing !== draggedChip) {
                    sourcePool.appendChild(existing);
                    flipAnimate(existing);
                }
                // 如果 chip 原本在另一個 slot → 清掉那個 slot 的狀態
                const prevSlot = draggedChip.closest('.ordering-slot');
                if (prevSlot && prevSlot !== slot) {
                    prevSlot.classList.remove('correct', 'incorrect');
                }
                slot.appendChild(draggedChip);
                flipAnimate(draggedChip);

                // 個別 slot 即時回饋
                checkSlot(slot);

                // 檢查是否全懂做完
                checkCompletion();
            }
        };

        const returnChipToOrigin = () => {
            if (!draggedChip || !originParent) return;
            // 清除可能殘留的 slot 狀態
            if (originParent.classList.contains('ordering-slot')) {
                originParent.classList.remove('correct', 'incorrect');
            }
            originParent.appendChild(draggedChip);
            flipAnimate(draggedChip);
        };

        /* ── 個別 slot 檢查 ── */
        const checkSlot = (slot) => {
            const chip = slot.querySelector('.ordering-chip');
            if (!chip) return;
            const expected = slot.dataset.correctOrder;
            const actual = chip.dataset.value;

            if (actual === expected) {
                slot.classList.add('correct');
                slot.classList.remove('incorrect');
                // 鎖定正確的
                chip.setAttribute('draggable', 'false');
                chip.classList.add('locked');
                slot.classList.add('locked');
            } else {
                slot.classList.add('incorrect');
                slot.classList.remove('correct');
                // 錯誤後可點擊退回
                chip.classList.add('return-hint');
            }
        };

        /* ── 全局完成檢查 ── */
        const checkCompletion = () => {
            const filledSlots = slots.filter(s => s.querySelector('.ordering-chip'));
            if (filledSlots.length < totalCount) {
                clearResult(container);
                return;
            }

            const correctCount = slots.filter(s => s.classList.contains('correct')).length;
            const allCorrect = correctCount === totalCount;

            let resultEl = container.querySelector('.ordering-result');
            if (!resultEl) {
                resultEl = document.createElement('div');
                resultEl.className = 'ordering-result';
                container.appendChild(resultEl);
            }

            if (allCorrect) {
                resultEl.className = 'ordering-result success';
                resultEl.innerHTML = '<span class="material-symbols-outlined">check_circle</span> 排列正確！';
                container.classList.add('all-correct');

                // 成功粒子效果
                this.spawnConfetti(container);
                this.reportScore(container, totalCount, totalCount);
            } else {
                resultEl.className = 'ordering-result error';
                resultEl.innerHTML = `<span class="material-symbols-outlined">info</span> ${correctCount}/${totalCount} 正確 — 錯誤的可以拖回左邊重試`;
            }
        };

        const clearResult = (c) => {
            c.querySelector('.ordering-result')?.remove();
            c.classList.remove('all-correct');
        };

        /* ── 點擊退回（錯誤 chip） ── */
        container.addEventListener('click', (e) => {
            const chip = e.target.closest('.ordering-chip.return-hint');
            if (!chip) return;
            const slot = chip.closest('.ordering-slot');
            if (!slot) return;

            chip.classList.remove('return-hint');
            slot.classList.remove('incorrect');
            sourcePool.appendChild(chip);
            flipAnimate(chip);
            clearResult(container);
        });

        /* ========================================
           Pointer-based 拖曳（統一 mouse + touch）
           ======================================== */
        const enableDrag = (chip) => {
            // ── Native drag (desktop) ──
            chip.setAttribute('draggable', 'true');

            chip.addEventListener('dragstart', (e) => {
                if (chip.classList.contains('locked')) { e.preventDefault(); return; }
                draggedChip = chip;
                originParent = chip.parentElement;
                chip.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', chip.dataset.value);
                // 延遲隱藏原始 chip，讓 browser 截到拖曳影像
                requestAnimationFrame(() => chip.classList.add('drag-hidden'));
            });

            chip.addEventListener('dragend', () => {
                chip.classList.remove('dragging', 'drag-hidden');
                clearHighlights();
                draggedChip = null;
                originParent = null;
            });

            // ── Touch 拖曳 ──
            chip.addEventListener('touchstart', (e) => {
                if (chip.classList.contains('locked')) return;
                e.preventDefault();
                draggedChip = chip;
                originParent = chip.parentElement;
                chip.classList.add('dragging');

                const touch = e.touches[0];
                const rect = chip.getBoundingClientRect();
                pointerOffsetX = touch.clientX - rect.left;
                pointerOffsetY = touch.clientY - rect.top;
                createGhost(chip, touch.clientX, touch.clientY);
            }, { passive: false });

            chip.addEventListener('touchmove', (e) => {
                if (!draggedChip) return;
                e.preventDefault();
                const touch = e.touches[0];
                positionGhost(touch.clientX, touch.clientY);
                highlightTargets(touch.clientX, touch.clientY);
            }, { passive: false });

            chip.addEventListener('touchend', (e) => {
                if (!draggedChip) return;
                removeGhost();
                const touch = e.changedTouches[0];
                const target = getDropTarget(touch.clientX, touch.clientY);
                handleDrop(target);
                chip.classList.remove('dragging');
                clearHighlights();
                draggedChip = null;
                originParent = null;
            });
        };

        /* ── Slot drag events (desktop) ── */
        slots.forEach(slot => {
            slot.addEventListener('dragover', (e) => {
                if (slot.classList.contains('locked')) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                slot.classList.add('drag-over');
            });
            slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('drag-over');
                handleDrop({ type: 'slot', el: slot });
                if (draggedChip) {
                    draggedChip.classList.remove('dragging', 'drag-hidden');
                    draggedChip = null;
                    originParent = null;
                }
            });
        });

        /* ── Source pool drag events (desktop — 退回) ── */
        sourcePool.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            sourcePool.classList.add('drag-over-return');
        });
        sourcePool.addEventListener('dragleave', () => sourcePool.classList.remove('drag-over-return'));
        sourcePool.addEventListener('drop', (e) => {
            e.preventDefault();
            sourcePool.classList.remove('drag-over-return');
            handleDrop({ type: 'source', el: sourcePool });
            if (draggedChip) {
                draggedChip.classList.remove('dragging', 'drag-hidden');
                draggedChip = null;
                originParent = null;
            }
        });

        // 初始化所有 chip
        chips.forEach(chip => enableDrag(chip));

        // 監聽新 chip 進入 slot 後也要可拖
        const observer = new MutationObserver(() => {
            container.querySelectorAll('.ordering-chip:not(.locked)').forEach(c => {
                if (!c._dragBound) { enableDrag(c); c._dragBound = true; }
            });
        });
        observer.observe(container, { childList: true, subtree: true });
    }

    /* ====================================================
       Confetti 效果 (成功時)
       ==================================================== */
    spawnConfetti(container) {
        const colors = ['#4A7AE8', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6'];
        const rect = container.getBoundingClientRect();
        for (let i = 0; i < 30; i++) {
            const dot = document.createElement('div');
            dot.className = 'ordering-confetti';
            dot.style.setProperty('--x', `${(Math.random() - 0.5) * 200}px`);
            dot.style.setProperty('--y', `${-60 - Math.random() * 120}px`);
            dot.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
            dot.style.left = `${40 + Math.random() * 60}%`;
            dot.style.bottom = '60px';
            dot.style.background = colors[i % colors.length];
            dot.style.animationDelay = `${Math.random() * 0.3}s`;
            container.appendChild(dot);
            setTimeout(() => dot.remove(), 1200);
        }
    }

    /* ====================================================
       Reset
       ==================================================== */
    reset(container) {
        const sourcePool = container.querySelector('.ordering-source');
        const slots = container.querySelectorAll('.ordering-slot');

        slots.forEach(slot => {
            const chip = slot.querySelector('.ordering-chip');
            if (chip) {
                chip.classList.remove('locked', 'return-hint');
                chip.setAttribute('draggable', 'true');
                sourcePool.appendChild(chip);
            }
            slot.classList.remove('correct', 'incorrect', 'drag-over', 'locked');
        });

        container.querySelector('.ordering-result')?.remove();
        container.classList.remove('all-correct');
    }

    async reportScore(container, correct, total) {
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        // 取得當前排列順序
        const slots = container.querySelectorAll('.ordering-slot');
        const order = Array.from(slots).map(s => {
            const chip = s.querySelector('.ordering-chip');
            return chip ? chip.dataset.value : null;
        });

        await stateManager.save(elementId, {
            type: 'ordering',
            title: '排列順序',
            content: `${correct}/${total}`,
            isCorrect: correct === total,
            score: Math.round((correct / total) * 100),
            state: { completed: true, order, correct, total },
        });
        // 排列順序成績已回報
    }
}
