/**
 * 動態漸層背景系統
 * 提供預設動態漸層主題，可套用到任何容器
 * 
 * 用法：
 *   import { animatedBg } from './animatedBg.js';
 *   animatedBg.apply(containerEl, 'aurora');
 *   animatedBg.remove(containerEl);
 * 
 * slide.background 格式：'animated:主題名稱'
 *   例如：'animated:aurora', 'animated:ocean', 'animated:sunset'
 */

export const ANIMATED_THEMES = {
    // ── 深色系 ──
    aurora: {
        name: '極光',
        colors: ['#00d2ff', '#7b2ff7', '#ff0080', '#00d2ff'],
        angle: -45, duration: 8, bgSize: 300,
    },
    ocean: {
        name: '深海',
        colors: ['#0f172a', '#1e3a5f', '#0ea5e9', '#0f172a'],
        angle: -45, duration: 10, bgSize: 300,
    },
    galaxy: {
        name: '銀河',
        colors: ['#0c0a1a', '#1e1b4b', '#4c1d95', '#7c3aed', '#0c0a1a'],
        angle: -45, duration: 12, bgSize: 400,
    },
    midnight: {
        name: '午夜',
        colors: ['#0f0c29', '#302b63', '#24243e', '#0f0c29'],
        angle: -45, duration: 12, bgSize: 300,
    },
    lava: {
        name: '熔岩',
        colors: ['#7f1d1d', '#dc2626', '#f97316', '#7f1d1d'],
        angle: -45, duration: 7, bgSize: 300,
    },
    emerald: {
        name: '翡翠',
        colors: ['#022c22', '#065f46', '#10b981', '#022c22'],
        angle: 135, duration: 9, bgSize: 300,
    },
    neon: {
        name: '霓虓',
        colors: ['#7c3aed', '#ec4899', '#06b6d4', '#7c3aed'],
        angle: -45, duration: 6, bgSize: 300,
    },
    obsidian: {
        name: '黑曜石',
        colors: ['#0a0a0a', '#1a1a2e', '#16213e', '#0a0a0a'],
        angle: -45, duration: 14, bgSize: 300,
    },
    nebula: {
        name: '星雲',
        colors: ['#0d0221', '#261447', '#6b21a8', '#a855f7', '#0d0221'],
        angle: 135, duration: 10, bgSize: 400,
    },
    abyss: {
        name: '深淵',
        colors: ['#020617', '#0c4a6e', '#164e63', '#020617'],
        angle: -45, duration: 12, bgSize: 350,
    },
    inferno: {
        name: '烈焰',
        colors: ['#1c0800', '#7f1d1d', '#ea580c', '#fbbf24', '#1c0800'],
        angle: -45, duration: 8, bgSize: 400,
    },
    cyber: {
        name: '賽博',
        colors: ['#0a0a1a', '#00f5d4', '#7b2ff7', '#f72585', '#0a0a1a'],
        angle: -45, duration: 7, bgSize: 400,
    },

    // ── 淺色 / 柔和系 ──
    sakura: {
        name: '櫻花',
        colors: ['#fdf2f8', '#fbcfe8', '#f9a8d4', '#fdf2f8'],
        angle: 135, duration: 10, bgSize: 300,
    },
    warmth: {
        name: '暖陽',
        colors: ['#fff7ed', '#fed7aa', '#fdba74', '#fff7ed'],
        angle: 135, duration: 8, bgSize: 300,
    },
    candy: {
        name: '糖果',
        colors: ['#fecdd3', '#c4b5fd', '#a5f3fc', '#fecdd3'],
        angle: 135, duration: 8, bgSize: 300,
    },
    lavender: {
        name: '薰衣草',
        colors: ['#f5f3ff', '#ddd6fe', '#c4b5fd', '#f5f3ff'],
        angle: 135, duration: 10, bgSize: 300,
    },
    peach: {
        name: '蜜桃',
        colors: ['#fff1f2', '#fecdd3', '#fda4af', '#fdba74', '#fff1f2'],
        angle: 135, duration: 9, bgSize: 400,
    },
    mint: {
        name: '薄荷',
        colors: ['#ecfdf5', '#a7f3d0', '#6ee7b7', '#ecfdf5'],
        angle: 135, duration: 10, bgSize: 300,
    },
    cloud: {
        name: '雲彩',
        colors: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#f0f9ff'],
        angle: 135, duration: 12, bgSize: 300,
    },
    champagne: {
        name: '香檳',
        colors: ['#fefce8', '#fef9c3', '#fde68a', '#fcd34d', '#fefce8'],
        angle: 135, duration: 9, bgSize: 400,
    },

    // ── 特殊質感 ──
    sunset: {
        name: '晚霞',
        colors: ['#f97316', '#ec4899', '#8b5cf6', '#f97316'],
        angle: -45, duration: 8, bgSize: 300,
    },
    forest: {
        name: '森林',
        colors: ['#064e3b', '#059669', '#34d399', '#064e3b'],
        angle: -45, duration: 10, bgSize: 300,
    },
    copper: {
        name: '古銅',
        colors: ['#292524', '#78350f', '#b45309', '#d97706', '#292524'],
        angle: 135, duration: 10, bgSize: 400,
    },
    arctic: {
        name: '極地',
        colors: ['#e0f2fe', '#7dd3fc', '#38bdf8', '#0284c7', '#e0f2fe'],
        angle: -45, duration: 9, bgSize: 400,
    },
};

// CSS keyframes 名稱（確保全局只注入一次）
let _stylesInjected = false;

function _injectGlobalStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;

    const style = document.createElement('style');
    style.id = 'animated-bg-styles';
    style.textContent = `
        @keyframes animatedBgShift {
            0%   { background-position: 0% 50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
    `;
    document.head.appendChild(style);
}

/**
 * 判斷背景值是否為動態漸層
 */
export function isAnimatedBg(bg) {
    return typeof bg === 'string' && bg.startsWith('animated:');
}

/**
 * 從背景值解析主題名稱
 */
export function parseThemeKey(bg) {
    if (!isAnimatedBg(bg)) return null;
    return bg.replace('animated:', '');
}

/**
 * 取得主題的靜態預覽漸層（用於色板 swatch）
 */
export function getPreviewGradient(themeKey) {
    const theme = ANIMATED_THEMES[themeKey];
    if (!theme) return '#ccc';
    return `linear-gradient(${theme.angle}deg, ${theme.colors.join(', ')})`;
}

/**
 * 套用動態漸層到容器
 */
export function applyAnimatedBg(el, bg) {
    if (!el) return;
    const themeKey = parseThemeKey(bg);
    const theme = ANIMATED_THEMES[themeKey];
    if (!theme) {
        removeAnimatedBg(el);
        return;
    }

    _injectGlobalStyles();

    el.style.background = `linear-gradient(${theme.angle}deg, ${theme.colors.join(', ')})`;
    el.style.backgroundSize = `${theme.bgSize}% ${theme.bgSize}%`;
    el.style.animation = `animatedBgShift ${theme.duration}s ease infinite`;
}

/**
 * 移除動態漸層
 */
export function removeAnimatedBg(el) {
    if (!el) return;
    // 只清除動態漸層相關的 animation，保留其他 animation
    if (el.style.animation && el.style.animation.includes('animatedBgShift')) {
        el.style.animation = '';
    }
    el.style.backgroundSize = '';
}

/**
 * 通用背景套用（自動判斷是動態漸層、靜態漸層還是純色）
 */
export function applyBackground(el, bg) {
    if (!el) return;

    // 先清掉舊的動態漸層
    removeAnimatedBg(el);

    if (!bg || bg === '#ffffff') {
        el.style.background = 'white';
        return;
    }

    if (isAnimatedBg(bg)) {
        applyAnimatedBg(el, bg);
    } else {
        el.style.background = bg;
    }
}

export const animatedBg = {
    THEMES: ANIMATED_THEMES,
    isAnimated: isAnimatedBg,
    parseThemeKey,
    getPreviewGradient,
    apply: applyAnimatedBg,
    remove: removeAnimatedBg,
    applyBackground,
};
