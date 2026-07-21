<?php
// dbconnect.php

function connectDB() {
    // ※環境に合わせてユーザー名やパスワードを変更してください
    $host = 'localhost';
    $dbname = 'myapp'; // さっき決めたDB名
    $user = 'root'; // MySQLのユーザー名
    $pass = '';     // MySQLのパスワード

    $dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        exit('データベース接続失敗: ' . $e->getMessage());
    }
}
?>