-- AlterTable
ALTER TABLE `deposit_requests` ADD COLUMN `deposit_address_id` VARCHAR(36) NULL;

-- CreateTable
CREATE TABLE `user_deposit_addresses` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `network` VARCHAR(20) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `derivation_index` INTEGER NOT NULL,
    `encrypted_private_key` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_deposit_addresses_user_id_idx`(`user_id`),
    UNIQUE INDEX `user_deposit_addresses_user_id_network_key`(`user_id`, `network`),
    UNIQUE INDEX `user_deposit_addresses_network_address_key`(`network`, `address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `deposit_requests_deposit_address_id_idx` ON `deposit_requests`(`deposit_address_id`);

-- AddForeignKey
ALTER TABLE `deposit_requests` ADD CONSTRAINT `deposit_requests_deposit_address_id_fkey` FOREIGN KEY (`deposit_address_id`) REFERENCES `user_deposit_addresses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_deposit_addresses` ADD CONSTRAINT `user_deposit_addresses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
