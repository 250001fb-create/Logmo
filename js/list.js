// js/list.js

let allItems = [];         // データベースから取得した全アイテム
let currentTab = 'habit';  // 現在表示中のタブ（habit, task, schedule）
let dayRecords = {}; //[cite: 4]

// 通知の設定値 → 表示ラベルの対応表[cite: 4]
const NOTIFICATION_LABELS = { '0': 'ぴったり', '5': '5分前', '15': '15分前', '30': '30分前', '60': '1時間前', '1day': '1日前' }; //[cite: 4]
const FREQUENCY_LABELS = { 'daily': '毎日', 'weekly_days': '指定した曜日', 'weekly_once': '週に1回', 'monthly': '月ごと', 'yearly': '年ごと' }; //[cite: 4]

function isItemCompletedForDate(item) { //[cite: 4]
    if (item.type === 'habit') { const rec = dayRecords[item.id]; return !!(rec && rec.status === 'done'); } //[cite: 4]
    return !!item.is_completed; //[cite: 4]
} //[cite: 4]

async function fetchDayRecords(dateStr) { //[cite: 4]
    try { //[cite: 4]
        const response = await fetch(`php/get_records.php?date=${encodeURIComponent(dateStr)}`, { cache: 'no-store' }); //[cite: 8]
        if (!response.ok) throw new Error('ネットワークエラー'); //[cite: 4]
        const data = await response.json(); dayRecords = (data.success && data.records) ? data.records : {}; //[cite: 4]
    } catch (error) { console.error('通信エラー（記録の取得）:', error); dayRecords = {}; } //[cite: 4]
} //[cite: 4]

window.onItemSaved = async () => { await fetchAllItems(); await fetchDayRecords(formatDateISO(new Date())); renderTab(currentTab); }; //[cite: 4]

document.addEventListener('DOMContentLoaded', async () => {
    await fetchAllItems();
    await fetchDayRecords(formatDateISO(new Date())); //[cite: 4]
    setupTabs();
    setupSearchEvents(); // 🔍 検索・ソートイベントのセットアップを追加
    renderTab(currentTab);

    setupItemActionDelegation(
        document.getElementById('tabContent'),
        async () => { await fetchAllItems(); await fetchDayRecords(formatDateISO(new Date())); renderTab(currentTab); }, //[cite: 4]
        (itemId) => allItems.find(item => String(item.id) === String(itemId)), //[cite: 4]
        () => formatDateISO(new Date()) //[cite: 4]
    );
});

/**
 * 🔍 検索・ソート用イベントリスナーの登録
 */
function setupSearchEvents() {
    const searchName = document.getElementById('searchName');
    const searchDate = document.getElementById('searchDate');
    const clearDateBtn = document.getElementById('clearDateBtn');
    const sortOrder = document.getElementById('sortOrder');

    // 文字入力や選択が変わるたびに再描画関数を呼び出す
    searchName.addEventListener('input', () => renderTab(currentTab));
    searchDate.addEventListener('change', () => renderTab(currentTab));
    sortOrder.addEventListener('change', () => renderTab(currentTab));

    // 日付クリアボタンの挙動
    clearDateBtn.addEventListener('click', () => {
        searchDate.value = '';
        renderTab(currentTab);
    });
}

function formatDateISO(dateObj) { const y = dateObj.getFullYear(); const m = String(dateObj.getMonth() + 1).padStart(2, '0'); const d = String(dateObj.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; } //[cite: 4]

async function fetchAllItems() { //[cite: 4]
    const container = document.getElementById('tabContent'); //[cite: 4]
    try { //[cite: 4]
        const response = await fetch('php/home.php'); if (!response.ok) throw new Error('ネットワークエラー'); //[cite: 4, 7]
        const data = await response.json(); if (data.success) { allItems = data.items; } else { if (data.error === 'not_logged_in') { handleSessionExpired(); } } //[cite: 4]
    } catch (error) { console.error('通信エラー:', error); } //[cite: 4]
} //[cite: 4]

function setupTabs() { //[cite: 4]
    const tabButtons = document.querySelectorAll('.tab-btn'); //[cite: 4]
    tabButtons.forEach(button => { button.addEventListener('click', () => { tabButtons.forEach(btn => btn.classList.remove('active')); button.classList.add('active'); currentTab = button.getAttribute('data-type'); renderTab(currentTab); }); }); //[cite: 4]
} //[cite: 4]

/**
 * 指定した種類に加え、検索・ソート条件を適用して一覧描画する
 */
function renderTab(type) {
    const container = document.getElementById('tabContent');
    if (!container) return;

    container.innerHTML = '';

    // 1. タブの種類でまず絞り込み
    let items = allItems.filter(item => item.type === type);

    // 2. 🔍 名前での部分一致検索を追加
    const nameInput = document.getElementById('searchName');
    const nameKeyword = nameInput ? nameInput.value.trim().toLowerCase() : '';
    if (nameKeyword) {
        items = items.filter(item => item.title && item.title.toLowerCase().includes(nameKeyword));
    }

    // 3. 🔍 日付での検索を追加（期間・期限内に入っているか判定）
    const dateInput = document.getElementById('searchDate');
    const dateKeyword = dateInput ? dateInput.value : '';
    if (dateKeyword) {
        items = items.filter(item => {
            const start = item.start_date;
            const end = (item.type === 'task') ? item.start_date : (item.end_date || '9999-12-31');
            return (dateKeyword >= start && dateKeyword <= end);
        });
    }

    // 4. 🔄 ソート処理を追加
    // 4. 🔄 ソート処理を追加
    const orderSelect = document.getElementById('sortOrder');
    const order = orderSelect ? orderSelect.value : 'date_near';
    const todayStr = formatDateISO(new Date()); // 今日の日付 (YYYY-MM-DD形式)[cite: 4]
    
    // JSエラー対策：ここで確実にミリ秒換算の数値を定義します
    const todayTime = new Date(todayStr).getTime();

    items.sort((a, b) => {
        if (order === 'title_asc') {
            return a.title.localeCompare(b.title, 'ja');
        } else if (order === 'title_desc') {
            return b.title.localeCompare(a.title, 'ja');
        } else if (order === 'date_near' || order === 'date_far') {
            const timeA = new Date(a.start_date).getTime();
            const timeB = new Date(b.start_date).getTime();

            // 今日を過ぎている（過去）かどうかの判定フラグ
            const isPastA = timeA < todayTime;
            const isPastB = timeB < todayTime;

            // 過去のものは未来のものより後ろに配置する共通ルール
            if (isPastA !== isPastB) {
                return isPastA ? 1 : -1; // 過去である方を後ろにする
            }

            // 両方とも未来、または両方とも過去の場合の並び替え
            if (order === 'date_near') {
                return timeA - timeB; // 期日が近い順（日付の昇順）
            } else {
                return timeB - timeA; // 期日が遠い順（日付の降順）
            }
        }
        return 0;
    });

    // 5. 描画
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">条件に一致する項目はありません</p>';
        return;
    }

    items.forEach(item => {
        container.appendChild(buildItemCard(item));
    });
}

/**
 * 1件のアイテムを、既存のダミーデータと同じ見た目のカードDOMに変換する
 */
function buildItemCard(item) {
    const card = document.createElement('div');
    card.className = `item-card card-${item.type}`;

    // --- ステータスバッジ ---
    const completedForToday = isItemCompletedForDate(item);
    let statusClass = 'status-ongoing';
    let statusLabel = '進行中';
    if (completedForToday) {
        statusClass = 'status-done';
        statusLabel = '完了';
    } else if (item.type === 'task') {
        statusClass = 'status-todo';
        statusLabel = '未着手';
    }

    // --- 習慣のみ：頻度の行 ---
    let frequencyRowHTML = '';
    if (item.type === 'habit') {
        let freqText = FREQUENCY_LABELS[item.frequency] || item.frequency || '毎日';
        if (item.frequency === 'weekly_days' && item.weekly_days) {
            freqText = `毎週 ${item.weekly_days}`;
        }
        frequencyRowHTML = `<div class="streak-info">📌 頻度: ${freqText}</div>`;
    }

    // --- 期間・期限の行 ---
    let periodLabel = '';
    if (item.type === 'task') {
        periodLabel = `<div><span class="detail-label">期限:</span>${formatSlashDate(item.start_date)}</div>`;
    } else {
        const endText = (!item.end_date || item.end_date === '9999-12-31') ? '制限なし' : formatSlashDate(item.end_date);
        periodLabel = `<div><span class="detail-label">期間:</span>${formatSlashDate(item.start_date)} 〜 ${endText}</div>`;
    }

    // --- 時間帯・時刻の行 ---
    const timeLabel = getTimeLabel(item) || 'なし';

    // --- 通知の行 ---
    const notificationBadges = getNotificationBadgesHTML(item);
    const notificationLabel = notificationBadges || 'なし';

    // --- 完了状態に応じて「完了」ボタンか「戻す」ボタンを出し分ける ---
    const completeButtonHTML = completedForToday
        ? `<button class="control-btn btn-revert" data-id="${item.id}" data-action="revert">↩️ 戻す</button>`
        : `<button class="control-btn btn-complete" data-id="${item.id}" data-action="complete">✅ 完了</button>`;

    // --- 今日のメモ（あれば表示、無ければカレンダーへの案内） ---
    const todayRecord = dayRecords[item.id];
    const todayMemo = (todayRecord && todayRecord.memo && todayRecord.memo.trim() !== '') ? todayRecord.memo : '';
    const memoRowHTML = todayMemo
        ? `<p style="font-size: 12px; color: #6a4a00; background: #fff8e1; padding: 6px 10px; border-radius: 4px; margin: -4px 0 12px;">📝 今日のメモ: ${h(todayMemo)}</p>`
        : `<p style="font-size: 11px; color: #999; margin: -8px 0 12px;">📝 メモはその日限りの記録です。カレンダーで日付を選ぶと確認できます。</p>`;

    card.innerHTML = `
        <div class="card-header">
            <span class="item-title">${h(item.title)}</span>
            <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>
        ${frequencyRowHTML}
        <div class="detail-info">
            ${periodLabel}
            <div><span class="detail-label">時間:</span>${timeLabel}</div>
            <div><span class="detail-label">通知:</span>${notificationLabel}</div>
        </div>
        ${memoRowHTML}
        <div class="card-actions">
            ${completeButtonHTML}
            <button class="control-btn btn-edit" data-id="${item.id}" data-action="edit">✏️ 変更</button>
            <button class="control-btn btn-delete" data-id="${item.id}" data-action="delete">🗑️ 削除</button>
        </div>
    `;

    return card;
}

/**
 * 簡易的なHTMLエスケープ（XSS対策）
 */
function h(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * "YYYY-MM-DD" → "YYYY/MM/DD" に変換する
 */
function formatSlashDate(dateStr) {
    if (!dateStr) return '未設定';
    return dateStr.replaceAll('-', '/');
}

/**
 * "HH:MM:SS" 形式の時刻文字列を "HH:MM" に短縮する
 */
function formatTimeHHMM(timeStr) {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
}

/**
 * アイテムの種類に応じて、表示する時間ラベルを組み立てる
 */
function getTimeLabel(item) {
    if (item.type === 'task') {
        return item.end_time ? `${formatTimeHHMM(item.end_time)}まで` : '';
    }

    if (item.start_time && item.end_time) {
        return `${formatTimeHHMM(item.start_time)}〜${formatTimeHHMM(item.end_time)}`;
    } else if (item.start_time) {
        return `${formatTimeHHMM(item.start_time)}〜`;
    } else if (item.end_time) {
        return `〜${formatTimeHHMM(item.end_time)}`;
    }
    return '';
}

/**
 * アイテムのnotifications（JSON文字列）を、通知バッジのHTMLに変換する
 */
function getNotificationBadgesHTML(item) {
    if (!item.notifications) return '';

    let notificationList;
    try {
        notificationList = JSON.parse(item.notifications);
    } catch (e) {
        return '';
    }

    if (!Array.isArray(notificationList) || notificationList.length === 0) return '';

    return notificationList.map(value => {
        const label = NOTIFICATION_LABELS[value] || value;
        return `<span style="font-size: 11px; padding: 2px 6px; background: #fff3e0; color: #ef6c00; border-radius: 4px; margin-right: 4px; display: inline-block;">🔔${label}</span>`;
    }).join('');
}

// 既存の buildItemCard, h, formatSlashDate, formatTimeHHMM, getTimeLabel, getNotificationBadgesHTML はそのまま[cite: 4]