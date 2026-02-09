import { prisma } from "../prisma";
import { emailService } from "./email-service";
import type { EmailQueue } from "@prisma/client";

export interface ProcessResult {
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}

class EmailQueueProcessor {
  private isRunning = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly processingIntervalMs = 30000; // 30 seconds

  /**
   * Start the queue processor
   */
  start(): void {
    if (this.isRunning) {
      console.log("EmailQueueProcessor is already running");
      return;
    }

    if (!emailService.isConfigured()) {
      console.log("EmailQueueProcessor not started - email service not configured");
      return;
    }

    this.isRunning = true;
    console.log(`EmailQueueProcessor started (processing every ${this.processingIntervalMs / 1000}s)`);

    // Process immediately on start
    this.processQueue().catch((err) => {
      console.error("Initial queue processing failed:", err);
    });

    // Then process at regular intervals
    this.intervalId = setInterval(() => {
      this.processQueue().catch((err) => {
        console.error("Queue processing failed:", err);
      });
    }, this.processingIntervalMs);
  }

  /**
   * Stop the queue processor
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log("EmailQueueProcessor stopped");
  }

  /**
   * Process all pending emails in the queue
   */
  async processQueue(): Promise<ProcessResult> {
    const result: ProcessResult = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Get pending emails (status = 'pending', attempts < maxAttempts)
      const pendingEmails = await prisma.emailQueue.findMany({
        where: {
          status: "pending",
          attempts: {
            lt: prisma.emailQueue.fields.maxAttempts ? undefined : 3, // Default max attempts
          },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10, // Process in batches
      });

      // Filter by attempts < maxAttempts (since we can't do this directly in Prisma query easily)
      const eligibleEmails = pendingEmails.filter((email) => email.attempts < email.maxAttempts);

      if (eligibleEmails.length === 0) {
        return result;
      }

      console.log(`Processing ${eligibleEmails.length} pending emails`);

      for (const queueItem of eligibleEmails) {
        result.processed++;
        const success = await this.processEmail(queueItem);
        if (success) {
          result.sent++;
        } else {
          result.failed++;
        }
      }

      console.log(`Queue processing complete: ${result.sent} sent, ${result.failed} failed`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(errorMessage);
      console.error("Queue processing error:", errorMessage);
    }

    return result;
  }

  /**
   * Process a single email from the queue
   */
  async processEmail(queueItem: EmailQueue): Promise<boolean> {
    try {
      // Update status to 'processing'
      await prisma.emailQueue.update({
        where: { id: queueItem.id },
        data: { status: "processing" },
      });

      // Send the email via SendGrid
      const sendResult = await emailService.sendPledgeEmail({
        to: queueItem.toEmail,
        photoUrl: queueItem.photoUrl ?? undefined,
      });

      if (sendResult.success) {
        // Update queue item status to 'sent'
        await prisma.emailQueue.update({
          where: { id: queueItem.id },
          data: {
            status: "sent",
            processedAt: new Date(),
          },
        });

        // Update the pledge email status
        await prisma.pledge.update({
          where: { id: queueItem.pledgeId },
          data: {
            emailStatus: "sent",
            emailSentAt: new Date(),
            emailError: null,
          },
        });

        return true;
      } else {
        // Handle failure
        await this.handleFailure(queueItem, sendResult.error || "Unknown send error");
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.handleFailure(queueItem, errorMessage);
      return false;
    }
  }

  /**
   * Handle email send failure with retry logic
   */
  async handleFailure(queueItem: EmailQueue, error: string): Promise<void> {
    const newAttempts = queueItem.attempts + 1;
    const isMaxAttempts = newAttempts >= queueItem.maxAttempts;

    // Update queue item
    await prisma.emailQueue.update({
      where: { id: queueItem.id },
      data: {
        attempts: newAttempts,
        lastError: error,
        status: isMaxAttempts ? "failed" : "pending", // Back to pending for retry, or failed if max
      },
    });

    // Update pledge status if max attempts reached
    if (isMaxAttempts) {
      await prisma.pledge.update({
        where: { id: queueItem.pledgeId },
        data: {
          emailStatus: "failed",
          emailError: error,
        },
      });
      console.error(`Email to ${queueItem.toEmail} failed permanently after ${newAttempts} attempts: ${error}`);
    } else {
      console.warn(`Email to ${queueItem.toEmail} failed (attempt ${newAttempts}/${queueItem.maxAttempts}): ${error}`);
    }
  }

  /**
   * Retry a specific failed email
   */
  async retryEmail(queueId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const queueItem = await prisma.emailQueue.findUnique({
        where: { id: queueId },
      });

      if (!queueItem) {
        return { success: false, error: "Queue item not found" };
      }

      if (queueItem.status !== "failed") {
        return { success: false, error: "Can only retry failed emails" };
      }

      // Reset the queue item for retry
      await prisma.emailQueue.update({
        where: { id: queueId },
        data: {
          status: "pending",
          attempts: 0,
          lastError: null,
        },
      });

      // Update pledge status
      await prisma.pledge.update({
        where: { id: queueItem.pledgeId },
        data: {
          emailStatus: "pending",
          emailError: null,
        },
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  }
}

// Singleton instance
export const emailQueueProcessor = new EmailQueueProcessor();

/**
 * Queue a pledge email for sending
 * This function is called when a pledge is synced and has an email address
 */
export async function queuePledgeEmail(
  pledgeId: string,
  toEmail: string,
  photoUrl?: string
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  try {
    const queueItem = await prisma.emailQueue.create({
      data: {
        pledgeId,
        toEmail,
        subject: "Your S.A.F.E. Pledge Photo",
        htmlBody: "", // Will be generated at send time
        photoUrl: photoUrl || null,
        status: "pending",
        attempts: 0,
        maxAttempts: 3,
      },
    });

    // Update pledge email status to queued
    await prisma.pledge.update({
      where: { id: pledgeId },
      data: { emailStatus: "queued" },
    });

    console.log(`Pledge email queued for ${toEmail} (queue ID: ${queueItem.id})`);
    return { success: true, queueId: queueItem.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to queue pledge email for ${toEmail}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}
