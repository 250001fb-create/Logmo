<?php
// php/get_records.php
// 指定した日付の「その日の記録」（メモ・完了状態）を、項目ごとにまとめて取得するAPI
// カレンダーで日付を選択した時などに使う
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
session_start();

require_once 'dbconnect.php';

// ログインしていない場合はエラー
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'not_logged_in']);
    exit;
}

$userId = $_SESSION['user_id'];

// 日付はGETパラメータで受け取る（例: php/get_records.php?date=2026-07-08）。省略時は今日。
$date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');

// 日付形式の簡易チェック（YYYY-MM-DD）
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    echo json_encode(['success' => false, 'error' => 'invalid_date']);
    exit;
}

try {
    $pdo = connectDB();

    $sql = "SELECT item_id, status, memo FROM records WHERE user_id = :user_id AND record_date = :record_date";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':user_id'     => $userId,
        ':record_date' => $date
    ]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // JavaScript側で使いやすいように item_id をキーにしたオブジェクトへ変換する
    $records = [];
    foreach ($rows as $row) {
        $records[$row['item_id']] = [
            'status' => $row['status'],
            'memo'   => $row['memo']
        ];
    }

    echo json_encode([
        'success' => true,
        'date'    => $date,
        'records' => $records
    ]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'db_error', 'message' => $e->getMessage()]);
}