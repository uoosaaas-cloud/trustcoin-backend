-- Account status enum + KYC fields + rename package min_limit -> amount

-- 1) Account status
ALTER TABLE `users` MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING';

UPDATE `users` SET `status` = 'ACTIVE' WHERE `status` IS NULL OR `status` = '' OR `status` NOT IN ('PENDING', 'ACTIVE', 'BLOCKED', 'SUSPENDED');
UPDATE `users` SET `status` = 'BLOCKED' WHERE `status` = 'SUSPENDED';

ALTER TABLE `users`
  MODIFY COLUMN `status` ENUM('PENDING', 'ACTIVE', 'BLOCKED') NOT NULL DEFAULT 'PENDING';

-- Keep existing verified users usable after migration
UPDATE `users` SET `status` = 'ACTIVE' WHERE `role` = 'ADMIN' OR `is_verified` = true;

-- 2) KYC columns
ALTER TABLE `users`
  ADD COLUMN `id_passport_number` VARCHAR(64) NULL,
  ADD COLUMN `id_document_path` VARCHAR(500) NULL;

CREATE UNIQUE INDEX `users_id_passport_number_key` ON `users`(`id_passport_number`);

-- 3) Fixed package amount (rename min_limit -> amount)
ALTER TABLE `packages` CHANGE `min_limit` `amount` DECIMAL(18, 4) NOT NULL;
