/**
 * 圖片轉簡報元件 — 視覺分析 + 版面重建引擎
 *
 * 三段式管線（品質關鍵：排版不靠 AI，由程式碼保證）：
 *  1. prepareImage()  — 前端縮圖壓縮
 *  2. analyzeImage()  — 視覺模型抽取「結構化規格」（版型/文字/色碼/icon 名稱）
 *  3. buildFromSpec() — 確定性版面引擎，依版型演算法產出原生可編輯元素
 *                       （文字 + 圖形 + Material Symbols 圖示 + flowline 虛線連接線）
 *                       並自動指派 animOrder 逐步動畫
 *
 * 輸出的元素完全是系統原生格式，可直接 addElement / 存入素材庫（type: 'elements'）。
 */

import { ai } from './supabase.js';
import { ICON_PATHS, ICON_NAMES } from './iconPaths.js';

// ═══════════════════════════════════════
// 1) 圖片前處理：縮圖 + JPEG 壓縮 → base64
// ═══════════════════════════════════════
export async function prepareImage(fileOrDataUrl) {
    const dataUrl = typeof fileOrDataUrl === 'string'
        ? fileOrDataUrl
        : await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = e => resolve(e.target.result);
            r.onerror = reject;
            r.readAsDataURL(fileOrDataUrl);
        });

    const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('圖片載入失敗'));
        i.src = dataUrl;
    });

    const MAX = 1400;
    let { width, height } = img;
    if (width > MAX || height > MAX) {
        const s = Math.min(MAX / width, MAX / height);
        width = Math.round(width * s);
        height = Math.round(height * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    const jpeg = canvas.toDataURL('image/jpeg', 0.87);
    return {
        displayUrl: jpeg,
        base64: jpeg.split(',')[1],
        mediaType: 'image/jpeg',
        aspect: width / height,
    };
}

// ═══════════════════════════════════════
// 2) 視覺分析：圖 → 結構化規格 JSON
// ═══════════════════════════════════════
const ANALYZE_PROMPT = `你是資訊圖表逆向工程專家。仔細觀察這張圖，把它拆解成結構化規格 JSON。

## 版型分類（pattern，擇一）
- "radial"：中央一個核心節點，周圍放射狀環繞多個項目（有連接線）
- "cards"：並排的卡片欄位（含編號步驟卡）
- "list"：垂直列表逐行排列
- "freeform"：無法歸類的其他版面

## 輸出格式（只輸出 JSON，不要任何其他文字或 markdown 圍欄）
{
  "pattern": "radial|cards|list|freeform",
  "background": "頁面背景，純色 hex 或 CSS linear-gradient",
  "title": {"text": "主標題完整文字", "color": "#hex"},
  "subtitle": {"text": "副標題完整文字", "color": "#hex"} 或 null,
  "titleIcon": "主標題旁若有 icon，給清單內名稱" 或 null,
  "center": {"label": "核心節點主文字", "sub": "核心節點副文字或null", "icon": "清單內名稱", "color": "#hex"} 或 null,
  "items": [
    {
      "label": "項目標題（完整照抄）",
      "desc": "項目說明文字（完整照抄）",
      "icon": "清單內名稱",
      "color": "#hex 此項目的主色（從圖中取色）",
      "num": 編號數字 或 null,
      "hint": "卡片底部的提示/備註小字（若有）" 或 null
    }
  ],
  "footer": {"text": "底部總結列完整文字", "icon": "清單內名稱", "color": "#hex"} 或 null
}

## 規則
1. 文字必須一字不差完整照抄（含 emoji），不要翻譯、不要改寫、不要省略。
2. 顏色務必從圖中實際取色，給 6 位 hex。每個項目取「高飽和」的主題色（icon 線條、編號圓、粗體標題文字的深色），千萬不要取卡片或圓形的淺色背景（淡色調由系統自動衍生）。
3. icon「只能」從下列清單挑選語意最接近的名稱：${ICON_NAMES.join(',')}
4. items 依視覺閱讀順序排列（由上而下、由左而右）。
5. radial 版型時 center 必填；cards 版型有編號就填 num。
6. 只輸出 JSON。`;

export async function analyzeImage(prepared, { onProgress } = {}) {
    onProgress?.('AI 正在解析圖片結構…');

    // 中立格式採 OpenAI image_url（線上 ai-proxy 的 OpenAI 分支原樣轉發即可支援；
    // 直連 Anthropic 的路徑由 supabase.js 自動轉格式）
    const messages = [{
        role: 'user',
        content: [
            { type: 'image_url', image_url: { url: `data:${prepared.mediaType};base64,${prepared.base64}` } },
            { type: 'text', text: ANALYZE_PROMPT },
        ],
    }];

    let raw;
    try {
        raw = await ai.chat(messages, { maxTokens: 4096, temperature: 0.2 });
    } catch (e) {
        throw new Error('視覺分析失敗：' + e.message);
    }

    const spec = extractJson(raw);
    if (!spec || !Array.isArray(spec.items) || spec.items.length === 0) {
        throw new Error('AI 回傳的規格無法解析，請重試一次');
    }
    return normalizeSpec(spec);
}

function extractJson(text) {
    if (!text) return null;
    let t = String(text).trim();
    t = t.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try { return JSON.parse(t.slice(start, end + 1)); } catch { return null; }
}

/** icon 名稱驗證：不在庫裡 → 常見別名 → fallback */
const ICON_ALIASES = {
    lightbulb: 'idea', bulb: 'idea', megaphone: 'campaign', headset: 'support',
    shield_check: 'shield', graduation_cap: 'education', school: 'education',
    trending_up: 'growth', bar_chart: 'chart', settings_gear: 'settings',
    message: 'chat', email: 'mail', group: 'team', users: 'team', user: 'person',
    check_circle: 'check', clock: 'time', wallet: 'payment', money_bag: 'money',
    world: 'globe', ai: 'brain', bot: 'robot', gear: 'settings', wrench: 'tool',
    pencil: 'edit', write: 'edit', scissors: 'cut', paint: 'palette', art: 'palette',
};
function validIcon(name) {
    const n = String(name || '').trim().toLowerCase().replace(/[- ]/g, '_');
    if (ICON_PATHS[n]) return n;
    if (ICON_ALIASES[n] && ICON_PATHS[ICON_ALIASES[n]]) return ICON_ALIASES[n];
    // 部分比對（e.g. "file_search_2" → "file_search"）
    const partial = ICON_NAMES.find(k => n.includes(k) || k.includes(n));
    return partial || 'sparkle';
}

/** 顏色太淡（接近背景色）時自動加深，確保 icon／文字可讀 */
function vivid(hexColor) {
    const h = hexColor.replace('#', '');
    const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
    const n = parseInt(f, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (lum > 0.72) {
        const k = Math.min(0.6, 0.4 + (lum - 0.72) * 1.5);
        r = Math.round(r * (1 - k)); g = Math.round(g * (1 - k)); b = Math.round(b * (1 - k));
    }
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function normalizeSpec(spec) {
    const hex = (c, fb) => (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c.trim())) ? c.trim() : fb;
    const s = {
        pattern: ['radial', 'cards', 'list', 'freeform'].includes(spec.pattern) ? spec.pattern : 'cards',
        background: spec.background || '#ffffff',
        title: spec.title?.text ? { text: String(spec.title.text), color: hex(spec.title?.color, '#1e293b') } : null,
        subtitle: spec.subtitle?.text ? { text: String(spec.subtitle.text), color: hex(spec.subtitle?.color, '#64748b') } : null,
        titleIcon: spec.titleIcon ? validIcon(spec.titleIcon) : null,
        center: spec.center?.label ? {
            label: String(spec.center.label),
            sub: spec.center.sub ? String(spec.center.sub) : null,
            icon: validIcon(spec.center.icon || 'network'),
            color: vivid(hex(spec.center?.color, '#6c5ce7')),
        } : null,
        items: (spec.items || []).slice(0, 10).map((it, i) => ({
            label: String(it.label || `項目 ${i + 1}`),
            desc: it.desc ? String(it.desc) : '',
            icon: validIcon(it.icon),
            color: vivid(hex(it.color, ['#4285f4', '#0d9488', '#16a34a', '#eab308', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'][i % 8])),
            num: (it.num !== null && it.num !== undefined && it.num !== '') ? String(it.num) : null,
            hint: it.hint ? String(it.hint) : null,
        })),
        footer: spec.footer?.text ? {
            text: String(spec.footer.text),
            icon: spec.footer.icon ? validIcon(spec.footer.icon) : null,
            color: vivid(hex(spec.footer?.color, '#7c3aed')),
        } : null,
    };
    if (s.pattern === 'radial' && !s.center) s.pattern = 'cards';
    return s;
}

// ═══════════════════════════════════════
// 3) 版面重建引擎（確定性排版，不靠 AI）
// ═══════════════════════════════════════

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function tint(hexColor, alpha) {
    const h = hexColor.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function txt(x, y, w, h, html, { fontSize = 16, align = 'left', anim = 0 } = {}) {
    const e = { type: 'text', x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h), content: html, fontSize };
    if (align !== 'left') e.textAlign = align;
    if (anim > 0) e.animOrder = anim;
    return e;
}

function rect(x, y, w, h, background, { radius = 0, anim = 0 } = {}) {
    const e = { type: 'shape', shapeType: 'rectangle', x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h), background };
    if (radius) e.borderRadius = radius;
    if (anim > 0) e.animOrder = anim;
    return e;
}

function circle(cx, cy, d, background, { anim = 0 } = {}) {
    const e = { type: 'shape', shapeType: 'circle', x: Math.round(cx - d / 2), y: Math.round(cy - d / 2), width: Math.round(d), height: Math.round(d), background };
    if (anim > 0) e.animOrder = anim;
    return e;
}

/** SVG → data URI（unicode 安全） */
function svgUri(svg) {
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

/**
 * 圖示節點 → 單一 image 元素（自包含 SVG，編輯器/學員端/PDF 三端渲染一致）
 * @param {Object} o — { ring: 是否畫色環, bg: 圓底色, ringColor }
 */
function iconImg(cx, cy, d, iconName, color, { ring = false, bg = null, anim = 0 } = {}) {
    const inner = ICON_PATHS[iconName] || ICON_PATHS.sparkle;
    const half = d / 2;
    // icon 佔圓的 ~46%
    const gs = (d * 0.46) / 24;
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d} ${d}">`];
    if (bg) parts.push(`<circle cx="${half}" cy="${half}" r="${half}" fill="${bg}"/>`);
    if (ring) {
        parts.push(`<circle cx="${half}" cy="${half}" r="${half - 2}" fill="#ffffff" stroke="${color}" stroke-width="3"/>`);
    }
    parts.push(`<g transform="translate(${half - gs * 12} ${half - gs * 12}) scale(${gs})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`);
    parts.push('</svg>');
    const e = { type: 'image', x: Math.round(cx - half), y: Math.round(cy - half), width: d, height: d, src: svgUri(parts.join('')) };
    if (anim > 0) e.animOrder = anim;
    return e;
}

/** 編號徽章 → 單一 image 元素（SVG 圓 + 數字） */
function badgeImg(cx, cy, d, num, color, anim = 0) {
    const half = d / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d} ${d}">` +
        `<circle cx="${half}" cy="${half}" r="${half}" fill="${color}"/>` +
        `<text x="${half}" y="${half}" font-family="Arial, sans-serif" font-size="${Math.round(d * 0.52)}" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${esc(num)}</text>` +
        '</svg>';
    const e = { type: 'image', x: Math.round(cx - half), y: Math.round(cy - half), width: d, height: d, src: svgUri(svg) };
    if (anim > 0) e.animOrder = anim;
    return e;
}

function flowline(x1, y1, x2, y2, color, anim) {
    const pad = 14;
    const minX = Math.min(x1, x2) - pad, minY = Math.min(y1, y2) - pad;
    const e = {
        type: 'flowline',
        x: Math.round(minX), y: Math.round(minY),
        width: Math.round(Math.abs(x1 - x2) + pad * 2),
        height: Math.round(Math.abs(y1 - y2) + pad * 2),
        waypoints: [
            { x: Math.round(x1 - minX), y: Math.round(y1 - minY) },
            { x: Math.round(x2 - minX), y: Math.round(y2 - minY) },
        ],
        lineColor: color, lineWidth: 2, curveMode: 'straight',
        particleCount: 2, dashLength: 5, flowSpeed: 2, showArrow: false,
    };
    if (anim > 0) e.animOrder = anim;
    return e;
}

/** 行內 SVG 圖示（放在文字元素 content 裡，兩端渲染一致） */
function inlineIcon(iconName, size, color, extra = '') {
    const inner = ICON_PATHS[iconName];
    if (!inner) return '';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-${Math.round(size * 0.18)}px;${extra}">${inner}</svg>`;
}

/** 共用：標題 + 副標題，回傳 {elements, contentTop} */
function buildHeader(spec) {
    const els = [];
    let top = 110;
    if (spec.title) {
        const iconHtml = spec.titleIcon
            ? inlineIcon(spec.titleIcon, 32, spec.title.color, 'margin-right:10px;') : '';
        els.push(txt(60, 16, 840, 52,
            `<b style="font-size:33px;color:${spec.title.color};letter-spacing:1px;">${iconHtml}${esc(spec.title.text)}</b>`,
            { fontSize: 33, align: 'center' }));
        top = 76;
    }
    if (spec.subtitle) {
        els.push(txt(120, top - 4, 720, 26,
            `<span style="font-size:15px;color:${spec.subtitle.color};">${esc(spec.subtitle.text)}</span>`,
            { fontSize: 15, align: 'center' }));
        top += 30;
    }
    return { elements: els, contentTop: Math.max(top, 100) };
}

// ── 放射狀版型 ──
function buildRadial(spec) {
    const els = [];
    const { elements: headerEls } = buildHeader(spec);
    els.push(...headerEls);

    const cx = 480, cy = 318;
    const c = spec.center;
    const HUB = 1;

    // 中心節點
    els.push(circle(cx, cy, 196, tint(c.color, 0.13), { anim: HUB }));
    els.push(iconImg(cx, cy - 46, 52, c.icon, c.color, { anim: HUB }));
    els.push(txt(cx - 90, cy - 8, 180, 40,
        `<b style="font-size:26px;color:${c.color};">${esc(c.label)}</b>`,
        { fontSize: 26, align: 'center', anim: HUB }));
    if (c.sub) {
        els.push(txt(cx - 90, cy + 34, 180, 22,
            `<span style="font-size:12px;color:#6b7280;">${esc(c.sub)}</span>`,
            { fontSize: 12, align: 'center', anim: HUB }));
    }

    // 衛星節點：左右兩欄 + 奇數時底部一顆
    const items = spec.items;
    const n = items.length;
    const hasBottom = n % 2 === 1;
    const sideCount = Math.floor(n / 2);
    // 產生槽位（角度：以 12 點鐘為 0°，順時針）
    const slots = [];
    for (let k = 0; k < sideCount; k++) {
        const t = sideCount === 1 ? 0.5 : k / (sideCount - 1);
        slots.push({ theta: -(52 + t * 76), side: 'left', row: k });   // 左：-52° → -128°
        slots.push({ theta: 52 + t * 76, side: 'right', row: k });     // 右：52° → 128°
    }
    if (hasBottom) slots.push({ theta: 180, side: 'bottom', row: sideCount });

    const rx = 300, ry = 190;
    items.forEach((it, i) => {
        const slot = slots[i] || slots[slots.length - 1];
        const rad = slot.theta * Math.PI / 180;
        let ix = cx + rx * Math.sin(rad);
        let iy = cy - ry * Math.cos(rad);
        // 底部槽位：夾住避免超出畫布
        if (slot.side === 'bottom') iy = Math.min(iy, 540 - 38);
        const anim = 2 + i;

        // 連接線（中心邊緣 → icon 邊緣）
        const dx = ix - cx, dy = iy - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const sx = cx + dx / dist * 104, sy = cy + dy / dist * 104;
        const ex = ix - dx / dist * 42, ey = iy - dy / dist * 42;
        els.push(flowline(sx, sy, ex, ey, it.color, anim));

        // icon 圓環節點（自包含 SVG 圖片）
        els.push(iconImg(ix, iy, 66, it.icon, it.color, { ring: true, anim }));

        // 文字（在 icon 外側；底部槽位放右側避免出界）
        const labelHtml = `<b style="font-size:16px;color:${it.color};">${esc(it.label)}</b>`;
        const descHtml = `<span style="font-size:12px;color:#5f6b7a;">${esc(it.desc)}</span>`;
        if (slot.side === 'left') {
            els.push(txt(ix - 33 - 20 - 190, iy - 24, 190, 24, labelHtml, { fontSize: 16, align: 'right', anim }));
            els.push(txt(ix - 33 - 20 - 190, iy + 1, 190, 40, descHtml, { fontSize: 12, align: 'right', anim }));
        } else {
            // right 與 bottom 都放右側
            els.push(txt(ix + 33 + 8, iy - 24, 190, 24, labelHtml, { fontSize: 16, align: 'left', anim }));
            els.push(txt(ix + 33 + 8, iy + 1, 190, 40, descHtml, { fontSize: 12, align: 'left', anim }));
        }
    });

    return els;
}

// ── 卡片版型 ──
function buildCards(spec) {
    const els = [];
    const { elements: headerEls, contentTop } = buildHeader(spec);
    els.push(...headerEls);

    const items = spec.items;
    const n = items.length;
    const rows = n <= 4 ? 1 : 2;
    const cols = rows === 1 ? n : Math.ceil(n / 2);
    const x0 = 48, totalW = 864, gap = 16;
    const cardW = (totalW - (cols - 1) * gap) / cols;
    const footerH = spec.footer ? 60 : 0;
    const y0 = contentTop + 8;
    const availH = 530 - y0 - footerH;
    const cardH = rows === 1 ? availH : (availH - gap) / 2;
    const compact = cardH < 220; // 兩排時採緊湊排版

    items.forEach((it, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const px = x0 + col * (cardW + gap);
        const py = y0 + row * (cardH + gap);
        const anim = 1 + i;

        // 卡片底
        els.push(rect(px, py, cardW, cardH, tint(it.color, 0.09), { radius: 14, anim }));

        // 頁首列：編號 + 標題
        let headX = px + 16;
        if (it.num) {
            els.push(badgeImg(px + 30, py + 30, 28, it.num, it.color, anim));
            headX = px + 50;
        }
        els.push(txt(headX, py + 17, px + cardW - headX - 12, 26,
            `<b style="font-size:${compact ? 15 : 17}px;color:#1e293b;">${esc(it.label)}</b>`,
            { fontSize: compact ? 15 : 17, anim }));

        if (compact) {
            // 緊湊：icon 靠左、說明在右
            els.push(iconImg(px + 40, py + cardH / 2 + 14, 42, it.icon, it.color, { anim }));
            els.push(txt(px + 74, py + 52, cardW - 88, cardH - 62,
                `<span style="font-size:12px;color:#475569;line-height:1.55;">${esc(it.desc)}</span>`,
                { fontSize: 12, anim }));
        } else {
            // 標準：大 icon 置中 + 說明 + 提示框
            els.push(iconImg(px + cardW / 2, py + 92, 56, it.icon, it.color, { anim }));
            const descY = py + 132;
            const hintH = it.hint ? 48 : 0;
            els.push(txt(px + 14, descY, cardW - 28, cardH - (descY - py) - hintH - 14,
                `<span style="font-size:12.5px;color:#475569;line-height:1.6;">${esc(it.desc)}</span>`,
                { fontSize: 12, align: 'center', anim }));
            if (it.hint) {
                els.push(rect(px + 12, py + cardH - 56, cardW - 24, 44, tint(it.color, 0.13), { radius: 10, anim }));
                els.push(txt(px + 20, py + cardH - 50, cardW - 40, 34,
                    `<div style="display:flex;align-items:center;height:100%;"><span style="font-size:11px;color:#44403c;line-height:1.4;">💡 ${esc(it.hint)}</span></div>`,
                    { fontSize: 11, anim }));
            }
        }
    });

    // 底部總結列
    if (spec.footer) {
        const anim = 1 + n;
        const fy = 530 - 50;
        els.push(rect(60, fy, 840, 48, tint(spec.footer.color, 0.11), { radius: 12, anim }));
        const iconHtml = spec.footer.icon
            ? inlineIcon(spec.footer.icon, 22, spec.footer.color, 'margin-right:8px;') : '';
        els.push(txt(80, fy + 10, 800, 30,
            `${iconHtml}<b style="font-size:15px;color:#334155;">${esc(spec.footer.text)}</b>`,
            { fontSize: 15, align: 'center', anim }));
    }

    return els;
}

// ── 列表版型 ──
function buildList(spec) {
    const els = [];
    const { elements: headerEls, contentTop } = buildHeader(spec);
    els.push(...headerEls);

    const items = spec.items;
    const n = items.length;
    const footerH = spec.footer ? 58 : 0;
    const y0 = contentTop + 6;
    const availH = 528 - y0 - footerH;
    const gap = 10;
    const rowH = Math.min(72, (availH - (n - 1) * gap) / n);

    items.forEach((it, i) => {
        const py = y0 + i * (rowH + gap);
        const anim = 1 + i;
        els.push(rect(80, py, 800, rowH, tint(it.color, 0.07), { radius: 12, anim }));
        els.push(iconImg(80 + 36, py + rowH / 2, Math.min(46, rowH - 14), it.icon, it.color, { ring: true, anim }));
        if (it.num) {
            els.push(txt(80 + 66, py + rowH / 2 - 13, 30, 26,
                `<b style="font-size:16px;color:${it.color};">${esc(it.num)}</b>`, { fontSize: 16, anim }));
        }
        const tx = 80 + (it.num ? 100 : 72);
        els.push(txt(tx, py + rowH / 2 - 24, 300, 24,
            `<b style="font-size:16px;color:#1e293b;">${esc(it.label)}</b>`, { fontSize: 16, anim }));
        els.push(txt(tx, py + rowH / 2 + 1, 860 - tx - 20, 22,
            `<span style="font-size:12px;color:#5f6b7a;">${esc(it.desc)}</span>`, { fontSize: 12, anim }));
    });

    if (spec.footer) {
        const anim = 1 + n;
        const fy = 528 - 48;
        els.push(rect(80, fy, 800, 46, tint(spec.footer.color, 0.11), { radius: 12, anim }));
        els.push(txt(100, fy + 10, 760, 28,
            `<b style="font-size:14px;color:#334155;">${esc(spec.footer.text)}</b>`,
            { fontSize: 14, align: 'center', anim }));
    }
    return els;
}

/** 主入口：規格 → 元素陣列（含動畫） */
export function buildFromSpec(spec) {
    let elements;
    switch (spec.pattern) {
        case 'radial': elements = buildRadial(spec); break;
        case 'list': elements = buildList(spec); break;
        case 'cards':
        case 'freeform':
        default: elements = buildCards(spec); break;
    }
    return { elements, background: spec.background || '#ffffff' };
}

/** 一鍵完整轉換 */
export async function convertImage(fileOrDataUrl, { onProgress } = {}) {
    onProgress?.('壓縮圖片中…');
    const prepared = await prepareImage(fileOrDataUrl);
    const spec = await analyzeImage(prepared, { onProgress });
    onProgress?.('重建版面中…');
    const { elements, background } = buildFromSpec(spec);
    return { spec, elements, background, displayUrl: prepared.displayUrl };
}
