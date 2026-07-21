<?php
// register.php (新規登録を受け付けるデータ処理API)
session_start();
require_once 'dbconnect.php';

// レスポンスをJSON形式にするためのヘッダー設定
header('Content-Type: application/json; charset=UTF-8');

// POSTリクエスト以外を弾く
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'invalid_request']);
    exit;
}

// 1. データの受け取り
$user_id_input     = $_POST['user_id'] ?? '';
$password_input    = $_POST['password'] ?? '';
$password_confirm = $_POST['password_confirm'] ?? '';

// 2. 入力チェック（空っぽがないか）
if (empty($user_id_input) || empty($password_input) || empty($password_confirm)) {
    echo json_encode(['success' => false, 'error' => 'empty']);
    exit;
}

// 3. パスワードの一致チェック
if ($password_input !== $password_confirm) {
    echo json_encode(['success' => false, 'error' => 'password_mismatch']);
    exit;
}

// DB接続
$pdo = connectDB();

try {
    // 4. IDの重複チェック
    $sql_check = "SELECT COUNT(*) FROM users WHERE login_id = :login_id";
    $stmt_check = $pdo->prepare($sql_check);
    $stmt_check->bindValue(':login_id', $user_id_input, PDO::PARAM_STR);
    $stmt_check->execute();
    
    if ($stmt_check->fetchColumn() > 0) {
        echo json_encode(['success' => false, 'error' => 'already_exists']);
        exit;
    }

    // 5. パスワードのハッシュ化
    $hashed_password = password_hash($password_input, PASSWORD_DEFAULT);

    // 6. データベースへ登録
    $sql_insert = "INSERT INTO users (login_id, password) VALUES (:login_id, :password)";
    $stmt_insert = $pdo->prepare($sql_insert);
    $stmt_insert->bindValue(':login_id', $user_id_input, PDO::PARAM_STR);
    $stmt_insert->bindValue(':password', $hashed_password, PDO::PARAM_STR);
    $stmt_insert->execute();

    // 【登録成功】JSONで「成功したよ」とだけ返す
    echo json_encode(['success' => true]);
    exit;

} catch (PDOException $e) {
    // ★エラーの本当の原因（$e->getMessage()）を含めて返すように変更
    echo json_encode(['success' => false, 'error' => 'system_error', 'message' => $e->getMessage()]);
    exit;
}