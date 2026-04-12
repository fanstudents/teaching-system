/**
 * 圖片標註互動模組 — 區域標註 + 熱點圖版
 * 學員在圖片上點選放置圓形區域 → 可調整半徑 → 送出
 * 講師端即時顯示 Canvas 熱點圖（密度越高顏色越暖）
 */
import { stateManager } from './stateManager.js';
import { db, realtime } from '../supabase.js';

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
        const isPresenter = !!container.closest('.presentation-slide');
        const isBroadcasting = !!window.app?.broadcasting;

        // 解析正確區域（講師可選設定）
        let correctZone = null;
        try { correctZone = JSON.parse(container.dataset.correctZone || 'null'); } catch { }

        if (isPresenter && isBroadcasting) {
            this.setupPresenterView(container, elementId, correctZone);
        } else {
            this.setupStudentView(container, elementId, correctZone);
        }
    }

    /* ═══════════════════════════════════════════
       學員端：點擊放置圓 → 調整半徑 → 送出
       ═══════════════════════════════════════════ */
    async setupStudentView(container, elementId, correctZone) {
        const imageWrap = container.querySelector('.hotspot-image-wrap');
        if (!imageWrap) return;

        const resultEl = container.querySelector('.hotspot-result');
        const submitBtn = container.querySelector('.hs-submit-btn');
        const sliderWrap = container.querySelector('.hs-radius-wrap');
        const radiusSlider = container.querySelector('.hs-radius-slider');
        const radiusLabel = container.querySelector('.hs-radius-label');
        let submitted = false;
        let annotation = null; // { cx, cy, r } 皆為圖片百分比

        const MIN_R = 2;
        const MAX_R = 18;
        const DEFAULT_R = 7;

        // SVG overlay 用於畫圓
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.classList.add('hs-marker-svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        imageWrap.appendChild(svg);

        // 重新作答按鈕
        const resetBtn = document.createElement('button');
        resetBtn.className = 'interactive-reset-btn';
        resetBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>重新標註';
        container.style.position = 'relative';
        container.appendChild(resetBtn);

        // 初始化滑桿
        if (radiusSlider) {
            radiusSlider.min = MIN_R;
            radiusSlider.max = MAX_R;
            radiusSlider.value = DEFAULT_R;
            radiusSlider.step = 0.5;
        }

        const drawAnnotation = () => {
            svg.innerHTML = '';
            if (!annotation) return;

            // 外圈 glow
            const glow = document.createElementNS(svgNS, 'circle');
            glow.setAttribute('cx', annotation.cx);
            glow.setAttribute('cy', annotation.cy);
            glow.setAttribute('r', annotation.r);
            glow.classList.add('hs-circle-glow');
            svg.appendChild(glow);

            // 主圓
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', annotation.cx);
            circle.setAttribute('cy', annotation.cy);
            circle.setAttribute('r', annotation.r);
            circle.classList.add('hs-circle-main');
            if (submitted) circle.classList.add('submitted');
            svg.appendChild(circle);

            // 中心十字
            const armLen = Math.max(1, annotation.r * 0.3);
            const cx = annotation.cx, cy = annotation.cy;
            const cross = document.createElementNS(svgNS, 'g');
            cross.classList.add('hs-crosshair');
            const h = document.createElementNS(svgNS, 'line');
            h.setAttribute('x1', cx - armLen); h.setAttribute('y1', cy);
            h.setAttribute('x2', cx + armLen); h.setAttribute('y2', cy);
            const v = document.createElementNS(svgNS, 'line');
            v.setAttribute('x1', cx); v.setAttribute('y1', cy - armLen);
            v.setAttribute('x2', cx); v.setAttribute('y2', cy + armLen);
            cross.appendChild(h);
            cross.appendChild(v);
            svg.appendChild(cross);
        };

        const updateUI = () => {
            if (submitBtn) submitBtn.disabled = !annotation || submitted;
            if (radiusLabel && annotation) radiusLabel.textContent = `範圍 ${annotation.r}%`;
        };

        // 點擊放置
        imageWrap.addEventListener('click', (e) => {
            if (submitted) return;
            if (e.target.closest('.hs-radius-wrap') || e.target.closest('.hs-submit-btn')) return;
            const rect = imageWrap.getBoundingClientRect();
            const cx = ((e.clientX - rect.left) / rect.width) * 100;
            const cy = ((e.clientY - rect.top) / rect.height) * 100;
            const r = radiusSlider ? parseFloat(radiusSlider.value) : DEFAULT_R;
            annotation = { cx: Math.round(cx * 10) / 10, cy: Math.round(cy * 10) / 10, r };
            drawAnnotation();
            updateUI();
            if (sliderWrap) sliderWrap.style.display = '';
        });

        // 半徑調整
        if (radiusSlider) {
            radiusSlider.addEventListener('input', () => {
                if (!annotation || submitted) return;
                annotation.r = parseFloat(radiusSlider.value);
                drawAnnotation();
                updateUI();
            });
        }

        // 載入歷史
        if (elementId) {
            const prev = await stateManager.load(elementId);
            if (prev?.state?.annotation) {
                annotation = prev.state.annotation;
                submitted = true;
                drawAnnotation();
                updateUI();
                if (submitBtn) submitBtn.style.display = 'none';
                if (sliderWrap) sliderWrap.style.display = 'none';
                this._showResult(resultEl, annotation, correctZone);
                resetBtn.classList.add('visible');
            }
        }

        // 送出
        submitBtn?.addEventListener('click', async () => {
            if (submitted || !annotation) return;
            submitted = true;
            drawAnnotation();
            updateUI();
            if (submitBtn) submitBtn.style.display = 'none';
            if (sliderWrap) sliderWrap.style.display = 'none';

            const title = container.querySelector('.hotspot-question')?.textContent || '圖片標註';
            const points = parseInt(container.closest('[data-points]')?.dataset.points) || 5;

            let isCorrect = null;
            let score = 100;
            if (correctZone) {
                const overlap = this._calcOverlap(annotation, correctZone);
                score = Math.round(overlap * 100);
                isCorrect = overlap > 0.4;
            }

            const _r = await stateManager.save(elementId, {
                type: 'hotspot', title,
                content: `(${annotation.cx}%, ${annotation.cy}%) r=${annotation.r}%`,
                isCorrect,
                score,
                points: correctZone ? points : 1,
                participated: true,
                state: { annotation },
            });
            if (_r?.isRetry) stateManager.showRetryBanner(container);
            this._showResult(resultEl, annotation, correctZone);
            resetBtn.classList.add('visible');
        });

        // 重新作答
        resetBtn.addEventListener('click', async () => {
            submitted = false;
            annotation = null;
            drawAnnotation();
            updateUI();
            if (submitBtn) { submitBtn.style.display = ''; submitBtn.disabled = true; }
            if (sliderWrap) sliderWrap.style.display = 'none';
            if (resultEl) { resultEl.className = 'hotspot-result'; resultEl.innerHTML = ''; }
            resetBtn.classList.remove('visible');
            if (elementId) await stateManager.clear(elementId);
        });
    }

    /* ═══════════════════════════════════════════
       講師端：Canvas 熱點圖
       ═══════════════════════════════════════════ */
    async setupPresenterView(container, elementId, correctZone) {
        const imageWrap = container.querySelector('.hotspot-image-wrap');
        if (!imageWrap) return;

        // 隱藏學員 UI
        const submitBtn = container.querySelector('.hs-submit-btn');
        const sliderWrap = container.querySelector('.hs-radius-wrap');
        if (submitBtn) submitBtn.style.display = 'none';
        if (sliderWrap) sliderWrap.style.display = 'none';

        // Canvas 覆蓋層
        const canvas = document.createElement('canvas');
        canvas.className = 'hs-heatmap-canvas';
        // 解析度：越高越精細但越慢。200x150 對 50+ 人足夠
        canvas.width = 200;
        canvas.height = 150;
        imageWrap.appendChild(canvas);

        // 統計顯示
        const countEl = container.querySelector('.hs-count') || (() => {
            const el = document.createElement('div');
            el.className = 'hs-count';
            const actions = container.querySelector('.hotspot-actions');
            if (actions) actions.replaceWith(el);
            else container.appendChild(el);
            return el;
        })();
        countEl.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">group</span> 等待學員標註...';

        // 圖例
        const legend = document.createElement('div');
        legend.className = 'hs-heatmap-legend';
        legend.innerHTML = `
            <div class="hs-legend-bar"></div>
            <div class="hs-legend-labels"><span>少</span><span>多</span></div>
        `;
        container.appendChild(legend);

        let submissions = [];
        const sessionCode = window.app?.sessionCode;

        const fetchAndRender = async () => {
            try {
                const filter = { element_id: `eq.${elementId}` };
                if (sessionCode) filter.session_id = `eq.${sessionCode}`;

                const { data } = await db.select('submissions', {
                    filter,
                    order: 'submitted_at.asc'
                });

                if (data) {
                    submissions = data.map(row => {
                        let state = row.state;
                        if (typeof state === 'string') { try { state = JSON.parse(state); } catch { state = {}; } }
                        return { name: row.student_name, annotation: state?.annotation };
                    }).filter(s => s.annotation);

                    this._renderHeatmap(canvas, submissions);
                    countEl.innerHTML = submissions.length > 0
                        ? `<span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">group</span> ${submissions.length} 人已標註`
                        : '<span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">group</span> 等待學員標註...';
                }
            } catch (e) {
                console.warn('[Hotspot] fetch error:', e);
            }
        };

        await fetchAndRender();
        const timer = setInterval(fetchAndRender, 4000);

        // 即時推送
        if (sessionCode && realtime?.on) {
            realtime.on('submission_saved', (msg) => {
                const p = msg.payload || msg;
                if (p.element_id === elementId) fetchAndRender();
            });
        }

        // 清理
        container._hsCleanup = () => clearInterval(timer);
    }

    /* ═══════════════════════════════════════════
       Canvas 熱點圖繪製
       ═══════════════════════════════════════════ */
    _renderHeatmap(canvas, submissions) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (submissions.length === 0) return;

        // 建立密度格點
        const grid = new Float32Array(w * h);
        let maxDensity = 0;

        for (const sub of submissions) {
            const a = sub.annotation;
            if (!a) continue;

            // 百分比 → pixel
            const cx = (a.cx / 100) * w;
            const cy = (a.cy / 100) * h;
            const rx = (a.r / 100) * w;
            const ry = (a.r / 100) * h;

            // 只遍歷 bounding box
            const x0 = Math.max(0, Math.floor(cx - rx));
            const x1 = Math.min(w - 1, Math.ceil(cx + rx));
            const y0 = Math.max(0, Math.floor(cy - ry));
            const y1 = Math.min(h - 1, Math.ceil(cy + ry));

            for (let py = y0; py <= y1; py++) {
                for (let px = x0; px <= x1; px++) {
                    const dx = (px - cx) / rx;
                    const dy = (py - cy) / ry;
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= 1) {
                        // 高斯式權重：中心 1.0，邊緣 0.3
                        const weight = 1 - distSq * 0.7;
                        const idx = py * w + px;
                        grid[idx] += weight;
                        if (grid[idx] > maxDensity) maxDensity = grid[idx];
                    }
                }
            }
        }

        if (maxDensity === 0) return;

        // 繪製熱點圖
        const imageData = ctx.createImageData(w, h);
        for (let i = 0; i < grid.length; i++) {
            const val = grid[i] / maxDensity;
            if (val < 0.01) continue;

            const [r, g, b, a] = this._heatColor(val);
            const idx = i * 4;
            imageData.data[idx] = r;
            imageData.data[idx + 1] = g;
            imageData.data[idx + 2] = b;
            imageData.data[idx + 3] = a;
        }
        ctx.putImageData(imageData, 0, 0);

        // 繪製密度峰值標籤（前 3 名最熱區域）
        this._drawPeakLabels(ctx, grid, w, h, maxDensity, submissions.length);
    }

    /**
     * 在最熱區域顯示人數標籤
     */
    _drawPeakLabels(ctx, grid, w, h, maxDensity, totalCount) {
        // 找峰值（降低解析度避免太密）
        const blockSize = 12;
        const peaks = [];
        for (let by = 0; by < h; by += blockSize) {
            for (let bx = 0; bx < w; bx += blockSize) {
                let sum = 0, count = 0;
                for (let dy = 0; dy < blockSize && by + dy < h; dy++) {
                    for (let dx = 0; dx < blockSize && bx + dx < w; dx++) {
                        sum += grid[(by + dy) * w + (bx + dx)];
                        count++;
                    }
                }
                const avg = sum / count;
                if (avg > maxDensity * 0.5) {
                    peaks.push({ x: bx + blockSize / 2, y: by + blockSize / 2, density: avg });
                }
            }
        }

        // 按密度排序取前 3
        peaks.sort((a, b) => b.density - a.density);
        const topPeaks = [];
        for (const p of peaks) {
            // 確保峰值不太接近已有的
            const tooClose = topPeaks.some(t => Math.hypot(t.x - p.x, t.y - p.y) < blockSize * 2);
            if (!tooClose) topPeaks.push(p);
            if (topPeaks.length >= 3) break;
        }

        // 繪製標籤
        ctx.font = 'bold 10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const p of topPeaks) {
            const approxCount = Math.round((p.density / maxDensity) * totalCount);
            if (approxCount < 2) continue;

            // 背景圓
            ctx.beginPath();
            ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 數字
            ctx.fillStyle = '#1e293b';
            ctx.fillText(approxCount, p.x, p.y);
        }
    }

    /* ═══════════════════════════════════════════
       熱點圖色彩映射
       ═══════════════════════════════════════════ */
    _heatColor(val) {
        // val: 0~1 → 透明藍 → 青 → 綠 → 黃 → 紅
        const alpha = Math.min(220, Math.round(val * 180 + 40));

        if (val < 0.2) {
            const t = val / 0.2;
            return [60, 60 + Math.round(t * 160), 255, alpha];
        } else if (val < 0.4) {
            const t = (val - 0.2) / 0.2;
            return [0, 220 + Math.round(t * 35), Math.round(255 * (1 - t)), alpha];
        } else if (val < 0.6) {
            const t = (val - 0.4) / 0.2;
            return [Math.round(t * 180), 255, 0, alpha];
        } else if (val < 0.8) {
            const t = (val - 0.6) / 0.2;
            return [180 + Math.round(t * 75), Math.round(255 * (1 - t * 0.5)), 0, alpha];
        } else {
            const t = (val - 0.8) / 0.2;
            return [255, Math.round(128 * (1 - t)), 0, alpha];
        }
    }

    /* ═══════════════════════════════════════════
       工具函式
       ═══════════════════════════════════════════ */
    _showResult(resultEl, annotation, correctZone) {
        if (!resultEl) return;
        if (!correctZone) {
            resultEl.className = 'hotspot-result success';
            resultEl.innerHTML = '<span class="material-symbols-outlined">check_circle</span> 已提交標註';
            return;
        }
        const overlap = this._calcOverlap(annotation, correctZone);
        if (overlap > 0.4) {
            resultEl.className = 'hotspot-result success';
            resultEl.innerHTML = '<span class="material-symbols-outlined">check_circle</span> 標註準確！';
        } else {
            resultEl.className = 'hotspot-result error';
            resultEl.innerHTML = `<span class="material-symbols-outlined">info</span> 準確度 ${Math.round(overlap * 100)}%`;
        }
    }

    /**
     * 計算兩圓重疊比 (intersection / union)
     */
    _calcOverlap(a, b) {
        const d = Math.sqrt((a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2);
        const r1 = a.r, r2 = b.r;
        if (d >= r1 + r2) return 0;
        if (d + r1 <= r2) return (r1 * r1) / (r2 * r2);
        if (d + r2 <= r1) return (r2 * r2) / (r1 * r1);

        const p1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
        const p2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
        const p3 = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
        const intersection = p1 + p2 - p3;
        const union = Math.PI * r1 * r1 + Math.PI * r2 * r2 - intersection;
        return intersection / union;
    }
}
