import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { randomUUID } from 'node:crypto';

const TRACKING_BASE = process.env.TRACKING_BASE ?? 'https://api.firststringers.com/email';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://firststringers.com';

type Recipient = { to: string; name?: string };


@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(private readonly mailer: MailerService) {}

  async sendWelcomeEmail(params: { to: string; name: string }) {
    const { to, name } = params;
    const year = new Date().getFullYear();
    const html = `
      <!doctype html>
      <meta name="color-scheme" content="light">
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;max-width:520px;margin:0 auto">
        <span style="display:none;visibility:hidden;opacity:0;height:0;width:0">Welcome to First Stringers, the athletes network.</span>
        <div style="background:#000;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;color:#00D4AA;font-size:28px;letter-spacing:1px">YOU'RE IN!</h1>
        </div>
        <div style="background:#111827;padding:32px;border-radius:0 0 8px 8px;color:#e5e7eb">
          <p style="margin:0 0 16px">Hey <b>${name}</b>,</p>
          <p style="margin:0 0 16px">You just took the first step toward being part of something bigger.</p>
          <p style="margin:0 0 16px">Whether you're an athlete chasing your dreams or a recruiter searching for the next big talent, you're now officially on the inside.</p>
          <p style="margin:0 0 24px">We'll keep you updated as we gear up. Expect sneak peeks, news, and insider updates on everything coming your way.</p>
          <a href="${FRONTEND_URL}" style="display:inline-block;background:#00D4AA;color:#000;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:700">Go to First Stringers →</a>
          <p style="font-size:12px;color:#6b7280;margin-top:32px">&copy; ${year} First Stringers</p>
        </div>
      </div>`.trim();

    await this.mailer.sendMail({
      to,
      subject: "YOU'RE IN! – First Stringers",
      text: [
        `You're in! Welcome to First Stringers, ${name}.`,
        ``,
        `You just took the first step toward being part of something bigger. We'll keep you updated as we gear up for the official launch.`,
        ``,
        `Visit us at: ${FRONTEND_URL}`,
      ].join('\n'),
      html,
    });
  }

  async sendOtpEmail(params: { to: string; code: string; name?: string }) {
    const { to, code, name } = params;
    const year = new Date().getFullYear();
    const html = `
      <!doctype html>
      <meta name="color-scheme" content="light">
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;max-width:480px;margin:0 auto">
        <span style="display:none;visibility:hidden;opacity:0;height:0;width:0">Your First Stringers verification code — valid for 10 minutes</span>
        <h1 style="margin:0 0 8px;font-size:22px">Verify your email</h1>
        ${name ? `<p style="margin:0 0 16px">Hi ${name},</p>` : ''}
        <p style="margin:0 0 24px">Use the code below to verify your First Stringers account. It expires in <b>10 minutes</b>.</p>
        <div style="display:inline-block;background:#000;color:#00D4AA;font-size:36px;font-weight:bold;letter-spacing:12px;padding:16px 24px;border-radius:8px;font-family:monospace">${code}</div>
        <p style="margin:24px 0 0;color:#666;font-size:13px">If you didn't create a First Stringers account, you can safely ignore this email.</p>
        <p style="font-size:12px;color:#999;margin-top:32px">&copy; ${year} First Stringers</p>
      </div>`.trim();

    await this.mailer.sendMail({
      to,
      subject: 'Your First Stringers verification code',
      text: `Your First Stringers verification code is: ${code}\nThis code expires in 10 minutes.\nIf you didn't create this account, ignore this email.`,
      html,
    });
  }

  async sendVerificationSubmittedEmail(params: { to: string; name: string }) {
    const { to, name } = params;
    const year = new Date().getFullYear();
    const html = `
      <!doctype html>
      <meta name="color-scheme" content="light">
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;max-width:480px;margin:0 auto">
        <span style="display:none;visibility:hidden;opacity:0;height:0;width:0">Your verification request is under review</span>
        <h1 style="margin:0 0 8px;font-size:22px">Verification request received</h1>
        <p style="margin:0 0 16px">Hi ${name},</p>
        <p style="margin:0 0 16px">We received your verification request and it's now under review. We'll notify you with the result within <b>1–2 business days</b>.</p>
        <p style="margin:0;color:#666;font-size:13px">Questions? Reach out to <a href="mailto:support@firststringers.com" style="color:#000">support@firststringers.com</a>.</p>
        <p style="font-size:12px;color:#999;margin-top:32px">&copy; ${year} First Stringers</p>
      </div>`.trim();

    await this.mailer.sendMail({
      to,
      subject: 'Verification request received — First Stringers',
      text: `Hi ${name}, we received your verification request. We'll notify you within 1–2 business days.`,
      html,
    });
  }

  async sendVerificationResultEmail(params: {
    to: string;
    name: string;
    approved: boolean;
  }) {
    const { to, name, approved } = params;
    const year = new Date().getFullYear();
    const subject = approved
      ? 'Your account is verified ✓ — First Stringers'
      : 'Verification update — First Stringers';

    const html = approved
      ? `
        <!doctype html>
        <meta name="color-scheme" content="light">
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;max-width:480px;margin:0 auto">
          <span style="display:none;visibility:hidden;opacity:0;height:0;width:0">Your First Stringers account is now verified</span>
          <h1 style="margin:0 0 8px;font-size:22px">You're verified!</h1>
          <p style="margin:0 0 16px">Hi ${name},</p>
          <p style="margin:0 0 24px">Your First Stringers recruiter account has been verified. You can now contact athletes directly.</p>
          <a href="${FRONTEND_URL}/matches" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Go to your dashboard →</a>
          <p style="font-size:12px;color:#999;margin-top:32px">&copy; ${year} First Stringers</p>
        </div>`.trim()
      : `
        <!doctype html>
        <meta name="color-scheme" content="light">
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;max-width:480px;margin:0 auto">
          <span style="display:none;visibility:hidden;opacity:0;height:0;width:0">An update on your First Stringers verification request</span>
          <h1 style="margin:0 0 8px;font-size:22px">Verification update</h1>
          <p style="margin:0 0 16px">Hi ${name},</p>
          <p style="margin:0 0 16px">After reviewing your submission, we weren't able to verify your account at this time. If you believe this is a mistake or would like to provide additional information, please contact us.</p>
          <p style="margin:0;color:#666;font-size:13px">Contact us at <a href="mailto:support@firststringers.com" style="color:#000">support@firststringers.com</a>.</p>
          <p style="font-size:12px;color:#999;margin-top:32px">&copy; ${year} First Stringers</p>
        </div>`.trim();

    const text = approved
      ? `Hi ${name}, your First Stringers recruiter account has been verified. Visit ${FRONTEND_URL}/matches to get started.`
      : `Hi ${name}, your verification request was not approved at this time. Contact support@firststringers.com for more information.`;

    await this.mailer.sendMail({ to, subject, text, html });
  }

  async sendConnectionRequestEmail(params: {
    to: string;
    athleteName: string;
    recruiterName: string;
    organizationName?: string;
    pitch?: string;
    conversationId: string;
  }) {
    const { to, athleteName, recruiterName, organizationName, pitch, conversationId } = params;
    const year = new Date().getFullYear();
    const from = organizationName
      ? `${recruiterName} from ${organizationName}`
      : recruiterName;
    const pitchBlock = pitch
      ? `<blockquote style="border-left:3px solid #00D4AA;margin:16px 0;padding:8px 16px;color:#444;font-style:italic">${pitch}</blockquote>`
      : '';
    const ctaUrl = `${FRONTEND_URL}/chat`;

    const html = `
      <!doctype html>
      <meta name="color-scheme" content="light">
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;max-width:480px;margin:0 auto">
        <span style="display:none;visibility:hidden;opacity:0;height:0;width:0">${from} wants to connect with you on First Stringers</span>
        <h1 style="margin:0 0 8px;font-size:22px">New connection request</h1>
        <p style="margin:0 0 16px">Hi ${athleteName},</p>
        <p style="margin:0 0 8px"><b>${from}</b> wants to connect with you on First Stringers.</p>
        ${pitchBlock}
        <p style="margin:16px 0 24px;color:#666;font-size:13px">You can accept or decline the request inside the app.</p>
        <a href="${ctaUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Review request →</a>
        <p style="font-size:12px;color:#999;margin-top:32px">&copy; ${year} First Stringers · conversationId: ${conversationId}</p>
      </div>`.trim();

    const text = [
      `Hi ${athleteName},`,
      `${from} wants to connect with you on First Stringers.`,
      pitch ? `"${pitch}"` : '',
      `Review the request at: ${ctaUrl}`,
    ].filter(Boolean).join('\n\n');

    await this.mailer.sendMail({
      to,
      subject: `${recruiterName} wants to connect with you — First Stringers`,
      text,
      html,
    });
  }

  async sendConnectionAcceptedEmail(params: {
    to: string;
    athleteName: string;
    conversationId: string;
  }) {
    const { to, athleteName, conversationId } = params;
    const year = new Date().getFullYear();
    const ctaUrl = `${FRONTEND_URL}/matches`;

    const html = `
      <!doctype html>
      <meta name="color-scheme" content="light">
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;max-width:480px;margin:0 auto">
        <span style="display:none;visibility:hidden;opacity:0;height:0;width:0">${athleteName} accepted your connection request on First Stringers</span>
        <h1 style="margin:0 0 8px;font-size:22px">${athleteName} accepted your request!</h1>
        <p style="margin:0 0 24px">Your connection with <b>${athleteName}</b> is now active. Head to your Connections panel to start the conversation.</p>
        <a href="${ctaUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Open conversation →</a>
        <p style="font-size:12px;color:#999;margin-top:32px">&copy; ${year} First Stringers · conversationId: ${conversationId}</p>
      </div>`.trim();

    await this.mailer.sendMail({
      to,
      subject: `${athleteName} accepted your connection — First Stringers`,
      text: `${athleteName} accepted your connection request on First Stringers. Start the conversation at: ${ctaUrl}`,
      html,
    });
  }

  // Envía a una lista con personalización y tracking por persona
  async sendTrackingEmailBatch(recipients: Recipient[]) {
    const subject = 'NEW REGISTRATION TO FIRST STRINGERS';

    // Límite de concurrencia simple (evita saturar SMTP). Ajusta según tu proveedor.
    const CONCURRENCY = 5;
    const queue = [...recipients];
    const results: Array<{ to: string; ok: boolean; error?: any; messageId?: string }> = [];

    const worker = async () => {
      while (queue.length) {
        const r = queue.shift()!;
        try {
          // Genera un ID para correlacionar (útil para aperturas)
          const correlationId = randomUUID();

          const preheader = 'WE HAVE A NEW REGISTRATION TO FIRSTSTRINGERS!';
          const text = `NEW REGISTRATION TO FIRST STRINGERS. Name: ${r.name ?? ''}`;
          // Pixel de 1x1 opcional (si quieres registrar aperturas)
          const pixel = `<img src="${TRACKING_BASE}/open.gif?mid=${encodeURIComponent(
            correlationId,
          )}&to=${encodeURIComponent(r.to)}" width="1" height="1" alt="" style="display:block;border:0" />`;

          const html = `
            <!doctype html>
            <meta name="color-scheme" content="light">
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
              <span style="display:none;visibility:hidden;opacity:0;height:0;width:0">${preheader}</span>
              <h1 style="margin:0 0 8px">New registration</h1>
              <p style="margin:0 0 16px">We have a new registration to First Stringers.</p>
              <p style="margin:0 0 16px"><b>Name:</b> ${r.name ?? 'N/A'}</p>
              <p style="font-size:12px;color:#666;margin-top:24px">&copy; ${new Date().getFullYear()} First Stringers</p>
              ${pixel}
            </div>`.trim();

          const info = await this.mailer.sendMail({
            to: r.to,
            subject,
            text, // siempre incluir texto plano para deliverability
            html,
            headers: {
              'X-FS-Correlation': correlationId,
              // Cabeceras útiles: List-Unsubscribe si corresponde
              // 'List-Unsubscribe': '<mailto:unsubscribe@firststringers.com>, <https://firststringers.com/unsub>'
            },
          });

          results.push({ to: r.to, ok: true, messageId: info?.messageId });
        } catch (error) {
          this.logger.warn(`Mail failed to ${r.to}: ${error?.message ?? error}`);
          results.push({ to: r.to, ok: false, error: error?.message ?? String(error) });
        }
      }
    };

    // Ejecuta N workers en paralelo
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    return results;
  }
}
