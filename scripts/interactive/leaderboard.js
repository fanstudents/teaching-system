/**
 * 排行榜互動元件 — LeaderboardGame
 * 組別 + 個人分數排行，支援 Tab 切換、彩色進度條
 */

import { stateManager } from './stateManager.js';

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const mi = (name, sz = 20) => `<span class="material-symbols-outlined" style="font-size:${sz}px">${name}</span>`;

const BAR_COLORS = [
    '#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899',
    '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#ef4444',
];
const MEDAL = ['🥇', '🥈', '🥉'];

export class LeaderboardGame {

    constructor() {
        this._timer = null;
        this._destroyed = false;
        this._lastHash = '';
        this._firstRender = true;
    }

    /* ─── 編輯器預覽 ─── */
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
        ];

        el.innerHTML = `<div class="lb-root lb-preview">${this._shell(mode, true)}
            <div class="lb-body">
                ${mode !== 'personal' ? this._buildList(fakeGroups, 'group', false, false) : ''}
                ${mode !== 'group' ? this._buildList(fakePersonal, 'personal', false, false) : ''}
            </div>
        </div>`;
    }

    /* ─── 即時模式 ─── */
    render(el, element) {
        this._el = el;
        this._element = element;
        this._activeTab = (element.lbMode === 'personal') ? 'personal' : 'group';
        this._destroyed = false;
        this._lastHash = '';
        this._firstRender = true;

        const isDark = this._detectDark(el);
        this._isDark = isDark;

        const mode = element.lbMode || 'group';
        el.innerHTML = `<div class="lb-root${isDark ? ' lb-dark' : ''}">${this._shell(mode, false)}
            <div class="lb-body">
                <div class="lb-loading">${mi('hourglass_top', 20)} 載入中…</div>
            </div>
        </div>`;

        // Tab events
        if (mode !== 'both') {
            this._syncTabs();
            el.querySelectorAll('.lb-tab').forEach(btn => {
                btn.addEventListener('click', () => {
                    this._activeTab = btn.dataset.tab;
                    this._syncTabs();
                    this._lastHash = ''; // force re-render on tab switch
                    this._renderData(true);
                });
            });
        }

        this._fetchAndRender();
        this._timer = setInterval(() => this._fetchAndRender(), 6000);
    }

    /* ─── Shell HTML ─── */
    _shell(mode, isPreview) {
        const tabActive = this._activeTab || (mode === 'personal' ? 'personal' : 'group');
        return `
            <div class="lb-header">
                <span class="lb-header-icon">🏆</span>
                <span class="lb-header-title">排行榜</span>
                <span class="lb-header-badge">${isPreview ? '預覽' : `${mi('sync', 11)} 即時`}</span>
            </div>
            ${mode === 'both' ? '' : `
            <div class="lb-tabs">
                <button class="lb-tab${tabActive === 'group' ? ' active' : ''}" data-tab="group">🏆 組別排行</button>
                <button class="lb-tab${tabActive === 'personal' ? ' active' : ''}" data-tab="personal">👤 個人排行</button>
            </div>`}`;
    }

    _syncTabs() {
        this._el.querySelectorAll('.lb-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === this._activeTab);
        });
    }

    /* ─── Fetch ─── */
    async _fetchAndRender() {
        if (this._destroyed) return;

        let sessionId = '';
        try { sessionId = window._activeSessionUUID || stateManager.getSessionCode() || ''; } catch {}
        if (!sessionId) { this._renderEmpty('尚未開始場次'); return; }

        try {
            const [g, p] = await Promise.all([
                stateManager.getGroupLeaderboard(sessionId).catch(() => []),
                stateManager.getLeaderboard(sessionId).catch(() => []),
            ]);
            this._groupData = g || [];
            this._personalData = p || [];
            this._renderData(false);
        } catch (e) {
            console.warn('[LeaderboardGame] fetch:', e);
        }
    }

    /* ─── Render data (with hash check) ─── */
    _renderData(forceAnimate = false) {
        if (this._destroyed) return;
        const body = this._el?.querySelector('.lb-body');
        if (!body) return;

        const mode = this._element.lbMode || 'group';
        const topN = this._element.lbTopN || 10;
        const isDark = this._isDark;

        let gSlice = this._groupData || [];
        let pSlice = this._personalData || [];
        if (topN > 0) { gSlice = gSlice.slice(0, topN); pSlice = pSlice.slice(0, topN); }

        // Hash check — skip DOM rebuild if unchanged
        const hash = JSON.stringify({ tab: this._activeTab, g: gSlice, p: pSlice, mode });
        if (hash === this._lastHash) return;
        this._lastHash = hash;

        const animate = this._firstRender || forceAnimate;
        this._firstRender = false;

        if (mode === 'both') {
            body.innerHTML = `
                <div class="lb-col">${this._buildList(gSlice, 'group', animate, isDark)}</div>
                <div class="lb-col">${this._buildList(pSlice, 'personal', animate, isDark)}</div>`;
        } else if (this._activeTab === 'group') {
            body.innerHTML = this._buildList(gSlice, 'group', animate, isDark);
        } else {
            body.innerHTML = this._buildList(pSlice, 'personal', animate, isDark);
        }
    }

    /* ─── Build list HTML ─── */
    _buildList(data, type, animate, isDark) {
        if (!data?.length) {
            return `<div class="lb-empty">${mi('emoji_events', 36)}<span>尚無資料</span></div>`;
        }

        const maxScore = Math.max(...data.map(d => d.totalPoints)) || 1;
        const label = type === 'group' ? '🏆 組別排行' : '👤 個人排行';

        return `<div class="lb-list">
            <div class="lb-list-label">${label}</div>
            ${data.map((item, i) => {
                const rank = i + 1;
                const medal = i < 3 ? MEDAL[i] : '';
                const pct = Math.max(6, (item.totalPoints / maxScore) * 100);
                const color = BAR_COLORS[i % BAR_COLORS.length];
                const delay = animate ? i * 60 : 0;
                const animCls = animate ? ' lb-anim' : '';
                const tierCls = rank <= 3 ? ` lb-tier-${rank}` : '';
                const pts = item.totalPoints;

                if (type === 'group') {
                    const name = esc(item.groupName || '第 ' + item.group + ' 組');
                    const mc = item.memberCount || 0;
                    const avg = item.avgPoints || 0;
                    return `<div class="lb-row${tierCls}${animCls}" style="--delay:${delay}ms">
                        <div class="lb-rank">${medal || rank}</div>
                        <div class="lb-info">
                            <div class="lb-name-row">
                                <span class="lb-name">${name}</span>
                                <span class="lb-meta">${mc}人 · 均${avg}</span>
                            </div>
                            <div class="lb-bar-track"><div class="lb-bar" style="width:${pct}%;background:${color}"></div></div>
                        </div>
                        <div class="lb-pts">${pts}</div>
                    </div>`;
                } else {
                    const name = esc(item.name || '?');
                    return `<div class="lb-row${tierCls}${animCls}" style="--delay:${delay}ms">
                        <div class="lb-rank">${medal || rank}</div>
                        <div class="lb-info">
                            <div class="lb-name-row"><span class="lb-name">${name}</span></div>
                            <div class="lb-bar-track"><div class="lb-bar" style="width:${pct}%;background:${color}"></div></div>
                        </div>
                        <div class="lb-pts">${pts}</div>
                    </div>`;
                }
            }).join('')}
        </div>`;
    }

    _renderEmpty(msg) {
        const body = this._el?.querySelector('.lb-body');
        if (!body) return;
        body.innerHTML = `<div class="lb-empty">${mi('emoji_events', 36)}<span>${msg}</span></div>`;
    }

    _detectDark(el) {
        try {
            const parent = el.closest('.presentation-slide') || el.parentElement;
            if (!parent) return false;
            const bg = getComputedStyle(parent).backgroundColor;
            if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return false;
            const m = bg.match(/\d+/g);
            if (m?.length >= 3) return (parseInt(m[0]) * 0.299 + parseInt(m[1]) * 0.587 + parseInt(m[2]) * 0.114) < 128;
        } catch {}
        return false;
    }

    destroy() {
        this._destroyed = true;
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    }
}

/* ── 注入樣式 ── */
if (typeof document !== 'undefined' && !document.getElementById('lb-style')) {
    const s = document.createElement('style');
    s.id = 'lb-style';
    s.textContent = `
/* ═══ Leaderboard Root ═══ */
.lb-root {
    height: 100%; display: flex; flex-direction: column; overflow: hidden;
    font-family: 'Inter', 'Noto Sans TC', system-ui, sans-serif;
    color: #1e293b;
}
.lb-root.lb-dark { color: #f1f5f9; }

/* ── Header ── */
.lb-header {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 20px 8px; flex-shrink: 0;
}
.lb-header-icon { font-size: 24px; }
.lb-header-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; }
.lb-header-badge {
    margin-left: auto; font-size: 10px; font-weight: 600;
    color: #94a3b8; display: flex; align-items: center; gap: 3px;
    background: rgba(148,163,184,0.1); padding: 2px 8px; border-radius: 10px;
}

/* ── Tabs ── */
.lb-tabs {
    display: flex; gap: 4px; padding: 0 20px 10px; flex-shrink: 0;
}
.lb-tab {
    flex: 1; padding: 7px 0; border: none; border-radius: 8px;
    font-size: 12px; font-weight: 600; cursor: pointer;
    font-family: inherit; transition: all .2s;
    background: #f1f5f9; color: #64748b;
}
.lb-dark .lb-tab { background: rgba(255,255,255,0.06); color: #94a3b8; }
.lb-tab.active {
    background: #1a73e8; color: #fff;
    box-shadow: 0 2px 8px rgba(26,115,232,.3);
}

/* ── Body ── */
.lb-body {
    flex: 1; overflow-y: auto; padding: 0 20px 20px;
    display: flex; gap: 16px;
}
.lb-col { flex: 1; min-width: 0; }
.lb-loading, .lb-empty {
    display: flex; align-items: center; justify-content: center;
    width: 100%; padding: 48px 20px; color: #94a3b8;
    flex-direction: column; gap: 8px; font-size: 14px;
}

/* ── List ── */
.lb-list { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.lb-list-label {
    font-size: 11px; font-weight: 700; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.04em;
    margin-bottom: 4px; padding-left: 2px;
}
.lb-dark .lb-list-label { color: #64748b; }

/* ── Row ── */
.lb-row {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 10px;
    background: #fff; border: 1px solid #f1f5f9;
    transition: transform .15s, box-shadow .15s;
}
.lb-dark .lb-row { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.06); }
.lb-row:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
.lb-dark .lb-row:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.2); }

/* Tier highlights */
.lb-row.lb-tier-1 { border-color: #fbbf24; background: linear-gradient(135deg, #fffbeb 0%, #fff 100%); }
.lb-row.lb-tier-2 { border-color: #d1d5db; background: linear-gradient(135deg, #f9fafb 0%, #fff 100%); }
.lb-row.lb-tier-3 { border-color: #fdba74; background: linear-gradient(135deg, #fff7ed 0%, #fff 100%); }
.lb-dark .lb-row.lb-tier-1 { background: rgba(251,191,36,0.08); border-color: rgba(251,191,36,0.3); }
.lb-dark .lb-row.lb-tier-2 { background: rgba(209,213,219,0.06); border-color: rgba(209,213,219,0.2); }
.lb-dark .lb-row.lb-tier-3 { background: rgba(253,186,116,0.06); border-color: rgba(253,186,116,0.2); }

/* Animation (only applied on first render / tab switch) */
.lb-row.lb-anim {
    opacity: 0; animation: lbSlideIn .35s var(--delay, 0ms) ease forwards;
}
@keyframes lbSlideIn {
    from { opacity: 0; transform: translateX(-12px); }
    to   { opacity: 1; transform: translateX(0); }
}

/* ── Rank ── */
.lb-rank {
    min-width: 30px; text-align: center;
    font-size: 13px; font-weight: 700; color: #94a3b8;
}
.lb-tier-1 .lb-rank, .lb-tier-2 .lb-rank, .lb-tier-3 .lb-rank {
    font-size: 20px;
}

/* ── Info ── */
.lb-info { flex: 1; min-width: 0; }
.lb-name-row {
    display: flex; align-items: baseline; justify-content: space-between;
    margin-bottom: 5px; gap: 8px;
}
.lb-name {
    font-size: 13px; font-weight: 600; color: #1e293b;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.lb-dark .lb-name { color: #f1f5f9; }
.lb-tier-1 .lb-name { font-size: 14px; }

.lb-meta {
    font-size: 11px; color: #94a3b8; white-space: nowrap; flex-shrink: 0;
}

/* ── Bar ── */
.lb-bar-track {
    height: 14px; border-radius: 7px; overflow: hidden;
    background: #f1f5f9;
}
.lb-dark .lb-bar-track { background: rgba(255,255,255,0.06); }
.lb-bar {
    height: 100%; border-radius: 7px;
    transition: width .6s cubic-bezier(.22,1,.36,1);
    min-width: 4px;
}

/* ── Points ── */
.lb-pts {
    min-width: 40px; text-align: right;
    font-size: 16px; font-weight: 800; color: #334155;
    font-variant-numeric: tabular-nums;
}
.lb-dark .lb-pts { color: #e2e8f0; }
.lb-tier-1 .lb-pts { font-size: 20px; color: #d97706; }
.lb-tier-2 .lb-pts { font-size: 18px; color: #6b7280; }
.lb-tier-3 .lb-pts { font-size: 17px; color: #c2410c; }
.lb-dark .lb-tier-1 .lb-pts { color: #fbbf24; }
.lb-dark .lb-tier-2 .lb-pts { color: #9ca3af; }
.lb-dark .lb-tier-3 .lb-pts { color: #fb923c; }

/* ── Preview ── */
.lb-preview .lb-row { pointer-events: none; }
`;
    document.head.appendChild(s);
}
