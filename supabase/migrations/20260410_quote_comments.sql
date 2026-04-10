-- Quote Comments: 客戶對課綱區塊的留言/建議
CREATE TABLE IF NOT EXISTS quote_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    block_index INTEGER NOT NULL,
    block_title TEXT DEFAULT '',
    comment_text TEXT NOT NULL,
    commenter_name TEXT DEFAULT '客戶',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quote_comments_quotation ON quote_comments(quotation_id);

-- RLS
ALTER TABLE quote_comments ENABLE ROW LEVEL SECURITY;

-- anon 可讀寫（客戶端不需登入）
CREATE POLICY "anon_read_comments" ON quote_comments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_comments" ON quote_comments FOR INSERT TO anon WITH CHECK (true);

-- authenticated 全權限
CREATE POLICY "auth_all_comments" ON quote_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
