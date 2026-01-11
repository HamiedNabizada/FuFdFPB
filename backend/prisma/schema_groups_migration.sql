-- Schema-Gruppen Feature Migration
-- Führe diese Statements in MariaDB aus, bevor du das Feature nutzt

-- 1. Neue Tabelle: schema_groups
CREATE TABLE IF NOT EXISTS `schema_groups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `version` VARCHAR(50) NOT NULL,
  `description` TEXT,
  `uploaded_by` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `name_version` (`name`, `version`),
  FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
);

-- 2. Erweitere schemas Tabelle
ALTER TABLE `schemas`
  ADD COLUMN IF NOT EXISTS `group_id` INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `role` VARCHAR(50) DEFAULT 'standalone',
  ADD COLUMN IF NOT EXISTS `filename` VARCHAR(255) DEFAULT NULL,
  ADD INDEX IF NOT EXISTS `idx_group_id` (`group_id`),
  ADD CONSTRAINT `fk_schemas_group` FOREIGN KEY (`group_id`) REFERENCES `schema_groups`(`id`) ON DELETE CASCADE;

-- 3. Neue Tabelle: schema_dependencies
CREATE TABLE IF NOT EXISTS `schema_dependencies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `source_schema_id` INT NOT NULL,
  `target_schema_id` INT NOT NULL,
  `dependency_type` VARCHAR(50) NOT NULL,
  `namespace` VARCHAR(500),
  `schema_location` VARCHAR(500) NOT NULL,
  UNIQUE KEY `unique_dependency` (`source_schema_id`, `target_schema_id`, `dependency_type`),
  FOREIGN KEY (`source_schema_id`) REFERENCES `schemas`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`target_schema_id`) REFERENCES `schemas`(`id`) ON DELETE CASCADE
);

-- 4. Erweitere comments Tabelle für Gruppen-Kommentare
ALTER TABLE `comments`
  MODIFY COLUMN `schema_id` INT DEFAULT NULL,
  MODIFY COLUMN `xpath` VARCHAR(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `group_id` INT DEFAULT NULL,
  ADD INDEX IF NOT EXISTS `idx_comment_group_id` (`group_id`),
  ADD CONSTRAINT `fk_comments_group` FOREIGN KEY (`group_id`) REFERENCES `schema_groups`(`id`) ON DELETE CASCADE;
