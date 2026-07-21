// js/item-actions.js
// 完了・削除・変更（仮）の処理を共通化したファイル
// home.html / calender.html / list.html のすべてで読み込んで使う

// ★セッション切れの通知＆リダイレクトを「1回だけ」に制限するためのフラグ
// これが無いと、セッション切れの状態で複数のボタンを続けて押した時に
// 「セッションが切れました」のアラートが積み重なって延々と出続けてしまう
let isSessionExpiredHandled = false;

/**
 * セッション切れを検知した時の共通処理
 * 1回目だけアラートを出してログイン画面へ移動し、2回目以降は何もしない
 */
function handleSessionExpired() {
    if (isSessionExpiredHandled) return; // 既に処理済みなら何もしない（通知の連発防止）
    isSessionExpiredHandled = true;

    alert('セッションが切れました。ログインし直してください。');
    window.location.href = 'index.html';
}

/**
 * 項目を「完了」にする（未完了 → 完了）
 * まずメモを入力するかどうかを確認し、「はい」ならメモ入力画面（prompt）を出して保存する
 * 入力したメモは「その項目」ではなく「recordDateで指定した日」に紐付けて保存される
 * 戻り値：処理が成功したら true、キャンセル・失敗したら false
 */
async function markItemComplete(itemId, recordDate) {
    // ★既にセッション切れでログイン画面へ移動中なら、これ以上ダイアログを出さない
    if (isSessionExpiredHandled) return false;

    const wantsMemo = confirm('メモを入力しますか？');
    let memo = null; // nullのままなら「メモは保存しない」という意味になる

    if (wantsMemo) {
        const inputMemo = prompt('メモを入力してください', '');
        if (inputMemo === null) {
            // メモ入力画面でキャンセルされたら、完了処理自体を中止する
            return false;
        }
        memo = inputMemo;
    }

    return await sendItemStatusUpdate(itemId, 'completed', memo, recordDate);
}

/**
 * 項目の完了状態を「未完了（todo）」に戻す
 * 習慣の場合、recordDate で指定した「その日」の記録だけを未完了に戻す
 */
async function revertItemToTodo(itemId, recordDate) {
    if (isSessionExpiredHandled) return false;
    return await sendItemStatusUpdate(itemId, 'todo', null, recordDate);
}

/**
 * php/complete_item.php にステータスを送信する共通関数
 * recordDate は「習慣の場合にどの日の記録を更新するか」に使われる
 * memo が null でない場合は、その日の記録としてメモも一緒に保存される
 */
async function sendItemStatusUpdate(itemId, status, memo, recordDate) {
    const payload = { id: itemId, status: status };
    if (memo !== null) {
        payload.memo = memo;
    }
    if (recordDate) {
        payload.record_date = recordDate; // どの日の記録かを一緒に送る（習慣の完了⇔戻すで使う）
    }

    try {
        const response = await fetch('php/complete_item.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('ネットワークエラー');

        const result = await response.json();

        if (!result.success) {
            if (result.error === 'not_logged_in') {
                handleSessionExpired();
            } else {
                alert('更新に失敗しました: ' + (result.message || result.error));
            }
            return false;
        }

        return true;

    } catch (error) {
        console.error('通信エラー:', error);
        alert('通信エラーが発生しました。');
        return false;
    }
}

/**
 * 項目を削除する（確認ダイアログ付き）
 */
async function deleteItemWithConfirm(itemId) {
    if (isSessionExpiredHandled) return false;

    if (!confirm('この項目を削除しますか？この操作は取り消せません。')) {
        return false;
    }

    try {
        const response = await fetch('php/delete_item.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: itemId })
        });

        if (!response.ok) throw new Error('ネットワークエラー');

        const result = await response.json();

        if (!result.success) {
            if (result.error === 'not_logged_in') {
                handleSessionExpired();
            } else {
                alert('削除に失敗しました: ' + (result.message || result.error));
            }
            return false;
        }

        return true;

    } catch (error) {
        console.error('通信エラー:', error);
        alert('通信エラーが発生しました。');
        return false;
    }
}

/**
 * 「変更」ボタンの動作
 * modal.js が公開している window.openItemEditModal を呼び出して編集モーダルを開く
 * item が見つからない場合や modal.js が未読み込みの場合は警告を出す
 */
function editItemWithModal(item) {
    if (isSessionExpiredHandled) return;

    if (!item) {
        alert('項目のデータが見つかりませんでした。ページを再読み込みしてから試してください。');
        return;
    }

    if (typeof window.openItemEditModal === 'function') {
        window.openItemEditModal(item);
    } else {
        alert('編集フォームを読み込めませんでした。ページを再読み込みしてから試してください。');
    }
}

/**
 * 完了・変更・削除ボタンの共通クリック処理
 * container内の data-action 付きボタンを1つのイベントリスナーで処理する（イベント委譲）
 * onSuccess: 完了・削除が成功した後に呼ばれるコールバック（一覧の再取得・再描画などに使う）
 * getItemById: 変更ボタンが押された時に、そのIDに対応するアイテムのデータを返す関数
 *              （各ページが持っている allItems 配列から探して返すのを想定）
 * getRecordDate: 完了ボタンが押された時、メモをどの日付に紐付けるかを返す関数
 *                （home.js/calender.jsでは選択中の日付、list.jsでは今日の日付を返す想定）
 */
function setupItemActionDelegation(container, onSuccess, getItemById, getRecordDate) {
    if (!container) return;

    container.addEventListener('click', async (e) => {
        // ★既にセッション切れでログイン画面へ移動中なら、それ以上のクリックは一切受け付けない
        if (isSessionExpiredHandled) return;

        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const itemId = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');

        if (action === 'complete') {
            const recordDate = typeof getRecordDate === 'function' ? getRecordDate() : null;
            const ok = await markItemComplete(itemId, recordDate);
            if (ok && typeof onSuccess === 'function') onSuccess();
        } else if (action === 'revert') {
            const recordDate = typeof getRecordDate === 'function' ? getRecordDate() : null;
            const ok = await revertItemToTodo(itemId, recordDate);
            if (ok && typeof onSuccess === 'function') onSuccess();
        } else if (action === 'delete') {
            const ok = await deleteItemWithConfirm(itemId);
            if (ok && typeof onSuccess === 'function') onSuccess();
        } else if (action === 'edit') {
            const item = typeof getItemById === 'function' ? getItemById(itemId) : null;
            editItemWithModal(item);
        }
    });
}