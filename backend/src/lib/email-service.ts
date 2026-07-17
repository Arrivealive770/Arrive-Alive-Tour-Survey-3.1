import { env } from "../env";

export interface SendPledgeEmailParams {
  to: string;
  photoUrl?: string;
  eventName?: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

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
   * Send a pledge confirmation email
   */
  async sendPledgeEmail(params: SendPledgeEmailParams): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "Email service not configured - set RESEND_API_KEY or SENDGRID_API_KEY",
      };
    }

    const { to, photoUrl } = params;
    const subject = "Your S.A.F.E. Pledge Photo";
    const html = this.generatePledgeEmailHtml({ photoUrl });

    try {
      if (this.provider === "resend") {
        await this.sendViaResend({ to, subject, html });
      } else {
        await this.sendViaSendGrid({ to, subject, html });
      }

      console.log(`Pledge email sent successfully to ${to} via ${this.provider}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to send pledge email to ${to}:`, errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send via Resend REST API (https://resend.com)
   */
  private async sendViaResend(params: { to: string; subject: string; html: string }): Promise<void> {
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
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Resend API error (HTTP ${response.status}): ${detail}`);
    }
  }

  /**
   * Send via SendGrid REST API (https://sendgrid.com)
   */
  private async sendViaSendGrid(params: { to: string; subject: string; html: string }): Promise<void> {
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
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`SendGrid API error (HTTP ${response.status}): ${detail}`);
    }
  }

  /**
   * Generate the HTML body for the pledge email
   */
  generatePledgeEmailHtml(params: { photoUrl?: string }): string {
    const { photoUrl } = params;

    const photoSection = photoUrl
      ? `<p><img src="${photoUrl}" alt="Your Pledge Photo" style="max-width: 100%; height: auto;" /></p>`
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
