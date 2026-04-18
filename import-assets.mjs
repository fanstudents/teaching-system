/**
 * 一次性腳本：將 3 個 SVG 素材匯入 assets 資料庫
 * 用法：在瀏覽器 console 中執行，或 import 後呼叫
 */
import { db } from './scripts/supabase.js';

const assets = [
  {
    name: '計分規則',
    description: '課堂積分機制說明卡片：出席簽到、參與互動、作業繳交、冠軍獎勵，附 hover 互動動畫',
    type: 'svg',
    tags: ['計分', '規則', '教學', '互動'],
    source_url: '',
    content: SCORING_SVG,
  },
  {
    name: '服務項目總覽',
    description: '三欄深色服務卡片：AI 專家派遣、AI 內訓培育、Threads 代操，附進場動畫與 hover 效果',
    type: 'svg',
    tags: ['服務', '介紹', '卡片', '行銷'],
    source_url: '',
    content: SERVICES_SVG,
  },
  {
    name: '講師簡介 — 樊松蒲 Dennis',
    description: '講師個人檔案卡：左側深色個人資訊 + 右側 20+ 授課合作單位 Grid + 底部統計數據',
    type: 'svg',
    tags: ['講師', '簡介', '個人資料', '合作單位'],
    source_url: '',
    content: SPEAKER_SVG,
  }
];

async function importAssets() {
  for (const asset of assets) {
    try {
      const { error } = await db.insert('assets', asset);
      if (error) {
        console.error(`❌ 匯入失敗: ${asset.name}`, error);
      } else {
        console.log(`✅ 已匯入: ${asset.name}`);
      }
    } catch (e) {
      console.error(`❌ ${asset.name}:`, e);
    }
  }
  console.log('🎉 全部完成！重新整理素材庫頁面即可看到。');
}

importAssets();
