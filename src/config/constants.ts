export const SUPPORTED_ROLES = ["USER", "ADMIN"] as const;

export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  BANNED: "BANNED",
} as const;

export const DECIMAL_PRECISION = {
  AMOUNT: 4, // matches Decimal(18,4) columns
  PERCENT: 4, // matches Decimal(5,4) columns
} as const;
