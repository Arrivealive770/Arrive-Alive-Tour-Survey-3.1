import { Hono } from "hono";
import { emailQueueProcessor } from "../lib/email-queue-processor";
import { prisma } from "../prisma";

const emailRouter = new Hono();

// POST /api/email/process - Trigger email queue processing (can be called by cron or manually)
emailRouter.post("/process", async (c) => {
  const result = await emailQueueProcessor.processQueue();
  return c.json({ data: result });
});

// GET /api/email/queue - Get email queue status counts
emailRouter.get("/queue", async (c) => {
  const counts = await prisma.emailQueue.groupBy({
    by: ["status"],
    _count: true,
  });

  const statusCounts: Record<string, number> = {};
  for (const item of counts) {
    statusCounts[item.status] = item._count;
  }

  return c.json({
    data: {
      pending: statusCounts["pending"] || 0,
      processing: statusCounts["processing"] || 0,
      sent: statusCounts["sent"] || 0,
      failed: statusCounts["failed"] || 0,
    },
  });
});

// POST /api/email/retry-failed - Reset failed emails for retry
emailRouter.post("/retry-failed", async (c) => {
  const result = await prisma.emailQueue.updateMany({
    where: {
      status: "failed",
    },
    data: {
      status: "pending",
      attempts: 0,
      lastError: null,
    },
  });

  // Also reset corresponding pledge email statuses
  const failedEmails = await prisma.emailQueue.findMany({
    where: { status: "pending", lastError: null },
    select: { pledgeId: true },
  });

  const pledgeIds = failedEmails.map((e) => e.pledgeId);
  if (pledgeIds.length > 0) {
    await prisma.pledge.updateMany({
      where: { id: { in: pledgeIds } },
      data: { emailStatus: "queued", emailError: null },
    });
  }

  return c.json({ data: { resetCount: result.count } });
});

// POST /api/email/retry/:id - Retry a specific failed email
emailRouter.post("/retry/:id", async (c) => {
  const id = c.req.param("id");
  const result = await emailQueueProcessor.retryEmail(id);

  if (!result.success) {
    return c.json({ error: { message: result.error || "Retry failed", code: "RETRY_FAILED" } }, 400);
  }

  return c.json({ data: { success: true } });
});

// GET /api/email/queue/items - Get recent queue items with details
emailRouter.get("/queue/items", async (c) => {
  const status = c.req.query("status");
  const limit = parseInt(c.req.query("limit") || "20", 10);

  const items = await prisma.emailQueue.findMany({
    where: status ? { status } : undefined,
    orderBy: { scheduledAt: "desc" },
    take: Math.min(limit, 100),
    include: {
      pledge: {
        select: {
          id: true,
          email: true,
          event: {
            select: {
              venueName: true,
              venueCity: true,
            },
          },
        },
      },
    },
  });

  return c.json({ data: items });
});

export { emailRouter };
