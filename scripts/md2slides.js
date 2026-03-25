// md2slides.js — Markdown → slide JSON 轉換引擎（非 ES module 版）
(function() {
'use strict';
const parseMd = window.MdParser.parseMd;

// ═════════════════════════════════════════
// 配色方案（輪替）
// ═════════════════════════════════════════
const ACCENTS = [
    { bar: '#1765cc', bg: '#e8f0fe', light: '#d2e3fc', text: '#1e293b', dot: '#4285f4' },
    { bar: '#0891b2', bg: '#ecfeff', light: '#cffafe', text: '#164e63', dot: '#22d3ee' },
    { bar: '#059669', bg: '#ecfdf5', light: '#d1fae5', text: '#064e3b', dot: '#34d399' },
    { bar: '#b45309', bg: '#fffbeb', light: '#fef3c7', text: '#78350f', dot: '#fbbf24' },
    { bar: '#7c3aed', bg: '#f5f3ff', light: '#ede9fe', text: '#4c1d95', dot: '#8b5cf6' },
    { bar: '#dc2626', bg: '#fef2f2', light: '#fee2e2', text: '#7f1d1d', dot: '#f87171' },
];

let _idCounter = 0;
function _genId() {
    return `md_${Date.now()}_${++_idCounter}`;
}

// ═════════════════════════════════════════
// 主轉換函式
// ═════════════════════════════════════════
function md2slides(markdown, genId) {
    const parsed = parseMd(markdown);
    const gen = genId || _genId;
    _idCounter = 0;

    return parsed.map((page, idx) => {
        const c = ACCENTS[idx % ACCENTS.length];
        switch (page.type) {
            case 'cover': return _buildCover(gen, page, c);
            case 'section': return _buildSection(gen, page, c);
            case 'two-column': return _buildTwoColumn(gen, page, c);
            case 'three-card': return _buildThreeCard(gen, page, c);
            case 'quote': return _buildQuote(gen, page, c);
            case 'numbered-list': return _buildNumberedList(gen, page, c);
            case 'thank-you': return _buildThankYou(gen, page, c);
            case 'interactive': return _buildInteractive(gen, page, c);
            default: return _buildContent(gen, page, c);
        }
    });
}

// ═════════════════════════════════════════
// 各 slide type 建構函式
// ═════════════════════════════════════════

function _buildCover(gen, page, c) {
    return {
        id: gen(), background: '#ffffff',
        elements: [
            { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 8, height: 540, background: c.bar },
            { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 490, width: 960, height: 50, background: c.bg },
            { id: gen(), type: 'shape', shapeType: 'circle', x: 820, y: 30, width: 100, height: 100, background: c.light, opacity: 0.5 },
            {
                id: gen(), type: 'text', x: 80, y: 160, width: 720, height: 80,
                content: `<b style="font-size:42px;color:${c.text}">${page.heading || ''}</b>`, fontSize: 42, bold: true
            },
            ...(page.subheading ? [{
                id: gen(), type: 'text', x: 80, y: 260, width: 720, height: 50,
                content: `<span style="font-size:20px;color:#64748b">${page.subheading}</span>`, fontSize: 20
            }] : []),
            { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: page.subheading ? 320 : 260, width: 100, height: 4, background: c.bar, borderRadius: 2 },
        ]
    };
}

function _buildSection(gen, page, c) {
    return {
        id: gen(), background: c.bar,
        elements: [
            { id: gen(), type: 'shape', shapeType: 'circle', x: -60, y: -60, width: 200, height: 200, background: 'rgba(255,255,255,0.08)' },
            { id: gen(), type: 'shape', shapeType: 'circle', x: 780, y: 400, width: 250, height: 250, background: 'rgba(255,255,255,0.05)' },
            {
                id: gen(), type: 'text', x: 80, y: 180, width: 800, height: 80,
                content: `<b style="font-size:40px;color:#ffffff">${page.heading || ''}</b>`, fontSize: 40, bold: true
            },
            ...(page.subheading ? [{
                id: gen(), type: 'text', x: 80, y: 270, width: 800, height: 50,
                content: `<span style="font-size:22px;color:rgba(255,255,255,0.8)">${page.subheading}</span>`, fontSize: 22
            }] : []),
            { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 270, width: 60, height: 4, background: 'rgba(255,255,255,0.5)', borderRadius: 2 },
        ]
    };
}

function _buildContent(gen, page, c) {
    const elements = [
        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 6, background: c.bar },
    ];

    // 標題
    const title = page.subheading || page.heading || '';
    if (title) {
        elements.push({
            id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50,
            content: `<b style="font-size:28px;color:${c.text}">${title}</b>`, fontSize: 28, bold: true
        });
        elements.push({
            id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 82, width: 80, height: 3, background: c.bar, borderRadius: 2
        });
    }

    // Body 內容
    let y = title ? 100 : 40;
    for (const line of page.bodyLines) {
        if (line.type === 'bullet') {
            elements.push({
                id: gen(), type: 'shape', shapeType: 'circle', x: 68, y: y + 8, width: 8, height: 8, background: c.dot
            });
            elements.push({
                id: gen(), type: 'text', x: 88, y: y, width: 812, height: 36,
                content: `<span style="font-size:18px;color:#334155">${line.content}</span>`, fontSize: 18
            });
            y += 42;
        } else if (line.type === 'numbered') {
            elements.push({
                id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: y + 2, width: 28, height: 28, background: c.bar, borderRadius: 14
            });
            elements.push({
                id: gen(), type: 'text', x: 60, y: y + 2, width: 28, height: 28,
                content: `<span style="font-size:14px;color:#fff;text-align:center;display:block">${line.num}</span>`, fontSize: 14
            });
            elements.push({
                id: gen(), type: 'text', x: 100, y: y, width: 800, height: 36,
                content: `<span style="font-size:18px;color:#334155">${line.content}</span>`, fontSize: 18
            });
            y += 44;
        } else if (line.type === 'subheading') {
            elements.push({
                id: gen(), type: 'text', x: 60, y: y, width: 840, height: 36,
                content: `<b style="font-size:22px;color:${c.bar}">${line.content}</b>`, fontSize: 22, bold: true
            });
            y += 40;
        } else {
            elements.push({
                id: gen(), type: 'text', x: 60, y: y, width: 840, height: 36,
                content: `<span style="font-size:18px;color:#475569">${line.content}</span>`, fontSize: 18
            });
            y += 38;
        }
    }

    return { id: gen(), background: '#ffffff', elements };
}

function _buildTwoColumn(gen, page, c) {
    const elements = [
        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 6, background: c.bar },
    ];

    const title = page.subheading || page.heading || '';
    if (title) {
        elements.push({
            id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50,
            content: `<b style="font-size:28px;color:${c.text}">${title}</b>`, fontSize: 28, bold: true
        });
    }

    // 左欄
    const cols = page.columns || [[], []];
    const colWidth = 400;
    const startY = title ? 100 : 40;

    [0, 1].forEach(colIdx => {
        const xBase = colIdx === 0 ? 60 : 520;
        let y = startY;

        // 欄位背景
        elements.push({
            id: gen(), type: 'shape', shapeType: 'rectangle',
            x: xBase - 10, y: startY - 10, width: colWidth + 20, height: 380,
            background: colIdx === 0 ? c.light : '#f8fafc', borderRadius: 12, opacity: 0.6
        });

        (cols[colIdx] || []).forEach(text => {
            elements.push({
                id: gen(), type: 'text', x: xBase + 10, y, width: colWidth - 20, height: 32,
                content: `<span style="font-size:17px;color:#334155">${text}</span>`, fontSize: 17
            });
            y += 36;
        });
    });

    // 中間分隔線
    elements.push({
        id: gen(), type: 'shape', shapeType: 'rectangle',
        x: 477, y: startY + 10, width: 2, height: 350, background: c.dot, opacity: 0.3
    });

    return { id: gen(), background: '#ffffff', elements };
}

function _buildThreeCard(gen, page, c) {
    // 把 bodyLines 分成 3 組
    const items = page.bodyLines.filter(l => l.type === 'bullet' || l.type === 'text');
    const cardSize = Math.ceil(items.length / 3);
    const cards = [items.slice(0, cardSize), items.slice(cardSize, cardSize * 2), items.slice(cardSize * 2)];

    const elements = [
        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 6, background: c.bar },
    ];

    const title = page.subheading || page.heading || '';
    if (title) {
        elements.push({
            id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50,
            content: `<b style="font-size:28px;color:${c.text}">${title}</b>`, fontSize: 28
        });
    }

    cards.forEach((card, ci) => {
        const x = 50 + ci * 300;
        // Card background
        elements.push({
            id: gen(), type: 'shape', shapeType: 'rectangle',
            x, y: 100, width: 270, height: 380, background: ci === 0 ? c.bg : '#f8fafc',
            borderRadius: 16, shadow: '0 4px 12px rgba(0,0,0,0.08)'
        });
        let y = 120;
        card.forEach(item => {
            elements.push({
                id: gen(), type: 'text', x: x + 20, y, width: 230, height: 32,
                content: `<span style="font-size:16px;color:#334155">${item.content}</span>`, fontSize: 16
            });
            y += 34;
        });
    });

    return { id: gen(), background: '#ffffff', elements };
}

function _buildQuote(gen, page, c) {
    const quoteText = page.quoteText || page.bodyLines.find(l => l.type === 'quote')?.content || '';
    const author = page.quoteAuthor || '';

    return {
        id: gen(), background: '#ffffff',
        elements: [
            { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: c.bg },
            // Big quote mark
            {
                id: gen(), type: 'text', x: 80, y: 100, width: 100, height: 100,
                content: `<span style="font-size:120px;color:${c.bar};opacity:0.2;font-family:Georgia">"</span>`, fontSize: 120
            },
            {
                id: gen(), type: 'text', x: 120, y: 180, width: 720, height: 120,
                content: `<i style="font-size:26px;color:${c.text};line-height:1.6">${quoteText}</i>`, fontSize: 26
            },
            ...(author ? [{
                id: gen(), type: 'text', x: 120, y: 340, width: 720, height: 40,
                content: `<span style="font-size:18px;color:#64748b">— ${author}</span>`, fontSize: 18
            }] : []),
            { id: gen(), type: 'shape', shapeType: 'rectangle', x: 120, y: 390, width: 80, height: 3, background: c.bar },
        ]
    };
}

function _buildNumberedList(gen, page, c) {
    return _buildContent(gen, page, c); // reuse content layout with numbered items
}

function _buildThankYou(gen, page, c) {
    return {
        id: gen(), background: c.bar,
        elements: [
            { id: gen(), type: 'shape', shapeType: 'circle', x: 380, y: 60, width: 200, height: 200, background: 'rgba(255,255,255,0.1)' },
            {
                id: gen(), type: 'text', x: 80, y: 180, width: 800, height: 80,
                content: `<b style="font-size:44px;color:#ffffff;text-align:center;display:block">${page.heading || '謝謝大家！'}</b>`, fontSize: 44
            },
            ...(page.subheading ? [{
                id: gen(), type: 'text', x: 80, y: 280, width: 800, height: 50,
                content: `<span style="font-size:22px;color:rgba(255,255,255,0.85);text-align:center;display:block">${page.subheading}</span>`, fontSize: 22
            }] : []),
        ]
    };
}

function _buildInteractive(gen, page, c) {
    const elements = [
        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 6, background: c.bar },
    ];

    // 標題
    const title = page.subheading || page.heading || '';
    if (title) {
        elements.push({
            id: gen(), type: 'text', x: 60, y: 20, width: 840, height: 45,
            content: `<b style="font-size:24px;color:${c.text}">${title}</b>`, fontSize: 24
        });
    }

    // 互動元件
    for (const comp of page.components) {
        const el = _buildComponent(gen, comp, c);
        if (el) elements.push(el);
    }

    return { id: gen(), background: '#ffffff', elements };
}

// ═════════════════════════════════════════
// 互動元件 → element JSON
// ═════════════════════════════════════════
function _buildComponent(gen, comp, c) {
    const p = comp.props;

    switch (comp.type) {
        case 'quiz': {
            const options = (p.options || []).map(opt => {
                const isCorrect = opt.includes('✓') || opt.includes('✔');
                return { text: opt.replace(/[✓✔]/g, '').trim(), isCorrect };
            });
            return {
                id: gen(), type: 'quiz', x: 50, y: 80, width: 860, height: 420,
                question: p.question || '',
                options,
                interactiveType: 'quiz'
            };
        }

        case 'poll': {
            const options = (p.options || []).map(opt => ({ text: opt, votes: 0 }));
            return {
                id: gen(), type: 'poll', x: 50, y: 80, width: 860, height: 420,
                question: p.question || '',
                options,
                interactiveType: 'poll'
            };
        }

        case 'truefalse':
            return {
                id: gen(), type: 'truefalse', x: 50, y: 80, width: 860, height: 420,
                question: p.question || p.statement || '',
                answer: (p.answer || 'true').toLowerCase() === 'true',
                interactiveType: 'truefalse'
            };

        case 'fillblank':
            return {
                id: gen(), type: 'fillblank', x: 50, y: 80, width: 860, height: 420,
                question: p.question || '',
                answer: p.answer || '',
                interactiveType: 'fillblank'
            };

        case 'ordering':
            return {
                id: gen(), type: 'ordering', x: 50, y: 80, width: 860, height: 420,
                question: p.question || '請排列正確順序',
                items: p.items || p.options || [],
                interactiveType: 'ordering'
            };

        case 'matching':
            return {
                id: gen(), type: 'matching', x: 50, y: 80, width: 860, height: 420,
                question: p.question || '請配對',
                pairs: (p.pairs || []).map(pair => {
                    const parts = pair.split('→').map(s => s.trim());
                    return { left: parts[0] || '', right: parts[1] || '' };
                }),
                interactiveType: 'matching'
            };

        case 'wordcloud':
            return {
                id: gen(), type: 'wordcloud', x: 50, y: 80, width: 860, height: 420,
                question: p.question || '',
                interactiveType: 'wordcloud'
            };

        case 'opentext':
            return {
                id: gen(), type: 'opentext', x: 50, y: 80, width: 860, height: 420,
                question: p.question || '',
                interactiveType: 'opentext'
            };

        case 'scale':
            return {
                id: gen(), type: 'scale', x: 50, y: 80, width: 860, height: 420,
                question: p.question || '',
                min: parseInt(p.min) || 1,
                max: parseInt(p.max) || 5,
                interactiveType: 'scale'
            };

        case 'buzzer':
            return {
                id: gen(), type: 'buzzer', x: 50, y: 80, width: 860, height: 420,
                question: p.question || '搶答！',
                interactiveType: 'buzzer'
            };

        case 'hotspot':
            return {
                id: gen(), type: 'hotspot', x: 50, y: 80, width: 860, height: 420,
                question: p.question || '',
                imageUrl: p.image || '',
                interactiveType: 'hotspot'
            };

        case 'icebreaker':
            return {
                id: gen(), type: 'icebreaker', x: 50, y: 80, width: 860, height: 420,
                title: p.title || '破冰活動',
                mode: p.mode || 'gallery',
                interactiveType: 'icebreaker'
            };

        case 'leaderboard':
            return {
                id: gen(), type: 'leaderboard', x: 50, y: 80, width: 860, height: 420,
                interactiveType: 'leaderboard'
            };

        case 'assessment':
            return {
                id: gen(), type: 'assessment', x: 50, y: 80, width: 860, height: 420,
                title: p.title || '測驗',
                assessmentType: p.type || 'pre',
                interactiveType: 'assessment'
            };

        case 'copycard':
            return {
                id: gen(), type: 'copycard', x: 50, y: 80, width: 860, height: 420,
                title: p.title || '',
                content: p.content || '',
                interactiveType: 'copycard'
            };

        case 'document':
            return {
                id: gen(), type: 'document', x: 50, y: 80, width: 860, height: 420,
                title: p.title || '教材',
                url: p.url || '',
                interactiveType: 'document'
            };

        case 'homework':
            return {
                id: gen(), type: 'homework', x: 50, y: 80, width: 860, height: 420,
                title: p.title || '作業',
                description: p.description || '',
                interactiveType: 'homework'
            };

        case 'showcase':
            return {
                id: gen(), type: 'showcase', x: 50, y: 80, width: 860, height: 420,
                title: p.title || '作品展示',
                interactiveType: 'showcase'
            };

        default:
            return null;
    }
}

// Export to window
window.md2slides = md2slides;
})();
