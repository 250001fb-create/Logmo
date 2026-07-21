<?php
// php/logout.php
session_start();

// セッション変数をすべて解除
$_SESSION = array();

// セッションクッキーも削除
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// セッションを破壊
session_destroy();

// 【修正】phpフォルダから1つ外に出て、index.html（ログイン画面）へ戻す
header('Location: ../index.html');
exit;
?>