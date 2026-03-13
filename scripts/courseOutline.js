/**
 * Course Outline — Client-side Logic
 * 動態架構：URL ?session=xxx → 從 DB 載入 session → project → organization
 * Admin: ?admin=1 → 管理面板（學員、講師、客戶）
 */

import { db, storage } from './supabase.js';

// ── State ──
let sessionData = null;   // project_sessions record
let projectData = null;   // projects record
let orgData = null;       // organizations record
let currentUser = null;   // logged-in student or admin
let isAdmin = false;
let students = [];
let uploadedFiles = [];
const ADMIN_PASSWORD = 'admin2026';

// ── DOM Ready ──
document.addEventListener('DOMContentLoaded', init);

async function init() {
    const params = new URLSearchParams(location.search);
    isAdmin = params.get('admin') === '1';
    const sessionCode = params.get('session') || '';

    // Load session → project → org chain
    if (sessionCode) {
        await loadSessionChain(sessionCode);
    }

    // Apply dynamic data to page
    renderDynamicContent();

    // Check saved session
    const saved = sessionStorage.getItem('outline_user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            enterPage();
            return;
        } catch(e) { /* ignore */ }
    }
    setupLoginForm();
}

async function loadSessionChain(code) {
    // 1. Load session
    const { data: sessions } = await db.select('project_sessions', `session_code=eq.${encodeURIComponent(code)}&select=*`);
    if (sessions?.length) {
        sessionData = sessions[0];
        // 2. Load project
        const { data: projects } = await db.select('projects', `id=eq.${sessionData.project_id}&select=*`);
        if (projects?.length) {
            projectData = projects[0];
            // 3. Load organization
            if (projectData.organization_id) {
                const { data: orgs } = await db.select('organizations', `id=eq.${projectData.organization_id}&select=*`);
                if (orgs?.length) orgData = orgs[0];
            }
        }
    }
}

function renderDynamicContent() {
    // Client logo
    const clientLogo = orgData?.logo_url || 'assets/images/clients/epoch-foundation.png';
    const clientName = orgData?.name || '時代基金會';
    document.querySelectorAll('.client-logo').forEach(el => { el.src = clientLogo; el.alt = clientName; });

    // Hero badge
    const badgeEl = document.getElementById('heroBadge');
    if (badgeEl) badgeEl.textContent = `${clientName} · 企業內部培訓`;

    // Course name
    const courseName = projectData?.name || 'AI 辦公室應用實戰班';
    const heroTitle = document.getElementById('heroTitle');
    if (heroTitle) heroTitle.textContent = courseName;
    document.title = `課程規劃大綱 — ${courseName}`;

    // Admin mode adjustments
    if (isAdmin) {
        document.getElementById('loginTitle').textContent = '管理端登入';
        document.getElementById('loginSubtext').textContent = '輸入管理密碼以進入管理面板';
        const userField = document.getElementById('loginUser');
        userField.placeholder = '管理密碼';
        userField.type = 'password';
        document.querySelector('#fieldEmail .material-symbols-outlined').textContent = 'key';
        document.getElementById('fieldPassword').style.display = 'none';
        document.getElementById('loginPass').removeAttribute('required');
    }
}

function enterPage() {
    const overlay = document.getElementById('loginOverlay');
    const content = document.getElementById('pageContent');
    overlay.classList.add('fade-out');
    content.style.display = 'block';
    setTimeout(() => overlay.style.display = 'none', 400);

    if (isAdmin && currentUser._isAdmin) {
        document.getElementById('adminPanel').classList.add('show');
        document.getElementById('studentView').style.display = 'none';
        loadStudents();
        loadInstructors();
        loadOrganizations();
    } else {
        loadUploadedFiles();
    }
    updateTopbar();
}

function setupLoginForm() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('loginError');
        errorEl.style.display = 'none';

        if (isAdmin) {
            const pass = document.getElementById('loginUser').value;
            if (pass === ADMIN_PASSWORD) {
                currentUser = { name: '管理員', _isAdmin: true };
                sessionStorage.setItem('outline_user', JSON.stringify(currentUser));
                enterPage();
            } else {
                errorEl.textContent = '密碼錯誤';
                errorEl.style.display = 'block';
            }
        } else {
            const email = document.getElementById('loginUser').value.trim().toLowerCase();
            const pass = document.getElementById('loginPass').value;
            let query = `email=eq.${encodeURIComponent(email)}&login_password=eq.${encodeURIComponent(pass)}&select=name,email,department,job_title`;
            if (sessionData) query += `&session_code=eq.${encodeURIComponent(sessionData.session_code)}`;
            const { data } = await db.select('students', query);
            if (data?.length) {
                currentUser = data[0];
                sessionStorage.setItem('outline_user', JSON.stringify(currentUser));
                enterPage();
            } else {
                errorEl.textContent = '帳號或密碼錯誤，請確認後重試';
                errorEl.style.display = 'block';
            }
        }
    });
}

function updateTopbar() {
    const el = document.getElementById('topbarUser');
    if (currentUser?._isAdmin) {
        el.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">admin_panel_settings</span><span><strong>管理模式</strong></span>`;
    } else if (currentUser) {
        el.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">person</span><span>歡迎，<strong>${currentUser.name || currentUser.email}</strong></span>`;
    }
}

// ══════════════════════════════════════
// ADMIN: Students
// ══════════════════════════════════════
async function loadStudents() {
    let q = 'select=id,name,email,department,job_title,login_password,created_at&order=created_at.desc';
    if (sessionData) q += `&session_code=eq.${encodeURIComponent(sessionData.session_code)}`;
    const { data } = await db.select('students', q);
    students = data || [];
    renderStudentTable();
}

function renderStudentTable() {
    const tbody = document.getElementById('studentTableBody');
    if (!tbody) return;
    if (!students.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:32px">尚無學員資料</td></tr>';
        return;
    }
    tbody.innerHTML = students.map(s => `<tr>
        <td><strong>${s.name||'—'}</strong></td><td>${s.email}</td>
        <td>${s.department||'—'}</td><td>${s.job_title||'—'}</td>
        <td style="font-family:monospace;font-size:0.8rem;color:var(--text-3)">${s.login_password||'—'}</td>
        <td><button class="btn btn-outline" style="padding:4px 8px;font-size:0.78rem" onclick="deleteStudent('${s.id}')"><span class="material-symbols-outlined" style="font-size:14px">delete</span></button></td>
    </tr>`).join('');
    document.getElementById('studentCount').textContent = students.length;
}

window.deleteStudent = async (id) => {
    if (!confirm('確定刪除此學員？')) return;
    await db.delete('students', { id: `eq.${id}` });
    loadStudents();
};

window.openAddStudentModal = () => document.getElementById('addStudentModal').classList.add('show');
window.closeAddStudentModal = () => { document.getElementById('addStudentModal').classList.remove('show'); document.getElementById('addStudentForm').reset(); };

window.submitAddStudent = async () => {
    const name = document.getElementById('addName').value.trim();
    const email = document.getElementById('addEmail').value.trim();
    if (!name || !email) { alert('姓名與 Email 為必填'); return; }
    const record = {
        name, email,
        department: document.getElementById('addDept').value.trim(),
        job_title: document.getElementById('addTitle').value.trim(),
        login_password: document.getElementById('addPass').value.trim() || genPwd(),
        session_code: sessionData?.session_code || '',
        session_id: sessionData?.id || null,
        project_id: projectData?.id || '',
        order_id: `outline-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    };
    const { error } = await db.insert('students', record);
    if (error) { alert('新增失敗：' + JSON.stringify(error)); return; }
    closeAddStudentModal();
    loadStudents();
};

function genPwd() { return Math.random().toString(36).substr(2, 6); }

// ── CSV Import ──
let pendingImport = [];

window.openImportModal = () => {
    document.getElementById('importModal').classList.add('show');
    document.getElementById('importPreview').innerHTML = '';
    document.getElementById('importFooter').style.display = 'none';
    pendingImport = [];
};
window.closeImportModal = () => document.getElementById('importModal').classList.remove('show');

window.handleImportFile = (input) => {
    const file = input.files[0];
    if (!file || !file.name.endsWith('.csv')) { alert('請上傳 .csv 檔案'); return; }
    const reader = new FileReader();
    reader.onload = (e) => parseCSV(e.target.result);
    reader.readAsText(file, 'UTF-8');
};

function parseCSV(text) {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { alert('CSV 至少需要標題行 + 一筆資料'); return; }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const obj = {};
        headers.forEach((h, i) => obj[h] = vals[i] || '');
        return obj;
    });
    pendingImport = rows.map(r => ({
        name: r['姓名'] || r.name || '',
        email: r['Email'] || r.email || r['信箱'] || '',
        department: r['部門'] || r.department || '',
        job_title: r['職稱'] || r.job_title || r['職位'] || '',
        login_password: r['密碼'] || r.password || r.login_password || genPwd(),
        session_code: sessionData?.session_code || '',
        session_id: sessionData?.id || null,
        project_id: projectData?.id || '',
        order_id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    })).filter(r => r.name && r.email);

    document.getElementById('importPreview').innerHTML = `
        <p style="font-size:0.85rem;margin-bottom:8px">共解析 <strong>${pendingImport.length}</strong> 筆學員</p>
        <table><thead><tr><th>姓名</th><th>Email</th><th>部門</th><th>職稱</th><th>密碼</th></tr></thead>
        <tbody>${pendingImport.slice(0,15).map(r=>`<tr><td>${r.name}</td><td>${r.email}</td><td>${r.department}</td><td>${r.job_title}</td><td>${r.login_password}</td></tr>`).join('')}
        ${pendingImport.length>15?`<tr><td colspan="5" style="text-align:center;color:#94a3b8">... 還有 ${pendingImport.length-15} 筆</td></tr>`:''}</tbody></table>`;
    document.getElementById('importFooter').style.display = 'flex';
}

window.doImport = async () => {
    if (!pendingImport.length) return;
    const btn = document.getElementById('btnConfirmImport');
    btn.disabled = true; btn.textContent = '匯入中...';
    let ok = 0, fail = 0;
    for (const row of pendingImport) {
        try { const { error } = await db.insert('students', row); error ? fail++ : ok++; }
        catch { fail++; }
    }
    alert(`匯入完成：成功 ${ok} 筆${fail>0?`，失敗 ${fail} 筆`:''}`);
    btn.disabled = false; btn.textContent = '確認匯入';
    closeImportModal(); loadStudents();
};

window.downloadTemplate = () => {
    const csv = '姓名,Email,部門,職稱,密碼\n王小明,ming@example.com,行銷部,專員,abc123\n李小華,hua@example.com,研發部,工程師,xyz789';
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'students_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// ══════════════════════════════════════
// ADMIN: Instructor Module
// ══════════════════════════════════════
let instructors = [];

async function loadInstructors() {
    const { data } = await db.select('instructors', 'select=*&order=created_at.desc');
    instructors = data || [];
    const sel = document.getElementById('instructorSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">— 選擇講師 —</option>' +
        instructors.map(i => `<option value="${i.id}">${i.name}（${i.email}）</option>`).join('');
}

window.onInstructorSelected = (selectEl) => {
    const inst = instructors.find(i => i.id === selectEl.value);
    if (!inst) return;
    const el = document.getElementById('instructorContent');
    if (!el) return;
    const photo = inst.photo_url
        ? `<img class="instructor-photo" src="${inst.photo_url}" alt="${inst.name}">`
        : '<div class="instructor-photo-placeholder"><span class="material-symbols-outlined">person</span></div>';
    const specs = (inst.specialties||[]).map(s=>`<span class="instructor-tag">${s}</span>`).join('');
    const gallery = (inst.teaching_photos||[]);
    const galleryHtml = gallery.length ? `<div class="instructor-gallery"><div class="instructor-gallery-title">📸 授課紀錄</div><div class="instructor-gallery-grid">${gallery.map(u=>`<img src="${u}" alt="授課照片" loading="lazy">`).join('')}</div></div>` : '';
    el.innerHTML = `<div class="instructor-card"><div class="instructor-main">${photo}<div class="instructor-info"><div class="instructor-name">${inst.name}</div><div class="instructor-title-text">${inst.title||'AI 數位教學設計師'}</div><div class="instructor-bio">${inst.bio||''}</div><div class="instructor-tags">${specs}</div></div></div>${galleryHtml}</div>`;
};

// ══════════════════════════════════════
// ADMIN: Organization / Client Management
// ══════════════════════════════════════
let organizations = [];

async function loadOrganizations() {
    const { data } = await db.select('organizations', 'select=*&order=created_at.desc');
    organizations = data || [];
    renderOrgTable();
}

function renderOrgTable() {
    const tbody = document.getElementById('orgTableBody');
    if (!tbody) return;
    if (!organizations.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:32px">尚無客戶資料</td></tr>';
        return;
    }
    tbody.innerHTML = organizations.map(o => `<tr>
        <td><div style="display:flex;align-items:center;gap:10px">
            ${o.logo_url ? `<img src="${o.logo_url}" style="height:28px;width:auto;object-fit:contain;border-radius:4px">` : '<span class="material-symbols-outlined" style="font-size:20px;color:var(--text-3)">business</span>'}
            <strong>${o.name}</strong></div></td>
        <td>${o.contact_person || o.contact_email || '—'}</td>
        <td>${o.phone || '—'}</td>
        <td>${o.pricing || '—'}</td>
        <td style="white-space:nowrap">
            <button class="btn btn-outline" style="padding:4px 8px;font-size:0.78rem" onclick="editOrg('${o.id}')"><span class="material-symbols-outlined" style="font-size:14px">edit</span></button>
            <button class="btn btn-outline" style="padding:4px 8px;font-size:0.78rem;margin-left:4px" onclick="deleteOrg('${o.id}')"><span class="material-symbols-outlined" style="font-size:14px">delete</span></button>
        </td></tr>`).join('');
}

window.openOrgModal = (editId) => {
    const modal = document.getElementById('orgModal');
    const form = document.getElementById('orgForm');
    form.reset();
    if (editId) {
        const o = organizations.find(x => x.id === editId);
        if (o) {
            document.getElementById('orgModalTitle').textContent = '編輯客戶';
            document.getElementById('orgId').value = o.id;
            document.getElementById('orgName').value = o.name || '';
            document.getElementById('orgLogo').value = o.logo_url || '';
            document.getElementById('orgContact').value = o.contact_person || '';
            document.getElementById('orgEmail').value = o.contact_email || '';
            document.getElementById('orgPhone').value = o.phone || '';
            document.getElementById('orgPricing').value = o.pricing || '';
        }
    } else {
        document.getElementById('orgModalTitle').textContent = '新增客戶';
        document.getElementById('orgId').value = '';
    }
    modal.classList.add('show');
};
window.closeOrgModal = () => document.getElementById('orgModal').classList.remove('show');

window.editOrg = (id) => openOrgModal(id);
window.deleteOrg = async (id) => {
    if (!confirm('確定刪除此客戶？')) return;
    await db.delete('organizations', { id: `eq.${id}` });
    loadOrganizations();
};

window.submitOrg = async () => {
    const id = document.getElementById('orgId').value;
    const record = {
        name: document.getElementById('orgName').value.trim(),
        logo_url: document.getElementById('orgLogo').value.trim(),
        contact_person: document.getElementById('orgContact').value.trim(),
        contact_email: document.getElementById('orgEmail').value.trim(),
        phone: document.getElementById('orgPhone').value.trim(),
        pricing: document.getElementById('orgPricing').value.trim(),
    };
    if (!record.name) { alert('客戶名稱為必填'); return; }
    if (id) {
        await db.update('organizations', record, { id: `eq.${id}` });
    } else {
        await db.insert('organizations', record);
    }
    closeOrgModal();
    loadOrganizations();
};

// Logo upload for org
window.handleOrgLogoUpload = async (input) => {
    const file = input.files[0];
    if (!file) return;
    const key = `org-logos/${Date.now()}_${file.name}`;
    const { data, error } = await storage.upload('outline-files', key, file);
    if (error) { alert('上傳失敗'); return; }
    document.getElementById('orgLogo').value = data.url;
    input.value = '';
};

// ══════════════════════════════════════
// FILE UPLOAD
// ══════════════════════════════════════
window.triggerFileUpload = () => document.getElementById('fileUploadInput').click();

window.handleFileUpload = async (input) => {
    const files = input.files;
    if (!files.length) return;
    const allowed = ['.ppt','.pptx','.doc','.docx','.pdf','.vsdx','.vsd','.xls','.xlsx','.txt'];
    for (const file of files) {
        const ext = '.'+file.name.split('.').pop().toLowerCase();
        if (!allowed.includes(ext)) { alert(`不支援的格式：${ext}`); continue; }
        if (file.size > 50*1024*1024) { alert('檔案上限 50MB'); continue; }
        const key = `outlines/${sessionData?.session_code||'default'}/${currentUser?.email||'anon'}/${Date.now()}_${file.name}`;
        const { data, error } = await storage.upload('outline-files', key, file);
        if (error) { alert('上傳失敗'); } else {
            uploadedFiles.push({ name: file.name, size: file.size, url: data.url, key });
            renderFileList();
        }
    }
    input.value = '';
};

function loadUploadedFiles() { renderFileList(); }

function renderFileList() {
    const list = document.getElementById('fileList');
    if (!list || !uploadedFiles.length) { if(list) list.innerHTML=''; return; }
    const icons = { ppt:'slideshow',pptx:'slideshow',doc:'article',docx:'article',xls:'table_chart',xlsx:'table_chart',pdf:'picture_as_pdf',vsd:'schema',vsdx:'schema' };
    list.innerHTML = uploadedFiles.map((f,i) => {
        const ext = f.name.split('.').pop().toLowerCase();
        const icon = icons[ext] || 'description';
        const size = f.size < 1024 ? f.size+'B' : f.size < 1048576 ? (f.size/1024).toFixed(1)+'KB' : (f.size/1048576).toFixed(1)+'MB';
        return `<div class="file-item"><div class="file-item-left"><span class="material-symbols-outlined">${icon}</span><div><div class="file-item-name">${f.name}</div><div class="file-item-size">${size}</div></div></div><button class="file-delete-btn" onclick="removeFile(${i})"><span class="material-symbols-outlined">close</span></button></div>`;
    }).join('');
}

window.removeFile = (idx) => { uploadedFiles.splice(idx,1); renderFileList(); };
window.outlineLogout = () => { sessionStorage.removeItem('outline_user'); location.reload(); };
