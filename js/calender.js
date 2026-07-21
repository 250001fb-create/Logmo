// js/calender.js

let currentViewDate = new Date(); // 現在表示している月の基準
let selectedDateStr = "";        // 選択中の日付 (YYYY-MM-DD)

// home.js と共通のデータ・ロジック
let allItems = [];                // データベースから取得した全アイテム
let currentFilter = 'all';        // 現在選択中のフィルター（all, habit, task, schedule）
// ★選択中の日付に紐づく「その日の記録」（メモなど）。item_id をキーにしたオブジェクト
let dayRecords = {};

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

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
window.getHomeSelectedDate = () => selectedDateStr || formatDateISO(new Date());

/**
 * ★新規追加：指定した日付のAIアドバイスを取得して calendarAiAdvice に反映する
 *   selectDate() と onItemSaved の両方から呼べるように切り出した
 */
function fetchCalendarAiAdvice(dateStr) {
    const calendarAiAdvice = document.getElementById('calendarAiAdvice');
    if (!calendarAiAdvice) return;

    calendarAiAdvice.textContent = '🤖 考え中...';
    fetch(`php/get_ai_advice.php?date=${encodeURIComponent(dateStr)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                calendarAiAdvice.textContent = data.ai_advice;
            } else {
                calendarAiAdvice.textContent = 'アドバイスの取得に失敗しました。';
            }
        })
        .catch(() => {
            calendarAiAdvice.textContent = 'アドバイスの取得に失敗しました。';
        });
}

// ★modal.js から保存成功時に呼ばれる再描画処理。
//   window.location.reload() を使わずに済むようにし、選択中の日付を維持したままデータだけ更新する。
//   項目一覧だけでなく、AIアドバイスのキャッシュもサーバー側で無効化されているため、
//   ここで選択中の日付のAIアドバイスも取得し直す。
window.onItemSaved = async () => {
    await fetchAllItems();
    await fetchDayRecords(selectedDateStr);
    renderCalendar();
    renderCalendarItems();
    if (selectedDateStr) {
        fetchCalendarAiAdvice(selectedDateStr);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. データベースから全アイテムを読み込む
    await fetchAllItems();

    // 2. カレンダーの初期表示（この中で最初からプルダウンを組み立てます）
    renderCalendar();

    // 3. 前の月へ移動するボタンのイベント
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() - 1);
        renderCalendar();
    });

    // 4. 次の月へ移動するボタンのイベント
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() + 1);
        renderCalendar();
    });

    // 5. モーダルの開閉イベント
    setupModalEvents();

    // 6. フィルターボタン（すべて／習慣／タスク／予定）のイベント
    setupFilters();

    // 7. 今日の日付を初期選択状態にする（home.htmlと同じ挙動）
    await selectDate(formatDateISO(new Date()), new Date());

    // 8. 完了・変更・削除ボタンの処理を設定
    //    成功したら全データを再取得し、カレンダー（マーク）とタスク一覧の両方を再描画する
    setupItemActionDelegation(
        document.getElementById('calendarTaskContainer'),
        async () => {
            await fetchAllItems();
            await fetchDayRecords(selectedDateStr);
            renderCalendar();
            renderCalendarItems();
            // ★完了・差し戻し・削除で状況が変わったので、AIアドバイスも取り直す
            //   （サーバー側は complete_item.php / delete_item.php で既にキャッシュを削除済みなので、
            //    ここで再取得すれば新しい内容が生成される）
            if (selectedDateStr) {
                fetchCalendarAiAdvice(selectedDateStr);
            }
        },
        (itemId) => allItems.find(item => String(item.id) === String(itemId)),
        () => selectedDateStr // ★完了時のメモは「選択中の日付」に紐付ける
    );
});

/**
 * DateオブジェクトをローカルタイムのままYYYY-MM-DD文字列に変換する
 */
function formatDateISO(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * php/home.php からログイン中ユーザーの全アイテムを取得する
 */
async function fetchAllItems() {
    try {
        const response = await fetch('php/home.php');
        if (!response.ok) throw new Error('ネットワークエラー');

        const data = await response.json();

        if (data.success) {
            allItems = data.items;
        } else {
            if (data.error === 'not_logged_in') {
                handleSessionExpired();
            } else {
                console.error('エラー:', data.error);
            }
        }
    } catch (error) {
        console.error('通信エラー:', error);
        const container = document.getElementById('calendarTaskContainer');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #c62828;">データの取得に失敗しました。</p>';
        }
    }
}

/**
 * 月間カレンダーを計算して画面に描画する関数
 */
function renderCalendar() {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth(); // 0 = 1月, 5 = 6月...

    // -------------------------------------------------------------
    // 真ん中の表示を「自然なプルダウン」にする
    // -------------------------------------------------------------
    const currentMonthText = document.getElementById('currentMonthText');
    if (currentMonthText) {
        let yearOptions = '';
        for (let y = year - 5; y <= year + 5; y++) {
            yearOptions += `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`;
        }

        let monthOptions = '';
        for (let m = 1; m <= 12; m++) {
            monthOptions += `<option value="${m}" ${m === (month + 1) ? 'selected' : ''}>${m}</option>`;
        }

        currentMonthText.innerHTML = `
            <select id="selectYear" style="font-size: 18px; font-weight: bold; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">${yearOptions}</select> 年
            <select id="selectMonth" style="font-size: 18px; font-weight: bold; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">${monthOptions}</select> 月
        `;

        document.getElementById('selectYear').addEventListener('change', (e) => {
            currentViewDate.setFullYear(parseInt(e.target.value, 10));
            renderCalendar();
        });
        document.getElementById('selectMonth').addEventListener('change', (e) => {
            currentViewDate.setMonth(parseInt(e.target.value, 10) - 1);
            renderCalendar();
        });
    }
    // -------------------------------------------------------------

    const daysGrid = document.getElementById('daysGrid');
    if (!daysGrid) return;
    daysGrid.innerHTML = '';

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const totalDays = lastDayOfMonth.getDate();

    let startDayIdx = firstDayOfMonth.getDay();
    if (startDayIdx === 0) startDayIdx = 7;
    startDayIdx = startDayIdx - 1;

    // 1. 1日が始まる前の空欄を埋める
    for (let i = 0; i < startDayIdx; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'day empty';
        daysGrid.appendChild(emptyDiv);
    }

    // 2. 1日から最終日までを描画
    const today = new Date();
    for (let day = 1; day <= totalDays; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-cell';

        const currentLoopDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const loopDateObj = new Date(year, month, day);

        // ★その日にある項目の種類（habit / task / schedule）を判定してマークを作る
        const typesOnDay = getItemTypesOnDate(currentLoopDateStr);
        const marksHTML = typesOnDay.length > 0
            ? `<div class="day-marks">${typesOnDay.map(t => `<span class="mark mark-${t}"></span>`).join('')}</div>`
            : '';

        dayDiv.innerHTML = `<span class="day-num">${day}</span>${marksHTML}`;

        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
            dayDiv.classList.add('today');
        }

        if (currentLoopDateStr === selectedDateStr) {
            dayDiv.classList.add('selected-day');
        }

        dayDiv.addEventListener('click', async () => {
            const prevSelected = document.querySelector('.selected-day');
            if (prevSelected) prevSelected.classList.remove('selected-day');

            dayDiv.classList.add('selected-day');
            await selectDate(currentLoopDateStr, loopDateObj);
        });

        daysGrid.appendChild(dayDiv);
    }
}

/**
 * 指定した日に存在するアイテムの種類一覧（habit, task, scheduleの中で該当するもの）を返す
 */
function getItemTypesOnDate(dateStr) {
    const types = ['habit', 'task', 'schedule'];
    return types.filter(type =>
        allItems.some(item => item.type === type && isItemOnDate(item, dateStr))
    );
}

/**
 * 日付を選択状態にして、見出し・モーダル日付・タスク一覧をすべて更新する
 */
async function selectDate(dateStr, dateObj) {
    selectedDateStr = dateStr;

    const todayStr = formatDateISO(new Date());
    const selectedDateText = document.getElementById('selectedDateText');
    if (selectedDateText) {
        if (dateStr === todayStr) {
            selectedDateText.textContent = '本日の予定・タスク';
        } else {
            const dayName = WEEKDAY_LABELS[dateObj.getDay()];
            selectedDateText.textContent = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日(${dayName})の予定・タスク`;
        }
    }

    const modalDate = document.getElementById('modalDate');
    if (modalDate) modalDate.value = selectedDateStr;

    // ★この日付に保存されているメモ（記録）を取得してから一覧を描画する
    await fetchDayRecords(selectedDateStr);
    renderCalendarItems();

    fetchCalendarAiAdvice(dateStr);
}

/**
 * home.htmlのタスク一覧と同じ見た目・ロジックで、選択中の日付のアイテムを描画する
 */
function renderCalendarItems() {
    const container = document.getElementById('calendarTaskContainer');
    if (!container) return;

    container.innerHTML = '';

    if (!selectedDateStr) {
        container.innerHTML = '<p style="text-align: center; color: #999;">日付を選択してください</p>';
        return;
    }

    // 現在のフィルター（all, habit, task, schedule）と、選択中の日付の両方で絞り込み
    const filteredItems = allItems.filter(item => {
        const typeMatch = (currentFilter === 'all') || (item.type === currentFilter);
        const dateMatch = isItemOnDate(item, selectedDateStr);
        return typeMatch && dateMatch;
    });

    if (filteredItems.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999999;">予定・タスクはありません</p>';
        return;
    }

    filteredItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'task-item';
        itemDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #eeeeee;';

        let typeLabel = '';
        if (item.type === 'habit') typeLabel = '習慣';
        else if (item.type === 'task') typeLabel = 'タスク';
        else if (item.type === 'schedule') typeLabel = '予定';

        const completedForThisDate = isItemCompletedForDate(item);
        const textStyle = completedForThisDate ? 'text-decoration: line-through; color: #999;' : '';

        const timeLabel = getTimeLabel(item);
        const notificationBadgesHTML = getNotificationBadgesHTML(item);
        const hasSubRow = timeLabel || notificationBadgesHTML;

        // ★この日付に保存されているメモがあれば表示する（その日限りのメモ）
        const dayRecord = dayRecords[item.id];
        const memoText = (dayRecord && dayRecord.memo && dayRecord.memo.trim() !== '') ? dayRecord.memo : '';

        const completeButtonHTML = completedForThisDate
            ? `<button class="control-btn btn-revert" data-id="${item.id}" data-action="revert">↩️ 戻す</button>`
            : `<button class="control-btn btn-complete" data-id="${item.id}" data-action="complete">✅ 完了</button>`;

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
        return item.end_time ? `⏰${formatTimeHHMM(item.end_time)}まで` : '';
    }

    if (item.start_time && item.end_time) {
        return `⏰${formatTimeHHMM(item.start_time)}〜${formatTimeHHMM(item.end_time)}`;
    } else if (item.start_time) {
        return `⏰${formatTimeHHMM(item.start_time)}〜`;
    } else if (item.end_time) {
        return `⏰〜${formatTimeHHMM(item.end_time)}`;
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
        return `<span style="font-size: 11px; padding: 2px 6px; background: #fff3e0; color: #ef6c00; border-radius: 4px;">🔔${label}</span>`;
    }).join('');
}

/**
 * 指定した日付(dateStr: 'YYYY-MM-DD')にアイテムが該当するかどうかを判定する
 */
function isItemOnDate(item, dateStr) {
    if (item.type === 'schedule') {
        if (!item.start_date || !item.end_date) return false;
        return item.start_date <= dateStr && dateStr <= item.end_date;
    }

    if (item.type === 'task') {
        return item.start_date === dateStr;
    }

    if (item.type === 'habit') {
        if (item.start_date && dateStr < item.start_date) return false;
        if (item.end_date && item.end_date !== '9999-12-31' && dateStr > item.end_date) return false;

        if (item.frequency === 'weekly_days' && item.weekly_days) {
            const targetDow = WEEKDAY_LABELS[new Date(dateStr).getDay()];
            const activeDays = item.weekly_days.split(',').map(d => d.trim());
            return activeDays.includes(targetDow);
        }

        return true;
    }

    return true;
}

/**
 * フィルターボタン（すべて／習慣／タスク／予定）の切り替えを設定する
 */
function setupFilters() {
    const filterButtons = document.querySelectorAll('.task-section .filter-btn');

    filterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            currentFilter = e.target.getAttribute('data-type');
            renderCalendarItems();
        });
    });
}

/**
 * モーダル（新規追加画面）の表示・非表示を設定する関数
 * ※実際の保存処理は modal.js の共通モーダルが担当する
 */
function setupModalEvents() {
    const addModal = document.getElementById('addModal');
    const openBtn = document.getElementById('openAddModal');

    if (openBtn && addModal) {
        openBtn.addEventListener('click', () => {
            if (!selectedDateStr) {
                alert('まずはカレンダーから日付を選択してください！');
                return;
            }
        });
    }
}