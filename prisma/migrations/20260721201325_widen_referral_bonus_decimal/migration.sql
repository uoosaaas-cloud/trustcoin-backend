-- AlterTable
ALTER TABLE `packages` MODIFY `referral_bonus_1m` DECIMAL(6, 4) NOT NULL DEFAULT 0.00,
    MODIFY `referral_bonus_3m` DECIMAL(6, 4) NOT NULL DEFAULT 0.00,
    MODIFY `referral_bonus_6m` DECIMAL(6, 4) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE `referral_rewards` MODIFY `bonus_percentage` DECIMAL(6, 4) NOT NULL;
