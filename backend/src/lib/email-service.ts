import { env } from "../env";
import { readEnvFileKey, type EnvFileKeyReport } from "./env-file-key";

export interface SendPledgeEmailParams {
  to: string;
  photoUrl?: string;
  eventName?: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
  /**
   * True when the participant's photo travelled INSIDE the email (as an
   * attachment), so their copy does not depend on our server keeping the file.
   * Only then is it safe to delete the photo immediately after sending.
   * False means the email links to the photo and the file must be kept until
   * the end-of-event purge.
   */
  photoEmbedded: boolean;
}

export interface EmailServiceStatus {
  configured: boolean;
  provider: Provider;
  fromAddress: string;
  fromName: string;
  /** Opening characters of the configured key, e.g. "re_AbCdEfGh". */
  keyPreview: string | null;
  /** Character count of the configured key. */
  keyLength: number;
  /**
   * What the settings file on disk says right now, versus what this process is
   * using. When those disagree, editing the file has had no effect and no
   * amount of correcting the key will help until the reason is fixed.
   */
  envFile: EnvFileKeyReport;
}

/**
 * How much of an API key may be shown.
 *
 * Enough to match against the key list on the provider's dashboard, which
 * displays a similar prefix, and far too little to authenticate with. Paired
 * with the length, this answers the two questions a rejected key raises: is it
 * the same key I think it is, and did the whole thing make it into the file?
 */
const KEY_PREVIEW_CHARS = 11;

/**
 * Turn a failed provider response into an error that says WHO refused.
 *
 * Resend and SendGrid answer every error with JSON carrying a message. A
 * plain-text or HTML body means something between this computer and the
 * provider replied instead — a filtering proxy, a security suite inspecting
 * HTTPS, or a captive portal. Resend's own wording for a bad key is "API key
 * is invalid"; a bare "unauthorized" is somebody else's.
 *
 * Worth separating because the two have opposite fixes and look identical in
 * raw form. Reading it as a rejected key sends you to re-copy a key that was
 * never the problem, which is exactly what happened here.
 */
function describeProviderFailure(provider: "Resend" | "SendGrid", status: number, raw: string): string {
  const body = raw.trim();

  let message: string | null = null;
  if (body.startsWith("{")) {
    try {
      const parsed = JSON.parse(body) as {
        message?: unknown;
        error?: unknown;
        errors?: unknown;
      };
      if (typeof parsed.message === "string") {
        message = parsed.message;
      } else if (typeof parsed.error === "string") {
        message = parsed.error;
      } else if (Array.isArray(parsed.errors)) {
        const first = parsed.errors[0] as { message?: unknown } | undefined;
        if (first && typeof first.message === "string") {
          message = first.message;
        }
      }
    } catch {
      // A body that opens like JSON and does not parse is no more the
      // provider's than one that never claimed to be.
    }
  }

  if (message !== null) {
    return `${provider} API error (HTTP ${status}): ${message}`;
  }

  const snippet = body.length > 200 ? `${body.slice(0, 200)}…` : body || "(empty response)";
  return (
    `Blocked before reaching ${provider} (HTTP ${status}). The reply did not come from ` +
    `${provider}, which always answers with JSON. Something on this network answered ` +
    `instead: ${snippet}`
  );
}

interface PhotoAttachment {
  filename: string;
  contentType: string;
  base64: string;
}

/** Inline reference used in the HTML body when the image is attached. */
const PHOTO_CONTENT_ID = "pledgephoto";

/** Refuse to inline anything absurd; email providers reject large payloads. */
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

type Provider = "resend" | "sendgrid" | null;

class EmailService {
  private provider: Provider = null;
  private initialized = false;

  /**
   * Detect which email provider is configured.
   * Prefers Resend, falls back to SendGrid. Either one works with just an API key.
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (env.RESEND_API_KEY) {
      this.provider = "resend";
      console.log("EmailService initialized with Resend");
    } else if (env.SENDGRID_API_KEY) {
      this.provider = "sendgrid";
      console.log("EmailService initialized with SendGrid");
    } else {
      this.provider = null;
      console.warn(
        "No email API key configured (RESEND_API_KEY or SENDGRID_API_KEY) - email sending disabled"
      );
    }
  }

  /**
   * Check if email service is configured and ready
   */
  isConfigured(): boolean {
    if (!this.initialized) {
      this.initialize();
    }
    return this.provider !== null;
  }

  /**
   * What the admin portal shows on the Email tab.
   *
   * Never includes the API key itself — only its opening characters and its
   * length, plus the address it sends from, which is the other half of why
   * mail silently fails (providers reject a from-address on a domain you have
   * not verified).
   */
  getStatus(): EmailServiceStatus {
    if (!this.initialized) {
      this.initialize();
    }

    const key =
      this.provider === "resend"
        ? env.RESEND_API_KEY
        : this.provider === "sendgrid"
          ? env.SENDGRID_API_KEY
          : undefined;

    // Read the file back rather than trusting that it is the source of what we
    // are holding. On the kiosk it usually is; when it is not, that fact is the
    // whole answer.
    const variableName = this.provider === "sendgrid" ? "SENDGRID_API_KEY" : "RESEND_API_KEY";

    return {
      configured: this.provider !== null,
      provider: this.provider,
      fromAddress: env.EMAIL_FROM_ADDRESS,
      fromName: env.EMAIL_FROM_NAME,
      keyPreview: key ? key.slice(0, KEY_PREVIEW_CHARS) : null,
      keyLength: key ? key.length : 0,
      envFile: readEnvFileKey(variableName, key, KEY_PREVIEW_CHARS),
    };
  }

  /**
   * Send a one-off test email so the office can prove delivery works without
   * running a pledge through a tablet.
   *
   * Deliberately returns the provider's raw error text rather than a friendly
   * message: "domain is not verified" is the single most common cause of
   * pledge emails vanishing, and only the provider knows to say it.
   */
  async sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "No email key is set on this server (RESEND_API_KEY or SENDGRID_API_KEY).",
      };
    }

    const subject = "Arrive Alive test email";
    const html = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>This is a test from your Arrive Alive survey server.</p>
  <p>If you are reading this, pledge photo emails will reach participants.</p>
</body>
</html>`;

    try {
      if (this.provider === "resend") {
        await this.sendViaResend({ to, subject, html, attachment: null });
      } else {
        await this.sendViaSendGrid({ to, subject, html, attachment: null });
      }
      console.log(`[EmailService] Test email sent to ${to} via ${this.provider}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[EmailService] Test email to ${to} failed:`, message);
      return { success: false, error: message };
    }
  }

  /**
   * Send a pledge confirmation email
   */
  async sendPledgeEmail(params: SendPledgeEmailParams): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "Email service not configured - set RESEND_API_KEY or SENDGRID_API_KEY",
        photoEmbedded: false,
      };
    }

    const { to, photoUrl } = params;
    const subject = "Your S.A.F.E. Pledge Photo";

    // Attach the photo rather than linking it. The tour deletes its copy as
    // soon as this email is delivered, so a linked image would turn into a
    // broken image in the participant's inbox.
    const attachment = await this.fetchPhotoAttachment(photoUrl);
    const html = this.generatePledgeEmailHtml({
      photoUrl,
      attached: attachment !== null,
    });

    try {
      if (this.provider === "resend") {
        await this.sendViaResend({ to, subject, html, attachment });
      } else {
        await this.sendViaSendGrid({ to, subject, html, attachment });
      }

      console.log(
        `Pledge email sent successfully to ${to} via ${this.provider}` +
          (attachment ? " (photo attached)" : " (no photo attached)")
      );
      return { success: true, photoEmbedded: attachment !== null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to send pledge email to ${to}:`, errorMessage);
      return {
        success: false,
        error: errorMessage,
        photoEmbedded: false,
      };
    }
  }

  /**
   * Download the pledge photo so it can be attached to the email.
   *
   * Returns null when there is no photo, when it cannot be downloaded, or when
   * it is too large to attach. Callers treat null as "the photo is NOT in the
   * participant's hands yet" and keep the server copy alive.
   */
  private async fetchPhotoAttachment(photoUrl?: string): Promise<PhotoAttachment | null> {
    const absoluteUrl = this.toAbsoluteUrl(photoUrl);
    if (!absoluteUrl) return null;

    try {
      const response = await fetch(absoluteUrl);
      if (!response.ok) {
        console.error(
          `[EmailService] Could not download pledge photo (HTTP ${response.status}): ${absoluteUrl}`
        );
        return null;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_ATTACHMENT_BYTES) {
        console.error(
          `[EmailService] Pledge photo not attachable (${bytes.byteLength} bytes): ${absoluteUrl}`
        );
        return null;
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      const extension = contentType.includes("png") ? "png" : "jpg";

      return {
        filename: `arrive-alive-pledge.${extension}`,
        contentType,
        base64: Buffer.from(bytes).toString("base64"),
      };
    } catch (error) {
      console.error(`[EmailService] Error downloading pledge photo ${absoluteUrl}:`, error);
      return null;
    }
  }

  /**
   * Composited pledge photos are absolute CDN URLs, but the fallback path
   * stores a server-relative one (/uploads/...).
   */
  private toAbsoluteUrl(photoUrl?: string): string | undefined {
    if (!photoUrl) return undefined;
    return photoUrl.startsWith("/")
      ? `${env.BACKEND_URL.replace(/\/$/, "")}${photoUrl}`
      : photoUrl;
  }

  /**
   * Send via Resend REST API (https://resend.com)
   */
  private async sendViaResend(params: {
    to: string;
    subject: string;
    html: string;
    attachment: PhotoAttachment | null;
  }): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.attachment && {
          attachments: [
            {
              filename: params.attachment.filename,
              content: params.attachment.base64,
              content_type: params.attachment.contentType,
              content_id: PHOTO_CONTENT_ID,
            },
          ],
        }),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(describeProviderFailure("Resend", response.status, detail));
    }
  }

  /**
   * Send via SendGrid REST API (https://sendgrid.com)
   */
  private async sendViaSendGrid(params: {
    to: string;
    subject: string;
    html: string;
    attachment: PhotoAttachment | null;
  }): Promise<void> {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }] }],
        from: { email: env.EMAIL_FROM_ADDRESS, name: env.EMAIL_FROM_NAME },
        subject: params.subject,
        content: [{ type: "text/html", value: params.html }],
        ...(params.attachment && {
          attachments: [
            {
              content: params.attachment.base64,
              filename: params.attachment.filename,
              type: params.attachment.contentType,
              disposition: "inline",
              content_id: PHOTO_CONTENT_ID,
            },
          ],
        }),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(describeProviderFailure("SendGrid", response.status, detail));
    }
  }

  /**
   * Generate the HTML body for the pledge email
   */
  generatePledgeEmailHtml(params: { photoUrl?: string; attached?: boolean }): string {
    const { photoUrl, attached = false } = params;

    // When the photo travels with the email we point at the attachment, so the
    // image keeps working after the tour deletes its copy. Only if the photo
    // could not be attached do we fall back to linking it — and in that case
    // the file is kept until the end-of-event purge. Email clients cannot
    // resolve relative paths, so the fallback link must be absolute.
    const absolutePhotoUrl = this.toAbsoluteUrl(photoUrl);

    const photoSection = attached
      ? `<p><img src="cid:${PHOTO_CONTENT_ID}" alt="Your Pledge Photo" style="max-width: 100%; height: auto;" /></p>
  <p style="color: #666; font-size: 13px;">Your pledge photo is attached to this email — save it now, we do not keep a copy.</p>`
      : absolutePhotoUrl
        ? `<p><img src="${absolutePhotoUrl}" alt="Your Pledge Photo" style="max-width: 100%; height: auto;" /></p>`
        : "";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Thank you for taking the Arrive Alive pledge to drive S.A.F.E. — Sober And Free of Electronics. Your decision to take this pledge can make a real difference beyond just you.</p>

  <p>We encourage you to share your pledge photo on social media to help spread the message of safe driving. One post can start conversations, influence friends, and remind others that every decision behind the wheel matters.</p>

  <p>When you share, consider tagging Arrive Alive and using #ArriveAlive to help amplify the impact on your community.</p>

  ${photoSection}

  <p>Be part of the Arrive Alive community — follow along:</p>
  <p>
    <a href="https://www.facebook.com/arrivealivetourgr/">Arrive Alive Tour Facebook</a><br/>
    <a href="https://x.com/arrivealivetour">Arrive Alive on X</a>
  </p>
</body>
</html>`;
  }
}

// Singleton instance
export const emailService = new EmailService();
