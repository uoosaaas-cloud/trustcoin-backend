-- Denormalized referral invite counter on users

ALTER TABLE `users`
  ADD COLUMN `referrals_count` INT NOT NULL DEFAULT 0;

-- Backfill from existing referred_by_id links
UPDATE `users` u
LEFT JOIN (
  SELECT `referred_by_id` AS uid, COUNT(*) AS cnt
  FROM `users`
  WHERE `referred_by_id` IS NOT NULL
  GROUP BY `referred_by_id`
) t ON t.uid = u.id
SET u.`referrals_count` = COALESCE(t.cnt, 0);
