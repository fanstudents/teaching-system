#!/bin/bash
# 測試 Resend API 是否能正常發信
# 用你的 email 替換 test-recipient

curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_ZaV22t8T_8qh2TiAfCA3cXDYfZNZjB7xn' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "數位簡報室 <service@mail.tbr.digital>",
    "to": ["service@tbr.digital"],
    "subject": "🧪 Resend 測試 — 推廣者佣金通知",
    "html": "<h1>Resend 運作正常 ✅</h1><p>這是一封測試信，確認 Resend API 可以正常發送。</p>",
    "text": "Resend 運作正常 — 測試信"
  }'
