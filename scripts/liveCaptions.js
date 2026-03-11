/**
 * LiveCaptions — 即時語音字幕模組
 * 使用 Web Speech API 在瀏覽器端辨識語音，
 * 顯示字幕條並透過 realtime 廣播至學員端
 *
 * 後處理功能：
 * - 自動標點（逗號、句號）
 * - 語助詞/無意義文字過濾
 * - 專有名詞校正
 */

// ── 語助詞黑名單 ──
const FILLER_WORDS = [
    '嗯', '呃', '啊', '喔', '蛤', '欸', '耶', '唉',
    '那個', '就是說', '就是', '然後呢', '然後',
    '所以說', '對不對', '對啊', '齁',
    '怎麼講', '怎麼說呢', '你知道嗎', '基本上',
    '老實說', '坦白講', '我覺得', '我跟你講',
    '其實', '反正', '總之',
];

// 建立過濾用 regex（完整比對，避免誤刪「然後」出現在「然後面」這類片段）
const FILLER_RE = new RegExp(
    FILLER_WORDS.sort((a, b) => b.length - a.length)
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'),
    'g'
);

/**
 * 文字後處理器
 */
class TextProcessor {
    constructor() {
        /** @type {string[]} 專有名詞列表 */
        this.glossary = this._loadGlossary();
    }

    /**
     * 處理辨識文字
     */
    process(text, isFinal) {
        if (!text) return text;

        // 0. 同音錯字替換（最優先）
        text = this._applyCommonFixes(text);

        // 1. 過濾語助詞（只對 final 結果做，interim 不做避免閃爍）
        if (isFinal) {
            text = this._removeFillers(text);
        }

        // 2. 專有名詞校正
        text = this._applyGlossary(text);

        // 3. 自動標點（只對 final 結果）
        if (isFinal) {
            text = this._addPunctuation(text);
        }

        return text.trim();
    }

    /**
     * 移除語助詞
     */
    _removeFillers(text) {
        // 移除開頭的語助詞
        let result = text.replace(FILLER_RE, '');
        // 清除多餘空白
        result = result.replace(/\s{2,}/g, ' ').trim();
        return result || text; // 如果全部被過濾掉，保留原文
    }

    /**
     * 自動加標點
     * 規則：
     * - 中文句子每 15-25 字沒有標點就插入逗號
     * - 結尾加句號（如果還沒有）
     * - 已有標點的不重複加
     */
    _addPunctuation(text) {
        // 已有標點的直接返回
        if (/[，。！？、；：,.!?;:]/.test(text)) return text;

        const chars = [...text];
        if (chars.length <= 8) {
            // 短句直接返回，不加標點
            return text;
        }

        // 在自然斷句點插入逗號
        // 常見的斷句詞
        const breakWords = ['但是', '不過', '而且', '所以', '因為', '如果', '雖然',
            '可是', '或者', '還有', '接下來', '另外', '同時', '最後',
            '第一', '第二', '第三', '首先', '再來', '比如說', '舉例來說',
            '換句話說', '也就是說', '簡單來說', '重點是'];

        let result = text;
        for (const bw of breakWords) {
            // 在斷句詞前面插入逗號（如果前面不是開頭且不是已有標點）
            result = result.replace(
                new RegExp(`(?<=.{2,})(?=${bw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g'),
                '，'
            );
        }

        // 如果還是沒有逗號，且超過 15 字，在中間找自然斷點
        if (!/，/.test(result) && chars.length > 15) {
            const mid = Math.floor(chars.length / 2);
            // 找最接近中間的可能斷點（「的」「了」「是」「會」「有」後面）
            let bestPos = -1;
            let bestDist = Infinity;
            for (let i = 5; i < chars.length - 3; i++) {
                if ('的了是會有要在就把被讓給跟和與'.includes(chars[i])) {
                    const dist = Math.abs(i - mid);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestPos = i;
                    }
                }
            }
            if (bestPos > 0) {
                result = [...result].slice(0, bestPos + 1).join('') + '，' + [...result].slice(bestPos + 1).join('');
            }
        }

        return result;
    }

    /**
     * 專有名詞校正
     * 比對辨識結果中可能的錯字，替換為正確的專有名詞
     */
    _applyGlossary(text) {
        if (!this.glossary.length) return text;

        for (const term of this.glossary) {
            if (term.length < 2) continue;
            // 如果原文已包含該詞，跳過
            if (text.includes(term)) continue;

            // 模糊比對：找到與專有名詞長度相同、有至少一半字元匹配的子串
            const termChars = [...term];
            const textChars = [...text];
            for (let i = 0; i <= textChars.length - termChars.length; i++) {
                const sub = textChars.slice(i, i + termChars.length);
                let matchCount = 0;
                for (let j = 0; j < termChars.length; j++) {
                    if (sub[j] === termChars[j]) matchCount++;
                }
                // 超過一半字元匹配 → 視為同音誤辨識，替換
                if (matchCount > 0 && matchCount >= Math.ceil(termChars.length * 0.5) && matchCount < termChars.length) {
                    const before = textChars.slice(0, i).join('');
                    const after = textChars.slice(i + termChars.length).join('');
                    text = before + term + after;
                    break; // 每個詞只替換一次
                }
            }
        }
        return text;
    }

    /**
     * 常見同音錯字直接替換表
     * key: 語音辨識常見錯誤, value: 正確寫法
     */
    static COMMON_FIXES = {
        '欸批愛': 'API',
        '愛批愛': 'API',
        '誒批愛': 'API',
        '西一歐': 'SEO',
        '欸斯一歐': 'SEO',
        '差吉批替': 'ChatGPT',
        '差及批替': 'ChatGPT',
        '茶居批替': 'ChatGPT',
        '雞皮替': 'GPT',
        '批替': 'GPT',
        '接米乃': 'Gemini',
        '間米尼': 'Gemini',
        '黃仁訓': '黃仁勳',
        '黃人訓': '黃仁勳',
        '恩為地雅': 'NVIDIA',
        '特斯拉': 'Tesla',
        '阿爾法': 'Alpha',
        '優圖': 'YouTube',
        'IG': 'IG',
        '臉書': 'Facebook',
        '谷歌': 'Google',
        '連結': '連結',
        '轉換率': '轉換率',
        '關鍵字': '關鍵字',
        '流量': '流量',
        '演算法': '演算法',
    };

    /**
     * 預設專有名詞列表（語音辨識常出錯的）
     */
    static DEFAULT_GLOSSARY = [
        'AI', 'API', 'SEO', 'SEM', 'GPT', 'ChatGPT', 'Gemini', 'Claude',
        'Google', 'Meta', 'Facebook', 'Instagram', 'YouTube', 'TikTok', 'LINE',
        'NVIDIA', 'OpenAI', 'Transformer', 'LLM',
        'Python', 'JavaScript', 'React', 'CSS', 'HTML',
        'Canva', 'Figma', 'Notion', 'Slack', 'Zoom',
        'CRM', 'KPI', 'ROI', 'CTR', 'CPC', 'CPM', 'ROAS',
        'GA4', 'GTM', 'Search Console',
    ];

    /**
     * 套用同音錯字替換
     */
    _applyCommonFixes(text) {
        for (const [wrong, right] of Object.entries(TextProcessor.COMMON_FIXES)) {
            if (text.includes(wrong)) {
                text = text.replaceAll(wrong, right);
            }
        }
        return text;
    }

    /**
     * 載入專有名詞（localStorage + 預設名詞合併）
     */
    _loadGlossary() {
        try {
            const raw = localStorage.getItem('caption_glossary');
            const userTerms = raw ? JSON.parse(raw) : [];
            // 合併預設 + 使用者自訂，去重
            const all = [...new Set([...TextProcessor.DEFAULT_GLOSSARY, ...userTerms])];
            return all;
        } catch { return [...TextProcessor.DEFAULT_GLOSSARY]; }
    }

    /**
     * 儲存專有名詞
     */
    saveGlossary(terms) {
        this.glossary = terms.filter(t => t.trim());
        localStorage.setItem('caption_glossary', JSON.stringify(this.glossary));
    }
}

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
        this._bar = null;
        this._textEl = null;
        this._fadeTimer = null;
        this._restartTimer = null;
        this._settingsPanel = null;
        this._processor = new TextProcessor();

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

    /** 取得後處理器（供外部設定用） */
    get processor() { return this._processor; }

    /**
     * 建立字幕 UI
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

    _removeUI() {
        if (this._bar) { this._bar.remove(); this._bar = null; this._textEl = null; }
    }

    start() {
        if (!this.supported || this.active) return;
        const mount = document.querySelector('.presentation-mode.active') || document.body;
        this._createUI(mount);
        this._bar.classList.add('visible');
        this._lastResultTime = Date.now();
        try {
            this.recognition.start();
            this.active = true;
            this._startWatchdog();
            console.log('[LiveCaptions] started');
        } catch (e) {
            console.warn('[LiveCaptions] start failed:', e);
        }
    }

    stop() {
        if (!this.active) return;
        this.active = false;
        clearTimeout(this._restartTimer);
        clearTimeout(this._fadeTimer);
        this._stopWatchdog();
        try { this.recognition.stop(); } catch { }
        if (this.realtime && this.channel) {
            this.realtime.publish(this.channel, 'subtitle', { text: '', isFinal: true, stopped: true });
        }
        if (this._bar) {
            this._bar.classList.remove('visible');
            setTimeout(() => this._removeUI(), 400);
        }
        console.log('[LiveCaptions] stopped');
    }

    toggle() {
        if (this.active) this.stop();
        else this.start();
        return this.active;
    }

    /**
     * 語音辨識結果 → 後處理 → 電影字幕式顯示 → 廣播
     * 每次只顯示最新的 ≤15 字，像電影字幕一段一段出現
     */
    _onResult(event) {
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
            }
        }

        // 只顯示完整句子，不顯示辨識中的逐字文字
        if (!final) return;
        this._lastResultTime = Date.now();

        // ★ 後處理
        let processed = this._processor.process(final, true);
        if (!processed) return;

        // ★ 電影字幕式斷句：最多 MAX_CHARS 字
        const MAX_CHARS = 15;
        const chars = [...processed];
        let displayText;

        if (chars.length <= MAX_CHARS) {
            displayText = processed;
        } else {
            let cutPos = chars.length - MAX_CHARS;
            for (let i = cutPos; i < Math.min(cutPos + 6, chars.length); i++) {
                if ('，。、！？的了是在有'.includes(chars[i])) {
                    cutPos = i + 1;
                    break;
                }
            }
            displayText = chars.slice(cutPos).join('');
        }

        if (this._textEl) {
            this._textEl.textContent = displayText;
            this._textEl.classList.remove('interim');
            clearTimeout(this._fadeTimer);
            this._fadeTimer = setTimeout(() => {
                if (this._textEl) {
                    this._textEl.style.transition = 'opacity 0.6s ease';
                    this._textEl.style.opacity = '0';
                    setTimeout(() => {
                        if (this._textEl) {
                            this._textEl.textContent = '';
                            this._textEl.style.opacity = '';
                            this._textEl.style.transition = '';
                        }
                    }, 600);
                }
            }, 2500);
        }

        if (this.realtime && this.channel) {
            this.realtime.publish(this.channel, 'subtitle', { text: displayText, isFinal: true });
        }
    }

    _onError(event) {
        console.warn('[LiveCaptions] error:', event.error);
        if (event.error === 'not-allowed') {
            if (this._textEl) {
                this._textEl.textContent = '⚠️ 請允許麥克風權限';
                this._textEl.classList.remove('interim');
            }
            this.active = false;
            return;
        }
        // no-speech / aborted / network 等錯誤 → 自動重啟
        if (this.active) {
            this._scheduleRestart(200);
        }
    }

    _onEnd() {
        if (!this.active) return;
        // 辨識引擎結束 → 立即重啟
        this._scheduleRestart(100);
    }

    /**
     * 排程重啟辨識器，避免重複觸發
     */
    _scheduleRestart(delay = 100) {
        clearTimeout(this._restartTimer);
        this._restartTimer = setTimeout(() => {
            if (!this.active) return;
            try {
                this.recognition.start();
            } catch (e) {
                // 如果 start 失敗（可能還在 running），等一下再試
                setTimeout(() => {
                    if (this.active) {
                        try { this.recognition.start(); } catch { }
                    }
                }, 500);
            }
        }, delay);
    }

    /**
     * 啟動 watchdog — 每 5 秒確認辨識器還活著
     */
    _startWatchdog() {
        this._stopWatchdog();
        this._watchdog = setInterval(() => {
            if (!this.active) return;
            // 記錄上次收到結果的時間，超過 8 秒沒結果就強制重啟
            const now = Date.now();
            if (this._lastResultTime && (now - this._lastResultTime) > 8000) {
                console.log('[LiveCaptions] watchdog: no result for 8s, restarting');
                try { this.recognition.stop(); } catch { }
                this._scheduleRestart(200);
            }
        }, 5000);
    }

    _stopWatchdog() {
        if (this._watchdog) {
            clearInterval(this._watchdog);
            this._watchdog = null;
        }
    }

    /**
     * 開關專有名詞設定面板
     */
    toggleSettings() {
        if (this._settingsPanel) {
            this._closeSettings();
            return;
        }

        const panel = document.createElement('div');
        panel.className = 'caption-settings-panel';
        panel.innerHTML = `
            <div class="caption-settings-inner">
                <div class="caption-settings-header">
                    <span class="material-symbols-outlined" style="font-size:18px;">dictionary</span>
                    <span>專有名詞設定</span>
                    <button class="caption-settings-close">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="caption-settings-desc">
                    輸入課程中的專有名詞，每行一個。<br>
                    系統會自動校正語音辨識中的同音誤字。
                </div>
                <textarea class="caption-settings-input" rows="8"
                    placeholder="例：\nSEO\nChatGPT\nGemini\n黃仁勳\nNVIDIA\nTransformer"
                >${this._processor.glossary.join('\n')}</textarea>
                <div class="caption-settings-actions">
                    <button class="caption-settings-save">
                        <span class="material-symbols-outlined" style="font-size:16px;">save</span>
                        儲存
                    </button>
                </div>
            </div>
        `;

        // 掛載
        const mount = document.querySelector('.presentation-mode.active') || document.body;
        mount.appendChild(panel);
        this._settingsPanel = panel;

        // 事件
        panel.querySelector('.caption-settings-close').onclick = () => this._closeSettings();
        panel.querySelector('.caption-settings-save').onclick = () => {
            const text = panel.querySelector('.caption-settings-input').value;
            const terms = text.split('\n').map(t => t.trim()).filter(Boolean);
            this._processor.saveGlossary(terms);
            this._closeSettings();
            // 顯示提示
            if (window.app?.showToast) window.app.showToast(`✅ 已儲存 ${terms.length} 個專有名詞`);
        };

        // 點背景關閉
        panel.addEventListener('click', (e) => {
            if (e.target === panel) this._closeSettings();
        });

        requestAnimationFrame(() => panel.classList.add('visible'));
    }

    _closeSettings() {
        if (this._settingsPanel) {
            this._settingsPanel.classList.remove('visible');
            setTimeout(() => {
                this._settingsPanel?.remove();
                this._settingsPanel = null;
            }, 250);
        }
    }

    destroy() {
        this.stop();
        this._removeUI();
        this._closeSettings();
        this.recognition = null;
    }
}

/**
 * 學員端字幕接收器
 */
export class CaptionReceiver {
    constructor() {
        this._bar = null;
        this._textEl = null;
        this._fadeTimer = null;
    }

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

    handleSubtitle({ text, isFinal, stopped }) {
        if (stopped) { this.hide(); return; }
        if (!text) return;

        if (!this._bar) {
            const mount = document.querySelector('.student-slide-wrapper')
                || document.querySelector('.student-presentation')
                || document.body;
            this.mount(mount);
        }

        this._bar.classList.add('visible');
        this._textEl.textContent = text;
        this._textEl.classList.toggle('interim', !isFinal);
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

    hide() {
        clearTimeout(this._fadeTimer);
        if (this._bar) this._bar.classList.remove('visible');
    }

    destroy() {
        this.hide();
        if (this._bar) { this._bar.remove(); this._bar = null; this._textEl = null; }
    }
}
