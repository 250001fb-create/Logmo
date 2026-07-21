// js/register.js

document.getElementById('registerForm').addEventListener('submit', async function(e) {
    // 1. 通常のページ遷移を伴うフォーム送信をキャンセル
    e.preventDefault();

    const errorArea = document.getElementById('errorArea');
    errorArea.style.display = 'none'; // エラー表示をリセット
    errorArea.textContent = '';

    // 2. 入力データの取得
    const formData = new FormData(this);

    try {
        // 3. 裏側でPHP（API）にデータを送信
        const response = await fetch('php/register.php', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('ネットワークエラーが発生しました。');
        }

        // 4. PHPから返ってきたJSONデータを受け取る
        const data = await response.json();

        // 5. 結果に応じた画面処理
        if (data.success) {
            // 【登録成功】ログイン画面へ移動（成功パラメーター付き）
            window.location.href = 'index.html?success=registered';
        } else {
            // 【登録失敗】エラーメッセージを表示
            errorArea.style.display = 'block';
            
            if (data.error === 'empty') {
                errorArea.textContent = 'すべての項目を入力してください。';
            } else if (data.error === 'password_mismatch') {
                errorArea.textContent = 'パスワードと確認用パスワードが一致しません。';
            } else if (data.error === 'already_exists') {
                errorArea.textContent = 'このIDはすでに使用されています。';
            } else if (data.error === 'system_error') {
                // ★裏側の具体的なエラーメッセージを画面に出す
                errorArea.textContent = 'システムエラー: ' + data.message;
            } else {
                errorArea.textContent = 'エラーが発生しました。';
            }
        }

    } catch (error) {
        errorArea.style.display = 'block';
        errorArea.textContent = 'システムエラーが発生しました。時間を置いてやり直してください。';
    }
});