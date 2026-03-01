/**
 * 倒數計時器 — 適用於所有互動元件
 * 自動偵測含 data-time-limit 的容器，加入倒數顯示
 */

export class CountdownTimer {
    constructor() {
        this.timers = new Map();
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('slideRendered', () => this.init());
    }

    init() {
        // 清除舊的計時器
        this.timers.forEach(t => clearInterval(t.interval));
        this.timers.clear();

        document.querySelectorAll('[data-time-limit]').forEach(container => {
            const seconds = parseInt(container.dataset.timeLimit);
            if (!seconds || seconds <= 0) return;
            this.attachTimer(container, seconds);
        });
    }

    attachTimer(container, totalSeconds) {
        // 避免重複
        if (container.querySelector('.countdown-timer')) return;

        let remaining = totalSeconds;
        let started = false;

        // 建立計時器 UI
        const timerEl = document.createElement('div');
        timerEl.className = 'countdown-timer';
        timerEl.innerHTML = `
            <div class="countdown-ring">
                <svg viewBox="0 0 40 40">
                    <circle class="countdown-bg" cx="20" cy="20" r="17" />
                    <circle class="countdown-progress" cx="20" cy="20" r="17"
                            stroke-dasharray="${2 * Math.PI * 17}"
                            stroke-dashoffset="0" />
                </svg>
                <span class="countdown-text">${this.formatTime(remaining)}</span>
            </div>
        `;

        container.style.position = 'relative';
        container.appendChild(timerEl);

        const progressCircle = timerEl.querySelector('.countdown-progress');
        const textEl = timerEl.querySelector('.countdown-text');
        const circumference = 2 * Math.PI * 17;

        // 開始計時 — 第一次互動時開始
        const startOnInteract = () => {
            if (started) return;
            started = true;

            const interval = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    remaining = 0;
                    clearInterval(interval);
                    this.onTimeUp(container, timerEl);
                }

                // 更新文字
                textEl.textContent = this.formatTime(remaining);

                // 更新進度環
                const offset = circumference * (1 - remaining / totalSeconds);
                progressCircle.style.strokeDashoffset = offset;

                // 快到時間時變紅
                if (remaining <= 10) {
                    timerEl.classList.add('countdown-urgent');
                }
                if (remaining <= 5) {
                    timerEl.classList.add('countdown-critical');
                }
            }, 1000);

            this.timers.set(container, { interval, timerEl });
        };

        // 監聽互動（點擊或拖曳）
        container.addEventListener('pointerdown', startOnInteract, { once: true });
        container.addEventListener('touchstart', startOnInteract, { once: true });
    }

    onTimeUp(container, timerEl) {
        timerEl.classList.add('countdown-ended');

        // 建立時間到 overlay
        const overlay = document.createElement('div');
        overlay.className = 'countdown-overlay';
        overlay.innerHTML = `
            <span class="material-symbols-outlined" style="font-size:2rem;">timer_off</span>
            <div>時間到！</div>
        `;
        container.appendChild(overlay);

        // 禁止繼續互動
        container.style.pointerEvents = 'none';
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}`;
    }
}
