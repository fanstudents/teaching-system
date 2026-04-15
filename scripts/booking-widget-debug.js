// ===== 預約模組 DEBUG 版 =====
console.log('[BK] JS loaded');

// 測試 1: 全域函式是否可被 onclick 呼叫
function bkOpen() {
  alert('bkOpen works!');
}

// 測試 2: 每 2 秒檢查按鈕是否存在
setInterval(function() {
  var btn = document.querySelector('.bk-trigger');
  var overlay = document.getElementById('bkOverlay');
  console.log('[BK] poll — .bk-trigger:', !!btn, ', #bkOverlay:', !!overlay);
  if (btn) {
    console.log('[BK] button found! onclick attr:', btn.getAttribute('onclick'));
  }
}, 2000);
