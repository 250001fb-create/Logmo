<?php
//php/config.php

// ツールで生成された公開鍵
define('VAPID_PUBLIC_KEY', '');

// ツールで生成された秘密鍵
define('VAPID_PRIVATE_KEY', '');

// あなたのメールアドレス
define('VAPID_SUBJECT', '');

// ★AIアドバイス機能用：Google Gemini APIキー
// https://aistudio.google.com/apikey で発行したキーをここに貼り付ける
define('GEMINI_API_KEY', '');

// ==========================================
// ★追加：プッシュ通知用のセキュリティトークン
// ==========================================
define('CRON_SECRET_TOKEN', ''); // ← 任意の半角英数字を設定してください