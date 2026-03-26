-- checklist_items 新增 icon_url 欄位
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS icon_url text DEFAULT '';
