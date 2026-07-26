-- AlterTable
ALTER TABLE `investments` ADD COLUMN `base_amount` DECIMAL(18, 4) NOT NULL,
    ADD COLUMN `current_amount` DECIMAL(18, 4) NOT NULL;

-- AlterTable
ALTER TABLE `packages` ADD COLUMN `referral_bonus_1m` DECIMAL(5, 4) NOT NULL DEFAULT 0.00,
    ADD COLUMN `referral_bonus_3m` DECIMAL(5, 4) NOT NULL DEFAULT 0.00,
    ADD COLUMN `referral_bonus_6m` DECIMAL(5, 4) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE `transactions` MODIFY `type` ENUM('DEPOSIT', 'WITHDRAWAL', 'PROFIT_DISTRIBUTION', 'PACKAGE_RETURN', 'REFERRAL_BONUS_ADDED') NOT NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `referral_code` VARCHAR(20) NOT NULL,
    ADD COLUMN `referred_by_id` VARCHAR(36) NULL;

-- CreateTable
CREATE TABLE `referral_rewards` (
    `id` VARCHAR(36) NOT NULL,
    `referrer_id` VARCHAR(36) NOT NULL,
    `referee_id` VARCHAR(36) NOT NULL,
    `investment_id` VARCHAR(36) NOT NULL,
    `bonus_percentage` DECIMAL(5, 4) NOT NULL,
    `bonus_amount` DECIMAL(18, 4) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `approved_by_admin_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `referral_rewards_referrer_id_idx`(`referrer_id`),
    INDEX `referral_rewards_referee_id_idx`(`referee_id`),
    INDEX `referral_rewards_investment_id_idx`(`investment_id`),
    INDEX `referral_rewards_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_referral_code_key` ON `users`(`referral_code`);

-- CreateIndex
CREATE INDEX `users_referred_by_id_idx` ON `users`(`referred_by_id`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_referred_by_id_fkey` FOREIGN KEY (`referred_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `referral_rewards` ADD CONSTRAINT `referral_rewards_referrer_id_fkey` FOREIGN KEY (`referrer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `referral_rewards` ADD CONSTRAINT `referral_rewards_referee_id_fkey` FOREIGN KEY (`referee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `referral_rewards` ADD CONSTRAINT `referral_rewards_investment_id_fkey` FOREIGN KEY (`investment_id`) REFERENCES `investments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `referral_rewards` ADD CONSTRAINT `referral_rewards_approved_by_admin_id_fkey` FOREIGN KEY (`approved_by_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
