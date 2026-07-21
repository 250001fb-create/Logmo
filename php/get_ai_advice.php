<?php
// php/get_ai_advice.php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
session_start();

require_once 'dbconnect.php';
require_once 'functions.php';
require_once 'config.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'not_logged_in']);
    exit;
}

$userId = $_SESSION['user_id'];
$date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');

if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $date)) {
    echo json_encode(['success' => false, 'error' => 'invalid_date']);
    exit;
}

try {
    $pdo = connectDB();

    $stmt_user = $pdo->prepare("SELECT login_id FROM users WHERE id = :id");
    $stmt_user->bindValue(':id', $userId, PDO::PARAM_INT);
    $stmt_user->execute();
    $user = $stmt_user->fetch();
    $username = $user ? $user['login_id'] : 'ゲスト';

    // 【確定版SQL】両方のテーブルのmemoを考慮（COALESCEでrecordsのメモがあればそちらを優先）
    $sql = "SELECT i.id, i.title, i.item_type AS type,
                   (CASE WHEN i.item_type = 'habit' THEN 
                       (CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END)
                    ELSE 
                       (CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END)
                    END) AS is_completed,
                   i.start_date, i.end_date, i.start_time, i.end_time, 
                   i.frequency, i.weekly_days, i.notifications,
                   IFNULL(COALESCE(r.memo, i.memo), '') AS memo
            FROM items i
            LEFT JOIN records r ON i.id = r.item_id AND r.record_date = :record_date AND r.user_id = :user_id1
            WHERE i.user_id = :user_id2";

    $stmt_items = $pdo->prepare($sql);
    $stmt_items->bindValue(':user_id1', $userId, PDO::PARAM_INT);
    $stmt_items->bindValue(':user_id2', $userId, PDO::PARAM_INT);
    $stmt_items->bindValue(':record_date', $date, PDO::PARAM_STR);
    $stmt_items->execute();
    $items = $stmt_items->fetchAll(PDO::FETCH_ASSOC);

    $advice = getOrGenerateAiAdvice($pdo, $userId, $username, $items, $date);

    echo json_encode([
        'success'   => true,
        'date'      => $date,
        'ai_advice' => $advice
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error'   => 'db_error',
        'message' => 'データベースエラーが発生しました。'
    ]);
}