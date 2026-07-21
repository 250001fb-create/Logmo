<?php
// php/delete_item.php
// 項目を削除するAPI
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

try {
    $pdo = connectDB();

    // 自分の項目かどうかを確認してから削除する（他人のデータを消せないようにする）
    // ★削除前にstart_dateも取得しておき、そのAIアドバイスキャッシュも消せるようにする
    $checkStmt = $pdo->prepare("SELECT id, start_date FROM items WHERE id = :id AND user_id = :user_id");
    $checkStmt->execute([':id' => $itemId, ':user_id' => $userId]);
    $itemRow = $checkStmt->fetch();
    if (!$itemRow) {
        echo json_encode(['success' => false, 'error' => 'not_found']);
        exit;
    }

    $sql = "DELETE FROM items WHERE id = :id AND user_id = :user_id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $itemId, ':user_id' => $userId]);

    // ★項目が削除されたので、影響する日のAIアドバイスのキャッシュを削除しておく
    invalidateAllAiAdvice($pdo, $userId);
    
    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'db_error', 'message' => $e->getMessage()]);
}