-- phpMyAdmin SQL Dump
-- version 6.0.0-dev+20260412.9edf12e957
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Sep 07, 2026 at 04:44 AM
-- Server version: 8.4.3
-- PHP Version: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `myapp`
--

-- --------------------------------------------------------

--
-- Table structure for table `ai_advices`
--

CREATE TABLE `ai_advices` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `target_date` date NOT NULL,
  `comment` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `ai_advices`
--

INSERT INTO `ai_advices` (`id`, `user_id`, `target_date`, `comment`, `created_at`) VALUES
(200, 2, '2026-07-21', '2222さん、この日はまだ何も登録されていません。新しい習慣やタスクを追加してみましょう！', '2026-07-21 12:13:52'),
(201, 1, '2026-07-21', 'AIアドバイスの取得回数が上限に達しました。約26秒待ってから、タスクを編集して再度読み込んでください。', '2026-07-21 12:19:33'),
(202, 1, '2026-07-22', 'AIアドバイスの取得回数が上限に達しました。約22秒待ってから、タスクを編集して再度読み込んでください。', '2026-07-21 12:19:37'),
(203, 1, '2026-08-31', '今日は9:00や14:36頃から始まるテスト項目がいくつか予定されていますね。少し件数が重なっているので、まずは目の前のものから無理のないペースで進めていきましょう。今週は期限付きのタスクもないため、ご自身のペースを大切にしてくださいね。', '2026-08-31 13:13:18'),
(204, 1, '2026-09-01', '今日は9:00や14:30過ぎから始まるテスト習慣が計6件予定されています。少し項目が多いので、一気に進めずご自身のペースで一つずつ取り組んでみてくださいね。今週は他の予定もありませんので、落ち着いてマイペースにクリアしていきましょう。', '2026-08-31 14:17:43');

-- --------------------------------------------------------

--
-- Table structure for table `items`
--

CREATE TABLE `items` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `item_type` varchar(20) DEFAULT 'habit' COMMENT '習慣, タスク, 予定',
  `start_date` date DEFAULT NULL COMMENT '開始日',
  `start_time` time DEFAULT NULL,
  `end_date` date DEFAULT NULL COMMENT '終了日',
  `end_time` time DEFAULT NULL,
  `status` varchar(20) DEFAULT 'todo' COMMENT 'todo, ongoing, completed',
  `frequency` varchar(20) DEFAULT 'daily' COMMENT '習慣の頻度',
  `weekly_days` varchar(50) DEFAULT NULL COMMENT '指定曜日',
  `reminder_time` time DEFAULT '09:00:00' COMMENT '通知用時間',
  `reminder_timing` varchar(20) DEFAULT 'none' COMMENT '通知タイミング',
  `notifications` text COMMENT '通知設定（JSON配列文字列。例: ["5","1day"]）',
  `type` varchar(20) DEFAULT 'habit' COMMENT '旧型式用',
  `title` varchar(100) NOT NULL COMMENT '内容・タイトル',
  `date` date DEFAULT NULL COMMENT '旧型式用',
  `time` time DEFAULT '09:00:00' COMMENT '旧型式用',
  `is_completed` tinyint(1) DEFAULT '0' COMMENT '0:未完了, 1:完了',
  `notification` varchar(20) DEFAULT 'none',
  `memo` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `items`
--

INSERT INTO `items` (`id`, `user_id`, `item_type`, `start_date`, `start_time`, `end_date`, `end_time`, `status`, `frequency`, `weekly_days`, `reminder_time`, `reminder_timing`, `notifications`, `type`, `title`, `date`, `time`, `is_completed`, `notification`, `memo`, `created_at`, `updated_at`) VALUES
(14, 1, 'schedule', '2026-07-11', '08:30:00', '2026-07-11', '14:00:00', 'completed', 'daily', NULL, '09:00:00', 'none', '[\"1day\"]', 'habit', 'バイト', NULL, '09:00:00', 0, 'none', NULL, '2026-07-08 10:51:22', '2026-07-13 13:06:08'),
(15, 1, 'schedule', '2026-07-12', '08:30:00', '2026-07-12', '15:00:00', 'completed', 'daily', NULL, '09:00:00', 'none', '[\"1day\"]', 'habit', 'バイト', NULL, '09:00:00', 0, 'none', NULL, '2026-07-08 10:51:51', '2026-07-13 13:06:06'),
(16, 1, 'task', '2026-07-10', NULL, '2026-07-10', '13:05:00', 'completed', 'daily', NULL, '09:00:00', 'none', '[\"1day\"]', 'habit', '卒業制作企画発表会デモ用スライド', NULL, '09:00:00', 0, 'none', NULL, '2026-07-08 10:53:02', '2026-07-13 13:05:57'),
(18, 1, 'schedule', '2026-07-18', '08:30:00', '2026-07-18', '14:00:00', 'todo', 'daily', NULL, '09:00:00', 'none', '[\"60\",\"1day\"]', 'habit', 'バイト', NULL, '09:00:00', 0, 'none', NULL, '2026-07-13 13:07:45', '2026-07-13 13:07:45'),
(19, 1, 'schedule', '2026-07-19', '08:30:00', '2026-07-19', '15:00:00', 'todo', 'daily', NULL, '09:00:00', 'none', '[\"60\",\"1day\"]', 'habit', 'バイト', NULL, '09:00:00', 0, 'none', NULL, '2026-07-13 13:08:07', '2026-07-13 13:08:07'),
(52, 1, 'schedule', '2026-07-20', '08:30:00', '2026-07-20', '14:00:00', 'todo', 'daily', NULL, '09:00:00', 'none', '[\"1day\",\"60\"]', 'habit', 'バイト', NULL, '09:00:00', 0, 'none', NULL, '2026-07-17 11:13:40', '2026-07-17 11:13:40'),
(53, 1, 'schedule', '2026-07-17', '18:00:00', '2026-07-17', '18:30:00', 'completed', 'daily', NULL, '09:00:00', 'none', '[\"60\",\"30\"]', 'habit', '電話対応', NULL, '09:00:00', 0, 'none', NULL, '2026-07-17 11:25:05', '2026-07-17 14:39:22'),
(54, 1, 'habit', '2026-07-22', '09:00:00', '9999-12-31', '09:30:00', 'todo', 'daily', NULL, '09:00:00', 'none', NULL, 'habit', 'テスト', NULL, '09:00:00', 0, 'none', NULL, '2026-07-17 11:25:26', '2026-07-17 11:25:26'),
(55, 1, 'habit', '2026-07-23', '09:00:00', '9999-12-31', '09:30:00', 'todo', 'daily', NULL, '09:00:00', 'none', NULL, 'habit', 'テスト', NULL, '09:00:00', 0, 'none', NULL, '2026-07-17 11:35:49', '2026-07-17 11:35:49'),
(57, 1, 'task', '2026-07-23', NULL, '2026-07-23', '18:00:00', 'todo', 'daily', NULL, '09:00:00', 'none', NULL, 'habit', 'テスト', NULL, '09:00:00', 0, 'none', NULL, '2026-07-17 11:36:21', '2026-07-17 11:36:21'),
(67, 1, 'task', '2026-07-17', NULL, '2026-07-17', '18:00:00', 'todo', 'daily', NULL, '09:00:00', 'none', '[\"0\"]', 'habit', 'テスト通知', NULL, '09:00:00', 0, 'none', NULL, '2026-07-17 14:16:56', '2026-07-17 14:17:14'),
(68, 1, 'habit', '2026-07-17', '14:36:00', '9999-12-31', '09:30:00', 'todo', 'daily', NULL, '09:00:00', 'none', '[\"0\"]', 'habit', 'テスト通知', NULL, '09:00:00', 0, 'none', NULL, '2026-07-17 14:31:19', '2026-07-17 14:35:36'),
(69, 1, 'habit', '2026-07-17', '14:39:00', '9999-12-31', '09:30:00', 'todo', 'daily', NULL, '09:00:00', 'none', '[\"0\"]', 'habit', 'テスト通知', NULL, '09:00:00', 0, 'none', NULL, '2026-07-17 14:38:10', '2026-07-17 14:38:10'),
(70, 1, 'habit', '2026-07-17', '14:51:00', '9999-12-31', '09:30:00', 'todo', 'daily', NULL, '09:00:00', 'none', '[\"0\"]', 'habit', 'テスト通知', NULL, '09:00:00', 0, 'none', NULL, '2026-07-17 14:50:24', '2026-07-17 14:50:24'),
(71, 1, 'habit', '2026-07-21', '09:00:00', '9999-12-31', '09:30:00', 'todo', 'daily', NULL, '09:00:00', 'none', NULL, 'habit', 'テストAIコメント', NULL, '09:00:00', 0, 'none', NULL, '2026-07-21 10:21:15', '2026-07-21 10:21:15'),
(72, 1, 'task', '2026-07-21', NULL, '2026-07-21', '11:21:00', 'completed', 'daily', NULL, '09:00:00', 'none', '[\"0\"]', 'habit', 'テスト通知', NULL, '09:00:00', 0, 'none', NULL, '2026-07-21 10:33:06', '2026-07-21 11:21:24');

-- --------------------------------------------------------

--
-- Table structure for table `push_subscriptions`
--

CREATE TABLE `push_subscriptions` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `endpoint` text NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `push_subscriptions`
--

INSERT INTO `push_subscriptions` (`id`, `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`) VALUES
(4, 1, 'https://fcm.googleapis.com/fcm/send/cI4MH8g3jNA:APA91bHmCft2egvpBd448JhZ82AGQsAALRbMUbNGTomQJeYinH7jdbFt0IbYr1XS9WGF8DskEUxByj5soVgHVNKpRZUIGs01_9D6LFf8-VO3CEu_hBOU4aq0-XSW1OS1LCaLPaHf4mAh', 'BD7OoLSXsYrXFWV8BOYkLjGr4s5M5Re4iAQwUWFKma+K5R5RaXCOlQaVJbVN810izcGJvnkhmHDHzejJv/BPcB0=', 'jbORKfBNP5UuTwrze3iHtg==', '2026-07-17 14:34:59'),
(5, 1, 'https://fcm.googleapis.com/fcm/send/etVUs_cmU2Q:APA91bHQRCriltmuneN-bFWhXd_EwGjU7fGqJJ7vA_kQcEMtPSKVrEYkdrwP1feM3bPE9W_uTNDspf0tNgchRs11bEfIsKUewam_C0bIEHc1auvmdEIkQwJB26hHjlYa4lWfQ4yOJtwB', 'BOzhpcyUdf5PDCpCVgBUdSYYniM+3EQBEMLZMF96BF7ZniDt3n9eWAJvghf9eAGlOupO6kG5Eo1i+PnpQvDQ6Fo=', 'RwMWyvNi14fYEccU69NP9w==', '2026-07-21 10:41:34'),
(6, 2, 'https://fcm.googleapis.com/fcm/send/etVUs_cmU2Q:APA91bHQRCriltmuneN-bFWhXd_EwGjU7fGqJJ7vA_kQcEMtPSKVrEYkdrwP1feM3bPE9W_uTNDspf0tNgchRs11bEfIsKUewam_C0bIEHc1auvmdEIkQwJB26hHjlYa4lWfQ4yOJtwB', 'BOzhpcyUdf5PDCpCVgBUdSYYniM+3EQBEMLZMF96BF7ZniDt3n9eWAJvghf9eAGlOupO6kG5Eo1i+PnpQvDQ6Fo=', 'RwMWyvNi14fYEccU69NP9w==', '2026-07-21 12:13:52'),
(7, 2, 'https://fcm.googleapis.com/fcm/send/cI4MH8g3jNA:APA91bHmCft2egvpBd448JhZ82AGQsAALRbMUbNGTomQJeYinH7jdbFt0IbYr1XS9WGF8DskEUxByj5soVgHVNKpRZUIGs01_9D6LFf8-VO3CEu_hBOU4aq0-XSW1OS1LCaLPaHf4mAh', 'BD7OoLSXsYrXFWV8BOYkLjGr4s5M5Re4iAQwUWFKma+K5R5RaXCOlQaVJbVN810izcGJvnkhmHDHzejJv/BPcB0=', 'jbORKfBNP5UuTwrze3iHtg==', '2026-07-21 12:15:31');

-- --------------------------------------------------------

--
-- Table structure for table `records`
--

CREATE TABLE `records` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `item_id` int NOT NULL,
  `record_date` date NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'done',
  `memo` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `records`
--

INSERT INTO `records` (`id`, `user_id`, `item_id`, `record_date`, `status`, `memo`, `created_at`) VALUES
(27, 1, 69, '2026-07-17', 'done', NULL, '2026-07-17 14:39:15'),
(28, 1, 68, '2026-07-17', 'done', 'テスト', '2026-07-17 14:39:33'),
(29, 1, 70, '2026-07-17', 'done', 'テスト', '2026-07-17 14:51:20'),
(30, 1, 54, '2026-07-23', 'todo', NULL, '2026-07-21 10:16:34'),
(32, 1, 72, '2026-07-21', 'done', 'テスト', '2026-07-21 11:12:15');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `login_id` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `login_id`, `password`, `created_at`, `updated_at`) VALUES
(1, '1111', '$2y$10$c8V83UNyi4dmfPKeaSzyY.CYHntgwlmBrqOWw6uBJI79sxodiskk2', '2026-06-30 11:53:55', '2026-06-30 11:53:55'),
(2, '2222', '$2y$10$YkC8stBvxNimMe4HgRL44eP1UZ0qxLk9.vzRt5Giq6Ososg2KG4hG', '2026-07-21 12:13:43', '2026-07-21 12:13:43');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `ai_advices`
--
ALTER TABLE `ai_advices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_daily_advice` (`user_id`,`target_date`);

--
-- Indexes for table `items`
--
ALTER TABLE `items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `push_subscriptions`
--
ALTER TABLE `push_subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `records`
--
ALTER TABLE `records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_daily_record` (`item_id`,`record_date`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `login_id` (`login_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `ai_advices`
--
ALTER TABLE `ai_advices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=205;

--
-- AUTO_INCREMENT for table `items`
--
ALTER TABLE `items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=73;

--
-- AUTO_INCREMENT for table `push_subscriptions`
--
ALTER TABLE `push_subscriptions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `records`
--
ALTER TABLE `records`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `ai_advices`
--
ALTER TABLE `ai_advices`
  ADD CONSTRAINT `ai_advices_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `items`
--
ALTER TABLE `items`
  ADD CONSTRAINT `items_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `push_subscriptions`
--
ALTER TABLE `push_subscriptions`
  ADD CONSTRAINT `push_subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `records`
--
ALTER TABLE `records`
  ADD CONSTRAINT `records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `records_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
