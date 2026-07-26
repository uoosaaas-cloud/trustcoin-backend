-- OTP purpose for email verification vs withdrawal confirmation

ALTER TABLE `otp_verifications`
  ADD COLUMN `purpose` ENUM('EMAIL_VERIFY', 'WITHDRAWAL') NOT NULL DEFAULT 'EMAIL_VERIFY';

CREATE INDEX `otp_verifications_email_purpose_idx` ON `otp_verifications`(`email`, `purpose`);
