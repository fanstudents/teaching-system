/**
 * courseConfig.js — 課程資訊配置
 * 查詢 projects + project_sessions 表，fallback 到預設值
 */

export const COURSE_DEFAULTS = {
    date: '待定',
    time: '09:30 — 16:30',
    venue: '待定',
    instructor: '待定',
    organization: '',
    lineGroupUrl: 'https://lin.ee/8VAvd82',
    contactEmail: 'teacher@example.com',
    courseLink: ''
};

/**
 * 取得特定場次的課程資訊
 * @param {string} joinCode - 專案的 join code
 * @param {object} db - supabase db 模組
 * @param {string} [sessionCode] - 場次編號 (YYYYMMDD)
 * @returns {Promise<object>} 合併後的課程資訊
 */
export async function getCourseConfig(joinCode, db, sessionCode) {
    const config = { ...COURSE_DEFAULTS };

    if (!joinCode || !db) return config;

    try {
        // 1. 從 projects 取基本資料
        const { data } = await db.select('projects', {
            filter: { join_code: `eq.${joinCode}` },
            limit: 1
        });

        if (data && data.length > 0) {
            const proj = data[0];
            if (proj.name) config.courseName = proj.name;
            if (proj.course_link) config.courseLink = proj.course_link;
            if (proj.instructor) config.instructor = proj.instructor;
            if (proj.organization) config.organization = proj.organization;
            if (proj.description) config.description = proj.description;

            // 2. 如果有 sessionCode，查 project_sessions 取場次資訊
            if (sessionCode) {
                try {
                    const { data: sessions } = await db.select('project_sessions', {
                        filter: { session_code: `eq.${sessionCode}`, project_id: `eq.${proj.id}` },
                        limit: 1
                    });
                    if (sessions && sessions.length > 0) {
                        const s = sessions[0];
                        if (s.date) config.date = s.date;
                        if (s.time) config.time = s.time;
                        if (s.venue) config.venue = s.venue;
                        if (s.venue_address) config.venueAddress = s.venue_address;
                        if (s.transport_info) config.transportInfo = s.transport_info;
                        if (s.reminders) config.reminders = s.reminders;
                        if (s.group_link_url) config.groupLinkUrl = s.group_link_url;
                        if (s.group_link_label) config.groupLinkLabel = s.group_link_label;
                        if (s.group_link_icon_url) config.groupLinkIconUrl = s.group_link_icon_url;
                        config.sessionCode = s.session_code;
                    }
                } catch (e2) {
                    console.warn('[courseConfig] session fetch failed:', e2);
                }
            }
        }
    } catch (e) {
        console.warn('[courseConfig] DB fetch failed, using defaults:', e);
    }

    return config;
}
