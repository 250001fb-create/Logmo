<?php
// php/complete_item.php
// 項目のステータス（完了⇔未完了）を更新するAPI
// ★メモは「その項目」ではなく「その日の記録(records)」に保存するように変更
//   （習慣のように繰り返す項目で、メモが日付をまたいでずっと表示され続けるのを防ぐため）
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
// status: 'completed' または 'todo' を想定
$newStatus = (isset($data['status']) && $data['status'] === 'completed') ? 'completed' : 'todo';
// memo: キー自体が送られてきた場合のみ「その日の記録」に保存する（送られてこなければ何もしない）
$memoProvided = array_key_exists('memo', $data);
$memo = $memoProvided ? $data['memo'] : null;

// メモをどの日付に紐付けるか（カレンダーで選択中の日付、または今日）
$recordDate = isset($data['record_date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['record_date'])
    ? $data['record_date']
    : date('Y-m-d');

if (!$itemId) {
    echo json_encode(['success' => false, 'error' => 'invalid_id']);
    exit;
}

try {
    $pdo = connectDB();

    // 先に自分の項目かどうかを確認し、種類（habit/task/schedule）も取得する
    $checkStmt = $pdo->prepare("SELECT id, item_type FROM items WHERE id = :id AND user_id = :user_id");
    $checkStmt->execute([':id' => $itemId, ':user_id' => $userId]);
    $itemRow = $checkStmt->fetch();
    if (!$itemRow) {
        echo json_encode(['success' => false, 'error' => 'not_found']);
        exit;
    }
    $itemType = $itemRow['item_type'];

    if ($itemType === 'habit') {
        // ★習慣は繰り返す項目なので、完了状態そのものを「その日の記録(records)」で管理する
        //   items.status は習慣では使わない（他の日まで完了扱いになってしまうため）
        $recordStatus = ($newStatus === 'completed') ? 'done' : 'todo';

        if ($memoProvided) {
            $recordSql = "INSERT INTO records (user_id, item_id, record_date, status, memo)
                           VALUES (:user_id, :item_id, :record_date, :status, :memo)
                           ON DUPLICATE KEY UPDATE status = VALUES(status), memo = VALUES(memo)";
            $recordStmt = $pdo->prepare($recordSql);
            $recordStmt->execute([
                ':user_id'     => $userId,
                ':item_id'     => $itemId,
                ':record_date' => $recordDate,
                ':status'      => $recordStatus,
                ':memo'        => $memo
            ]);
        } else {
            // メモが送られてこなかった場合は、既存のメモを消さないように status だけ更新する
            $recordSql = "INSERT INTO records (user_id, item_id, record_date, status)
                           VALUES (:user_id, :item_id, :record_date, :status)
                           ON DUPLICATE KEY UPDATE status = VALUES(status)";
            $recordStmt = $pdo->prepare($recordSql);
            $recordStmt->execute([
                ':user_id'     => $userId,
                ':item_id'     => $itemId,
                ':record_date' => $recordDate,
                ':status'      => $recordStatus
            ]);
        }

    } else {
        // ★タスク・予定は1回きりの項目なので、今まで通り items.status を更新する
        $sql = "UPDATE items SET status = :status WHERE id = :id AND user_id = :user_id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':status'  => $newStatus,
            ':id'      => $itemId,
            ':user_id' => $userId
        ]);

        // メモが入力されていれば、その日の記録としても保存しておく（カレンダーで確認できるように）
        if ($memoProvided) {
            $recordSql = "INSERT INTO records (user_id, item_id, record_date, status, memo)
                           VALUES (:user_id, :item_id, :record_date, 'done', :memo)
                           ON DUPLICATE KEY UPDATE memo = VALUES(memo), status = VALUES(status)";
            $recordStmt = $pdo->prepare($recordSql);
            $recordStmt->execute([
                ':user_id'     => $userId,
                ':item_id'     => $itemId,
                ':record_date' => $recordDate,
                ':memo'        => $memo
            ]);
        }
    }

    // ★完了状態が変わったので、このユーザーのAIアドバイスキャッシュを全て消しておく
    invalidateAllAiAdvice($pdo, $userId);

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'db_error', 'message' => $e->getMessage()]);
}