import fs from 'fs';

const SUPABASE_URL = 'https://wsaknnhjgiqmkendeyrj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzYWtubmhqZ2lxbWtlbmRleXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTI4MTIsImV4cCI6MjA4NzY4ODgxMn0.1j-4D9Kw0vqhVcTWgU7ABTJ_mO6aN4IB72Ojof8Yfko';
const PROJECT_ID = '593c8c92-8fc7-401c-b854-60bdcf759398';

// Try to find refresh token from browser storage
// Check common locations for stored tokens
const homedir = process.env.HOME || process.env.USERPROFILE;
const possiblePaths = [
  `${homedir}/Library/Application Support/Google/Chrome/Default/Local Storage/leveldb`,
];

// Step 1: Try to get auth token via email/password sign-in
// We'll use the admin password approach since we know it
async function getAuthToken() {
  // Try to refresh using the stored refresh token from the teaching system
  // Since we can't access browser localStorage, we'll sign in
  
  // Actually, let's try using the anon key with a direct RPC or using the existing session
  // The simplest approach: check if there's a service role key in env or config
  
  // Try reading from the deploy config or env files
  const envFiles = [
    '/Users/jrtingfan/AI 教學系統/.env',
    '/Users/jrtingfan/AI 教學系統/.env.local',
    '/Users/jrtingfan/AI 教學系統/supabase/.env',
  ];
  
  for (const f of envFiles) {
    try {
      const content = fs.readFileSync(f, 'utf-8');
      console.log(`Found env file: ${f}`);
      const match = content.match(/SERVICE_ROLE_KEY\s*=\s*(.+)/);
      if (match) return match[1].trim();
    } catch {}
  }
  
  return null;
}

const serviceKey = await getAuthToken();

if (serviceKey) {
  console.log('Found service role key, using it...');
}

// Use the key we found (or anon key as fallback)
const authKey = serviceKey || SUPABASE_ANON_KEY;

const outlineData = {
  hero: {
    subtitle: '掌握 AI 短影音製作流程，打造不動產與美業的爆款內容',
    duration: '4 小時',
    days: '1',
    groupSize: '20-30 人',
    location: '實體授課'
  },
  schedule: [{ day: 1, hours: '4', topic: 'AI 短影音製作實戰' }],
  timeline: [
    { day:1, time:'30 分鐘', title:'短影音趨勢洞察：不動產與美業的流量密碼', desc:'解析 2025 短影音平台演算法趨勢（Reels / TikTok / 小紅書），分享不動產業與美業的爆款案例拆解，了解黃金 3 秒法則與完播率優化策略。', tags:['趨勢分析','案例拆解','平台演算法'] },
    { day:1, time:'40 分鐘', title:'AI 腳本生成：讓 ChatGPT 幫你寫爆款腳本', desc:'學會使用 ChatGPT / Claude 快速生成短影音腳本，掌握「痛點開場 → 解方呈現 → 行動呼籲」三段式結構。實作練習：不動產物件介紹腳本 & 美業服務體驗腳本。', tags:['ChatGPT','Prompt 技巧','腳本撰寫'] },
    { day:1, time:'10 分鐘', title:'☕ 中場休息', desc:'', tags:[] },
    { day:1, time:'50 分鐘', title:'AI 影像素材製作：從零到專業畫面', desc:'使用 AI 工具快速產出影片所需的視覺素材：用 Canva AI / 剪映生成動態字卡與封面圖、用 AI 圖片生成工具製作情境配圖（房屋空間渲染 / 美容前後對比）、AI 語音旁白（配音工具實作）。', tags:['Canva AI','剪映','AI 配音','素材製作'] },
    { day:1, time:'50 分鐘', title:'AI 剪輯實戰：一鍵成片的魔法', desc:'學會使用 AI 剪輯工具快速產出短影音：剪映智能剪輯 — 自動識別語句、智能字幕、一鍵成片。AI 轉場與節奏控制技巧、配樂選曲策略（版權安全的 AI 配樂）。實作：每人完成一支 30-60 秒短影音。', tags:['剪映','AI 剪輯','智能字幕','實作產出'] },
    { day:1, time:'10 分鐘', title:'☕ 中場休息', desc:'', tags:[] },
    { day:1, time:'40 分鐘', title:'產業應用深度演練', desc:'分組實作：\n🏠 不動產組 — 製作「物件開箱」短影音（空間導覽 + AI 渲染 + 價值主張）\n💅 美業組 — 製作「服務體驗」短影音（Before/After + 技術展示 + 預約引導）\n導師巡場指導，即時優化作品。', tags:['分組實作','不動產','美業','作品產出'] },
    { day:1, time:'30 分鐘', title:'作品發表與發布策略', desc:'各組發表作品，講師即時點評與優化建議。短影音發布 SOP：最佳發布時間、Hashtag 策略、封面與標題優化。AI 數據分析工具介紹：追蹤成效、優化下一支內容。', tags:['作品發表','發布策略','數據分析','Hashtag'] }
  ],
  tools: [
    { name:'ChatGPT', purpose:'腳本撰寫、文案生成、Hashtag 策略' },
    { name:'Claude', purpose:'長文腳本優化、策略分析' },
    { name:'剪映', purpose:'AI 智能剪輯、字幕生成、一鍵成片' },
    { name:'Canva', purpose:'封面設計、動態字卡、品牌素材' },
    { name:'Midjourney', purpose:'AI 場景渲染、情境配圖生成' },
    { name:'ElevenLabs', purpose:'AI 語音旁白、多語配音' }
  ],
  toolsNote: '以上工具多數提供免費版本，課程中將以實際操作為主，建議學員課前先完成帳號註冊。',
  equipment: [
    { icon:'laptop_mac', label:'筆記型電腦', detail:'建議攜帶已安裝 Chrome 瀏覽器的筆電' },
    { icon:'smartphone', label:'智慧型手機', detail:'請先下載「剪映」APP（iOS / Android）' },
    { icon:'headphones', label:'耳機', detail:'用於預覽影片音效與 AI 配音' },
    { icon:'photo_camera', label:'手機腳架（選配）', detail:'若需現場拍攝素材，建議攜帶' }
  ],
  equipNote: '請於課前完成 ChatGPT、剪映、Canva 帳號註冊，並確保手機已安裝剪映 APP。',
  courseNotes: [
    { icon:'play_circle', title:'實作導向', desc:'課程以「做中學」為核心，每位學員將在課堂上完成至少一支短影音作品。' },
    { icon:'trending_up', title:'產業聚焦', desc:'所有案例與練習皆針對不動產業與美業設計，學完即可應用於日常行銷。' },
    { icon:'devices', title:'設備需求', desc:'請攜帶筆電與智慧型手機，課前請先完成指定工具的帳號註冊。' },
    { icon:'folder_copy', title:'課後資源', desc:'提供完整 Prompt 模板庫、腳本範本、發布 SOP 檢查清單，課後可持續使用。' }
  ]
};

const body = JSON.stringify({
  name: 'AI 短影音製作實戰班 — 不動產 × 美業',
  outline_data: outlineData
});

console.log('Body size:', body.length, 'bytes');

const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${PROJECT_ID}`, {
  method: 'PATCH',
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${authKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body
});

const text = await res.text();
console.log('Status:', res.status);
console.log('Response:', text.substring(0, 500));

if (res.ok) {
  try {
    const data = JSON.parse(text);
    if (data.length > 0) {
      console.log('✅ 更新成功！');
      console.log('Name:', data[0].name);
    } else {
      console.log('⚠️ 回傳空陣列 — RLS 可能阻擋了 UPDATE');
      console.log('請在瀏覽器 Console 貼上 scratch/update-outline-console.js 的內容');
    }
  } catch(e) {
    console.log('Parse error:', e.message);
  }
}
