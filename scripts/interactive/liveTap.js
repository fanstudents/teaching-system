/**
 * Live Tap — 簡報級即時點擊模組
 * 講師在任何投影片上按一鍵開啟，學員直接在畫面上標記感興趣的區域，
 * 講師端即時以 Canvas 熱點圖呈現所有人的點擊位置。
 * 資料存入 submissions 表（type: 'livetap'），供事後儀表板查詢。
 */
import { db, realtime } from '../supabase.js';

/* ───── 常數 ───── */
const HEATMAP_W = 200, HEATMAP_H = 150;   // Canvas 內部解析度
const SIGMA = 0.045;                         // 高斯核寬度（百分比座標）
const POLL_MS = 4000;                        // 輪詢新資料
const TAP_THROTTLE_MS = 800;                // 學員防連點

/* ───── 色譜（冷 → 暖） ───── */
function densityColor(t) {
    if (t < 0.25) return [0, Math.round(t / 0.25 * 200), 255];
    if (t < 0.5) return [0, 255, Math.round(255 - (t - 0.25) / 0.25 * 255)];
    if (t < 0.75) return [Math.round((t - 0.5) / 0.25 * 255), 255, 0];
    return [255, Math.round(255 - (t - 0.75) / 0.25 * 200), 0];
}

/* ═══════════════════════════════════
   講師端 — 啟動 / 停止 / 熱點圖
   ═══════════════════════════════════ */

let _presState = {
    active: false,
    slideIndex: -1,
    sessionCode: '',
    taps: [],         // [{ cx, cy, studentName, studentEmail }]
    canvas: null,
    pollTimer: null,
    realtimeHandler: null,
    hoverTooltip: null,
};

/**
 * 講師端：切換即時點擊模式
 */
export function presenterToggle(slideIndex, sessionCode, slideEl) {
    if (_presState.active) {
        presenterStop();
        return false;
    }
    _presState.active = true;
    _presState.slideIndex = slideIndex;
    _presState.sessionCode = sessionCode;
    _presState.taps = [];

    // 廣播給學員：開啟
    realtime.publish(`session:${sessionCode}`, 'livetap_toggle', {
        enabled: true,
        slideIndex,
    });

    // 建立 Canvas overlay
    _createPresenterOverlay(slideEl);
    // 拉一次現有資料
    _fetchTaps();
    // 輪詢
    _presState.pollTimer = setInterval(_fetchTaps, POLL_MS);
    // Realtime 推送
    _presState.realtimeHandler = (msg) => {
        const p = msg.payload || msg;
        if (p.slideIndex !== _presState.slideIndex) return;
        _presState.taps.push({ cx: p.cx, cy: p.cy, studentName: p.studentName, studentEmail: p.studentEmail });
        _renderHeatmap();
    };
    realtime.on('livetap_new', _presState.realtimeHandler);

    return true;
}

export function presenterStop() {
    if (!_presState.active) return;
    _presState.active = false;
    // 廣播：關閉
    if (_presState.sessionCode) {
        realtime.publish(`session:${_presState.sessionCode}`, 'livetap_toggle', {
            enabled: false,
        });
    }
    clearInterval(_presState.pollTimer);
    if (_presState.realtimeHandler) {
        realtime.off('livetap_new', _presState.realtimeHandler);
    }
    _presState.canvas?.remove();
    _presState.hoverTooltip?.remove();
    _presState.canvas = null;
    _presState.hoverTooltip = null;
}

export function presenterCleanup() {
    presenterStop();
}

export function isPresenterActive() {
    return _presState.active;
}

/* — Canvas overlay — */
function _createPresenterOverlay(slideEl) {
    // 移除舊的
    slideEl.querySelector('.livetap-heatmap')?.remove();
    slideEl.querySelector('.livetap-tooltip')?.remove();
    slideEl.querySelector('.livetap-legend')?.remove();

    const wrap = slideEl.closest('.presentation-slide') || slideEl;
    wrap.style.position = 'relative';

    const canvas = document.createElement('canvas');
    canvas.className = 'livetap-heatmap';
    canvas.width = HEATMAP_W;
    canvas.height = HEATMAP_H;
    canvas.style.cssText = `
        position:absolute;top:0;left:0;width:100%;height:100%;
        pointer-events:auto;z-index:80;opacity:0.65;
        mix-blend-mode:multiply;border-radius:inherit;
        cursor:crosshair;
    `;
    wrap.appendChild(canvas);
    _presState.canvas = canvas;

    // tooltip
    const tip = document.createElement('div');
    tip.className = 'livetap-tooltip';
    tip.style.cssText = `
        position:absolute;pointer-events:none;z-index:90;
        background:rgba(15,23,42,0.9);color:#fff;
        padding:5px 10px;border-radius:6px;font-size:12px;
        font-weight:600;white-space:nowrap;
        opacity:0;transition:opacity 0.15s;
        backdrop-filter:blur(4px);
    `;
    wrap.appendChild(tip);
    _presState.hoverTooltip = tip;

    // legend
    const legend = document.createElement('div');
    legend.className = 'livetap-legend';
    legend.style.cssText = `
        position:absolute;bottom:8px;left:8px;z-index:85;
        display:flex;align-items:center;gap:6px;
        background:rgba(0,0,0,0.7);color:#fff;
        padding:4px 10px;border-radius:8px;font-size:11px;
        pointer-events:none;backdrop-filter:blur(4px);
    `;
    legend.innerHTML = `
        <span style="display:flex;align-items:center;gap:3px;">
            <span class="material-symbols-outlined" style="font-size:14px;">touch_app</span>
            即時點擊模式
        </span>
        <span class="livetap-count" style="font-weight:700;">0 人</span>
        <span style="display:flex;height:10px;width:80px;border-radius:4px;overflow:hidden;">
            <span style="flex:1;background:#3b82f6;"></span>
            <span style="flex:1;background:#10b981;"></span>
            <span style="flex:1;background:#f59e0b;"></span>
            <span style="flex:1;background:#ef4444;"></span>
        </span>
        <span style="font-size:10px;opacity:0.7;">少 → 多</span>
    `;
    wrap.appendChild(legend);

    // 滑鼠移動 → tooltip 顯示區域人數
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const radius = 0.06; // 偵測範圍
        const nearby = _presState.taps.filter(t =>
            Math.hypot(t.cx - px, t.cy - py) < radius
        );
        if (nearby.length > 0) {
            const names = [...new Set(nearby.map(t => t.studentName))].slice(0, 5);
            const extra = nearby.length > 5 ? ` +${nearby.length - 5}人` : '';
            tip.textContent = `${nearby.length} 人點擊：${names.join('、')}${extra}`;
            tip.style.opacity = '1';
            tip.style.left = (e.clientX - rect.left + wrap.getBoundingClientRect().left - rect.left + 12) + 'px';
            tip.style.top = (e.clientY - rect.top + wrap.getBoundingClientRect().top - rect.top - 30) + 'px';
            // Reposition relative to wrap
            const wrapRect = wrap.getBoundingClientRect();
            tip.style.left = (e.clientX - wrapRect.left + 12) + 'px';
            tip.style.top = (e.clientY - wrapRect.top - 30) + 'px';
        } else {
            tip.style.opacity = '0';
        }
    });
    canvas.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
}

/* — 從 DB 拉資料 — */
async function _fetchTaps() {
    if (!_presState.active || !_presState.sessionCode) return;
    try {
        const eid = `livetap_slide_${_presState.slideIndex}`;
        const { data } = await db.select('submissions', {
            filter: {
                session_id: `eq.${_presState.sessionCode}`,
                element_id: `eq.${eid}`,
                type: `eq.livetap`,
            },
            select: 'student_name,student_email,state',
        });
        if (!data) return;
        _presState.taps = data.map(row => {
            const st = typeof row.state === 'string' ? JSON.parse(row.state) : (row.state || {});
            return { cx: st.cx || 0, cy: st.cy || 0, studentName: row.student_name, studentEmail: row.student_email };
        });
        _renderHeatmap();
    } catch (e) {
        console.warn('[LiveTap] fetch error:', e);
    }
}

/* — 熱點圖渲染 — */
function _renderHeatmap() {
    const canvas = _presState.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const taps = _presState.taps;

    // 更新 legend 計數
    const countEl = canvas.parentElement?.querySelector('.livetap-count');
    const uniqueStudents = new Set(taps.map(t => t.studentEmail));
    if (countEl) countEl.textContent = `${uniqueStudents.size} 人`;

    if (taps.length === 0) {
        ctx.clearRect(0, 0, HEATMAP_W, HEATMAP_H);
        return;
    }

    // 密度格點
    const grid = new Float32Array(HEATMAP_W * HEATMAP_H);
    const sigX = SIGMA * HEATMAP_W, sigY = SIGMA * HEATMAP_H;
    const r2x = 2 * sigX * sigX, r2y = 2 * sigY * sigY;
    const cutoff = Math.ceil(3 * Math.max(sigX, sigY));

    for (const tap of taps) {
        const px = tap.cx * HEATMAP_W, py = tap.cy * HEATMAP_H;
        const x0 = Math.max(0, Math.floor(px - cutoff));
        const x1 = Math.min(HEATMAP_W - 1, Math.ceil(px + cutoff));
        const y0 = Math.max(0, Math.floor(py - cutoff));
        const y1 = Math.min(HEATMAP_H - 1, Math.ceil(py + cutoff));
        for (let y = y0; y <= y1; y++) {
            const dy2 = (y - py) * (y - py) / r2y;
            for (let x = x0; x <= x1; x++) {
                grid[y * HEATMAP_W + x] += Math.exp(-((x - px) * (x - px) / r2x + dy2));
            }
        }
    }

    let maxVal = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] > maxVal) maxVal = grid[i];

    const imgData = ctx.createImageData(HEATMAP_W, HEATMAP_H);
    const d = imgData.data;
    for (let i = 0; i < grid.length; i++) {
        const t = maxVal > 0 ? grid[i] / maxVal : 0;
        if (t < 0.05) { d[i * 4 + 3] = 0; continue; }
        const [r, g, b] = densityColor(t);
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b;
        d[i * 4 + 3] = Math.round(t * 200);
    }
    ctx.putImageData(imgData, 0, 0);
}

/* ═══════════════════════════════════
   講師端：切換投影片時更新
   ═══════════════════════════════════ */
export function presenterSlideChanged(newSlideIndex, slideEl) {
    if (!_presState.active) return;
    _presState.slideIndex = newSlideIndex;
    _presState.taps = [];

    // 重新建立 overlay
    _createPresenterOverlay(slideEl);
    _fetchTaps();

    // 通知學員更新 slideIndex
    realtime.publish(`session:${_presState.sessionCode}`, 'livetap_toggle', {
        enabled: true,
        slideIndex: newSlideIndex,
    });
}

/* ═══════════════════════════════════
   學員端 — 接收開關 + 點擊標記
   ═══════════════════════════════════ */

let _studentState = {
    enabled: false,
    slideIndex: -1,
    sessionCode: '',
    overlay: null,
    lastTapTime: 0,
};

/**
 * 學員端：初始化 — 在 join 成功後呼叫
 */
export function studentInit(sessionCode, slideEl, getStudentInfo) {
    _studentState.sessionCode = sessionCode;

    realtime.on('livetap_toggle', (msg) => {
        const p = msg.payload || msg;
        if (p.enabled) {
            _studentState.enabled = true;
            _studentState.slideIndex = p.slideIndex;
            _showStudentOverlay(slideEl, getStudentInfo);
        } else {
            _studentState.enabled = false;
            _hideStudentOverlay();
        }
    });
}

function _showStudentOverlay(slideEl, getStudentInfo) {
    _hideStudentOverlay();

    const wrap = slideEl.closest('.student-slide-inner') || slideEl;
    wrap.style.position = 'relative';

    const overlay = document.createElement('div');
    overlay.className = 'livetap-student-overlay';
    overlay.style.cssText = `
        position:absolute;top:0;left:0;width:100%;height:100%;
        z-index:200;cursor:crosshair;
        background:transparent;
        touch-action:none;
    `;

    // 引導提示（手機友善）
    const hint = document.createElement('div');
    hint.className = 'livetap-hint';
    hint.innerHTML = `
        <div class="livetap-hint-inner">
            <span class="material-symbols-outlined livetap-hint-icon">touch_app</span>
            <span>點擊你感興趣的區域</span>
        </div>
    `;
    overlay.appendChild(hint);

    // 點擊事件
    const handleTap = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const now = Date.now();
        if (now - _studentState.lastTapTime < TAP_THROTTLE_MS) return;
        _studentState.lastTapTime = now;

        const rect = overlay.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const cx = (clientX - rect.left) / rect.width;
        const cy = (clientY - rect.top) / rect.height;

        // 漣漪動畫
        _createRipple(overlay, clientX - rect.left, clientY - rect.top);

        // 隱藏提示
        hint.style.opacity = '0';
        setTimeout(() => hint.style.display = 'none', 300);

        // 取得學員資訊
        const { name, email } = getStudentInfo();
        const eid = `livetap_slide_${_studentState.slideIndex}`;

        // 存 DB
        try {
            await db.insert('submissions', {
                student_name: name || '匿名',
                student_email: email || '',
                assignment_title: '即時點擊',
                type: 'livetap',
                content: `(${(cx * 100).toFixed(1)}%, ${(cy * 100).toFixed(1)}%)`,
                element_id: eid,
                session_id: _studentState.sessionCode,
                submitted_at: new Date().toISOString(),
                state: { cx, cy, slideIndex: _studentState.slideIndex },
            });
        } catch (err) {
            console.warn('[LiveTap] save error:', err);
        }

        // Realtime 推送
        realtime.publish(`session:${_studentState.sessionCode}`, 'livetap_new', {
            cx, cy,
            slideIndex: _studentState.slideIndex,
            studentName: name,
            studentEmail: email,
        });

        // 顯示確認
        _showTapMark(overlay, clientX - rect.left, clientY - rect.top);
    };

    overlay.addEventListener('click', handleTap);
    overlay.addEventListener('touchstart', handleTap, { passive: false });

    wrap.appendChild(overlay);
    _studentState.overlay = overlay;
}

function _hideStudentOverlay() {
    _studentState.overlay?.remove();
    _studentState.overlay = null;
}

function _createRipple(container, x, y) {
    const ripple = document.createElement('div');
    ripple.style.cssText = `
        position:absolute;left:${x}px;top:${y}px;
        width:0;height:0;border-radius:50%;
        background:rgba(59,130,246,0.3);
        transform:translate(-50%,-50%);
        pointer-events:none;
        animation:livetapRipple 0.6s ease-out forwards;
    `;
    container.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
}

function _showTapMark(container, x, y) {
    const mark = document.createElement('div');
    mark.style.cssText = `
        position:absolute;left:${x}px;top:${y}px;
        width:24px;height:24px;border-radius:50%;
        background:rgba(59,130,246,0.5);
        border:2px solid rgba(59,130,246,0.8);
        transform:translate(-50%,-50%) scale(0);
        pointer-events:none;
        animation:livetapMark 0.3s ease-out forwards;
    `;
    mark.innerHTML = `<svg viewBox="0 0 24 24" style="width:100%;height:100%;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#fff"/></svg>`;
    container.appendChild(mark);
    setTimeout(() => {
        mark.style.opacity = '0';
        mark.style.transition = 'opacity 0.5s';
        setTimeout(() => mark.remove(), 600);
    }, 2000);
}

/* ───── 注入動畫 keyframes ───── */
if (typeof document !== 'undefined') {
    const styleId = 'livetap-keyframes';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @keyframes livetapRipple {
                to { width:80px;height:80px;opacity:0; }
            }
            @keyframes livetapMark {
                to { transform:translate(-50%,-50%) scale(1); }
            }
            @keyframes livetapHintPulse {
                0%,100% { transform:scale(1); opacity:0.9; }
                50% { transform:scale(1.1); opacity:1; }
            }
            .livetap-hint {
                position:absolute;top:0;left:0;width:100%;height:100%;
                display:flex;align-items:center;justify-content:center;
                pointer-events:none;transition:opacity 0.3s;
            }
            .livetap-hint-inner {
                display:flex;align-items:center;gap:8px;
                background:rgba(15,23,42,0.85);color:#fff;
                padding:12px 24px;border-radius:12px;
                font-size:15px;font-weight:600;
                backdrop-filter:blur(8px);
                animation:livetapHintPulse 2s ease-in-out infinite;
                box-shadow:0 4px 20px rgba(0,0,0,0.3);
            }
            .livetap-hint-icon {
                font-size:24px;color:#60a5fa;
            }
        `;
        document.head.appendChild(style);
    }
}
