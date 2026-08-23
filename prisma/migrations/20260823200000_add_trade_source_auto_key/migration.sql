-- AlterTable
ALTER TABLE `trades` ADD COLUMN `source` ENUM('ADMIN', 'AUTO') NOT NULL DEFAULT 'ADMIN';
ALTER TABLE `trades` ADD COLUMN `auto_key` VARCHAR(32) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `trades_auto_key_key` ON `trades`(`auto_key`);
