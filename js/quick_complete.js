// js/quick_complete.js
const params = new URLSearchParams(window.location.search);
const itemId = params.get('id');
const recordDate = params.get('date');

document.getElementById('submitBtn').addEventListener('click', async () => {
    const memo = document.getElementById('memoInput').value;
    const statusEl = document.getElementById('status');
    const btn = document.getElementById('submitBtn');
    statusEl.textContent = '送信中...';
    btn.disabled = true;

    try {
        const res = await fetch('php/complete_item.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: itemId,
                status: 'completed',
                memo: memo,
                record_date: recordDate
            })
        });
        const data = await res.json();

        if (data.success) {
            statusEl.textContent = '完了しました！このタブは閉じて大丈夫です。';
            setTimeout(() => window.close(), 1500);
        } else {
            statusEl.textContent = 'エラー: ' + (data.message || data.error);
            btn.disabled = false;
        }
    } catch (e) {
        statusEl.textContent = '通信エラーが発生しました。';
        btn.disabled = false;
    }
});