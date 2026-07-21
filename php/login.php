<?php
// php/login.php (ログイン認証用API)
session_start();
require_once 'dbconnect.php'; // 同じphpフォルダ内なのでこれでOK

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'invalid_request']);
    exit;
}

// 1. データの受け取り
$user_id_input = $_POST['user_id'] ?? '';
$password_input = $_POST['password'] ?? '';

// 2. 空白チェック
if (empty($user_id_input) || empty($password_input)) {
    echo json_encode(['success' => false, 'error' => 'empty']);
    exit;
}

$pdo = connectDB();

try {
    // 3. ユーザーを検索
    $sql = "SELECT id, password FROM users WHERE login_id = :login_id";
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':login_id', $user_id_input, PDO::PARAM_STR);
    $stmt->execute();
    $user = $stmt->fetch();

    // 4. パスワードの照合
    if ($user && password_verify($password_input, $user['password'])) {
        // 【認証成功】
        session_regenerate_id(true); // セッションハイジャック対策
        $_SESSION['user_id'] = $user['id']; // セッションにユーザーの識別IDを保存
        
        echo json_encode(['success' => true]);
        exit;
    } else {
        // 【認証失敗】IDがない、またはパスワード間違い
        echo json_encode(['success' => false, 'error' => 'invalid']);
        exit;
    }

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'system_error']);
    exit;
}