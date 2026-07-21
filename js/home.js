// js/home.js

// 全体のデータを保持する変数
let allItems = [];
// 現在選択されているフィルター（初期値はすべて）
let currentFilter = 'all';
// 現在選択されている日付（初期値は今日, 'YYYY-MM-DD'形式）
let selectedDate = formatDateISO(new Date());
// ★選択中の日付に紐づく「その日の記録」（メモなど）。item_id をキーにしたオブジェクト
let dayRecords = {};

// 曜日の配列（DateオブジェクトのgetDay()の並び順と対応）
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * DateオブジェクトをローカルタイムのままYYYY-MM-DD文字列に変換する
 * （toISOString()はUTC変換されるためズレが出ることがあるので使わない）
 */
function formatDateISO(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 簡易的なHTMLエスケープ（メモなど自由入力のテキストを表示する際のXSS対策）
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * ★新規追加：指定した日付の「その日の記録」（メモなど）を取得する
 * php/get_records.php から item_id をキーにしたオブジェクトが返ってくる
 */
async function fetchDayRecords(dateStr) {
    try {
        const response = await fetch(`php/get_records.php?date=${encodeURIComponent(dateStr)}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('ネットワークエラー');

        const data = await response.json();
        dayRecords = (data.success && data.records) ? data.records : {};
    } catch (error) {
        console.error('通信エラー（記録の取得）:', error);
        dayRecords = {};
    }
}

/**
 * ★習慣は日付ごとに完了状態が変わる（records で管理）ため、
 *   item.is_completed をそのまま使わず、選択中の日付の記録を見て判定する。
 * タスク・予定は1回きりの項目なので、今まで通り item.is_completed を使う。
 */
function isItemCompletedForDate(item) {
    if (item.type === 'habit') {
        const rec = dayRecords[item.id];
        return !!(rec && rec.status === 'done');
    }
    return !!item.is_completed;
}

// ★modal.js（追加モーダル）から、今カレンダーで選ばれている日付を参照できるようにする
window.getHomeSelectedDate = () => selectedDate;

// ★modal.js から保存成功時に呼ばれる再描画処理。
//   window.location.reload() を使わずに済むようにし、選択中の日付を維持したままデータだけ更新する。
//   項目一覧だけでなく、AIアドバイスのキャッシュもサーバー側で無効化されているため、
//   ここで選択中の日付のAIアドバイスも取得し直す。
window.onItemSaved = async () => {
    await fetchHomeData();
    fetchAiAdvice(selectedDate);
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 最初にデータをデータベースから読み込む
    await fetchHomeData();
    fetchAiAdvice(selectedDate); // ★AIアドバイスは待たずにバックグラウンドで進める

    // 2. ログアウトボタンのクリックイベントを設定
    setupLogout();

    // 3. フィルターボタンのクリックイベントを設定（※抜けていた部分）
    setupFilters();

    // 4. 今日の日付情報をカレンダーに反映
    setupCalendar();

    // 5. 完了・変更・削除ボタンの処理を設定（成功したら一覧を再取得して再描画）
    setupItemActionDelegation(
        document.getElementById('taskContainer'),
        async () => {
            await fetchHomeData();
            // ★完了・差し戻し・削除で状況が変わったので、AIアドバイスも取り直す
            fetchAiAdvice(selectedDate);
        },
        (itemId) => allItems.find(item => String(item.id) === String(itemId)),
        () => selectedDate // ★完了時のメモは「今選んでいる日付」に紐付ける
    );
});

/**
 * ★新規追加：指定した日付のAIアドバイスを取得して画面に反映する
 *    項目一覧の取得（fetchHomeData）とは切り離し、非同期・並行で行う
 */
async function fetchAiAdvice(dateStr) {
    const aiAdviceArea = document.getElementById('aiAdviceArea');
    if (!aiAdviceArea) return;

    aiAdviceArea.textContent = '🤖 考え中...';

    try {
        const response = await fetch(`php/get_ai_advice.php?date=${encodeURIComponent(dateStr)}`, { cache: 'no-store' });
        const data = await response.json();
        aiAdviceArea.textContent = data.success ? data.ai_advice : 'アドバイスの取得に失敗しました。';
    } catch (error) {
        aiAdviceArea.textContent = 'アドバイスの取得に失敗しました。';
    }
}

/**
 * データベースからホーム画面のデータを取得して画面に表示する
 */
async function fetchHomeData() {
    const taskContainer = document.getElementById('taskContainer');
    const usernameArea = document.getElementById('usernameArea');
    const aiAdviceArea = document.getElementById('aiAdviceArea');

    try {
        // php/home.php に通信してデータをねだる
        const response = await fetch('php/home.php');
        
        if (!response.ok) throw new Error('ネットワークエラー');

        const data = await response.json();

        if (data.success) {
            // データを変数に保存
            allItems = data.items;

            // ユーザー名を画面に反映（AIアドバイスは別関数で非同期に取得する）
            if (usernameArea) usernameArea.textContent = data.username;

            // ★選択中の日付のメモ（記録）も一緒に取得してから描画する
            await fetchDayRecords(selectedDate);

            // ★抜けていた部分：取得したデータを画面に描画する
            renderItems();
        } else {
            if (data.error === 'not_logged_in') {
                handleSessionExpired();
            } else {
                console.error('エラー:', data.error, data.message);
            }
        }
    } catch (error) {
        console.error('通信エラー:', error);
        if (taskContainer) {
            taskContainer.innerHTML = '<p style="text-align: center; color: #c62828;">データの取得に失敗しました。</p>';
        }
    }
}

/**
 * ★完全新規追加：アイテムを画面（taskContainer）に描画する関数
 */
function renderItems() {
    const container = document.getElementById('taskContainer');
    if (!container) return;

    container.innerHTML = ''; // 一旦中身をリセット

    // 現在のフィルター（all, habit, task, schedule）と、選択中の日付の両方で絞り込み
    const filteredItems = allItems.filter(item => {
        const typeMatch = (currentFilter === 'all') || (item.type === currentFilter);
        const dateMatch = isItemOnDate(item, selectedDate);
        return typeMatch && dateMatch;
    });

    // データが0件の場合のメッセージ
    if (filteredItems.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999999;">予定・タスクはありません</p>';
        return;
    }

    // 絞り込んだデータをループしてHTMLを作成
    filteredItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'task-item'; // CSSに合わせてクラス名を付与
        itemDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #eeeeee;';
        
        // 種類に応じたバッジのラベルを設定
        let typeLabel = '';
        if (item.type === 'habit') typeLabel = '習慣';
        else if (item.type === 'task') typeLabel = 'タスク';
        else if (item.type === 'schedule') typeLabel = '予定';

        // 完了状態に応じた取り消し線（習慣はその日の記録、タスク・予定は項目自体の状態で判定）
        const completedForThisDate = isItemCompletedForDate(item);
        const textStyle = completedForThisDate ? 'text-decoration: line-through; color: #999;' : '';

        // ★時間・通知バッジのHTMLを組み立てる
        const timeLabel = getTimeLabel(item);
        const notificationBadgesHTML = getNotificationBadgesHTML(item);
        const hasSubRow = timeLabel || notificationBadgesHTML;

        // ★この日付に保存されているメモがあれば表示する（その日限りのメモ）
        const dayRecord = dayRecords[item.id];
        const memoText = (dayRecord && dayRecord.memo && dayRecord.memo.trim() !== '') ? dayRecord.memo : '';

        // ★完了状態に応じて「完了」ボタンか「戻す」ボタンを出し分ける
        const completeButtonHTML = completedForThisDate
            ? `<button class="control-btn btn-revert" data-id="${item.id}" data-action="revert">↩️ 戻す</button>`
            : `<button class="control-btn btn-complete" data-id="${item.id}" data-action="complete">✅ 完了</button>`;

        // リストの見た目を作成（左：内容、右：操作ボタン）
        itemDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 12px; padding: 2px 6px; background: #e0f7fa; color: #00838f; border-radius: 4px;">${typeLabel}</span>
                    <span style="${textStyle} flex-grow: 1;">${escapeHtml(item.title)}</span>
                </div>
                ${hasSubRow ? `
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    ${timeLabel ? `<span style="font-size: 12px; color: #00838f; font-weight: bold;">${timeLabel}</span>` : ''}
                    ${notificationBadgesHTML}
                </div>` : ''}
                ${memoText ? `<div style="font-size: 12px; color: #6a4a00; background: #fff8e1; padding: 4px 8px; border-radius: 4px;">📝 ${escapeHtml(memoText)}</div>` : ''}
            </div>
            <div class="task-actions-right">
                ${completeButtonHTML}
                <button class="control-btn btn-edit" data-id="${item.id}" data-action="edit">✏️ 変更</button>
                <button class="control-btn btn-delete" data-id="${item.id}" data-action="delete">🗑️ 削除</button>
            </div>
        `;
        container.appendChild(itemDiv);
    });
}

/**
 * ★新規追加："HH:MM:SS" 形式の時刻文字列を "HH:MM" に短縮する
 */
function formatTimeHHMM(timeStr) {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
}

/**
 * ★新規追加：アイテムの種類に応じて、表示する時間ラベルを組み立てる
 * ・習慣／予定：開始時刻〜終了時刻
 * ・タスク：期限時刻（終了時刻）のみ
 */
function getTimeLabel(item) {
    if (item.type === 'task') {
        return item.end_time ? `⏰${formatTimeHHMM(item.end_time)}まで` : '';
    }

    // 習慣・予定
    if (item.start_time && item.end_time) {
        return `⏰${formatTimeHHMM(item.start_time)}〜${formatTimeHHMM(item.end_time)}`;
    } else if (item.start_time) {
        return `⏰${formatTimeHHMM(item.start_time)}〜`;
    } else if (item.end_time) {
        return `⏰〜${formatTimeHHMM(item.end_time)}`;
    }
    return '';
}

// 通知の設定値 → 表示ラベルの対応表（modal.jsの選択肢と対応させる）
const NOTIFICATION_LABELS = {
    '0': 'ぴったり',
    '5': '5分前',
    '15': '15分前',
    '30': '30分前',
    '60': '1時間前',
    '1day': '1日前'
};

/**
 * ★新規追加：アイテムのnotifications（JSON文字列）を、通知バッジのHTMLに変換する
 */
function getNotificationBadgesHTML(item) {
    if (!item.notifications) return '';

    let notificationList;
    try {
        notificationList = JSON.parse(item.notifications);
    } catch (e) {
        return ''; // 壊れたデータが入っていた場合は何も表示しない
    }

    if (!Array.isArray(notificationList) || notificationList.length === 0) return '';

    return notificationList.map(value => {
        const label = NOTIFICATION_LABELS[value] || value;
        return `<span style="font-size: 11px; padding: 2px 6px; background: #fff3e0; color: #ef6c00; border-radius: 4px;">🔔${label}</span>`;
    }).join('');
}

/**
 * ★新規追加：指定した日付(dateStr: 'YYYY-MM-DD')にアイテムが該当するかどうかを判定する
 */
function isItemOnDate(item, dateStr) {
    if (item.type === 'schedule') {
        // 予定：開始日〜終了日の範囲内かどうか
        if (!item.start_date || !item.end_date) return false;
        return item.start_date <= dateStr && dateStr <= item.end_date;
    }

    if (item.type === 'task') {
        // タスク：期限日（start_date = end_date）に一致するかどうか
        return item.start_date === dateStr;
    }

    if (item.type === 'habit') {
        // 習慣：まず期間（開始日〜終了日）に入っているかを確認
        if (item.start_date && dateStr < item.start_date) return false;
        if (item.end_date && item.end_date !== '9999-12-31' && dateStr > item.end_date) return false;

        // 「指定した曜日だけやる」習慣は、その曜日かどうかもチェック
        if (item.frequency === 'weekly_days' && item.weekly_days) {
            const targetDow = WEEKDAY_LABELS[new Date(dateStr).getDay()];
            const activeDays = item.weekly_days.split(',').map(d => d.trim());
            return activeDays.includes(targetDow);
        }

        // daily / weekly_once / monthly / yearly は、期間内であれば表示する（簡易対応）
        return true;
    }

    return true;
}

/**
 * ★完全新規追加：フィルターボタンの切り替えを設定する関数
 */
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // 全ボタンから 'active' クラスを外し、クリックされたボタンにだけ付ける
            filterButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            // フィルターの種類を更新して、リストを再描画
            currentFilter = e.target.getAttribute('data-type');
            renderItems();
        });
    });
}

/**
 * ログアウト処理
 */
function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('ログアウトしますか？')) {
            window.location.href = 'php/logout.php';
        }
    });
}

/**
 * 現在の月を表示し、今日を基準にした1週間分のカレンダーを自動生成する
 */
function setupCalendar() {
    const now = new Date();

    const weeklyDaysContainer = document.getElementById('weeklyDays');
    if (!weeklyDaysContainer) return;

    weeklyDaysContainer.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const targetDate = new Date();
        targetDate.setDate(now.getDate() + i);

        const dateStr = formatDateISO(targetDate);
        const dayName = WEEKDAY_LABELS[targetDate.getDay()];
        const dateNum = targetDate.getDate();

        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.dataset.date = dateStr; // ★この日付を後でクリック判定に使う

        // 0番目（今日）を初期選択状態にする
        if (i === 0) {
            dayDiv.classList.add('active-day');
        }

        dayDiv.innerHTML = `
            <span>${dayName}</span>
            <br>
            <strong>${dateNum}</strong>
        `;

        // ★日付をクリックしたら、その日を選択状態にして下のタスク一覧を更新する
        dayDiv.addEventListener('click', async () => {
            selectedDate = dateStr;

            // 見た目上の「選択中」表示を切り替え
            weeklyDaysContainer.querySelectorAll('.day').forEach(d => d.classList.remove('active-day'));
            dayDiv.classList.add('active-day');

            // タイトルや見出しを選択した日付に更新
            updateDateDisplays(targetDate);

            // ★選択した日付のメモ（記録）を取得し直してから再描画する
            await fetchDayRecords(selectedDate);

            // タスク一覧を選択した日付のもので再描画
            renderItems();

            // ★選んだ日付のAIアドバイスを取得し直す
            fetchAiAdvice(selectedDate);
        });

        weeklyDaysContainer.appendChild(dayDiv);
    }

    // 初期表示（今日）のタイトル・見出しをセット
    updateDateDisplays(now);
}

/**
 * ★新規追加：選択された日付に合わせて、カレンダータイトルとタスク見出しを更新する
 */
function updateDateDisplays(dateObj) {
    const calendarTitle = document.getElementById('calendarTitle');
    if (calendarTitle) {
        calendarTitle.textContent = `${dateObj.getFullYear()}年 ${dateObj.getMonth() + 1}月`;
    }

    const taskSectionTitle = document.getElementById('taskSectionTitle');
    if (taskSectionTitle) {
        const todayStr = formatDateISO(new Date());
        const dateStr = formatDateISO(dateObj);
        if (dateStr === todayStr) {
            taskSectionTitle.textContent = '本日の予定・タスク';
        } else {
            const dayName = WEEKDAY_LABELS[dateObj.getDay()];
            taskSectionTitle.textContent = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日(${dayName})の予定・タスク`;
        }
    }
}

// ==========================================
// ★プッシュ通知（Service Worker）用の処理
// ==========================================
const VAPID_PUBLIC_KEY = 'BBA8CT3pinGdUHtj9Jm8_iP5guH5B3qEqXV__sWqSvgDmAb9C4JwuiN5WAs_PYe4JAX-mpUEwfBHFI4KSYYNEeg';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function initPushSubscription(registration) {
    registration.pushManager.getSubscription()
        .then(subscription => {
            if (subscription === null) {
                return registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });
            }
            return subscription;
        })
        .then(subscription => sendSubscriptionToServer(subscription))
        .catch(error => console.error('通知の許可が得られなかったか、エラーが発生しました:', error));
}

function sendSubscriptionToServer(subscription) {
    const key = subscription.getKey ? subscription.getKey('p256dh') : null;
    const auth = subscription.getKey ? subscription.getKey('auth') : null;

    const p256dhStr = key ? btoa(String.fromCharCode.apply(null, new Uint8Array(key))) : null;
    const authStr = auth ? btoa(String.fromCharCode.apply(null, new Uint8Array(auth))) : null;

    return fetch('php/save_subscription.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: { p256dh: p256dhStr, auth: authStr }
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) console.log('通知先情報の保存に成功しました！');
        else console.error('通知先情報の保存に失敗:', data.error);
    })
    .catch(err => console.error('サーバー通信エラー:', err));
}

if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.register('sw.js')
        .then(() => navigator.serviceWorker.ready) // ★本当に有効化されるまで待つ
        .then(registration => {
            console.log('Service Worker の登録に成功:', registration);
            initPushSubscription(registration);
        })
        .catch(error => console.error('Service Worker の登録に失敗:', error));
}