import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { Resend } from "resend";
import { env, isProduction } from "../config/env";

let resendClient: Resend | null = null;
let smtpTransport: Transporter | null = null;

function maskRecipient(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "(invalid-recipient)";
  const visible = local.length <= 1 ? "*" : `${local.slice(0, 1)}***`;
  return `${visible}@${domain}`;
}

function smtpSkipReason(): string | null {
  const host = env.SMTP_HOST.trim();
  const user = env.SMTP_USER.trim();
  const pass = env.SMTP_PASSWORD.trim();
  if (!host) return "missing_host";
  if (!user) return "missing_user";
  if (!pass) return "missing_pass";
  // Mailtrap sandbox never reaches real inboxes — ignore it in production.
  if (isProduction && /mailtrap/i.test(host)) return "mailtrap_ignored_in_production";
  // Brevo SMTP returns 250 then drops: "Your sending platform is currently disabled."
  if (isProduction && /smtp-relay\.brevo\.com/i.test(host)) return "brevo_platform_disabled";
  return null;
}

function isSmtpConfigured(): boolean {
  return smtpSkipReason() === null;
}

function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY.trim());
}

export type EmailProviderName = "smtp" | "resend" | "none";

/** Safe summary for startup logs (never includes passwords or API keys). */
export function describeEmailTransport(): {
  provider: EmailProviderName;
  host?: string;
  port?: number;
  from: string;
} {
  const from = env.EMAIL_FROM.trim();
  if (isResendConfigured()) {
    return { provider: "resend", from };
  }
  if (isSmtpConfigured()) {
    return { provider: "smtp", host: env.SMTP_HOST.trim(), port: env.SMTP_PORT, from };
  }
  return { provider: "none", from };
}

export function logEmailTransportStatus(): void {
  const info = describeEmailTransport();
  const fromMatch = info.from.match(/@([^>\s]+)/);
  const fromHost = fromMatch ? `@${fromMatch[1]}` : "(unset)";
  const smtpSkip = smtpSkipReason();
  // eslint-disable-next-line no-console
  console.log(
    `[email] provider=${info.provider}${info.host ? ` smtpHost=${info.host}` : ""}${
      typeof info.port === "number" ? ` smtpPort=${info.port}` : ""
    }${smtpSkip ? ` smtpSkip=${smtpSkip}` : ""} fromHost=${fromHost}`
  );
  if (isProduction && info.provider === "none") {
    // eslint-disable-next-line no-console
    console.error(
      "[email] No delivery provider in production. Set SMTP_USER/SMTP_PASS (Brevo) or RESEND_API_KEY."
    );
  }
}

function getResend(): Resend | null {
  if (!isResendConfigured()) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

function getSmtpTransport(): Transporter {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: env.SMTP_HOST.trim(),
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 20_000,
      auth: {
        user: env.SMTP_USER.trim(),
        pass: env.SMTP_PASSWORD,
      },
    });
  }
  return smtpTransport;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shared TrustCoin dark RTL email chrome. */
function wrapTrustCoinEmail(params: {
  title: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  const title = escapeHtml(params.title);
  const footer =
    params.footerNote ??
    "إذا لم تطلب هذا الإجراء، يمكنك تجاهل هذه الرسالة بأمان.";

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#05070f;font-family:'Segoe UI',Tahoma,Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#05070f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;border-collapse:collapse;">
          <tr>
            <td style="padding:28px 28px 12px;background:linear-gradient(160deg,#0b1224 0%,#0a1628 55%,#071018 100%);border:1px solid #1a2f4a;border-radius:20px 20px 0 0;">
              <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#22d3ee;font-weight:700;">TrustCoin</p>
              <h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#f8fafc;font-weight:700;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;background:#0b1224;border-left:1px solid #1a2f4a;border-right:1px solid #1a2f4a;color:#94a3b8;font-size:15px;line-height:1.75;">
              ${params.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;background:#071018;border:1px solid #1a2f4a;border-top:0;border-radius:0 0 20px 20px;">
              <p style="margin:0;font-size:12px;line-height:1.55;color:#475569;">${escapeHtml(footer)}</p>
              <p style="margin:10px 0 0;font-size:11px;color:#334155;">© TrustCoin · منصة استثمار آمنة</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function codeBox(code: string): string {
  return `
    <div style="margin:28px 0;padding:20px;text-align:center;background:#05070f;border:1px solid #22d3ee55;border-radius:14px;box-shadow:0 0 24px rgba(34,211,238,0.18);">
      <p style="margin:0;font-size:34px;font-weight:800;letter-spacing:10px;color:#22d3ee;font-family:ui-monospace,Menlo,Consolas,monospace;direction:ltr;">
        ${escapeHtml(code)}
      </p>
    </div>
  `;
}

function ctaButton(label: string, href: string): string {
  return `
    <p style="margin:28px 0;text-align:center;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#0891b2,#22d3ee);color:#041016;text-decoration:none;font-weight:700;border-radius:12px;font-size:15px;">
        ${escapeHtml(label)}
      </a>
    </p>
  `;
}

async function sendViaSmtp(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const info = await getSmtpTransport().sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
  const accepted = Array.isArray(info.accepted) ? info.accepted.length : 0;
  // eslint-disable-next-line no-console
  console.info(
    `[email] smtp accepted=${accepted} messageId=${info.messageId ?? "n/a"} to=${maskRecipient(params.to)}`
  );
}

async function sendViaResend(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const client = getResend();
  if (!client) {
    throw new Error("Resend client is not configured");
  }

  const { data, error } = await client.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (error) {
    throw new Error(
      typeof error === "object" && error && "message" in error
        ? String((error as { message: string }).message)
        : "Resend delivery failed"
    );
  }

  const id = data && typeof data === "object" && "id" in data ? String((data as { id: string }).id) : "n/a";
  // eslint-disable-next-line no-console
  console.info(`[email] resend id=${id} to=${maskRecipient(params.to)}`);
}

async function deliverEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const from = env.EMAIL_FROM.trim();
  const smtpReady = isSmtpConfigured();
  const resendReady = isResendConfigured();

  if (!smtpReady && !resendReady) {
    // eslint-disable-next-line no-console
    console.error(
      `[email] skipped — no provider configured. to=${maskRecipient(params.to)} subject="${params.subject}"`
    );
    if (isProduction) {
      throw new Error("Email delivery is not configured");
    }
    return;
  }

  // Resend's onboarding address can only deliver to the account owner.
  if (isProduction && /@resend\.dev\b/i.test(from)) {
    throw new Error(
      `EMAIL_FROM must use your verified domain (got "${from}"). Set EMAIL_FROM to e.g. TrustCoin <noreply@trustcoin.cc>.`
    );
  }

  // Prefer Resend (HTTPS) over SMTP. Render free blocks 465/587, and Brevo SMTP
  // currently accepts then internally drops. Resend DNS lives on Cloudflare.
  const providers: Array<"smtp" | "resend"> = [];
  if (resendReady) providers.push("resend");
  if (smtpReady) providers.push("smtp");

  let lastError: unknown;
  for (const provider of providers) {
    try {
      if (provider === "smtp") {
        await sendViaSmtp({ ...params, from });
      } else {
        await sendViaResend({ ...params, from });
      }
      return;
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-console
      console.error(
        `[email] ${provider} failed to=${maskRecipient(params.to)} subject="${params.subject}":`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Email delivery failed");
}

/**
 * Fire-and-forget wrapper — never throws to callers / never blocks API response.
 */
export function queueEmail(task: () => Promise<void>, label: string): void {
  void task().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(
      `[email] ${label} failed:`,
      error instanceof Error ? error.message : String(error)
    );
  });
}

/** رمز تأكيد الحساب (OTP). */
export async function sendVerificationEmail(toEmail: string, code: string): Promise<void> {
  const subject = "رمز تأكيد حساب TrustCoin";
  const html = wrapTrustCoinEmail({
    title: "تأكيد البريد الإلكتروني",
    bodyHtml: `
      <p style="margin:0;">مرحباً بك في TrustCoin.</p>
      <p style="margin:14px 0 0;">استخدم الرمز التالي لإتمام التحقق من حسابك:</p>
      ${codeBox(code)}
      <p style="margin:0;font-size:13px;color:#64748b;">ينتهي صلاحية الرمز خلال ${env.OTP_EXPIRY_MINUTES} دقائق.</p>
    `,
  });

  await deliverEmail({
    to: toEmail,
    subject,
    html,
    text: `رمز تأكيد TrustCoin: ${code}. صالح لمدة ${env.OTP_EXPIRY_MINUTES} دقائق.`,
  });
}

/** OTP تسجيل دخول لوحة المشرف — يُرسل في كل محاولة دخول ناجحة بكلمة المرور. */
export async function sendAdminLoginOtp(toEmail: string, code: string): Promise<void> {
  const subject = "رمز دخول المشرف — TrustCoin";
  const html = wrapTrustCoinEmail({
    title: "تأكيد دخول لوحة الإدارة",
    bodyHtml: `
      <p style="margin:0;">تم طلب تسجيل دخول إلى لوحة مشرف TrustCoin.</p>
      <p style="margin:14px 0 0;">أدخل الرمز التالي لإكمال الدخول. لا تشارك هذا الرمز مع أي شخص.</p>
      ${codeBox(code)}
      <p style="margin:0;font-size:13px;color:#64748b;">ينتهي صلاحية الرمز خلال ${env.OTP_EXPIRY_MINUTES} دقائق.</p>
    `,
    footerNote: "إذا لم تحاول تسجيل الدخول، أمّن حساب المشرف فوراً وغيّر كلمة المرور.",
  });

  await deliverEmail({
    to: toEmail,
    subject,
    html,
    text: `رمز دخول مشرف TrustCoin: ${code}. صالح لمدة ${env.OTP_EXPIRY_MINUTES} دقائق.`,
  });
}

/** OTP تأكيد السحب (نفس الهوية البصرية). */
export async function sendWithdrawalOtpEmail(toEmail: string, code: string): Promise<void> {
  const subject = "رمز تأكيد السحب — TrustCoin";
  const html = wrapTrustCoinEmail({
    title: "تأكيد طلب السحب",
    bodyHtml: `
      <p style="margin:0;">لتأكيد طلب السحب، أدخل الرمز التالي في المنصة:</p>
      ${codeBox(code)}
      <p style="margin:0;font-size:13px;color:#64748b;">ينتهي صلاحية الرمز خلال ${env.OTP_EXPIRY_MINUTES} دقائق. لا تشارك هذا الرمز مع أي شخص.</p>
    `,
    footerNote: "إذا لم تطلب سحباً، تجاهل هذه الرسالة وأمّن حسابك فوراً.",
  });

  await deliverEmail({
    to: toEmail,
    subject,
    html,
    text: `رمز تأكيد السحب TrustCoin: ${code}. صالح لمدة ${env.OTP_EXPIRY_MINUTES} دقائق.`,
  });
}

/** رابط إعادة تعيين كلمة المرور. */
export async function sendPasswordResetEmail(toEmail: string, resetLink: string): Promise<void> {
  const subject = "إعادة تعيين كلمة المرور — TrustCoin";
  const html = wrapTrustCoinEmail({
    title: "إعادة تعيين كلمة المرور",
    bodyHtml: `
      <p style="margin:0;">تلقّينا طلباً لإعادة تعيين كلمة مرور حسابك.</p>
      <p style="margin:14px 0 0;">اضغط الزر أدناه للمتابعة. الرابط صالح لفترة محدودة.</p>
      ${ctaButton("إعادة تعيين كلمة المرور", resetLink)}
      <p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;direction:ltr;text-align:left;">
        ${escapeHtml(resetLink)}
      </p>
    `,
    footerNote: "إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة — لن يتم تغيير شيء.",
  });

  await deliverEmail({
    to: toEmail,
    subject,
    html,
    text: `أعد تعيين كلمة مرور TrustCoin عبر: ${resetLink}`,
  });
}

/** إشعار المستخدم بعد تأكيد الإيداع على السلسلة. */
export async function sendDepositNotification(
  toEmail: string,
  amount: string,
  txHash: string
): Promise<void> {
  const subject = `تم إيداع ${amount} USDT في حسابك — TrustCoin`;
  const html = wrapTrustCoinEmail({
    title: "تم تأكيد الإيداع",
    bodyHtml: `
      <p style="margin:0;">تم إضافة الإيداع إلى رصيدك المتاح بنجاح.</p>
      <table role="presentation" style="margin:20px 0;width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:12px 14px;background:#05070f;border:1px solid #1a2f4a;border-radius:12px;">
            <p style="margin:0;font-size:12px;color:#64748b;">المبلغ</p>
            <p style="margin:6px 0 0;font-size:22px;font-weight:800;color:#22d3ee;direction:ltr;text-align:right;">
              ${escapeHtml(amount)} USDT
            </p>
          </td>
        </tr>
        <tr><td style="height:10px;"></td></tr>
        <tr>
          <td style="padding:12px 14px;background:#05070f;border:1px solid #1a2f4a;border-radius:12px;">
            <p style="margin:0;font-size:12px;color:#64748b;">مرجع العملية</p>
            <p style="margin:6px 0 0;font-size:12px;color:#cbd5e1;word-break:break-all;direction:ltr;text-align:left;font-family:ui-monospace,Menlo,Consolas,monospace;">
              ${escapeHtml(txHash)}
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:0;">يمكنك الآن الاستثمار أو السحب من رصيدك المتاح.</p>
    `,
  });

  await deliverEmail({
    to: toEmail,
    subject,
    html,
    text: `تم إيداع ${amount} USDT في TrustCoin. المرجع: ${txHash}`,
  });
}

function formatAdminEmailBody(body: string): string {
  return escapeHtml(body)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n/g, "<br>");
}

function trustBrandHeaderHtml(): string {
  const logoUrl = `${env.APP_BASE_URL.replace(/\/$/, "")}/logo-icon.svg`;
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 8px;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:middle;padding:0 12px 0 0;">
          <img src="${escapeHtml(logoUrl)}" alt="TrustCoin" width="40" height="40" style="display:block;border:0;border-radius:10px;width:40px;height:40px;" />
        </td>
        <td style="vertical-align:middle;">
          <p style="margin:0;font-size:20px;font-weight:800;letter-spacing:0.04em;color:#f8fafc;font-family:'Segoe UI',Tahoma,Arial,Helvetica,sans-serif;">TrustCoin</p>
          <p style="margin:4px 0 0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#22d3ee;font-weight:700;">Trust</p>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Admin-composed message to a registered user.
 * Reuses the same wrap chrome, SMTP/Resend delivery, and sender as Gift Email.
 * Body is HTML-escaped — admin text is never executed as markup.
 */
function wrapAdminDirectEmail(subject: string, bodyText: string): { html: string; text: string } {
  const isRtl = /[\u0600-\u06FF]/.test(bodyText);
  const dir = isRtl ? "rtl" : "ltr";
  const lang = isRtl ? "ar" : "en";
  const title = escapeHtml(subject);
  const bodyHtml = formatAdminEmailBody(bodyText);
  const footer = isRtl
    ? "هذه رسالة من إدارة TrustCoin. إذا لم تكن تتوقع هذه الرسالة، يمكنك تجاهلها بأمان."
    : "This message was sent by TrustCoin Admin. If you were not expecting it, you can ignore it.";

  const html = `
<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#05070f;font-family:'Segoe UI',Tahoma,Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#05070f;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;border-collapse:collapse;">
          <tr>
            <td style="padding:24px 24px 16px;background:linear-gradient(160deg,#0b1224 0%,#0a1628 55%,#071018 100%);border:1px solid #1a2f4a;border-radius:20px 20px 0 0;text-align:center;">
              ${trustBrandHeaderHtml()}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 28px;background:#0b1224;border-left:1px solid #1a2f4a;border-right:1px solid #1a2f4a;color:#e2e8f0;font-size:15px;line-height:1.8;text-align:${isRtl ? "right" : "left"};">
              <div style="margin:0;color:#cbd5e1;">${bodyHtml}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 24px;background:#071018;border:1px solid #1a2f4a;border-top:0;border-radius:0 0 20px 20px;">
              <p style="margin:0;font-size:12px;line-height:1.55;color:#475569;">${escapeHtml(footer)}</p>
              <p style="margin:10px 0 0;font-size:11px;color:#334155;">© TrustCoin</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { html, text: bodyText.trim() };
}

/** Direct admin → user email. Same provider/config/delivery as Gift Email. */
export async function sendAdminDirectEmail(
  toEmail: string,
  subject: string,
  body: string
): Promise<void> {
  const wrapped = wrapAdminDirectEmail(subject, body);
  await deliverEmail({
    to: toEmail,
    subject: subject.trim(),
    html: wrapped.html,
    text: wrapped.text,
  });
}

/** إشعار المستخدم بعد إضافة هدية إدارية إلى الرصيد المتاح. */
export async function sendGiftNotification(
  toEmail: string,
  amount: string,
  note?: string | null
): Promise<void> {
  const subject = `تم إضافة هدية ${amount} USDT إلى حسابك — TrustCoin`;
  const noteHtml = note
    ? `<p style="margin:16px 0 0;color:#94a3b8;">ملاحظة الإدارة: ${escapeHtml(note)}</p>`
    : "";
  const html = wrapTrustCoinEmail({
    title: "تم إضافة هدية إلى رصيدك",
    bodyHtml: `
      <p style="margin:0;">أضافت إدارة TrustCoin هدية إلى رصيدك المتاح.</p>
      <table role="presentation" style="margin:20px 0;width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:12px 14px;background:#05070f;border:1px solid #1a2f4a;border-radius:12px;">
            <p style="margin:0;font-size:12px;color:#64748b;">مبلغ الهدية</p>
            <p style="margin:6px 0 0;font-size:22px;font-weight:800;color:#22d3ee;direction:ltr;text-align:right;">
              ${escapeHtml(amount)} USDT
            </p>
          </td>
        </tr>
      </table>
      ${noteHtml}
      <p style="margin:16px 0 0;">يمكنك الاستثمار أو السحب من الرصيد المتاح الآن.</p>
    `,
    footerNote: "هذه رسالة تلقائية من TrustCoin بعد إضافة هدية إلى حسابك.",
  });

  await deliverEmail({
    to: toEmail,
    subject,
    html,
    text: `تم إضافة هدية ${amount} USDT إلى رصيدك المتاح في TrustCoin.${note ? ` ملاحظة: ${note}` : ""}`,
  });
}

/** طلب رسمي لإعادة رفع صورة أوضح لبطاقة الهوية أو جواز السفر. */
export async function sendKycReuploadRequest(toEmail: string): Promise<void> {
  const subject = "طلب إعادة رفع وثيقة الهوية — TrustCoin";
  const html = wrapTrustCoinEmail({
    title: "نحتاج صورة أوضح لوثيقة الهوية",
    bodyHtml: `
      <p style="margin:0;">مرحباً،</p>
      <p style="margin:14px 0 0;">لم نتمكن من استكمال مراجعة حسابك في TrustCoin لأن صورة وثيقة الهوية غير واضحة أو غير متوفرة لدينا.</p>
      <p style="margin:14px 0 0;">يرجى تسجيل الدخول إلى حسابك، ثم رفع <strong style="color:#f8fafc;">صورة واضحة لبطاقة الهوية أو جواز السفر</strong> من صفحة انتظار الموافقة.</p>
      <ul style="margin:16px 0 0;padding-right:18px;color:#94a3b8;font-size:14px;line-height:1.8;">
        <li>صورة ملونة وحديثة</li>
        <li>تظهر جميع البيانات والأركان الأربعة</li>
        <li>بدون قص أو تغطية أو وهج ضوء</li>
      </ul>
      <table role="presentation" style="margin:20px 0 0;width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:14px 16px;background:#05070f;border:1px solid #1a2f4a;border-radius:12px;">
            <p style="margin:0;font-size:13px;color:#94a3b8;">بعد رفع الصورة سيتم إضافة</p>
            <p style="margin:6px 0 0;font-size:22px;font-weight:800;color:#22d3ee;direction:ltr;text-align:right;">20 USDT</p>
            <p style="margin:8px 0 0;font-size:13px;color:#cbd5e1;">إلى رصيدك المتاح. هذه هدية مقدمة من شركة TrustCoin.</p>
          </td>
        </tr>
      </table>
    `,
    footerNote: "هذه رسالة رسمية من إدارة TrustCoin بخصوص التحقق من الهوية. إذا لم تسجّل حساباً لدينا، يمكنك تجاهل هذه الرسالة.",
  });

  await deliverEmail({
    to: toEmail,
    subject,
    html,
    text:
      `طلب إعادة رفع وثيقة الهوية — TrustCoin\n\n` +
      `لم نتمكن من استكمال مراجعة حسابك لأن صورة الهوية غير واضحة أو غير متوفرة.\n` +
      `يرجى تسجيل الدخول إلى حسابك، ثم رفع صورة أوضح لبطاقة الهوية أو جواز السفر من صفحة انتظار الموافقة.\n` +
      `بعد رفع الصورة سيتم إضافة 20 USDT إلى رصيدك المتاح. هذه هدية مقدمة من شركة TrustCoin.\n`,
  });
}

export type WithdrawalEmailStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

/** إشعار المستخدم بحالة طلب السحب. */
export async function sendWithdrawalStatusEmail(
  toEmail: string,
  amount: string,
  status: WithdrawalEmailStatus,
  reason?: string
): Promise<void> {
  const statusCopy: Record<WithdrawalEmailStatus, { title: string; body: string; subject: string }> = {
    PENDING: {
      subject: `تم استلام طلب سحب ${amount} USDT — TrustCoin`,
      title: "طلب السحب قيد المراجعة",
      body: "استلمنا طلب السحب الخاص بك وهو الآن قيد مراجعة الإدارة.",
    },
    APPROVED: {
      subject: `تمت الموافقة على سحب ${amount} USDT — TrustCoin`,
      title: "تمت الموافقة على السحب",
      body: "وافقنا على طلب السحب. سيتم تحويل المبلغ إلى محفظتك يدوياً من المحفظة الرئيسية.",
    },
    COMPLETED: {
      subject: `اكتمل سحب ${amount} USDT — TrustCoin`,
      title: "اكتمل السحب",
      body: "تم تسجيل سحبك كمكتمل في النظام.",
    },
    REJECTED: {
      subject: `تم رفض طلب سحب ${amount} USDT — TrustCoin`,
      title: "تم رفض طلب السحب",
      body: "تم رفض طلب السحب وإعادة المبلغ إلى رصيدك المتاح.",
    },
  };

  const copy = statusCopy[status];
  const reasonHtml = reason
    ? `<p style="margin:16px 0 0;padding:12px 14px;background:#1c0a0a;border:1px solid #7f1d1d;border-radius:12px;color:#fecaca;font-size:13px;">السبب: ${escapeHtml(reason)}</p>`
    : "";

  const html = wrapTrustCoinEmail({
    title: copy.title,
    bodyHtml: `
      <p style="margin:0;">${copy.body}</p>
      <p style="margin:18px 0 0;font-size:20px;font-weight:800;color:#22d3ee;direction:ltr;text-align:right;">
        ${escapeHtml(amount)} USDT
      </p>
      ${reasonHtml}
    `,
  });

  await deliverEmail({
    to: toEmail,
    subject: copy.subject,
    html,
    text: `${copy.title}: ${amount} USDT${reason ? ` — ${reason}` : ""}`,
  });
}

/** تنبيه فوري للأدمن عند طلب سحب جديد. */
export async function sendAdminNewWithdrawalAlert(
  adminEmail: string,
  userEmail: string,
  amount: string,
  walletAddress: string,
  network?: string
): Promise<void> {
  const subject = `[TrustCoin Admin] طلب سحب جديد — ${amount} USDT`;
  const networkRow = network
    ? `<tr>
          <td style="padding:10px 0;color:#64748b;">الشبكة</td>
          <td style="padding:10px 0;color:#e2e8f0;direction:ltr;text-align:left;">${escapeHtml(network)}</td>
        </tr>`
    : "";
  const html = wrapTrustCoinEmail({
    title: "طلب سحب جديد يحتاج مراجعة",
    bodyHtml: `
      <p style="margin:0;">يوجد طلب سحب معلّق يتطلب موافقتك.</p>
      <table role="presentation" style="margin:20px 0;width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:10px 0;color:#64748b;">المستخدم</td>
          <td style="padding:10px 0;color:#e2e8f0;direction:ltr;text-align:left;">${escapeHtml(userEmail)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#64748b;">المبلغ</td>
          <td style="padding:10px 0;color:#22d3ee;font-weight:700;direction:ltr;text-align:left;">${escapeHtml(amount)} USDT</td>
        </tr>
        ${networkRow}
        <tr>
          <td style="padding:10px 0;color:#64748b;">المحفظة</td>
          <td style="padding:10px 0;color:#cbd5e1;word-break:break-all;direction:ltr;text-align:left;font-family:ui-monospace,Menlo,Consolas,monospace;">
            ${escapeHtml(walletAddress)}
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#94a3b8;">راجع الطلب من لوحة الإدارة ثم أرسل USDT يدوياً عند الموافقة.</p>
    `,
    footerNote: "تنبيه داخلي لفريق TrustCoin Admin.",
  });

  await deliverEmail({
    to: adminEmail,
    subject,
    html,
    text: `طلب سحب جديد: ${userEmail} — ${amount} USDT [${network ?? "n/a"}] → ${walletAddress}`,
  });
}
