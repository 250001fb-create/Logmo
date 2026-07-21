<?php
// php/cron_send_push.php
// リマインダー時刻になった予定・タスク・習慣を検知し、Web Pushを配信するトリガー用スクリプト
// (サーバーのCronや定期タスクで1分ごとに実行することを想定しています)

header('Content-Type: application/json; charset=UTF-8');

require_once 'dbconnect.php';
require_once 'config.php';
require_once '../vendor/autoload.php'; // Composerライブラリ(minishlink/web-push)の読み込み

// ★不正アクセス防止：config.php で定義した秘密トークンと一致しない場合は処理を中断する
if (!defined('CRON_SECRET_TOKEN') || empty(CRON_SECRET_TOKEN) || CRON_SECRET_TOKEN === 'ここに十分に長いランダムな文字列を設定') {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'cron_token_not_configured']);
    exit;
}

$providedToken = $_GET['token'] ?? '';
if (!hash_equals(CRON_SECRET_TOKEN, (string)$providedToken)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'forbidden']);
    exit;
}

use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

/**
 * ★「日付＋時刻」の文字列が、前回実行〜今回実行の範囲内に入っているか判定する関数
 * 5分間隔などcronの実行間隔が空いても、通知時刻を取りこぼさないようにするための仕組み
 */
function isTimeInWindow($dateStr, $timeStr, DateTime $lastRun, DateTime $now) {
    $target = DateTime::createFromFormat('Y-m-d H:i', $dateStr . ' ' . $timeStr);
    if (!$target) return false;
    return $target > $lastRun && $target <= $now;
}

/**
 * ★新規追加：習慣（habit）が指定した日付(dateStr)に「発生する日」かどうかを判定する
 * 「1日前」通知は、習慣の場合は毎回の発生日の前日に繰り返し送る必要があるため、
 * 「明日がこの習慣の発生日かどうか」をチェックするために使う
 * （home.js の isItemOnDate() / functions.php の filterItemsForDate() と同じロジック）
 */
function isHabitActiveOnDate($item, $dateStr) {
    if (!empty($item['start_date']) && $dateStr < $item['start_date']) return false;
    if (!empty($item['end_date']) && $item['end_date'] !== '9999-12-31' && $dateStr > $item['end_date']) return false;

    if ($item['frequency'] === 'weekly_days' && !empty($item['weekly_days'])) {
        $weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
        $targetDow = $weekdayLabels[date('w', strtotime($dateStr))];
        $activeDays = array_map('trim', explode(',', $item['weekly_days']));
        if (!in_array($targetDow, $activeDays)) return false;
    }

    return true;
}

try {
    $pdo = connectDB();

    // 1. 現在の「日付」「時刻」「曜日」を日本のタイムゾーン等に合わせて正しく取得
    date_default_timezone_set('Asia/Tokyo');
    $currentDate = date('Y-m-d');
    $currentTime = date('H:i'); // 例: "14:35"

    // 曜日のマッピング (フロントエンドの WEEKDAY_LABELS と統一)
    $weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    $currentWeekday = $weekdayLabels[date('w')];

    // ★前回このcronが実行された時刻を記録するファイル（無ければ1分前を仮定）
    $currentDateTime = new DateTime();
    $lastRunFile = __DIR__ . '/last_cron_run.txt';
    if (file_exists($lastRunFile)) {
        $lastRunStr = trim(file_get_contents($lastRunFile));
        $lastRunDateTime = DateTime::createFromFormat('Y-m-d H:i:s', $lastRunStr);
        if (!$lastRunDateTime) {
            $lastRunDateTime = (clone $currentDateTime)->modify('-1 minute');
        }
        // ★サーバー停止などで長時間空いた場合、過去分を大量送信しないよう上限を設ける（60分）
        $diffMinutes = ($currentDateTime->getTimestamp() - $lastRunDateTime->getTimestamp()) / 60;
        if ($diffMinutes > 60) {
            $lastRunDateTime = (clone $currentDateTime)->modify('-60 minutes');
        }
    } else {
        $lastRunDateTime = (clone $currentDateTime)->modify('-1 minute');
    }

    // 2. 本日の日付が期間内（start_date 〜 end_date）に入っている有効なアイテムをすべて抽出
    $sql_items = "SELECT id, user_id, title, item_type, start_date, end_date, start_time, end_time, frequency, weekly_days, notifications 
                FROM items 
                WHERE :current_date >= start_date AND (end_date IS NULL OR :current_date2 <= end_date)";

    $stmt_items = $pdo->prepare($sql_items);
    $stmt_items->execute([
        ':current_date' => $currentDate,
        ':current_date2' => $currentDate
    ]);
    $items = $stmt_items->fetchAll();

    $notificationsToSend = [];

    // 3. 各アイテムが「前回実行〜今回実行」の間に通知を送るべきタイミングを跨いだかどうかの判定ループ
    foreach ($items as $item) {
        
        // 頻度が「指定した曜日(weekly_days)」の習慣の場合、今日の曜日が含まれていなければスキップ
        if ($item['item_type'] === 'habit' && $item['frequency'] === 'weekly_days') {
            if (!empty($item['weekly_days'])) {
                $activeDays = array_map('trim', explode(',', $item['weekly_days']));
                if (!in_array($currentWeekday, $activeDays)) {
                    continue; // 今日の曜日が対象外なら通知しない
                }
            }
        }

        // ベースとなる基準時刻（基本は開始時刻。タスクの場合は期限時刻である終了時刻を基準とする）
        $baseTimeStr = $item['start_time'];
        if ($item['item_type'] === 'task') {
            $baseTimeStr = $item['end_time'] ?? $item['start_time'];
        }

        if (empty($baseTimeStr)) {
            continue; // 時間が設定されていないアイテムは通知の判定ができないためスキップ
        }

        // 基準時刻を "HH:MM" 形式に標準化 (秒がついている場合を考慮)
        $baseTime = date('H:i', strtotime($baseTimeStr));

        // アイテムに紐づく通知設定（["0", "5", "15"] などのJSON配列）をデコード
        $notifSettings = [];
        if (!empty($item['notifications'])) {
            $notifSettings = json_decode($item['notifications'], true);
        }

        if (!is_array($notifSettings) || empty($notifSettings)) {
            continue; // 通知設定が空、または正しくない場合はスキップ
        }

        $isTriggerTime = false;
        $triggerLabel = ''; // 通知メッセージに添える「5分前」などのラベル

        // ユーザーが設定した「〇分前」の条件に、今回のチェック範囲が合致するか検証
        foreach ($notifSettings as $offset) {
            $targetTime = $baseTime;
            $targetDate = $currentDate; // ★通知対象の「日付」

            if ($offset === '0') {
                $targetTime = $baseTime;
                $triggerLabel = 'お時間';
            } elseif ($offset === '5') {
                $targetTime = date('H:i', strtotime("-5 minutes", strtotime($currentDate . ' ' . $baseTime)));
                $triggerLabel = '5分前';
            } elseif ($offset === '15') {
                $targetTime = date('H:i', strtotime("-15 minutes", strtotime($currentDate . ' ' . $baseTime)));
                $triggerLabel = '15分前';
            } elseif ($offset === '30') {
                $targetTime = date('H:i', strtotime("-30 minutes", strtotime($currentDate . ' ' . $baseTime)));
                $triggerLabel = '30分前';
            } elseif ($offset === '60') {
                $targetTime = date('H:i', strtotime("-1 hour", strtotime($currentDate . ' ' . $baseTime)));
                $triggerLabel = '1時間前';
            } elseif ($offset === '1day') {
                $triggerLabel = '1日前';

                if ($item['item_type'] === 'habit') {
                    // ★修正：習慣は繰り返し発生するため、「明日がこの習慣の発生日かどうか」を判定し、
                    //   発生日であれば「今日」の同じ時刻を対象にする（＝発生日ごとに毎回前日通知が飛ぶ）
                    //   修正前は item['start_date']（最初の登録日）の前日にしか通知が飛ばないバグがあった
                    $tomorrow = date('Y-m-d', strtotime($currentDate . ' +1 day'));
                    if (!isHabitActiveOnDate($item, $tomorrow)) {
                        continue; // 明日が発生日でなければ、この通知設定はスキップ
                    }
                    $targetDate = $currentDate;
                    $targetTime = $baseTime;
                } else {
                    // タスク・予定は1回きりなので、期日（start_date）の前日が対象のまま
                    $targetDate = date('Y-m-d', strtotime($item['start_date'] . ' -1 day'));
                    $targetTime = $baseTime;
                }
            }

            // 【★バグ修正箇所】計算した日時が「前回実行〜今回実行」のウィンドウ内に入っている場合のみ発火
            if (isTimeInWindow($targetDate, $targetTime, $lastRunDateTime, $currentDateTime)) {
                $isTriggerTime = true;
                break; // 条件に合致したらループを抜ける
            }
        }

        // 通知タイミングに合致した場合、対象ユーザーの配信先トークン（Subscription）をDBから取得
        if ($isTriggerTime) {
            $sql_sub = "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = :user_id";
            $stmt_sub = $pdo->prepare($sql_sub);
            $stmt_sub->execute([':user_id' => $item['user_id']]);
            $subscriptions = $stmt_sub->fetchAll();

            // 配信キュー（配列）に対象ユーザーの全ブラウザ情報を追加していく
            foreach ($subscriptions as $sub) {
                // アイテムの種類に応じて通知の文言（絵文字）を変える
                $typeEmoji = '🔄';
                if ($item['item_type'] === 'task') $typeEmoji = '📋';
                if ($item['item_type'] === 'schedule') $typeEmoji = '📅';

                $notificationsToSend[] = [
                    'subscription' => Subscription::create([
                        'endpoint' => $sub['endpoint'],
                        'publicKey' => $sub['p256dh'],
                        'authToken' => $sub['auth'],
                    ]),
                    'payload' => json_encode([
                        'title' => '⏰ Logmo リマインダー',
                        'body' => '「' . $item['title'] . '」の' . $triggerLabel . 'です。確認しましょう！ ' . $typeEmoji,
                        'icon' => './img/logo.png',
                        'data' => [
                            'itemId' => $item['id'],
                            'recordDate' => $currentDate
                        ],
                        'actions' => [
                            ['action' => 'complete', 'title' => '✅ 完了'],
                            ['action' => 'memo', 'title' => '📝 メモを書いて完了']
                        ]
                    ], JSON_UNESCAPED_UNICODE)
                ];
            }
        }
    }

    // ★今回の実行時刻を記録しておく（次回の判定の基準にする）
    file_put_contents($lastRunFile, $currentDateTime->format('Y-m-d H:i:s'));

    // 4. 送信すべき通知がない場合は、空のレスポンスを返して終了
    if (empty($notificationsToSend)) {
        echo json_encode(['success' => true, 'message' => '現在時刻（' . $currentTime . '）に通知対象となるアイテムはありませんでした。']);
        exit;
    }

    // 5. WebPush認証情報の設定（php/config.php で定義されているVAPIDキーを使用）
    $auth = [
        'VAPID' => [
            'subject' => VAPID_SUBJECT,
            'publicKey' => VAPID_PUBLIC_KEY,
            'privateKey' => VAPID_PRIVATE_KEY,
        ],
    ];

    $webPush = new WebPush($auth);

    // キューにすべての通知データを安全に追加
    foreach ($notificationsToSend as $notification) {
        $webPush->queueNotification(
            $notification['subscription'],
            $notification['payload']
        );
    }

    // まとめて一斉送信
    $results = $webPush->flush();
    $successCount = 0;
    $expiredSubscriptions = [];

    // 6. 送信結果のレポートを解析
    foreach ($results as $report) {
        $endpoint = $report->getEndpoint();
        if ($report->isSuccess()) {
            $successCount++;
        } else {
            if ($report->isSubscriptionExpired()) {
                $expiredSubscriptions[] = $endpoint;
            }
        }
    }

    // 失効した不要な配信先をデータベースから自動削除
    if (!empty($expiredSubscriptions)) {
        $placeholders = implode(',', array_fill(0, count($expiredSubscriptions), '?'));
        $deleteSql = "DELETE FROM push_subscriptions WHERE endpoint IN ($placeholders)";
        $deleteStmt = $pdo->prepare($deleteSql);
        $deleteStmt->execute($expiredSubscriptions);
    }

    // 結果の出力
    echo json_encode([
        'success' => true,
        'current_time' => $currentTime,
        'sent_count' => $successCount,
        'cleaned_count' => count($expiredSubscriptions),
        'message' => 'プッシュ通知のトリガーおよび配信処理が正常に完了しました。'
    ]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false, 
        'error' => $e->getMessage(),
        'message' => 'スクリプトの実行中に致命的なエラーが発生しました。'
    ]);
}