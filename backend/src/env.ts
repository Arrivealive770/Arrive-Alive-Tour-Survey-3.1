import { z } from "zod";

/**
 * Development-only Better Auth signing secret. A fresh checkout has no
 * backend/.env, and without some secret the server exits before it can boot.
 * Production must never reach this — see the transform below.
 */
const DEV_AUTH_SECRET = "dev-only-insecure-secret-not-for-production";

/**
 * Environment variable schema using Zod
 * This ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Server Configuration
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional(),
  BACKEND_URL: z.url("BACKEND_URL must be a valid URL").default("http://localhost:3000"), // Set via the Vibecode enviroment at run-time
  // Database
  DATABASE_URL: z.string().default("file:./dev.db"),
  // Authentication. Filled in by the transform below: required in production,
  // defaulted in development.
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  // Email (use either Resend or SendGrid — an API key from one of them is required for email sending)
  // Trimmed, and blank treated as absent. A key pasted into the settings file
  // with a stray space or an accidental newline is rejected by the provider as
  // "unauthorized", which reads as a wrong key and sends you looking in the
  // wrong place. An empty value should mean "not set", not "set to nothing".
  RESEND_API_KEY: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  SENDGRID_API_KEY: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  EMAIL_FROM_ADDRESS: z.string().email().default("noreply@arrivealivetour.com"),
  EMAIL_FROM_NAME: z.string().default("Arrive Alive Tour"),
  // Backup computer (see src/lib/failover/). Leave all of these out and the
  // server behaves exactly as it always has.
  //   main:   the desktop the tablets normally talk to. BACKUP_SERVER_URL is
  //           optional and only used to hold pledge emails while the backup is
  //           handing data back.
  //   backup: the standby machine. Copies the main server every minute and
  //           takes over when it stops answering. Needs MAIN_SERVER_URL.
  // FAILOVER_KEY must be the same long random value on both machines.
  SERVER_ROLE: z.enum(["main", "backup"]).default("main"),
  MAIN_SERVER_URL: z.url("MAIN_SERVER_URL must be a valid URL").optional(),
  BACKUP_SERVER_URL: z.url("BACKUP_SERVER_URL must be a valid URL").optional(),
  FAILOVER_KEY: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  // How long the main server must be silent before the backup takes over.
  // A string because ProcessEnv is typed from this schema; parsed where used.
  FAILOVER_TAKEOVER_MINUTES: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "FAILOVER_TAKEOVER_MINUTES must be a number")
    .optional(),
})
  // NODE_ENV is read from the parsed object rather than process.env directly:
  // ProcessEnv is augmented from this schema at the bottom of the file, so
  // touching process.env here would make envSchema reference its own type.
  .transform((raw, ctx) => {
    // A guessable signing secret in production would let anyone forge a staff
    // login, so the desktop kiosk and Railway must supply their own.
    if (raw.NODE_ENV === "production" && !raw.BETTER_AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "BETTER_AUTH_SECRET is required",
      });
      return z.NEVER;
    }

    // A backup that can't find or prove itself to the main server would sit
    // there looking set up while copying nothing. Refuse to start instead.
    if (raw.SERVER_ROLE === "backup") {
      if (!raw.MAIN_SERVER_URL) {
        ctx.addIssue({
          code: "custom",
          path: ["MAIN_SERVER_URL"],
          message: "MAIN_SERVER_URL is required when SERVER_ROLE is backup",
        });
      }
      if (!raw.FAILOVER_KEY || raw.FAILOVER_KEY.length < 16) {
        ctx.addIssue({
          code: "custom",
          path: ["FAILOVER_KEY"],
          message: "FAILOVER_KEY (at least 16 characters, same on both computers) is required when SERVER_ROLE is backup",
        });
      }
      if (!raw.MAIN_SERVER_URL || !raw.FAILOVER_KEY || raw.FAILOVER_KEY.length < 16) {
        return z.NEVER;
      }
    }

    return {
      ...raw,
      BETTER_AUTH_SECRET: raw.BETTER_AUTH_SECRET ?? DEV_AUTH_SECRET,
    };
  });

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);
    console.log("✅ Environment variables validated successfully");
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment variables
 */
export const env = validateEnv();

/**
 * Type of the validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Extend process.env with our environment variables
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line import/namespace
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}
