import sgMail from "@sendgrid/mail";
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

class EmailService {
  private initialized = false;

  /**
   * Initialize the SendGrid client with the API key
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    if (!env.SENDGRID_API_KEY) {
      console.warn("SENDGRID_API_KEY not configured - email sending disabled");
      return;
    }

    sgMail.setApiKey(env.SENDGRID_API_KEY);
    this.initialized = true;
    console.log("EmailService initialized with SendGrid");
  }

  /**
   * Check if email service is configured and ready
   */
  isConfigured(): boolean {
    return this.initialized && !!env.SENDGRID_API_KEY;
  }

  /**
   * Send a pledge confirmation email
   */
  async sendPledgeEmail(params: SendPledgeEmailParams): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "Email service not configured - SENDGRID_API_KEY missing",
      };
    }

    const { to, photoUrl, eventName } = params;

    try {
      const htmlBody = this.generatePledgeEmailHtml({ photoUrl });

      await sgMail.send({
        to,
        from: {
          email: env.EMAIL_FROM_ADDRESS,
          name: env.EMAIL_FROM_NAME,
        },
        subject: "Your S.A.F.E. Pledge Photo",
        html: htmlBody,
      });

      console.log(`Pledge email sent successfully to ${to}`);
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
