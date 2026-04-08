-- 簡報版本歷史快照表（每個場次保留最近 30 筆）
CREATE TABLE IF NOT EXISTS slide_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES project_sessions(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    save_seq INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 0,
    slide_count INTEGER NOT NULL DEFAULT 0,
    element_count INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'auto',
    slides_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slide_snapshots_session ON slide_snapshots(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slide_snapshots_project ON slide_snapshots(project_id, created_at DESC);

ALTER TABLE slide_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_slide_snapshots" ON slide_snapshots FOR ALL USING (true) WITH CHECK (true);
