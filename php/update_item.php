<?php
// php/update_item.php
// 項目の内容（種類・タイトル・期間・時間・頻度・曜日・通知）を編集・更新するAPI
// ※完了状態(status)はここでは変更しない（完了・削除は別のAPIが担当）
header('Content-Type: application/json; charset=UTF-8');
session_start();

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

$itemId = isset($data['id']) ? (int)$data['id'] : 0;

if (!$itemId) {
    echo json_encode(['success' => false, 'error' => 'invalid_id']);
    exit;
}

if (empty($data['title']) || empty($data['type'])) {
    echo json_encode(['success' => false, 'error' => 'empty_fields']);
    exit;
}

$itemType = $data['type']; // habit, task, schedule
$title = $data['title'];

$frequency = !empty($data['frequency']) ? $data['frequency'] : 'daily';
$startDate = !empty($data['start_date']) ? $data['start_date'] : date('Y-m-d');
$endDate   = !empty($data['end_date']) ? $data['end_date'] : '9999-12-31';

$startTime = !empty($data['start_time']) ? $data['start_time'] : null;
$endTime   = !empty($data['end_time']) ? $data['end_time'] : null;

$weeklyDays = null;
if ($itemType === 'habit' && !empty($data['weekly_days']) && is_array($data['weekly_days'])) {
    $weeklyDays = implode(',', $data['weekly_days']);
}

$notifications = null;
if (!empty($data['notifications']) && is_array($data['notifications'])) {
    $notifications = json_encode(array_values($data['notifications']), JSON_UNESCAPED_UNICODE);
}

try {
    $pdo = connectDB();

    // 自分の項目かどうかを確認してから更新する（他人のデータを書き換えられないようにする）
    $checkStmt = $pdo->prepare("SELECT id FROM items WHERE id = :id AND user_id = :user_id");
    $checkStmt->execute([':id' => $itemId, ':user_id' => $userId]);
    if (!$checkStmt->fetch()) {
        echo json_encode(['success' => false, 'error' => 'not_found']);
        exit;
    }

    $sql = "UPDATE items SET
                item_type = :item_type,
                title = :title,
                start_date = :start_date,
                end_date = :end_date,
                start_time = :start_time,
                end_time = :end_time,
                frequency = :frequency,
                weekly_days = :weekly_days,
                notifications = :notifications
            WHERE id = :id AND user_id = :user_id";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':item_type'     => $itemType,
        ':title'         => $title,
        ':start_date'    => $startDate,
        ':end_date'      => $endDate,
        ':start_time'    => $startTime,
        ':end_time'      => $endTime,
        ':frequency'     => $frequency,
        ':weekly_days'   => $weeklyDays,
        ':notifications' => $notifications,
        ':id'            => $itemId,
        ':user_id'       => $userId
    ]);

    // ★項目が変更されたので、影響する日のAIアドバイスのキャッシュを削除しておく
    invalidateAllAiAdvice($pdo, $userId);

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'db_error', 'message' => $e->getMessage()]);
}