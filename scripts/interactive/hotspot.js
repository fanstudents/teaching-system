/**
 * 圖片標註互動模組 — 區域標註 + 熱點圖版 v2
 * 學員：游標跟隨預覽圓 → 點擊放置 → 滾輪/滑桿調整半徑 → 送出
 * 講師：Canvas 熱點圖 + hover tooltip（不再顯示峰值數字）
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

        let correctZone = null;
        try { correctZone = JSON.parse(container.dataset.correctZone || 'null'); } catch { }

        if (isPresenter && isBroadcasting) {
            this.setupPresenterView(container, elementId, correctZone);
        } else {
            this.setupStudentView(container, elementId, correctZone);
        }
    }

    /* ═══════════════════════════════════════════
       學員端：游標跟隨 → 點擊放置 → 調整 → 送出
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
        let annotation = null; // { cx, cy, r } percentage
        let placed = false;    // 已放置

        const MIN_R = 2, MAX_R = 18, DEFAULT_R = 7;
        const svgNS = 'http://www.w3.org/2000/svg';

        // SVG overlay
        const svg = document.createElementNS(svgNS, 'svg');
        svg.classList.add('hs-marker-svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        imageWrap.appendChild(svg);

        // 重新作答
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

        // ── 手機引導提示 ──
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const hintEl = document.createElement('div');
        hintEl.className = 'hs-tap-hint';
        hintEl.innerHTML = `
            <span class="material-symbols-outlined hs-tap-hint-icon">touch_app</span>
            <span>點擊圖片上你要標註的位置</span>
        `;
        imageWrap.appendChild(hintEl);

        // ── 游標跟隨預覽圈（桌面版） ──
        let previewGroup = null;
        let currentR = DEFAULT_R;

        if (!isMobile) {
            previewGroup = document.createElementNS(svgNS, 'g');
            previewGroup.classList.add('hs-preview-group');
            previewGroup.style.opacity = '0';

            const previewGlow = document.createElementNS(svgNS, 'circle');
            previewGlow.classList.add('hs-preview-glow');
            previewGlow.setAttribute('r', currentR);
            previewGroup.appendChild(previewGlow);

            const previewCircle = document.createElementNS(svgNS, 'circle');
            previewCircle.classList.add('hs-preview-circle');
            previewCircle.setAttribute('r', currentR);
            previewGroup.appendChild(previewCircle);

            // 準心
            const armLen = Math.max(1, currentR * 0.35);
            const crossH = document.createElementNS(svgNS, 'line');
            crossH.classList.add('hs-preview-cross');
            const crossV = document.createElementNS(svgNS, 'line');
            crossV.classList.add('hs-preview-cross');
            previewGroup._crossH = crossH;
            previewGroup._crossV = crossV;
            previewGroup.appendChild(crossH);
            previewGroup.appendChild(crossV);
            svg.appendChild(previewGroup);

            const updatePreviewPos = (cx, cy) => {
                previewGlow.setAttribute('cx', cx);
                previewGlow.setAttribute('cy', cy);
                previewCircle.setAttribute('cx', cx);
                previewCircle.setAttribute('cy', cy);
                const arm = Math.max(1, currentR * 0.35);
                crossH.setAttribute('x1', cx - arm); crossH.setAttribute('y1', cy);
                crossH.setAttribute('x2', cx + arm); crossH.setAttribute('y2', cy);
                crossV.setAttribute('x1', cx); crossV.setAttribute('y1', cy - arm);
                crossV.setAttribute('x2', cx); crossV.setAttribute('y2', cy + arm);
            };

            const updatePreviewR = (r) => {
                currentR = r;
                previewGlow.setAttribute('r', r);
                previewCircle.setAttribute('r', r);
            };

            imageWrap.addEventListener('mousemove', (e) => {
                if (submitted || placed) return;
                const rect = imageWrap.getBoundingClientRect();
                const cx = ((e.clientX - rect.left) / rect.width) * 100;
                const cy = ((e.clientY - rect.top) / rect.height) * 100;
                updatePreviewPos(cx, cy);
                previewGroup.style.opacity = '0.6';
                hintEl.style.opacity = '0';
            });
            imageWrap.addEventListener('mouseleave', () => {
                if (!placed) {
                    previewGroup.style.opacity = '0';
                    hintEl.style.opacity = '1';
                }
            });

            // 滾輪調整半徑
            imageWrap.addEventListener('wheel', (e) => {
                if (submitted) return;
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.5 : 0.5;
                currentR = Math.max(MIN_R, Math.min(MAX_R, currentR + delta));
                updatePreviewR(currentR);
                if (radiusSlider) radiusSlider.value = currentR;
                if (radiusLabel) radiusLabel.textContent = `範圍 ${currentR}%`;
                if (placed && annotation) {
                    annotation.r = currentR;
                    drawAnnotation();
                }
            }, { passive: false });
        }

        /* ── 繪製已放置的標註 ── */
        const drawAnnotation = () => {
            // 清除所有子元素但保留 preview group
            Array.from(svg.children).forEach(c => {
                if (c !== previewGroup) c.remove();
            });
            if (!annotation) return;

            // 外圈 glow（動畫呼吸效果）
            const glow = document.createElementNS(svgNS, 'circle');
            glow.setAttribute('cx', annotation.cx);
            glow.setAttribute('cy', annotation.cy);
            glow.setAttribute('r', annotation.r);
            glow.classList.add('hs-circle-glow');
            svg.insertBefore(glow, previewGroup);

            // 主圓
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', annotation.cx);
            circle.setAttribute('cy', annotation.cy);
            circle.setAttribute('r', annotation.r);
            circle.classList.add('hs-circle-main');
            if (submitted) circle.classList.add('submitted');
            svg.insertBefore(circle, previewGroup);

            // 準心
            const armLen = Math.max(1, annotation.r * 0.3);
            const cross = document.createElementNS(svgNS, 'g');
            cross.classList.add('hs-crosshair');
            const h = document.createElementNS(svgNS, 'line');
            h.setAttribute('x1', annotation.cx - armLen); h.setAttribute('y1', annotation.cy);
            h.setAttribute('x2', annotation.cx + armLen); h.setAttribute('y2', annotation.cy);
            const v = document.createElementNS(svgNS, 'line');
            v.setAttribute('x1', annotation.cx); v.setAttribute('y1', annotation.cy - armLen);
            v.setAttribute('x2', annotation.cx); v.setAttribute('y2', annotation.cy + armLen);
            cross.appendChild(h);
            cross.appendChild(v);
            svg.insertBefore(cross, previewGroup);
        };

        const updateUI = () => {
            if (submitBtn) submitBtn.disabled = !annotation || submitted;
            if (radiusLabel && annotation) radiusLabel.textContent = `範圍 ${annotation.r}%`;
        };

        // ── 點擊放置 ──
        imageWrap.addEventListener('click', (e) => {
            if (submitted) return;
            if (e.target.closest('.hs-radius-wrap') || e.target.closest('.hs-submit-btn')) return;
            const rect = imageWrap.getBoundingClientRect();
            const cx = ((e.clientX - rect.left) / rect.width) * 100;
            const cy = ((e.clientY - rect.top) / rect.height) * 100;
            const r = currentR;
            annotation = { cx: Math.round(cx * 10) / 10, cy: Math.round(cy * 10) / 10, r };
            placed = true;
            hintEl.style.display = 'none';
            if (previewGroup) previewGroup.style.opacity = '0';
            drawAnnotation();
            updateUI();
            if (sliderWrap) sliderWrap.style.display = '';
            if (radiusSlider) radiusSlider.value = r;
        });

        // 半徑滑桿
        if (radiusSlider) {
            radiusSlider.addEventListener('input', () => {
                if (!annotation || submitted) return;
                annotation.r = parseFloat(radiusSlider.value);
                currentR = annotation.r;
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
                placed = true;
                hintEl.style.display = 'none';
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
            placed = false;
            annotation = null;
            currentR = DEFAULT_R;
            drawAnnotation();
            updateUI();
            if (submitBtn) { submitBtn.style.display = ''; submitBtn.disabled = true; }
            if (sliderWrap) sliderWrap.style.display = 'none';
            if (resultEl) { resultEl.className = 'hotspot-result'; resultEl.innerHTML = ''; }
            hintEl.style.display = '';
            hintEl.style.opacity = '1';
            resetBtn.classList.remove('visible');
            if (radiusSlider) radiusSlider.value = DEFAULT_R;
            if (elementId) await stateManager.clear(elementId);
        });
    }

    /* ═══════════════════════════════════════════
       講師端：Canvas 熱點圖 + hover tooltip
       ═══════════════════════════════════════════ */
    async setupPresenterView(container, elementId, correctZone) {
        const imageWrap = container.querySelector('.hotspot-image-wrap');
        if (!imageWrap) return;

        const submitBtn = container.querySelector('.hs-submit-btn');
        const sliderWrap = container.querySelector('.hs-radius-wrap');
        if (submitBtn) submitBtn.style.display = 'none';
        if (sliderWrap) sliderWrap.style.display = 'none';

        // Canvas 覆蓋層
        const canvas = document.createElement('canvas');
        canvas.className = 'hs-heatmap-canvas';
        canvas.width = 200;
        canvas.height = 150;
        imageWrap.style.position = 'relative';
        imageWrap.appendChild(canvas);

        // Hover tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'hs-hover-tooltip';
        tooltip.style.cssText = `
            position:absolute;pointer-events:none;z-index:90;
            background:rgba(15,23,42,0.92);color:#fff;
            padding:6px 12px;border-radius:8px;font-size:12px;
            font-weight:600;white-space:nowrap;
            opacity:0;transition:opacity 0.15s;
            backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,0.3);
        `;
        imageWrap.appendChild(tooltip);

        // 統計
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

        // Hover → 顯示區域人數 + 姓名
        canvas.style.pointerEvents = 'auto';
        canvas.style.cursor = 'crosshair';
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width * 100;
            const py = (e.clientY - rect.top) / rect.height * 100;
            const detectR = 8; // 偵測半徑 (百分比)
            const nearby = submissions.filter(s => {
                const a = s.annotation;
                return Math.hypot(a.cx - px, a.cy - py) < detectR + (a.r || 5);
            });
            if (nearby.length > 0) {
                const names = [...new Set(nearby.map(s => s.name))].slice(0, 5);
                const extra = nearby.length > 5 ? ` +${nearby.length - 5}人` : '';
                tooltip.textContent = `${nearby.length} 人：${names.join('、')}${extra}`;
                tooltip.style.opacity = '1';
                // 用百分比定位，避免 CSS transform scale 造成的偏移
                const xPct = px; // 已經是百分比 (0-100)
                const yPct = py;
                tooltip.style.left = xPct + '%';
                tooltip.style.top = Math.max(0, yPct - 5) + '%';
                tooltip.style.transform = 'translate(-50%, -100%)';
            } else {
                tooltip.style.opacity = '0';
            }
        });
        canvas.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });

        await fetchAndRender();
        const timer = setInterval(fetchAndRender, 4000);

        if (sessionCode && realtime?.on) {
            realtime.on('submission_saved', (msg) => {
                const p = msg.payload || msg;
                if (p.element_id === elementId) fetchAndRender();
            });
        }

        container._hsCleanup = () => clearInterval(timer);
    }

    /* ═══════════════════════════════════════════
       Canvas 熱點圖繪製（不再繪製峰值數字）
       ═══════════════════════════════════════════ */
    _renderHeatmap(canvas, submissions) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (submissions.length === 0) return;

        const grid = new Float32Array(w * h);
        let maxDensity = 0;

        for (const sub of submissions) {
            const a = sub.annotation;
            if (!a) continue;
            const cx = (a.cx / 100) * w, cy = (a.cy / 100) * h;
            const rx = (a.r / 100) * w, ry = (a.r / 100) * h;
            const x0 = Math.max(0, Math.floor(cx - rx));
            const x1 = Math.min(w - 1, Math.ceil(cx + rx));
            const y0 = Math.max(0, Math.floor(cy - ry));
            const y1 = Math.min(h - 1, Math.ceil(cy + ry));

            for (let py = y0; py <= y1; py++) {
                for (let px = x0; px <= x1; px++) {
                    const dx = (px - cx) / rx, dy = (py - cy) / ry;
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= 1) {
                        const weight = 1 - distSq * 0.7;
                        const idx = py * w + px;
                        grid[idx] += weight;
                        if (grid[idx] > maxDensity) maxDensity = grid[idx];
                    }
                }
            }
        }

        if (maxDensity === 0) return;

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
        // ✅ 不再繪製峰值數字標籤 → 改用 hover tooltip
    }

    /* ═══════════════════════════════════════════
       熱點圖色彩映射
       ═══════════════════════════════════════════ */
    _heatColor(val) {
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
