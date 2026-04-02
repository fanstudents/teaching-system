-- 新增缺少的課程到 affiliate_courses
INSERT INTO public.affiliate_courses (name, url, platform, icon, sort_order, description, instructor)
VALUES (
    '社會新鮮人的第一堂求職課：23堂履歷面試快速上手秘笈',
    'https://tbr.digital/courses/jobreadyguide',
    'tbr',
    'work',
    16,
    '從 0 到 Offer：履歷、面試、作品集一次搞定！贈：面試50＋題庫及解答、中英文履歷模板、個人作品集模板、簡報面試模板',
    'Coco'
)
ON CONFLICT DO NOTHING;
