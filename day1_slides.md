slide: cover

# AI 辦公室全方位應用班
*講師：樊松蒲 Dennis ｜ 2026.03.29（六）09:00 – 17:00*

---
slide: content

## 今日學習地圖

- **上午** → AI 工具全面實戰（ChatGPT / Gemini / Claude / Perplexity）
- **中午前** → NotebookLM 知識管理與競品分析
- **下午** → AI 個人助手 ＋ AI 簡報設計 ＋ Notion AI
- **最後** → Make 自動化工作流 ＋ 綜合實作

---
slide: content

## 時間表一覽

- **09:00 – 09:15** ｜ 課程開場與學習目標
- **09:15 – 09:25** ｜ AI 使用前置作業
- **09:25 – 10:25** ｜ AI 應用功能（上半場）
- **10:35 – 11:35** ｜ AI 應用功能（下半場）
- **11:35 – 12:25** ｜ NotebookLM 知識管理
- **13:25 – 13:55** ｜ 打造 AI 個人助手
- **13:55 – 14:55** ｜ AI 簡報設計
- **14:55 – 15:20** ｜ Notion AI ＋ Make 安裝
- **15:20 – 16:20** ｜ Make 自動化工作流實戰
- **16:20 – 17:00** ｜ 綜合實作與成果分享

---
slide: section

# 第一章
## 課程開場與學習目標
*09:00 – 09:15（15 分鐘）*

---
slide: content

## 今天要帶走的三個能力

1. **判斷力** — 知道什麼任務該用哪個 AI 工具最快最好
2. **實作力** — 每個主題都有 hands-on 練習，回去馬上能用
3. **自動化力** — 建立 Make 工作流，讓 AI 幫你 24 小時工作

---
slide: content

## AI 在企業的四大應用場景

- **行銷推廣** → 社群貼文、EDM 文案、產品介紹影片腳本
- **營運優化** → 客服自動回覆、SOP 文件生成、流程自動化
- **產品開發** → 競品分析報告、PRD 撰寫、使用者訪談摘要
- **內部協作** → 會議紀錄、知識庫建置、跨部門報告彙整

:::poll
question: 你的部門最需要 AI 協助的場景是？
options:
  - 行銷推廣
  - 營運優化
  - 產品開發
  - 內部協作
  - 其他
:::

---
slide: content

## 你目前的 AI 使用狀態？

:::icebreaker
question: 用一句話形容你目前使用 AI 的狀態
:::

---
slide: section

# 第二章
## AI 使用前置作業
*09:15 – 09:25（10 分鐘）*

---
slide: content

## AI 的三大使用原則

1. **不盲信** → AI 會幻想（Hallucination），關鍵數據一定要交叉驗證
2. **不洩密** → 不要把客戶機密資料、個資直接貼給公開 AI
3. **要給情境** → AI 不是通靈，你給的背景越多，產出越精準

---
slide: content

## 確認你的工具清單

- ✅ **ChatGPT** → chat.openai.com（建議 Plus 版）
- ✅ **Gemini** → gemini.google.com（Google 帳號登入）
- ✅ **Claude** → claude.ai（需另外註冊）
- ✅ **Perplexity** → perplexity.ai（可免費使用）
- ✅ **NotebookLM** → notebooklm.google.com

:::truefalse
question: AI 產出的所有內容都可以直接拿來用，不需要人工確認
answer: false
:::

---
slide: content

## 提示工程的基本框架

- **角色（Role）** → 「你是一位資深的 HR 系統產品經理」
- **情境（Context）** → 「公司正在準備新一季的客戶提案」
- **任務（Task）** → 「請幫我撰寫一份產品優勢比較表」
- **格式（Format）** → 「用 Markdown 表格、繁體中文」
- **限制（Constraint）** → 「控制在 500 字內、語氣專業」

---
slide: section

# 第三章
## AI 應用功能（上半場）
*09:25 – 10:25（60 分鐘）*

---
slide: content

## 四大 AI 模型 — 各有絕活

- **ChatGPT（OpenAI）** → 生態系最大、外掛最多、圖片生成最強
- **Gemini（Google）** → 深度整合 Google 服務、搜尋資料即時引用
- **Claude（Anthropic）** → 長文理解之王（20 萬字）、程式碼品質最高
- **Perplexity** → 即時搜尋型 AI、自動附來源連結、適合研究調查

---
slide: content

## ChatGPT 的企業應用場景

- **文案生成** → 社群貼文、產品介紹、Email 模板
- **圖片生成（DALL-E）** → 行銷素材、活動海報、概念圖
- **GPTs 自訂助手** → 客服 FAQ Bot、新人 Onboarding 助手
- **程式碼輔助** → Excel VBA、Google Apps Script
- **數據分析** → 上傳 CSV/Excel 直接出圖表分析

---
slide: content

## 實作練習：ChatGPT 文案生成

:::copycard
title: 練習一：產品推廣文案
content: |
  請在 ChatGPT 輸入以下 Prompt：

  角色：你是飛騰雲端的行銷專員
  任務：請為我們的 HR 系統寫一則 LinkedIn 推廣貼文
  情境：新功能上線——AI 自動排班系統
  格式：包含吸引眼球的開頭、3 個產品亮點、CTA
  限制：200 字以內、語氣專業但親切

  👉 完成後比較 ChatGPT vs Gemini vs Claude 的差異
:::

---
slide: content

## Gemini 的獨家優勢

- **Google 生態整合** → 直接分析 Google Docs / Sheets / Slides
- **即時搜尋** → 回答都會附上最新網頁來源
- **多模態** → 支援圖片、影片、音檔分析
- **Gems 客製助手** → 類似 GPTs，預設角色與知識庫
- **免費額度大方** → Gemini Advanced 功能也很完整

---
slide: content

## Claude 的三個殺手級功能

1. **超長上下文窗口（200K tokens）** → 一次丟 20 萬字的文件進去
2. **Artifacts 功能** → 邊對話邊產出可編輯的文件/程式碼
3. **Projects 專案模式** → 上傳公司文件作為知識庫，所有對話共用

---
slide: content

## Perplexity — 研究調查神器

- **即時搜尋** → 回答永遠是最新的（非訓練資料）
- **來源引用** → 每段回答都標註來源連結
- **Focus 模式** → Academic / Writing / Math 等專項模式
- **適用場景** → 競品調研、市場分析、技術方案比較

---
slide: content

## 四大工具怎麼選？

- **寫文案 / 做圖** → ChatGPT（生態系最完整）
- **搜最新資料** → Perplexity（來源最透明）
- **讀長文件** → Claude（一次讀 20 萬字）
- **Google 生態整合** → Gemini（直接連 Sheets/Docs）
- **程式碼** → Claude > ChatGPT > Gemini

:::quiz
question: 你需要分析一份 50 頁的競品報告並產出摘要，首選哪個 AI？
options:
  - ChatGPT
  - Gemini
  - Claude ✓
  - Perplexity
:::

---
slide: content

## 進階提示技巧① — Few-shot 範例法

- 不只告訴 AI「做什麼」，還要給它「好的範本」
- 特別適合：統一語氣、固定格式、品牌調性

:::copycard
title: Few-shot 範例 Prompt
content: |
  以下是兩個好的客戶回覆範例：

  範例 1：「您好，感謝您的來信。關於您提到的排班問題，
  我們的系統已在 3.2 版新增 AI 自動排班功能…」

  範例 2：「非常感謝您的回饋！我已將您的建議轉達給
  產品團隊，預計下一季度會納入開發計畫中…」

  請用同樣的語氣和格式，回覆以下客戶問題：
  「請問貴系統是否支援多國語系？」
:::

---
slide: content

## 進階提示技巧② — Chain of Thought

- 讓 AI **一步一步思考**，而不是直接給答案
- 加上「請一步步分析」或「Let's think step by step」

:::copycard
title: COT 範例
content: |
  Prompt：
  「我想要用 AI 為公司建立客服自動回覆系統。
  請一步步分析：
  1. 需要哪些前置準備？
  2. 有哪些技術方案？
  3. 各方案的優缺點？
  4. 你推薦哪個方案？為什麼？」

  👉 試試看加和不加 COT 的差異
:::

---
slide: content

## 進階提示技巧③ — 角色扮演法

- 讓 AI 扮演特定專業角色，產出更精準
- 不同角色 = 不同思考維度

:::copycard
title: 多角色分析 Prompt
content: |
  「請分別用以下三個角色來分析我們公司
  是否該導入 AI 客服系統：

  角色 1：IT 部門主管（技術可行性）
  角色 2：財務長（成本效益分析）
  角色 3：客服部門經理（實際使用體驗）

  請三個角色各給 3 個觀點。」
:::

---
slide: content

## 實作時間：模型大對決

:::copycard
title: 練習二：四個 AI 同題 PK
content: |
  題目：「請為 HR 系統商撰寫一封給潛在客戶的
  初次接觸 Email，重點介紹 AI 自動排班功能。
  字數 150 字內、語氣友善專業。」

  步驟：
  1. 同一個 Prompt 分別貼到 ChatGPT、Gemini、Claude、Perplexity
  2. 比較四份產出的差異
  3. 選出你覺得最好的一份
  4. 思考：為什麼這份最好？

  ⏰ 練習時間：8 分鐘
:::

:::poll
question: 哪個 AI 的 Email 文案你最滿意？
options:
  - ChatGPT
  - Gemini
  - Claude
  - Perplexity
:::

---
slide: section

# ☕ 休息時間
*10:25 – 10:35（10 分鐘）*

---
slide: section

# 第四章
## AI 應用功能（下半場）
*10:35 – 11:35（60 分鐘）*

---
slide: content

## 本地檔案 × AI 的無限可能

- **文件類** → PDF / Word / Excel / CSV 上傳分析
- **圖片類** → 圖片辨識、OCR 文字擷取、圖片生成
- **影片類** → 影片內容摘要、字幕生成
- **音檔類** → 語音轉文字、會議錄音摘要、Podcast

---
slide: content

## PDF / Word 文件分析

- **ChatGPT** → 直接拖拉上傳 → 自動解析 → 問答
- **Claude** → Projects 功能 → 上傳多份文件建立知識庫
- **Gemini** → 整合 Google Drive → 直接分析雲端文件

:::copycard
title: 練習三：文件摘要
content: |
  1. 找一份公司的產品規格書或提案文件（PDF/Word）
  2. 上傳到 Claude
  3. 輸入 Prompt：
     「請用 5 個重點摘要這份文件的核心內容，
     並指出 3 個可能的改進建議。」
  4. 再問：「請以客戶的角度，列出 5 個可能會問的問題。」

  ⏰ 練習時間：8 分鐘
:::

---
slide: content

## Excel / CSV 數據分析

- **ChatGPT** → 上傳 Excel/CSV → 自動生成圖表 + 洞見
- **Gemini** → 直接連結 Google Sheets → 即時分析
- **場景舉例** →
  - 銷售報表 → 找出業績下降的品項
  - 客戶資料 → 分類分群、找出高價值客戶特徵
  - 員工資料 → 離職率分析、薪資比較

:::copycard
title: 練習四：數據分析
content: |
  1. 準備一份 Excel 或 CSV 檔案（銷售報表、客戶清單等）
  2. 上傳到 ChatGPT
  3. Prompt：「請分析這份數據，告訴我：
     ① 整體趨勢 ② 值得關注的異常 ③ 三個行動建議」
  4. 追問：「請用圖表呈現最重要的發現」

  ⏰ 練習時間：8 分鐘
:::

---
slide: content

## 圖片 AI 應用

- **圖片辨識** → 上傳產品照 → AI 描述內容、產出文案
- **OCR 擷取** → 名片、發票、手寫筆記 → 自動轉文字
- **圖片生成** → ChatGPT DALL-E、Gemini Imagen
- **圖片編輯** → ChatGPT 可直接修改已生成圖片的細節

---
slide: content

## 實作：圖片辨識 + 文案生成

:::copycard
title: 練習五：看圖寫文案
content: |
  1. 用手機拍一張辦公室的照片（或產品照片）
  2. 上傳到 ChatGPT
  3. Prompt：
     「這是我們公司的 [場景]。
     請根據這張照片：
     ① 寫一則 Instagram 貼文（50 字內）
     ② 設計 3 個適合的 Hashtag
     ③ 建議這張照片可以用在哪些行銷場景」

  ⏰ 練習時間：5 分鐘
:::

---
slide: content

## 影片與音檔的 AI 處理

- **Gemini** → 直接上傳影片 → 摘要 + 問答
- **ChatGPT** → 語音模式 → 即時對話
- **NotebookLM** → 上傳音檔 → 轉文字 → 智能問答
- **企業場景** →
  - 會議錄影 → 自動產出紀要
  - 教育訓練影片 → 產出重點整理
  - 客戶訪談錄音 → 需求分析

---
slide: content

## AI 多模態應用總結

:::quiz
question: 以下哪個場景最適合用 Gemini 而非 ChatGPT？
options:
  - 生成產品海報
  - 分析 Google Sheets 上的銷售數據 ✓
  - 撰寫產品文案
  - 生成程式碼
:::

:::wordcloud
question: 今天學到的 AI 工具中，你覺得哪一個對你的工作最有用？
:::

---
slide: section

# 第五章
## NotebookLM 知識管理與競品分析
*11:35 – 12:25（50 分鐘）*

---
slide: content

## NotebookLM 是什麼？

- **Google 打造的 AI 知識管理工具** → notebooklm.google.com
- **核心概念** → 上傳你的文件 → AI 只根據你的資料回答
- **不會幻想** → 因為所有回答都來自你上傳的資料
- **來源標註** → 每個回答都標出是從哪份文件、哪個段落來的

---
slide: content

## NotebookLM 的特殊功能

1. **Smart Note** → AI 自動擷取文件重點、生成摘要
2. **Audio Overview** → 把文件自動轉成 Podcast 對話
3. **交叉引用** → 跨多份文件比較、找出關聯
4. **結構化輸出** → 時間軸、FAQ、學習指南等格式

---
slide: content

## 企業應用場景

- **產品知識庫** → 上傳所有產品文件 → 業務隨時查詢規格
- **競品分析** → 上傳競品資料 → AI 產出比較表
- **新人 Onboarding** → 上傳公司制度文件 → 新人自助問答
- **法規遵循** → 上傳法規文件 → 快速查詢適用條款
- **客戶提案** → 上傳客戶需求 → 自動匹配解決方案

---
slide: content

## 實作：建立公司知識庫

:::copycard
title: 練習六：NotebookLM 知識庫
content: |
  Step 1：前往 notebooklm.google.com
  Step 2：建立新 Notebook
  Step 3：上傳 2-3 份公司文件
         （產品規格書、客戶案例、競品資料）
  Step 4：等待 AI 處理完成
  Step 5：試問以下問題：
    - 「我們產品和競品最大的差異是什麼？」
    - 「整理一份產品功能比較表」
    - 「如果客戶問 XXX，我應該怎麼回答？」
  Step 6：嘗試生成 Audio Overview

  ⏰ 練習時間：15 分鐘
:::

---
slide: content

## 競品分析報告生成

:::copycard
title: 練習七：AI 競品分析
content: |
  1. 在 NotebookLM 上傳 2-3 份競品資料
     （官網截圖、新聞報導、產品比較都行）

  2. 請 AI 產出：
     ① 功能比較表（用表格呈現）
     ② SWOT 分析
     ③ 我們的差異化優勢
     ④ 給業務團隊的 Talking Points

  3. 複製結果到 Notion 或 Google Docs 保存

  ⏰ 練習時間：12 分鐘
:::

---
slide: content

## NotebookLM vs Claude Projects

- **NotebookLM** → 來源透明、PDF 支援好、免費、Audio 功能
- **Claude Projects** → 上下文更長、對話更自然、可串聯編輯
- **建議** → 研究調查型用 NotebookLM、內容產出型用 Claude

:::quiz
question: 你需要把公司的 10 份產品文件整理成業務 FAQ，首選？
options:
  - ChatGPT
  - NotebookLM ✓
  - Perplexity
  - Gemini
:::

---
slide: section

# 🍱 午餐休息
*12:25 – 13:25（60 分鐘）*

---
slide: section

# 第六章
## 打造 AI 個人助手
*13:25 – 13:55（30 分鐘）*

---
slide: content

## 什麼是 AI 個人助手？

- **概念** → 預設好角色、知識、回覆風格的專屬 AI
- **Gemini Gems** → Google 版本，整合 Google 生態
- **ChatGPT GPTs** → OpenAI 版本，可發佈到 GPT Store
- **核心價值** → 一次設定，永久使用；團隊共享，品質一致

---
slide: content

## 個人助手的企業應用

- **客服助手** → 預載 FAQ + 回覆範本 → 3 秒產出專業回覆
- **行銷助手** → 預載品牌指南 → 文案風格永遠一致
- **業務助手** → 預載產品資料 → 客戶問什麼都能答
- **HR 助手** → 預載公司制度 → 員工自助查詢假勤規定

---
slide: content

## 實作：建立你的第一個 Gem

:::copycard
title: 練習八：Gemini Gems 建立
content: |
  Step 1：開啟 Gemini → 側欄 → Gems → 建立新 Gem
  Step 2：輸入名稱（例如：「產品顧問小幫手」）
  Step 3：設定 System Prompt：

  「你是飛騰雲端的資深產品顧問。
  你的任務是協助業務團隊回答客戶問題。
  回覆原則：
  1. 語氣友善專業
  2. 先確認客戶需求再推薦方案
  3. 回答控制在 200 字以內
  4. 如果不確定的資訊要明確標註」

  Step 4：上傳產品資料作為知識 (選填)
  Step 5：測試對話 → 調整 Prompt

  ⏰ 練習時間：10 分鐘
:::

---
slide: content

## Gem / GPTs 的設計技巧

1. **明確角色定義** → 不只說「你是助手」，要說清楚專業領域
2. **限制回覆邊界** → 「如果使用者問與產品無關的問題，請導回主題」
3. **指定語氣** → 提供 2-3 個範例回覆讓 AI 模仿
4. **加入知識** → 上傳公司文件、FAQ、SOP 作為參考
5. **測試邊界** → 故意問奇怪的問題，看看 AI 怎麼應對

---
slide: section

# 第七章
## AI 簡報設計
*13:55 – 14:55（60 分鐘）*

---
slide: content

## AI 簡報工具比較

- **Gamma** → 一段文字 → 完整簡報，最快最省力
- **Canva AI（Magic Design）** → 模板 + AI 填充，設計感最好
- **ChatGPT → PPT** → 先用 AI 產出大綱 → 手動製作
- **Google Slides + Gemini** → 整合 Workspace，企業適用

---
slide: content

## Gamma — 30 秒做完一份簡報

1. **前往 gamma.app** → 免費註冊
2. **選「Generate」** → 貼上你的主題或文字
3. **AI 自動生成** → 包含排版、圖片、動畫
4. **可匯出** → PDF / PPT / 分享連結
5. **適用場景** → 快速提案、內部報告、概念發想

---
slide: content

## 實作：Gamma 快速簡報

:::copycard
title: 練習九：用 Gamma 生成簡報
content: |
  Step 1：前往 gamma.app 並登入
  Step 2：點擊「Generate」
  Step 3：輸入主題（選一個）：
    a. 「AI 如何提升 HR 系統的客戶滿意度」
    b. 「2026 年企業必備的 5 個 AI 工具」
    c. 「新人 Onboarding 流程優化提案」
  Step 4：選擇風格（建議選 Professional）
  Step 5：等待生成 → 檢視 → 微調
  Step 6：匯出 PDF 或分享連結

  ⏰ 練習時間：10 分鐘
:::

---
slide: content

## Canva AI — 設計感滿分的簡報

1. **Magic Design** → 上傳圖片或輸入文字 → AI 自動設計
2. **Magic Write** → AI 幫你寫文案、標題、重點
3. **Magic Animate** → 自動加入轉場動畫
4. **Brand Kit** → 上傳公司品牌資產 → 一鍵套用

:::copycard
title: 練習十：Canva AI 簡報
content: |
  Step 1：前往 canva.com → 建立簡報
  Step 2：試用「Magic Design」→ 輸入主題
  Step 3：選擇模板 → AI 自動填入內容
  Step 4：使用「Magic Write」修改任一頁的文案
  Step 5：套用「Magic Animate」動畫效果
  Step 6：比較 Gamma 和 Canva 的產出差異

  ⏰ 練習時間：10 分鐘
:::

---
slide: content

## AI 簡報的最佳工作流

1. **第一步：AI 產大綱** → 用 Claude/ChatGPT 整理簡報結構
2. **第二步：AI 生成初版** → 用 Gamma 快速產出
3. **第三步：人工優化** → 品牌色、公司 Logo、關鍵數據校正
4. **第四步：設計加分** → 用 Canva 重新排版關鍵頁面
5. **第五步：最終檢查** → AI 校稿 + 人工確認

:::poll
question: 以下哪個 AI 簡報工具你最想深入學習？
options:
  - Gamma
  - Canva AI
  - Google Slides + Gemini
  - ChatGPT 直接產 PPT
:::

---
slide: section

# 第八章
## Notion AI 會議記錄
*14:55 – 15:10（15 分鐘）*

---
slide: content

## Notion AI 的會議記錄神功

- **會議前** → 自動從行事曆建立會議筆記模板
- **會議中** → 即時記錄重點（手打 or 語音）
- **會議後** → AI 一鍵生成：
  - ✅ 會議摘要
  - ✅ 行動項目（誰做什麼、何時完成）
  - ✅ 決策紀錄
  - ✅ 下次會議議程建議

---
slide: content

## 會議紀錄的 AI 模板

:::copycard
title: Notion AI 會議紀錄 Prompt
content: |
  在 Notion 頁面中，會議結束後選取筆記內容，
  點擊「Ask AI」然後輸入：

  「請將上方會議紀錄整理為以下格式：
  1. 📋 會議摘要（3 句話）
  2. ✅ 行動項目（表格：負責人/任務/截止日）
  3. 📌 關鍵決策
  4. ❓ 待確認事項
  5. 📅 下次會議建議議程」

  💡 建議存成 Notion 模板，以後每場會議都用
:::

---
slide: section

# 第九章
## Make 自動化工作流
*15:10 – 16:20（70 分鐘）*

---
slide: content

## Make 是什麼？

- **視覺化自動化工具** → 像畫流程圖一樣串接各種雲端服務
- **不用寫程式** → 拖拉設定就行
- **免費額度** → 每月 1,000 次操作免費
- **支援 1,000+ 應用** → Google Sheets、Slack、Email、OpenAI…

---
slide: content

## Make 的核心概念

- **Scenario（場景）** → 一個自動化流程
- **Module（模組）** → 每個節點代表一個動作（如：讀取表格、呼叫 AI）
- **Trigger（觸發器）** → 什麼時候啟動（新資料、定時排程）
- **Connection（連線）** → 授權 Make 存取你的 Google / OpenAI 帳號

---
slide: content

## Make 安裝與帳號設定

:::copycard
title: Make 帳號設定步驟
content: |
  Step 1：前往 make.com → 註冊帳號
  Step 2：選擇 Free Plan（每月 1,000 ops）
  Step 3：進入 Dashboard
  Step 4：建立「Connection」→ Google 帳號
  Step 5：建立「Connection」→ OpenAI API Key
         （如果有的話，沒有也 OK，講師會示範）

  ⚠️ 注意：Google 連線授權時，請勾選所有 Google Sheets 權限
:::

---
slide: content

## 實作工作流 ①：表單回覆 → AI 分析 → Email 通知

- **場景** → 客戶填了滿意度問卷 → AI 自動分析情緒 → 通知業務
- **流程** →
  1. Google Sheets 新增一列（觸發）
  2. 讀取內容 → 傳給 OpenAI
  3. AI 分析情緒 + 建議回覆
  4. 寄 Email 給負責業務

---
slide: content

## 實作工作流 ①：Step by Step

:::copycard
title: Make 實作一
content: |
  Step 1：Create Scenario → 搜尋「Google Sheets」
  Step 2：選「Watch New Rows」→ 連接你的 Google 帳號
  Step 3：選擇一個表格（或建立新表格，欄位：姓名、回饋內容）
  Step 4：加入「OpenAI」模組 → Create a Completion
         Prompt：「分析以下客戶回饋的情緒是正面/中立/負面，
         並建議一句回覆：{{回饋內容}}」
  Step 5：加入「Email」模組 → 收件人填自己
         Subject：「客戶回饋通知 - {{姓名}}」
         Body：AI 分析結果
  Step 6：Run once → 在表格加一列測試資料 → 確認收到 Email

  ⏰ 練習時間：15 分鐘
:::

---
slide: content

## 實作工作流 ②：定時摘要 → Slack / Email

- **場景** → 每週五下午自動彙整本週客戶回饋，寄摘要報告
- **流程** →
  1. 定時排程（每週五 17:00）
  2. 讀取 Google Sheets 本週資料
  3. OpenAI 產出週報摘要
  4. 寄信 or 發 Slack 訊息

---
slide: content

## 實作工作流 ②：Step by Step

:::copycard
title: Make 實作二
content: |
  Step 1：Create Scenario → 搜尋「Schedule」
  Step 2：設定每週五 17:00 觸發
  Step 3：加入「Google Sheets - Search Rows」
         篩選條件：日期 >= 本週一
  Step 4：加入「Array Aggregator」→ 合併所有列
  Step 5：加入「OpenAI」→ Prompt：
         「以下是本週的客戶回饋清單，
         請整理成一份週報摘要，包含：
         ① 整體評價 ② 主要正面回饋 ③ 需改善項目 ④ 建議行動」
  Step 6：加入 Email 模組 → 寄給主管

  ⏰ 練習時間：15 分鐘
:::

---
slide: content

## 實作工作流 ③：自動內容生成

- **場景** → Google Sheets 填入主題 → AI 自動產出社群貼文 → 存回表格
- **流程** →
  1. 表格新增一列（欄位：主題、產品、目標受眾）
  2. OpenAI 產出 LinkedIn 貼文
  3. 結果寫回同一列的「文案」欄位

:::copycard
title: Make 實作三
content: |
  Step 1：建立 Google Sheets，欄位：
         A 主題 / B 產品名 / C 目標受眾 / D AI 文案（空的）
  Step 2：Create Scenario → Watch New Rows
  Step 3：OpenAI → Prompt：
         「主題：{{A}}、產品：{{B}}、受眾：{{C}}
         請產出一則 LinkedIn 貼文，150 字內，
         包含吸睛開頭、3 個亮點、CTA。」
  Step 4：Google Sheets → Update Row → 寫入 D 欄
  Step 5：測試：在表格加一列 → 看 D 欄是否自動填入

  ⏰ 練習時間：12 分鐘
:::

---
slide: content

## Make 自動化的延伸應用

- **HR** → 新人報到表單 → 自動寄歡迎信 + 建立帳號清單
- **業務** → CRM 新增客戶 → AI 生成個人化開發信
- **客服** → 表單收到問題 → AI 分類 + 派工 + 自動回覆
- **行銷** → RSS 抓競品新聞 → AI 摘要 → Slack 通知

:::quiz
question: Make 的免費方案每月可執行多少次操作？
options:
  - 100 次
  - 500 次
  - 1,000 次 ✓
  - 5,000 次
:::

---
slide: section

# 第十章
## 綜合實作與成果分享
*16:20 – 17:00（40 分鐘）*

---
slide: content

## 綜合實作任務

- **目標** → 整合今天學的所有工具，解決一個實際業務問題
- **時間** → 25 分鐘實作 + 15 分鐘分享
- **形式** → 個人或 2-3 人小組

---
slide: content

## 三大場景任選一個

1. **行銷場景** → 為新功能製作完整行銷素材
   - AI 寫文案 + Gamma 做簡報 + Make 自動發佈
2. **營運場景** → 建立客服自動化系統
   - NotebookLM 建知識庫 + Gem 做客服助手 + Make 自動通知
3. **產品場景** → 完成一份競品分析提案
   - NotebookLM 分析競品 + Claude 寫報告 + Canva 做簡報

:::copycard
title: 綜合實作指引
content: |
  Step 1：選擇場景（行銷/營運/產品）
  Step 2：確認要用哪些工具（至少 3 個）
  Step 3：25 分鐘內完成一個可展示的成果
  Step 4：準備 2 分鐘分享：
    - 用了哪些工具？
    - 解決了什麼問題？
    - 回去可以怎麼延伸？

  ⏰ 實作時間：25 分鐘
:::

---
slide: content

## 成果分享時間

:::opentext
question: 你今天做了什麼成果？用了哪些工具？
:::

---
slide: content

## 今日重點回顧

- ✅ **四大 AI 工具** → 各有強項，選對工具事半功倍
- ✅ **提示工程** → 角色 + 情境 + 任務 + 格式 + 限制
- ✅ **NotebookLM** → 公司知識庫 + 競品分析神器
- ✅ **AI 個人助手** → 一次設定、永久使用
- ✅ **AI 簡報** → Gamma 快速生成 + Canva 精緻設計
- ✅ **Make 自動化** → 三個工作流模板帶回去直接用

---
slide: content

## 回去可以馬上做的三件事

1. **建立一個 Gem** → 給自己的部門建一個 AI 助手
2. **設定一個 Make 工作流** → 自動化一個重複性工作
3. **用 NotebookLM 建知識庫** → 把常用文件全部丟進去

:::scale
question: 今天的課程對你的工作幫助程度？
min: 1
max: 5
:::

:::wordcloud
question: 用一個詞形容今天的學習感受
:::

---
slide: thank-you

# 謝謝大家！
## Day 1 完成 🎉
*明天 Day 2 見！*
