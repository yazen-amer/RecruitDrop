import {PrismaNeon} from "@prisma/adapter-neon";
import {PrismaClient} from "@prisma/client";

const globalForPrisma=globalThis as unknown as {prisma?:PrismaClient};
export function getDb(){const url=process.env.DATABASE_URL;if(!url)throw new Error("DATABASE_URL is not configured");if(!globalForPrisma.prisma){globalForPrisma.prisma=new PrismaClient({adapter:new PrismaNeon({connectionString:url})});}return globalForPrisma.prisma}
