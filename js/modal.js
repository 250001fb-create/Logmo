// js/modal.js
// 画面全体で使い回す、高機能な共通追加モーダル

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
 * ★新規追加：モーダルの日付欄に入れるべき初期日付を取得する
 * ホーム画面で日付が選択されていればその日付、それ以外のページでは今日の日付を返す
 */
function getModalDefaultDate() {
    if (typeof window.getHomeSelectedDate === 'function') {
        return window.getHomeSelectedDate();
    }
    return formatDateISO(new Date());
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. 共通のモーダルHTMLをページの一番下に自動挿入
    injectCommonModal();

    // 2. 切り替えや開閉の動き（イベント）を設定
    setupCommonModalEvents();
});

/**
 * 共通モーダルのHTMLを注入する
 */
function injectCommonModal() {
    if (document.getElementById('addModal')) return;

    const modalHTML = `
    <div class="modal-overlay" id="addModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); justify-content: center; align-items: center; z-index: 1000;">
        <div class="modal-content" style="background-color: #ffffff; width: 90%; max-width: 420px; border-radius: 12px; padding: 20px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); box-sizing: border-box; max-height: 90vh; overflow-y: auto;">
            <h3 id="modalHeading" style="margin-top: 0; color: #00838f; text-align: center; margin-bottom: 20px;">項目を追加</h3>
            
            <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; font-size: 13px; font-weight: bold; color: #555555; margin-bottom: 8px;">種類を選ぶ</label>
                <div class="type-selector" id="modalTypeSelector" style="display: flex; gap: 10px;">
                    <button class="type-btn active" data-type="habit" style="flex: 1; padding: 8px 0; border: 1px solid #26c6da; background-color: #26c6da; color: #ffffff; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight:bold;">習慣</button>
                    <button class="type-btn" data-type="task" style="flex: 1; padding: 8px 0; border: 1px solid #26c6da; background-color: #ffffff; color: #26c6da; border-radius: 6px; font-size: 14px; cursor: pointer;">タスク</button>
                    <button class="type-btn" data-type="schedule" style="flex: 1; padding: 8px 0; border: 1px solid #26c6da; background-color: #ffffff; color: #26c6da; border-radius: 6px; font-size: 14px; cursor: pointer;">予定</button>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 15px;">
                <label style="display: block; font-size: 13px; font-weight: bold; color: #555555; margin-bottom: 8px;">内容</label>
                <input type="text" id="modalTitle" style="width: 100%; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; box-sizing: border-box;" placeholder="例：読書、腹筋、ゴミ出し、会議など">
            </div>

            <div id="habitFields">
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 13px; font-weight: bold; color: #555555; margin-bottom: 8px;">頻度（タイミング）</label>
                    <select id="habitFrequency" style="width: 100%; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; background-color: #fff; box-sizing: border-box;">
                        <option value="daily">毎日やる</option>
                        <option value="weekly_days">指定した曜日だけやる</option>
                        <option value="weekly_once">その週に1回だけできればいい</option>
                        <option value="monthly">月ごとの決まったペース</option>
                        <option value="yearly">年ごとの決まったペース</option>
                    </select>
                </div>
                <div class="form-group" id="habitDaysWrap" style="margin-bottom: 15px; display: none; background: #f5f5f5; padding: 10px; border-radius: 6px;">
                    <label style="display: block; font-size: 12px; font-weight: bold; color: #666; margin-bottom: 5px;">曜日を選んでください</label>
                    <div style="display: flex; justify-content: space-between; font-size: 13px;">
                        <label><input type="checkbox" class="habit-day-check" value="月">月</label>
                        <label><input type="checkbox" class="habit-day-check" value="火">火</label>
                        <label><input type="checkbox" class="habit-day-check" value="水">水</label>
                        <label><input type="checkbox" class="habit-day-check" value="木">木</label>
                        <label><input type="checkbox" class="habit-day-check" value="金">金</label>
                        <label><input type="checkbox" class="habit-day-check" value="土" style="color:blue;">土</label>
                        <label><input type="checkbox" class="habit-day-check" value="日" style="color:red;">日</label>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label style="font-size: 13px; font-weight: bold; color: #555555; margin: 0;">期間</label>
                        <label style="font-size: 12px; color: #00838f; cursor: pointer; font-weight: bold;">
                            <input type="checkbox" id="habitEndless" checked> ずっと続ける（期限なし）
                        </label>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="date" id="habitStartDate" style="flex: 1; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                        <span id="habitRangeWave" style="color: #555; display: none;">〜</span>
                        <input type="date" id="habitEndDate" style="flex: 1; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; box-sizing: border-box; display: none;">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 13px; font-weight: bold; color: #555555; margin-bottom: 8px;">時間帯（何時から何時まで）</label>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="time" id="habitStartTime" style="flex: 1; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; box-sizing: border-box;" value="09:00">
                        <span style="color: #555;">〜</span>
                        <input type="time" id="habitEndTime" style="flex: 1; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; box-sizing: border-box;" value="09:30">
                    </div>
                </div>
            </div>

            <div id="taskFields" style="display: none;">
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 13px; font-weight: bold; color: #555555; margin-bottom: 8px;">期限（締め切り日）</label>
                    <input type="date" id="taskDueDate" style="width: 100%; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 13px; font-weight: bold; color: #555555; margin-bottom: 8px;">期限時刻（何時まで）</label>
                    <input type="time" id="taskDueTime" style="width: 100%; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; box-sizing: border-box;" value="18:00">
                </div>
            </div>

            <div id="scheduleFields" style="display: none;">
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 13px; font-weight: bold; color: #555555; margin-bottom: 8px;">期間（いつからいつまで）</label>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="date" id="scheduleStartDate" style="flex: 1; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                        <span style="color: #555;">〜</span>
                        <input type="date" id="scheduleEndDate" style="flex: 1; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 13px; font-weight: bold; color: #555555; margin-bottom: 8px;">時間帯（何時から何時まで）</label>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="time" id="scheduleStartTime" style="flex: 1; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; box-sizing: border-box;" value="09:00">
                        <span style="color: #555;">〜</span>
                        <input type="time" id="scheduleEndTime" style="flex: 1; padding: 10px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 14px; box-sizing: border-box;" value="10:00">
                    </div>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 15px; background: #e0f2f1; padding: 10px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <label style="font-size: 13px; font-weight: bold; color: #006064; margin: 0;">🔔 通知設定</label>
                    <button type="button" id="addNotificationBtn" style="padding: 4px 12px; border: none; border-radius: 20px; background-color: #00838f; color: #ffffff; font-size: 12px; font-weight: bold; cursor: pointer;">＋ 通知を追加</button>
                </div>
                <div id="notificationList"></div>
                <p id="noNotificationHint" style="margin: 4px 0 0; font-size: 12px; color: #789; text-align: center;">通知はまだ設定されていません</p>
            </div>

            <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                <button id="closeAddModal" style="padding: 10px 20px; border: none; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer; background-color: #eceff1; color: #607d8b;">キャンセル</button>
                <button id="saveItemBtn" style="padding: 10px 20px; border: none; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer; background-color: #00838f; color: #ffffff;">追加する</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 初期値としてセットしておく（ホームで日付が選ばれていればその日付、なければ今日）
    const todayStr = getModalDefaultDate();
    document.getElementById('habitStartDate').value = todayStr;
    document.getElementById('taskDueDate').value = todayStr;
    document.getElementById('scheduleStartDate').value = todayStr;
    document.getElementById('scheduleEndDate').value = todayStr;
}

/**
 * モーダルの動作制御イベントを設定
 */
function setupCommonModalEvents() {
    const addModal = document.getElementById('addModal');
    const typeButtons = document.querySelectorAll('#modalTypeSelector .type-btn');
    
    const habitFields = document.getElementById('habitFields');
    const taskFields = document.getElementById('taskFields');
    const scheduleFields = document.getElementById('scheduleFields');

    let selectedType = 'habit';
    let notificationRowCounter = 0;
    // ★編集中の項目ID。nullなら「新規追加」、数値が入っていれば「その項目を編集中」を意味する
    let editingItemId = null;

    const notificationList = document.getElementById('notificationList');
    const noNotificationHint = document.getElementById('noNotificationHint');
    const addNotificationBtn = document.getElementById('addNotificationBtn');

    /**
     * ★新規追加：通知の行を1つ追加する
     * initialValue を渡すと、その値を選択した状態で行を追加する（編集モードの復元用）
     */
    function addNotificationRow(initialValue) {
        notificationRowCounter++;
        const rowId = `notif-${notificationRowCounter}`;

        const row = document.createElement('div');
        row.className = 'notification-row';
        row.dataset.rowId = rowId;
        row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px; background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #b2dfdb;';
        row.innerHTML = `
            <select class="notification-timing" style="flex: 1; padding: 8px; border: 1px solid #b2dfdb; border-radius: 6px; font-size: 13px; background-color: #fff;">
                <option value="0">時間ぴったりに通知</option>
                <option value="5">5分前に通知</option>
                <option value="15">15分前に通知</option>
                <option value="30">30分前に通知</option>
                <option value="60">1時間前に通知</option>
                <option value="1day">1日前のこの時間に通知</option>
            </select>
            <button type="button" class="removeNotificationBtn" style="padding: 8px 12px; border: none; border-radius: 6px; background-color: #ffebee; color: #c62828; font-weight: bold; cursor: pointer;">✕</button>
        `;

        if (initialValue !== undefined && initialValue !== null && initialValue !== '') {
            const select = row.querySelector('.notification-timing');
            select.value = initialValue;
        }

        row.querySelector('.removeNotificationBtn').addEventListener('click', () => {
            row.remove();
            updateNoNotificationHint();
        });

        notificationList.appendChild(row);
        updateNoNotificationHint();
    }

    /**
     * 通知が1件もない時だけヒント文言を表示する
     */
    function updateNoNotificationHint() {
        const hasRows = notificationList.querySelectorAll('.notification-row').length > 0;
        noNotificationHint.style.display = hasRows ? 'none' : 'block';
    }

    /**
     * 通知欄を空の状態（ヒント文言だけ）にリセットする
     */
    function resetNotificationRows() {
        notificationList.innerHTML = '';
        updateNoNotificationHint();
    }

    addNotificationBtn.addEventListener('click', addNotificationRow);

    // 1. 各画面の「追加ボタン」をクリックした時に開く
    const openBtns = document.querySelectorAll('#openAddModalBtn, .add-new-btn, .add-btn');
    openBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // ★新規追加モードにリセットする（前回「変更」で開いていた内容を引き継がないようにする）
            editingItemId = null;
            document.getElementById('modalHeading').textContent = '項目を追加';
            document.getElementById('saveItemBtn').textContent = '追加する';

            // フォームをまっさらな状態に戻す
            document.getElementById('modalTitle').value = '';
            const habitTypeBtn = document.querySelector('#modalTypeSelector .type-btn[data-type="habit"]');
            if (habitTypeBtn) habitTypeBtn.click();

            habitFrequency.value = 'daily';
            habitFrequency.dispatchEvent(new Event('change'));
            document.querySelectorAll('.habit-day-check').forEach(cb => { cb.checked = false; });
            habitEndless.checked = true;
            habitEndless.dispatchEvent(new Event('change'));
            document.getElementById('habitStartTime').value = '09:00';
            document.getElementById('habitEndTime').value = '09:30';
            document.getElementById('taskDueTime').value = '18:00';
            document.getElementById('scheduleStartTime').value = '09:00';
            document.getElementById('scheduleEndTime').value = '10:00';

            // ★開くたびに、カレンダーで選択中の日付を各日付欄の初期値としてセットし直す
            const defaultDate = getModalDefaultDate();
            document.getElementById('habitStartDate').value = defaultDate;
            document.getElementById('taskDueDate').value = defaultDate;
            document.getElementById('scheduleStartDate').value = defaultDate;
            // 「ずっと続ける」がオフの場合の終了日欄にも同じ日付を入れておく
            document.getElementById('scheduleEndDate').value = defaultDate;

            // ★開くたびに通知欄をリセット（前回追加した分が残らないようにする）
            resetNotificationRows();

            addModal.style.display = 'flex';
        });
    });

    // 2. キャンセルボタンで閉じる
    document.getElementById('closeAddModal').addEventListener('click', () => {
        addModal.style.display = 'none';
        editingItemId = null;
    });

    // 3. 習慣・タスク・予定の切り替えイベント
    typeButtons.forEach(button => {
        button.addEventListener('click', function() {
            typeButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.style.backgroundColor = '#ffffff';
                btn.style.color = '#26c6da';
            });
            this.classList.add('active');
            this.style.backgroundColor = '#26c6da';
            this.style.color = '#ffffff';
            
            selectedType = this.getAttribute('data-type');

            // フィールドの表示・非表示出し分け
            habitFields.style.display = (selectedType === 'habit') ? 'block' : 'none';
            taskFields.style.display = (selectedType === 'task') ? 'block' : 'none';
            scheduleFields.style.display = (selectedType === 'schedule') ? 'block' : 'none';
        });
    });

    // 4. 【習慣】頻度プルダウンで「曜日指定」を選んだ時だけ曜日チェックを出す
    const habitFrequency = document.getElementById('habitFrequency');
    const habitDaysWrap = document.getElementById('habitDaysWrap');
    habitFrequency.addEventListener('change', function() {
        habitDaysWrap.style.display = (this.value === 'weekly_days') ? 'block' : 'none';
    });

    // 5. 【習慣】「ずっと続ける（期限なし）」のチェック連動
    const habitEndless = document.getElementById('habitEndless');
    const habitEndDate = document.getElementById('habitEndDate');
    const habitRangeWave = document.getElementById('habitRangeWave');
    habitEndless.addEventListener('change', function() {
        if (this.checked) {
            habitEndDate.style.display = 'none';
            habitRangeWave.style.display = 'none';
        } else {
            habitEndDate.style.display = 'block';
            habitRangeWave.style.display = 'inline';
        }
    });

    // 6. 【本番通信用】追加するボタンを押した時に実際に php/item.php と通信する
    document.getElementById('saveItemBtn').addEventListener('click', async () => {
        const title = document.getElementById('modalTitle').value.trim();
        if (!title) {
            alert('内容を入力してください');
            return;
        }

        // ★通知欄の各行から「何分前に通知するか」を集めて配列にする
        const notifications = [];
        notificationList.querySelectorAll('.notification-timing').forEach(select => {
            notifications.push(select.value);
        });

        // 全種類共通で「start_date」「end_date」「start_time」「end_time」というキーで送るように統一
        let saveData = {
            type: selectedType,
            title: title,
            notifications: notifications,
            frequency: 'daily',
            weekly_days: [],
            start_date: '',
            end_date: '',
            start_time: '',
            end_time: ''
        };

        // 種類ごとの個別データ収集
        if (selectedType === 'habit') {
            const checkedDays = [];
            document.querySelectorAll('.habit-day-check:checked').forEach(cb => checkedDays.push(cb.value));
            
            saveData.frequency = habitFrequency.value;
            saveData.weekly_days = checkedDays;
            saveData.start_date = document.getElementById('habitStartDate').value;
            saveData.end_date = habitEndless.checked ? '9999-12-31' : document.getElementById('habitEndDate').value;
            // 何時から何時まで行うか
            saveData.start_time = document.getElementById('habitStartTime').value;
            saveData.end_time = document.getElementById('habitEndTime').value;
        } else if (selectedType === 'task') {
            saveData.start_date = document.getElementById('taskDueDate').value;
            saveData.end_date = saveData.start_date; // タスクは開始・終了日を同じにする
            // タスクは「何時まで」の期限時刻のみ（start_timeは空のまま）
            saveData.end_time = document.getElementById('taskDueTime').value;
        } else if (selectedType === 'schedule') {
            saveData.start_date = document.getElementById('scheduleStartDate').value;
            saveData.end_date = document.getElementById('scheduleEndDate').value;
            // 何時から何時までの予定か
            saveData.start_time = document.getElementById('scheduleStartTime').value;
            saveData.end_time = document.getElementById('scheduleEndTime').value;
        }

        // ★編集モードかどうかで送信先と送信データを切り替える
        const isEditing = editingItemId !== null;
        const endpoint = isEditing ? 'php/update_item.php' : 'php/item.php';
        if (isEditing) {
            saveData.id = editingItemId;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            });

            if (!response.ok) throw new Error('ネットワークエラーが発生しました。');

            const result = await response.json();

            if (result.success) {
                alert(isEditing ? `「${title}」を更新しました！` : `「${title}」を追加しました！`);
                addModal.style.display = 'none';
                document.getElementById('modalTitle').value = '';
                resetNotificationRows();
                editingItemId = null;

                // ★変更点：ページ全体をreload()すると選択中の日付が失われて今日に戻ってしまうため、
                //   各ページ（home.js/calender.js/list.js）が公開している再描画関数があればそれを呼ぶ。
                //   無い場合のみ、従来通りreload()にフォールバックする。
                if (typeof window.onItemSaved === 'function') {
                    await window.onItemSaved();
                } else {
                    window.location.reload();
                }
            } else {
                if (result.error === 'not_logged_in') {
                    alert('セッションが切れました。再度ログインしてください。');
                } else {
                    alert('保存に失敗しました: ' + (result.message || result.error));
                }
            }
        } catch (error) {
            console.error('エラー:', error);
            alert('通信エラーが発生しました。php/item.php や php/update_item.php が正しく配置されているか確認してください。');
        }
    });

    /**
     * ★編集モードでモーダルを開く（home.js / calender.js / list.js から呼び出せるように公開する）
     * item: php/home.php から取得したアイテム1件分のオブジェクト
     */
    window.openItemEditModal = function(item) {
        if (!item) return;

        editingItemId = item.id;

        document.getElementById('modalHeading').textContent = '項目を編集';
        document.getElementById('saveItemBtn').textContent = '更新する';

        // 種類ボタンを対応するものに切り替える（クリックと同じ処理を走らせる）
        const targetTypeBtn = document.querySelector(`#modalTypeSelector .type-btn[data-type="${item.type}"]`);
        if (targetTypeBtn) targetTypeBtn.click();

        // 内容
        document.getElementById('modalTitle').value = item.title || '';

        if (item.type === 'habit') {
            habitFrequency.value = item.frequency || 'daily';
            habitFrequency.dispatchEvent(new Event('change'));

            document.querySelectorAll('.habit-day-check').forEach(cb => { cb.checked = false; });
            if (item.weekly_days) {
                const activeDays = item.weekly_days.split(',').map(d => d.trim());
                document.querySelectorAll('.habit-day-check').forEach(cb => {
                    if (activeDays.includes(cb.value)) cb.checked = true;
                });
            }

            document.getElementById('habitStartDate').value = item.start_date || '';
            const isEndless = !item.end_date || item.end_date === '9999-12-31';
            habitEndless.checked = isEndless;
            habitEndless.dispatchEvent(new Event('change'));
            if (!isEndless) {
                habitEndDate.value = item.end_date;
            }
            document.getElementById('habitStartTime').value = (item.start_time || '09:00').slice(0, 5);
            document.getElementById('habitEndTime').value = (item.end_time || '09:30').slice(0, 5);

        } else if (item.type === 'task') {
            document.getElementById('taskDueDate').value = item.start_date || '';
            document.getElementById('taskDueTime').value = (item.end_time || '18:00').slice(0, 5);

        } else if (item.type === 'schedule') {
            document.getElementById('scheduleStartDate').value = item.start_date || '';
            document.getElementById('scheduleEndDate').value = item.end_date || '';
            document.getElementById('scheduleStartTime').value = (item.start_time || '09:00').slice(0, 5);
            document.getElementById('scheduleEndTime').value = (item.end_time || '10:00').slice(0, 5);
        }

        // 通知欄を一旦空にしてから、既存の通知設定を復元する
        resetNotificationRows();
        if (item.notifications) {
            try {
                const notifList = JSON.parse(item.notifications);
                if (Array.isArray(notifList)) {
                    notifList.forEach(value => addNotificationRow(value));
                }
            } catch (e) {
                // 壊れたデータが入っていた場合は何もしない
            }
        }

        addModal.style.display = 'flex';
    };
}