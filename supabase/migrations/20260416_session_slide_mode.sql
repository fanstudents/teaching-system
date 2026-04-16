-- 場次層級的講義模式覆蓋
-- slide_mode: 'inherit'(繼承專案) / 'internal'(互動式) / 'external'(外部連結)
ALTER TABLE project_sessions
  ADD COLUMN IF NOT EXISTS slide_mode text DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS external_url text DEFAULT '';
