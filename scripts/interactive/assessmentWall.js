/**
 * 測驗分數牆 — 顯示全班分數級距長條圖（匿名）
 * 講師端：從 DB 拉 submissions 統計並即時更新
 * 學員端：透過廣播接收統計 + 標示自身所在級距
 */
import { db } from '../supabase.js';

export class AssessmentWallGame {
    constructor() {
        this._pollTimer = null;
    }

    /**
     * 即時渲染（講師端 / 學員端）
     */
    async render(container, element) {
        const wallType = element.wallType || 'pre'; // 'pre' | 'post'
        const title = element.wallTitle || (wallType === 'post' ? '📊 課後測驗分數分布' : '📊 課前測驗分數分布');

        container.innerHTML = `
            <div class="aw-widget" data-wall-type="${wallType}">
                <div class="aw-header">
                    <div class="aw-title">${this._esc(title)}</div>
                    <div class="aw-subtitle">
                        <span class="aw-count">0</span> 人已作答 ・ 即時更新
                    </div>
                </div>
                <div class="aw-chart-area">
                    <div class="aw-chart"></div>
                    <div class="aw-x-labels">
                        <span>0-20</span><span>21-40</span><span>41-60</span><span>61-80</span><span>81-100</span>
                    </div>
                </div>
                <div class="aw-my-score" style="display:none"></div>
            </div>
        `;

        this._startPolling(container, element);
    }

    _startPolling(container, element) {
        if (this._pollTimer) clearInterval(this._pollTimer);
        const update = () => this._fetchAndRender(container, element);
        update();
        this._pollTimer = setInterval(update, 5000);
    }

    async _fetchAndRender(container, element) {
        const chart = container.querySelector('.aw-chart');
        const countEl = container.querySelector('.aw-count');
        const myScoreEl = container.querySelector('.aw-my-score');
        if (!chart) return;

        const wallType = element.wallType || 'pre';

        // 嘗試從廣播資料讀取（學員端）
        let buckets = null;
        let totalCount = 0;
        let myScore = null;

        if (window._assessmentWallData?.[wallType]) {
            const data = window._assessmentWallData[wallType];
            buckets = data.buckets;
            totalCount = data.total;
        } else {
            // 講師端：直接從 DB 讀取
            try {
                const sessionCode = window.app?.sessionCode || '';
                if (!sessionCode) return;

                const { data: subs } = await db.select('submissions', {
                    filter: {
                        session_code: `eq.${sessionCode}`,
                        type: 'eq.assessment',
                    },
                    select: 'state,student_email',
                });

                if (!subs) return;

                // 篩選對應類型(pre/post)的 submissions
                const filtered = subs.filter(s => {
                    let st = s.state;
                    if (typeof st === 'string') try { st = JSON.parse(st); } catch { return false; }
                    return st?.assessmentType === wallType;
                });

                buckets = [0, 0, 0, 0, 0]; // 0-20, 21-40, 41-60, 61-80, 81-100
                for (const s of filtered) {
                    let st = s.state;
                    if (typeof st === 'string') try { st = JSON.parse(st); } catch { continue; }
                    const score = parseInt(st?.score) || 0;
                    const idx = score <= 20 ? 0 : score <= 40 ? 1 : score <= 60 ? 2 : score <= 80 ? 3 : 4;
                    buckets[idx]++;
                }
                totalCount = filtered.length;

                // 廣播給學員端
                if (window.app?.broadcasting) {
                    // 計算平均分
                    let avgScore = 0;
                    if (filtered.length > 0) {
                        const sumScore = filtered.reduce((sum, s) => {
                            let st = s.state;
                            if (typeof st === 'string') try { st = JSON.parse(st); } catch { return sum; }
                            return sum + (parseInt(st?.score) || 0);
                        }, 0);
                        avgScore = Math.round(sumScore / filtered.length);
                    }

                    // 如果是課後牆，也讀取課前平均
                    let preAvg = null;
                    if (wallType === 'post') {
                        const preSubs = subs.filter(s => {
                            let st = s.state;
                            if (typeof st === 'string') try { st = JSON.parse(st); } catch { return false; }
                            return st?.assessmentType === 'pre';
                        });
                        if (preSubs.length > 0) {
                            const preSum = preSubs.reduce((sum, s) => {
                                let st = s.state;
                                if (typeof st === 'string') try { st = JSON.parse(st); } catch { return sum; }
                                return sum + (parseInt(st?.score) || 0);
                            }, 0);
                            preAvg = Math.round(preSum / preSubs.length);
                        }
                    }

                    const { realtime } = await import('../supabase.js');
                    realtime.publish(`session:${sessionCode}`, 'assessment_wall_update', {
                        wallType,
                        buckets,
                        total: totalCount,
                        avgScore,
                        preAvg,
                    });
                }
            } catch (e) {
                console.error('[AssessmentWall] fetch error:', e);
                return;
            }
        }

        if (!buckets) return;

        // 取自身分數（學員端）
        const studentEmail = window._studentEmail || localStorage.getItem('studentEmail') || '';
        if (studentEmail && window._assessmentWallMyScores?.[wallType] !== undefined) {
            myScore = window._assessmentWallMyScores[wallType];
        }

        // 渲染長條圖
        const maxBucket = Math.max(...buckets, 1);
        countEl.textContent = totalCount;

        const labels = ['0-20', '21-40', '41-60', '61-80', '81-100'];
        const colors = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981'];
        const myBucketIdx = myScore !== null
            ? (myScore <= 20 ? 0 : myScore <= 40 ? 1 : myScore <= 60 ? 2 : myScore <= 80 ? 3 : 4)
            : -1;

        chart.innerHTML = buckets.map((count, i) => {
            const pct = Math.max((count / maxBucket) * 100, 4);
            const isMine = i === myBucketIdx;
            return `
                <div class="aw-bar-col ${isMine ? 'aw-bar-mine' : ''}">
                    <div class="aw-bar-count">${count}</div>
                    <div class="aw-bar" style="height:${pct}%;background:${colors[i]};${isMine ? 'box-shadow:0 0 12px ' + colors[i] + '80;' : ''}"></div>
                </div>
            `;
        }).join('');

        // 學員端自身定位
        if (myScore !== null) {
            myScoreEl.style.display = '';
            myScoreEl.innerHTML = `
                <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">person</span>
                你的分數：<strong>${myScore}</strong> 分（位於 <strong style="color:${colors[myBucketIdx]}">${labels[myBucketIdx]}</strong> 級距）
            `;
        }

        // 課後牆：顯示平均分數差
        const broadcastData = window._assessmentWallData?.[wallType];
        const avgScore = broadcastData?.avgScore ?? null;
        const preAvg = broadcastData?.preAvg ?? null;
        let deltaHtml = container.querySelector('.aw-delta');
        if (!deltaHtml) {
            deltaHtml = document.createElement('div');
            deltaHtml.className = 'aw-delta';
            container.querySelector('.aw-widget')?.appendChild(deltaHtml);
        }

        if (wallType === 'post' && avgScore !== null && totalCount > 0) {
            let deltaStr = '';
            if (preAvg !== null) {
                const delta = avgScore - preAvg;
                const deltaColor = delta > 0 ? '#10b981' : delta < 0 ? '#ef4444' : '#94a3b8';
                const arrow = delta > 0 ? 'trending_up' : delta < 0 ? 'trending_down' : 'trending_flat';
                deltaStr = `
                    <div class="aw-delta-row">
                        <span class="material-symbols-outlined" style="font-size:22px;color:${deltaColor}">${arrow}</span>
                        <span>課前平均 <strong>${preAvg}</strong> 分 → 課後平均 <strong>${avgScore}</strong> 分</span>
                        <span class="aw-delta-badge" style="background:${deltaColor}">
                            ${delta > 0 ? '+' : ''}${delta} 分
                        </span>
                    </div>
                `;
            } else {
                deltaStr = `<div class="aw-delta-row"><span>課後平均：<strong>${avgScore}</strong> 分</span></div>`;
            }
            deltaHtml.innerHTML = deltaStr;
            deltaHtml.style.display = '';
        } else {
            deltaHtml.style.display = 'none';
        }
    }

    /**
     * 編輯器預覽
     */
    renderPreview(container, element) {
        const wallType = element.wallType || 'pre';
        const title = element.wallTitle || (wallType === 'post' ? '📊 課後測驗分數分布' : '📊 課前測驗分數分布');

        container.innerHTML = `
            <div class="aw-widget aw-preview">
                <div class="aw-header">
                    <div class="aw-title">${this._esc(title)}</div>
                    <div class="aw-subtitle">廣播後即時統計全班分數</div>
                </div>
                <div class="aw-chart-area">
                    <div class="aw-chart">
                        ${[2, 5, 12, 8, 3].map((h, i) => `
                            <div class="aw-bar-col">
                                <div class="aw-bar-count">${h}</div>
                                <div class="aw-bar" style="height:${(h / 12) * 100}%;background:${['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981'][i]}; opacity:0.5;"></div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="aw-x-labels">
                        <span>0-20</span><span>21-40</span><span>41-60</span><span>61-80</span><span>81-100</span>
                    </div>
                </div>
            </div>
        `;
    }

    destroy() {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
    }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
