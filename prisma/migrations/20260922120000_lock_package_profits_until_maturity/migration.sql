-- Accrue package profit in lock until maturity; hold/release ledger types.
ALTER TABLE `transactions` MODIFY COLUMN `type` ENUM(
  'DEPOSIT',
  'WITHDRAWAL',
  'PROFIT_DISTRIBUTION',
  'PROFIT_ACCRUED',
  'PACKAGE_PROFIT_HOLD',
  'PACKAGE_PROFIT_RELEASE',
  'PACKAGE_RETURN',
  'PACKAGE_PURCHASE',
  'REFERRAL_BONUS_ADDED',
  'GIFT'
) NOT NULL;
