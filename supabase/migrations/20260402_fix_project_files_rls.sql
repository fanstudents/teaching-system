-- Allow anon users to read project_files (so clients can see uploaded files)
CREATE POLICY "anon_read_project_files" ON public.project_files
    FOR SELECT TO anon USING (true);

-- Also ensure the storage bucket 'outline-files' allows public read
-- (files are served via signed URLs, but listing needs RLS)
