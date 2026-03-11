/**
 * LiveCaptions — 即時語音字幕模組
 * 使用 Web Speech API 在瀏覽器端辨識語音，
 * 顯示字幕條並透過 realtime 廣播至學員端
 */

export class LiveCaptions {
    /**
     * @param {object} realtime - realtime 模組（publish / on）
     * @param {string} channel - realtime 頻道名稱（e.g. 'session:ABC123'）
     */
    constructor(realtime, channel) {
        this.realtime = realtime;
        this.channel = channel;
        this.recognition = null;
        this.active = false;
        this._bar = null;       // 字幕條 DOM
        this._textEl = null;    // 文字顯示區
        this._fadeTimer = null;
        this._restartTimer = null;

        // 檢查瀏覽器支援
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[LiveCaptions] Web Speech API not supported');
            this.supported = false;
            return;
        }
        this.supported = true;

        // 建立辨識器
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'zh-TW';
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        // 事件綁定
        this.recognition.onresult = (e) => this._onResult(e);
        this.recognition.onerror = (e) => this._onError(e);
        this.recognition.onend = () => this._onEnd();
    }

    /**
     * 建立字幕 UI（掛載到 mountTarget 底部）
     */
    _createUI(mountTarget) {
        if (this._bar) return;

        const bar = document.createElement('div');
        bar.className = 'live-caption-bar';
        bar.innerHTML = `
            <span class="live-caption-mic">
                <span class="material-symbols-outlined">mic</span>
            </span>
            <span class="live-caption-text"></span>
        `;
        (mountTarget || document.body).appendChild(bar);

        this._bar = bar;
        this._textEl = bar.querySelector('.live-caption-text');
    }

    /**
     * 移除字幕 UI
     */
    _removeUI() {
        if (this._bar) {
            this._bar.remove();
            this._bar = null;
            this._textEl = null;
        }
    }

    /**
     * 啟動語音辨識
     */
    start() {
        if (!this.supported || this.active) return;

        // 掛載字幕 UI 到 presentation-mode
        const mount = document.querySelector('.presentation-mode.active') || document.body;
        this._createUI(mount);
        this._bar.classList.add('visible');

        try {
            this.recognition.start();
            this.active = true;
            console.log('[LiveCaptions] started');
        } catch (e) {
            console.warn('[LiveCaptions] start failed:', e);
        }
    }

    /**
     * 停止語音辨識
     */
    stop() {
        if (!this.active) return;
        this.active = false;
        clearTimeout(this._restartTimer);
        clearTimeout(this._fadeTimer);

        try { this.recognition.stop(); } catch { }

        // 廣播停止
        if (this.realtime && this.channel) {
            this.realtime.publish(this.channel, 'subtitle', { text: '', isFinal: true, stopped: true });
        }

        // 淡出字幕條
        if (this._bar) {
            this._bar.classList.remove('visible');
            setTimeout(() => this._removeUI(), 400);
        }

        console.log('[LiveCaptions] stopped');
    }

    /**
     * 切換開關
     */
    toggle() {
        if (this.active) this.stop();
        else this.start();
        return this.active;
    }

    /**
     * 語音辨識結果
     */
    _onResult(event) {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                final += transcript;
            } else {
                interim += transcript;
            }
        }

        // 顯示文字（final 優先，沒有 final 就顯示 interim）
        const displayText = final || interim;
        const isFinal = !!final;

        if (this._textEl && displayText) {
            this._textEl.textContent = displayText;
            this._textEl.classList.toggle('interim', !isFinal);

            // 清除舊的淡出計時器
            clearTimeout(this._fadeTimer);

            // final 結果 4 秒後淡出文字
            if (isFinal) {
                this._fadeTimer = setTimeout(() => {
                    if (this._textEl) {
                        this._textEl.style.transition = 'opacity 0.8s ease';
                        this._textEl.style.opacity = '0.3';
                        setTimeout(() => {
                            if (this._textEl) {
                                this._textEl.textContent = '';
                                this._textEl.style.opacity = '';
                                this._textEl.style.transition = '';
                            }
                        }, 800);
                    }
                }, 4000);
            }
        }

        // 廣播到學員端
        if (this.realtime && this.channel && displayText) {
            this.realtime.publish(this.channel, 'subtitle', {
                text: displayText,
                isFinal
            });
        }
    }

    /**
     * 錯誤處理
     */
    _onError(event) {
        console.warn('[LiveCaptions] error:', event.error);
        // 「no-speech」不需要處理，自動重啟會處理
        if (event.error === 'aborted') return;
        if (event.error === 'not-allowed') {
            // 麥克風權限被拒絕
            if (this._textEl) {
                this._textEl.textContent = '⚠️ 請允許麥克風權限';
                this._textEl.classList.remove('interim');
            }
            this.active = false;
        }
    }

    /**
     * 辨識結束 → 自動重啟（保持持續辨識）
     */
    _onEnd() {
        if (!this.active) return;
        // 延遲 300ms 重啟，避免頻繁重啟
        this._restartTimer = setTimeout(() => {
            if (this.active) {
                try {
                    this.recognition.start();
                    console.log('[LiveCaptions] auto-restarted');
                } catch (e) {
                    console.warn('[LiveCaptions] restart failed:', e);
                }
            }
        }, 300);
    }

    /**
     * 完全清除
     */
    destroy() {
        this.stop();
        this._removeUI();
        this.recognition = null;
    }
}

/**
 * 學員端字幕接收器
 * 監聽 realtime subtitle 事件並在畫面上顯示字幕
 */
export class CaptionReceiver {
    constructor() {
        this._bar = null;
        this._textEl = null;
        this._fadeTimer = null;
    }

    /**
     * 建立字幕 UI（掛載到 mountTarget 底部）
     */
    mount(mountTarget) {
        if (this._bar) return;

        const bar = document.createElement('div');
        bar.className = 'live-caption-bar student-caption';
        bar.innerHTML = `
            <span class="live-caption-mic">
                <span class="material-symbols-outlined">closed_caption</span>
            </span>
            <span class="live-caption-text"></span>
        `;
        (mountTarget || document.body).appendChild(bar);

        this._bar = bar;
        this._textEl = bar.querySelector('.live-caption-text');
    }

    /**
     * 處理收到的字幕事件
     */
    handleSubtitle({ text, isFinal, stopped }) {
        if (stopped) {
            this.hide();
            return;
        }

        if (!text) return;

        // 確保 UI 存在
        if (!this._bar) {
            const mount = document.querySelector('.student-slide-wrapper')
                || document.querySelector('.student-presentation')
                || document.body;
            this.mount(mount);
        }

        this._bar.classList.add('visible');
        this._textEl.textContent = text;
        this._textEl.classList.toggle('interim', !isFinal);

        // 清除舊計時器
        clearTimeout(this._fadeTimer);

        if (isFinal) {
            this._fadeTimer = setTimeout(() => {
                if (this._textEl) {
                    this._textEl.style.transition = 'opacity 0.8s ease';
                    this._textEl.style.opacity = '0.3';
                    setTimeout(() => {
                        if (this._textEl) {
                            this._textEl.textContent = '';
                            this._textEl.style.opacity = '';
                            this._textEl.style.transition = '';
                        }
                    }, 800);
                }
            }, 4000);
        }
    }

    /**
     * 隱藏字幕條
     */
    hide() {
        clearTimeout(this._fadeTimer);
        if (this._bar) {
            this._bar.classList.remove('visible');
        }
    }

    /**
     * 移除
     */
    destroy() {
        this.hide();
        if (this._bar) {
            this._bar.remove();
            this._bar = null;
            this._textEl = null;
        }
    }
}
