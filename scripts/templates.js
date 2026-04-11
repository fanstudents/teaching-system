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
    // SWOT 分析
    {
        id: 'swot',
        name: 'SWOT 分析',
        icon: 'grid_4x4',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 15, width: 840, height: 40, content: '<b style="font-size:24px;color:#1e293b;text-align:center;display:block;">SWOT 分析</b>', fontSize: 24 },
                // S
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 65, width: 425, height: 215, background: '#eff6ff', borderRadius: 14 },
                { id: gen(), type: 'text', x: 60, y: 75, width: 385, height: 195, content: '<b style="font-size:17px;color:#1e40af;">S — 優勢</b><br><span style="font-size:13px;color:#475569;line-height:2;">• 優勢一<br>• 優勢二</span>', fontSize: 13 },
                // W
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 65, width: 425, height: 215, background: '#fef2f2', borderRadius: 14 },
                { id: gen(), type: 'text', x: 515, y: 75, width: 385, height: 195, content: '<b style="font-size:17px;color:#991b1b;">W — 劣勢</b><br><span style="font-size:13px;color:#475569;line-height:2;">• 劣勢一<br>• 劣勢二</span>', fontSize: 13 },
                // O
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 300, width: 425, height: 215, background: '#ecfdf5', borderRadius: 14 },
                { id: gen(), type: 'text', x: 60, y: 310, width: 385, height: 195, content: '<b style="font-size:17px;color:#065f46;">O — 機會</b><br><span style="font-size:13px;color:#475569;line-height:2;">• 機會一<br>• 機會二</span>', fontSize: 13 },
                // T
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 300, width: 425, height: 215, background: '#fefce8', borderRadius: 14 },
                { id: gen(), type: 'text', x: 515, y: 310, width: 385, height: 195, content: '<b style="font-size:17px;color:#92400e;">T — 威脅</b><br><span style="font-size:13px;color:#475569;line-height:2;">• 威脅一<br>• 威脅二</span>', fontSize: 13 },
            ],
            background: '#ffffff'
        })
    },
    // 四格卡片
    {
        id: 'grid-4',
        name: '四格卡片',
        icon: 'grid_view',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 15, width: 840, height: 40, content: '<b style="font-size:24px;color:#1e293b;">四格重點</b>', fontSize: 24 },
                ...[0,1,2,3].flatMap(i => {
                    const col = i % 2, row = Math.floor(i / 2);
                    const x = 40 + col * 455, y = 65 + row * 235;
                    const colors = ['#eff6ff','#ecfdf5','#fefce8','#fce7f3'];
                    const icons = ['lightbulb','build','target','rocket_launch'];
                    const iconColors = ['#2563eb','#059669','#d97706','#be185d'];
                    return [
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x, y, width: 425, height: 215, background: colors[i], borderRadius: 14 },
                        { id: gen(), type: 'text', x: x+20, y: y+15, width: 385, height: 185, content: `<span class="material-symbols-outlined" style="font-size:24px;color:${iconColors[i]};">${icons[i]}</span><br><b style="font-size:15px;color:#1e293b;">標題 ${i+1}</b><br><span style="font-size:13px;color:#64748b;line-height:1.8;">說明文字</span>`, fontSize: 13 },
                    ];
                }),
            ],
            background: '#ffffff'
        })
    },
    // 六格卡片
    {
        id: 'grid-6',
        name: '六格卡片',
        icon: 'apps',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 10, width: 840, height: 35, content: '<b style="font-size:22px;color:#1e293b;">六大面向</b>', fontSize: 22 },
                ...[0,1,2,3,4,5].flatMap(i => {
                    const col = i % 3, row = Math.floor(i / 3);
                    const x = 30 + col * 310, y = 55 + row * 245;
                    const colors = ['#eff6ff','#ecfdf5','#fefce8','#fce7f3','#f5f3ff','#fff7ed'];
                    return [
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x, y, width: 290, height: 225, background: colors[i], borderRadius: 12 },
                        { id: gen(), type: 'text', x: x+15, y: y+12, width: 260, height: 200, content: `<b style="font-size:14px;color:#1e293b;">項目 ${i+1}</b><br><span style="font-size:12px;color:#64748b;line-height:1.8;">說明文字</span>`, fontSize: 12 },
                    ];
                }),
            ],
            background: '#ffffff'
        })
    },
    // 大數字
    {
        id: 'big-number',
        name: '大數字突出',
        icon: 'pin',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 40, content: '<b style="font-size:22px;color:#1e293b;">核心數據</b>', fontSize: 22 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 120, y: 100, width: 720, height: 260, background: '#eff6ff', borderRadius: 20 },
                { id: gen(), type: 'text', x: 140, y: 120, width: 680, height: 120, content: '<b style="font-size:80px;color:#1e40af;text-align:center;display:block;">87%</b>', fontSize: 80 },
                { id: gen(), type: 'text', x: 140, y: 240, width: 680, height: 40, content: '<span style="font-size:20px;color:#475569;text-align:center;display:block;">關鍵指標說明</span>', fontSize: 20 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 360, y: 290, width: 240, height: 3, background: '#93c5fd', borderRadius: 2 },
                { id: gen(), type: 'text', x: 120, y: 400, width: 720, height: 80, content: '<span style="font-size:15px;color:#64748b;text-align:center;display:block;line-height:1.8;">補充說明：數據來源與分析解讀。</span>', fontSize: 15 },
            ],
            background: '#ffffff'
        })
    },
    // 圖示列表
    {
        id: 'icon-list',
        name: '圖示條列',
        icon: 'format_list_bulleted',
        category: '結構',
        create: (gen) => {
            const items = [
                { icon: 'check_circle', color: '#059669', title: '第一點', desc: '說明文字' },
                { icon: 'star', color: '#d97706', title: '第二點', desc: '說明文字' },
                { icon: 'bolt', color: '#2563eb', title: '第三點', desc: '說明文字' },
                { icon: 'favorite', color: '#dc2626', title: '第四點', desc: '說明文字' },
            ];
            return {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 40, content: '<b style="font-size:24px;color:#1e293b;">重點項目</b>', fontSize: 24 },
                    ...items.flatMap((it, i) => [
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 80 + i * 110, width: 880, height: 95, background: i % 2 === 0 ? '#f8fafc' : '#ffffff', borderRadius: 12 },
                        { id: gen(), type: 'text', x: 60, y: 90 + i * 110, width: 840, height: 75, content: `<span class="material-symbols-outlined" style="font-size:26px;color:${it.color};vertical-align:middle;">${it.icon}</span> <b style="font-size:16px;color:#1e293b;vertical-align:middle;">${it.title}</b><br><span style="font-size:13px;color:#64748b;margin-left:36px;">${it.desc}</span>`, fontSize: 16 },
                    ]),
                ],
                background: '#ffffff'
            };
        }
    },
    // 金字塔
    {
        id: 'pyramid',
        name: '金字塔層次',
        icon: 'signal_cellular_alt',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 15, width: 840, height: 40, content: '<b style="font-size:24px;color:#1e293b;text-align:center;display:block;">層次架構</b>', fontSize: 24 },
                // Level 1 (top)
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 330, y: 70, width: 300, height: 80, background: '#1e40af', borderRadius: 10 },
                { id: gen(), type: 'text', x: 340, y: 80, width: 280, height: 60, content: '<b style="font-size:15px;color:#fff;text-align:center;display:block;">策略層</b>', fontSize: 15 },
                // Level 2
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 230, y: 165, width: 500, height: 80, background: '#3b82f6', borderRadius: 10 },
                { id: gen(), type: 'text', x: 240, y: 175, width: 480, height: 60, content: '<b style="font-size:15px;color:#fff;text-align:center;display:block;">管理層</b>', fontSize: 15 },
                // Level 3
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 130, y: 260, width: 700, height: 80, background: '#60a5fa', borderRadius: 10 },
                { id: gen(), type: 'text', x: 140, y: 270, width: 680, height: 60, content: '<b style="font-size:15px;color:#fff;text-align:center;display:block;">執行層</b>', fontSize: 15 },
                // Level 4 (base)
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 355, width: 880, height: 80, background: '#93c5fd', borderRadius: 10 },
                { id: gen(), type: 'text', x: 50, y: 365, width: 860, height: 60, content: '<b style="font-size:15px;color:#1e40af;text-align:center;display:block;">基礎層</b>', fontSize: 15 },
                { id: gen(), type: 'text', x: 60, y: 460, width: 840, height: 50, content: '<span style="font-size:13px;color:#94a3b8;text-align:center;display:block;">由上而下：高層策略 → 基層執行</span>', fontSize: 13 },
            ],
            background: '#ffffff'
        })
    },
    // 核查表
    {
        id: 'checklist',
        name: '核查清單',
        icon: 'checklist',
        category: '結構',
        create: (gen) => {
            const items = ['任務項目一', '任務項目二', '任務項目三', '任務項目四', '任務項目五'];
            return {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 40, content: '<b style="font-size:24px;color:#1e293b;">待辦清單</b>', fontSize: 24 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 70, width: 50, height: 3, background: '#059669', borderRadius: 2 },
                    ...items.flatMap((txt, i) => [
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 90 + i * 82, width: 840, height: 68, background: '#f0fdf4', borderRadius: 10 },
                        { id: gen(), type: 'text', x: 80, y: 100 + i * 82, width: 800, height: 48, content: `<span class="material-symbols-outlined" style="font-size:22px;color:#059669;vertical-align:middle;">check_box_outline_blank</span> <span style="font-size:15px;color:#1e293b;vertical-align:middle;">${txt}</span>`, fontSize: 15 },
                    ]),
                ],
                background: '#ffffff'
            };
        }
    },
    // 優缺點對比
    {
        id: 'pros-cons',
        name: '優缺點',
        icon: 'thumbs_up_down',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 15, width: 840, height: 40, content: '<b style="font-size:24px;color:#1e293b;text-align:center;display:block;">優缺點分析</b>', fontSize: 24 },
                // Pros
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 70, width: 425, height: 440, background: '#ecfdf5', borderRadius: 14 },
                { id: gen(), type: 'text', x: 60, y: 80, width: 385, height: 420, content: '<span class="material-symbols-outlined" style="font-size:28px;color:#059669;">thumb_up</span><br><b style="font-size:18px;color:#065f46;">優點</b><br><span style="font-size:14px;color:#475569;line-height:2.2;">✓ 優點一<br>✓ 優點二<br>✓ 優點三</span>', fontSize: 14 },
                // Cons
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 70, width: 425, height: 440, background: '#fef2f2', borderRadius: 14 },
                { id: gen(), type: 'text', x: 515, y: 80, width: 385, height: 420, content: '<span class="material-symbols-outlined" style="font-size:28px;color:#dc2626;">thumb_down</span><br><b style="font-size:18px;color:#7f1d1d;">缺點</b><br><span style="font-size:14px;color:#475569;line-height:2.2;">✗ 缺點一<br>✗ 缺點二<br>✗ 缺點三</span>', fontSize: 14 },
            ],
            background: '#ffffff'
        })
    },
    // 三行橫條
    {
        id: 'three-row',
        name: '三行橫條',
        icon: 'view_agenda',
        category: '結構',
        create: (gen) => {
            const colors = ['#eff6ff', '#ecfdf5', '#fefce8'];
            const accents = ['#2563eb', '#059669', '#d97706'];
            const titles = ['第一點', '第二點', '第三點'];
            return {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 15, width: 840, height: 40, content: '<b style="font-size:24px;color:#1e293b;">三大要點</b>', fontSize: 24 },
                    ...colors.flatMap((bg, i) => [
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 70 + i * 155, width: 880, height: 135, background: bg, borderRadius: 14 },
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 70 + i * 155, width: 6, height: 135, background: accents[i], borderRadius: 14 },
                        { id: gen(), type: 'text', x: 70, y: 85 + i * 155, width: 830, height: 105, content: `<b style="font-size:17px;color:#1e293b;">${titles[i]}</b><br><span style="font-size:14px;color:#64748b;line-height:1.8;">補充說明文字</span>`, fontSize: 17 },
                    ]),
                ],
                background: '#ffffff'
            };
        }
    },
    // 議程表
    {
        id: 'agenda',
        name: '議程表',
        icon: 'event_note',
        category: '結構',
        create: (gen) => {
            const items = [
                { time: '09:00', title: '開場與介紹' },
                { time: '09:30', title: '主題演講' },
                { time: '10:30', title: '實作練習' },
                { time: '11:30', title: '分組討論' },
                { time: '12:00', title: 'Q&A 與總結' },
            ];
            return {
                id: gen(),
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 20, width: 840, height: 45, content: '<b style="font-size:26px;color:#1e293b;">課程議程</b>', fontSize: 26 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 68, width: 50, height: 3, background: '#2563eb', borderRadius: 2 },
                    ...items.flatMap((it, i) => [
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 85 + i * 85, width: 840, height: 70, background: i % 2 === 0 ? '#f8fafc' : '#ffffff', borderRadius: 10 },
                        { id: gen(), type: 'text', x: 80, y: 95 + i * 85, width: 120, height: 50, content: `<b style="font-size:16px;color:#2563eb;">${it.time}</b>`, fontSize: 16 },
                        { id: gen(), type: 'text', x: 210, y: 95 + i * 85, width: 670, height: 50, content: `<span style="font-size:16px;color:#1e293b;">${it.title}</span>`, fontSize: 16 },
                    ]),
                ],
                background: '#ffffff'
            };
        }
    },
    // 重點摘要
    {
        id: 'key-takeaway',
        name: '重點摘要',
        icon: 'auto_awesome',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 100, background: '#1e293b' },
                { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 50, content: '<span class="material-symbols-outlined" style="font-size:22px;color:#fbbf24;vertical-align:middle;">auto_awesome</span> <b style="font-size:26px;color:#fff;vertical-align:middle;"> Key Takeaways</b>', fontSize: 26 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 120, width: 840, height: 120, background: '#eff6ff', borderRadius: 14 },
                { id: gen(), type: 'text', x: 80, y: 132, width: 800, height: 96, content: '<span class="material-symbols-outlined" style="font-size:20px;color:#2563eb;vertical-align:middle;">looks_one</span> <b style="font-size:16px;color:#1e293b;vertical-align:middle;">第一個重點</b><br><span style="font-size:14px;color:#64748b;margin-left:30px;">詳細說明</span>', fontSize: 16 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 255, width: 840, height: 120, background: '#ecfdf5', borderRadius: 14 },
                { id: gen(), type: 'text', x: 80, y: 267, width: 800, height: 96, content: '<span class="material-symbols-outlined" style="font-size:20px;color:#059669;vertical-align:middle;">looks_two</span> <b style="font-size:16px;color:#1e293b;vertical-align:middle;">第二個重點</b><br><span style="font-size:14px;color:#64748b;margin-left:30px;">詳細說明</span>', fontSize: 16 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 390, width: 840, height: 120, background: '#fefce8', borderRadius: 14 },
                { id: gen(), type: 'text', x: 80, y: 402, width: 800, height: 96, content: '<span class="material-symbols-outlined" style="font-size:20px;color:#d97706;vertical-align:middle;">looks_3</span> <b style="font-size:16px;color:#1e293b;vertical-align:middle;">第三個重點</b><br><span style="font-size:14px;color:#64748b;margin-left:30px;">詳細說明</span>', fontSize: 16 },
            ],
            background: '#ffffff'
        })
    },
    // 圖片左 + 文字右
    {
        id: 'image-left',
        name: '圖文左右',
        icon: 'image',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 40, width: 420, height: 460, background: '#f1f5f9', borderRadius: 16, border: '2px dashed #cbd5e1' },
                { id: gen(), type: 'text', x: 160, y: 240, width: 180, height: 40, content: '<span style="font-size:14px;color:#94a3b8;text-align:center;display:block;">📷 放置圖片</span>', fontSize: 14 },
                { id: gen(), type: 'text', x: 500, y: 60, width: 420, height: 50, content: '<b style="font-size:28px;color:#1e293b;">標題文字</b>', fontSize: 28 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 500, y: 118, width: 50, height: 3, background: '#2563eb', borderRadius: 2 },
                { id: gen(), type: 'text', x: 500, y: 140, width: 420, height: 340, content: '<div style="font-size:15px;color:#475569;line-height:2.2;">• 重點一<br>• 重點二<br>• 重點三<br>• 重點四</div>', fontSize: 15 },
            ],
            background: '#ffffff'
        })
    },
    // 文字左 + 圖片右
    {
        id: 'image-right',
        name: '文圖左右',
        icon: 'photo_library',
        category: '結構',
        create: (gen) => ({
            id: gen(),
            elements: [
                { id: gen(), type: 'text', x: 60, y: 60, width: 400, height: 50, content: '<b style="font-size:28px;color:#1e293b;">標題文字</b>', fontSize: 28 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 118, width: 50, height: 3, background: '#059669', borderRadius: 2 },
                { id: gen(), type: 'text', x: 60, y: 140, width: 400, height: 340, content: '<div style="font-size:15px;color:#475569;line-height:2.2;">• 重點一<br>• 重點二<br>• 重點三<br>• 重點四</div>', fontSize: 15 },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 500, y: 40, width: 420, height: 460, background: '#f0fdf4', borderRadius: 16, border: '2px dashed #bbf7d0' },
                { id: gen(), type: 'text', x: 620, y: 240, width: 180, height: 40, content: '<span style="font-size:14px;color:#86efac;text-align:center;display:block;">📷 放置圖片</span>', fontSize: 14 },
            ],
            background: '#ffffff'
        })
    },
);

// ═══════════════════════════════════════════════════════
// 佈局版型工廠 — 供 AI 生成器使用
// createLayoutSlide(layoutType, data, themeId, gen)
// ═══════════════════════════════════════════════════════

/**
 * 根據版型類型 + 內容資料 + 色系產生完整投影片
 * @param {'cover'|'section'|'content'|'two-column'|'three-card'|'comparison'|'numbered-list'|'quote'|'timeline'|'stats'|'flow'|'swot'|'grid-4'|'big-number'|'icon-list'|'key-takeaway'|'thank-you'|'pros-cons'|'three-row'|'agenda'|'checklist'|'image-left'|'image-right'} layoutType
 * @param {Object} data - { title, content, items[], day, needsVisual }
 * @param {string} themeId - MASTER_THEMES id (e.g. 'biz', 'navy')
 * @param {Function} gen - ID generator
 * @returns {Object} slide object { id, elements, background }
 */
export function createLayoutSlide(layoutType, data = {}, themeId = null, gen) {
    const t = themeId ? MASTER_THEMES.find(m => m.id === themeId)?.colors : null;
    // 預設通用配色
    const c = {
        bgDark: t?.bgDark || '#1e293b',
        bgLight: t?.bgLight || '#ffffff',
        accent: t?.accent || '#2563eb',
        cardBg: t?.cardBg || '#f1f5f9',
        textDark: t?.textDark || '#1e293b',
        textLight: t?.textLight || '#ffffff',
        subtextDark: t?.subtextDark || '#64748b',
        subtextLight: t?.subtextLight || '#94a3b8',
    };
    const title = data.title || '';
    const content = data.content || '';
    const items = data.items || content.split('|||').filter(Boolean);

    switch (layoutType) {
        case 'cover':
            return {
                id: gen(), background: c.bgDark,
                elements: [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 540, background: c.bgDark },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 6, height: 540, background: c.accent },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 460, width: 960, height: 80, background: `${c.accent}10` },
                    { id: gen(), type: 'text', x: 60, y: 140, width: 700, height: 80, content: `<b style="font-size:46px;color:${c.textLight};letter-spacing:0.5px;">${title}</b>`, fontSize: 46, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 240, width: 50, height: 3, background: c.accent },
                    { id: gen(), type: 'text', x: 60, y: 268, width: 500, height: 35, content: `<span style="font-size:18px;color:${c.subtextLight};">${content}</span>`, fontSize: 18 },
                    { id: gen(), type: 'text', x: 60, y: 478, width: 400, height: 25, content: `<span style="font-size:13px;color:${c.subtextDark};">${data.speaker || ''}</span>`, fontSize: 13 },
                ],
            };

        case 'section':
            return {
                id: gen(), background: c.bgLight,
                elements: [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 6, background: c.accent },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 100, width: 840, height: 200, background: c.cardBg, borderRadius: 16 },
                    { id: gen(), type: 'text', x: 80, y: 120, width: 800, height: 30, content: `<span style="font-size:14px;color:${c.accent};letter-spacing:3px;font-weight:600;">${data.day || ''}</span>`, fontSize: 14 },
                    { id: gen(), type: 'text', x: 80, y: 160, width: 800, height: 80, content: `<b style="font-size:36px;color:${c.textDark};">${title}</b>`, fontSize: 36 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 80, y: 260, width: 80, height: 4, background: c.accent, borderRadius: 2 },
                ],
            };

        case 'two-column': {
            const [left = '', right = ''] = items;
            return {
                id: gen(), background: c.bgLight,
                elements: [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 22, width: 5, height: 50, background: c.accent, borderRadius: 2 },
                    { id: gen(), type: 'text', x: 78, y: 25, width: 820, height: 45, content: `<b style="font-size:26px;color:${c.textDark};">${title}</b>`, fontSize: 26 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 425, height: 420, background: c.cardBg, borderRadius: 16 },
                    { id: gen(), type: 'text', x: 60, y: 100, width: 385, height: 390, content: `<div style="font-size:15px;color:${c.subtextDark};line-height:2;">${left}</div>`, fontSize: 15 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 85, width: 425, height: 420, background: c.cardBg, borderRadius: 16 },
                    { id: gen(), type: 'text', x: 515, y: 100, width: 385, height: 390, content: `<div style="font-size:15px;color:${c.subtextDark};line-height:2;">${right}</div>`, fontSize: 15 },
                ],
            };
        }

        case 'three-card': {
            const cards = items.slice(0, 3);
            return {
                id: gen(), background: c.bgLight,
                elements: [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 22, width: 5, height: 50, background: c.accent, borderRadius: 2 },
                    { id: gen(), type: 'text', x: 78, y: 25, width: 820, height: 45, content: `<b style="font-size:26px;color:${c.textDark};">${title}</b>`, fontSize: 26 },
                    ...cards.flatMap((cd, i) => [
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 30 + i * 310, y: 85, width: 290, height: 420, background: c.cardBg, borderRadius: 16 },
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 30 + i * 310, y: 85, width: 290, height: 5, background: c.accent, borderRadius: 16 },
                        { id: gen(), type: 'text', x: 50 + i * 310, y: 105, width: 250, height: 385, content: `<div style="font-size:14px;color:${c.subtextDark};line-height:2;">${cd}</div>`, fontSize: 14 },
                    ]),
                ],
            };
        }

        case 'comparison': {
            const [left = '', right = ''] = items;
            return {
                id: gen(), background: c.bgLight,
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 45, content: `<b style="font-size:26px;color:${c.textDark};text-align:center;display:block;">${title}</b>`, fontSize: 26 },
                    { id: gen(), type: 'shape', shapeType: 'circle', x: 440, y: 260, width: 50, height: 50, background: c.bgDark },
                    { id: gen(), type: 'text', x: 440, y: 268, width: 50, height: 30, content: `<b style="font-size:14px;color:${c.textLight};text-align:center;display:block;">VS</b>`, fontSize: 14 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 395, height: 420, background: '#fef2f2', borderRadius: 16 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 85, width: 395, height: 5, background: '#ef4444', borderRadius: 16 },
                    { id: gen(), type: 'text', x: 60, y: 105, width: 355, height: 385, content: `<div style="font-size:14px;color:#475569;line-height:2.2;">${left}</div>`, fontSize: 14 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 85, width: 425, height: 420, background: '#ecfdf5', borderRadius: 16 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 85, width: 425, height: 5, background: '#059669', borderRadius: 16 },
                    { id: gen(), type: 'text', x: 515, y: 105, width: 385, height: 385, content: `<div style="font-size:14px;color:#475569;line-height:2.2;">${right}</div>`, fontSize: 14 },
                ],
            };
        }

        case 'numbered-list': {
            const listItems = content.split('<br>').filter(Boolean);
            const els = [
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 45, height: 540, background: c.cardBg },
                { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 22, width: 5, height: 50, background: c.accent, borderRadius: 2 },
                { id: gen(), type: 'text', x: 78, y: 25, width: 820, height: 45, content: `<b style="font-size:26px;color:${c.textDark};">${title}</b>`, fontSize: 26 },
                ...listItems.slice(0, 5).flatMap((item, i) => [
                    { id: gen(), type: 'shape', shapeType: 'circle', x: 60, y: 90 + i * 85, width: 40, height: 40, background: c.accent },
                    { id: gen(), type: 'text', x: 60, y: 94 + i * 85, width: 40, height: 32, content: `<b style="font-size:18px;color:${c.textLight};text-align:center;display:block;">${i + 1}</b>`, fontSize: 18 },
                    { id: gen(), type: 'text', x: 120, y: 94 + i * 85, width: 780, height: 40, content: `<span style="font-size:16px;color:${c.textDark};">${item.trim()}</span>`, fontSize: 16 },
                ]),
            ];
            return { id: gen(), background: c.bgLight, elements: els };
        }

        case 'quote':
            return {
                id: gen(), background: c.bgLight,
                elements: [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 80, width: 840, height: 380, background: c.cardBg, borderRadius: 20 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 70, y: 100, width: 5, height: 200, background: c.accent, borderRadius: 2 },
                    { id: gen(), type: 'text', x: 110, y: 160, width: 740, height: 180, content: `<span style="font-size:24px;color:${c.textDark};font-style:italic;line-height:1.8;">${content}</span>`, fontSize: 24 },
                    { id: gen(), type: 'text', x: 110, y: 380, width: 740, height: 30, content: `<span style="font-size:16px;color:${c.subtextLight};">— ${title}</span>`, fontSize: 16 },
                ],
            };

        case 'stats': {
            const statItems = items.slice(0, 3);
            const statColors = ['#eff6ff', '#ecfdf5', '#fefce8'];
            return {
                id: gen(), background: c.bgLight,
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 40, content: `<b style="font-size:22px;color:${c.textDark};">${title}</b>`, fontSize: 22 },
                    ...statItems.flatMap((st, i) => [
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40 + i * 300, y: 80, width: 280, height: 140, background: statColors[i] || c.cardBg, borderRadius: 12 },
                        { id: gen(), type: 'text', x: 60 + i * 300, y: 95, width: 240, height: 110, content: `<div style="font-size:14px;color:${c.subtextDark};text-align:center;line-height:2;">${st}</div>`, fontSize: 14 },
                    ]),
                    { id: gen(), type: 'text', x: 60, y: 250, width: 840, height: 260, content: `<div style="font-size:15px;color:${c.subtextDark};line-height:2;">補充說明</div>`, fontSize: 15 },
                ],
            };
        }

        case 'swot': {
            const [s = '', w = '', o = '', _t = ''] = items;
            return {
                id: gen(), background: c.bgLight,
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 15, width: 840, height: 40, content: `<b style="font-size:24px;color:${c.textDark};text-align:center;display:block;">${title || 'SWOT 分析'}</b>`, fontSize: 24 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 65, width: 425, height: 215, background: '#eff6ff', borderRadius: 14 },
                    { id: gen(), type: 'text', x: 60, y: 75, width: 385, height: 195, content: `<b style="font-size:17px;color:#1e40af;">S — 優勢</b><br><span style="font-size:13px;color:#475569;line-height:2;">${s}</span>`, fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 65, width: 425, height: 215, background: '#fef2f2', borderRadius: 14 },
                    { id: gen(), type: 'text', x: 515, y: 75, width: 385, height: 195, content: `<b style="font-size:17px;color:#991b1b;">W — 劣勢</b><br><span style="font-size:13px;color:#475569;line-height:2;">${w}</span>`, fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 300, width: 425, height: 215, background: '#ecfdf5', borderRadius: 14 },
                    { id: gen(), type: 'text', x: 60, y: 310, width: 385, height: 195, content: `<b style="font-size:17px;color:#065f46;">O — 機會</b><br><span style="font-size:13px;color:#475569;line-height:2;">${o}</span>`, fontSize: 13 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 495, y: 300, width: 425, height: 215, background: '#fefce8', borderRadius: 14 },
                    { id: gen(), type: 'text', x: 515, y: 310, width: 385, height: 195, content: `<b style="font-size:17px;color:#92400e;">T — 威脅</b><br><span style="font-size:13px;color:#475569;line-height:2;">${_t}</span>`, fontSize: 13 },
                ],
            };
        }

        case 'big-number':
            return {
                id: gen(), background: c.bgLight,
                elements: [
                    { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 40, content: `<b style="font-size:22px;color:${c.textDark};">${title}</b>`, fontSize: 22 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 120, y: 100, width: 720, height: 260, background: c.cardBg, borderRadius: 20 },
                    { id: gen(), type: 'text', x: 140, y: 120, width: 680, height: 120, content: `<b style="font-size:80px;color:${c.accent};text-align:center;display:block;">${data.number || content}</b>`, fontSize: 80 },
                    { id: gen(), type: 'text', x: 140, y: 240, width: 680, height: 40, content: `<span style="font-size:20px;color:${c.subtextDark};text-align:center;display:block;">${data.label || title}</span>`, fontSize: 20 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 360, y: 290, width: 240, height: 3, background: c.accent, borderRadius: 2, opacity: 0.3 },
                    { id: gen(), type: 'text', x: 120, y: 400, width: 720, height: 80, content: `<span style="font-size:15px;color:${c.subtextDark};text-align:center;display:block;line-height:1.8;">${data.description || ''}</span>`, fontSize: 15 },
                ],
            };

        case 'key-takeaway': {
            const keys = items.slice(0, 3);
            const keyColors = ['#eff6ff', '#ecfdf5', '#fefce8'];
            const keyIcons = ['looks_one', 'looks_two', 'looks_3'];
            const keyIconColors = ['#2563eb', '#059669', '#d97706'];
            return {
                id: gen(), background: c.bgLight,
                elements: [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 100, background: c.bgDark },
                    { id: gen(), type: 'text', x: 60, y: 25, width: 840, height: 50, content: `<span class="material-symbols-outlined" style="font-size:22px;color:#fbbf24;vertical-align:middle;">auto_awesome</span> <b style="font-size:26px;color:${c.textLight};vertical-align:middle;"> ${title || 'Key Takeaways'}</b>`, fontSize: 26 },
                    ...keys.flatMap((k, i) => [
                        { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 120 + i * 135, width: 840, height: 120, background: keyColors[i], borderRadius: 14 },
                        { id: gen(), type: 'text', x: 80, y: 132 + i * 135, width: 800, height: 96, content: `<span class="material-symbols-outlined" style="font-size:20px;color:${keyIconColors[i]};vertical-align:middle;">${keyIcons[i]}</span> <b style="font-size:16px;color:${c.textDark};vertical-align:middle;">${k}</b>`, fontSize: 16 },
                    ]),
                ],
            };
        }

        case 'thank-you':
            return {
                id: gen(), background: c.bgLight,
                elements: [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 180, y: 120, width: 600, height: 300, background: c.cardBg, borderRadius: 20 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 330, y: 130, width: 300, height: 4, background: c.accent, borderRadius: 2 },
                    { id: gen(), type: 'text', x: 200, y: 180, width: 560, height: 70, content: `<b style="font-size:42px;color:${c.textDark};text-align:center;display:block;">Thank You</b>`, fontSize: 42 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 380, y: 265, width: 200, height: 2, background: c.subtextLight },
                    { id: gen(), type: 'text', x: 200, y: 290, width: 560, height: 50, content: `<span style="font-size:18px;color:${c.subtextDark};text-align:center;display:block;">${content}</span>`, fontSize: 18 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 500, width: 960, height: 40, background: c.cardBg },
                ],
            };

        // fallback: content (4 variants)
        default: {
            const idx = data._index || 0;
            const variant = idx % 4;
            const rawContent = content;
            const lines = rawContent.split('<br>').filter(Boolean);
            let styledContent;
            if (lines.length > 1) {
                const first = `<b style="font-size:19px;color:${c.textDark};">${lines[0]}</b>`;
                const rest = lines.slice(1).map(l => `<span style="font-size:16px;color:${c.subtextDark};">${l}</span>`).join('<br>');
                styledContent = `<div style="line-height:2.4;">${first}<br>${rest}</div>`;
            } else {
                styledContent = `<div style="font-size:17px;color:${c.subtextDark};line-height:2.2;">${rawContent}</div>`;
            }
            const cw = data.needsVisual ? 420 : 840;
            const cardW = data.needsVisual ? 450 : 880;
            let elements;

            if (variant === 0) {
                elements = [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 90, background: c.accent },
                    { id: gen(), type: 'text', x: 50, y: 20, width: 860, height: 55, content: `<b style="font-size:30px;color:${c.textLight};">${title}</b>`, fontSize: 30, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 40, y: 110, width: cardW, height: 400, background: c.cardBg, borderRadius: 12 },
                    { id: gen(), type: 'text', x: 60, y: 125, width: cw, height: 370, content: styledContent, fontSize: 17 },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 520, width: 960, height: 20, background: c.cardBg },
                ];
            } else if (variant === 1) {
                elements = [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 60, height: 540, background: c.accent },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 60, y: 0, width: 10, height: 540, background: c.cardBg },
                    { id: gen(), type: 'text', x: 90, y: 25, width: 820, height: 55, content: `<b style="font-size:30px;color:${c.textDark};">${title}</b>`, fontSize: 30, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 90, y: 85, width: 120, height: 4, background: c.accent, borderRadius: 2 },
                    { id: gen(), type: 'text', x: 90, y: 105, width: cw, height: 400, content: styledContent, fontSize: 17 },
                ];
            } else if (variant === 2) {
                elements = [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 960, height: 140, background: c.cardBg },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 135, width: 960, height: 6, background: c.accent },
                    { id: gen(), type: 'text', x: 50, y: 40, width: 860, height: 70, content: `<b style="font-size:32px;color:${c.accent};">${title}</b>`, fontSize: 32, bold: true },
                    { id: gen(), type: 'text', x: 60, y: 165, width: cw, height: 350, content: styledContent, fontSize: 17 },
                ];
            } else {
                elements = [
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 5, height: 540, background: c.accent },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 45, y: 25, width: 5, height: 50, background: c.accent, borderRadius: 2 },
                    { id: gen(), type: 'text', x: 62, y: 28, width: 840, height: 55, content: `<b style="font-size:30px;color:${c.textDark};">${title}</b>`, fontSize: 30, bold: true },
                    { id: gen(), type: 'shape', shapeType: 'rectangle', x: 45, y: 95, width: cardW, height: 420, background: c.cardBg, borderRadius: 12 },
                    { id: gen(), type: 'text', x: 62, y: 110, width: cw, height: 390, content: styledContent, fontSize: 17 },
                ];
            }

            if (data.needsVisual) {
                elements.push({ id: gen(), type: 'shape', shapeType: 'rectangle', x: 520, y: variant === 0 ? 110 : 95, width: 400, height: variant === 0 ? 400 : 420, background: '#f8fafc', borderRadius: 12, border: '2px dashed #cbd5e1', _placeholder: 'visual' });
            }
            return { id: gen(), background: c.bgLight, elements };
        }
    }
}
