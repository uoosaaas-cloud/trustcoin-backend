-- CreateTable
CREATE TABLE `trades` (
    `id` VARCHAR(36) NOT NULL,
    `symbol` VARCHAR(32) NOT NULL,
    `side` ENUM('BUY', 'SELL') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `outcome` ENUM('PROFITABLE', 'LOSS', 'PENDING') NOT NULL DEFAULT 'PROFITABLE',
    `note` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_admin_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trades_is_active_created_at_idx`(`is_active`, `created_at`),
    INDEX `trades_created_by_admin_id_idx`(`created_by_admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trades` ADD CONSTRAINT `trades_created_by_admin_id_fkey` FOREIGN KEY (`created_by_admin_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
