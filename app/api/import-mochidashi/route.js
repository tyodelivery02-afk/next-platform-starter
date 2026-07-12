import { NextResponse } from "next/server";
import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const { Pool } = pg;

const KUBUN = "m";

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
    if (value === null || value === undefined) return null;

    const result = String(value).trim();

    return result === "" ? null : result;
}

function normalizeKeyText(value) {
    if (value === null || value === undefined) return "";

    return String(value).trim();
}

function formatDateTime(value) {
    if (!value) return null;

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
    if (value === null || value === undefined || value === "") return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return formatDateTime(value);
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

function rowToCopyLine(row, options) {
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
        options.importSessionId,
        options.importedAt,
        KUBUN,
        options.clientIP
    ];

    return values.map(copyValue).join("\t") + "\n";
}

async function copyInsertRows(rows, options) {
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

            yield rowToCopyLine(row, {
                importSessionId,
                importedAt,
                clientIP: options.clientIP
            });
        }
    }

    try {
        await client.query("BEGIN");

        await upsertImportLogStart_(client, {
            importSessionId,
            fileName: options.fileName,
            kubun: KUBUN,
            sourceTotalRows: options.sourceTotalRows,
            chunksTotal: options.chunksTotal,
            operatorEmail: options.clientIP
        });

        const copyStream = client.query(copyFrom(copySql));
        const source = Readable.from(lineGenerator(), { encoding: "utf8" });

        await pipeline(source, copyStream);

        await refreshImportLogDateRanges_(client, {
            importSessionId,
            kubun: KUBUN
        });

        await updateImportLogChunk_(client, {
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
        throw error;
    } finally {
        client.release();
    }
}

async function processStatsForImportSession(importSessionId) {
    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const importedAtResult = await client.query(
            `
            SELECT
                imported_at
            FROM night_delivery_records
            WHERE kubun = $1
              AND import_session_id = $2
            ORDER BY imported_at
            LIMIT 1
            `,
            [KUBUN, importSessionId]
        );

        if (importedAtResult.rowCount === 0) {
            throw new Error("この importSessionId の取込データが見つかりません");
        }

        const importedAt = formatDateTime(importedAtResult.rows[0].imported_at);

        await client.query(
            `
            INSERT INTO mochi_import_company_stats (
                kubun,
                import_session_id,
                imported_at,
                delivery_company,
                count,
                updated_at
            )
            SELECT
                $1 AS kubun,
                $2 AS import_session_id,
                MIN(imported_at) AS imported_at,
                COALESCE(NULLIF(delivery_company, ''), '未設定') AS delivery_company,
                COUNT(*)::BIGINT AS count,
                NOW() AS updated_at
            FROM night_delivery_records
            WHERE kubun = $1
              AND import_session_id = $2
            GROUP BY
                COALESCE(NULLIF(delivery_company, ''), '未設定')
            ON CONFLICT (
                kubun,
                import_session_id,
                delivery_company
            )
            DO UPDATE SET
                imported_at = EXCLUDED.imported_at,
                count = EXCLUDED.count,
                updated_at = NOW()
            `,
            [KUBUN, importSessionId]
        );

        const processedResult = await client.query(
            `
            INSERT INTO mochi_processed_imports (
                kubun,
                import_session_id,
                imported_at,
                processed_at
            )
            VALUES (
                $1,
                $2,
                $3::TIMESTAMP,
                NOW()
            )
            ON CONFLICT (
                kubun,
                import_session_id
            )
            DO NOTHING
            RETURNING import_session_id
            `,
            [KUBUN, importSessionId, importedAt]
        );

        const isNewStats = processedResult.rowCount > 0;

        if (isNewStats) {
            await client.query(
                `
                INSERT INTO mochi_address_key_stats (
                    kubun,
                    delivery_company,
                    receiver_address1,
                    receiver_address2,
                    receiver_address3,
                    count,
                    updated_at
                )
                SELECT
                    $1 AS kubun,
                    COALESCE(NULLIF(delivery_company, ''), '未設定') AS delivery_company,
                    COALESCE(receiver_address1, '') AS receiver_address1,
                    COALESCE(receiver_address2, '') AS receiver_address2,
                    COALESCE(receiver_address3, '') AS receiver_address3,
                    COUNT(DISTINCT NULLIF(hawb_no, ''))::BIGINT AS count,
                    NOW() AS updated_at
                FROM night_delivery_records
                WHERE kubun = $1
                  AND import_session_id = $2
                GROUP BY
                    COALESCE(NULLIF(delivery_company, ''), '未設定'),
                    COALESCE(receiver_address1, ''),
                    COALESCE(receiver_address2, ''),
                    COALESCE(receiver_address3, '')
                ON CONFLICT (
                    kubun,
                    delivery_company,
                    receiver_address1,
                    receiver_address2,
                    receiver_address3
                )
                DO UPDATE SET
                    count = mochi_address_key_stats.count + EXCLUDED.count,
                    updated_at = NOW()
                `,
                [KUBUN, importSessionId]
            );
        }

        await client.query("COMMIT");

        return {
            importSessionId,
            importedAt,
            isNewStats
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function buildSheetStats() {
    const pool = getPool();
    const client = await pool.connect();

    try {
        const companyResult = await client.query(
            `
            SELECT
                imported_at,
                delivery_company,
                SUM(count)::BIGINT AS count
            FROM mochi_import_company_stats
            WHERE kubun = $1
            GROUP BY
                imported_at,
                delivery_company
            ORDER BY
                imported_at DESC,
                delivery_company
            `,
            [KUBUN]
        );

        const addressResult = await client.query(
            `
            SELECT
                delivery_company,
                receiver_address1,
                receiver_address2,
                receiver_address3,
                count::BIGINT AS count
            FROM mochi_address_key_stats
            WHERE kubun = $1
            ORDER BY
                count DESC,
                delivery_company,
                receiver_address1,
                receiver_address2,
                receiver_address3
            `,
            [KUBUN]
        );

        const companySet = new Set();
        const importedAtSet = new Set();
        const grouped = new Map();

        companyResult.rows.forEach(row => {
            const importedAt = formatDateTime(row.imported_at);
            const company = row.delivery_company || "未設定";
            const count = Number(row.count || 0);

            companySet.add(company);
            importedAtSet.add(importedAt);

            if (!grouped.has(importedAt)) {
                grouped.set(importedAt, new Map());
            }

            grouped.get(importedAt).set(company, count);
        });

        const companies = Array.from(companySet).sort((a, b) => a.localeCompare(b, "ja"));
        const importedAts = Array.from(importedAtSet).sort().reverse();

        const companySummaryHeaders = [
            "imported_at",
            "合計",
            ...companies
        ];

        const companySummaryRows = importedAts.map(importedAt => {
            const map = grouped.get(importedAt) || new Map();
            const counts = companies.map(company => Number(map.get(company) || 0));
            const total = counts.reduce((sum, value) => sum + value, 0);

            return [
                importedAt,
                total,
                ...counts
            ];
        });

        const keyStats = addressResult.rows.map(row => {
            return {
                delivery_company: row.delivery_company || "",
                receiver_address1: row.receiver_address1 || "",
                receiver_address2: row.receiver_address2 || "",
                receiver_address3: row.receiver_address3 || "",
                count: Number(row.count || 0)
            };
        });

        return {
            companySummary: {
                headers: companySummaryHeaders,
                rows: companySummaryRows
            },
            keyStats
        };
    } finally {
        client.release();
    }
}

async function upsertImportLogStart_(client, options) {
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

async function updateImportLogChunk_(client, options) {
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

async function refreshImportLogDateRanges_(client, options) {
    await client.query(
        `
        WITH stats AS (
            SELECT
                MIN(completed_at) AS min_completed_at,
                MAX(completed_at) AS max_completed_at,
                MIN(delivery_failed_at) AS min_delivery_failed_at,
                MAX(delivery_failed_at) AS max_delivery_failed_at,
                LEAST(
                    MIN(completed_at),
                    MIN(delivery_failed_at)
                ) AS min_event_at,
                GREATEST(
                    MAX(completed_at),
                    MAX(delivery_failed_at)
                ) AS max_event_at
            FROM night_delivery_records
            WHERE import_session_id = $1
              AND kubun = $2
        )
        UPDATE night_delivery_import_logs
        SET
            inserted_min_completed_at = stats.min_completed_at,
            inserted_max_completed_at = stats.max_completed_at,
            inserted_min_delivery_failed_at = stats.min_delivery_failed_at,
            inserted_max_delivery_failed_at = stats.max_delivery_failed_at,
            inserted_min_event_at = stats.min_event_at,
            inserted_max_event_at = stats.max_event_at,
            source_min_completed_at = stats.min_completed_at,
            source_max_completed_at = stats.max_completed_at,
            source_min_delivery_failed_at = stats.min_delivery_failed_at,
            source_max_delivery_failed_at = stats.max_delivery_failed_at,
            source_min_event_at = stats.min_event_at,
            source_max_event_at = stats.max_event_at,
            updated_at = NOW()
        FROM stats
        WHERE night_delivery_import_logs.import_session_id = $1
        `,
        [
            options.importSessionId,
            options.kubun
        ]
    );
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

        const result = await copyInsertRows(rows, {
            clientIP: operatorEmail,
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

        const { searchParams } = new URL(req.url);
        const importSessionId = text(searchParams.get("importSessionId"));

        let processedImport = null;

        if (importSessionId) {
            processedImport = await processStatsForImportSession(importSessionId);
        }

        const stats = await buildSheetStats();

        return NextResponse.json({
            success: true,
            kubun: KUBUN,
            processedImport,
            ...stats
        });
    } catch (error) {
        console.error("Mochidashi stats GET error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error?.message || "集計データ取得に失敗しました"
            },
            { status: 500 }
        );
    }
}