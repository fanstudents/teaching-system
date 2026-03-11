/**
 * LiveCaptions — 語音逐字稿錄製模組
 * 使用 Web Speech API 辨識語音，累積逐字稿並存入 sessions 資料庫
 * 不顯示字幕，純背景錄製
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
        this.glossary = this._loadGlossary();
    }

    process(text) {
        if (!text) return text;
        text = this._applyCommonFixes(text);
        text = this._removeFillers(text);
        text = this._applyGlossary(text);
        text = this._addPunctuation(text);
        return text.trim();
    }

    _removeFillers(text) {
        let result = text.replace(FILLER_RE, '');
        result = result.replace(/\s{2,}/g, ' ').trim();
        return result || text;
    }

    _addPunctuation(text) {
        if (/[，。！？、；：,.!?;:]/.test(text)) return text;
        const chars = [...text];
        if (chars.length <= 8) return text;

        const breakWords = ['但是', '不過', '而且', '所以', '因為', '如果', '雖然',
            '可是', '或者', '還有', '接下來', '另外', '同時', '最後',
            '第一', '第二', '第三', '首先', '再來', '比如說', '舉例來說',
            '換句話說', '也就是說', '簡單來說', '重點是'];

        let result = text;
        for (const bw of breakWords) {
            result = result.replace(
                new RegExp(`(?<=.{2,})(?=${bw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g'),
                '，'
            );
        }

        if (!/，/.test(result) && chars.length > 15) {
            const mid = Math.floor(chars.length / 2);
            let bestPos = -1, bestDist = Infinity;
            for (let i = 5; i < chars.length - 3; i++) {
                if ('的了是會有要在就把被讓給跟和與'.includes(chars[i])) {
                    const dist = Math.abs(i - mid);
                    if (dist < bestDist) { bestDist = dist; bestPos = i; }
                }
            }
            if (bestPos > 0) {
                result = [...result].slice(0, bestPos + 1).join('') + '，' + [...result].slice(bestPos + 1).join('');
            }
        }
        return result;
    }

    _applyGlossary(text) {
        if (!this.glossary.length) return text;
        for (const term of this.glossary) {
            if (term.length < 2 || text.includes(term)) continue;
            const termChars = [...term];
            const textChars = [...text];
            for (let i = 0; i <= textChars.length - termChars.length; i++) {
                const sub = textChars.slice(i, i + termChars.length);
                let matchCount = 0;
                for (let j = 0; j < termChars.length; j++) {
                    if (sub[j] === termChars[j]) matchCount++;
                }
                if (matchCount > 0 && matchCount >= Math.ceil(termChars.length * 0.5) && matchCount < termChars.length) {
                    text = textChars.slice(0, i).join('') + term + textChars.slice(i + termChars.length).join('');
                    break;
                }
            }
        }
        return text;
    }

    static COMMON_FIXES = {
        '欸批愛': 'API', '愛批愛': 'API', '誒批愛': 'API',
        '西一歐': 'SEO', '欸斯一歐': 'SEO',
        '差吉批替': 'ChatGPT', '差及批替': 'ChatGPT', '茶居批替': 'ChatGPT',
        '雞皮替': 'GPT', '批替': 'GPT',
        '接米乃': 'Gemini', '間米尼': 'Gemini',
        '黃仁訓': '黃仁勳', '黃人訓': '黃仁勳',
        '恩為地雅': 'NVIDIA',
        '優圖': 'YouTube', '谷歌': 'Google',
    };

    static DEFAULT_GLOSSARY = [
        'AI', 'API', 'SEO', 'SEM', 'GPT', 'ChatGPT', 'Gemini', 'Claude',
        'Google', 'Meta', 'Facebook', 'Instagram', 'YouTube', 'TikTok', 'LINE',
        'NVIDIA', 'OpenAI', 'Transformer', 'LLM',
        'Python', 'JavaScript', 'React', 'CSS', 'HTML',
        'Canva', 'Figma', 'Notion', 'Slack', 'Zoom',
        'CRM', 'KPI', 'ROI', 'CTR', 'CPC', 'CPM', 'ROAS',
        'GA4', 'GTM', 'Search Console',
    ];

    _applyCommonFixes(text) {
        for (const [wrong, right] of Object.entries(TextProcessor.COMMON_FIXES)) {
            if (text.includes(wrong)) text = text.replaceAll(wrong, right);
        }
        return text;
    }

    _loadGlossary() {
        try {
            const raw = localStorage.getItem('caption_glossary');
            const userTerms = raw ? JSON.parse(raw) : [];
            return [...new Set([...TextProcessor.DEFAULT_GLOSSARY, ...userTerms])];
        } catch { return [...TextProcessor.DEFAULT_GLOSSARY]; }
    }

    saveGlossary(terms) {
        this.glossary = terms.filter(t => t.trim());
        localStorage.setItem('caption_glossary', JSON.stringify(this.glossary));
    }
}

// ========================================

export class LiveCaptions {
    /**
     * @param {object} db - 資料庫模組（db.update）
     * @param {string} sessionCode - 場次代碼
     */
    constructor(db, sessionCode) {
        this._db = db;
        this._sessionCode = sessionCode;
        this.recognition = null;
        this.active = false;
        this._restartTimer = null;
        this._saveTimer = null;
        this._watchdog = null;
        this._lastResultTime = null;
        this._processor = new TextProcessor();

        /** @type {string[]} 累積的逐字稿片段 */
        this._segments = [];

        // 檢查瀏覽器支援
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[LiveCaptions] Web Speech API not supported');
            this.supported = false;
            return;
        }
        this.supported = true;

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'zh-TW';
        this.recognition.continuous = true;
        this.recognition.interimResults = false; // 只要 final 結果
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = (e) => this._onResult(e);
        this.recognition.onerror = (e) => this._onError(e);
        this.recognition.onend = () => this._onEnd();
    }

    get processor() { return this._processor; }

    /** 取得目前累積的逐字稿 */
    getTranscript() {
        return this._segments.join('');
    }

    start() {
        if (!this.supported || this.active) return;
        this._lastResultTime = Date.now();
        try {
            this.recognition.start();
            this.active = true;
            this._startWatchdog();
            this._startAutoSave();
            console.log('[LiveCaptions] recording started');
        } catch (e) {
            console.warn('[LiveCaptions] start failed:', e);
        }
    }

    stop() {
        if (!this.active) return;
        this.active = false;
        clearTimeout(this._restartTimer);
        this._stopWatchdog();
        this._stopAutoSave();
        try { this.recognition.stop(); } catch { }

        // 最後存一次
        this._saveToDb();
        console.log('[LiveCaptions] recording stopped, transcript length:', this.getTranscript().length);
    }

    toggle() {
        if (this.active) this.stop();
        else this.start();
        return this.active;
    }

    /**
     * 語音辨識結果 → 後處理 → 累積到逐字稿
     */
    _onResult(event) {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                const raw = event.results[i][0].transcript;
                const processed = this._processor.process(raw);
                if (processed) {
                    this._segments.push(processed);
                    console.log('[LiveCaptions] +', processed);
                }
            }
        }
        this._lastResultTime = Date.now();
    }

    _onError(event) {
        console.warn('[LiveCaptions] error:', event.error);
        if (event.error === 'not-allowed') {
            this.active = false;
            return;
        }
        if (this.active) this._scheduleRestart(200);
    }

    _onEnd() {
        if (!this.active) return;
        this._scheduleRestart(100);
    }

    _scheduleRestart(delay = 100) {
        clearTimeout(this._restartTimer);
        this._restartTimer = setTimeout(() => {
            if (!this.active) return;
            try {
                this.recognition.start();
            } catch {
                setTimeout(() => {
                    if (this.active) {
                        try { this.recognition.start(); } catch { }
                    }
                }, 500);
            }
        }, delay);
    }

    // ── Watchdog ──
    _startWatchdog() {
        this._stopWatchdog();
        this._watchdog = setInterval(() => {
            if (!this.active) return;
            if (this._lastResultTime && (Date.now() - this._lastResultTime) > 8000) {
                console.log('[LiveCaptions] watchdog: restarting');
                try { this.recognition.stop(); } catch { }
                this._scheduleRestart(200);
            }
        }, 5000);
    }

    _stopWatchdog() {
        if (this._watchdog) { clearInterval(this._watchdog); this._watchdog = null; }
    }

    // ── 自動存檔（每 30 秒） ──
    _startAutoSave() {
        this._stopAutoSave();
        this._saveTimer = setInterval(() => {
            if (this._segments.length > 0) {
                this._saveToDb();
            }
        }, 30000);
    }

    _stopAutoSave() {
        if (this._saveTimer) { clearInterval(this._saveTimer); this._saveTimer = null; }
    }

    /**
     * 把逐字稿存到 sessions 資料庫
     */
    async _saveToDb() {
        if (!this._db || !this._sessionCode) return;
        const transcript = this.getTranscript();
        if (!transcript) return;

        try {
            const { error } = await this._db.update('sessions',
                { transcript },
                { session_code: `eq.${this._sessionCode}` }
            );
            if (error) {
                console.warn('[LiveCaptions] save failed:', error);
            } else {
                console.log('[LiveCaptions] saved transcript, length:', transcript.length);
            }
        } catch (e) {
            console.warn('[LiveCaptions] save error:', e);
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
        const mount = document.querySelector('.presentation-mode.active') || document.body;
        mount.appendChild(panel);
        this._settingsPanel = panel;

        panel.querySelector('.caption-settings-close').onclick = () => this._closeSettings();
        panel.querySelector('.caption-settings-save').onclick = () => {
            const text = panel.querySelector('.caption-settings-input').value;
            const terms = text.split('\n').map(t => t.trim()).filter(Boolean);
            this._processor.saveGlossary(terms);
            this._closeSettings();
            if (window.app?.showToast) window.app.showToast(`✅ 已儲存 ${terms.length} 個專有名詞`);
        };
        panel.addEventListener('click', (e) => { if (e.target === panel) this._closeSettings(); });
        requestAnimationFrame(() => panel.classList.add('visible'));
    }

    _closeSettings() {
        if (this._settingsPanel) {
            this._settingsPanel.classList.remove('visible');
            setTimeout(() => { this._settingsPanel?.remove(); this._settingsPanel = null; }, 250);
        }
    }

    destroy() {
        this.stop();
        this._closeSettings();
        this.recognition = null;
    }
}
