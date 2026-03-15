/**
 * AI Tools Logo Registry — 共用 AI 工具 logo 資料庫
 * 供課綱系統、簡報系統等模組共用
 * 
 * 使用方式：
 * import { getToolLogo, AI_TOOLS_REGISTRY } from './aiToolsRegistry.js';
 * const logo = getToolLogo('ChatGPT');
 */

export const AI_TOOLS_REGISTRY = [
    { name: 'ChatGPT', slug: 'chatgpt', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', url: 'https://chat.openai.com', category: 'llm' },
    { name: 'Gemini', slug: 'gemini', logo: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690b6.svg', url: 'https://gemini.google.com', category: 'llm' },
    { name: 'Claude', slug: 'claude', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Anthropic_logo_2025.svg/800px-Anthropic_logo_2025.svg.png', url: 'https://claude.ai', category: 'llm' },
    { name: 'Copilot', slug: 'copilot', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Microsoft_365_Copilot_Icon.svg', url: 'https://copilot.microsoft.com', category: 'llm' },
    { name: 'Perplexity', slug: 'perplexity', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Perplexity_AI_logo.svg', url: 'https://www.perplexity.ai', category: 'search' },
    { name: 'NotebookLM', slug: 'notebooklm', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/58/NotebookLM_icon.svg', url: 'https://notebooklm.google.com', category: 'knowledge' },
    { name: 'Gamma', slug: 'gamma', logo: 'https://assets-global.website-files.com/6537a67c83a22a5e41e9d55c/6537a67c83a22a5e41e9d639_Gamma_V2_Logo.svg', url: 'https://gamma.app', category: 'presentation' },
    { name: 'Notion', slug: 'notion', logo: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png', url: 'https://www.notion.so', category: 'productivity' },
    { name: 'Canva', slug: 'canva', logo: 'https://static.canva.com/web/images/12487a1e0770d29571e580e0e3f9e839.svg', url: 'https://www.canva.com', category: 'design' },
    { name: 'Lovable', slug: 'lovable', logo: '/assets/images/lovable-icon.png', url: 'https://lovable.dev', category: 'nocode' },
    { name: 'Cursor', slug: 'cursor', logo: 'https://us-east-1.tixte.net/uploads/files.tixte.co/Cursor_Logo.png', url: 'https://cursor.sh', category: 'coding' },
    { name: 'v0', slug: 'v0', logo: 'https://v0.dev/apple-touch-icon.png', url: 'https://v0.dev', category: 'coding' },
    { name: 'Midjourney', slug: 'midjourney', logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e6/Midjourney_Emblem.png', url: 'https://midjourney.com', category: 'image' },
    { name: 'Google AI Studio', slug: 'google-ai-studio', logo: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690b6.svg', url: 'https://aistudio.google.com', category: 'llm' },
    { name: 'Gemini Canvas', slug: 'gemini-canvas', logo: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690b6.svg', url: 'https://gemini.google.com', category: 'collaboration' },
    { name: 'Visual Studio Code', slug: 'vscode', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Visual_Studio_Code_1.35_icon.svg', url: 'https://code.visualstudio.com', category: 'coding' },
    { name: 'HeyGen', slug: 'heygen', logo: 'https://cdn.prod.website-files.com/63060f4cf41940383d43daae/674e0d044c83cd93907f0f62_HeyGen_Social_Icon.png', url: 'https://heygen.com', category: 'video' },
    { name: 'Napkin AI', slug: 'napkin-ai', logo: 'https://napkin.ai/apple-touch-icon.png', url: 'https://napkin.ai', category: 'visual' },
    { name: 'Suno', slug: 'suno', logo: 'https://suno.com/apple-touch-icon.png', url: 'https://suno.com', category: 'audio' },
    { name: 'Runway', slug: 'runway', logo: 'https://upload.wikimedia.org/wikipedia/en/5/54/Runway_AI_Logo.png', url: 'https://runwayml.com', category: 'video' },
    { name: 'DALL-E', slug: 'dall-e', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', url: 'https://openai.com/dall-e', category: 'image' },
    { name: 'GitHub Copilot', slug: 'github-copilot', logo: 'https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png', url: 'https://github.com/features/copilot', category: 'coding' },
    { name: 'Bolt', slug: 'bolt', logo: 'https://bolt.new/apple-touch-icon.png', url: 'https://bolt.new', category: 'nocode' },
    { name: 'Dify', slug: 'dify', logo: 'https://assets.dify.ai/logo/logo-site.png', url: 'https://dify.ai', category: 'platform' },
    { name: 'Coze', slug: 'coze', logo: 'https://lf-coze-web-cdn.coze.com/obj/coze-web-cn/obric/coze/favicon.1970.png', url: 'https://coze.com', category: 'platform' },
    { name: 'Make', slug: 'make', logo: 'https://images.ctfassets.net/qqlj6g4ee76j/2IZnmYhOKNoqFGDCfXBM0Z/901e56e2ebf59b1b2380bb2cec40ce77/make_logo_symbol.svg', url: 'https://make.com', category: 'automation' },
    { name: 'Zapier', slug: 'zapier', logo: 'https://cdn.zapier.com/zapier/images/favicon.ico', url: 'https://zapier.com', category: 'automation' },
    { name: 'Miro', slug: 'miro', logo: 'https://miro.com/apple-touch-icon.png', url: 'https://miro.com', category: 'collaboration' },
    { name: 'Tome', slug: 'tome', logo: 'https://tome.app/apple-touch-icon.png', url: 'https://tome.app', category: 'presentation' },
    { name: 'Beautiful.ai', slug: 'beautiful-ai', logo: 'https://www.beautiful.ai/favicon.ico', url: 'https://www.beautiful.ai', category: 'presentation' },
    { name: 'Poe', slug: 'poe', logo: 'https://poe.com/apple-touch-icon.png', url: 'https://poe.com', category: 'llm' },
    { name: 'Stable Diffusion', slug: 'stable-diffusion', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Stability_AI_logo.svg', url: 'https://stability.ai', category: 'image' },
    { name: 'ElevenLabs', slug: 'elevenlabs', logo: 'https://elevenlabs.io/apple-touch-icon.png', url: 'https://elevenlabs.io', category: 'audio' },
    { name: 'Figma', slug: 'figma', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg', url: 'https://figma.com', category: 'design' },
    { name: 'Replit', slug: 'replit', logo: 'https://replit.com/public/images/sm-thumbnail.png', url: 'https://replit.com', category: 'coding' },
    { name: 'Windsurf', slug: 'windsurf', logo: 'https://windsurf.com/apple-touch-icon.png', url: 'https://windsurf.com', category: 'coding' },
];

// Build lookup map (name → logo) for fast access
const _logoMap = new Map();
AI_TOOLS_REGISTRY.forEach(t => {
    _logoMap.set(t.name.toLowerCase(), t.logo);
    _logoMap.set(t.slug.toLowerCase(), t.logo);
    // Also add no-space version
    _logoMap.set(t.name.toLowerCase().replace(/[\s.\-]+/g, ''), t.logo);
});

/**
 * Get logo URL for a tool name (case-insensitive, fuzzy match)
 * @param {string} toolName - e.g. "ChatGPT", "chatgpt", "Google AI Studio"
 * @param {string} [fallback] - existing logo URL to use if found, or ''
 * @returns {string} logo URL or ''
 */
export function getToolLogo(toolName, fallback = '') {
    if (fallback) return fallback;
    if (!toolName) return '';
    const key = toolName.toLowerCase().replace(/[\s.\-]+/g, '');
    return _logoMap.get(key) || _logoMap.get(toolName.toLowerCase()) || '';
}

/**
 * Get full tool info by name
 * @param {string} toolName
 * @returns {object|null}
 */
export function getToolInfo(toolName) {
    if (!toolName) return null;
    const key = toolName.toLowerCase().replace(/[\s.\-]+/g, '');
    return AI_TOOLS_REGISTRY.find(t =>
        t.name.toLowerCase() === toolName.toLowerCase() ||
        t.slug === key ||
        t.name.toLowerCase().replace(/[\s.\-]+/g, '') === key
    ) || null;
}

/**
 * Get URL for a tool, respecting custom overrides (affiliate links)
 * @param {string} toolName
 * @param {string} [fallback] - existing URL to use if found
 * @returns {string}
 */
export function getToolUrl(toolName, fallback = '') {
    if (!toolName) return fallback;
    const info = getToolInfo(toolName);
    if (!info) return fallback;
    // Check localStorage overrides
    try {
        const overrides = JSON.parse(localStorage.getItem('ai_tool_overrides') || '{}');
        if (overrides[info.slug]?.url) return overrides[info.slug].url;
    } catch (e) { /* ignore */ }
    return fallback || info.url || '';
}
