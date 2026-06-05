/**
 * 排行榜互動元件 — LeaderboardGame
 * 組別 + 個人分數排行，支援 Tab 切換、彩色進度條、動畫進場
 */

import { db } from '../supabase.js';
import { stateManager } from './stateManager.js';

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const mi = (name, sz = 20) => `<span class="material-symbols-outlined" style="font-size:${sz}px">${name}</span>`;

const BAR_COLORS = [
    'linear-gradient(90deg, #f59e0b, #fbbf24)',
    'linear-gradient(90deg, #3b82f6, #60a5fa)',
    'linear-gradient(90deg, #22c55e, #4ade80)',
    'linear-gradient(90deg, #8b5cf6, #a78bfa)',
    'linear-gradient(90deg, #ec4899, #f472b6)',
    'linear-gradient(90deg, #06b6d4, #22d3ee)',
    'linear-gradient(90deg, #f97316, #fb923c)',
    'linear-gradient(90deg, #14b8a6, #2dd4bf)',
    'linear-gradient(90deg, #6366f1, #818cf8)',
    'linear-gradient(90deg, #ef4444, #f87171)',
];

const MEDAL = ['🥇', '🥈', '🥉'];

export class LeaderboardGame {

    /* ─── 編輯器預覽（靜態假資料） ─── */
    renderPreview(el, element) {
        const mode = element.lbMode || 'group';

        const fakeGroups = [
            { groupName: '第 1 組', totalPoints: 850, avgPoints: 170, memberCount: 5 },
            { groupName: '第 2 組', totalPoints: 720, avgPoints: 144, memberCount: 5 },
            { groupName: '第 3 組', totalPoints: 680, avgPoints: 136, memberCount: 5 },
        ];
        const fakePersonal = [
            { name: '冠軍同學', totalPoints: 320 },
            { name: '亞軍同學', totalPoints: 275 },
            { name: '季軍同學', totalPoints: 240 },
            { name: '同學 D', totalPoints: 180 },
            { name: '同學 E', totalPoints: 120 },
        ];

        const tabActive = mode === 'personal' ? 'personal' : 'group';

        el.innerHTML = `
        <div class="lb-root lb-root--preview" style="height:100%;display:flex;flex-direction:column;overflow:hidden;font-family:'Inter','Noto Sans TC',system-ui,sans-serif;">
            <div class="lb-header" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;flex-shrink:0;">
                <span style="font-size:22px;">🏆</span>
                <span style="font-size:1rem;font-weight:700;color:#1e293b;">排行榜</span>
                <span style="font-size:11px;color:#94a3b8;margin-left:auto;">預覽模式</span>
            </div>
            ${mode === 'both' ? '' : `
            <div class="lb-tabs" style="display:flex;gap:4px;padding:0 16px 8px;flex-shrink:0;">
                <button class="lb-tab ${tabActive === 'group' ? 'active' : ''}" style="flex:1;padding:6px 0;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;${tabActive === 'group' ? 'background:#1a73e8;color:#fff;box-shadow:0 2px 8px rgba(26,115,232,.25);' : 'background:#f1f5f9;color:#64748b;'}">🏆 組別排行</button>
                <button class="lb-tab ${tabActive === 'personal' ? 'active' : ''}" style="flex:1;padding:6px 0;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;${tabActive === 'personal' ? 'background:#1a73e8;color:#fff;box-shadow:0 2px 8px rgba(26,115,232,.25);' : 'background:#f1f5f9;color:#64748b;'}">👤 個人排行</button>
            </div>`}
            <div class="lb-body" style="flex:1;overflow-y:auto;padding:0 16px 16px;display:flex;gap:12px;">
                ${mode !== 'personal' ? this._buildList(fakeGroups, 'group', true) : ''}
                ${mode !== 'group' ? this._buildList(fakePersonal, 'personal', true) : ''}
            </div>
        </div>`;
    }

    /* ─── 即時模式 ─── */
    render(el, element) {
        this._el = el;
        this._element = element;
        this._activeTab = (element.lbMode === 'personal') ? 'personal' : 'group';
        this._destroyed = false;

        this._renderShell();
        this._fetchAndRender();
        this._timer = setInterval(() => this._fetchAndRender(), 5000);
    }

    _renderShell() {
        const el = this._el;
        const element = this._element;
        const mode = element.lbMode || 'group';

        // 偵測深色背景
        const isDark = this._detectDark(el);
        const bg = isDark ? 'rgba(255,255,255,0.05)' : '#fff';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const subColor = isDark ? '#94a3b8' : '#64748b';

        el.innerHTML = `
        <div class="lb-root" data-dark="${isDark}" style="height:100%;display:flex;flex-direction:column;overflow:hidden;font-family:'Inter','Noto Sans TC',system-ui,sans-serif;color:${textColor};">
            <div class="lb-header" style="display:flex;align-items:center;gap:8px;padding:10px 16px;flex-shrink:0;">
                <span style="font-size:22px;">🏆</span>
                <span style="font-size:1rem;font-weight:700;">排行榜</span>
                <span class="lb-status" style="font-size:11px;color:${subColor};margin-left:auto;display:flex;align-items:center;gap:4px;">
                    ${mi('sync', 12)} 即時更新
                </span>
            </div>
            ${mode === 'both' ? '' : `
            <div class="lb-tabs" style="display:flex;gap:4px;padding:0 16px 8px;flex-shrink:0;">
                <button class="lb-tab" data-tab="group" style="flex:1;padding:6px 0;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;">🏆 組別排行</button>
                <button class="lb-tab" data-tab="personal" style="flex:1;padding:6px 0;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;">👤 個人排行</button>
            </div>`}
            <div class="lb-body" style="flex:1;overflow-y:auto;padding:0 16px 16px;display:flex;gap:12px;">
                <div class="lb-loading" style="display:flex;align-items:center;justify-content:center;width:100%;padding:40px;color:${subColor};gap:8px;">
                    ${mi('hourglass_top', 20)} 載入中…
                </div>
            </div>
        </div>`;

        // Tab 切換事件
        if (mode !== 'both') {
            this._updateTabStyles();
            el.querySelectorAll('.lb-tab').forEach(btn => {
                btn.addEventListener('click', () => {
                    this._activeTab = btn.dataset.tab;
                    this._updateTabStyles();
                    this._renderData();
                });
            });
        }
    }

    _updateTabStyles() {
        const el = this._el;
        const isDark = el.querySelector('.lb-root')?.dataset.dark === 'true';
        el.querySelectorAll('.lb-tab').forEach(btn => {
            const isActive = btn.dataset.tab === this._activeTab;
            if (isActive) {
                btn.style.background = '#1a73e8';
                btn.style.color = '#fff';
                btn.style.boxShadow = '0 2px 8px rgba(26,115,232,.25)';
            } else {
                btn.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9';
                btn.style.color = isDark ? '#94a3b8' : '#64748b';
                btn.style.boxShadow = 'none';
            }
        });
    }

    async _fetchAndRender() {
        if (this._destroyed) return;

        const sessionId = window._activeSessionUUID || stateManager.getSessionCode() || '';
        if (!sessionId) {
            this._renderEmpty('尚未開始場次');
            return;
        }

        try {
            const [groupData, personalData] = await Promise.all([
                stateManager.getGroupLeaderboard(sessionId),
                stateManager.getLeaderboard(sessionId),
            ]);
            this._groupData = groupData || [];
            this._personalData = personalData || [];
            this._renderData();
        } catch (e) {
            console.warn('[LeaderboardGame] fetch failed:', e);
        }
    }

    _renderData() {
        if (this._destroyed) return;
        const body = this._el.querySelector('.lb-body');
        if (!body) return;

        const mode = this._element.lbMode || 'group';
        const topN = this._element.lbTopN || 10;
        const isDark = this._el.querySelector('.lb-root')?.dataset.dark === 'true';

        let groupSlice = this._groupData || [];
        let personalSlice = this._personalData || [];
        if (topN > 0) {
            groupSlice = groupSlice.slice(0, topN);
            personalSlice = personalSlice.slice(0, topN);
        }

        if (mode === 'both') {
            body.innerHTML = `
                <div style="flex:1;min-width:0;">${this._buildList(groupSlice, 'group', false, isDark)}</div>
                <div style="flex:1;min-width:0;">${this._buildList(personalSlice, 'personal', false, isDark)}</div>
            `;
        } else if (this._activeTab === 'group') {
            body.innerHTML = this._buildList(groupSlice, 'group', false, isDark);
        } else {
            body.innerHTML = this._buildList(personalSlice, 'personal', false, isDark);
        }
    }

    _buildList(data, type, isPreview = false, isDark = false) {
        if (!data || data.length === 0) {
            const color = isDark ? '#64748b' : '#94a3b8';
            return `<div style="display:flex;align-items:center;justify-content:center;width:100%;padding:40px;color:${color};flex-direction:column;gap:8px;">
                ${mi('emoji_events', 32)}
                <span>尚無資料</span>
            </div>`;
        }

        const maxScore = Math.max(...data.map(d => type === 'group' ? d.totalPoints : d.totalPoints)) || 1;
        const cardBg = isDark ? 'rgba(255,255,255,0.06)' : '#fff';
        const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9';
        const textMain = isDark ? '#f1f5f9' : '#1e293b';
        const textSub = isDark ? '#94a3b8' : '#64748b';

        return `<div style="display:flex;flex-direction:column;gap:6px;width:100%;">
            ${type === 'group' ? `<div style="font-size:12px;font-weight:600;color:${textSub};margin-bottom:2px;display:flex;align-items:center;gap:4px;">🏆 組別排行</div>` : ''}
            ${type === 'personal' ? `<div style="font-size:12px;font-weight:600;color:${textSub};margin-bottom:2px;display:flex;align-items:center;gap:4px;">👤 個人排行</div>` : ''}
            ${data.map((item, i) => {
                const rank = i + 1;
                const medal = i < 3 ? MEDAL[i] : '';
                const pct = maxScore > 0 ? Math.max(8, (item.totalPoints / maxScore) * 100) : 8;
                const barColor = BAR_COLORS[i % BAR_COLORS.length];
                const delay = isPreview ? 0 : i * 80;
                const animStyle = isPreview ? '' : `opacity:0;animation:lbFadeIn .4s ${delay}ms ease forwards;`;

                if (type === 'group') {
                    return `<div class="lb-card" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${cardBg};border:1px solid ${cardBorder};border-radius:10px;transition:all .2s;${animStyle}">
                        <div style="min-width:28px;text-align:center;font-size:${medal ? '18px' : '13px'};font-weight:700;color:${medal ? '' : textSub};">${medal || '#' + rank}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                                <span style="font-size:13px;font-weight:600;color:${textMain};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(item.groupName || '第 ' + item.group + ' 組')}</span>
                                <span style="font-size:12px;color:${textSub};white-space:nowrap;margin-left:8px;">${mi('person', 12)} ${item.memberCount || 0}人 · 均 ${item.avgPoints || 0}</span>
                            </div>
                            <div style="position:relative;height:18px;background:${isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'};border-radius:9px;overflow:hidden;">
                                <div style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${barColor};border-radius:9px;transition:width .6s ease;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;">
                                    <span style="font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.2);">${item.totalPoints}</span>
                                </div>
                            </div>
                        </div>
                    </div>`;
                } else {
                    return `<div class="lb-card" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${cardBg};border:1px solid ${cardBorder};border-radius:10px;transition:all .2s;${animStyle}">
                        <div style="min-width:28px;text-align:center;font-size:${medal ? '18px' : '13px'};font-weight:700;color:${medal ? '' : textSub};">${medal || '#' + rank}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                                <span style="font-size:13px;font-weight:600;color:${textMain};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(item.name)}</span>
                            </div>
                            <div style="position:relative;height:18px;background:${isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'};border-radius:9px;overflow:hidden;">
                                <div style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${barColor};border-radius:9px;transition:width .6s ease;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;">
                                    <span style="font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.2);">${item.totalPoints}</span>
                                </div>
                            </div>
                        </div>
                    </div>`;
                }
            }).join('')}
        </div>`;
    }

    _renderEmpty(msg) {
        const body = this._el.querySelector('.lb-body');
        if (!body) return;
        body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;padding:40px;color:#94a3b8;flex-direction:column;gap:8px;">
            ${mi('emoji_events', 32)}
            <span>${msg}</span>
        </div>`;
    }

    _detectDark(el) {
        try {
            const parent = el.closest('.presentation-slide') || el.parentElement;
            if (!parent) return false;
            const bg = getComputedStyle(parent).backgroundColor;
            if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return false;
            const m = bg.match(/\d+/g);
            if (m && m.length >= 3) {
                const lum = (parseInt(m[0]) * 0.299 + parseInt(m[1]) * 0.587 + parseInt(m[2]) * 0.114);
                return lum < 128;
            }
        } catch {}
        return false;
    }

    /* ─── 清理 ─── */
    destroy() {
        this._destroyed = true;
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    }
}

/* ── 注入動畫 keyframes ── */
if (typeof document !== 'undefined' && !document.getElementById('lb-anim-style')) {
    const style = document.createElement('style');
    style.id = 'lb-anim-style';
    style.textContent = `
        @keyframes lbFadeIn {
            from { opacity:0; transform:translateY(8px); }
            to   { opacity:1; transform:translateY(0); }
        }
        .lb-card:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
        }
    `;
    document.head.appendChild(style);
}
