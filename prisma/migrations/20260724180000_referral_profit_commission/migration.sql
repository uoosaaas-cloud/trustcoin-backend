-- Referral commission overhaul: 25% of package profit, pending lock, new statuses

-- 1) Pending referral bonus on users
ALTER TABLE `users`
  ADD COLUMN `pending_referral_bonus` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000;

-- 2) Expected profit on rewards (commission base)
ALTER TABLE `referral_rewards`
  ADD COLUMN `expected_profit` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000;

-- 3) Expand enum to include new values, then remap legacy rows
ALTER TABLE `referral_rewards`
  MODIFY COLUMN `status` ENUM(
    'PENDING',
    'APPROVED',
    'REJECTED',
    'PENDING_PACKAGE_ACTIVE',
    'PACKAGE_COMPLETED_AWAITING_ADMIN',
    'APPROVED_RELEASED'
  ) NOT NULL DEFAULT 'PENDING';

UPDATE `referral_rewards` SET `status` = 'APPROVED_RELEASED' WHERE `status` = 'APPROVED';
UPDATE `referral_rewards` SET `status` = 'PACKAGE_COMPLETED_AWAITING_ADMIN' WHERE `status` = 'PENDING';

ALTER TABLE `referral_rewards`
  MODIFY COLUMN `status` ENUM(
    'PENDING_PACKAGE_ACTIVE',
    'PACKAGE_COMPLETED_AWAITING_ADMIN',
    'APPROVED_RELEASED',
    'REJECTED'
  ) NOT NULL DEFAULT 'PENDING_PACKAGE_ACTIVE';

-- 4) Rebuild pending_referral_bonus from open (non-released) rewards
UPDATE `users` u
INNER JOIN (
  SELECT `referrer_id` AS uid, COALESCE(SUM(`bonus_amount`), 0) AS total
  FROM `referral_rewards`
  WHERE `status` IN ('PENDING_PACKAGE_ACTIVE', 'PACKAGE_COMPLETED_AWAITING_ADMIN')
  GROUP BY `referrer_id`
) t ON t.uid = u.id
SET u.`pending_referral_bonus` = t.total;
