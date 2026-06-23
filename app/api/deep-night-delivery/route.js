import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";
import * as XLSX from "xlsx";
import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sql = neon();
const { Pool } = pg;

const TIME_SLOTS = [
    { hour: 22, label: "22時台", sort: 1 },
    { hour: 23, label: "23時台", sort: 2 },
    { hour: 0, label: "0時台", sort: 3 },
    { hour: 1, label: "1時台", sort: 4 },
    { hour: 2, label: "2時台", sort: 5 },
    { hour: 3, label: "3時台", sort: 6 },
    { hour: 4, label: "4時台", sort: 7 },
    { hour: 5, label: "5時台", sort: 8 },
    { hour: 6, label: "6時台", sort: 9 },
    { hour: 7, label: "7時台", sort: 10 }
];

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
    if (!globalThis.__nightDeliveryPgPool) {
        const connectionString = getConnectionString();
        const isLocal =
            connectionString.includes("localhost") ||
            connectionString.includes("127.0.0.1");

        globalThis.__nightDeliveryPgPool = new Pool({
            connectionString,
            max: 1,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            ssl: isLocal ? false : { rejectUnauthorized: false }
        });
    }

    return globalThis.__nightDeliveryPgPool;
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

function pad(value) {
    return String(value).padStart(2, "0");
}

function text(value) {
    if (value === null || value === undefined) return null;

    const result = String(value).trim();

    return result === "" ? null : result;
}

function parseTimestamp(value) {
    if (value === null || value === undefined || value === "") return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
    }

    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);

        if (!parsed) return null;

        return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)} ${pad(parsed.H || 0)}:${pad(parsed.M || 0)}:${pad(Math.floor(parsed.S || 0))}`;
    }

    const raw = String(value).trim();

    if (!raw) return null;

    const matched = raw.match(
        /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
    );

    if (matched) {
        const [, year, month, day, hour = "0", minute = "0", second = "0"] = matched;

        return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
    }

    const parsedDate = new Date(raw.replace(/\//g, "-"));

    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())} ${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`;
}

const NIGHT_HOURS = new Set([22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);

function getHourFromTimestampText(value) {
    if (!value) return null;

    const matched = String(value).match(/\s(\d{1,2}):\d{1,2}/);

    if (!matched) return null;

    return Number(matched[1]);
}

function isNightTimestamp(value) {
    const hour = getHourFromTimestampText(value);

    return NIGHT_HOURS.has(hour);
}

function shouldImportNightDeliveryRecord(completedAt, deliveryFailedAt) {
    return isNightTimestamp(completedAt) || isNightTimestamp(deliveryFailedAt);
}

function minTimestamp(current, next) {
    if (!next) return current;
    if (!current) return next;

    return next < current ? next : current;
}

function maxTimestamp(current, next) {
    if (!next) return current;
    if (!current) return next;

    return next > current ? next : current;
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

function rowToCopyLine(row, clientIP, parsed = {}) {
    const completedAt =
        parsed.completedAt !== undefined
            ? parsed.completedAt
            : parseTimestamp(row[15]);

    const deliveryFailedAt =
        parsed.deliveryFailedAt !== undefined
            ? parsed.deliveryFailedAt
            : parseTimestamp(row[17]);

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
        completedAt,
        parseTimestamp(row[16]),
        deliveryFailedAt,
        parseTimestamp(row[18]),
        text(row[19]),
        parseTimestamp(row[20]),
        parseTimestamp(row[21]),
        text(row[22]),
        text(row[23]),
        text(row[24]),
        text(row[25]),
        text(row[26]),
        "s",
        clientIP
    ];

    return values.map(copyValue).join("\t") + "\n";
}

async function upsertImportLog(client, options, summary) {
    if (!options.importSessionId) return;

    await client.query(
        `
        INSERT INTO night_delivery_import_logs (
            import_session_id,
            file_name,
            kubun,
            source_total_rows,
            processed_rows,
            inserted_total_rows,
            skipped_total_rows,
            source_min_completed_at,
            source_max_completed_at,
            source_min_delivery_failed_at,
            source_max_delivery_failed_at,
            source_min_event_at,
            source_max_event_at,
            inserted_min_completed_at,
            inserted_max_completed_at,
            inserted_min_delivery_failed_at,
            inserted_max_delivery_failed_at,
            inserted_min_event_at,
            inserted_max_event_at,
            chunks_total,
            chunks_completed,
            operator_ip,
            status,
            finished_at,
            elapsed_ms
        )
        VALUES (
            $1,
            $2,
            's',
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19,
            1,
            $20,
            $21,
            CASE WHEN $21 = 'completed' THEN NOW() ELSE NULL END,
            CASE WHEN $21 = 'completed' THEN $22::INTEGER ELSE NULL END
        )
        ON CONFLICT (import_session_id)
        DO UPDATE SET
            file_name = COALESCE(EXCLUDED.file_name, night_delivery_import_logs.file_name),
            source_total_rows = GREATEST(night_delivery_import_logs.source_total_rows, EXCLUDED.source_total_rows),
            processed_rows = night_delivery_import_logs.processed_rows + EXCLUDED.processed_rows,
            inserted_total_rows = night_delivery_import_logs.inserted_total_rows + EXCLUDED.inserted_total_rows,
            skipped_total_rows = night_delivery_import_logs.skipped_total_rows + EXCLUDED.skipped_total_rows,

            source_min_completed_at = LEAST(
                COALESCE(night_delivery_import_logs.source_min_completed_at, EXCLUDED.source_min_completed_at),
                COALESCE(EXCLUDED.source_min_completed_at, night_delivery_import_logs.source_min_completed_at)
            ),
            source_max_completed_at = GREATEST(
                COALESCE(night_delivery_import_logs.source_max_completed_at, EXCLUDED.source_max_completed_at),
                COALESCE(EXCLUDED.source_max_completed_at, night_delivery_import_logs.source_max_completed_at)
            ),

            source_min_delivery_failed_at = LEAST(
                COALESCE(night_delivery_import_logs.source_min_delivery_failed_at, EXCLUDED.source_min_delivery_failed_at),
                COALESCE(EXCLUDED.source_min_delivery_failed_at, night_delivery_import_logs.source_min_delivery_failed_at)
            ),
            source_max_delivery_failed_at = GREATEST(
                COALESCE(night_delivery_import_logs.source_max_delivery_failed_at, EXCLUDED.source_max_delivery_failed_at),
                COALESCE(EXCLUDED.source_max_delivery_failed_at, night_delivery_import_logs.source_max_delivery_failed_at)
            ),

            source_min_event_at = LEAST(
                COALESCE(night_delivery_import_logs.source_min_event_at, EXCLUDED.source_min_event_at),
                COALESCE(EXCLUDED.source_min_event_at, night_delivery_import_logs.source_min_event_at)
            ),
            source_max_event_at = GREATEST(
                COALESCE(night_delivery_import_logs.source_max_event_at, EXCLUDED.source_max_event_at),
                COALESCE(EXCLUDED.source_max_event_at, night_delivery_import_logs.source_max_event_at)
            ),

            inserted_min_completed_at = LEAST(
                COALESCE(night_delivery_import_logs.inserted_min_completed_at, EXCLUDED.inserted_min_completed_at),
                COALESCE(EXCLUDED.inserted_min_completed_at, night_delivery_import_logs.inserted_min_completed_at)
            ),
            inserted_max_completed_at = GREATEST(
                COALESCE(night_delivery_import_logs.inserted_max_completed_at, EXCLUDED.inserted_max_completed_at),
                COALESCE(EXCLUDED.inserted_max_completed_at, night_delivery_import_logs.inserted_max_completed_at)
            ),

            inserted_min_delivery_failed_at = LEAST(
                COALESCE(night_delivery_import_logs.inserted_min_delivery_failed_at, EXCLUDED.inserted_min_delivery_failed_at),
                COALESCE(EXCLUDED.inserted_min_delivery_failed_at, night_delivery_import_logs.inserted_min_delivery_failed_at)
            ),
            inserted_max_delivery_failed_at = GREATEST(
                COALESCE(night_delivery_import_logs.inserted_max_delivery_failed_at, EXCLUDED.inserted_max_delivery_failed_at),
                COALESCE(EXCLUDED.inserted_max_delivery_failed_at, night_delivery_import_logs.inserted_max_delivery_failed_at)
            ),

            inserted_min_event_at = LEAST(
                COALESCE(night_delivery_import_logs.inserted_min_event_at, EXCLUDED.inserted_min_event_at),
                COALESCE(EXCLUDED.inserted_min_event_at, night_delivery_import_logs.inserted_min_event_at)
            ),
            inserted_max_event_at = GREATEST(
                COALESCE(night_delivery_import_logs.inserted_max_event_at, EXCLUDED.inserted_max_event_at),
                COALESCE(EXCLUDED.inserted_max_event_at, night_delivery_import_logs.inserted_max_event_at)
            ),

            chunks_total = GREATEST(night_delivery_import_logs.chunks_total, EXCLUDED.chunks_total),
            chunks_completed = night_delivery_import_logs.chunks_completed + 1,
            operator_ip = EXCLUDED.operator_ip,
            status = EXCLUDED.status,
            finished_at = CASE WHEN EXCLUDED.status = 'completed' THEN NOW() ELSE night_delivery_import_logs.finished_at END,
            elapsed_ms = CASE WHEN EXCLUDED.status = 'completed' THEN EXCLUDED.elapsed_ms ELSE night_delivery_import_logs.elapsed_ms END,
            updated_at = NOW()
        `,
        [
            options.importSessionId,
            options.fileName,
            Number(options.sourceTotalRows || 0),
            summary.processedCount,
            summary.insertedCount,
            summary.skippedCount,
            summary.sourceMinCompletedAt,
            summary.sourceMaxCompletedAt,
            summary.sourceMinDeliveryFailedAt,
            summary.sourceMaxDeliveryFailedAt,
            summary.sourceMinEventAt,
            summary.sourceMaxEventAt,
            summary.insertedMinCompletedAt,
            summary.insertedMaxCompletedAt,
            summary.insertedMinDeliveryFailedAt,
            summary.insertedMaxDeliveryFailedAt,
            summary.insertedMinEventAt,
            summary.insertedMaxEventAt,
            Number(options.chunksTotal || 1),
            options.clientIP || "unknown",
            options.isLastChunk ? "completed" : "processing",
            Number(options.elapsedMs || 0)
        ]
    );
}

async function copyInsertRows(rows, clientIP, options = {}) {
    const pool = getPool();
    const client = await pool.connect();

    let processedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;

    let sourceMinCompletedAt = null;
    let sourceMaxCompletedAt = null;
    let sourceMinDeliveryFailedAt = null;
    let sourceMaxDeliveryFailedAt = null;
    let sourceMinEventAt = null;
    let sourceMaxEventAt = null;

    let insertedMinCompletedAt = null;
    let insertedMaxCompletedAt = null;
    let insertedMinDeliveryFailedAt = null;
    let insertedMaxDeliveryFailedAt = null;
    let insertedMinEventAt = null;
    let insertedMaxEventAt = null;

    const skipHeader = options.skipHeader ?? false;

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
        const startIndex = skipHeader ? 1 : 0;

        for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];

            if (!hasData(row)) continue;

            processedCount++;

            const completedAt = parseTimestamp(row[15]);
            const deliveryFailedAt = parseTimestamp(row[17]);

            sourceMinCompletedAt = minTimestamp(sourceMinCompletedAt, completedAt);
            sourceMaxCompletedAt = maxTimestamp(sourceMaxCompletedAt, completedAt);
            sourceMinDeliveryFailedAt = minTimestamp(sourceMinDeliveryFailedAt, deliveryFailedAt);
            sourceMaxDeliveryFailedAt = maxTimestamp(sourceMaxDeliveryFailedAt, deliveryFailedAt);

            sourceMinEventAt = minTimestamp(minTimestamp(sourceMinEventAt, completedAt), deliveryFailedAt);
            sourceMaxEventAt = maxTimestamp(maxTimestamp(sourceMaxEventAt, completedAt), deliveryFailedAt);

            if (!shouldImportNightDeliveryRecord(completedAt, deliveryFailedAt)) {
                skippedCount++;
                continue;
            }

            insertedCount++;

            insertedMinCompletedAt = minTimestamp(insertedMinCompletedAt, completedAt);
            insertedMaxCompletedAt = maxTimestamp(insertedMaxCompletedAt, completedAt);
            insertedMinDeliveryFailedAt = minTimestamp(insertedMinDeliveryFailedAt, deliveryFailedAt);
            insertedMaxDeliveryFailedAt = maxTimestamp(insertedMaxDeliveryFailedAt, deliveryFailedAt);

            insertedMinEventAt = minTimestamp(minTimestamp(insertedMinEventAt, completedAt), deliveryFailedAt);
            insertedMaxEventAt = maxTimestamp(maxTimestamp(insertedMaxEventAt, completedAt), deliveryFailedAt);

            yield rowToCopyLine(row, clientIP, {
                completedAt,
                deliveryFailedAt
            });
        }
    }

    try {
        await client.query("BEGIN");

        const copyStream = client.query(copyFrom(copySql));
        const source = Readable.from(lineGenerator(), { encoding: "utf8" });

        await pipeline(source, copyStream);

        await upsertImportLog(
            client,
            {
                ...options,
                clientIP
            },
            {
                processedCount,
                insertedCount,
                skippedCount,
                sourceMinCompletedAt,
                sourceMaxCompletedAt,
                sourceMinDeliveryFailedAt,
                sourceMaxDeliveryFailedAt,
                sourceMinEventAt,
                sourceMaxEventAt,
                insertedMinCompletedAt,
                insertedMaxCompletedAt,
                insertedMinDeliveryFailedAt,
                insertedMaxDeliveryFailedAt,
                insertedMinEventAt,
                insertedMaxEventAt
            }
        );

        await client.query("COMMIT");

        return {
            processedCount,
            insertedCount,
            skippedCount,
            sourceMinCompletedAt,
            sourceMaxCompletedAt,
            sourceMinDeliveryFailedAt,
            sourceMaxDeliveryFailedAt,
            sourceMinEventAt,
            sourceMaxEventAt,
            insertedMinCompletedAt,
            insertedMaxCompletedAt,
            insertedMinDeliveryFailedAt,
            insertedMaxDeliveryFailedAt,
            insertedMinEventAt,
            insertedMaxEventAt
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);

        const requestStartDate = searchParams.get("startDate") || null;
        const requestEndDate = searchParams.get("endDate") || null;

        const bounds = await sql`
            SELECT
                TO_CHAR(MIN(completed_at)::DATE, 'YYYY-MM-DD') AS default_start_date,
                TO_CHAR(MAX(completed_at)::DATE, 'YYYY-MM-DD') AS default_end_date
            FROM night_delivery_records
            WHERE kubun = 's'
              AND completed_at IS NOT NULL
        `;

        const defaultStartDate = bounds[0]?.default_start_date || null;
        const defaultEndDate = bounds[0]?.default_end_date || null;

        const startDate = requestStartDate || defaultStartDate;
        const endDate = requestEndDate || defaultEndDate;

        if (!startDate && !endDate) {
            return NextResponse.json({
                success: true,
                summary: {
                    total_rows: 0,
                    delivered_rows: 0,
                    failed_rows: 0,
                    default_start_date: null,
                    default_end_date: null,
                    selected_start_date: null,
                    selected_end_date: null
                },
                companyStats: [],
                driverStats: [],
                failureReasonStats: [],
                timeSlots: TIME_SLOTS
            });
        }

        const summary = await sql`
            WITH base_records AS (
                SELECT *
                FROM night_delivery_records
                WHERE kubun = 's'
                  AND completed_at IS NOT NULL
                  AND (${startDate}::TEXT IS NULL OR completed_at >= (${startDate}::DATE)::TIMESTAMP)
                  AND (${endDate}::TEXT IS NULL OR completed_at < ((${endDate}::DATE + INTERVAL '1 day')::TIMESTAMP))
            ),
            night_events AS (
                SELECT
                    completed_at AS event_at,
                    'delivered' AS event_type
                FROM base_records
                WHERE EXTRACT(HOUR FROM completed_at)::INT IN (22, 23, 0, 1, 2, 3, 4, 5, 6, 7)

                UNION ALL

                SELECT
                    delivery_failed_at AS event_at,
                    'failed' AS event_type
                FROM base_records
                WHERE delivery_failed_at IS NOT NULL
                  AND EXTRACT(HOUR FROM delivery_failed_at)::INT IN (22, 23, 0, 1, 2, 3, 4, 5, 6, 7)
            )
            SELECT
                COUNT(*)::INT AS total_rows,
                COUNT(*) FILTER (WHERE event_type = 'delivered')::INT AS delivered_rows,
                COUNT(*) FILTER (WHERE event_type = 'failed')::INT AS failed_rows,
                ${defaultStartDate}::TEXT AS default_start_date,
                ${defaultEndDate}::TEXT AS default_end_date,
                ${startDate}::TEXT AS selected_start_date,
                ${endDate}::TEXT AS selected_end_date
            FROM night_events
        `;

        const companyStats = await sql`
            WITH base_records AS (
                SELECT *
                FROM night_delivery_records
                WHERE kubun = 's'
                  AND completed_at IS NOT NULL
                  AND (${startDate}::TEXT IS NULL OR completed_at >= (${startDate}::DATE)::TIMESTAMP)
                  AND (${endDate}::TEXT IS NULL OR completed_at < ((${endDate}::DATE + INTERVAL '1 day')::TIMESTAMP))
            ),
            hour_master(hour_value, hour_label, sort_no) AS (
                VALUES
                    (22, '22時台', 1),
                    (23, '23時台', 2),
                    (0, '0時台', 3),
                    (1, '1時台', 4),
                    (2, '2時台', 5),
                    (3, '3時台', 6),
                    (4, '4時台', 7),
                    (5, '5時台', 8),
                    (6, '6時台', 9),
                    (7, '7時台', 10)
            ),
            delivered AS (
                SELECT
                    COALESCE(NULLIF(delivery_company, ''), '未設定') AS delivery_company,
                    EXTRACT(HOUR FROM completed_at)::INT AS hour_value,
                    COUNT(*)::INT AS delivered_count
                FROM base_records
                WHERE EXTRACT(HOUR FROM completed_at)::INT IN (22, 23, 0, 1, 2, 3, 4, 5, 6, 7)
                GROUP BY
                    COALESCE(NULLIF(delivery_company, ''), '未設定'),
                    EXTRACT(HOUR FROM completed_at)::INT
            ),
            failed AS (
                SELECT
                    COALESCE(NULLIF(delivery_company, ''), '未設定') AS delivery_company,
                    EXTRACT(HOUR FROM delivery_failed_at)::INT AS hour_value,
                    COUNT(*)::INT AS failed_count
                FROM base_records
                WHERE delivery_failed_at IS NOT NULL
                  AND EXTRACT(HOUR FROM delivery_failed_at)::INT IN (22, 23, 0, 1, 2, 3, 4, 5, 6, 7)
                GROUP BY
                    COALESCE(NULLIF(delivery_company, ''), '未設定'),
                    EXTRACT(HOUR FROM delivery_failed_at)::INT
            ),
            companies AS (
                SELECT delivery_company FROM delivered
                UNION
                SELECT delivery_company FROM failed
            )
            SELECT
                c.delivery_company,
                h.hour_value,
                h.hour_label,
                h.sort_no,
                COALESCE(d.delivered_count, 0)::INT AS delivered_count,
                COALESCE(f.failed_count, 0)::INT AS failed_count
            FROM companies c
            CROSS JOIN hour_master h
            LEFT JOIN delivered d
                ON d.delivery_company = c.delivery_company
               AND d.hour_value = h.hour_value
            LEFT JOIN failed f
                ON f.delivery_company = c.delivery_company
               AND f.hour_value = h.hour_value
            ORDER BY
                c.delivery_company,
                h.sort_no
        `;

        const driverStats = await sql`
            WITH base_records AS (
                SELECT *
                FROM night_delivery_records
                WHERE kubun = 's'
                  AND completed_at IS NOT NULL
                  AND (${startDate}::TEXT IS NULL OR completed_at >= (${startDate}::DATE)::TIMESTAMP)
                  AND (${endDate}::TEXT IS NULL OR completed_at < ((${endDate}::DATE + INTERVAL '1 day')::TIMESTAMP))
            ),
            driver_events AS (
                SELECT
                    COALESCE(NULLIF(delivery_company, ''), '未設定') AS delivery_company,
                    COALESCE(NULLIF(driver_name, ''), '未設定') AS driver_name,
                    EXTRACT(HOUR FROM completed_at)::INT AS hour_value
                FROM base_records
                WHERE EXTRACT(HOUR FROM completed_at)::INT IN (22, 23, 0, 1, 2, 3, 4, 5, 6, 7)

                UNION ALL

                SELECT
                    COALESCE(NULLIF(delivery_company, ''), '未設定') AS delivery_company,
                    COALESCE(NULLIF(driver_name, ''), '未設定') AS driver_name,
                    EXTRACT(HOUR FROM delivery_failed_at)::INT AS hour_value
                FROM base_records
                WHERE delivery_failed_at IS NOT NULL
                  AND EXTRACT(HOUR FROM delivery_failed_at)::INT IN (22, 23, 0, 1, 2, 3, 4, 5, 6, 7)
            )
            SELECT
                delivery_company,
                driver_name,
                COUNT(*) FILTER (WHERE hour_value = 22)::INT AS h22,
                COUNT(*) FILTER (WHERE hour_value = 23)::INT AS h23,
                COUNT(*) FILTER (WHERE hour_value = 0)::INT AS h0,
                COUNT(*) FILTER (WHERE hour_value = 1)::INT AS h1,
                COUNT(*) FILTER (WHERE hour_value = 2)::INT AS h2,
                COUNT(*) FILTER (WHERE hour_value = 3)::INT AS h3,
                COUNT(*) FILTER (WHERE hour_value = 4)::INT AS h4,
                COUNT(*) FILTER (WHERE hour_value = 5)::INT AS h5,
                COUNT(*) FILTER (WHERE hour_value = 6)::INT AS h6,
                COUNT(*) FILTER (WHERE hour_value = 7)::INT AS h7,
                COUNT(*)::INT AS total_count
            FROM driver_events
            GROUP BY
                delivery_company,
                driver_name
            ORDER BY
                total_count DESC,
                delivery_company,
                driver_name
        `;

        const failureReasonStats = await sql`
            WITH base_records AS (
                SELECT *
                FROM night_delivery_records
                WHERE kubun = 's'
                  AND completed_at IS NOT NULL
                  AND (${startDate}::TEXT IS NULL OR completed_at >= (${startDate}::DATE)::TIMESTAMP)
                  AND (${endDate}::TEXT IS NULL OR completed_at < ((${endDate}::DATE + INTERVAL '1 day')::TIMESTAMP))
            ),
            hour_master(hour_value, hour_label, sort_no) AS (
                VALUES
                    (22, '22時台', 1),
                    (23, '23時台', 2),
                    (0, '0時台', 3),
                    (1, '1時台', 4),
                    (2, '2時台', 5),
                    (3, '3時台', 6),
                    (4, '4時台', 7),
                    (5, '5時台', 8),
                    (6, '6時台', 9),
                    (7, '7時台', 10)
            )
            SELECT
                COALESCE(NULLIF(r.delivery_company, ''), '未設定') AS delivery_company,
                h.hour_value,
                h.hour_label,
                h.sort_no,
                COALESCE(NULLIF(r.failure_reason, ''), '未設定') AS failure_reason,
                COUNT(*)::INT AS count
            FROM base_records r
            JOIN hour_master h
                ON h.hour_value = EXTRACT(HOUR FROM r.delivery_failed_at)::INT
            WHERE r.delivery_failed_at IS NOT NULL
            GROUP BY
                COALESCE(NULLIF(r.delivery_company, ''), '未設定'),
                h.hour_value,
                h.hour_label,
                h.sort_no,
                COALESCE(NULLIF(r.failure_reason, ''), '未設定')
            ORDER BY
                delivery_company,
                h.sort_no,
                count DESC,
                failure_reason
        `;

        return NextResponse.json({
            success: true,
            summary: summary[0] || {},
            companyStats,
            driverStats,
            failureReasonStats,
            timeSlots: TIME_SLOTS
        });
    } catch (error) {
        console.error("Night delivery GET error:", error);

        return NextResponse.json(
            { success: false, error: "データ取得に失敗しました" },
            { status: 500 }
        );
    }
}

export async function POST(req) {
    const startedAt = Date.now();

    try {
        const contentType = req.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            return NextResponse.json(
                { success: false, error: "JSON形式の分割データを送信してください" },
                { status: 400 }
            );
        }

        const body = await req.json();
        const rows = Array.isArray(body.rows) ? body.rows : [];

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "取込対象データがありません" },
                { status: 400 }
            );
        }

        const clientIP = getClientIP(req);

        const importResult = await copyInsertRows(rows, clientIP, {
            skipHeader: false,
            importSessionId: text(body.importSessionId),
            fileName: text(body.fileName),
            sourceTotalRows: Number(body.sourceTotalRows || rows.length),
            chunkIndex: Number(body.chunkIndex || 1),
            chunksTotal: Number(body.chunksTotal || 1),
            isLastChunk: Boolean(body.isLastChunk),
            elapsedMs: Date.now() - startedAt
        });

        const elapsedMs = Date.now() - startedAt;

        return NextResponse.json({
            success: true,
            count: importResult.insertedCount,
            insertedCount: importResult.insertedCount,
            skippedCount: importResult.skippedCount,
            processedCount: importResult.processedCount,
            elapsedMs
        });
    } catch (error) {
        console.error("Night delivery POST error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error?.message || "インポートに失敗しました"
            },
            { status: 500 }
        );
    }
}