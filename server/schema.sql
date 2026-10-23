-- AI Notes-to-Question Practice Platform Database Schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS `ai_notes_quiz_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `ai_notes_quiz_db`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `date_of_birth` DATE NULL,
  `avatar_url` LONGTEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Notes Table
CREATE TABLE IF NOT EXISTS `notes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `extracted_text` LONGTEXT NOT NULL,
  `content_hash` CHAR(64) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_notes_user_id` (`user_id`),
  INDEX `idx_notes_content_hash` (`content_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Quizzes Table
CREATE TABLE IF NOT EXISTS `quizzes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `note_id` INT NOT NULL,
  `difficulty` ENUM('Easy', 'Medium', 'Hard') NOT NULL,
  `quiz_type` ENUM('mcq', 'theoretical', 'mixed') DEFAULT 'mcq',
  `total_questions` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_quizzes_note` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE,
  INDEX `idx_quizzes_note_id` (`note_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Questions Table
CREATE TABLE IF NOT EXISTS `questions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quiz_id` INT NOT NULL,
  `question_type` ENUM('mcq', 'theoretical') DEFAULT 'mcq',
  `question_text` TEXT NOT NULL,
  `option_a` TEXT NULL,
  `option_b` TEXT NULL,
  `option_c` TEXT NULL,
  `option_d` TEXT NULL,
  `correct_option` ENUM('A', 'B', 'C', 'D') NULL,
  `ideal_answer` TEXT NULL,
  `key_points` TEXT NULL,
  `explanation` TEXT NOT NULL,
  CONSTRAINT `fk_questions_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE,
  INDEX `idx_questions_quiz_id` (`quiz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Quiz Attempts Table
CREATE TABLE IF NOT EXISTS `quiz_attempts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `quiz_id` INT NOT NULL,
  `score` DECIMAL(5,2) NOT NULL,
  `time_taken_seconds` INT NOT NULL,
  `attempted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_attempts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_attempts_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE,
  INDEX `idx_attempts_user_id` (`user_id`),
  INDEX `idx_attempts_quiz_id` (`quiz_id`),
  INDEX `idx_attempts_attempted_at` (`attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Attempt Answers Table
CREATE TABLE IF NOT EXISTS `attempt_answers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `attempt_id` INT NOT NULL,
  `question_id` INT NOT NULL,
  `selected_option` ENUM('A', 'B', 'C', 'D') NULL,
  `user_answer` TEXT NULL,
  `is_correct` BOOLEAN NOT NULL,
  `score_awarded` DECIMAL(5, 2) DEFAULT 0.00,
  `ai_feedback` TEXT NULL,
  CONSTRAINT `fk_answers_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_answers_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE,
  INDEX `idx_answers_attempt_id` (`attempt_id`),
  INDEX `idx_answers_question_id` (`question_id`),
  INDEX `idx_answers_is_correct` (`is_correct`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
