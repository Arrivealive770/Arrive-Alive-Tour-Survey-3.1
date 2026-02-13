import { Hono } from "hono";
import { prisma } from "../prisma";

const adminUsersRouter = new Hono();

// Simple password hashing using Web Crypto API (available in Bun)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "arrive-alive-salt-2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// POST /api/admin-users/login - Login admin user
adminUsersRouter.post("/login", async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: { message: "Username and password are required", code: "VALIDATION_ERROR" } }, 400);
  }

  // Check if any admin users exist - if not, allow legacy password
  const adminCount = await prisma.adminUser.count();

  if (adminCount === 0) {
    // Legacy fallback - allow "1234" if no admin users exist
    if (password === "1234") {
      return c.json({
        data: {
          success: true,
          user: {
            id: "legacy",
            username: "admin",
            displayName: "Admin",
            role: "superadmin",
          },
          isLegacy: true,
          message: "Using legacy password. Please create an admin account.",
        },
      });
    }
    return c.json({ error: { message: "Invalid credentials", code: "INVALID_CREDENTIALS" } }, 401);
  }

  // Find admin user
  const adminUser = await prisma.adminUser.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (!adminUser || !adminUser.isActive) {
    return c.json({ error: { message: "Invalid credentials", code: "INVALID_CREDENTIALS" } }, 401);
  }

  // Verify password
  const isValid = await verifyPassword(password, adminUser.passwordHash);
  if (!isValid) {
    return c.json({ error: { message: "Invalid credentials", code: "INVALID_CREDENTIALS" } }, 401);
  }

  // Update last login
  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: { lastLoginAt: new Date() },
  });

  return c.json({
    data: {
      success: true,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        displayName: adminUser.displayName,
        role: adminUser.role,
      },
    },
  });
});

// GET /api/admin-users - List all admin users
adminUsersRouter.get("/", async (c) => {
  const adminUsers = await prisma.adminUser.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return c.json({ data: adminUsers });
});

// POST /api/admin-users - Create new admin user
adminUsersRouter.post("/", async (c) => {
  const { username, password, displayName, role } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: { message: "Username and password are required", code: "VALIDATION_ERROR" } }, 400);
  }

  if (password.length < 4) {
    return c.json({ error: { message: "Password must be at least 4 characters", code: "VALIDATION_ERROR" } }, 400);
  }

  // Check if username already exists
  const existing = await prisma.adminUser.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (existing) {
    return c.json({ error: { message: "Username already exists", code: "DUPLICATE_USERNAME" } }, 400);
  }

  const passwordHash = await hashPassword(password);

  const adminUser = await prisma.adminUser.create({
    data: {
      username: username.toLowerCase(),
      passwordHash,
      displayName: displayName || username,
      role: role || "admin",
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return c.json({ data: adminUser }, 201);
});

// PUT /api/admin-users/:id - Update admin user
adminUsersRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const { displayName, role, isActive, password } = await c.req.json();

  const existing = await prisma.adminUser.findUnique({
    where: { id },
  });

  if (!existing) {
    return c.json({ error: { message: "Admin user not found", code: "NOT_FOUND" } }, 404);
  }

  const updateData: {
    displayName?: string;
    role?: string;
    isActive?: boolean;
    passwordHash?: string;
  } = {};

  if (displayName !== undefined) updateData.displayName = displayName;
  if (role !== undefined) updateData.role = role;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (password && password.length >= 4) {
    updateData.passwordHash = await hashPassword(password);
  }

  const adminUser = await prisma.adminUser.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return c.json({ data: adminUser });
});

// DELETE /api/admin-users/:id - Delete admin user
adminUsersRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  // Check if this is the last active admin
  const activeCount = await prisma.adminUser.count({
    where: { isActive: true },
  });

  const userToDelete = await prisma.adminUser.findUnique({
    where: { id },
  });

  if (!userToDelete) {
    return c.json({ error: { message: "Admin user not found", code: "NOT_FOUND" } }, 404);
  }

  if (activeCount === 1 && userToDelete.isActive) {
    return c.json({ error: { message: "Cannot delete the last active admin user", code: "LAST_ADMIN" } }, 400);
  }

  await prisma.adminUser.delete({
    where: { id },
  });

  return c.json({ data: { deleted: true } });
});

// POST /api/admin-users/change-password - Change own password
adminUsersRouter.post("/change-password", async (c) => {
  const { username, currentPassword, newPassword } = await c.req.json();

  if (!username || !currentPassword || !newPassword) {
    return c.json({ error: { message: "All fields are required", code: "VALIDATION_ERROR" } }, 400);
  }

  if (newPassword.length < 4) {
    return c.json({ error: { message: "New password must be at least 4 characters", code: "VALIDATION_ERROR" } }, 400);
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (!adminUser) {
    return c.json({ error: { message: "Invalid credentials", code: "INVALID_CREDENTIALS" } }, 401);
  }

  const isValid = await verifyPassword(currentPassword, adminUser.passwordHash);
  if (!isValid) {
    return c.json({ error: { message: "Current password is incorrect", code: "INVALID_CREDENTIALS" } }, 401);
  }

  const newPasswordHash = await hashPassword(newPassword);

  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: { passwordHash: newPasswordHash },
  });

  return c.json({ data: { success: true, message: "Password changed successfully" } });
});

export { adminUsersRouter };
