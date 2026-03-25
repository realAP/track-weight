import { Pool, types } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";

// pg returns BIGINT (OID 20) and NUMERIC (OID 1700) as strings by default.
// Parse them as JavaScript numbers so our TypeScript types match runtime values.
types.setTypeParser(20, (val: string) => parseInt(val, 10)); // BIGINT → number
types.setTypeParser(1700, (val: string) => parseFloat(val)); // NUMERIC → number

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on("error", (err) => {
  logger.error("Unexpected database pool error:", err);
});
