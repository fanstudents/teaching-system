/**
 * courseSummary.js — 動態課程重點摘要
 * 80% 固定模板：逐頁投影片摘要
 * 20% 個人化：學員互動結果 + 建議
 */
import { db } from './supabase.js';

// ── 常數 ──
const TYPE_LABELS = {
    quiz: '選擇題', matching: '連連看', fillblank: '填空題',
    poll: '投票', text: '文字作業', url: '連結作業',
};
const TYPE_ICONS = {
    quiz: 'quiz', matching: 'join', fillblank: 'edit_note',
    poll: 'bar_chart', text: 'description', url: 'link',
};

class CourseSummary {
    constructor() {
        this.sessionCode = '';
        this.email = '';
        this.studentName = '';
        this.projectName = '';
        this.instructor = '';
        this.submissions = [];
        this.slides = [];
        this.pollVotes = [];
        this.transcript = '';
        this.summaryContent = {};
        this.isAdmin = new URLSearchParams(location.search).get('admin') === '1';
    }

    // ── Init ──
    async init() {
        const params = new URLSearchParams(location.search);
        this.sessionCode = params.get('code') || '';
        this.sessionUUID = params.get('psid') || ''; // 場次 UUID
        this.email = params.get('email') || '';

        if (!this.sessionCode || !this.email) {
            this._renderError('缺少必要參數：需要 code 和 email');
            return;
        }

        this._showLoading(true);

        try {
            const [projectData, studentData, submissionsData, pollData] = await Promise.all([
                this._loadProject(),
                this._loadStudent(),
                this._loadSubmissions(),
                this._loadPollVotes(),
            ]);

            if (!projectData) { this._renderError('找不到此課程'); return; }

            this.projectName = projectData.name || '未命名課程';
            this.instructor = projectData.instructor || '';
            this.slides = projectData.slides_data?.slides || [];
            this.transcript = projectData.transcript || '';
            this.summaryContent = projectData.summary_content || {};
            this.studentName = studentData?.name || this.email;
            this.submissions = submissionsData || [];
            this.pollVotes = pollData || [];

            // Build submission lookup: element_id → submission record
            this._submissionMap = new Map();
            this.submissions.forEach(s => {
                if (s.element_id) this._submissionMap.set(s.element_id, s);
            });

            this._renderHero();
            this._renderOverview();
            this._renderSlides();
            this._initTOC();
            this._initProgress();
            this._initAdminPanel();
        } catch (err) {
            console.error('[CourseSummary] init error:', err);
            this._renderError('載入資料時發生錯誤');
        } finally {
            this._showLoading(false);
        }
    }

    // ── Data Loading ──
    async _loadProject() {
        try {
            const res = await db.select('projects', { filter: { join_code: `eq.${this.sessionCode}` } });
            return this._unwrap(res)[0] || null;
        } catch (e) { return null; }
    }

    async _loadStudent() {
        try {
            const res = await db.select('students', {
                filter: { email: `eq.${this.email}`, session_code: `eq.${this.sessionCode}` },
            });
            return this._unwrap(res)[0] || null;
        } catch (e) { return null; }
    }

    async _loadSubmissions() {
        try {
            const qid = this.sessionUUID || this.sessionCode;
            const res = await db.select('submissions', {
                filter: { session_id: `eq.${qid}`, student_email: `eq.${this.email}` },
            });
            return this._unwrap(res);
        } catch (e) { return []; }
    }

    async _loadPollVotes() {
        try {
            const qid = this.sessionUUID || this.sessionCode;
            const res = await db.select('poll_votes', {
                filter: { session_code: `eq.${qid}`, student_email: `eq.${this.email}` },
            });
            return this._unwrap(res);
        } catch (e) { return []; }
    }

    _unwrap(result) {
        if (!result) return [];
        if (result.data && Array.isArray(result.data)) return result.data;
        if (Array.isArray(result)) return result;
        return [];
    }

    // ═══════════════════════════════════════
    //  RENDERING
    // ═══════════════════════════════════════

    _renderHero() {
        const el = document.getElementById('summaryHero');
        if (!el) return;
        el.querySelector('.summary-hero-title').textContent = this.projectName;
        el.querySelector('.summary-hero-subtitle').textContent =
            this._pangu(`${this.studentName}，以下是你在本次課程中的重點回顧與互動紀錄`);
        const badge = el.querySelector('.summary-hero-badge');
        if (badge && this.instructor) {
            badge.innerHTML = `<span class="material-symbols-outlined" style="font-size:0.85rem">school</span> 講師：${this.instructor}`;
        }
    }

    // ── Overview Cards ──
    _renderOverview() {
        const container = document.getElementById('summaryOverview');
        if (!container) return;

        const interactionSubs = this.submissions.filter(s => s.element_id && s.element_id !== '');
        const homeworkSubs = this.submissions.filter(s => !s.element_id || s.element_id === '');
        const total = interactionSubs.length;
        const correctCount = interactionSubs.filter(s => s.is_correct === true).length;
        const wrongCount = interactionSubs.filter(s => s.is_correct === false).length;
        const avgScore = total > 0
            ? Math.round(interactionSubs.reduce((acc, s) => acc + (parseInt(s.score) || 0), 0) / total)
            : 0;

        container.innerHTML = `
            <div class="overview-grid">
                <div class="overview-card accent">
                    <span class="material-symbols-outlined">bar_chart_4_bars</span>
                    <div class="overview-value">${avgScore}<small>分</small></div>
                    <div class="overview-label">平均得分</div>
                </div>
                <div class="overview-card success">
                    <span class="material-symbols-outlined">check_circle</span>
                    <div class="overview-value">${correctCount}</div>
                    <div class="overview-label">答對題數</div>
                </div>
                <div class="overview-card warn">
                    <span class="material-symbols-outlined">cancel</span>
                    <div class="overview-value">${wrongCount}</div>
                    <div class="overview-label">答錯題數</div>
                </div>
                <div class="overview-card info">
                    <span class="material-symbols-outlined">assignment</span>
                    <div class="overview-value">${homeworkSubs.length}</div>
                    <div class="overview-label">已交作業</div>
                </div>
            </div>`;
    }

    // ═══════════════════════════════════════
    //  SLIDES → SECTIONS  (article flow)
    // ═══════════════════════════════════════
    _renderSlides() {
        const container = document.getElementById('summarySections');
        if (!container) return;
        container.innerHTML = '';

        // Step 1: Parse all slides
        const parsed = this.slides.map((slide, idx) => {
            const { title, bodyTexts, interactives } = this._parseSlide(slide.elements || []);
            return { title, bodyTexts, interactives, slideIdx: idx };
        }).filter(s => s.title && (s.bodyTexts.length > 0 || s.interactives.length > 0));

        // Step 2: Group consecutive text-only slides → merged topic sections
        const groups = [];
        let currentGroup = null;

        parsed.forEach(slide => {
            const hasInteraction = slide.interactives.length > 0;
            if (hasInteraction) {
                if (currentGroup) { groups.push(currentGroup); currentGroup = null; }
                groups.push({ type: 'interactive', slides: [slide] });
            } else {
                if (!currentGroup) {
                    currentGroup = { type: 'knowledge', slides: [] };
                }
                currentGroup.slides.push(slide);
                if (currentGroup.slides.length >= 3) {
                    groups.push(currentGroup);
                    currentGroup = null;
                }
            }
        });
        if (currentGroup) groups.push(currentGroup);

        // Step 3: Insert intro copy before first section
        const intro = document.createElement('div');
        intro.className = 'summary-intro';
        intro.innerHTML = `
            <div class="intro-heading">
                <span class="material-symbols-outlined">emoji_people</span>
                開始之前
            </div>
            <p>${this._pangu('別擔心，這份摘要整理了今天課程的所有重點。即使有些概念還不太熟悉，透過這份回顧，你會發現其實你已經學到很多了。慢慢看，沒有任何壓力。')}</p>`;
        container.appendChild(intro);

        // Step 4: Render each group as article sections
        let sectionNum = 0;
        const midPoint = Math.ceil(groups.length / 2);

        groups.forEach((group, groupIdx) => {
            sectionNum++;
            const section = document.createElement('div');
            section.className = 'summary-section';
            section.id = `section-${sectionNum}`;

            if (group.type === 'interactive') {
                const slide = group.slides[0];
                const hasAttempted = slide.interactives.some(el => this._submissionMap.has(el.id));
                const interactionHTML = slide.interactives.map(el => this._buildInteractionResult(el)).join('');
                const articleHTML = this._buildKnowledgeArticle(slide.title, slide.bodyTexts);

                const sectionId = `section-${sectionNum}`;
                const savedBody = this.summaryContent[sectionId];
                const editable = this.isAdmin ? 'contenteditable="true"' : '';

                section.innerHTML = `
                    <div class="summary-section-header">
                        <div class="summary-section-number">${sectionNum}</div>
                        <h2 class="summary-section-title">${slide.title}</h2>
                        <p class="summary-section-subtitle">
                            <span class="material-symbols-outlined" style="font-size:1rem;vertical-align:-3px;margin-right:4px">assignment</span>
                            含互動練習
                        </p>
                    </div>
                    <div class="article-body" ${editable} data-section-id="${sectionId}">
                        ${savedBody || articleHTML}
                    </div>
                    <div class="article-interaction">
                        <h3>
                            <span class="material-symbols-outlined">quiz</span>
                            ${hasAttempted ? '你的作答結果' : '互動練習'}
                        </h3>
                        ${interactionHTML}
                    </div>`;
            } else {
                // Knowledge article — full-width flow
                const primaryTitle = group.slides[0].title;
                const allBodyTexts = group.slides.flatMap(s => s.bodyTexts);
                const subTopics = group.slides.length > 1
                    ? group.slides.map(s => s.title)
                    : [];

                const articleHTML = this._buildKnowledgeArticle(primaryTitle, allBodyTexts, subTopics);
                const visualHTML = this._buildVisualCard(primaryTitle, allBodyTexts, subTopics);

                const sectionId = `section-${sectionNum}`;
                const savedBody = this.summaryContent[sectionId];
                const editable = this.isAdmin ? 'contenteditable="true"' : '';

                section.innerHTML = `
                    <div class="summary-section-header">
                        <div class="summary-section-number">${sectionNum}</div>
                        <h2 class="summary-section-title">${primaryTitle}</h2>
                        ${group.slides.length > 1 ? `<p class="summary-section-subtitle">
                            <span class="material-symbols-outlined" style="font-size:1rem;vertical-align:-3px;margin-right:4px">auto_stories</span>
                            統整 ${group.slides.length} 頁重點
                        </p>` : ''}
                    </div>
                    <div class="article-body" ${editable} data-section-id="${sectionId}">
                        ${savedBody || articleHTML}
                    </div>
                    <figure class="article-figure">
                        ${visualHTML}
                    </figure>`;
            }

            container.appendChild(section);

            // Insert encouragement at mid-point
            if (groupIdx === midPoint - 1) {
                const enc = document.createElement('div');
                enc.className = 'summary-encouragement';
                enc.innerHTML = `
                    <div class="intro-heading">
                        <span class="material-symbols-outlined">pace</span>
                        你已經讀到一半了
                    </div>
                    <p>${this._pangu('接下來的內容會和前面學到的概念互相呼應，慢慢看就好。如果前面有不熟的部分，等讀完後再回頭看往往會更清晰。')}</p>`;
                container.appendChild(enc);
            }
        });

        // Add homework section if any text/url subs
        const homeworkSubs = this.submissions.filter(s => !s.element_id || s.element_id === '');
        if (homeworkSubs.length > 0) {
            sectionNum++;
            const hwSection = this._buildHomeworkSection(homeworkSubs, sectionNum);
            container.appendChild(hwSection);
        }
    }

    // ── Parse Slide Elements ──
    _parseSlide(elements) {
        let title = '';
        const bodyTexts = [];
        const interactives = [];

        elements.forEach(el => {
            if (el.type === 'shape' || el.type === 'image') return;

            if (el.type === 'text') {
                const text = this._stripHTML(el.content || '');
                if (!text.trim()) return;
                const fontSize = parseInt(el.fontSize) || 14;

                if (fontSize >= 28 && !title) {
                    title = text.trim();
                } else if (fontSize >= 13 && text.trim().length > 2) {
                    bodyTexts.push(text.trim());
                }
            } else if (['matching', 'fillblank', 'quiz', 'poll', 'copycard'].includes(el.type)) {
                interactives.push(el);
            }
        });

        return { title, bodyTexts, interactives };
    }

    // ═══════════════════════════════════════
    //  KNOWLEDGE ARTICLE BUILDER
    // ═══════════════════════════════════════
    _buildKnowledgeArticle(title, bodyTexts, subTopics = []) {
        if (bodyTexts.length === 0) {
            return `<h3>${title}</h3><p>本段為互動練習環節，請查看下方你的作答結果。</p>`;
        }

        let html = `<h3>知識重點</h3>`;

        // If sub-topics from merged slides, show them as chips
        if (subTopics.length > 1) {
            html += `<div class="knowledge-topics">`;
            subTopics.forEach(t => {
                html += `<span class="knowledge-topic-chip">${t}</span>`;
            });
            html += `</div>`;
        }

        // Separate bullets vs paragraphs
        const bullets = [];
        const paragraphs = [];

        bodyTexts.forEach(text => {
            if (/^(\d+|•|✓|◆|►|▸|→)/.test(text) || (text.includes('—') && text.length < 120) || text.length < 80) {
                bullets.push(text);
            } else {
                paragraphs.push(text);
            }
        });

        // Render paragraphs with extended insight
        paragraphs.forEach((p, i) => {
            html += `<p>${this._pangu(this._highlightText(p))}</p>`;
            // Add insight callout after first long paragraph
            if (i === 0 && p.length > 40) {
                const insight = this._generateInsight(title, p);
                if (insight) {
                    html += `
                        <div class="knowledge-insight">
                            <span class="material-symbols-outlined">arrow_outward</span>
                            <div>
                                <strong>延伸思考</strong>
                                <p>${insight}</p>
                            </div>
                        </div>`;
                }
            }
        });

        // Render bullet points with keywords highlighted
        if (bullets.length > 0) {
            html += '<ul class="summary-bullets">';
            bullets.forEach(b => {
                html += `<li>${this._pangu(this._highlightKeywords(b))}</li>`;
            });
            html += '</ul>';
        }

        // Add practical tip
        const practicalTip = this._generatePracticalTip(title, bodyTexts);
        if (practicalTip) {
            html += `
                <div class="knowledge-tip">
                    <span class="material-symbols-outlined">bookmark</span>
                    <div>
                        <strong>實務應用</strong>
                        <p>${practicalTip}</p>
                    </div>
                </div>`;
        }

        return html;
    }

    // ── Build Visual Card (right side) ──
    _buildVisualCard(title, bodyTexts, subTopics = []) {
        const allText = bodyTexts.join(' ').toLowerCase();
        const titleLower = title.toLowerCase();

        // Detect card type from content
        if (this._hasMetricKeywords(allText, titleLower)) {
            return this._buildMetricCard(title, bodyTexts);
        } else if (this._hasFlowKeywords(allText, titleLower)) {
            return this._buildFlowCard(title, bodyTexts);
        } else {
            return this._buildChecklistCard(title, bodyTexts, subTopics);
        }
    }

    _hasMetricKeywords(text, title) {
        const keywords = ['kpi', 'roi', 'roas', 'ctr', 'cpc', 'cpa', 'cac', 'ltv', 'arpu', 'mrr',
            '指標', '成效', '轉換率', '點擊率', '投報率', '成本', '營收', '數據', '%'];
        return keywords.some(k => text.includes(k) || title.includes(k));
    }

    _hasFlowKeywords(text, title) {
        const keywords = ['漏斗', '流程', '步驟', '階段', '策略', '旅程', 'funnel', 'journey',
            '第一步', '第二步', '規劃', '執行', '優化'];
        return keywords.some(k => text.includes(k) || title.includes(k));
    }

    // ── Metric Card ──
    _buildMetricCard(title, bodyTexts) {
        const metrics = this._extractMetrics(bodyTexts);
        let html = `
            <div class="visual-card metric-card">
                <div class="visual-card-header">
                    <span class="material-symbols-outlined">analytics</span>
                    <span>關鍵指標一覽</span>
                </div>
                <div class="metric-grid">`;

        if (metrics.length > 0) {
            metrics.forEach(m => {
                html += `
                    <div class="metric-item">
                        <div class="metric-name">${m.name}</div>
                        <div class="metric-desc">${m.desc}</div>
                    </div>`;
            });
        } else {
            // Fallback: show key bullet points as metrics
            bodyTexts.slice(0, 4).forEach(t => {
                const short = t.length > 50 ? t.substring(0, 50) + '…' : t;
                html += `
                    <div class="metric-item">
                        <div class="metric-name">${short.split('—')[0].split('：')[0].trim()}</div>
                        <div class="metric-desc">${short.includes('—') ? short.split('—')[1]?.trim() || '' : short.includes('：') ? short.split('：')[1]?.trim() || '' : ''}</div>
                    </div>`;
            });
        }

        html += `</div></div>`;
        return html;
    }

    // ── Flow Card ──
    _buildFlowCard(title, bodyTexts) {
        const steps = bodyTexts.slice(0, 5);
        let html = `
            <div class="visual-card flow-card">
                <div class="visual-card-header">
                    <span class="material-symbols-outlined">account_tree</span>
                    <span>流程概覽</span>
                </div>
                <div class="flow-steps">`;

        steps.forEach((step, idx) => {
            const label = step.length > 40 ? step.substring(0, 40) + '…' : step;
            html += `
                <div class="flow-step">
                    <div class="flow-step-num">${idx + 1}</div>
                    <div class="flow-step-label">${label}</div>
                </div>`;
            if (idx < steps.length - 1) {
                html += `<div class="flow-step-connector"></div>`;
            }
        });

        html += `</div></div>`;
        return html;
    }

    // ── Checklist Card ──
    _buildChecklistCard(title, bodyTexts, subTopics = []) {
        const items = subTopics.length > 1 ? subTopics : bodyTexts.slice(0, 6);
        let html = `
            <div class="visual-card checklist-card">
                <div class="visual-card-header">
                    <span class="material-symbols-outlined">fact_check</span>
                    <span>學習重點清單</span>
                </div>
                <div class="checklist-items">`;

        items.forEach(item => {
            const label = item.length > 60 ? item.substring(0, 60) + '…' : item;
            html += `
                <div class="checklist-item">
                    <span class="material-symbols-outlined checklist-check">check_circle</span>
                    <span>${label}</span>
                </div>`;
        });

        html += `</div></div>`;
        return html;
    }

    // ── Extract metric-like items from text ──
    _extractMetrics(bodyTexts) {
        const metrics = [];
        const metricPatterns = [
            /([A-Z]{2,6})\s*[—\-:：]\s*(.+)/,
            /(.+?)\s*[—\-:：]\s*(.+)/,
        ];

        bodyTexts.forEach(text => {
            for (const pattern of metricPatterns) {
                const match = text.match(pattern);
                if (match && match[1].trim().length <= 20) {
                    metrics.push({ name: match[1].trim(), desc: match[2].trim() });
                    break;
                }
            }
        });

        return metrics.slice(0, 6);
    }

    // ── Highlight keywords in text ──
    _highlightKeywords(text) {
        // Highlight uppercase acronyms and known terms
        return text.replace(/\b([A-Z]{2,})\b/g, '<span class="text-highlight">$1</span>');
    }

    // ── Highlight bold-origin keywords in paragraph text ──
    _highlightText(text) {
        // Mark key terms that appear between bold tags or known patterns
        return text
            .replace(/\b([A-Z]{2,})\b/g, '<span class="text-highlight">$1</span>')
            .replace(/「([^」]+)」/g, '「<span class="text-highlight">$1</span>」');
    }

    // ── CJK-English auto-spacing (pangu) ──
    _pangu(text) {
        // Insert hair space between CJK and half-width characters
        return text
            .replace(/([一-鿿㐀-䶿＀-￯])([A-Za-z0-9])/g, '$1 $2')
            .replace(/([A-Za-z0-9])([一-鿿㐀-䶿＀-￯])/g, '$1 $2');
    }

    // ── Generate insight from content ──
    _generateInsight(title, paragraph) {
        const titleLower = title.toLowerCase();
        const textLower = paragraph.toLowerCase();

        // Contextual insight maps
        const insightMap = [
            { keywords: ['廣告', 'ad', '投放', '曝光'], insight: '在實際操作中，廣告成效不只取決於預算，更關鍵的是目標受眾的精準度與素材的A/B測試。建議從小預算開始，逐步放大效果好的組合。' },
            { keywords: ['roi', 'roas', '報酬率', '投報'], insight: '計算 ROI 時，別忘了納入隱性成本（如人力、工具訂閱費）。一般來說，電商 ROAS 需要達到 3 以上才算健康的投資回報。' },
            { keywords: ['漏斗', 'funnel', '轉換'], insight: '行銷漏斗的核心思維是「逐層篩選」。每一層的流失率都是優化機會，關鍵是找出流失最嚴重的環節，而非試圖全部同時改善。' },
            { keywords: ['受眾', '目標', 'persona', '用戶'], insight: '建立受眾輪廓時，實際的消費行為數據比人口統計更有參考價值。善用社群洞察工具和 CRM 數據來描繪真實的用戶樣貌。' },
            { keywords: ['內容', 'content', '素材', '文案'], insight: '好的內容不只是吸引眼球，更重要的是引導受眾採取行動。每則內容都應有明確的 CTA（Call To Action），並與整體行銷目標一致。' },
            { keywords: ['社群', 'social', '經營', '互動'], insight: '社群經營的黃金法則是「80/20 原則」：80% 的內容提供價值（教育、娛樂、啟發），20% 才做銷售推廣。持續性比爆發性更重要。' },
            { keywords: ['數據', 'data', '分析', '追蹤'], insight: '數據分析的第一步是確保追蹤設置正確。常見的錯誤包括：UTM 參數不一致、事件命名混亂、沒有設定轉換目標。這些基礎做好，後續分析才有意義。' },
            { keywords: ['品牌', 'brand', '定位', '形象'], insight: '品牌定位的核心是在目標受眾心中佔據一個獨特的位置。這不只是 logo 和色彩，更是品牌承諾和每一次與消費者互動的一致性。' },
            { keywords: ['email', '信件', '電子報', '開信'], insight: 'Email 行銷的關鍵指標是開信率和點擊率。最佳實踐包括：個人化主旨行、發送時間測試、內容分段，以及持續清理無效名單以維持送達率。' },
            { keywords: ['seo', '搜尋', '關鍵字', '排名'], insight: 'SEO 是一場長期戰。除了關鍵字佈局，Google 越來越重視內容品質（E-E-A-T）和使用者體驗（Core Web Vitals）。建議同時耕耘長尾關鍵字以獲取精準流量。' },
            { keywords: ['ai', '人工智慧', '自動化', '工具'], insight: 'AI 工具正在改變行銷的每個環節——從文案生成、圖片製作到受眾分析。關鍵不是取代人類，而是用 AI 加速重複性工作，讓人專注在策略和創意上。' },
            { keywords: ['預算', '成本', '花費', 'budget'], insight: '行銷預算的分配建議遵循「70-20-10」法則：70% 投入已驗證有效的管道，20% 嘗試有潛力的新管道，10% 做實驗性的創新嘗試。' },
        ];

        for (const entry of insightMap) {
            if (entry.keywords.some(k => titleLower.includes(k) || textLower.includes(k))) {
                return entry.insight;
            }
        }

        // Generic insight
        if (paragraph.length > 60) {
            return '理解這個概念後，建議立刻在你的工作中找一個小場景來實際應用。「學完立即用」是最有效的學習方式。';
        }
        return '';
    }

    // ── Generate practical tip ──
    _generatePracticalTip(title, bodyTexts) {
        const allText = (title + ' ' + bodyTexts.join(' ')).toLowerCase();

        const tipMap = [
            { keywords: ['kpi', '指標', '成效'], tip: '試著為你目前負責的專案設定 2-3 個核心 KPI，並建立每週追蹤的習慣。記住：不是所有數字都值得追蹤，選擇能直接影響決策的指標。' },
            { keywords: ['漏斗', 'funnel'], tip: '畫出你的產品或服務的行銷漏斗，計算每一層的轉換率。找出「最大漏水桶」——也就是流失率最高的階段，優先改善它。' },
            { keywords: ['受眾', 'persona', '目標'], tip: '花 30 分鐘訪談一位真實用戶，了解他們的購買動機和決策過程。這比任何市場報告都有價值。' },
            { keywords: ['廣告', 'ad', '投放'], tip: '下一次投放廣告時，至少準備 3 組不同的素材進行 A/B 測試。設定 3-5 天的測試期，然後將預算集中到表現最好的素材。' },
            { keywords: ['社群', 'social'], tip: '制定一份「內容日曆」，規劃未來兩週的發文主題。確保每則內容都有明確目的：是增加知名度、促進互動、還是導流轉換？' },
            { keywords: ['品牌', 'brand'], tip: '做一個「品牌審計」練習：檢查你的官網、社群、email 模板的視覺和語氣是否一致。品牌一致性是建立信任的基礎。' },
            { keywords: ['數據', 'data', '分析'], tip: '這週花 15 分鐘檢查你的 GA4 設定：確認追蹤碼正確安裝、轉換事件已設定、且有至少一個自訂報表。' },
        ];

        for (const entry of tipMap) {
            if (entry.keywords.some(k => allText.includes(k))) {
                return entry.tip;
            }
        }
        return '';
    }

    // ═══════════════════════════════════════
    //  INTERACTION RESULTS  (20% personalized)
    // ═══════════════════════════════════════
    _buildInteractionResult(el) {
        const sub = this._submissionMap.get(el.id);

        if (!sub) {
            // Student didn't interact with this element
            return `
                <div class="result-not-attempted">
                    <span class="material-symbols-outlined">info</span>
                    <span>你未完成此互動練習</span>
                </div>`;
        }

        let state = sub.state;
        if (typeof state === 'string') {
            try { state = JSON.parse(state); } catch { state = {}; }
        }

        switch (el.type) {
            case 'matching': return this._renderMatchingResult(el, sub, state);
            case 'fillblank': return this._renderFillblankResult(el, sub, state);
            case 'quiz': return this._renderQuizResult(el, sub, state);
            default: return this._renderGenericResult(sub);
        }
    }

    // ── Matching Result ──
    _renderMatchingResult(el, sub, state) {
        const total = state?.total || 0;
        const correct = state?.correct || 0;
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        let pairsHTML = '';
        if (el.pairs) {
            el.pairs.forEach(pair => {
                pairsHTML += `
                    <div class="result-pair">
                        <span class="result-pair-left">${pair.left}</span>
                        <span class="result-pair-arrow">→</span>
                        <span class="result-pair-right">${pair.right}</span>
                    </div>`;
            });
        }

        const statusBadge = this._statusBadge(sub.is_correct, sub.score);
        const tip = this._buildTip('matching', sub.is_correct, state);

        return `
            <div class="result-matching-panel">
                <div class="result-header">
                    <span class="material-symbols-outlined">join</span>
                    <span>你的配對結果</span>
                    ${statusBadge}
                </div>
                <div class="result-score-ring">
                    <div class="result-ring" style="--percent:${percent}">
                        <span class="result-ring-value">${correct}/${total}</span>
                    </div>
                    <span class="result-ring-label">配對正確</span>
                </div>
                ${pairsHTML ? `<div class="result-pairs">${pairsHTML}</div>` : ''}
                ${tip}
            </div>`;
    }

    // ── Fillblank Result ──
    _renderFillblankResult(el, sub, state) {
        const total = state?.total || 0;
        const correct = state?.correct || 0;
        const answers = state?.answers || [];
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
        const correctAnswers = el.blanks?.map(b => b.answer) || [];

        let blanksHTML = answers.map((ans, idx) => {
            const correctAns = correctAnswers[idx] || '?';
            const isRight = ans === correctAns;
            return `
                <div class="result-blank ${isRight ? 'correct' : 'wrong'}">
                    <span class="result-blank-num">${idx + 1}</span>
                    <div class="result-blank-content">
                        <div class="result-blank-student">${ans || '(未填)'}</div>
                        ${!isRight ? `<div class="result-blank-answer">正確答案：${correctAns}</div>` : ''}
                    </div>
                    <span class="material-symbols-outlined">${isRight ? 'check_circle' : 'cancel'}</span>
                </div>`;
        }).join('');

        const statusBadge = this._statusBadge(sub.is_correct, sub.score);
        const tip = this._buildTip('fillblank', sub.is_correct, state);

        return `
            <div class="result-fillblank-panel">
                <div class="result-header">
                    <span class="material-symbols-outlined">edit_note</span>
                    <span>你的填答結果</span>
                    ${statusBadge}
                </div>
                <div class="result-score-ring">
                    <div class="result-ring" style="--percent:${percent}">
                        <span class="result-ring-value">${correct}/${total}</span>
                    </div>
                    <span class="result-ring-label">填對</span>
                </div>
                <div class="result-blanks">${blanksHTML}</div>
                ${tip}
            </div>`;
    }

    // ── Quiz Result ──
    _renderQuizResult(el, sub, state) {
        const selected = state?.selected || [];
        const statusBadge = this._statusBadge(sub.is_correct, sub.score);
        const tip = this._buildTip('quiz', sub.is_correct, state);

        let optionsHTML = '';
        if (el.options) {
            el.options.forEach((opt, idx) => {
                const isSelected = selected.includes(idx);
                const isAnswer = el.correctIndex === idx || (Array.isArray(el.correctIndex) && el.correctIndex.includes(idx));
                let cls = 'result-option';
                if (isSelected && isAnswer) cls += ' correct';
                else if (isSelected && !isAnswer) cls += ' wrong';
                else if (isAnswer) cls += ' answer';

                optionsHTML += `
                    <div class="${cls}">
                        <span class="result-option-marker">${isSelected ? (isAnswer ? '✓' : '✗') : ''}</span>
                        <span>${opt.text || opt}</span>
                    </div>`;
            });
        } else {
            optionsHTML = `<div class="result-generic-answer">你選擇了選項 ${selected.map(i => i + 1).join(', ')}</div>`;
        }

        return `
            <div class="result-quiz-panel">
                <div class="result-header">
                    <span class="material-symbols-outlined">quiz</span>
                    <span>你的作答結果</span>
                    ${statusBadge}
                </div>
                <div class="result-options">${optionsHTML}</div>
                ${tip}
            </div>`;
    }

    // ── Generic Result ──
    _renderGenericResult(sub) {
        return `
            <div class="result-generic-panel">
                <div class="result-header">
                    <span class="material-symbols-outlined">${TYPE_ICONS[sub.type] || 'task'}</span>
                    <span>${TYPE_LABELS[sub.type] || sub.type}</span>
                </div>
                <div class="result-generic-content">
                    <p>${sub.content || '已完成'}</p>
                </div>
            </div>`;
    }

    // ── Homework Section ──
    _buildHomeworkSection(subs, num) {
        const section = document.createElement('div');
        section.className = 'summary-section';
        section.id = `section-${num}`;

        let cardsHTML = subs.map(sub => {
            const icon = sub.type === 'url' ? 'link' : 'description';
            return `
                <div class="result-homework-card">
                    <div class="result-homework-icon">
                        <span class="material-symbols-outlined">${icon}</span>
                    </div>
                    <div class="result-homework-info">
                        <div class="result-homework-title">${sub.assignment_title || '未命名作業'}</div>
                        <div class="result-homework-content">
                            ${sub.type === 'url'
                    ? `<a href="${sub.content}" target="_blank" rel="noopener">${sub.content}</a>`
                    : `<p>${sub.content || '—'}</p>`
                }
                        </div>
                        <div class="result-homework-time">${this._formatTime(sub.submitted_at || sub.created_at)}</div>
                    </div>
                </div>`;
        }).join('');

        section.innerHTML = `
            <div class="summary-section-header">
                <div class="summary-section-number">${num}</div>
                <h2 class="summary-section-title">課堂作業</h2>
                <p class="summary-section-subtitle">
                    <span class="material-symbols-outlined" style="font-size:1rem;vertical-align:-3px;margin-right:4px">assignment</span>
                    共提交 ${subs.length} 份作業
                </p>
            </div>
            <div class="summary-block full-width">
                <div class="summary-text">
                    <div class="result-homework-list">${cardsHTML}</div>
                </div>
            </div>`;
        return section;
    }

    // ── Status Badge ──
    _statusBadge(isCorrect, score) {
        if (isCorrect === true) {
            return `<span class="result-badge correct"><span class="material-symbols-outlined">check_circle</span> 答對</span>`;
        } else if (isCorrect === false) {
            return `<span class="result-badge wrong"><span class="material-symbols-outlined">cancel</span> 答錯</span>`;
        }
        return `<span class="result-badge neutral">已提交</span>`;
    }

    // ── Tips ──
    _buildTip(type, isCorrect, state) {
        let tip = '';
        if (type === 'quiz' && isCorrect === false) {
            tip = '回顧投影片內容，重新理解這個概念，下次會更好！';
        } else if (type === 'matching') {
            const pct = state?.total > 0 ? (state.correct / state.total) * 100 : 0;
            if (pct === 100) tip = '太棒了！所有指標都配對正確，你掌握了核心概念！';
            else if (pct >= 50) tip = '大部分配對正確，建議回顧沒配對到的指標定義。';
            else tip = '建議回顧課程中的指標定義，加強對 CTR、ROAS、CAC、LTV 的記憶。';
        } else if (type === 'fillblank') {
            const pct = state?.total > 0 ? (state.correct / state.total) * 100 : 0;
            if (pct === 100) tip = '完美！你完全掌握了行銷漏斗的各個階段！';
            else tip = '建議回顧「行銷轉換漏斗」那一頁投影片，對照正確答案加強記憶。';
        } else if (isCorrect) {
            tip = '很好！你答對了這題，繼續保持！';
        }

        if (!tip) return '';
        return `
            <div class="result-tip">
                <span class="material-symbols-outlined">arrow_forward</span>
                <span>${tip}</span>
            </div>`;
    }

    // ── TOC ──
    _initTOC() {
        const tocEl = document.getElementById('summaryTOC');
        const mobileTocEl = document.getElementById('mobileTOC');
        if (!tocEl) return;
        tocEl.innerHTML = '';
        if (mobileTocEl) mobileTocEl.innerHTML = '';

        const sections = document.querySelectorAll('.summary-section');
        sections.forEach((sec, idx) => {
            const title = sec.querySelector('.summary-section-title')?.textContent || `章節 ${idx + 1}`;
            const li = document.createElement('li');
            li.innerHTML = `<a href="#${sec.id}"><span class="toc-number">${idx + 1}</span>${title}</a>`;
            tocEl.appendChild(li);

            // Clone for mobile TOC
            if (mobileTocEl) {
                const mobileLi = li.cloneNode(true);
                mobileLi.querySelector('a').addEventListener('click', () => {
                    document.getElementById('mobileTocDrawer')?.classList.remove('show');
                });
                mobileTocEl.appendChild(mobileLi);
            }
        });

        const links = tocEl.querySelectorAll('a');
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    links.forEach(a => a.classList.remove('active'));
                    const active = tocEl.querySelector(`a[href="#${entry.target.id}"]`);
                    if (active) active.classList.add('active');
                }
            });
        }, { rootMargin: '-80px 0px -60% 0px' });
        sections.forEach(sec => observer.observe(sec));

        // Mobile TOC toggle
        const toggleBtn = document.getElementById('mobileTocToggle');
        const drawer = document.getElementById('mobileTocDrawer');
        if (toggleBtn && drawer) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                drawer.classList.toggle('show');
            });
            document.addEventListener('click', (e) => {
                if (!drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
                    drawer.classList.remove('show');
                }
            });
        }
    }

    // ── Progress ──
    _initProgress() {
        const bar = document.getElementById('progressFill');
        if (!bar) return;
        window.addEventListener('scroll', () => {
            const docH = document.documentElement.scrollHeight - window.innerHeight;
            const pct = docH > 0 ? Math.min((window.scrollY / docH) * 100, 100) : 0;
            bar.style.width = `${pct}%`;
        });
    }

    // ── Admin Transcript Panel ──
    _initAdminPanel() {
        const params = new URLSearchParams(location.search);
        if (params.get('admin') !== '1') return;

        const panel = document.getElementById('adminTranscriptPanel');
        if (!panel) return;
        panel.style.display = 'block';

        const textarea = panel.querySelector('#transcriptInput');
        const saveBtn = panel.querySelector('#saveTranscriptBtn');
        const wordCount = panel.querySelector('#transcriptWordCount');

        // Pre-fill with existing transcript
        if (this.transcript) {
            textarea.value = this.transcript;
            wordCount.textContent = `${this.transcript.length} 字`;
        }

        textarea.addEventListener('input', () => {
            wordCount.textContent = `${textarea.value.length} 字`;
        });

        saveBtn.addEventListener('click', async () => {
            const text = textarea.value.trim();
            if (!text) return;

            saveBtn.disabled = true;
            saveBtn.textContent = '儲存中...';

            try {
                await db.update('projects', {
                    filter: { join_code: `eq.${this.sessionCode}` },
                    body: { transcript: text },
                });
                this.transcript = text;
                saveBtn.textContent = '已儲存';
                setTimeout(() => {
                    saveBtn.disabled = false;
                    saveBtn.textContent = '儲存逐字稿';
                }, 2000);
            } catch (err) {
                console.error('[CourseSummary] save transcript error:', err);
                saveBtn.textContent = '儲存失敗';
                saveBtn.disabled = false;
            }
        });

        // ── Floating Save Toolbar for inline editing ──
        const toolbar = document.createElement('div');
        toolbar.className = 'admin-save-toolbar';
        toolbar.innerHTML = `
            <div class="admin-toolbar-inner">
                <span class="admin-toolbar-label">
                    <span class="material-symbols-outlined" style="font-size:1.1rem;vertical-align:-3px">edit_note</span>
                    講師編輯模式
                </span>
                <button id="saveContentBtn" class="admin-save-btn">
                    <span class="material-symbols-outlined" style="font-size:1rem">save</span>
                    儲存摘要內容
                </button>
            </div>`;
        document.body.appendChild(toolbar);

        // Save all editable sections
        const saveContentBtn = document.getElementById('saveContentBtn');
        saveContentBtn.addEventListener('click', async () => {
            const editables = document.querySelectorAll('[data-section-id][contenteditable]');
            const content = {};
            editables.forEach(el => {
                content[el.dataset.sectionId] = el.innerHTML;
            });

            saveContentBtn.disabled = true;
            saveContentBtn.querySelector('.material-symbols-outlined').textContent = 'hourglass_top';
            saveContentBtn.childNodes[1].textContent = ' 儲存中...';

            try {
                await db.update('projects', {
                    filter: { join_code: `eq.${this.sessionCode}` },
                    body: { summary_content: content },
                });
                this.summaryContent = content;
                saveContentBtn.querySelector('.material-symbols-outlined').textContent = 'check_circle';
                saveContentBtn.childNodes[1].textContent = ' 已儲存';
                setTimeout(() => {
                    saveContentBtn.disabled = false;
                    saveContentBtn.querySelector('.material-symbols-outlined').textContent = 'save';
                    saveContentBtn.childNodes[1].textContent = ' 儲存摘要內容';
                }, 2000);
            } catch (err) {
                console.error('[CourseSummary] save content error:', err);
                saveContentBtn.querySelector('.material-symbols-outlined').textContent = 'error';
                saveContentBtn.childNodes[1].textContent = ' 儲存失敗';
                saveContentBtn.disabled = false;
            }
        });
    }

    // ── Helpers ──
    _stripHTML(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || '';
    }

    _formatTime(str) {
        if (!str) return '';
        try {
            const d = new Date(str);
            return d.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return str; }
    }

    _showLoading(show) {
        const el = document.getElementById('summaryLoading');
        if (el) el.style.display = show ? 'flex' : 'none';
        const content = document.getElementById('summaryMainContent');
        if (content) content.style.display = show ? 'none' : '';
    }

    _renderError(msg) {
        this._showLoading(false);
        const container = document.getElementById('summaryMainContent');
        if (!container) return;
        container.style.display = '';
        container.innerHTML = `
            <div class="summary-empty">
                <span class="material-symbols-outlined" style="font-size:3rem;color:var(--text-muted)">error</span>
                <h3>無法載入摘要</h3>
                <p>${msg}</p>
            </div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CourseSummary().init();
});
