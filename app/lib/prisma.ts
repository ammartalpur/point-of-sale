import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

// Neon requires WebSockets to work in standard Node environments
neonConfig.webSocketConstructor = ws;

const connectionString = `${process.env.DATABASE_URL}`;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Instantiate the Neon pool and pass it to Prisma
const createPrismaClient = () => {
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
