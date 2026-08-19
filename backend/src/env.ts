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
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().default("noreply@arrivealivetour.com"),
  EMAIL_FROM_NAME: z.string().default("Arrive Alive Tour"),
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
