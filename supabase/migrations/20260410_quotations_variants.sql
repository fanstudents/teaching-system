-- ============================================================
-- 報價單 - 多方案支援 Migration
-- ============================================================

-- 新增 variants JSONB 欄位 (陣列，每個元素含 name, outline_data, items, total)
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT NULL;

-- 客戶選了哪個方案 (0-based index)
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS selected_variant integer DEFAULT NULL;

-- 備註：
-- variants 結構範例：
-- [
--   {
--     "name": "方案 A：基礎培訓",
--     "items": [{"label":"講師費","type":"hourly","hours":3,"rate":8000}],
--     "total": 24000,
--     "outline_data": { ... 跟 projects.outline_data 一樣的格式 ... }
--   },
--   {
--     "name": "方案 B：進階培訓",
--     "items": [{"label":"講師費","type":"hourly","hours":6,"rate":8000}],
--     "total": 48000,
--     "outline_data": { ... }
--   }
-- ]
--
-- 當 variants 為 NULL 時，使用原本的 items + project.outline_data（向後相容）
-- 當 variants 有值時，前端顯示 Tab 切換

DO $$ BEGIN RAISE NOTICE '✅ quotations variants 欄位新增完成'; END $$;
