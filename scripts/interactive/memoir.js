/**
 * 學員個人課後回憶錄 — 入口元件
 *
 * 放在簡報最後一頁，學員點擊按鈕開啟專屬的
 * student-memoir.html（獨立頁面，彙整這堂課的個人紀錄）。
 * 本元件不寫入任何資料，純粹是產生連結的入口。
 */
import { stateManager } from './stateManager.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mi = (n, s = 18) => `<span class="material-symbols-outlined" style="font-size:${s}px;vertical-align:middle">${n}</span>`;

export class MemoirGame {
    /* ── 編輯器畫布預覽 ── */
    renderPreview(el, element) {
        el.innerHTML = `
            <div class="memoir-preview">
                <div class="memoir-preview-icon">${mi('auto_stories', 28)}</div>
                <div class="memoir-preview-title">${esc(element.question || '你的課程回憶錄')}</div>
                <div class="memoir-preview-desc">學員會看到一個專屬連結，點開後看到自己這堂課的所有紀錄</div>
            </div>`;
    }

    /* ── 簡報播放：只有學員視角有意義 ── */
    render(el, element) {
        const user = stateManager.getUser();
        const sessionId = stateManager.getSessionCode();
        const email = user?.email || '';
        const name = user?.name || '';

        el.classList.add('memoir-container');

        if (!email || !sessionId) {
            el.innerHTML = `
                <div class="memoir-entry">
                    <div class="memoir-entry-icon">${mi('auto_stories', 32)}</div>
                    <div class="memoir-entry-title">${esc(element.question || '你的課程回憶錄')}</div>
                    <div class="memoir-entry-desc">請先登入課程系統，才能查看你的專屬回憶錄。</div>
                </div>`;
            return;
        }

        const url = `student-memoir.html?session=${encodeURIComponent(sessionId)}`
            + `&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;

        el.innerHTML = `
            <div class="memoir-entry">
                <div class="memoir-entry-icon">${mi('auto_stories', 32)}</div>
                <div class="memoir-entry-title">${esc(element.question || '你的課程回憶錄已經準備好了')}</div>
                <div class="memoir-entry-desc">${esc(element.description || '整理了你這堂課的所有作答、投票、文字雲貢獻與作品，寫成一份專屬於你的回憶錄。')}</div>
                <a class="memoir-entry-btn" href="${esc(url)}" target="_blank" rel="noopener">
                    ${mi('menu_book', 18)} 打開我的回憶錄
                </a>
            </div>`;
    }

    destroy() { /* 無需清理計時器等資源 */ }
}
