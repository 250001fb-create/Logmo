<?php
// php/save_subscription.php
// ブラウザから送られてきた「通知の宛先（住所）」をデータベースに保存するAPI

header('Content-Type: application/json; charset=UTF-8');
session_start();

require_once 'dbconnect.php';

// ログインしていない場合はエラー
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'not_logged_in']);
    exit;
}

$userId = $_SESSION['user_id'];

// JavaScriptから送られてきたJSONデータを受け取る
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (empty($data['endpoint']) || empty($data['keys']['p256dh']) || empty($data['keys']['auth'])) {
    echo json_encode(['success' => false, 'error' => 'invalid_subscription_data']);
    exit;
}

$endpoint = $data['endpoint'];
$p256dh   = $data['keys']['p256dh'];
$auth     = $data['keys']['auth'];

try {
    $pdo = connectDB();

    // すでに同じ宛先（endpoint）が登録されているかチェック
    $checkStmt = $pdo->prepare("SELECT id FROM push_subscriptions WHERE user_id = :user_id AND endpoint = :endpoint");
    $checkStmt->execute([':user_id' => $userId, ':endpoint' => $endpoint]);
    
    if ($checkStmt->fetch()) {
        // すでに登録済みなら何もしないで成功を返す（重複登録防止）
        echo json_encode(['success' => true, 'message' => 'already_registered']);
        exit;
    }

    // 新しくデータベースに保存する
    $sql = "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) 
            VALUES (:user_id, :endpoint, :p256dh, :auth)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':user_id'  => $userId,
        ':endpoint' => $endpoint,
        ':p256dh'   => $p256dh,
        ':auth'     => $auth
    ]);

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'db_error', 'message' => $e->getMessage()]);
}