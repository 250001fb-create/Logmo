<?php
// php/functions.php

/**
 * 1. 安全に画面に文字を表示するための関数（XSS対策）
 */
function h($str) {
    return htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
}

/**
 * 2. ログイン状態をチェックする関数
 */
function checkLogin() {
    if (!isset($_SESSION['user_id'])) {
        // phpフォルダから1つ外に出て、index.html（ログイン画面）に強制移動させる
        header('Location: ../index.html');
        exit;
    }
}

/**
 * 3. 指定した日付(dateStr)に該当する項目だけを絞り込む
 *    js側のisItemOnDate()と同じロジックをPHP側でも使えるようにしたもの
 */
function filterItemsForDate($items, $dateStr) {
    $weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    $result = [];

    foreach ($items as $item) {
        $type = $item['type'];

        if ($type === 'schedule') {
            if (empty($item['start_date']) || empty($item['end_date'])) continue;
            if ($item['start_date'] <= $dateStr && $dateStr <= $item['end_date']) {
                $result[] = $item;
            }
        } elseif ($type === 'task') {
            if ($item['start_date'] === $dateStr) {
                $result[] = $item;
            }
        } elseif ($type === 'habit') {
            if (!empty($item['start_date']) && $dateStr < $item['start_date']) continue;
            if (!empty($item['end_date']) && $item['end_date'] !== '9999-12-31' && $dateStr > $item['end_date']) continue;

            if ($item['frequency'] === 'weekly_days' && !empty($item['weekly_days'])) {
                $targetDow = $weekdayLabels[date('w', strtotime($dateStr))];
                $activeDays = array_map('trim', explode(',', $item['weekly_days']));
                if (!in_array($targetDow, $activeDays)) continue;
            }
            $result[] = $item;
        }
    }

    return $result;
}

/**
 * 4. "HH:MM:SS"形式の時刻を"HH:MM"に短縮する（PHP版）
 */
function formatTimeHHMMPhp($timeStr) {
    return !empty($timeStr) ? substr($timeStr, 0, 5) : '';
}

/**
 * 5. アイテムの種類に応じて時間ラベルを組み立てる（js版のgetTimeLabel()と同じロジック）
 */
function getTimeLabelPhp($item) {
    if ($item['type'] === 'task') {
        return !empty($item['end_time']) ? formatTimeHHMMPhp($item['end_time']) . 'まで' : '';
    }
    if (!empty($item['start_time']) && !empty($item['end_time'])) {
        return formatTimeHHMMPhp($item['start_time']) . '〜' . formatTimeHHMMPhp($item['end_time']);
    } elseif (!empty($item['start_time'])) {
        return formatTimeHHMMPhp($item['start_time']) . '〜';
    } elseif (!empty($item['end_time'])) {
        return '〜' . formatTimeHHMMPhp($item['end_time']);
    }
    return '';
}

/**
 * 6. AIに渡す材料（この日の項目＋今週先までのタスク・予定）を組み立てる
 */
function buildAdviceContext($allItems, $dateStr) {
    $typeLabels = ['habit' => '習慣', 'task' => 'タスク', 'schedule' => '予定'];
    $weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

    // --- この日の項目一覧（時間付き） ---
    $dayItems = filterItemsForDate($allItems, $dateStr);
    $todayLines = [];
    foreach ($dayItems as $item) {
        $typeLabel = $typeLabels[$item['type']] ?? $item['type'];
        $timeLabel = getTimeLabelPhp($item);
        $status = !empty($item['is_completed']) ? '完了済み' : '未完了';
        $todayLines[] = "・[{$typeLabel}] {$item['title']}" . ($timeLabel ? "（{$timeLabel}）" : '') . " - {$status}";
    }

    // --- この日から1週間分のタスク・予定一覧（習慣は繰り返しが多く情報過多になるため除外） ---
    $weekLines = [];
    for ($i = 0; $i <= 6; $i++) {
        $loopDate = date('Y-m-d', strtotime($dateStr . " +{$i} day"));
        $loopItems = filterItemsForDate($allItems, $loopDate);
        foreach ($loopItems as $item) {
            if ($item['type'] === 'habit') continue;
            $dow = $weekdayLabels[date('w', strtotime($loopDate))];
            $md = date('n月j日', strtotime($loopDate));
            $dayLabel = ($i === 0) ? '今日' : "{$md}({$dow})";
            $typeLabel = $typeLabels[$item['type']] ?? $item['type'];
            $status = !empty($item['is_completed']) ? '完了済み' : '未完了';
            $weekLines[] = "・{$dayLabel}: [{$typeLabel}] {$item['title']} - {$status}";
        }
    }

    return [
        'todayCount' => count($dayItems),
        'todayText'  => implode("\n", $todayLines),
        'weekText'   => implode("\n", $weekLines),
    ];
}

/**
 * 7. Gemini APIに今日の項目一覧＋週の予定を渡して、一言アドバイスを生成してもらう
 *    エラーや上限到達時は、状況に応じたメッセージを返す
 */
function generateAiAdvice($username, $dateStr, $context) {
    if ($context['todayCount'] === 0 && empty($context['weekText'])) {
        return $username . 'さん、この日はまだ何も登録されていません。新しい習慣やタスクを追加してみましょう！';
    }

    $todayText = $context['todayText'] !== '' ? $context['todayText'] : '（この日の登録項目はありません）';
    $weekText  = $context['weekText'] !== '' ? $context['weekText'] : '（今週、期限付きのタスク・予定は登録されていません）';

    $prompt = "あなたは習慣管理アプリ「Logmo」のアシスタントです。{$username}さんの{$dateStr}向けの一言アドバイスを作成してください。\n\n"
            . "【この日の項目一覧（時間帯付き）】\n{$todayText}\n\n"
            . "【この日から1週間の、タスク・予定一覧】\n{$weekText}\n\n"
            . "以下の観点を参考にして、状況に合った一言アドバイスを日本語で2〜3文・120文字程度で作成してください。\n"
            . "・特定の時間にある項目があれば、その時間を具体的に伝える\n"
            . "・この日の項目数が多い場合は、無理のないペース配分を提案する\n"
            . "・週の中に期限が近いタスクがあれば、それに触れて進捗を尋ねたり、今日中に進めることを勧める\n"
            . "・項目が少ない日は、シンプルに励ますだけでよい\n"
            . "説明や前置き、記号での装飾（＊や【】など）は使わず、アドバイス本文だけを出力してください。";

    if (!defined('GEMINI_API_KEY') || empty(GEMINI_API_KEY) || GEMINI_API_KEY === 'ここに自分のAPIキーを貼る') {
        return 'AIアドバイスを利用するには、APIキーの設定が必要です。';
    }

    // 安定して動作している gemini-3.5-flash を指定
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=' . GEMINI_API_KEY;

    $payload = json_encode([
        'contents' => [
            ['parts' => [['text' => $prompt]]]
        ]
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    // 回数制限（429エラー）の場合、回復までの時間を取得して表示する
    if ($httpCode === 429) {
        $waitTime = 'しばらく時間'; // 時間が取得できなかった場合のデフォルト
        if ($response !== false) {
            $errorData = json_decode($response, true);
            if (isset($errorData['error']['details'])) {
                foreach ($errorData['error']['details'] as $detail) {
                    // APIの返却データから "retryDelay" を見つける
                    if (isset($detail['retryDelay'])) {
                        // "18s" という文字列から "s" を取り除いて数値化
                        $seconds = (int)str_replace('s', '', $detail['retryDelay']);
                        
                        // 秒数が大きい場合は分に変換する配慮
                        if ($seconds > 60) {
                            $minutes = ceil($seconds / 60);
                            $waitTime = "約{$minutes}分";
                        } else {
                            $waitTime = "約{$seconds}秒";
                        }
                        break;
                    }
                }
            }
        }
        return "AIアドバイスの取得回数が上限に達しました。{$waitTime}待ってから、タスクを編集して再度読み込んでください。";
    }

    // 通信失敗、または429以外のエラーの場合
    if ($response === false || $httpCode !== 200) {
        $errorCode = $response === false ? '通信失敗' : $httpCode;
        return "AIアドバイスの取得に失敗しました（エラー: {$errorCode}）。";
    }

    $data = json_decode($response, true);
    if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
        return trim($data['candidates'][0]['content']['parts'][0]['text']);
    }

    return 'AIデータの読み込みに失敗しました。';
}

/**
 * 8. 指定した日付のAIアドバイスを取得する（キャッシュがあればそれを返し、無ければ生成して保存）
 *    home.phpとget_ai_advice.phpの両方から共通で使う
 */
function getOrGenerateAiAdvice($pdo, $userId, $username, $allItems, $dateStr) {
    $stmt = $pdo->prepare("SELECT comment FROM ai_advices WHERE user_id = :user_id AND target_date = :target_date");
    $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $stmt->bindValue(':target_date', $dateStr, PDO::PARAM_STR);
    $stmt->execute();
    $cached = $stmt->fetchColumn();

    if ($cached !== false) {
        return $cached;
    }

    $context = buildAdviceContext($allItems, $dateStr);
    $advice = generateAiAdvice($username, $dateStr, $context);

    $save = $pdo->prepare(
        "INSERT INTO ai_advices (user_id, target_date, comment) VALUES (:user_id, :target_date, :comment)
         ON DUPLICATE KEY UPDATE comment = VALUES(comment)"
    );
    $save->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $save->bindValue(':target_date', $dateStr, PDO::PARAM_STR);
    $save->bindValue(':comment', $advice, PDO::PARAM_STR);
    $save->execute();

    return $advice;
}

/**
 * 9. そのユーザーのAIアドバイスキャッシュを全て削除する（項目が変更された時に呼ぶ）
 *    習慣のように長期間・複数日に影響する項目でも、日付ごとに追いかける必要がなくなる
 */
function invalidateAllAiAdvice($pdo, $userId) {
    $stmt = $pdo->prepare("DELETE FROM ai_advices WHERE user_id = :user_id");
    $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $stmt->execute();
}
?>