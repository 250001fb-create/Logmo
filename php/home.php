<?php
// php/home.php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
session_start();

require_once 'dbconnect.php';
require_once 'functions.php';
require_once 'config.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'not_logged_in', 'message' => 'セッションが切れました。ログインし直してください。']);
    exit;
}

$user_id = $_SESSION['user_id'];

try {
    $pdo = connectDB();

    $stmt_user = $pdo->prepare("SELECT login_id FROM users WHERE id = :id");
    $stmt_user->bindValue(':id', $user_id, PDO::PARAM_INT);
    $stmt_user->execute();
    $user = $stmt_user->fetch();
    $username = $user ? $user['login_id'] : 'ゲスト';

    // 【確定版SQL】本日(CURDATE())のrecordsとitems双方の情報を正しくマージして取得
    $sql = "SELECT 
                i.id, 
                i.title, 
                i.item_type AS type, 
                (CASE WHEN i.item_type = 'habit' THEN 
                    (CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END)
                 ELSE 
                    (CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END)
                 END) AS is_completed, 
                i.start_date, 
                i.end_date,
                i.start_time,
                i.end_time,
                i.frequency,
                i.weekly_days,
                i.notifications,
                IFNULL(COALESCE(r.memo, i.memo), '') AS memo,
                i.reminder_time AS time 
            FROM items i
            LEFT JOIN records r ON i.id = r.item_id AND r.record_date = CURDATE() AND r.user_id = :user_id1
            WHERE i.user_id = :user_id2 
            ORDER BY i.item_type ASC, i.start_time ASC, i.reminder_time ASC";
            
    $stmt_items = $pdo->prepare($sql);
    $stmt_items->bindValue(':user_id1', $user_id, PDO::PARAM_INT);
    $stmt_items->bindValue(':user_id2', $user_id, PDO::PARAM_INT);
    $stmt_items->execute();
    $items = $stmt_items->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success'  => true,
        'username' => $username,
        'items'    => $items
    ]);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error'   => 'db_error',
        'message' => 'データ取得中にエラーが発生しました。'
    ]);
}