import { NextResponse } from "next/server";
import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const { Pool } = pg;

const COPY_COLUMNS = [
    "mawb_no",
    "hawb_no",
    "transfer_no",
    "delivery_company",
    "sender_address",
    "receiver_name",
    "receiver_address",
    "receiver_address1",
    "receiver_address2",
    "receiver_address3",
    "driver_name",
    "delivery_method",
    "order_status",
    "inbound_at",
    "delivery_started_at",
    "completed_at",
    "returned_at",
    "delivery_failed_at",
    "returned_to_shipper_at",
    "delay_time",
    "redelivery_start_at",
    "redelivery_end_at",
    "failure_reason",
    "failure_detail",
    "warehouse_area",
    "current_warehouse",
    "agency",
    "kubun",
    "operator_ip"
];

function getConnectionString() {
    const connectionString =
        process.env.NETLIFY_DATABASE_URL ||
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL;

    if (!connectionString) {
        throw new Error("DATABASE_URL / NETLIFY_DATABASE_URL / POSTGRES_URL が設定されていません");
    }

    return connectionString;
}

function getPool() {
    if (!globalThis.__mochidashiPgPool) {
        const connectionString = getConnectionString();

        const isLocal =
            connectionString.includes("localhost") ||
            connectionString.includes("127.0.0.1");

        globalThis.__mochidashiPgPool = new Pool({
            connectionString,
            max: 1,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            ssl: isLocal ? false : { rejectUnauthorized: false }
        });
    }

    return globalThis.__mochidashiPgPool;
}

function getClientIP(req) {
    const forwarded = req.headers.get("x-forwarded-for");
    const realIP = req.headers.get("x-real-ip");

    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }

    if (realIP) {
        return realIP;
    }

    return req.headers.get("x-client-ip") || "unknown";
}

function checkImportToken(req) {
    const expectedToken = process.env.IMPORT_TOKEN;

    if (!expectedToken) {
        return true;
    }

    const actualToken = req.headers.get("x-import-token");

    return actualToken === expectedToken;
}

function pad(value) {
    return String(value).padStart(2, "0");
}

function text(value) {
    if (value === null || value === undefined) return null;

    const result = String(value).trim();

    return result === "" ? null : result;
}

function parseExcelSerialDate(value) {
    const serial = Number(value);

    if (!Number.isFinite(serial)) {
        return null;
    }

    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);

    const fractionalDay = serial - Math.floor(serial);
    const totalSeconds = Math.floor(86400 * fractionalDay);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds - hours * 3600) / 60);
    const seconds = totalSeconds - hours * 3600 - minutes * 60;

    return `${dateInfo.getUTCFullYear()}-${pad(dateInfo.getUTCMonth() + 1)}-${pad(dateInfo.getUTCDate())} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function parseTimestamp(value) {
    if (value === null || value === undefined || value === "") return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
    }

    if (typeof value === "number") {
        return parseExcelSerialDate(value);
    }

    const raw = String(value).trim();

    if (!raw) return null;

    const isoMatched = raw.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/
    );

    if (isoMatched) {
        const [, year, month, day, hour = "0", minute = "0", second = "0"] = isoMatched;

        return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
    }

    const matched = raw.match(
        /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
    );

    if (matched) {
        const [, year, month, day, hour = "0", minute = "0", second = "0"] = matched;

        return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
    }

    return null;
}

function copyValue(value) {
    if (value === null || value === undefined || value === "") {
        return "\\N";
    }

    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
}

function hasData(row) {
    if (!Array.isArray(row)) return false;

    for (let i = 0; i <= 26; i++) {
        if (row[i] !== null && row[i] !== undefined && String(row[i]).trim() !== "") {
            return true;
        }
    }

    return false;
}

function rowToCopyLine(row, clientIP) {
    const values = [
        text(row[0]),
        text(row[1]),
        text(row[2]),
        text(row[3]),
        text(row[4]),
        text(row[5]),
        text(row[6]),
        text(row[7]),
        text(row[8]),
        text(row[9]),
        text(row[10]),
        text(row[11]),
        text(row[12]),
        parseTimestamp(row[13]),
        parseTimestamp(row[14]),
        parseTimestamp(row[15]),
        parseTimestamp(row[16]),
        parseTimestamp(row[17]),
        parseTimestamp(row[18]),
        text(row[19]),
        parseTimestamp(row[20]),
        parseTimestamp(row[21]),
        text(row[22]),
        text(row[23]),
        text(row[24]),
        text(row[25]),
        text(row[26]),
        "m",
        clientIP
    ];

    return values.map(copyValue).join("\t") + "\n";
}

async function copyInsertRows(rows, clientIP) {
    const pool = getPool();
    const client = await pool.connect();

    let processedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;

    const copySql = String.raw`
        COPY night_delivery_records (
            ${COPY_COLUMNS.join(", ")}
        )
        FROM STDIN
        WITH (
            FORMAT text,
            DELIMITER E'\t',
            NULL '\N'
        )
    `;

    function* lineGenerator() {
        for (const row of rows) {
            if (!hasData(row)) {
                skippedCount++;
                continue;
            }

            processedCount++;
            insertedCount++;

            yield rowToCopyLine(row, clientIP);
        }
    }

    try {
        await client.query("BEGIN");

        const copyStream = client.query(copyFrom(copySql));
        const source = Readable.from(lineGenerator(), { encoding: "utf8" });

        await pipeline(source, copyStream);

        await client.query("COMMIT");

        return {
            processedCount,
            insertedCount,
            skippedCount
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function POST(req) {
    const startedAt = Date.now();

    try {
        if (!checkImportToken(req)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "認証トークンが正しくありません"
                },
                { status: 401 }
            );
        }

        const contentType = req.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            return NextResponse.json(
                {
                    success: false,
                    error: "JSON形式のデータを送信してください"
                },
                { status: 400 }
            );
        }

        const body = await req.json();
        const rows = Array.isArray(body.rows) ? body.rows : [];

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "取込対象データがありません"
                },
                { status: 400 }
            );
        }

        const clientIP = getClientIP(req);
        const result = await copyInsertRows(rows, clientIP);

        return NextResponse.json({
            success: true,
            kubun: "m",
            fileName: body.fileName || null,
            importSessionId: body.importSessionId || null,
            chunkIndex: body.chunkIndex || 1,
            chunksTotal: body.chunksTotal || 1,
            processedCount: result.processedCount,
            insertedCount: result.insertedCount,
            skippedCount: result.skippedCount,
            elapsedMs: Date.now() - startedAt
        });
    } catch (error) {
        console.error("Mochidashi import POST error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error?.message || "インポートに失敗しました"
            },
            { status: 500 }
        );
    }
}