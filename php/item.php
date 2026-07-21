<?php
// php/item.php
header('Content-Type: application/json; charset=UTF-8');
session_start();

// データベース接続ファイルの読み込み
require_once 'dbconnect.php';
require_once 'functions.php';

// ログインしていない場合はエラー
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'not_logged_in']);
    exit;
}

$userId = $_SESSION['user_id'];

// JavaScriptから送られてきたデータを受け取る
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (empty($data['title']) || empty($data['type'])) {
    echo json_encode(['success' => false, 'error' => 'empty_fields']);
    exit;
}

$itemType = $data['type']; // habit, task, schedule
$title = $data['title'];

// JavaScript側で統一して設定された値を取得
$frequency = !empty($data['frequency']) ? $data['frequency'] : 'daily';
$startDate = !empty($data['start_date']) ? $data['start_date'] : date('Y-m-d');
$endDate   = !empty($data['end_date']) ? $data['end_date'] : '9999-12-31';

// ★新規追加：時間帯（習慣・予定は開始〜終了、タスクは期限時刻のみ）
$startTime = !empty($data['start_time']) ? $data['start_time'] : null;
$endTime   = !empty($data['end_time']) ? $data['end_time'] : null;

$weeklyDays = null;
if ($itemType === 'habit' && !empty($data['weekly_days']) && is_array($data['weekly_days'])) {
    $weeklyDays = implode(',', $data['weekly_days']);
}

// ★新規追加：複数の通知設定をJSON文字列にして保存
// 例: ["5", "1day"] のような配列がJavaScriptから送られてくる
$notifications = null;
if (!empty($data['notifications']) && is_array($data['notifications'])) {
    $notifications = json_encode(array_values($data['notifications']), JSON_UNESCAPED_UNICODE);
}

try {
    $pdo = connectDB();
    
    // items テーブルにデータを挿入（時間帯・複数通知に対応した新しい設計）
    $sql = "INSERT INTO items (user_id, item_type, title, start_date, end_date, start_time, end_time, status, frequency, weekly_days, notifications, created_at) 
            VALUES (:user_id, :item_type, :title, :start_date, :end_date, :start_time, :end_time, 'todo', :frequency, :weekly_days, :notifications, NOW())";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':user_id'       => $userId,
        ':item_type'     => $itemType,
        ':title'         => $title,
        ':start_date'    => $startDate,
        ':end_date'      => $endDate,
        ':start_time'    => $startTime,
        ':end_time'      => $endTime,
        ':frequency'     => $frequency,
        ':weekly_days'   => $weeklyDays,
        ':notifications' => $notifications
    ]);

    

// ★項目が増えたので、影響する日のAIアドバイスのキャッシュを削除しておく（次回表示時に再生成させる）
    invalidateAllAiAdvice($pdo, $userId);

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'db_error', 'message' => $e->getMessage()]);
}
?>