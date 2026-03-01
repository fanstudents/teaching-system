/**
 * 投影片模板庫
 * 提供預設模板供使用者快速建立新投影片
 */

export const SLIDE_TEMPLATES = [
    // ─── 基本 ───
    {
        id: 'blank',
        name: '空白',
        icon: 'crop_landscape',
        category: '基本',
        create: (gen) => ({
            id: gen(),
            elements: [],
            background: '#ffffff'
        })
    },
    {
        id: 'blank-dark',
        name: '空白（深色）',
        icon: 'crop_landscape',
        category: '基本',
        create: (gen) => ({
            id: gen(),
            elements: [],
            background: '#0f172a'
        })
    },

    // ─── 標題頁 ───
    {
        id: 'title',
        name: '標題頁',
        icon: 'title',
        category: '標題',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
                { id: gen(), type: 'text', x: 80, y: 160, width: 800, height: 80, content: '<b style="font-size:48px;color:#fff;letter-spacing:1px;">簡報標題</b>', fontSize: 48, bold: true, color: '#fff' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 260, width: 100, height: 4, background: '#4A7AE8' },
                { id: gen(), type: 'text', x: 80, y: 280, width: 600, height: 40, content: '<span style="font-size:20px;color:#94a3b8;">副標題或描述文字</span>', fontSize: 20, color: '#94a3b8' },
                { id: gen(), type: 'text', x: 80, y: 460, width: 300, height: 30, content: '<span style="font-size:14px;color:#64748b;">講師名稱 · 日期</span>', fontSize: 14, color: '#64748b' },
            ],
            background: '#1a1a2e'
        })
    },
    {
        id: 'title-gradient',
        name: '漸層標題',
        icon: 'gradient',
        category: '標題',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
                { id: gen(), type: 'text', x: 80, y: 140, width: 800, height: 100, content: '<b style="font-size:52px;color:#fff;letter-spacing:2px;">課程主題</b>', fontSize: 52, bold: true, color: '#fff' },
                { id: gen(), type: 'text', x: 80, y: 260, width: 600, height: 40, content: '<span style="font-size:22px;color:rgba(255,255,255,0.75);">專業培訓 · 企業內訓</span>', fontSize: 22 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 470, width: 220, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: 20 },
                { id: gen(), type: 'text', x: 80, y: 473, width: 220, height: 35, content: '<span style="font-size:14px;color:#fff;text-align:center;display:block;">講師：名稱</span>', fontSize: 14 },
            ],
            background: '#667eea'
        })
    },
    {
        id: 'title-minimal',
        name: '極簡標題',
        icon: 'space_dashboard',
        category: '標題',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 80, y: 200, width: 800, height: 70, content: '<b style="font-size:44px;color:#111827;">課程標題</b>', fontSize: 44, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 285, width: 60, height: 4, background: '#111827' },
                { id: gen(), type: 'text', x: 80, y: 310, width: 500, height: 35, content: '<span style="font-size:18px;color:#6b7280;">副標題文字</span>', fontSize: 18 },
                { id: gen(), type: 'text', x: 80, y: 480, width: 300, height: 25, content: '<span style="font-size:13px;color:#9ca3af;">講師 · 2026</span>', fontSize: 13 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'title-business',
        name: '商務標題',
        icon: 'business_center',
        category: '標題',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#f8fafc' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 8, height: 540, background: '#2563eb' },
                { id: gen(), type: 'text', x: 60, y: 160, width: 840, height: 80, content: '<b style="font-size:42px;color:#1e293b;">企業培訓方案</b>', fontSize: 42, bold: true },
                { id: gen(), type: 'text', x: 60, y: 260, width: 600, height: 40, content: '<span style="font-size:20px;color:#64748b;">提升團隊競爭力的完整解決方案</span>', fontSize: 20 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 470, width: 840, height: 1, background: '#e2e8f0' },
                { id: gen(), type: 'text', x: 60, y: 485, width: 400, height: 25, content: '<span style="font-size:13px;color:#94a3b8;">原騰數位科技 · 2026</span>', fontSize: 13 },
            ],
            background: '#f8fafc'
        })
    },

    // ─── 內容頁 ───
    {
        id: 'section',
        name: '章節分隔',
        icon: 'horizontal_rule',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 200, width: 960, height: 140, background: '#f0f4ff' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 255, width: 6, height: 30, background: '#4A7AE8' },
                { id: gen(), type: 'text', x: 100, y: 245, width: 760, height: 50, content: '<b style="font-size:32px;color:#1e293b;">章節標題</b>', fontSize: 32, bold: true },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'section-dark',
        name: '深色章節',
        icon: 'horizontal_rule',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)' },
                { id: gen(), type: 'text', x: 80, y: 100, width: 200, height: 30, content: '<span style="font-size:16px;color:#4A7AE8;letter-spacing:3px;">SECTION 01</span>', fontSize: 16 },
                { id: gen(), type: 'text', x: 80, y: 200, width: 800, height: 80, content: '<b style="font-size:44px;color:#fff;">章節標題</b>', fontSize: 44, bold: true, color: '#fff' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 300, width: 80, height: 3, background: '#4A7AE8' },
                { id: gen(), type: 'text', x: 80, y: 330, width: 600, height: 35, content: '<span style="font-size:16px;color:#94a3b8;">本章節將探討的主題概述</span>', fontSize: 16 },
            ],
            background: '#0f172a'
        })
    },
    {
        id: 'section-number',
        name: '編號章節',
        icon: 'looks_one',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 80, y: 100, width: 200, height: 200, content: '<b style="font-size:160px;color:#f0f0f0;">01</b>', fontSize: 160 },
                { id: gen(), type: 'text', x: 80, y: 260, width: 800, height: 60, content: '<b style="font-size:36px;color:#1e293b;">章節標題</b>', fontSize: 36, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 335, width: 60, height: 4, background: '#2563eb' },
                { id: gen(), type: 'text', x: 80, y: 365, width: 600, height: 30, content: '<span style="font-size:16px;color:#64748b;">章節描述文字</span>', fontSize: 16 },
            ],
            background: '#ffffff'
        })
    },

    // ─── 多欄版面 ───
    {
        id: 'twocol',
        name: '雙欄',
        icon: 'view_column_2',
        category: '版面',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 60, width: 4, height: 40, background: '#4A7AE8' },
                { id: gen(), type: 'text', x: 80, y: 55, width: 800, height: 50, content: '<b style="font-size:28px;color:#1e293b;">雙欄標題</b>', fontSize: 28, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 120, width: 400, height: 380, background: '#f8fafc', borderRadius: 12 },
                { id: gen(), type: 'text', x: 80, y: 140, width: 360, height: 340, content: '<b style="font-size:16px;color:#1e293b;">左欄內容</b><br><span style="font-size:14px;color:#64748b;">在此輸入文字…</span>', fontSize: 14 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 500, y: 120, width: 400, height: 380, background: '#f8fafc', borderRadius: 12 },
                { id: gen(), type: 'text', x: 520, y: 140, width: 360, height: 340, content: '<b style="font-size:16px;color:#1e293b;">右欄內容</b><br><span style="font-size:14px;color:#64748b;">在此輸入文字…</span>', fontSize: 14 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'threecol',
        name: '三欄卡片',
        icon: 'view_week',
        category: '版面',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 40, width: 840, height: 50, content: '<b style="font-size:28px;color:#1e293b;">三個核心觀點</b>', fontSize: 28, bold: true },
                // Card 1
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 110, width: 280, height: 380, background: '#f0f9ff', borderRadius: 12 },
                { id: gen(), type: 'text', x: 60, y: 130, width: 240, height: 340, content: '<b style="font-size:32px;color:#0284c7;">01</b><br><b style="font-size:16px;color:#1e293b;">重點一</b><br><span style="font-size:13px;color:#64748b;line-height:1.7;">說明文字，解釋第一個核心觀點的詳細內容。</span>', fontSize: 13 },
                // Card 2
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 340, y: 110, width: 280, height: 380, background: '#f0fdf4', borderRadius: 12 },
                { id: gen(), type: 'text', x: 360, y: 130, width: 240, height: 340, content: '<b style="font-size:32px;color:#16a34a;">02</b><br><b style="font-size:16px;color:#1e293b;">重點二</b><br><span style="font-size:13px;color:#64748b;line-height:1.7;">說明文字，解釋第二個核心觀點的詳細內容。</span>', fontSize: 13 },
                // Card 3
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 110, width: 280, height: 380, background: '#fef3c7', borderRadius: 12 },
                { id: gen(), type: 'text', x: 660, y: 130, width: 240, height: 340, content: '<b style="font-size:32px;color:#d97706;">03</b><br><b style="font-size:16px;color:#1e293b;">重點三</b><br><span style="font-size:13px;color:#64748b;line-height:1.7;">說明文字，解釋第三個核心觀點的詳細內容。</span>', fontSize: 13 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'threecol-dark',
        name: '深色三欄',
        icon: 'view_week',
        category: '版面',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#0f172a' },
                { id: gen(), type: 'text', x: 60, y: 40, width: 840, height: 50, content: '<b style="font-size:28px;color:#f1f5f9;">核心功能</b>', fontSize: 28, bold: true },
                // Card 1
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 110, width: 280, height: 380, background: 'rgba(255,255,255,0.05)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 60, y: 130, width: 240, height: 340, content: '<span style="font-size:28px;">🤖</span><br><b style="font-size:16px;color:#f1f5f9;">AI 自動化</b><br><span style="font-size:13px;color:#94a3b8;line-height:1.7;">利用人工智慧自動處理重複性工作。</span>', fontSize: 13 },
                // Card 2
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 340, y: 110, width: 280, height: 380, background: 'rgba(255,255,255,0.05)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 360, y: 130, width: 240, height: 340, content: '<span style="font-size:28px;">📊</span><br><b style="font-size:16px;color:#f1f5f9;">數據分析</b><br><span style="font-size:13px;color:#94a3b8;line-height:1.7;">即時數據看板，掌握關鍵指標。</span>', fontSize: 13 },
                // Card 3
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 110, width: 280, height: 380, background: 'rgba(255,255,255,0.05)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 660, y: 130, width: 240, height: 340, content: '<span style="font-size:28px;">🔗</span><br><b style="font-size:16px;color:#f1f5f9;">系統整合</b><br><span style="font-size:13px;color:#94a3b8;line-height:1.7;">無縫串接現有工作流程與工具。</span>', fontSize: 13 },
            ],
            background: '#0f172a'
        })
    },

    // ─── 圖文版面 ───
    {
        id: 'imagetext',
        name: '圖文',
        icon: 'image',
        category: '圖文',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 480, height: 540, background: '#e8ecf1' },
                { id: gen(), type: 'text', x: 200, y: 250, width: 80, height: 40, content: '<span style="font-size:14px;color:#94a3b8;">拖入圖片</span>', fontSize: 14, color: '#94a3b8' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 520, y: 60, width: 4, height: 40, background: '#4A7AE8' },
                { id: gen(), type: 'text', x: 540, y: 55, width: 380, height: 50, content: '<b style="font-size:28px;color:#1e293b;">標題文字</b>', fontSize: 28, bold: true },
                { id: gen(), type: 'text', x: 540, y: 120, width: 380, height: 360, content: '<span style="font-size:16px;color:#475569;line-height:1.8;">在此輸入說明文字，可以用來描述左方的圖片內容…</span>', fontSize: 16, color: '#475569' },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'imagetext-right',
        name: '圖文（右圖）',
        icon: 'image',
        category: '圖文',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 60, width: 4, height: 40, background: '#2563eb' },
                { id: gen(), type: 'text', x: 60, y: 55, width: 400, height: 50, content: '<b style="font-size:28px;color:#1e293b;">標題文字</b>', fontSize: 28, bold: true },
                { id: gen(), type: 'text', x: 60, y: 120, width: 400, height: 360, content: '<span style="font-size:16px;color:#475569;line-height:1.8;">在此輸入說明文字。</span>', fontSize: 16 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 480, y: 0, width: 480, height: 540, background: '#e8ecf1' },
                { id: gen(), type: 'text', x: 680, y: 250, width: 80, height: 40, content: '<span style="font-size:14px;color:#94a3b8;">拖入圖片</span>', fontSize: 14 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'fullimage',
        name: '滿版圖片',
        icon: 'fullscreen',
        category: '圖文',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#1e293b' },
                { id: gen(), type: 'text', x: 380, y: 250, width: 200, height: 40, content: '<span style="font-size:16px;color:#94a3b8;text-align:center;display:block;">拖入圖片為背景</span>', fontSize: 16 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 380, width: 960, height: 160, background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)' },
                { id: gen(), type: 'text', x: 60, y: 430, width: 840, height: 50, content: '<b style="font-size:32px;color:#fff;">圖片說明標題</b>', fontSize: 32, bold: true, color: '#fff' },
                { id: gen(), type: 'text', x: 60, y: 485, width: 600, height: 30, content: '<span style="font-size:14px;color:rgba(255,255,255,0.7);">補充說明文字</span>', fontSize: 14 },
            ],
            background: '#1e293b'
        })
    },

    // ─── 技術 / 流程 ───
    {
        id: 'comparison',
        name: 'AI 比較',
        icon: 'compare',
        category: '技術',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 45, content: '<b style="font-size:26px;color:#1e293b;">AI 工具比較</b>', fontSize: 26, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 85, width: 840, height: 2, background: '#e2e8f0' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 100, width: 260, height: 400, background: '#f0fdf4', borderRadius: 12 },
                { id: gen(), type: 'text', x: 80, y: 120, width: 220, height: 360, content: '<b style="font-size:18px;color:#16a34a;">ChatGPT</b><br><span style="font-size:13px;color:#475569;line-height:1.7;">• 文字生成<br>• 程式撰寫<br>• 翻譯<br>• 分析</span>', fontSize: 13 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 350, y: 100, width: 260, height: 400, background: '#eff6ff', borderRadius: 12 },
                { id: gen(), type: 'text', x: 370, y: 120, width: 220, height: 360, content: '<b style="font-size:18px;color:#2563eb;">Claude</b><br><span style="font-size:13px;color:#475569;line-height:1.7;">• 長文分析<br>• 程式開發<br>• 學術寫作<br>• 推理</span>', fontSize: 13 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 100, width: 260, height: 400, background: '#fefce8', borderRadius: 12 },
                { id: gen(), type: 'text', x: 660, y: 120, width: 220, height: 360, content: '<b style="font-size:18px;color:#ca8a04;">Gemini</b><br><span style="font-size:13px;color:#475569;line-height:1.7;">• 多模態<br>• 搜尋整合<br>• 圖片理解<br>• 即時資訊</span>', fontSize: 13 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'timeline',
        name: '時間軸',
        icon: 'timeline',
        category: '技術',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50, content: '<b style="font-size:28px;color:#1e293b;">實施時程</b>', fontSize: 28, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 270, width: 840, height: 3, background: '#e2e8f0' },
                // Phase 1
                { id: gen(), type: 'shape', shapeType: 'circle', x: 130, y: 258, width: 28, height: 28, background: '#2563eb' },
                { id: gen(), type: 'text', x: 80, y: 120, width: 150, height: 120, content: '<b style="font-size:14px;color:#2563eb;">Phase 1</b><br><span style="font-size:13px;color:#475569;">需求分析<br>架構設計</span>', fontSize: 13 },
                // Phase 2
                { id: gen(), type: 'shape', shapeType: 'circle', x: 340, y: 258, width: 28, height: 28, background: '#7c3aed' },
                { id: gen(), type: 'text', x: 290, y: 300, width: 150, height: 120, content: '<b style="font-size:14px;color:#7c3aed;">Phase 2</b><br><span style="font-size:13px;color:#475569;">開發實作<br>整合測試</span>', fontSize: 13 },
                // Phase 3
                { id: gen(), type: 'shape', shapeType: 'circle', x: 550, y: 258, width: 28, height: 28, background: '#059669' },
                { id: gen(), type: 'text', x: 500, y: 120, width: 150, height: 120, content: '<b style="font-size:14px;color:#059669;">Phase 3</b><br><span style="font-size:13px;color:#475569;">部署上線<br>監控調優</span>', fontSize: 13 },
                // Phase 4
                { id: gen(), type: 'shape', shapeType: 'circle', x: 760, y: 258, width: 28, height: 28, background: '#dc2626' },
                { id: gen(), type: 'text', x: 710, y: 300, width: 150, height: 120, content: '<b style="font-size:14px;color:#dc2626;">Phase 4</b><br><span style="font-size:13px;color:#475569;">持續優化<br>規模擴展</span>', fontSize: 13 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'flow-dark',
        name: '深色流程',
        icon: 'account_tree',
        category: '技術',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(135deg, #0f172a, #1e293b)' },
                { id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50, content: '<b style="font-size:28px;color:#f1f5f9;">工作流程</b>', fontSize: 28, bold: true },
                // Step 1
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 130, width: 200, height: 100, background: 'rgba(37,99,235,0.2)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 70, y: 150, width: 180, height: 60, content: '<b style="font-size:14px;color:#60a5fa;">Step 1</b><br><span style="font-size:12px;color:#94a3b8;">輸入資料</span>', fontSize: 12 },
                // Arrow
                { id: gen(), type: 'text', x: 270, y: 160, width: 40, height: 40, content: '<span style="font-size:24px;color:#475569;">→</span>', fontSize: 24 },
                // Step 2
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 320, y: 130, width: 200, height: 100, background: 'rgba(147,51,234,0.2)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 330, y: 150, width: 180, height: 60, content: '<b style="font-size:14px;color:#a78bfa;">Step 2</b><br><span style="font-size:12px;color:#94a3b8;">AI 處理</span>', fontSize: 12 },
                // Arrow
                { id: gen(), type: 'text', x: 530, y: 160, width: 40, height: 40, content: '<span style="font-size:24px;color:#475569;">→</span>', fontSize: 24 },
                // Step 3
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 580, y: 130, width: 200, height: 100, background: 'rgba(5,150,105,0.2)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 590, y: 150, width: 180, height: 60, content: '<b style="font-size:14px;color:#34d399;">Step 3</b><br><span style="font-size:12px;color:#94a3b8;">輸出結果</span>', fontSize: 12 },
                // Bottom description
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 290, width: 840, height: 200, background: 'rgba(255,255,255,0.03)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 80, y: 310, width: 800, height: 160, content: '<span style="font-size:14px;color:#94a3b8;line-height:1.8;">流程說明：<br>1. 步驟一的詳細描述<br>2. 步驟二的詳細描述<br>3. 步驟三的詳細描述</span>', fontSize: 14 },
            ],
            background: '#0f172a'
        })
    },
    {
        id: 'stats',
        name: '數據展示',
        icon: 'monitoring',
        category: '技術',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50, content: '<b style="font-size:28px;color:#1e293b;">關鍵成果</b>', fontSize: 28, bold: true },
                // Stat 1
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 110, width: 200, height: 180, background: '#f0f9ff', borderRadius: 12 },
                { id: gen(), type: 'text', x: 80, y: 130, width: 160, height: 140, content: '<b style="font-size:48px;color:#0284c7;">95%</b><br><span style="font-size:14px;color:#64748b;">完成率</span>', fontSize: 14 },
                // Stat 2
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 290, y: 110, width: 200, height: 180, background: '#f0fdf4', borderRadius: 12 },
                { id: gen(), type: 'text', x: 310, y: 130, width: 160, height: 140, content: '<b style="font-size:48px;color:#16a34a;">3x</b><br><span style="font-size:14px;color:#64748b;">效率提升</span>', fontSize: 14 },
                // Stat 3
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 520, y: 110, width: 200, height: 180, background: '#fefce8', borderRadius: 12 },
                { id: gen(), type: 'text', x: 540, y: 130, width: 160, height: 140, content: '<b style="font-size:48px;color:#d97706;">50+</b><br><span style="font-size:14px;color:#64748b;">企業導入</span>', fontSize: 14 },
                // Stat 4
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 750, y: 110, width: 200, height: 180, background: '#fdf2f8', borderRadius: 12 },
                { id: gen(), type: 'text', x: 770, y: 130, width: 160, height: 140, content: '<b style="font-size:48px;color:#db2777;">4.9</b><br><span style="font-size:14px;color:#64748b;">學員評分</span>', fontSize: 14 },
                // Description
                { id: gen(), type: 'text', x: 60, y: 340, width: 840, height: 160, content: '<span style="font-size:16px;color:#475569;line-height:1.8;">上述數據代表過去一年的執行成果。透過 AI 工具的導入，我們成功提升了整體營運效率，並獲得客戶的高度認可。</span>', fontSize: 16 },
            ],
            background: '#ffffff'
        })
    },

    // ─── 內容 ───
    {
        id: 'bulletpoints',
        name: '重點列表',
        icon: 'format_list_bulleted',
        category: '內容',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 60, width: 4, height: 40, background: '#4A7AE8' },
                { id: gen(), type: 'text', x: 80, y: 55, width: 800, height: 50, content: '<b style="font-size:28px;color:#1e293b;">主要重點</b>', fontSize: 28, bold: true },
                { id: gen(), type: 'text', x: 80, y: 130, width: 800, height: 360, content: '<div style="font-size:18px;color:#334155;line-height:2.2;">① 第一個重點說明<br>② 第二個重點說明<br>③ 第三個重點說明<br>④ 第四個重點說明</div>', fontSize: 18 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 490, width: 840, height: 2, background: '#e8ecf1' },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'quote',
        name: '引言',
        icon: 'format_quote',
        category: '內容',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#fafafa' },
                { id: gen(), type: 'text', x: 120, y: 80, width: 60, height: 80, content: '<span style="font-size:80px;color:#e5e7eb;font-family:Georgia;">"</span>', fontSize: 80 },
                { id: gen(), type: 'text', x: 120, y: 160, width: 720, height: 180, content: '<span style="font-size:26px;color:#1e293b;line-height:1.8;font-style:italic;">在這裡輸入一段有影響力的引言，讓觀眾印象深刻。</span>', fontSize: 26 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 120, y: 370, width: 60, height: 3, background: '#d1d5db' },
                { id: gen(), type: 'text', x: 120, y: 395, width: 400, height: 30, content: '<span style="font-size:16px;color:#6b7280;">— 引言出處</span>', fontSize: 16 },
            ],
            background: '#fafafa'
        })
    },
    {
        id: 'qa',
        name: '問答頁',
        icon: 'help',
        category: '內容',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(135deg, #1e293b, #334155)' },
                { id: gen(), type: 'text', x: 80, y: 140, width: 800, height: 80, content: '<b style="font-size:48px;color:#fff;text-align:center;display:block;">Q & A</b>', fontSize: 48, bold: true, color: '#fff' },
                { id: gen(), type: 'text', x: 80, y: 250, width: 800, height: 50, content: '<span style="font-size:20px;color:#94a3b8;text-align:center;display:block;">有任何問題嗎？歡迎提問！</span>', fontSize: 20 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 350, y: 340, width: 260, height: 50, background: 'rgba(74,122,232,0.3)', borderRadius: 25 },
                { id: gen(), type: 'text', x: 350, y: 348, width: 260, height: 35, content: '<span style="font-size:14px;color:#93c5fd;text-align:center;display:block;">💬 舉手或線上提問</span>', fontSize: 14 },
            ],
            background: '#1e293b'
        })
    },

    // ─── 結尾 ───
    {
        id: 'thankyou',
        name: '結尾頁',
        icon: 'sentiment_satisfied',
        category: '結尾',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
                { id: gen(), type: 'text', x: 80, y: 180, width: 800, height: 80, content: '<b style="font-size:44px;color:#fff;text-align:center;display:block;">感謝聆聽！</b>', fontSize: 44, bold: true, color: '#fff' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 400, y: 280, width: 160, height: 3, background: '#4A7AE8' },
                { id: gen(), type: 'text', x: 80, y: 310, width: 800, height: 40, content: '<span style="font-size:18px;color:#94a3b8;text-align:center;display:block;">歡迎提問與交流</span>', fontSize: 18, color: '#94a3b8' },
            ],
            background: '#0f172a'
        })
    },
    {
        id: 'thankyou-light',
        name: '淺色結尾',
        icon: 'favorite',
        category: '結尾',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 80, y: 180, width: 800, height: 80, content: '<b style="font-size:44px;color:#1e293b;text-align:center;display:block;">Thank You</b>', fontSize: 44, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 430, y: 275, width: 100, height: 3, background: '#2563eb' },
                { id: gen(), type: 'text', x: 80, y: 310, width: 800, height: 40, content: '<span style="font-size:18px;color:#64748b;text-align:center;display:block;">Questions & Discussion</span>', fontSize: 18 },
                { id: gen(), type: 'text', x: 80, y: 460, width: 800, height: 30, content: '<span style="font-size:13px;color:#94a3b8;text-align:center;display:block;">contact@example.com · @socialmedia</span>', fontSize: 13 },
            ],
            background: '#ffffff'
        })
    },

    // ─── 數據圖表 ───
    {
        id: 'bar-chart',
        name: '長條圖',
        icon: 'bar_chart',
        category: '數據',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50, content: '<b style="font-size:28px;color:#1e293b;">季度營收成長</b>', fontSize: 28, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 485, width: 840, height: 2, background: '#e2e8f0' },
                // Q1
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 100, y: 285, width: 80, height: 200, background: 'linear-gradient(0deg, #3b82f6, #60a5fa)', borderRadius: 4 },
                { id: gen(), type: 'text', x: 100, y: 260, width: 80, height: 25, content: '<span style="font-size:13px;color:#64748b;text-align:center;display:block;">$120K</span>', fontSize: 13 },
                { id: gen(), type: 'text', x: 100, y: 490, width: 80, height: 25, content: '<span style="font-size:12px;color:#94a3b8;text-align:center;display:block;">Q1</span>', fontSize: 12 },
                // Q2
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 280, y: 225, width: 80, height: 260, background: 'linear-gradient(0deg, #8b5cf6, #a78bfa)', borderRadius: 4 },
                { id: gen(), type: 'text', x: 280, y: 200, width: 80, height: 25, content: '<span style="font-size:13px;color:#64748b;text-align:center;display:block;">$180K</span>', fontSize: 13 },
                { id: gen(), type: 'text', x: 280, y: 490, width: 80, height: 25, content: '<span style="font-size:12px;color:#94a3b8;text-align:center;display:block;">Q2</span>', fontSize: 12 },
                // Q3
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 460, y: 185, width: 80, height: 300, background: 'linear-gradient(0deg, #10b981, #34d399)', borderRadius: 4 },
                { id: gen(), type: 'text', x: 460, y: 160, width: 80, height: 25, content: '<span style="font-size:13px;color:#64748b;text-align:center;display:block;">$240K</span>', fontSize: 13 },
                { id: gen(), type: 'text', x: 460, y: 490, width: 80, height: 25, content: '<span style="font-size:12px;color:#94a3b8;text-align:center;display:block;">Q3</span>', fontSize: 12 },
                // Q4
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 145, width: 80, height: 340, background: 'linear-gradient(0deg, #f59e0b, #fbbf24)', borderRadius: 4 },
                { id: gen(), type: 'text', x: 640, y: 120, width: 80, height: 25, content: '<span style="font-size:13px;color:#64748b;text-align:center;display:block;">$320K</span>', fontSize: 13 },
                { id: gen(), type: 'text', x: 640, y: 490, width: 80, height: 25, content: '<span style="font-size:12px;color:#94a3b8;text-align:center;display:block;">Q4</span>', fontSize: 12 },
                // Growth label
                { id: gen(), type: 'text', x: 780, y: 140, width: 150, height: 30, content: '<span style="font-size:16px;color:#16a34a;font-weight:700;">↑ 167%</span>', fontSize: 16 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'donut-stats',
        name: '環形數據',
        icon: 'donut_large',
        category: '數據',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50, content: '<b style="font-size:28px;color:#1e293b;">市場份額分佈</b>', fontSize: 28, bold: true },
                // Circle background
                { id: gen(), type: 'shape', shapeType: 'circle', x: 120, y: 130, width: 280, height: 280, background: 'conic-gradient(#3b82f6 0% 45%, #8b5cf6 45% 70%, #f59e0b 70% 85%, #e2e8f0 85% 100%)' },
                { id: gen(), type: 'shape', shapeType: 'circle', x: 190, y: 200, width: 140, height: 140, background: '#ffffff' },
                { id: gen(), type: 'text', x: 190, y: 240, width: 140, height: 60, content: '<b style="font-size:28px;color:#1e293b;text-align:center;display:block;">100%</b>', fontSize: 28 },
                // Legend
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 480, y: 180, width: 16, height: 16, background: '#3b82f6', borderRadius: 4 },
                { id: gen(), type: 'text', x: 506, y: 175, width: 300, height: 25, content: '<span style="font-size:15px;color:#1e293b;">產品 A — 45%</span>', fontSize: 15 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 480, y: 220, width: 16, height: 16, background: '#8b5cf6', borderRadius: 4 },
                { id: gen(), type: 'text', x: 506, y: 215, width: 300, height: 25, content: '<span style="font-size:15px;color:#1e293b;">產品 B — 25%</span>', fontSize: 15 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 480, y: 260, width: 16, height: 16, background: '#f59e0b', borderRadius: 4 },
                { id: gen(), type: 'text', x: 506, y: 255, width: 300, height: 25, content: '<span style="font-size:15px;color:#1e293b;">產品 C — 15%</span>', fontSize: 15 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 480, y: 300, width: 16, height: 16, background: '#e2e8f0', borderRadius: 4 },
                { id: gen(), type: 'text', x: 506, y: 295, width: 300, height: 25, content: '<span style="font-size:15px;color:#1e293b;">其他 — 15%</span>', fontSize: 15 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'dashboard',
        name: '儀表板',
        icon: 'dashboard',
        category: '數據',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#0f172a' },
                { id: gen(), type: 'text', x: 40, y: 20, width: 400, height: 40, content: '<b style="font-size:22px;color:#f1f5f9;">📊 即時數據儀表板</b>', fontSize: 22 },
                // KPI 1
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 75, width: 210, height: 120, background: 'rgba(255,255,255,0.06)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 55, y: 85, width: 180, height: 90, content: '<span style="font-size:12px;color:#94a3b8;">總營收</span><br><b style="font-size:32px;color:#34d399;">$2.4M</b><br><span style="font-size:11px;color:#22c55e;">↑ 12.5%</span>', fontSize: 12 },
                // KPI 2
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 270, y: 75, width: 210, height: 120, background: 'rgba(255,255,255,0.06)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 285, y: 85, width: 180, height: 90, content: '<span style="font-size:12px;color:#94a3b8;">活躍用戶</span><br><b style="font-size:32px;color:#60a5fa;">18.2K</b><br><span style="font-size:11px;color:#22c55e;">↑ 8.3%</span>', fontSize: 12 },
                // KPI 3
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 500, y: 75, width: 210, height: 120, background: 'rgba(255,255,255,0.06)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 515, y: 85, width: 180, height: 90, content: '<span style="font-size:12px;color:#94a3b8;">轉換率</span><br><b style="font-size:32px;color:#fbbf24;">4.7%</b><br><span style="font-size:11px;color:#22c55e;">↑ 0.8%</span>', fontSize: 12 },
                // KPI 4
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 730, y: 75, width: 210, height: 120, background: 'rgba(255,255,255,0.06)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 745, y: 85, width: 180, height: 90, content: '<span style="font-size:12px;color:#94a3b8;">滿意度</span><br><b style="font-size:32px;color:#a78bfa;">4.9★</b><br><span style="font-size:11px;color:#22c55e;">↑ 0.2</span>', fontSize: 12 },
                // Chart area
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 215, width: 580, height: 300, background: 'rgba(255,255,255,0.04)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 55, y: 225, width: 300, height: 25, content: '<span style="font-size:13px;color:#94a3b8;">月度趨勢圖</span>', fontSize: 13 },
                // Mini bars inside chart
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 70, y: 400, width: 35, height: 100, background: 'rgba(59,130,246,0.5)', borderRadius: 4 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 120, y: 360, width: 35, height: 140, background: 'rgba(59,130,246,0.6)', borderRadius: 4 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 170, y: 330, width: 35, height: 170, background: 'rgba(59,130,246,0.7)', borderRadius: 4 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 220, y: 380, width: 35, height: 120, background: 'rgba(59,130,246,0.55)', borderRadius: 4 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 270, y: 300, width: 35, height: 200, background: 'rgba(59,130,246,0.8)', borderRadius: 4 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 320, y: 280, width: 35, height: 220, background: 'rgba(59,130,246,0.85)', borderRadius: 4 },
                // Side panel
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 215, width: 300, height: 300, background: 'rgba(255,255,255,0.04)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 655, y: 225, width: 270, height: 25, content: '<span style="font-size:13px;color:#94a3b8;">Top 通路</span>', fontSize: 13 },
                { id: gen(), type: 'text', x: 655, y: 265, width: 270, height: 230, content: '<div style="font-size:13px;color:#cbd5e1;line-height:2.2;">1. 社群媒體 — 38%<br>2. 搜尋引擎 — 27%<br>3. 電子郵件 — 19%<br>4. 直接流量 — 11%<br>5. 合作夥伴 — 5%</div>', fontSize: 13 },
            ],
            background: '#0f172a'
        })
    },
    {
        id: 'swot',
        name: 'SWOT 分析',
        icon: 'grid_view',
        category: '數據',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 15, width: 840, height: 40, content: '<b style="font-size:24px;color:#1e293b;">SWOT 分析</b>', fontSize: 24, bold: true },
                // S
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 65, width: 418, height: 216, background: '#ecfdf5', borderRadius: 12 },
                { id: gen(), type: 'text', x: 80, y: 75, width: 380, height: 196, content: '<b style="font-size:16px;color:#059669;">💪 優勢 Strengths</b><br><span style="font-size:13px;color:#475569;line-height:1.7;">• 技術領先<br>• 品牌知名度高<br>• 團隊經驗豐富</span>', fontSize: 13 },
                // W
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 498, y: 65, width: 418, height: 216, background: '#fef2f2', borderRadius: 12 },
                { id: gen(), type: 'text', x: 518, y: 75, width: 380, height: 196, content: '<b style="font-size:16px;color:#dc2626;">⚠️ 劣勢 Weaknesses</b><br><span style="font-size:13px;color:#475569;line-height:1.7;">• 資源有限<br>• 市場覆蓋不足<br>• 成本偏高</span>', fontSize: 13 },
                // O
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 301, width: 418, height: 216, background: '#eff6ff', borderRadius: 12 },
                { id: gen(), type: 'text', x: 80, y: 311, width: 380, height: 196, content: '<b style="font-size:16px;color:#2563eb;">🚀 機會 Opportunities</b><br><span style="font-size:13px;color:#475569;line-height:1.7;">• AI 市場快速擴張<br>• 政策支持數位轉型<br>• 新興市場需求</span>', fontSize: 13 },
                // T
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 498, y: 301, width: 418, height: 216, background: '#fefce8', borderRadius: 12 },
                { id: gen(), type: 'text', x: 518, y: 311, width: 380, height: 196, content: '<b style="font-size:16px;color:#ca8a04;">🔒 威脅 Threats</b><br><span style="font-size:13px;color:#475569;line-height:1.7;">• 競爭對手增加<br>• 技術迭代加快<br>• 法規不確定性</span>', fontSize: 13 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'progress',
        name: '進度追蹤',
        icon: 'trending_up',
        category: '數據',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 50, content: '<b style="font-size:28px;color:#1e293b;">專案進度</b>', fontSize: 28, bold: true },
                // Item 1
                { id: gen(), type: 'text', x: 60, y: 100, width: 200, height: 25, content: '<span style="font-size:14px;color:#1e293b;font-weight:600;">需求分析</span>', fontSize: 14 },
                { id: gen(), type: 'text', x: 800, y: 100, width: 100, height: 25, content: '<span style="font-size:14px;color:#16a34a;font-weight:600;text-align:right;display:block;">100%</span>', fontSize: 14 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 130, width: 840, height: 16, background: '#f1f5f9', borderRadius: 8 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 130, width: 840, height: 16, background: '#22c55e', borderRadius: 8 },
                // Item 2
                { id: gen(), type: 'text', x: 60, y: 175, width: 200, height: 25, content: '<span style="font-size:14px;color:#1e293b;font-weight:600;">UI 設計</span>', fontSize: 14 },
                { id: gen(), type: 'text', x: 800, y: 175, width: 100, height: 25, content: '<span style="font-size:14px;color:#2563eb;font-weight:600;text-align:right;display:block;">75%</span>', fontSize: 14 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 205, width: 840, height: 16, background: '#f1f5f9', borderRadius: 8 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 205, width: 630, height: 16, background: '#3b82f6', borderRadius: 8 },
                // Item 3
                { id: gen(), type: 'text', x: 60, y: 250, width: 200, height: 25, content: '<span style="font-size:14px;color:#1e293b;font-weight:600;">開發實作</span>', fontSize: 14 },
                { id: gen(), type: 'text', x: 800, y: 250, width: 100, height: 25, content: '<span style="font-size:14px;color:#d97706;font-weight:600;text-align:right;display:block;">45%</span>', fontSize: 14 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 280, width: 840, height: 16, background: '#f1f5f9', borderRadius: 8 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 280, width: 378, height: 16, background: '#f59e0b', borderRadius: 8 },
                // Item 4
                { id: gen(), type: 'text', x: 60, y: 325, width: 200, height: 25, content: '<span style="font-size:14px;color:#1e293b;font-weight:600;">測試部署</span>', fontSize: 14 },
                { id: gen(), type: 'text', x: 800, y: 325, width: 100, height: 25, content: '<span style="font-size:14px;color:#94a3b8;font-weight:600;text-align:right;display:block;">10%</span>', fontSize: 14 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 355, width: 840, height: 16, background: '#f1f5f9', borderRadius: 8 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 355, width: 84, height: 16, background: '#94a3b8', borderRadius: 8 },
                // Summary
                { id: gen(), type: 'text', x: 60, y: 420, width: 840, height: 80, content: '<span style="font-size:15px;color:#64748b;line-height:1.8;">整體進度 <b style="color:#2563eb;">57.5%</b> · 預計完成日期：2026/04/15</span>', fontSize: 15 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'pricing',
        name: '方案比較',
        icon: 'payments',
        category: '數據',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 15, width: 840, height: 40, content: '<b style="font-size:24px;color:#1e293b;text-align:center;display:block;">選擇適合的方案</b>', fontSize: 24, bold: true },
                // Basic
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 70, width: 280, height: 440, background: '#f8fafc', borderRadius: 16 },
                { id: gen(), type: 'text', x: 60, y: 90, width: 240, height: 400, content: '<b style="font-size:16px;color:#64748b;">基礎版</b><br><b style="font-size:36px;color:#1e293b;">$299</b><span style="font-size:14px;color:#94a3b8;">/月</span><br><br><div style="font-size:13px;color:#475569;line-height:2;">✓ 5 個專案<br>✓ 基礎模板<br>✓ 電子郵件支援<br>✗ API 存取<br>✗ 自訂品牌</div>', fontSize: 13 },
                // Pro (highlighted)
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 340, y: 60, width: 280, height: 460, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', borderRadius: 16 },
                { id: gen(), type: 'text', x: 360, y: 75, width: 240, height: 420, content: '<span style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:2px;">⭐ 最受歡迎</span><br><b style="font-size:16px;color:rgba(255,255,255,0.9);">專業版</b><br><b style="font-size:36px;color:#fff;">$799</b><span style="font-size:14px;color:rgba(255,255,255,0.7);">/月</span><br><br><div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:2;">✓ 無限專案<br>✓ 全部模板<br>✓ 即時客服<br>✓ API 存取<br>✗ 自訂品牌</div>', fontSize: 13 },
                // Enterprise
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 70, width: 280, height: 440, background: '#f8fafc', borderRadius: 16 },
                { id: gen(), type: 'text', x: 660, y: 90, width: 240, height: 400, content: '<b style="font-size:16px;color:#64748b;">企業版</b><br><b style="font-size:36px;color:#1e293b;">客製</b><br><br><div style="font-size:13px;color:#475569;line-height:2;">✓ 無限專案<br>✓ 全部模板<br>✓ 專屬客服<br>✓ API 存取<br>✓ 自訂品牌</div>', fontSize: 13 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'before-after',
        name: '前後對比',
        icon: 'compare_arrows',
        category: '數據',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 45, content: '<b style="font-size:26px;color:#1e293b;text-align:center;display:block;">導入 AI 前後對比</b>', fontSize: 26, bold: true },
                // Before
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 430, height: 420, background: '#fef2f2', borderRadius: 16 },
                { id: gen(), type: 'text', x: 60, y: 95, width: 390, height: 395, content: '<b style="font-size:18px;color:#dc2626;">❌ 導入前</b><br><br><div style="font-size:14px;color:#475569;line-height:2.2;">📋 人工作業 8 小時/天<br>⚠️ 錯誤率 15%<br>💰 人力成本 $50K/月<br>📊 報表產出 3 天<br>🔄 流程標準化 30%</div>', fontSize: 14 },
                // VS
                { id: gen(), type: 'text', x: 440, y: 270, width: 80, height: 40, content: '<b style="font-size:20px;color:#94a3b8;text-align:center;display:block;">VS</b>', fontSize: 20 },
                // After
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 490, y: 85, width: 430, height: 420, background: '#ecfdf5', borderRadius: 16 },
                { id: gen(), type: 'text', x: 510, y: 95, width: 390, height: 395, content: '<b style="font-size:18px;color:#059669;">✅ 導入後</b><br><br><div style="font-size:14px;color:#475569;line-height:2.2;">🤖 自動化 2 小時/天<br>✅ 錯誤率 2%<br>💰 人力成本 $15K/月<br>📊 報表即時產出<br>🔄 流程標準化 95%</div>', fontSize: 14 },
            ],
            background: '#ffffff'
        })
    },
    {
        id: 'kpi-dark',
        name: '深色 KPI',
        icon: 'speed',
        category: '數據',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(135deg, #0f172a, #1e293b)' },
                { id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 40, content: '<b style="font-size:24px;color:#f1f5f9;">關鍵績效指標</b>', fontSize: 24 },
                // KPI cards - row 1
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 90, width: 280, height: 190, background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))', borderRadius: 16 },
                { id: gen(), type: 'text', x: 60, y: 110, width: 240, height: 150, content: '<span style="font-size:36px;display:block;">🎯</span><b style="font-size:42px;color:#60a5fa;">98.5%</b><br><span style="font-size:13px;color:#94a3b8;">目標達成率</span>', fontSize: 13 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 340, y: 90, width: 280, height: 190, background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))', borderRadius: 16 },
                { id: gen(), type: 'text', x: 360, y: 110, width: 240, height: 150, content: '<span style="font-size:36px;display:block;">⚡</span><b style="font-size:42px;color:#a78bfa;">12.3s</b><br><span style="font-size:13px;color:#94a3b8;">平均回應時間</span>', fontSize: 13 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 90, width: 280, height: 190, background: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.05))', borderRadius: 16 },
                { id: gen(), type: 'text', x: 660, y: 110, width: 240, height: 150, content: '<span style="font-size:36px;display:block;">💰</span><b style="font-size:42px;color:#34d399;">$4.2M</b><br><span style="font-size:13px;color:#94a3b8;">年化營收</span>', fontSize: 13 },
                // Bottom row
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 300, width: 430, height: 210, background: 'rgba(255,255,255,0.03)', borderRadius: 16 },
                { id: gen(), type: 'text', x: 60, y: 320, width: 390, height: 170, content: '<b style="font-size:14px;color:#cbd5e1;">月度趨勢</b><br><span style="font-size:13px;color:#94a3b8;line-height:2;">一月 → $320K<br>二月 → $380K (+18.7%)<br>三月 → $420K (+10.5%)<br>四月 → $510K (+21.4%)</span>', fontSize: 13 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 490, y: 300, width: 430, height: 210, background: 'rgba(255,255,255,0.03)', borderRadius: 16 },
                { id: gen(), type: 'text', x: 510, y: 320, width: 390, height: 170, content: '<b style="font-size:14px;color:#cbd5e1;">團隊績效</b><br><span style="font-size:13px;color:#94a3b8;line-height:2;">🥇 行銷部 — 105% 達成<br>🥈 業務部 — 98% 達成<br>🥉 研發部 — 95% 達成<br>📌 客服部 — 92% 達成</span>', fontSize: 13 },
            ],
            background: '#0f172a'
        })
    },
];
