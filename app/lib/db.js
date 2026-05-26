import postgres from "postgres";

const connectionString = process.env.AIVEN_DATABASE_URL;

if (!connectionString) {
    throw new Error("AIVEN_DATABASE_URL is not set");
}

const globalForPostgres = globalThis;

export const sql =
    globalForPostgres.__qcatchAivenSql ||
    postgres(connectionString, {
        ssl: "require",
        max: 1,
        idle_timeout: 20,
        connect_timeout: 10,
    });

if (process.env.NODE_ENV !== "production") {
    globalForPostgres.__qcatchAivenSql = sql;
}