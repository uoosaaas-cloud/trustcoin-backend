-- One commission row per investment (prevents duplicate referral credits).
CREATE UNIQUE INDEX `referral_rewards_investment_id_key` ON `referral_rewards`(`investment_id`);
