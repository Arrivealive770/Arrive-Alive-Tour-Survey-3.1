# Use official Bun image
FROM oven/bun:1.2.10-debian

# Install OpenSSL 3.0 for Prisma
RUN apt-get update && apt-get install -y openssl libssl3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN bunx prisma generate

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start:prod"]
