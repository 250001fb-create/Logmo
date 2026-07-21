// sw.js (Logmoの一番上の階層に保存してください)

// サーバーからプッシュ通知を受け取ったときに動くイベント
self.addEventListener('push', function(event) {
    console.log('[Service Worker] プッシュ通知を受信しました。');

    // 通知の初期データ（サーバーからデータが来なかった場合のフォールバック）
    let title = 'Logmoからの通知';
    let options = {
        body: '新しいお知らせがあります。',
        icon: './img/logo.png', // 通知に表示するアイコン（実在するlogo.pngに統一。相対パスにしてサブフォルダ配置でも動くように）
        badge: './img/logo.png' // スマホの通知欄に表示される小さなアイコン
    };

    // サーバーから送られてきたデータ（JSON）があれば、それを通知に使う
    if (event.data) {
        try {
            const data = event.data.json();
            title = data.title || title;
            options.body = data.body || options.body;
            if (data.icon) options.icon = data.icon;
            if (data.actions) options.actions = data.actions; // ★通知ボタン
            if (data.data) options.data = data.data;           // ★どの項目かの情報
        } catch (e) {
            options.body = event.data.text();
        }
    }

    // 実際にブラウザ（OS）に通知を表示する
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ユーザーが通知をクリックしたときに動くイベント
self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] 通知がクリックされました。action:', event.action);

    const notifData = event.notification.data || {};
    const itemId = notifData.itemId;
    const recordDate = notifData.recordDate;

    event.notification.close();

    // ★「✅完了」ボタンが押された場合：アプリを開かず裏側で完了処理だけ送信
    if (event.action === 'complete') {
        event.waitUntil(
            fetch('./php/complete_item.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // ログインセッションのCookieを一緒に送る
                body: JSON.stringify({
                    id: itemId,
                    status: 'completed',
                    record_date: recordDate
                })
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    return self.registration.showNotification('✅ 完了しました！', {
                        body: 'お疲れ様でした。',
                        icon: './img/logo.png'
                    });
                } else {
                    return self.registration.showNotification('⚠️ 完了処理に失敗しました', {
                        body: 'アプリを開いて確認してください。'
                    });
                }
            })
            .catch(() => {
                return self.registration.showNotification('⚠️ 通信エラー', {
                    body: '完了処理に失敗しました。アプリを開いて確認してください。'
                });
            })
        );
        return;
    }

    // ★「📝メモを書いて完了」ボタンが押された場合：軽量な入力画面だけを開く
    if (event.action === 'memo') {
        const memoUrl = `./quick_complete.html?id=${encodeURIComponent(itemId)}&date=${encodeURIComponent(recordDate)}`;
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then(function(clientList) {
                for (let i = 0; i < clientList.length; i++) {
                    if ('focus' in clientList[i]) {
                        clientList[i].navigate(memoUrl);
                        return clientList[i].focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(memoUrl);
                }
            })
        );
        return;
    }

    // ★ボタンではなく通知本体をクリックした場合：通常通りアプリを開く
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(function(clientList) {
            for (let i = 0; i < clientList.length; i++) {
                if ('focus' in clientList[i]) {
                    return clientList[i].focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('./home.html');
            }
        })
    );
});