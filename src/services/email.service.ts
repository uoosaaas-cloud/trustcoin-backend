import { Resend } from "resend";
import { env, isProduction } from "../config/env";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
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

async function deliverEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const client = getResend();
  if (!client) {
    if (!isProduction) {
      // eslint-disable-next-line no-console
      console.warn(`[email] RESEND_API_KEY missing — skipped email to ${params.to}: ${params.subject}`);
    }
    return;
  }

  const { error } = await client.emails.send({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (error) {
    throw new Error(typeof error === "object" && error && "message" in error
      ? String((error as { message: string }).message)
      : "Resend delivery failed");
  }
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
  walletAddress: string
): Promise<void> {
  const subject = `[TrustCoin Admin] طلب سحب جديد — ${amount} USDT`;
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
    text: `طلب سحب جديد: ${userEmail} — ${amount} USDT → ${walletAddress}`,
  });
}
