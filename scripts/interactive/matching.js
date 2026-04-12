/**
 * 連連看互動模組 — 拖曳拉線版（含狀態持久化）
 */
import { stateManager } from './stateManager.js';

export class MatchingGame {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        document.querySelectorAll('.matching-container').forEach(c => this.setupContainer(c));
    }

    async setupContainer(container) {
        const leftItems = container.querySelectorAll('.left-column .matching-item');
        const rightItems = container.querySelectorAll('.right-column .matching-item');
        const svg = container.querySelector('.matching-lines');
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';

        // 清除之前的連線 & 狀態
        svg.innerHTML = '';
        leftItems.forEach(i => i.classList.remove('selected', 'correct', 'incorrect', 'dragging'));
        rightItems.forEach(i => i.classList.remove('correct', 'incorrect', 'drop-target'));

        // ── 載入歷史狀態 ──
        if (elementId) {
            try {
                const prev = await stateManager.load(elementId);
                if (prev && prev.state && prev.state.completed) {
                    // 恢復線並標記為已完成
                    leftItems.forEach(li => {
                        const leftText = li.textContent.trim().replace(/\s+/g, ' ');
                        const matchId = li.dataset.matchId;
                        let targetRi = null;

                        rightItems.forEach(ri => {
                            const targetId = ri.dataset.matchId;
                            if (matchId && targetId) {
                                if (matchId === targetId) targetRi = ri;
                            } else {
                                const answer = ri.dataset.answer;
                                if (leftText.includes(answer) || (answer && answer.includes(leftText.split('\n')[0].trim()))) {
                                    targetRi = ri;
                                }
                            }
                        });

                        if (targetRi) {
                            li.classList.add('correct');
                            targetRi.classList.add('correct');
                            // 確保 DOM paint 之後才畫線，以取得正確座標
                            setTimeout(() => {
                                try { this.drawLine(svg, li, targetRi, true); } catch (e) { }
                            }, 50);
                        }
                    });

                    // 顯示已完成結果
                    let resultEl = container.querySelector('.matching-result');
                    if (!resultEl) {
                        resultEl = document.createElement('div');
                        resultEl.className = 'matching-result';
                        container.appendChild(resultEl);
                    }
                    resultEl.innerHTML = `<span style="color:#22c55e;font-weight:600;">✓ 已完成 — ${prev.content || ''}</span>`;
                    return; // 已完成，不再綁定拖曳事件
                }
            } catch (e) {
                console.warn('[matching] load history failed:', e);
            }
        }

        // ── ★ 手機版：偵測 scale 容器，改用全螢幕 overlay ──
        const isMobileScaled = (() => {
            if (window.innerWidth > 1024) return false;
            const slide = container.closest('.student-slide');
            if (!slide) return false;
            const t = slide.style.transform || '';
            const m = t.match(/scale\(([^)]+)\)/);
            return m && parseFloat(m[1]) < 0.9;
        })();

        if (isMobileScaled) {
            this._setupMobileOverlay(container, leftItems, rightItems, svg, elementId);
            return; // 手機版用 overlay，不走下面的原始拖曳邏輯
        }

        // ── 注入 SVG 箭頭 marker ──
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 4 L 0 8 Z" fill="#4A7AE8"/>
            </marker>
            <marker id="arrowhead-correct" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 4 L 0 8 Z" fill="#22c55e"/>
            </marker>
            <marker id="arrowhead-incorrect" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 4 L 0 8 Z" fill="#ef4444"/>
            </marker>
            <marker id="arrowhead-drawing" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 4 L 0 8 Z" fill="#4A7AE8" opacity="0.7"/>
            </marker>
        `;
        svg.appendChild(defs);

        // ── 拖曳拉線邏輯 ──

        let dragging = false;
        let dragSource = null;
        let tempLine = null;
        let startPt = null;

        /** 螢幕座標 → SVG 內部座標 */
        const screenToSVG = (screenX, screenY) => {
            const ctm = svg.getScreenCTM();
            if (ctm) {
                const inv = ctm.inverse();
                const pt = new DOMPoint(screenX, screenY).matrixTransform(inv);
                return { x: pt.x, y: pt.y };
            }
            const r = svg.getBoundingClientRect();
            return { x: screenX - r.left, y: screenY - r.top };
        };

        /** 取得 dot 圓點中心座標（吸附到 dot） */
        const getAnchor = (el, side) => {
            const dot = el.querySelector(`.matching-dot.${side === 'right' ? 'left' : 'right'}`);
            if (dot) {
                const dotRect = dot.getBoundingClientRect();
                return screenToSVG(dotRect.left + dotRect.width / 2, dotRect.top + dotRect.height / 2);
            }
            // fallback
            const r = el.getBoundingClientRect();
            if (side === 'right') {
                return screenToSVG(r.right, r.top + r.height / 2);
            }
            return screenToSVG(r.left, r.top + r.height / 2);
        };

        /** 取得右側 item 的左 dot 中心座標（線頭吸附點）*/
        const getRightDotAnchor = (el) => {
            const dot = el.querySelector('.matching-dot.right');
            if (dot) {
                const dotRect = dot.getBoundingClientRect();
                return screenToSVG(dotRect.left + dotRect.width / 2, dotRect.top + dotRect.height / 2);
            }
            const r = el.getBoundingClientRect();
            return screenToSVG(r.left, r.top + r.height / 2);
        };

        /** 建立/更新貝茲線 path */
        const buildPath = (x1, y1, x2, y2) => {
            const cp1x = x1 + (x2 - x1) * 0.4;
            const cp2x = x1 + (x2 - x1) * 0.6;
            return `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
        };

        // ── Pointer Down（左側 item / dot） ──
        const onPointerDown = (e, item) => {
            // 只處理左鍵或觸控
            if (e.button && e.button !== 0) return;
            // 已配對過的不能再拖
            if (item.classList.contains('correct')) return;

            e.preventDefault();
            e.stopPropagation();

            dragging = true;
            dragSource = item;
            item.classList.add('selected', 'dragging');

            // 右側顯示可放區域提示
            rightItems.forEach(ri => {
                if (!ri.classList.contains('correct')) ri.classList.add('drop-target');
            });

            // 起點
            startPt = getAnchor(item, 'right');

            // 建立暫時線（帶箭頭）
            tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempLine.classList.add('matching-line', 'drawing');
            tempLine.setAttribute('marker-end', 'url(#arrowhead-drawing)');
            tempLine.setAttribute('d', buildPath(startPt.x, startPt.y, startPt.x, startPt.y));
            svg.appendChild(tempLine);
        };

        // 每個左側 item 綁定
        leftItems.forEach(item => {
            // mouse
            item.addEventListener('mousedown', e => onPointerDown(e, item));
            // touch
            item.addEventListener('touchstart', e => onPointerDown(e, item), { passive: false });
        });

        // ── Pointer Move（全域） ──
        const onPointerMove = (e) => {
            if (!dragging || !tempLine) return;
            e.preventDefault();

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            // 檢查是否懸停在右側 item 上 → 吸附到 dot
            let snapped = false;
            rightItems.forEach(ri => {
                const r = ri.getBoundingClientRect();
                const isOver = clientX >= r.left && clientX <= r.right &&
                    clientY >= r.top && clientY <= r.bottom;
                ri.classList.toggle('hovering', isOver && !ri.classList.contains('correct'));

                if (isOver && !ri.classList.contains('correct') && !snapped) {
                    // 吸附到右側 dot 中心
                    const snapPt = getRightDotAnchor(ri);
                    tempLine.setAttribute('d', buildPath(startPt.x, startPt.y, snapPt.x, snapPt.y));
                    snapped = true;
                }
            });

            if (!snapped) {
                const cur = screenToSVG(clientX, clientY);
                tempLine.setAttribute('d', buildPath(startPt.x, startPt.y, cur.x, cur.y));
            }
        };

        container.addEventListener('mousemove', onPointerMove);
        container.addEventListener('touchmove', onPointerMove, { passive: false });

        // ── Pointer Up（全域） ──
        const onPointerUp = (e) => {
            if (!dragging) return;

            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

            // 找到放下位置的右側 item
            let hitTarget = null;
            rightItems.forEach(ri => {
                const r = ri.getBoundingClientRect();
                if (clientX >= r.left && clientX <= r.right &&
                    clientY >= r.top && clientY <= r.bottom) {
                    hitTarget = ri;
                }
            });

            // 清除暫時線
            if (tempLine) tempLine.remove();
            tempLine = null;

            // 清除 UI 狀態
            dragSource.classList.remove('selected', 'dragging');
            rightItems.forEach(ri => ri.classList.remove('drop-target', 'hovering'));

            // 如果有命中右側 item → 判斷配對
            if (hitTarget && !hitTarget.classList.contains('correct')) {
                const leftText = dragSource.textContent.trim().replace(/\s+/g, ' ');
                const matchId = dragSource.dataset.matchId;
                const targetId = hitTarget.dataset.matchId;

                // 判斷配對正確性
                let isCorrect = false;
                if (matchId && targetId) {
                    isCorrect = matchId === targetId;
                } else {
                    const answer = hitTarget.dataset.answer;
                    isCorrect = leftText.includes(answer) ||
                        (answer && answer.includes(leftText.split('\n')[0].trim()));
                }

                // 繪製最終連線
                const endPt = getAnchor(hitTarget, 'left');
                const finalLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                finalLine.classList.add('matching-line');
                finalLine.setAttribute('d', buildPath(
                    getAnchor(dragSource, 'right').x,
                    getAnchor(dragSource, 'right').y,
                    endPt.x,
                    endPt.y
                ));

                if (isCorrect) {
                    finalLine.classList.add('correct');
                    dragSource.classList.add('correct');
                    hitTarget.classList.add('correct');

                    // 正確配對動畫
                    dragSource.style.animation = 'none';
                    dragSource.offsetHeight; // reflow
                    dragSource.style.animation = '';

                    svg.appendChild(finalLine);

                    // 檢查是否全部配對完成
                    const total = leftItems.length;
                    const done = container.querySelectorAll('.left-column .matching-item.correct').length;
                    if (done === total) {
                        // 計算配對資料
                        const pairs = {};
                        leftItems.forEach((li, idx) => {
                            if (li.dataset.matchId) pairs[li.dataset.matchId] = 'correct';
                        });
                        this.reportScore(container, done, total, pairs);
                    }
                } else {
                    finalLine.classList.add('incorrect');
                    dragSource.classList.add('incorrect');
                    hitTarget.classList.add('incorrect');
                    svg.appendChild(finalLine);

                    // 保存參照（避免外部變數在 timeout 前被 null）
                    const srcRef = dragSource;
                    const tgtRef = hitTarget;

                    // 錯誤閃爍後移除，讓使用者可以重新連線
                    setTimeout(() => {
                        srcRef.classList.remove('incorrect');
                        tgtRef.classList.remove('incorrect');
                        finalLine.remove();
                    }, 800);
                }
            }

            dragging = false;
            dragSource = null;
            startPt = null;
        };

        container.addEventListener('mouseup', onPointerUp);
        container.addEventListener('touchend', onPointerUp);

        // 如果拖到 container 外面放開 → 取消
        container.addEventListener('mouseleave', () => {
            if (dragging) {
                if (tempLine) tempLine.remove();
                tempLine = null;
                dragSource?.classList.remove('selected', 'dragging');
                rightItems.forEach(ri => ri.classList.remove('drop-target', 'hovering'));
                dragging = false;
                dragSource = null;
                startPt = null;
            }
        });
    }

    drawLine(svg, from, to, isCorrect) {
        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();

        let fromX, fromY, toX, toY;

        const ctm = svg.getScreenCTM();
        if (ctm) {
            const inv = ctm.inverse();
            const fromPt = new DOMPoint(fromRect.right, fromRect.top + fromRect.height / 2).matrixTransform(inv);
            const toPt = new DOMPoint(toRect.left, toRect.top + toRect.height / 2).matrixTransform(inv);
            fromX = fromPt.x; fromY = fromPt.y;
            toX = toPt.x; toY = toPt.y;
        } else {
            const svgRect = svg.getBoundingClientRect();
            fromX = fromRect.right - svgRect.left;
            fromY = fromRect.top + fromRect.height / 2 - svgRect.top;
            toX = toRect.left - svgRect.left;
            toY = toRect.top + toRect.height / 2 - svgRect.top;
        }

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const cp1x = fromX + (toX - fromX) * 0.4;
        const cp2x = fromX + (toX - fromX) * 0.6;
        line.setAttribute('d', `M ${fromX} ${fromY} C ${cp1x} ${fromY}, ${cp2x} ${toY}, ${toX} ${toY}`);
        line.classList.add('matching-line');
        line.classList.add(isCorrect ? 'correct' : 'incorrect');
        svg.appendChild(line);
        return line;
    }

    reset(container) {
        container.querySelectorAll('.matching-item').forEach(item => {
            item.classList.remove('selected', 'correct', 'incorrect', 'dragging');
        });
        const svg = container.querySelector('.matching-lines');
        if (svg) svg.innerHTML = '';
    }

    async reportScore(container, correct, total, pairs = {}) {
        const elementId = container.closest('[data-id]')?.dataset.id || container.dataset.elementId || '';
        const points = parseInt(container.closest('[data-points]')?.dataset.points) || 10;
        const _r = await stateManager.save(elementId, {
            type: 'matching',
            title: '連連看',
            content: `${correct}/${total}`,
            isCorrect: correct === total,
            score: Math.round((correct / total) * 100),
            points,
            state: { completed: true, pairs, correct, total },
        });
        if (_r?.isRetry) stateManager.showRetryBanner(container);
    }

    /**
     * ★ 手機版全螢幕 overlay — 繞過 scale 容器
     */
    _setupMobileOverlay(origContainer, leftItems, rightItems, svg, elementId) {
        // 在原容器中顯示啟動按鈕
        const launcher = document.createElement('div');
        launcher.className = 'matching-mobile-launcher';
        launcher.innerHTML = `
            <button class="matching-mobile-launch-btn">
                <span class="material-symbols-outlined" style="font-size:20px;">fullscreen</span>
                開始配對
            </button>
        `;
        launcher.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);border-radius:12px;z-index:10;';
        launcher.querySelector('button').style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 24px;border:none;border-radius:12px;background:linear-gradient(135deg,#4A7AE8,#3b5fc0);color:#fff;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(74,122,232,0.4);font-family:inherit;';
        origContainer.style.position = 'relative';
        origContainer.appendChild(launcher);

        launcher.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            this._openMatchingOverlay(origContainer, elementId);
        });
    }

    _openMatchingOverlay(origContainer, elementId) {
        // 建立全螢幕 overlay
        const overlay = document.createElement('div');
        overlay.className = 'matching-mobile-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#0f172a;display:flex;flex-direction:column;overflow:hidden;';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(30,41,59,0.95);border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0;';
        header.innerHTML = `
            <div style="font-size:15px;font-weight:600;color:#f1f5f9;">🔗 連連看</div>
            <button class="matching-overlay-close" style="display:flex;align-items:center;gap:4px;padding:6px 14px;border:1px solid #475569;border-radius:8px;background:transparent;color:#94a3b8;font-size:13px;cursor:pointer;font-family:inherit;">
                <span class="material-symbols-outlined" style="font-size:16px;">close</span>關閉
            </button>
        `;
        overlay.appendChild(header);

        // Body：clone 原容器的內容
        const body = document.createElement('div');
        body.style.cssText = 'flex:1;overflow:auto;padding:16px;display:flex;align-items:center;justify-content:center;';

        // 建立新的 matching container（不受 scale 影響）
        const newContainer = origContainer.cloneNode(true);
        // 移除 launcher
        newContainer.querySelector('.matching-mobile-launcher')?.remove();
        // 移除舊的結果顯示
        newContainer.querySelector('.matching-result')?.remove();
        // 重設尺寸
        newContainer.style.cssText = 'width:100%;max-width:600px;height:auto;min-height:300px;position:relative;background:#f8f9fa;border-radius:12px;padding:20px;border:1px solid #dadce0;';

        body.appendChild(newContainer);
        overlay.appendChild(body);
        document.body.appendChild(overlay);

        // 用新容器重新 setupContainer（此時不在 scale 容器中）
        requestAnimationFrame(() => {
            this.setupContainer(newContainer);
        });

        // 監聽完成事件：用 MutationObserver 偵測 .matching-result 出現
        const resultObserver = new MutationObserver(() => {
            const result = newContainer.querySelector('.matching-result');
            if (result && result.textContent.includes('已完成')) {
                // 完成了！延遲後關閉 overlay
                setTimeout(() => {
                    overlay.remove();
                    // 重新載入原容器的狀態（顯示完成結果）
                    this.setupContainer(origContainer);
                }, 1500);
                resultObserver.disconnect();
            }
        });
        resultObserver.observe(newContainer, { childList: true, subtree: true });

        // 關閉按鈕
        header.querySelector('.matching-overlay-close').addEventListener('click', () => {
            overlay.remove();
            resultObserver.disconnect();
        });
    }
}
