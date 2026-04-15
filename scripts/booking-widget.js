// ── 預約模組 ──
var BK_SB_URL = 'https://wsaknnhjgiqmkendeyrj.supabase.co';
var BK_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzYWtubmhqZ2lxbWtlbmRleXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTI4MTIsImV4cCI6MjA4NzY4ODgxMn0.1j-4D9Kw0vqhVcTWgU7ABTJ_mO6aN4IB72Ojof8Yfko';
var bkDate = null, bkTime = null, bkViewMonth = null, bkCalData = null;
var BK_DOW = ['日', '一', '二', '三', '四', '五', '六'];
var BK_MN = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

// ── 因為 kaik.io 會 strip onclick，用 polling 綁定事件 ──
var bkInitDone = false;
var bkInitTimer = setInterval(function () {
  var trigger = document.querySelector('.bk-trigger');
  if (!trigger) return;
  if (bkInitDone) { clearInterval(bkInitTimer); return; }
  bkInitDone = true;
  clearInterval(bkInitTimer);

  // 綁觸發按鈕
  trigger.addEventListener('click', function () { bkOpen(); });
  // 綁關閉
  var closeBtn = document.querySelector('.bk-close');
  if (closeBtn) closeBtn.addEventListener('click', function () { bkClose(); });
  // 綁 overlay 背景關閉
  var overlay = document.getElementById('bkOverlay');
  if (overlay) overlay.addEventListener('click', function (e) {
    if (e.target === e.currentTarget) bkClose();
  });
  // 綁返回按鈕
  document.querySelectorAll('.bk-back').forEach(function (btn) {
    var txt = btn.textContent || '';
    if (txt.indexOf('重選日期') > -1) btn.addEventListener('click', function () { bkGoStep(1); });
    if (txt.indexOf('重選時段') > -1) btn.addEventListener('click', function () { bkGoStep(2); });
  });
  // 綁表單
  var form = document.getElementById('bkForm');
  if (form) form.addEventListener('submit', function (e) { bkSubmit(e); });
  // 綁月份導航
  var prevBtn = document.getElementById('bkCalPrev');
  var nextBtn = document.getElementById('bkCalNext');
  if (prevBtn) prevBtn.addEventListener('click', function () { bkCalNav(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { bkCalNav(1); });
}, 500);

// ── Helpers ──
function bkFmtDate(ds) {
  if (!ds) return '';
  var d = new Date(ds + 'T00:00:00');
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 (' + BK_DOW[d.getDay()] + ')';
}
function bkTimeLabel(s) {
  var h = parseInt(s);
  if (h >= 9 && h <= 12) return '上午';
  if (h >= 13 && h <= 17) return '下午';
  return '晚間';
}

// ── Open / Close ──
function bkOpen() {
  var el = document.getElementById('bkOverlay');
  if (!el) return;
  el.classList.add('active');
  document.body.style.overflow = 'hidden';
  if (!bkCalData) bkLoadCal();
}
function bkClose() {
  var el = document.getElementById('bkOverlay');
  if (el) el.classList.remove('active');
  document.body.style.overflow = '';
}

// ── Steps ──
function bkGoStep(n) {
  document.querySelectorAll('.bk-step').forEach(function (s) { s.classList.remove('active'); });
  var el = document.getElementById('bkS' + n);
  if (el) el.classList.add('active');
  document.querySelectorAll('.bk-stp').forEach(function (s) {
    var sn = parseInt(s.getAttribute('data-s'));
    s.classList.toggle('active', sn === n);
    s.classList.toggle('done', sn < n);
  });
  var title = document.getElementById('bkTitle');
  var sub = document.getElementById('bkSubtitle');
  if (n === 1) {
    if (title) title.textContent = '預約免費諮詢';
    if (sub) sub.textContent = '選擇您方便的日期';
  } else if (n === 2) {
    if (title) title.textContent = '選擇時段';
    if (sub) sub.textContent = bkFmtDate(bkDate);
  } else if (n === 3) {
    if (title) title.textContent = '填寫聯繫資料';
    if (sub) sub.textContent = bkFmtDate(bkDate) + ' ' + bkTime;
    var sm = document.getElementById('bkSummary');
    if (sm) sm.innerHTML = '<span class="icn">📅</span><span><strong>' + bkFmtDate(bkDate) + '</strong>・' + bkTime + ' 開始（約 1 小時）</span>';
  }
}

// ── Calendar ──
function bkCalNav(dir) {
  bkViewMonth.month += dir;
  if (bkViewMonth.month > 11) { bkViewMonth.month = 0; bkViewMonth.year++; }
  if (bkViewMonth.month < 0) { bkViewMonth.month = 11; bkViewMonth.year--; }
  bkRenderCal();
}

function bkSelDate(ds) {
  bkDate = ds;
  bkRenderCal();
  var info = (bkCalData || []).find(function (d) { return d.date === ds; });
  var slots = (info && info.slots) ? info.slots : [];
  var dl = document.getElementById('bkDateLabel');
  if (dl) dl.innerHTML = '📅 ' + bkFmtDate(ds) + ' — 可用時段';
  var tg = document.getElementById('bkTimeGrid');
  if (!tg) return;
  if (!slots.length) {
    tg.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#94a3b8;">此日無可用時段</div>';
  } else {
    tg.innerHTML = slots.map(function (s) {
      return '<div class="bk-time-slot" data-time="' + s + '">' + s + '<div class="tl">' + bkTimeLabel(s) + '</div></div>';
    }).join('');
    // 綁定時段點擊（因為 onclick 會被 strip）
    document.querySelectorAll('.bk-time-slot').forEach(function (slot) {
      slot.addEventListener('click', function () {
        bkSelTime(slot, slot.getAttribute('data-time'));
      });
    });
  }
  bkGoStep(2);
}

function bkSelTime(el, t) {
  bkTime = t;
  document.querySelectorAll('.bk-time-slot').forEach(function (s) { s.classList.remove('sel'); });
  el.classList.add('sel');
  setTimeout(function () { bkGoStep(3); }, 300);
}

// ── Submit ──
function bkV(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
function bkSubmit(e) {
  e.preventDefault();
  var btn = document.getElementById('bkSubmitBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="bk-spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></div>預約中...';
  }
  var titleVal = bkV('bkFTitle');
  var payload = {
    name: bkV('bkFName'), email: bkV('bkFEmail'),
    phone: bkV('bkFPhone'), company: bkV('bkFCompany'),
    headcount: bkV('bkFHeadcount'), lineId: bkV('bkFLine'),
    message: [titleVal ? '職稱：' + titleVal : '', bkV('bkFMessage')].filter(Boolean).join('\n'),
    date: bkDate, time: bkTime
  };
  fetch(BK_SB_URL + '/functions/v1/create-booking', {
    method: 'POST',
    headers: { 'apikey': BK_SB_KEY, 'Authorization': 'Bearer ' + BK_SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
  .then(function (result) {
    if (!result.ok) throw new Error(result.data.error || '預約失敗');
    var sd = document.getElementById('bkSuccessDetail');
    if (sd) sd.innerHTML = '您已成功預約 <strong>' + bkFmtDate(bkDate) + ' ' + bkTime + '</strong> 的線上諮詢。';
    document.querySelectorAll('.bk-step').forEach(function (s) { s.classList.remove('active'); });
    var suc = document.getElementById('bkSuccess'); if (suc) suc.classList.add('active');
    document.querySelectorAll('.bk-stp').forEach(function (s) { s.classList.add('done'); });
    var t = document.getElementById('bkTitle'); if (t) t.textContent = '預約成功！';
    var st = document.getElementById('bkSubtitle'); if (st) st.textContent = '';
    var stps = document.getElementById('bkSteps'); if (stps) stps.style.display = 'none';
  })
  .catch(function (err) {
    alert('預約失敗：' + (err.message || '請稍後再試'));
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '✓ 確認預約';
    }
  });
}

// ── Load Calendar ──
function bkLoadCal() {
  var grid = document.getElementById('bkCalGrid');
  if (grid) grid.innerHTML = '<div class="bk-loading"><div class="bk-spinner"></div><p>正在載入可用時段...</p></div>';
  fetch(BK_SB_URL + '/functions/v1/calendar-availability', {
    headers: { 'apikey': BK_SB_KEY, 'Authorization': 'Bearer ' + BK_SB_KEY }
  })
  .then(function (res) { return res.json(); })
  .then(function (data) {
    if (!data.calendarConnected || !data.dates || !data.dates.length) { bkCalData = bkFallback(); }
    else { bkCalData = data.dates; }
    var first = bkCalData[0].date; var d = new Date(first + 'T00:00:00');
    bkViewMonth = { year: d.getFullYear(), month: d.getMonth() };
    bkRenderCal();
  })
  .catch(function () {
    bkCalData = bkFallback();
    var first = bkCalData[0].date; var d = new Date(first + 'T00:00:00');
    bkViewMonth = { year: d.getFullYear(), month: d.getMonth() };
    bkRenderCal();
  });
}

function bkFallback() {
  var dates = [], d = new Date(); d.setDate(d.getDate() + 1);
  var slots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '21:00', '22:00', '23:00'];
  while (dates.length < 30) {
    var day = d.getDay();
    if (day !== 0 && day !== 6) { dates.push({ date: d.toISOString().slice(0, 10), dow: day, slots: slots, availableCount: 11, allBusy: false }); }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function bkRenderCal() {
  var grid = document.getElementById('bkCalGrid'); if (!grid) return;
  var y = bkViewMonth.year, m = bkViewMonth.month;
  var lbl = document.getElementById('bkCalLabel');
  if (lbl) lbl.textContent = y + '年 ' + BK_MN[m];
  var all = (bkCalData || []).map(function (d) { return d.date; });
  var fd = new Date(all[0] + 'T00:00:00'), ld = new Date(all[all.length - 1] + 'T00:00:00');
  var prev = document.getElementById('bkCalPrev'), next = document.getElementById('bkCalNext');
  if (prev) prev.disabled = (y <= fd.getFullYear() && m <= fd.getMonth());
  if (next) next.disabled = (y >= ld.getFullYear() && m >= ld.getMonth());
  var map = {}; (bkCalData || []).forEach(function (dd) { map[dd.date] = dd; });
  var firstDay = new Date(y, m, 1).getDay();
  var days = new Date(y, m + 1, 0).getDate();
  var html = BK_DOW.map(function (d) { return '<div class="bk-cal-head">' + d + '</div>'; }).join('');
  for (var i = 0; i < firstDay; i++) html += '<div class="bk-cal-day emp"></div>';
  for (var day = 1; day <= days; day++) {
    var ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    var info = map[ds]; var sel = ds === bkDate;
    if (!info || info.allBusy) {
      html += '<div class="bk-cal-day dis">' + day + '</div>';
    } else {
      html += '<div class="bk-cal-day' + (sel ? ' sel' : '') + '" data-date="' + ds + '">' + day + '<div class="dot"></div></div>';
    }
  }
  grid.innerHTML = html;
  // 綁定日期點擊（因為 onclick 會被 strip）
  grid.querySelectorAll('.bk-cal-day:not(.dis):not(.emp)').forEach(function (cell) {
    cell.addEventListener('click', function () {
      bkSelDate(cell.getAttribute('data-date'));
    });
  });
}
