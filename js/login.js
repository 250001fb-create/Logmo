// js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const messageArea = document.getElementById('messageArea');

    // 1. URLのパラメータをチェック（新規登録成功(URL末尾が ?success=registered)して戻ってきた場合）
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'registered') {
        messageArea.style.display = 'block';
        messageArea.style.backgroundColor = '#e8f5e9'; // 薄い緑色
        messageArea.style.color = '#2e7d32';
        messageArea.textContent = 'アカウントが作成されました！ログインしてください。';
    }
});

// 2. ログインフォームが送信された時の処理
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const messageArea = document.getElementById('messageArea');
    messageArea.style.display = 'none'; // 表示をリセット
    messageArea.textContent = '';

    const formData = new FormData(this);

    try {
        // phpフォルダの中の login.php に通信
        const response = await fetch('php/login.php', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('ネットワークエラー');

        const data = await response.json();

        if (data.success) {
            // 【ログイン成功】メインのホーム画面（home.html）へ移動
            window.location.href = 'home.html';
        } else {
            // 【ログイン失敗】赤文字でエラーを表示
            messageArea.style.display = 'block';
            messageArea.style.backgroundColor = '#ffebee'; // 薄い赤色
            messageArea.style.color = '#c62828';

            if (data.error === 'empty') {
                messageArea.textContent = 'IDとパスワードを入力してください。';
            } else if (data.error === 'invalid') {
                messageArea.textContent = 'IDまたはパスワードが間違っています。';
            } else {
                messageArea.textContent = 'エラーが発生しました。';
            }
        }

    } catch (error) {
        messageArea.style.display = 'block';
        messageArea.style.backgroundColor = '#ffebee';
        messageArea.style.color = '#c62828';
        messageArea.textContent = 'システムエラーが発生しました。';
    }
});