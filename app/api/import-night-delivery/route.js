import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const { Pool } = pg;

const KUBUN = "s";

const NIGHT_HOURS = new Set([22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);

const TIME_BUCKETS = [
    "22時台",
    "23時台",
    "0時台",
    "1時台",
    "2時台",
    "3時台",
    "4時台",
    "5時台",
    "6時台",
    "7時台"
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
    "import_session_id",
    "imported_at",
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

function checkImportToken(req) {
    const expectedToken = process.env.IMPORT_TOKEN;

    if (!expectedToken) {
        return true;
    }

    const actualToken = req.headers.get("x-import-token");

    return actualToken === expectedToken;
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
    if (value === null || value === undefined) {
        return null;
    }

    const result = String(value).trim();

    return result === "" ? null : result;
}

function normalizeText(value, fallback = "未設定") {
    const result = text(value);

    return result || fallback;
}

function formatDateTime(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function nowTimestampText() {
    return formatDateTime(new Date());
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
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return formatDateTime(value);
    }

    if (typeof value === "number") {
        return parseExcelSerialDate(value);
    }

    const raw = String(value).trim();

    if (!raw) {
        return null;
    }

    const isoMatched = raw.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
    );

    if (isoMatched) {
        const [, year, month, day, hour = "0", minute = "0", second = "0"] = isoMatched;

        return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
    }

    const matched = raw.match(
        /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
    );

    if (matched) {
        const [, year, month, day, hour = "0", minute = "0", second = "0"] = matched;

        return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
    }

    return null;
}

function hasData(row) {
    if (!Array.isArray(row)) {
        return false;
    }

    for (let i = 0; i <= 26; i++) {
        if (row[i] !== null && row[i] !== undefined && String(row[i]).trim() !== "") {
            return true;
        }
    }

    return false;
}

function getHourFromTimestamp(value) {
    const parsed = parseTimestamp(value);

    if (!parsed) {
        return null;
    }

    const matched = parsed.match(/^\d{4}-\d{2}-\d{2} (\d{2}):/);

    if (!matched) {
        return null;
    }

    return Number(matched[1]);
}

function isNightHour(value) {
    const hour = getHourFromTimestamp(value);

    return hour !== null && NIGHT_HOURS.has(hour);
}

function isNightRow(row) {
    return isNightHour(row[15]) || isNightHour(row[17]);
}

function makeNightEventCandidates(row) {
    const candidates = [];

    const completedAt = parseTimestamp(row[15]);       // P列
    const deliveryFailedAt = parseTimestamp(row[17]);  // R列

    if (isNightHour(row[15])) {
        candidates.push({
            row,
            completedAt,
            deliveryFailedAt: null
        });
    }

    if (isNightHour(row[17])) {
        candidates.push({
            row,
            completedAt: null,
            deliveryFailedAt
        });
    }

    return candidates;
}

function makeNightDedupKey(row, completedAt, deliveryFailedAt) {
    return [
        KUBUN,
        text(row[1]) || "",
        completedAt || "",
        deliveryFailedAt || ""
    ].join("|||");
}

function timestampMin(current, value) {
    if (!value) {
        return current;
    }

    if (!current) {
        return value;
    }

    return value < current ? value : current;
}

function timestampMax(current, value) {
    if (!value) {
        return current;
    }

    if (!current) {
        return value;
    }

    return value > current ? value : current;
}

function getSourceDateRanges(rows) {
    const ranges = {
        sourceMinCompletedAt: null,
        sourceMaxCompletedAt: null,
        sourceMinDeliveryFailedAt: null,
        sourceMaxDeliveryFailedAt: null,
        sourceMinEventAt: null,
        sourceMaxEventAt: null
    };

    rows.forEach(row => {
        if (!hasData(row)) {
            return;
        }

        const completedAt = parseTimestamp(row[15]);
        const deliveryFailedAt = parseTimestamp(row[17]);

        ranges.sourceMinCompletedAt = timestampMin(ranges.sourceMinCompletedAt, completedAt);
        ranges.sourceMaxCompletedAt = timestampMax(ranges.sourceMaxCompletedAt, completedAt);

        ranges.sourceMinDeliveryFailedAt = timestampMin(ranges.sourceMinDeliveryFailedAt, deliveryFailedAt);
        ranges.sourceMaxDeliveryFailedAt = timestampMax(ranges.sourceMaxDeliveryFailedAt, deliveryFailedAt);

        ranges.sourceMinEventAt = timestampMin(ranges.sourceMinEventAt, completedAt);
        ranges.sourceMinEventAt = timestampMin(ranges.sourceMinEventAt, deliveryFailedAt);

        ranges.sourceMaxEventAt = timestampMax(ranges.sourceMaxEventAt, completedAt);
        ranges.sourceMaxEventAt = timestampMax(ranges.sourceMaxEventAt, deliveryFailedAt);
    });

    return ranges;
}

function buildNightInsertValues(row, options) {
    return [
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
        options.completedAt,
        parseTimestamp(row[16]),
        options.deliveryFailedAt,
        parseTimestamp(row[18]),
        text(row[19]),
        parseTimestamp(row[20]),
        parseTimestamp(row[21]),
        text(row[22]),
        text(row[23]),
        text(row[24]),
        text(row[25]),
        text(row[26]),
        options.importSessionId,
        options.importedAt,
        KUBUN,
        options.operatorEmail
    ];
}

async function upsertImportLogStart(client, options) {
    await client.query(
        `
    INSERT INTO night_delivery_import_logs (
      import_session_id,
      file_name,
      kubun,
      source_total_rows,
      chunks_total,
      operator_ip,
      status,
      started_at,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      'processing',
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (import_session_id)
    DO UPDATE SET
      file_name = COALESCE(night_delivery_import_logs.file_name, EXCLUDED.file_name),
      source_total_rows = GREATEST(night_delivery_import_logs.source_total_rows, EXCLUDED.source_total_rows),
      chunks_total = GREATEST(night_delivery_import_logs.chunks_total, EXCLUDED.chunks_total),
      operator_ip = EXCLUDED.operator_ip,
      status = 'processing',
      updated_at = NOW()
    `,
        [
            options.importSessionId,
            options.fileName || null,
            options.kubun,
            Number(options.sourceTotalRows || 0),
            Number(options.chunksTotal || 1),
            options.operatorEmail || ""
        ]
    );
}

async function mergeImportLogSourceRanges(client, options) {
    await client.query(
        `
    UPDATE night_delivery_import_logs
    SET
      source_min_completed_at =
        CASE
          WHEN $2::TIMESTAMP IS NULL THEN source_min_completed_at
          WHEN source_min_completed_at IS NULL THEN $2::TIMESTAMP
          ELSE LEAST(source_min_completed_at, $2::TIMESTAMP)
        END,
      source_max_completed_at =
        CASE
          WHEN $3::TIMESTAMP IS NULL THEN source_max_completed_at
          WHEN source_max_completed_at IS NULL THEN $3::TIMESTAMP
          ELSE GREATEST(source_max_completed_at, $3::TIMESTAMP)
        END,
      source_min_delivery_failed_at =
        CASE
          WHEN $4::TIMESTAMP IS NULL THEN source_min_delivery_failed_at
          WHEN source_min_delivery_failed_at IS NULL THEN $4::TIMESTAMP
          ELSE LEAST(source_min_delivery_failed_at, $4::TIMESTAMP)
        END,
      source_max_delivery_failed_at =
        CASE
          WHEN $5::TIMESTAMP IS NULL THEN source_max_delivery_failed_at
          WHEN source_max_delivery_failed_at IS NULL THEN $5::TIMESTAMP
          ELSE GREATEST(source_max_delivery_failed_at, $5::TIMESTAMP)
        END,
      source_min_event_at =
        CASE
          WHEN $6::TIMESTAMP IS NULL THEN source_min_event_at
          WHEN source_min_event_at IS NULL THEN $6::TIMESTAMP
          ELSE LEAST(source_min_event_at, $6::TIMESTAMP)
        END,
      source_max_event_at =
        CASE
          WHEN $7::TIMESTAMP IS NULL THEN source_max_event_at
          WHEN source_max_event_at IS NULL THEN $7::TIMESTAMP
          ELSE GREATEST(source_max_event_at, $7::TIMESTAMP)
        END,
      updated_at = NOW()
    WHERE import_session_id = $1
    `,
        [
            options.importSessionId,
            options.sourceMinCompletedAt,
            options.sourceMaxCompletedAt,
            options.sourceMinDeliveryFailedAt,
            options.sourceMaxDeliveryFailedAt,
            options.sourceMinEventAt,
            options.sourceMaxEventAt
        ]
    );
}

async function refreshImportLogInsertedRanges(client, options) {
    await client.query(
        `
    WITH inserted_events AS (
      SELECT completed_at AS event_at, 'completed' AS event_type
      FROM night_delivery_records
      WHERE import_session_id = $1
        AND kubun = $2
        AND completed_at IS NOT NULL

      UNION ALL

      SELECT delivery_failed_at AS event_at, 'failed' AS event_type
      FROM night_delivery_records
      WHERE import_session_id = $1
        AND kubun = $2
        AND delivery_failed_at IS NOT NULL
    ),
    stats AS (
      SELECT
        MIN(event_at) FILTER (WHERE event_type = 'completed') AS min_completed_at,
        MAX(event_at) FILTER (WHERE event_type = 'completed') AS max_completed_at,
        MIN(event_at) FILTER (WHERE event_type = 'failed') AS min_delivery_failed_at,
        MAX(event_at) FILTER (WHERE event_type = 'failed') AS max_delivery_failed_at,
        MIN(event_at) AS min_event_at,
        MAX(event_at) AS max_event_at
      FROM inserted_events
    )
    UPDATE night_delivery_import_logs
    SET
      inserted_min_completed_at = stats.min_completed_at,
      inserted_max_completed_at = stats.max_completed_at,
      inserted_min_delivery_failed_at = stats.min_delivery_failed_at,
      inserted_max_delivery_failed_at = stats.max_delivery_failed_at,
      inserted_min_event_at = stats.min_event_at,
      inserted_max_event_at = stats.max_event_at,
      updated_at = NOW()
    FROM stats
    WHERE night_delivery_import_logs.import_session_id = $1
    `,
        [options.importSessionId, options.kubun]
    );
}

async function updateImportLogChunk(client, options) {
    await client.query(
        `
    UPDATE night_delivery_import_logs
    SET
      processed_rows = processed_rows + $2,
      inserted_total_rows = inserted_total_rows + $3,
      skipped_total_rows = skipped_total_rows + $4,
      chunks_completed = GREATEST(chunks_completed, $5),
      status = CASE WHEN $6 THEN 'completed' ELSE status END,
      finished_at = CASE WHEN $6 THEN NOW() ELSE finished_at END,
      elapsed_ms = CASE WHEN $6 THEN $7 ELSE elapsed_ms END,
      updated_at = NOW()
    WHERE import_session_id = $1
    `,
        [
            options.importSessionId,
            Number(options.processedCount || 0),
            Number(options.insertedCount || 0),
            Number(options.skippedCount || 0),
            Number(options.chunkIndex || 1),
            Boolean(options.isLastChunk),
            Number(options.elapsedMs || 0)
        ]
    );
}

async function markImportLogFailed(client, options) {
    await client.query(
        `
    INSERT INTO night_delivery_import_logs (
      import_session_id,
      kubun,
      operator_ip,
      status,
      error_message,
      finished_at,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      'failed',
      $4,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (import_session_id)
    DO UPDATE SET
      status = 'failed',
      error_message = EXCLUDED.error_message,
      finished_at = NOW(),
      operator_ip = COALESCE(EXCLUDED.operator_ip, night_delivery_import_logs.operator_ip),
      updated_at = NOW()
    `,
        [
            options.importSessionId,
            options.kubun,
            options.operatorEmail || "",
            options.errorMessage || "unknown error"
        ]
    );
}

async function insertNightRows(rows, options) {
    const pool = getPool();
    const client = await pool.connect();

    const importedAt = parseTimestamp(options.importedAt) || nowTimestampText();
    const importSessionId = text(options.importSessionId);

    if (!importSessionId) {
        client.release();
        throw new Error("importSessionId がありません");
    }

    let processedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;

    const sourceRanges = getSourceDateRanges(rows);

    try {
        await client.query("BEGIN");

        await upsertImportLogStart(client, {
            importSessionId,
            fileName: options.fileName,
            kubun: KUBUN,
            sourceTotalRows: options.sourceTotalRows,
            chunksTotal: options.chunksTotal,
            operatorEmail: options.operatorEmail
        });

        await mergeImportLogSourceRanges(client, {
            importSessionId,
            ...sourceRanges
        });

        const seenInChunk = new Set();
        const candidates = [];

        for (const row of rows) {
            if (!hasData(row)) {
                skippedCount++;
                continue;
            }

            processedCount++;

            const hawbNo = text(row[1]);

            if (!hawbNo) {
                skippedCount++;
                continue;
            }

            const eventCandidates = makeNightEventCandidates(row);

            if (eventCandidates.length === 0) {
                skippedCount++;
                continue;
            }

            eventCandidates.forEach(candidate => {
                const dedupKey = makeNightDedupKey(
                    row,
                    candidate.completedAt,
                    candidate.deliveryFailedAt
                );

                if (seenInChunk.has(dedupKey)) {
                    skippedCount++;
                    return;
                }

                seenInChunk.add(dedupKey);
                candidates.push(candidate);
            });
        }

        if (candidates.length > 0) {
            const columnCount = COPY_COLUMNS.length;
            const values = [];

            const placeholders = candidates.map((candidate, rowIndex) => {
                const rowValues = buildNightInsertValues(candidate.row, {
                    importSessionId,
                    importedAt,
                    operatorEmail: options.operatorEmail,
                    completedAt: candidate.completedAt,
                    deliveryFailedAt: candidate.deliveryFailedAt
                });

                values.push(...rowValues);

                const start = rowIndex * columnCount;

                return `(${rowValues.map((_, colIndex) => `$${start + colIndex + 1}`).join(", ")})`;
            });

            const insertResult = await client.query(
                `
        INSERT INTO night_delivery_records (
          ${COPY_COLUMNS.join(", ")}
        )
        VALUES
          ${placeholders.join(",\n")}
        ON CONFLICT DO NOTHING
        RETURNING hawb_no
        `,
                values
            );

            insertedCount = insertResult.rowCount;
            skippedCount += candidates.length - insertedCount;
        }

        await refreshImportLogInsertedRanges(client, {
            importSessionId,
            kubun: KUBUN
        });

        await updateImportLogChunk(client, {
            importSessionId,
            processedCount,
            insertedCount,
            skippedCount,
            chunkIndex: options.chunkIndex,
            chunksTotal: options.chunksTotal,
            isLastChunk: options.isLastChunk,
            elapsedMs: options.elapsedMs
        });

        await client.query("COMMIT");

        return {
            processedCount,
            insertedCount,
            skippedCount,
            importedAt,
            importSessionId
        };
    } catch (error) {
        await client.query("ROLLBACK");

        try {
            await markImportLogFailed(client, {
                importSessionId,
                kubun: KUBUN,
                operatorEmail: options.operatorEmail,
                errorMessage: error?.message || String(error)
            });
        } catch (_) {
            // ログ更新に失敗しても元のエラーを優先する
        }

        throw error;
    } finally {
        client.release();
    }
}

function emptyBucket() {
    return {
        completed: 0,
        failed: 0,
        failureReasons: {}
    };
}

function ensureBucket(map, key) {
    if (!map[key]) {
        map[key] = emptyBucket();
    }

    return map[key];
}

function addFailureReason(target, reason, count) {
    if (!reason) {
        return;
    }

    target[reason] = Number(target[reason] || 0) + Number(count || 0);
}

async function buildSheetStats() {
    const pool = getPool();
    const client = await pool.connect();

    try {
        const eventResult = await client.query(
            `
      WITH events AS (
        SELECT
          COALESCE(NULLIF(delivery_company, ''), '未設定') AS company,
          COALESCE(NULLIF(driver_name, ''), '未設定') AS driver_name,
          COALESCE(NULLIF(failure_reason, ''), '未設定') AS failure_reason,
          completed_at AS event_at,
          'completed' AS event_type,
          CASE EXTRACT(HOUR FROM completed_at)::INT
            WHEN 22 THEN '22時台'
            WHEN 23 THEN '23時台'
            WHEN 0 THEN '0時台'
            WHEN 1 THEN '1時台'
            WHEN 2 THEN '2時台'
            WHEN 3 THEN '3時台'
            WHEN 4 THEN '4時台'
            WHEN 5 THEN '5時台'
            WHEN 6 THEN '6時台'
            WHEN 7 THEN '7時台'
          END AS time_bucket
        FROM night_delivery_records
        WHERE kubun = $1
          AND completed_at IS NOT NULL
          AND EXTRACT(HOUR FROM completed_at)::INT IN (22,23,0,1,2,3,4,5,6,7)

        UNION ALL

        SELECT
          COALESCE(NULLIF(delivery_company, ''), '未設定') AS company,
          COALESCE(NULLIF(driver_name, ''), '未設定') AS driver_name,
          COALESCE(NULLIF(failure_reason, ''), '未設定') AS failure_reason,
          delivery_failed_at AS event_at,
          'failed' AS event_type,
          CASE EXTRACT(HOUR FROM delivery_failed_at)::INT
            WHEN 22 THEN '22時台'
            WHEN 23 THEN '23時台'
            WHEN 0 THEN '0時台'
            WHEN 1 THEN '1時台'
            WHEN 2 THEN '2時台'
            WHEN 3 THEN '3時台'
            WHEN 4 THEN '4時台'
            WHEN 5 THEN '5時台'
            WHEN 6 THEN '6時台'
            WHEN 7 THEN '7時台'
          END AS time_bucket
        FROM night_delivery_records
        WHERE kubun = $1
          AND delivery_failed_at IS NOT NULL
          AND EXTRACT(HOUR FROM delivery_failed_at)::INT IN (22,23,0,1,2,3,4,5,6,7)
      )
      SELECT
        company,
        driver_name,
        failure_reason,
        event_type,
        time_bucket,
        COUNT(*)::BIGINT AS count
      FROM events
      WHERE time_bucket IS NOT NULL
      GROUP BY
        company,
        driver_name,
        failure_reason,
        event_type,
        time_bucket
      `,
            [KUBUN]
        );

        const failureReasonSet = new Set();
        const companyMap = new Map();
        const driverMap = new Map();

        const total = {
            completed: 0,
            failed: 0,
            failureReasons: {},
            buckets: {}
        };

        TIME_BUCKETS.forEach(label => {
            total.buckets[label] = emptyBucket();
        });

        eventResult.rows.forEach(row => {
            const company = normalizeText(row.company);
            const driverName = normalizeText(row.driver_name);
            const failureReason = normalizeText(row.failure_reason);
            const eventType = row.event_type;
            const timeBucket = row.time_bucket;
            const count = Number(row.count || 0);

            const totalBucket = ensureBucket(total.buckets, timeBucket);

            if (eventType === "completed") {
                total.completed += count;
                totalBucket.completed += count;
            }

            if (eventType === "failed") {
                total.failed += count;
                totalBucket.failed += count;
                failureReasonSet.add(failureReason);
                addFailureReason(total.failureReasons, failureReason, count);
                addFailureReason(totalBucket.failureReasons, failureReason, count);
            }

            if (!companyMap.has(company)) {
                const companyItem = {
                    company,
                    completed: 0,
                    failed: 0,
                    failureReasons: {},
                    buckets: {}
                };

                TIME_BUCKETS.forEach(label => {
                    companyItem.buckets[label] = emptyBucket();
                });

                companyMap.set(company, companyItem);
            }

            const companyItem = companyMap.get(company);
            const companyBucket = ensureBucket(companyItem.buckets, timeBucket);

            if (eventType === "completed") {
                companyItem.completed += count;
                companyBucket.completed += count;
            }

            if (eventType === "failed") {
                companyItem.failed += count;
                companyBucket.failed += count;
                addFailureReason(companyItem.failureReasons, failureReason, count);
                addFailureReason(companyBucket.failureReasons, failureReason, count);
            }

            const driverKey = `${company}|||${driverName}`;

            if (!driverMap.has(driverKey)) {
                const driverItem = {
                    company,
                    driver_name: driverName,
                    total: 0,
                    buckets: {}
                };

                TIME_BUCKETS.forEach(label => {
                    driverItem.buckets[label] = 0;
                });

                driverMap.set(driverKey, driverItem);
            }

            const driverItem = driverMap.get(driverKey);

            driverItem.total += count;
            driverItem.buckets[timeBucket] = Number(driverItem.buckets[timeBucket] || 0) + count;
        });

        const failureReasons = Array.from(failureReasonSet).sort((a, b) => a.localeCompare(b, "ja"));

        const companies = Array.from(companyMap.values()).map(company => {
            return {
                ...company,
                total: Number(company.completed || 0) + Number(company.failed || 0)
            };
        });

        const drivers = Array.from(driverMap.values()).sort((a, b) => {
            if (b.total !== a.total) {
                return b.total - a.total;
            }

            const companyCompare = a.company.localeCompare(b.company, "ja");

            if (companyCompare !== 0) {
                return companyCompare;
            }

            return a.driver_name.localeCompare(b.driver_name, "ja");
        });

        return {
            failureReasons,
            total,
            companies,
            drivers
        };
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

        const operatorEmail = text(body.operatorEmail) || getClientIP(req);

        const result = await insertNightRows(rows, {
            operatorEmail,
            importSessionId: text(body.importSessionId),
            importedAt: text(body.importedAt),
            fileName: body.fileName || null,
            sourceTotalRows: Number(body.sourceTotalRows || rows.length),
            chunkIndex: Number(body.chunkIndex || 1),
            chunksTotal: Number(body.chunksTotal || 1),
            isLastChunk: Boolean(body.isLastChunk),
            elapsedMs: Date.now() - startedAt
        });

        return NextResponse.json({
            success: true,
            kubun: KUBUN,
            importedAt: result.importedAt,
            importSessionId: result.importSessionId,
            fileName: body.fileName || null,
            chunkIndex: body.chunkIndex || 1,
            chunksTotal: body.chunksTotal || 1,
            processedCount: result.processedCount,
            insertedCount: result.insertedCount,
            skippedCount: result.skippedCount,
            elapsedMs: Date.now() - startedAt
        });
    } catch (error) {
        console.error("Night delivery import POST error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error?.message || "深夜配送インポートに失敗しました"
            },
            { status: 500 }
        );
    }
}

export async function GET(req) {
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

        const stats = await buildSheetStats();

        return NextResponse.json({
            success: true,
            kubun: KUBUN,
            ...stats
        });
    } catch (error) {
        console.error("Night delivery stats GET error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error?.message || "深夜配送集計データ取得に失敗しました"
            },
            { status: 500 }
        );
    }
}