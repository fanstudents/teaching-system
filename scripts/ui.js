/**
 * 通用 UI 元件 — Toast / Confirm / Input Modal
 * 取代所有 alert() / confirm() / prompt()
 */

/* ── CSS (注入一次) ── */
const _uiStyles = document.createElement('style');
_uiStyles.textContent = `
/* Toast */
.ui-toast {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%) translateY(10px);
    background: #1a1a2e;
    color: #fff;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 500;
    z-index: 50000;
    opacity: 0;
    transition: opacity .25s, transform .25s;
    pointer-events: none;
    max-width: 90vw;
    text-align: center;
    box-shadow: 0 6px 24px rgba(0,0,0,0.18);
    font-family: 'Noto Sans TC', sans-serif;
}
.ui-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}
.ui-toast.error {
    background: #c0392b;
}

/* Modal overlay */
.ui-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 40000;
    background: rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
    opacity: 0;
    transition: opacity .2s;
    font-family: 'Noto Sans TC', sans-serif;
}
.ui-modal-overlay.show { opacity: 1; }

.ui-modal {
    background: #fff;
    border-radius: 14px;
    padding: 28px 24px 20px;
    max-width: 420px;
    width: 92%;
    box-shadow: 0 12px 40px rgba(0,0,0,0.15);
    transform: scale(0.95);
    transition: transform .2s;
}
.ui-modal-overlay.show .ui-modal { transform: scale(1); }

.ui-modal-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 12px;
}
.ui-modal-msg {
    font-size: 0.92rem;
    color: #555;
    line-height: 1.6;
    margin-bottom: 20px;
}
.ui-modal-input {
    width: 100%;
    padding: 10px 14px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.92rem;
    font-family: inherit;
    margin-bottom: 18px;
    transition: border-color .15s;
    box-sizing: border-box;
}
.ui-modal-input:focus {
    outline: none;
    border-color: #1a1a2e;
}
.ui-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}
.ui-modal-btn {
    padding: 9px 20px;
    border: none;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background .15s, transform .1s;
}
.ui-modal-btn:active { transform: scale(0.97); }
.ui-modal-btn.cancel {
    background: #f0f0f0;
    color: #555;
}
.ui-modal-btn.cancel:hover { background: #e0e0e0; }
.ui-modal-btn.primary {
    background: #1a1a2e;
    color: #fff;
}
.ui-modal-btn.primary:hover { background: #333; }
.ui-modal-btn.danger {
    background: #c0392b;
    color: #fff;
}
.ui-modal-btn.danger:hover { background: #a93226; }
`;
document.head.appendChild(_uiStyles);

/* ── Toast ── */
let _toastTimer = null;
export function showToast(message, { duration = 2500, type = 'info' } = {}) {
    let el = document.getElementById('_uiToast');
    if (!el) {
        el = document.createElement('div');
        el.id = '_uiToast';
        el.className = 'ui-toast';
        document.body.appendChild(el);
    }
    clearTimeout(_toastTimer);
    el.textContent = message;
    el.className = 'ui-toast' + (type === 'error' ? ' error' : '');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('show');
    _toastTimer = setTimeout(() => {
        el.classList.remove('show');
    }, duration);
}

/* ── Confirm Modal ── */
export function showConfirm(message, { title = '確認', confirmText = '確定', cancelText = '取消', danger = false } = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'ui-modal-overlay';
        overlay.innerHTML = `
            <div class="ui-modal">
                <div class="ui-modal-title">${_esc(title)}</div>
                <div class="ui-modal-msg">${_esc(message)}</div>
                <div class="ui-modal-actions">
                    <button class="ui-modal-btn cancel" data-action="cancel">${_esc(cancelText)}</button>
                    <button class="ui-modal-btn ${danger ? 'danger' : 'primary'}" data-action="confirm">${_esc(confirmText)}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));

        const close = (result) => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        };

        overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
        overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    });
}

/* ── Input Modal (replaces prompt) ── */
export function showInput(message, { title = '輸入', defaultValue = '', placeholder = '', confirmText = '確定', cancelText = '取消' } = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'ui-modal-overlay';
        overlay.innerHTML = `
            <div class="ui-modal">
                <div class="ui-modal-title">${_esc(title)}</div>
                <div class="ui-modal-msg">${_esc(message)}</div>
                <input class="ui-modal-input" type="text" value="${_esc(defaultValue)}" placeholder="${_esc(placeholder)}">
                <div class="ui-modal-actions">
                    <button class="ui-modal-btn cancel" data-action="cancel">${_esc(cancelText)}</button>
                    <button class="ui-modal-btn primary" data-action="confirm">${_esc(confirmText)}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const input = overlay.querySelector('.ui-modal-input');
        requestAnimationFrame(() => {
            overlay.classList.add('show');
            input.focus();
            input.select();
        });

        const close = (value) => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 200);
            resolve(value);
        };

        overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
            const val = input.value.trim();
            close(val || null);
        });
        overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(null));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = input.value.trim();
                close(val || null);
            }
            if (e.key === 'Escape') close(null);
        });
    });
}

function _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

/* ── Global registration for non-module scripts ── */
window.UI = { showToast, showConfirm, showInput };
