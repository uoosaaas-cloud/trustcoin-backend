-- Auto trades are site-wide and must not belong to any admin/user account.
ALTER TABLE `trades` DROP FOREIGN KEY `trades_created_by_admin_id_fkey`;

ALTER TABLE `trades` MODIFY `created_by_admin_id` VARCHAR(36) NULL;

UPDATE `trades` SET `created_by_admin_id` = NULL WHERE `source` = 'AUTO';

ALTER TABLE `trades` ADD CONSTRAINT `trades_created_by_admin_id_fkey` FOREIGN KEY (`created_by_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
