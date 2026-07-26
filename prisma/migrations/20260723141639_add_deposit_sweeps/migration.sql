-- AlterTable
ALTER TABLE `deposit_requests` ADD COLUMN `sweep_tx_hash` VARCHAR(191) NULL,
    ADD COLUMN `swept_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `user_deposit_addresses` ADD COLUMN `last_sweep_status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED') NULL,
    ADD COLUMN `last_sweep_tx_hash` VARCHAR(191) NULL,
    ADD COLUMN `last_swept_at` DATETIME(3) NULL,
    ADD COLUMN `sweep_lock_until` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `deposit_sweeps` (
    `id` VARCHAR(36) NOT NULL,
    `deposit_address_id` VARCHAR(36) NOT NULL,
    `network` VARCHAR(20) NOT NULL,
    `amount_usdt` DECIMAL(18, 6) NOT NULL,
    `from_address` VARCHAR(191) NOT NULL,
    `to_address` VARCHAR(191) NOT NULL,
    `sweep_tx_hash` VARCHAR(191) NULL,
    `gas_topup_tx_hash` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `error_message` TEXT NULL,
    `attempt_count` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `deposit_sweeps_deposit_address_id_idx`(`deposit_address_id`),
    INDEX `deposit_sweeps_status_idx`(`status`),
    INDEX `deposit_sweeps_network_idx`(`network`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `user_deposit_addresses_last_sweep_status_idx` ON `user_deposit_addresses`(`last_sweep_status`);

-- AddForeignKey
ALTER TABLE `deposit_sweeps` ADD CONSTRAINT `deposit_sweeps_deposit_address_id_fkey` FOREIGN KEY (`deposit_address_id`) REFERENCES `user_deposit_addresses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
