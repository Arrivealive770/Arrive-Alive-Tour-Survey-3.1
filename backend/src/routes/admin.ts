import { Hono } from "hono";
import { prisma } from "../prisma";

const adminRouter = new Hono();

/**
 * Which events a request is asking about.
 *
 * The Data tab lets staff tick any number of events, so `eventIds` is a comma
 * separated list. `eventId` stays supported for the single-event callers that
 * were written first. An empty list means "every event", which is what a
 * request with neither parameter has always meant.
 *
 * This used to be single-event only, so ticking three venues quietly reported
 * the totals for the whole tour instead of those three.
 */
function eventScope(c: { req: { query: (key: string) => string | undefined } }) {
  const ids = (c.req.query("eventIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length > 0) return { eventId: { in: ids } };

  const single = c.req.query("eventId");
  return single ? { eventId: single } : {};
}

// GET /api/admin/analytics - Dashboard analytics
adminRouter.get("/analytics", async (c) => {
  const teamId = c.req.query("teamId");
  const eventWhere = eventScope(c);
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  const whereClause = {
    ...(teamId && { teamId }),
    ...eventWhere,
    ...(startDate || endDate
      ? {
          completedAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        }
      : {}),
  };

  const pledgeWhereClause = {
    ...(teamId && { teamId }),
    ...eventWhere,
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        }
      : {}),
  };

  // Total surveys
  const totalSurveys = await prisma.surveyResponse.count({
    where: whereClause,
  });

  // Surveys by type
  const surveysByType = await prisma.surveyResponse.groupBy({
    by: ["surveyTypeSlug"],
    where: whereClause,
    _count: { id: true },
  });

  // Surveys by day (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentSurveys = await prisma.surveyResponse.findMany({
    where: {
      ...whereClause,
      completedAt: { gte: thirtyDaysAgo },
    },
    select: { completedAt: true },
    orderBy: { completedAt: "asc" },
  });

  // Group by date
  const surveysByDay: Record<string, number> = {};
  recentSurveys.forEach((survey) => {
    const date = survey.completedAt.toISOString().split("T")[0] as string;
    surveysByDay[date] = (surveysByDay[date] ?? 0) + 1;
  });

  // Surveys by age range
  const surveysByAgeRange = await prisma.surveyResponse.groupBy({
    by: ["ageRange"],
    where: whereClause,
    _count: { id: true },
  });

  // Total pledges
  const totalPledges = await prisma.pledge.count({
    where: pledgeWhereClause,
  });

  // Pledge rate (pledges / surveys)
  const pledgeRate = totalSurveys > 0 ? (totalPledges / totalSurveys) * 100 : 0;

  // Email stats
  const emailStats = await prisma.pledge.groupBy({
    by: ["emailStatus"],
    where: pledgeWhereClause,
    _count: { id: true },
  });

  // Total photos
  const totalPhotos = await prisma.photo.count({
    where: {
      ...(teamId && { teamId }),
      ...eventWhere,
    },
  });

  // Photos by status
  const photosByStatus = await prisma.photo.groupBy({
    by: ["status"],
    where: {
      ...(teamId && { teamId }),
      ...eventWhere,
    },
    _count: { id: true },
  });

  // Average survey duration
  const avgDuration = await prisma.surveyResponse.aggregate({
    where: {
      ...whereClause,
      durationSeconds: { not: null },
    },
    _avg: { durationSeconds: true },
  });

  // Top events by survey count
  const topEvents = await prisma.surveyResponse.groupBy({
    by: ["eventId"],
    where: whereClause,
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  // Enrich top events with event details
  const eventIds = topEvents.map((e) => e.eventId);
  const events = await prisma.event.findMany({
    where: { id: { in: eventIds } },
    select: { id: true, venueName: true, venueCity: true, venueState: true, eventDate: true },
  });

  const eventMap = new Map(events.map((e) => [e.id, e]));
  const enrichedTopEvents = topEvents.map((e) => ({
    ...e,
    event: eventMap.get(e.eventId),
  }));

  return c.json({
    data: {
      totalSurveys,
      surveysByType: surveysByType.map((s) => ({
        surveyTypeSlug: s.surveyTypeSlug,
        count: s._count.id,
      })),
      surveysByDay: Object.entries(surveysByDay).map(([date, count]) => ({
        date,
        count,
      })),
      surveysByAgeRange: surveysByAgeRange.map((s) => ({
        ageRange: s.ageRange || "unknown",
        count: s._count.id,
      })),
      totalPledges,
      pledgeRate: Math.round(pledgeRate * 100) / 100,
      emailStats: emailStats.map((e) => ({
        status: e.emailStatus,
        count: e._count.id,
      })),
      totalPhotos,
      photosByStatus: photosByStatus.map((p) => ({
        status: p.status,
        count: p._count.id,
      })),
      averageSurveyDurationSeconds: Math.round(avgDuration._avg.durationSeconds || 0),
      topEvents: enrichedTopEvents,
    },
  });
});

// GET /api/admin/export/csv - Export survey data as CSV
adminRouter.get("/export/csv", async (c) => {
  const teamId = c.req.query("teamId");
  const eventWhere = eventScope(c);
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  const surveys = await prisma.surveyResponse.findMany({
    where: {
      ...(teamId && { teamId }),
      ...eventWhere,
      ...(startDate || endDate
        ? {
            completedAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    },
    include: {
      team: { select: { name: true, code: true } },
      event: { select: { venueName: true, venueCity: true, venueState: true, eventDate: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  // Build CSV
  const headers = [
    "ID",
    "Local ID",
    "Team Name",
    "Team Code",
    "Venue Name",
    "Venue City",
    "Venue State",
    "Event Date",
    "Survey Type",
    "Age Range",
    "Duration (seconds)",
    "Completed At",
    "Synced At",
    "Responses",
  ];

  const rows = surveys.map((s) => [
    s.id,
    s.localId,
    s.team.name,
    s.team.code,
    s.event.venueName,
    s.event.venueCity,
    s.event.venueState,
    s.event.eventDate.toISOString(),
    s.surveyTypeSlug,
    s.ageRange || "",
    s.durationSeconds || "",
    s.completedAt.toISOString(),
    s.syncedAt?.toISOString() || "",
    s.responses,
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          // Escape double quotes and wrap in quotes if contains comma or newline
          if (str.includes(",") || str.includes("\n") || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="surveys-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
});

// GET /api/admin/devices - Device status overview
adminRouter.get("/devices", async (c) => {
  const teamId = c.req.query("teamId");

  const devices = await prisma.device.findMany({
    where: teamId ? { teamId } : undefined,
    include: {
      team: { select: { id: true, name: true, code: true } },
      _count: {
        select: {
          surveyResponses: true,
          syncLogs: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { lastSyncAt: "desc" }],
  });

  // Determine online status (synced in last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const devicesWithStatus = devices.map((d) => ({
    ...d,
    isOnline: d.lastSyncAt ? d.lastSyncAt > fiveMinutesAgo : false,
    totalSurveys: d._count.surveyResponses,
    totalSyncs: d._count.syncLogs,
  }));

  return c.json({ data: devicesWithStatus });
});

// GET /api/admin/email-queue - Email queue status
adminRouter.get("/email-queue", async (c) => {
  const status = c.req.query("status");
  const limit = parseInt(c.req.query("limit") || "50", 10);

  const emailQueue = await prisma.emailQueue.findMany({
    where: status ? { status } : undefined,
    include: {
      pledge: {
        select: {
          id: true,
          email: true,
          team: { select: { name: true } },
          event: { select: { venueName: true } },
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });

  // Get counts by status
  const statusCounts = await prisma.emailQueue.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  return c.json({
    data: {
      queue: emailQueue,
      statusCounts: statusCounts.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
    },
  });
});

export { adminRouter };
