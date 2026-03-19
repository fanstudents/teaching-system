/**
 * 投影片模板庫
 * 提供預設模板供使用者快速建立新投影片
 */

export const SLIDE_TEMPLATES = [

    // ─── 經典商務 ───
    {
        id: 'biz-title',
        name: '商務封面',
        icon: 'business_center',
        category: '商務',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#1c1917' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 6, height: 540, background: '#b45309' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 460, width: 960, height: 80, background: 'rgba(180,83,9,0.08)' },
                { id: gen(), type: 'text', x: 60, y: 140, width: 700, height: 80, content: '<b style="font-size:46px;color:#fafaf9;letter-spacing:0.5px;">簡報標題</b>', fontSize: 46, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 240, width: 50, height: 3, background: '#b45309' },
                { id: gen(), type: 'text', x: 60, y: 268, width: 500, height: 35, content: '<span style="font-size:18px;color:#a8a29e;">副標題或補充說明</span>', fontSize: 18 },
                { id: gen(), type: 'text', x: 60, y: 478, width: 400, height: 25, content: '<span style="font-size:13px;color:#78716c;">講師名稱 · 2026</span>', fontSize: 13 },
            ],
            background: '#1c1917'
        })
    },
    {
        id: 'biz-content',
        name: '商務內容',
        icon: 'description',
        category: '商務',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 60, background: '#1c1917' },
                { id: gen(), type: 'text', x: 60, y: 12, width: 700, height: 40, content: '<b style="font-size:22px;color:#fafaf9;">頁面標題</b>', fontSize: 22, bold: true },
                { id: gen(), type: 'text', x: 60, y: 90, width: 840, height: 400, content: '<div style="font-size:16px;color:#44403c;line-height:2.0;">• 第一個重點說明<br>• 第二個重點說明<br>• 第三個重點說明<br>• 第四個重點說明</div>', fontSize: 16 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 500, width: 840, height: 1, background: '#e7e5e4' },
            ],
            background: '#fafaf9'
        })
    },
    {
        id: 'biz-cards',
        name: '商務三欄',
        icon: 'view_week',
        category: '商務',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 60, background: '#1c1917' },
                { id: gen(), type: 'text', x: 60, y: 12, width: 700, height: 40, content: '<b style="font-size:22px;color:#fafaf9;">核心優勢</b>', fontSize: 22, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 280, height: 420, background: '#f5f5f4', borderRadius: 12 },
                { id: gen(), type: 'text', x: 60, y: 105, width: 240, height: 380, content: '<span class="material-symbols-outlined" style="font-size:32px;color:#b45309;">trending_up</span><br><b style="font-size:16px;color:#1c1917;">效率提升</b><br><span style="font-size:13px;color:#78716c;line-height:1.8;">透過系統化流程大幅提升團隊工作效率與產出品質。</span>', fontSize: 13 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 340, y: 85, width: 280, height: 420, background: '#f5f5f4', borderRadius: 12 },
                { id: gen(), type: 'text', x: 360, y: 105, width: 240, height: 380, content: '<span class="material-symbols-outlined" style="font-size:32px;color:#b45309;">shield</span><br><b style="font-size:16px;color:#1c1917;">品質保證</b><br><span style="font-size:13px;color:#78716c;line-height:1.8;">嚴格的品管機制確保每個環節都達到專業標準。</span>', fontSize: 13 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 85, width: 280, height: 420, background: '#f5f5f4', borderRadius: 12 },
                { id: gen(), type: 'text', x: 660, y: 105, width: 240, height: 380, content: '<span class="material-symbols-outlined" style="font-size:32px;color:#b45309;">groups</span><br><b style="font-size:16px;color:#1c1917;">團隊協作</b><br><span style="font-size:13px;color:#78716c;line-height:1.8;">打破部門隔閡，讓跨團隊合作更加順暢高效。</span>', fontSize: 13 },
            ],
            background: '#fafaf9'
        })
    },

    // ─── 自然清新 ───
    {
        id: 'nature-title',
        name: '清新封面',
        icon: 'park',
        category: '清新',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(160deg, #1a2e1a 0%, #2d3b2d 100%)' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 120, width: 3, height: 100, background: '#6b8f71' },
                { id: gen(), type: 'text', x: 80, y: 120, width: 700, height: 80, content: '<b style="font-size:44px;color:#e8ede8;letter-spacing:1px;">課程主題</b>', fontSize: 44, bold: true },
                { id: gen(), type: 'text', x: 80, y: 210, width: 500, height: 35, content: '<span style="font-size:18px;color:#8faa8f;">副標題描述文字</span>', fontSize: 18 },
                { id: gen(), type: 'text', x: 80, y: 470, width: 400, height: 25, content: '<span style="font-size:13px;color:#5a6b5a;">講師 · 日期</span>', fontSize: 13 },
            ],
            background: '#1a2e1a'
        })
    },
    {
        id: 'nature-content',
        name: '清新內容',
        icon: 'eco',
        category: '清新',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 35, width: 700, height: 50, content: '<b style="font-size:28px;color:#2d3b2d;">頁面標題</b>', fontSize: 28, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 82, width: 40, height: 3, background: '#6b8f71' },
                { id: gen(), type: 'text', x: 60, y: 110, width: 840, height: 380, content: '<div style="font-size:16px;color:#44544a;line-height:2.0;">• 第一個重點說明<br>• 第二個重點說明<br>• 第三個重點說明</div>', fontSize: 16 },
            ],
            background: '#f4f7f4'
        })
    },
    {
        id: 'nature-cards',
        name: '清新卡片',
        icon: 'grid_view',
        category: '清新',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 45, content: '<b style="font-size:26px;color:#2d3b2d;">重點整理</b>', fontSize: 26, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 280, height: 420, background: '#e8ede8', borderRadius: 14 },
                { id: gen(), type: 'text', x: 60, y: 105, width: 240, height: 380, content: '<span class="material-symbols-outlined" style="font-size:30px;color:#4a6b4a;">lightbulb</span><br><b style="font-size:15px;color:#2d3b2d;">洞察</b><br><span style="font-size:13px;color:#5a6b5a;line-height:1.8;">深入分析現況，找出關鍵突破點。</span>', fontSize: 13 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 340, y: 85, width: 280, height: 420, background: '#e8ede8', borderRadius: 14 },
                { id: gen(), type: 'text', x: 360, y: 105, width: 240, height: 380, content: '<span class="material-symbols-outlined" style="font-size:30px;color:#4a6b4a;">build</span><br><b style="font-size:15px;color:#2d3b2d;">實作</b><br><span style="font-size:13px;color:#5a6b5a;line-height:1.8;">動手操作，將知識轉化為實際技能。</span>', fontSize: 13 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 85, width: 280, height: 420, background: '#e8ede8', borderRadius: 14 },
                { id: gen(), type: 'text', x: 660, y: 105, width: 240, height: 380, content: '<span class="material-symbols-outlined" style="font-size:30px;color:#4a6b4a;">verified</span><br><b style="font-size:15px;color:#2d3b2d;">驗證</b><br><span style="font-size:13px;color:#5a6b5a;line-height:1.8;">透過實測確認成果，建立信心。</span>', fontSize: 13 },
            ],
            background: '#f4f7f4'
        })
    },

    // ─── 暖調珊瑚 ───
    {
        id: 'coral-title',
        name: '珊瑚封面',
        icon: 'favorite',
        category: '珊瑚',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(145deg, #44212a 0%, #312020 100%)' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 250, width: 840, height: 1, background: 'rgba(204,112,112,0.2)' },
                { id: gen(), type: 'text', x: 60, y: 155, width: 700, height: 80, content: '<b style="font-size:46px;color:#f5e6e8;">簡報主題</b>', fontSize: 46, bold: true },
                { id: gen(), type: 'text', x: 60, y: 275, width: 500, height: 35, content: '<span style="font-size:18px;color:#b08a8e;">副標題文字</span>', fontSize: 18 },
                { id: gen(), type: 'text', x: 60, y: 480, width: 300, height: 25, content: '<span style="font-size:13px;color:#6b5558;">講師 · 2026</span>', fontSize: 13 },
            ],
            background: '#44212a'
        })
    },
    {
        id: 'coral-content',
        name: '珊瑚內容',
        icon: 'article',
        category: '珊瑚',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 35, width: 700, height: 50, content: '<b style="font-size:28px;color:#3d2529;">頁面標題</b>', fontSize: 28 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 82, width: 40, height: 3, background: '#c07070' },
                { id: gen(), type: 'text', x: 60, y: 110, width: 840, height: 380, content: '<div style="font-size:16px;color:#5c3a3e;line-height:2;">• 第一個重點說明<br>• 第二個重點說明<br>• 第三個重點說明</div>', fontSize: 16 },
            ],
            background: '#faf5f5'
        })
    },

    // ─── 海洋青 ───
    {
        id: 'teal-title',
        name: '海洋封面',
        icon: 'sailing',
        category: '海洋',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(155deg, #122c34 0%, #0f3b3b 100%)' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 530, width: 960, height: 10, background: '#2a8a8a' },
                { id: gen(), type: 'text', x: 80, y: 160, width: 800, height: 80, content: '<b style="font-size:48px;color:#e0f0f0;">課程標題</b>', fontSize: 48, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 258, width: 60, height: 3, background: '#2a8a8a' },
                { id: gen(), type: 'text', x: 80, y: 286, width: 500, height: 35, content: '<span style="font-size:18px;color:#78a8a8;">副標題</span>', fontSize: 18 },
                { id: gen(), type: 'text', x: 80, y: 470, width: 400, height: 25, content: '<span style="font-size:13px;color:#4a7878;">講師名稱</span>', fontSize: 13 },
            ],
            background: '#122c34'
        })
    },
    {
        id: 'teal-cards',
        name: '海洋卡片',
        icon: 'dashboard',
        category: '海洋',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 30, width: 840, height: 45, content: '<b style="font-size:26px;color:#1a3c3c;">重點摘要</b>', fontSize: 26, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 90, width: 280, height: 180, background: '#e8f4f4', borderRadius: 12 },
                { id: gen(), type: 'text', x: 60, y: 105, width: 240, height: 150, content: '<span class="material-symbols-outlined" style="font-size:28px;color:#2a7a7a;">analytics</span><br><b style="font-size:15px;color:#1a3c3c;">數據分析</b><br><span style="font-size:12px;color:#4a6868;">用數據驅動決策</span>', fontSize: 12 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 340, y: 90, width: 280, height: 180, background: '#e8f4f4', borderRadius: 12 },
                { id: gen(), type: 'text', x: 360, y: 105, width: 240, height: 150, content: '<span class="material-symbols-outlined" style="font-size:28px;color:#2a7a7a;">psychology</span><br><b style="font-size:15px;color:#1a3c3c;">策略思維</b><br><span style="font-size:12px;color:#4a6868;">建立系統化的策略</span>', fontSize: 12 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 90, width: 280, height: 180, background: '#e8f4f4', borderRadius: 12 },
                { id: gen(), type: 'text', x: 660, y: 105, width: 240, height: 150, content: '<span class="material-symbols-outlined" style="font-size:28px;color:#2a7a7a;">rocket_launch</span><br><b style="font-size:15px;color:#1a3c3c;">快速落地</b><br><span style="font-size:12px;color:#4a6868;">從規劃到執行</span>', fontSize: 12 },
                { id: gen(), type: 'text', x: 60, y: 300, width: 840, height: 200, content: '<div style="font-size:15px;color:#3a5858;line-height:2;">補充說明文字區域，可輸入更多詳細資訊。</div>', fontSize: 15 },
            ],
            background: '#f5fafa'
        })
    },

    // ─── 沉穩深灰 ───
    {
        id: 'char-title',
        name: '深灰封面',
        icon: 'layers',
        category: '深灰',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#1a1a1a' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 800, y: 0, width: 160, height: 540, background: 'rgba(110,190,170,0.06)' },
                { id: gen(), type: 'text', x: 80, y: 150, width: 700, height: 80, content: '<b style="font-size:48px;color:#e8e8e8;">主題標題</b>', fontSize: 48, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 248, width: 50, height: 3, background: '#6ebea8' },
                { id: gen(), type: 'text', x: 80, y: 278, width: 500, height: 35, content: '<span style="font-size:18px;color:#888;">副標題</span>', fontSize: 18 },
                { id: gen(), type: 'text', x: 80, y: 480, width: 400, height: 25, content: '<span style="font-size:13px;color:#555;">講師名稱 · 2026</span>', fontSize: 13 },
            ],
            background: '#1a1a1a'
        })
    },
    {
        id: 'char-sidebar',
        name: '深灰側欄',
        icon: 'view_sidebar',
        category: '深灰',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 300, height: 540, background: '#1a1a1a' },
                { id: gen(), type: 'text', x: 30, y: 50, width: 240, height: 60, content: '<b style="font-size:26px;color:#e8e8e8;">標題</b>', fontSize: 26, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 30, y: 120, width: 30, height: 2, background: '#6ebea8' },
                { id: gen(), type: 'text', x: 30, y: 145, width: 240, height: 180, content: '<span style="font-size:13px;color:#888;line-height:1.8;">左側可放摘要或重點。</span>', fontSize: 13 },
                { id: gen(), type: 'text', x: 350, y: 50, width: 560, height: 40, content: '<b style="font-size:22px;color:#2a2a2a;">詳細說明</b>', fontSize: 22 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 350, y: 95, width: 560, height: 1, background: '#e0e0e0' },
                { id: gen(), type: 'text', x: 350, y: 115, width: 560, height: 380, content: '<div style="font-size:15px;color:#444;line-height:2;">• 重點一<br>• 重點二<br>• 重點三</div>', fontSize: 15 },
            ],
            background: '#f2f2f2'
        })
    },

    // ─── 極簡純白 ───
    {
        id: 'mini-title',
        name: '極簡封面',
        icon: 'crop_square',
        category: '極簡',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 80, y: 190, width: 800, height: 70, content: '<b style="font-size:42px;color:#111;">課程標題</b>', fontSize: 42, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 275, width: 40, height: 3, background: '#111' },
                { id: gen(), type: 'text', x: 80, y: 300, width: 400, height: 30, content: '<span style="font-size:16px;color:#888;">副標題</span>', fontSize: 16 },
                { id: gen(), type: 'text', x: 80, y: 480, width: 300, height: 25, content: '<span style="font-size:12px;color:#aaa;">講師 · 2026</span>', fontSize: 12 },
            ],
            background: '#fff'
        })
    },
    {
        id: 'mini-split',
        name: '極簡分割',
        icon: 'vertical_split',
        category: '極簡',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 460, height: 540, background: '#111' },
                { id: gen(), type: 'text', x: 50, y: 200, width: 360, height: 70, content: '<b style="font-size:34px;color:#fff;">主題標題</b>', fontSize: 34, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 50, y: 282, width: 30, height: 2, background: '#666' },
                { id: gen(), type: 'text', x: 50, y: 305, width: 360, height: 60, content: '<span style="font-size:14px;color:#888;">簡短描述</span>', fontSize: 14 },
                { id: gen(), type: 'text', x: 510, y: 50, width: 400, height: 440, content: '<div style="font-size:15px;color:#333;line-height:2.2;">① 重點一<br>② 重點二<br>③ 重點三<br>④ 重點四</div>', fontSize: 15 },
            ],
            background: '#fff'
        })
    },

    // ─── 藏青金 ───
    {
        id: 'navy-title',
        name: '藏青封面',
        icon: 'military_tech',
        category: '藏青',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#0c1b33' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 140, width: 4, height: 80, background: '#b8960c' },
                { id: gen(), type: 'text', x: 84, y: 140, width: 700, height: 80, content: '<b style="font-size:44px;color:#eae6d8;">課程主題</b>', fontSize: 44, bold: true },
                { id: gen(), type: 'text', x: 84, y: 230, width: 500, height: 35, content: '<span style="font-size:18px;color:#7a8aa0;">副標題或說明</span>', fontSize: 18 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 480, width: 960, height: 60, background: 'rgba(184,150,12,0.06)' },
                { id: gen(), type: 'text', x: 60, y: 494, width: 400, height: 25, content: '<span style="font-size:13px;color:#5a6a80;">講師 · 2026</span>', fontSize: 13 },
            ],
            background: '#0c1b33'
        })
    },
    {
        id: 'navy-data',
        name: '藏青數據',
        icon: 'monitoring',
        category: '藏青',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#0c1b33' },
                { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 40, content: '<b style="font-size:22px;color:#eae6d8;">關鍵指標</b>', fontSize: 22 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 80, width: 280, height: 140, background: 'rgba(184,150,12,0.06)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 60, y: 95, width: 240, height: 110, content: '<span class="material-symbols-outlined" style="font-size:22px;color:#b8960c;">target</span><br><b style="font-size:36px;color:#eae6d8;">95%</b><br><span style="font-size:12px;color:#7a8aa0;">目標達成率</span>', fontSize: 12 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 340, y: 80, width: 280, height: 140, background: 'rgba(184,150,12,0.06)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 360, y: 95, width: 240, height: 110, content: '<span class="material-symbols-outlined" style="font-size:22px;color:#b8960c;">speed</span><br><b style="font-size:36px;color:#eae6d8;">3.2x</b><br><span style="font-size:12px;color:#7a8aa0;">效率倍增</span>', fontSize: 12 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 80, width: 280, height: 140, background: 'rgba(184,150,12,0.06)', borderRadius: 12 },
                { id: gen(), type: 'text', x: 660, y: 95, width: 240, height: 110, content: '<span class="material-symbols-outlined" style="font-size:22px;color:#b8960c;">thumb_up</span><br><b style="font-size:36px;color:#eae6d8;">4.8</b><br><span style="font-size:12px;color:#7a8aa0;">滿意度評分</span>', fontSize: 12 },
                { id: gen(), type: 'text', x: 60, y: 260, width: 840, height: 240, content: '<div style="font-size:15px;color:#7a8aa0;line-height:2;">補充分析說明。</div>', fontSize: 15 },
            ],
            background: '#0c1b33'
        })
    },

    // ─── 日落暖橘 ───
    {
        id: 'terra-title',
        name: '暖橘封面',
        icon: 'landscape',
        category: '暖橘',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(150deg, #3d2b1f 0%, #2a1f16 100%)' },
                { id: gen(), type: 'text', x: 80, y: 160, width: 800, height: 80, content: '<b style="font-size:46px;color:#f0e4d7;">主題名稱</b>', fontSize: 46, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 255, width: 50, height: 3, background: '#c47d4e' },
                { id: gen(), type: 'text', x: 80, y: 285, width: 500, height: 35, content: '<span style="font-size:18px;color:#a08670;">副標題文字</span>', fontSize: 18 },
                { id: gen(), type: 'text', x: 80, y: 475, width: 300, height: 25, content: '<span style="font-size:13px;color:#6b5a4a;">講師 · 日期</span>', fontSize: 13 },
            ],
            background: '#3d2b1f'
        })
    },
    {
        id: 'terra-steps',
        name: '暖橘步驟',
        icon: 'format_list_numbered',
        category: '暖橘',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 45, content: '<b style="font-size:26px;color:#3d2b1f;">操作步驟</b>', fontSize: 26 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 72, width: 40, height: 3, background: '#c47d4e' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 95, y: 100, width: 2, height: 380, background: '#e0d5ca' },
                { id: gen(), type: 'shape', shapeType: 'circle', x: 80, y: 110, width: 30, height: 30, background: '#c47d4e' },
                { id: gen(), type: 'text', x: 83, y: 114, width: 24, height: 22, content: '<b style="font-size:12px;color:#fff;text-align:center;display:block;">1</b>', fontSize: 12 },
                { id: gen(), type: 'text', x: 125, y: 108, width: 770, height: 55, content: '<b style="font-size:15px;color:#3d2b1f;">第一步</b><br><span style="font-size:13px;color:#7a6a5a;">說明文字</span>', fontSize: 15 },
                { id: gen(), type: 'shape', shapeType: 'circle', x: 80, y: 200, width: 30, height: 30, background: '#c47d4e' },
                { id: gen(), type: 'text', x: 83, y: 204, width: 24, height: 22, content: '<b style="font-size:12px;color:#fff;text-align:center;display:block;">2</b>', fontSize: 12 },
                { id: gen(), type: 'text', x: 125, y: 198, width: 770, height: 55, content: '<b style="font-size:15px;color:#3d2b1f;">第二步</b><br><span style="font-size:13px;color:#7a6a5a;">說明文字</span>', fontSize: 15 },
                { id: gen(), type: 'shape', shapeType: 'circle', x: 80, y: 290, width: 30, height: 30, background: '#c47d4e' },
                { id: gen(), type: 'text', x: 83, y: 294, width: 24, height: 22, content: '<b style="font-size:12px;color:#fff;text-align:center;display:block;">3</b>', fontSize: 12 },
                { id: gen(), type: 'text', x: 125, y: 288, width: 770, height: 55, content: '<b style="font-size:15px;color:#3d2b1f;">第三步</b><br><span style="font-size:13px;color:#7a6a5a;">說明文字</span>', fontSize: 15 },
                { id: gen(), type: 'shape', shapeType: 'circle', x: 80, y: 380, width: 30, height: 30, background: '#c47d4e' },
                { id: gen(), type: 'text', x: 83, y: 384, width: 24, height: 22, content: '<b style="font-size:12px;color:#fff;text-align:center;display:block;">4</b>', fontSize: 12 },
                { id: gen(), type: 'text', x: 125, y: 378, width: 770, height: 55, content: '<b style="font-size:15px;color:#3d2b1f;">第四步</b><br><span style="font-size:13px;color:#7a6a5a;">說明文字</span>', fontSize: 15 },
            ],
            background: '#faf6f1'
        })
    },

    // ─── 酒紅 ───
    {
        id: 'wine-title',
        name: '酒紅封面',
        icon: 'wine_bar',
        category: '酒紅',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: 'linear-gradient(155deg, #2a0e18 0%, #1e0a12 100%)' },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 440, width: 840, height: 1, background: 'rgba(160,70,90,0.2)' },
                { id: gen(), type: 'text', x: 60, y: 170, width: 840, height: 80, content: '<b style="font-size:48px;color:#f5e8ec;text-align:center;display:block;">課程標題</b>', fontSize: 48, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 430, y: 268, width: 100, height: 2, background: '#8b3a50' },
                { id: gen(), type: 'text', x: 60, y: 290, width: 840, height: 35, content: '<span style="font-size:18px;color:#9a7080;text-align:center;display:block;">副標題</span>', fontSize: 18 },
                { id: gen(), type: 'text', x: 60, y: 456, width: 840, height: 25, content: '<span style="font-size:13px;color:#5a3040;text-align:center;display:block;">講師名稱</span>', fontSize: 13 },
            ],
            background: '#2a0e18'
        })
    },
    {
        id: 'wine-compare',
        name: '酒紅對比',
        icon: 'compare_arrows',
        category: '酒紅',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 20, width: 840, height: 40, content: '<b style="font-size:24px;color:#2a0e18;text-align:center;display:block;">前後對比</b>', fontSize: 24 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 75, width: 420, height: 430, background: '#faf0f2', borderRadius: 14 },
                { id: gen(), type: 'text', x: 65, y: 95, width: 370, height: 390, content: '<span class="material-symbols-outlined" style="font-size:28px;color:#8b3a50;">close</span><br><b style="font-size:17px;color:#5a2030;">導入前</b><br><span style="font-size:14px;color:#6a4050;line-height:2.2;">人工作業 8 小時<br>錯誤率 15%<br>成本偏高</span>', fontSize: 14 },
                { id: gen(), type: 'text', x: 440, y: 260, width: 80, height: 40, content: '<span style="font-size:18px;color:#bbb;text-align:center;display:block;">VS</span>', fontSize: 18 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 500, y: 75, width: 420, height: 430, background: '#f0f5f2', borderRadius: 14 },
                { id: gen(), type: 'text', x: 525, y: 95, width: 370, height: 390, content: '<span class="material-symbols-outlined" style="font-size:28px;color:#2a7a4a;">check_circle</span><br><b style="font-size:17px;color:#1a4a2a;">導入後</b><br><span style="font-size:14px;color:#3a5a4a;line-height:2.2;">自動化 2 小時<br>錯誤率 2%<br>成本降低 70%</span>', fontSize: 14 },
            ],
            background: '#faf8f8'
        })
    },

    // ─── 通用 ───
    {
        id: 'blank',
        name: '空白',
        icon: 'crop_landscape',
        category: '通用',
        create: (gen) => ({
            id: gen(),
            elements: [],
            background: '#ffffff'
        })
    },
    {
        id: 'blank-dark',
        name: '空白深色',
        icon: 'crop_landscape',
        category: '通用',
        create: (gen) => ({
            id: gen(),
            elements: [],
            background: '#1a1a1a'
        })
    },
    {
        id: 'section-break',
        name: '章節分隔',
        icon: 'horizontal_rule',
        category: '通用',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 80, y: 100, width: 200, height: 180, content: '<b style="font-size:140px;color:#eee;">01</b>', fontSize: 140 },
                { id: gen(), type: 'text', x: 80, y: 250, width: 800, height: 60, content: '<b style="font-size:34px;color:#222;">章節標題</b>', fontSize: 34, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 322, width: 50, height: 3, background: '#888' },
                { id: gen(), type: 'text', x: 80, y: 352, width: 600, height: 28, content: '<span style="font-size:15px;color:#888;">章節描述</span>', fontSize: 15 },
            ],
            background: '#fff'
        })
    },
    {
        id: 'quote-card',
        name: '引言',
        icon: 'format_quote',
        category: '通用',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 120, y: 60, width: 60, height: 80, content: '<span style="font-size:80px;color:#ddd;font-family:Georgia;">&ldquo;</span>', fontSize: 80 },
                { id: gen(), type: 'text', x: 120, y: 150, width: 720, height: 180, content: '<span style="font-size:26px;color:#222;line-height:1.8;font-style:italic;">在這裡輸入一段有影響力的引言。</span>', fontSize: 26 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 120, y: 360, width: 50, height: 2, background: '#ccc' },
                { id: gen(), type: 'text', x: 120, y: 385, width: 400, height: 28, content: '<span style="font-size:15px;color:#888;">— 出處</span>', fontSize: 15 },
            ],
            background: '#f8f8f8'
        })
    },
    {
        id: 'qa-page',
        name: '問答頁',
        icon: 'help',
        category: '通用',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#1a1a1a' },
                { id: gen(), type: 'text', x: 80, y: 160, width: 800, height: 70, content: '<b style="font-size:48px;color:#eee;text-align:center;display:block;">Q & A</b>', fontSize: 48, bold: true },
                { id: gen(), type: 'text', x: 80, y: 260, width: 800, height: 40, content: '<span style="font-size:18px;color:#888;text-align:center;display:block;">歡迎提問與交流</span>', fontSize: 18 },
            ],
            background: '#1a1a1a'
        })
    },
    {
        id: 'end-page',
        name: '結尾頁',
        icon: 'sentiment_satisfied',
        category: '通用',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: '#1a1a1a' },
                { id: gen(), type: 'text', x: 80, y: 180, width: 800, height: 70, content: '<b style="font-size:42px;color:#eee;text-align:center;display:block;">感謝聆聽</b>', fontSize: 42, bold: true },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 410, y: 270, width: 140, height: 2, background: '#555' },
                { id: gen(), type: 'text', x: 80, y: 300, width: 800, height: 35, content: '<span style="font-size:16px;color:#888;text-align:center;display:block;">Questions & Discussion</span>', fontSize: 16 },
                { id: gen(), type: 'text', x: 80, y: 460, width: 800, height: 25, content: '<span style="font-size:12px;color:#555;text-align:center;display:block;">contact@example.com</span>', fontSize: 12 },
            ],
            background: '#1a1a1a'
        })
    },
];

// ═══════════════════════════════════════════════════════
// 母板色系定義 — 用於 Phase 3 全簡報風格套用
// ═══════════════════════════════════════════════════════
export const MASTER_THEMES = [
    {
        id: 'biz', name: '經典商務',
        preview: { bg: '#1c1917', accent: '#b45309' },
        colors: {
            bgDark: '#1c1917', bgLight: '#fafaf9',
            accent: '#b45309', cardBg: '#f5f5f4',
            textDark: '#1c1917', textLight: '#fafaf9',
            subtextDark: '#78716c', subtextLight: '#a8a29e'
        }
    },
    {
        id: 'nature', name: '自然清新',
        preview: { bg: '#1a2e1a', accent: '#6b8f71' },
        colors: {
            bgDark: '#1a2e1a', bgLight: '#f4f7f4',
            accent: '#6b8f71', cardBg: '#e8ede8',
            textDark: '#2d3b2d', textLight: '#e8ede8',
            subtextDark: '#5a6b5a', subtextLight: '#8faa8f'
        }
    },
    {
        id: 'coral', name: '暖調珊瑚',
        preview: { bg: '#44212a', accent: '#c07070' },
        colors: {
            bgDark: '#44212a', bgLight: '#faf5f5',
            accent: '#c07070', cardBg: '#f5eaeb',
            textDark: '#3d2529', textLight: '#f5e6e8',
            subtextDark: '#6b5558', subtextLight: '#b08a8e'
        }
    },
    {
        id: 'teal', name: '海洋青',
        preview: { bg: '#122c34', accent: '#2a8a8a' },
        colors: {
            bgDark: '#122c34', bgLight: '#f5fafa',
            accent: '#2a8a8a', cardBg: '#e8f4f4',
            textDark: '#1a3c3c', textLight: '#e0f0f0',
            subtextDark: '#4a6868', subtextLight: '#78a8a8'
        }
    },
    {
        id: 'char', name: '沉穩深灰',
        preview: { bg: '#1a1a1a', accent: '#6ebea8' },
        colors: {
            bgDark: '#1a1a1a', bgLight: '#f2f2f2',
            accent: '#6ebea8', cardBg: '#e8e8e8',
            textDark: '#2a2a2a', textLight: '#e8e8e8',
            subtextDark: '#666', subtextLight: '#888'
        }
    },
    {
        id: 'mini', name: '極簡純白',
        preview: { bg: '#111', accent: '#555' },
        colors: {
            bgDark: '#111', bgLight: '#fff',
            accent: '#333', cardBg: '#f5f5f5',
            textDark: '#111', textLight: '#fff',
            subtextDark: '#888', subtextLight: '#aaa'
        }
    },
    {
        id: 'navy', name: '藏青金',
        preview: { bg: '#0c1b33', accent: '#b8960c' },
        colors: {
            bgDark: '#0c1b33', bgLight: '#f8f7f2',
            accent: '#b8960c', cardBg: '#f0ede4',
            textDark: '#1a2a44', textLight: '#eae6d8',
            subtextDark: '#5a6a80', subtextLight: '#7a8aa0'
        }
    },
    {
        id: 'terra', name: '日落暖橘',
        preview: { bg: '#3d2b1f', accent: '#c47d4e' },
        colors: {
            bgDark: '#3d2b1f', bgLight: '#faf6f1',
            accent: '#c47d4e', cardBg: '#f0e8df',
            textDark: '#3d2b1f', textLight: '#f0e4d7',
            subtextDark: '#7a6a5a', subtextLight: '#a08670'
        }
    },
    {
        id: 'wine', name: '酒紅',
        preview: { bg: '#2a0e18', accent: '#8b3a50' },
        colors: {
            bgDark: '#2a0e18', bgLight: '#faf8f8',
            accent: '#8b3a50', cardBg: '#f5eaed',
            textDark: '#2a0e18', textLight: '#f5e8ec',
            subtextDark: '#6b4050', subtextLight: '#9a7080'
        }
    },
    {
        id: 'olive', name: '橄欖灰',
        preview: { bg: '#2a2a20', accent: '#8a8a5a' },
        colors: {
            bgDark: '#2a2a20', bgLight: '#f8f8f2',
            accent: '#8a8a5a', cardBg: '#eeeed8',
            textDark: '#2a2a20', textLight: '#f0f0e0',
            subtextDark: '#6a6a5a', subtextLight: '#9a9a7a'
        }
    },
];

// ═══════════════════════════════════════════════════════
// 結構類型模板 — 時間軸、比較、數據、流程等
// ═══════════════════════════════════════════════════════
// 已整合到 SLIDE_TEMPLATES 主陣列的各色系主題中
// 另外保留以下通用結構模板供 AI 第二階段使用

SLIDE_TEMPLATES.push(
    // 時間軸
    {
        id: 'timeline',
        name: '時間軸',
        icon: 'timeline',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                {
                    id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 45,
                    content: '<b style="font-size:26px;color:#1e293b;">時間軸標題</b>', fontSize: 26, bold: true
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 100, y: 90, width: 2, height: 400, background: '#e2e8f0' },
                // Point 1
                { id: gen(), type: 'shape', shapeType: 'circle', x: 88, y: 110, width: 24, height: 24, background: '#1a73e8' },
                {
                    id: gen(), type: 'text', x: 130, y: 105, width: 770, height: 60,
                    content: '<b style="font-size:15px;color:#1e293b;">階段一</b><br><span style="font-size:13px;color:#64748b;">說明文字</span>', fontSize: 15
                },
                // Point 2
                { id: gen(), type: 'shape', shapeType: 'circle', x: 88, y: 210, width: 24, height: 24, background: '#4285f4' },
                {
                    id: gen(), type: 'text', x: 130, y: 205, width: 770, height: 60,
                    content: '<b style="font-size:15px;color:#1e293b;">階段二</b><br><span style="font-size:13px;color:#64748b;">說明文字</span>', fontSize: 15
                },
                // Point 3
                { id: gen(), type: 'shape', shapeType: 'circle', x: 88, y: 310, width: 24, height: 24, background: '#059669' },
                {
                    id: gen(), type: 'text', x: 130, y: 305, width: 770, height: 60,
                    content: '<b style="font-size:15px;color:#1e293b;">階段三</b><br><span style="font-size:13px;color:#64748b;">說明文字</span>', fontSize: 15
                },
                // Point 4
                { id: gen(), type: 'shape', shapeType: 'circle', x: 88, y: 410, width: 24, height: 24, background: '#d97706' },
                {
                    id: gen(), type: 'text', x: 130, y: 405, width: 770, height: 60,
                    content: '<b style="font-size:15px;color:#1e293b;">階段四</b><br><span style="font-size:13px;color:#64748b;">說明文字</span>', fontSize: 15
                },
            ],
            background: '#ffffff'
        })
    },
    // 比較
    {
        id: 'comparison',
        name: '前後對比',
        icon: 'compare_arrows',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                {
                    id: gen(), type: 'text', x: 60, y: 20, width: 840, height: 40,
                    content: '<b style="font-size:24px;color:#1e293b;text-align:center;display:block;">比較標題</b>', fontSize: 24
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 75, width: 420, height: 430, background: '#fef2f2', borderRadius: 14 },
                {
                    id: gen(), type: 'text', x: 65, y: 95, width: 370, height: 390,
                    content: '<span class="material-symbols-outlined" style="font-size:28px;color:#dc2626;">close</span><br><b style="font-size:17px;color:#7f1d1d;">方案 A</b><br><span style="font-size:14px;color:#991b1b;line-height:2.2;">內容說明</span>', fontSize: 14
                },
                {
                    id: gen(), type: 'text', x: 440, y: 260, width: 80, height: 40,
                    content: '<span style="font-size:18px;color:#bbb;text-align:center;display:block;">VS</span>', fontSize: 18
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 500, y: 75, width: 420, height: 430, background: '#ecfdf5', borderRadius: 14 },
                {
                    id: gen(), type: 'text', x: 525, y: 95, width: 370, height: 390,
                    content: '<span class="material-symbols-outlined" style="font-size:28px;color:#059669;">check_circle</span><br><b style="font-size:17px;color:#064e3b;">方案 B</b><br><span style="font-size:14px;color:#065f46;line-height:2.2;">內容說明</span>', fontSize: 14
                },
            ],
            background: '#ffffff'
        })
    },
    // 數據大字
    {
        id: 'stats',
        name: '數據呈現',
        icon: 'monitoring',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                {
                    id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 40,
                    content: '<b style="font-size:22px;color:#1e293b;">關鍵指標</b>', fontSize: 22
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 80, width: 280, height: 140, background: '#eff6ff', borderRadius: 12 },
                {
                    id: gen(), type: 'text', x: 60, y: 95, width: 240, height: 110,
                    content: '<span class="material-symbols-outlined" style="font-size:22px;color:#2563eb;">trending_up</span><br><b style="font-size:36px;color:#1e293b;">95%</b><br><span style="font-size:12px;color:#64748b;">達成率</span>', fontSize: 12
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 340, y: 80, width: 280, height: 140, background: '#ecfdf5', borderRadius: 12 },
                {
                    id: gen(), type: 'text', x: 360, y: 95, width: 240, height: 110,
                    content: '<span class="material-symbols-outlined" style="font-size:22px;color:#059669;">speed</span><br><b style="font-size:36px;color:#1e293b;">3.2x</b><br><span style="font-size:12px;color:#64748b;">效率提升</span>', fontSize: 12
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 640, y: 80, width: 280, height: 140, background: '#fefce8', borderRadius: 12 },
                {
                    id: gen(), type: 'text', x: 660, y: 95, width: 240, height: 110,
                    content: '<span class="material-symbols-outlined" style="font-size:22px;color:#d97706;">thumb_up</span><br><b style="font-size:36px;color:#1e293b;">4.8</b><br><span style="font-size:12px;color:#64748b;">滿意度</span>', fontSize: 12
                },
                {
                    id: gen(), type: 'text', x: 60, y: 250, width: 840, height: 260,
                    content: '<div style="font-size:15px;color:#475569;line-height:2;">補充說明文字區域</div>', fontSize: 15
                },
            ],
            background: '#ffffff'
        })
    },
    // 流程圖
    {
        id: 'flow',
        name: '流程圖',
        icon: 'account_tree',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                {
                    id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 40,
                    content: '<b style="font-size:24px;color:#1e293b;">流程步驟</b>', fontSize: 24
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 90, width: 180, height: 80, background: '#eff6ff', borderRadius: 12 },
                {
                    id: gen(), type: 'text', x: 70, y: 105, width: 160, height: 50,
                    content: '<b style="font-size:14px;color:#1e40af;text-align:center;display:block;">Step 1</b>', fontSize: 14
                },
                {
                    id: gen(), type: 'text', x: 250, y: 115, width: 40, height: 30,
                    content: '<span class="material-symbols-outlined" style="font-size:20px;color:#cbd5e1;">arrow_forward</span>', fontSize: 20
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 300, y: 90, width: 180, height: 80, background: '#ecfdf5', borderRadius: 12 },
                {
                    id: gen(), type: 'text', x: 310, y: 105, width: 160, height: 50,
                    content: '<b style="font-size:14px;color:#065f46;text-align:center;display:block;">Step 2</b>', fontSize: 14
                },
                {
                    id: gen(), type: 'text', x: 490, y: 115, width: 40, height: 30,
                    content: '<span class="material-symbols-outlined" style="font-size:20px;color:#cbd5e1;">arrow_forward</span>', fontSize: 20
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 540, y: 90, width: 180, height: 80, background: '#fefce8', borderRadius: 12 },
                {
                    id: gen(), type: 'text', x: 550, y: 105, width: 160, height: 50,
                    content: '<b style="font-size:14px;color:#92400e;text-align:center;display:block;">Step 3</b>', fontSize: 14
                },
                {
                    id: gen(), type: 'text', x: 730, y: 115, width: 40, height: 30,
                    content: '<span class="material-symbols-outlined" style="font-size:20px;color:#cbd5e1;">arrow_forward</span>', fontSize: 20
                },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 780, y: 90, width: 140, height: 80, background: '#fce7f3', borderRadius: 12 },
                {
                    id: gen(), type: 'text', x: 790, y: 105, width: 120, height: 50,
                    content: '<b style="font-size:14px;color:#9d174d;text-align:center;display:block;">完成</b>', fontSize: 14
                },
                {
                    id: gen(), type: 'text', x: 60, y: 200, width: 840, height: 300,
                    content: '<div style="font-size:15px;color:#475569;line-height:2;">補充說明</div>', fontSize: 15
                },
            ],
            background: '#ffffff'
        })
    },
    // 分層數據
    {
        id: 'layered-data',
        name: '分層數據',
        icon: 'stacked_bar_chart',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                {
                    id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 40,
                    content: '<b style="font-size:24px;color:#1e293b;">分層分析</b>', fontSize: 24
                },
                // Layer 1
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 80, width: 880, height: 100, background: '#eff6ff', borderRadius: 10 },
                {
                    id: gen(), type: 'text', x: 60, y: 90, width: 840, height: 80,
                    content: '<span class="material-symbols-outlined" style="font-size:22px;color:#2563eb;vertical-align:middle;">looks_one</span> <b style="font-size:16px;color:#1e40af;">第一層</b><br><span style="font-size:13px;color:#475569;line-height:1.6;">描述文字</span>', fontSize: 16
                },
                // Layer 2
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 195, width: 880, height: 100, background: '#ecfdf5', borderRadius: 10 },
                {
                    id: gen(), type: 'text', x: 60, y: 205, width: 840, height: 80,
                    content: '<span class="material-symbols-outlined" style="font-size:22px;color:#059669;vertical-align:middle;">looks_two</span> <b style="font-size:16px;color:#065f46;">第二層</b><br><span style="font-size:13px;color:#475569;line-height:1.6;">描述文字</span>', fontSize: 16
                },
                // Layer 3
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 310, width: 880, height: 100, background: '#fefce8', borderRadius: 10 },
                {
                    id: gen(), type: 'text', x: 60, y: 320, width: 840, height: 80,
                    content: '<span class="material-symbols-outlined" style="font-size:22px;color:#d97706;vertical-align:middle;">looks_3</span> <b style="font-size:16px;color:#92400e;">第三層</b><br><span style="font-size:13px;color:#475569;line-height:1.6;">描述文字</span>', fontSize: 16
                },
                // Layer 4
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 425, width: 880, height: 85, background: '#fce7f3', borderRadius: 10 },
                {
                    id: gen(), type: 'text', x: 60, y: 432, width: 840, height: 70,
                    content: '<span class="material-symbols-outlined" style="font-size:22px;color:#be185d;vertical-align:middle;">looks_4</span> <b style="font-size:16px;color:#9d174d;">第四層</b><br><span style="font-size:13px;color:#475569;line-height:1.6;">描述文字</span>', fontSize: 16
                },
            ],
            background: '#ffffff'
        })
    },
);
