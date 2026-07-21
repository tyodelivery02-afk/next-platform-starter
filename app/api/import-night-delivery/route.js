import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const { Pool } = pg;

const KUBUN = "s";

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


function getConnectionString() {
    let connectionString =
        process.env.NETLIFY_DATABASE_URL ||
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL;

    if (!connectionString) {
        throw new Error(
            "DATABASE_URL / NETLIFY_DATABASE_URL / POSTGRES_URL が設定されていません"
        );
    }

    const isLocal =
        connectionString.includes("localhost") ||
        connectionString.includes("127.0.0.1");

    /*
     * ローカル環境では接続文字列を変更しません。
     */
    if (isLocal) {
        return connectionString;
    }

    /*
     * pg-connection-stringの将来バージョンでも
     * 現在と同じ安全なSSL検証を維持するため、
     * sslmodeをverify-fullに明示します。
     */
    const connectionUrl = new URL(connectionString);

    const currentSslMode =
        connectionUrl.searchParams.get("sslmode");

    if (
        !currentSslMode ||
        currentSslMode === "prefer" ||
        currentSslMode === "require" ||
        currentSslMode === "verify-ca"
    ) {
        connectionUrl.searchParams.set(
            "sslmode",
            "verify-full"
        );
    }

    return connectionUrl.toString();
}

function getPool() {
    if (!globalThis.__nightDeliveryPgPool) {
        const connectionString =
            getConnectionString();

        globalThis.__nightDeliveryPgPool =
            new Pool({
                connectionString,
                max: 1,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000
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

function normalizeFailureReason(value) {
    const result = text(value);

    return result || "";
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

    const raw = normalizeDateTimeText(value);

    if (!raw) {
        return null;
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

function normalizeDateTimeText(value) {
    return String(value)
        .replace(/\u3000/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getHourLikeVbaCDate(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (typeof value === "number") {
        const serial = Number(value);

        if (!Number.isFinite(serial)) {
            return null;
        }

        const fractionalDay = serial - Math.floor(serial);
        const normalizedFraction = fractionalDay < 0
            ? fractionalDay + 1
            : fractionalDay;

        return Math.floor(normalizedFraction * 24);
    }

    const raw = normalizeDateTimeText(value);

    if (!raw) {
        return null;
    }

    // 例：2026/7/12  2:24:59
    // 例：2026/7/12 2:24:59
    // 例：2026-07-12 02:24:59
    // 例：2026-07-12T02:24:59
    const dateTimeMatched = raw.match(
        /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[\sT]+(\d{1,2})(?::\d{1,2})?(?::\d{1,2})?)?$/
    );

    if (dateTimeMatched) {
        const hour = dateTimeMatched[1] === undefined
            ? 0
            : Number(dateTimeMatched[1]);

        return Number.isFinite(hour) ? hour : null;
    }

    // 念のため、時刻だけの値にも対応
    // 例：2:24:59
    const timeOnlyMatched = raw.match(/^(\d{1,2})(?::\d{1,2})?(?::\d{1,2})?$/);

    if (timeOnlyMatched) {
        const hour = Number(timeOnlyMatched[1]);

        return Number.isFinite(hour) ? hour : null;
    }

    return null;
}

function timeIndexFromValue(value) {
    const hour = getHourLikeVbaCDate(value);

    if (hour === null) {
        return -1;
    }

    if (hour === 22) {
        return 0;
    }

    if (hour === 23) {
        return 1;
    }

    if (hour >= 0 && hour <= 7) {
        return hour + 2;
    }

    return -1;
}

function makeNightEventCandidates(row) {
    const candidates = [];

    const completedAt = parseTimestamp(row[15]);       // P列
    const deliveryFailedAt = parseTimestamp(row[17]);  // R列

    const idxP = timeIndexFromValue(row[15]);
    const idxR = timeIndexFromValue(row[17]);

    if (idxP >= 0) {
        candidates.push({
            row,
            completedAt,
            deliveryFailedAt: null,
            failureReason: null,
            timeIndex: idxP,
            eventType: "completed"
        });
    }

    if (idxR >= 0) {
        candidates.push({
            row,
            completedAt: null,
            deliveryFailedAt,
            failureReason: text(row[22]),
            timeIndex: idxR,
            eventType: "failed"
        });
    }

    return candidates;
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

async function upsertImportLogStart(client, options) {
    await client.query(
        `
    INSERT INTO night_delivery_import_logs (
      import_session_id,
      file_name,
      kubun,
      imported_at,
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
      $4::TIMESTAMP,
      $5,
      $6,
      $7,
      'processing',
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (import_session_id)
    DO UPDATE SET
      file_name = COALESCE(night_delivery_import_logs.file_name, EXCLUDED.file_name),
      imported_at = COALESCE(night_delivery_import_logs.imported_at, EXCLUDED.imported_at),
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
            options.importedAt,
            Number(options.sourceTotalRows || 0),
            Number(options.chunksTotal || 1),
            options.operatorEmail || ""
        ]
    );
}

async function getExistingNightStats(client, importSessionId) {
    const result = await client.query(
        `
        SELECT stats_json
        FROM night_delivery_import_logs
        WHERE import_session_id = $1
        FOR UPDATE
        `,
        [importSessionId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0].stats_json || null;
}

async function saveNightStatsToLog(client, options) {
    const stats = options.stats;

    await client.query(
        `
        UPDATE night_delivery_import_logs
        SET
          completed_total = $2,
          failed_total = $3,
          stats_json = $4::jsonb,
          company_stats = $5::jsonb,
          driver_stats = $6::jsonb,
          processed_rows = processed_rows + $7,
          inserted_total_rows = inserted_total_rows + $8,
          skipped_total_rows = skipped_total_rows + $9,
          chunks_completed = GREATEST(chunks_completed, $10),
          status = CASE WHEN $11 THEN 'completed' ELSE status END,
          finished_at = CASE WHEN $11 THEN NOW() ELSE finished_at END,
          elapsed_ms = CASE WHEN $11 THEN $12 ELSE elapsed_ms END,
          updated_at = NOW()
        WHERE import_session_id = $1
        `,
        [
            options.importSessionId,
            Number((stats.total && stats.total.completed) || 0),
            Number((stats.total && stats.total.failed) || 0),
            JSON.stringify(stats),
            JSON.stringify(stats.companies || []),
            JSON.stringify(stats.drivers || []),
            Number(options.chunkProcessedCount || 0),
            Number(options.chunkInsertedCount || 0),
            Number(options.chunkSkippedCount || 0),
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

    try {
        await client.query("BEGIN");

        await upsertImportLogStart(client, {
            importSessionId,
            importedAt,
            fileName: options.fileName,
            kubun: KUBUN,
            sourceTotalRows: options.sourceTotalRows,
            chunksTotal: options.chunksTotal,
            operatorEmail: options.operatorEmail
        });

        const existingStats = await getExistingNightStats(client, importSessionId);

        const chunkStats = buildNightStatsFromRows(rows, {
            importSessionId,
            importedAt,
            operatorEmail: options.operatorEmail
        });

        const mergedStats = mergeNightStats(existingStats, chunkStats);

        await saveNightStatsToLog(client, {
            importSessionId,
            stats: mergedStats,
            chunkProcessedCount: chunkStats.processedCount,
            chunkInsertedCount: chunkStats.insertedCount,
            chunkSkippedCount: chunkStats.skippedCount,
            chunkIndex: options.chunkIndex,
            isLastChunk: options.isLastChunk,
            elapsedMs: options.elapsedMs
        });

        await client.query("COMMIT");

        return {
            processedCount: chunkStats.processedCount,
            insertedCount: chunkStats.insertedCount,
            skippedCount: chunkStats.skippedCount,
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

function createEmptyNightStats(options) {
    const stats = {
        importSessionId: options.importSessionId,
        importedAt: options.importedAt,
        importDate: formatImportDate(options.importedAt),
        operatorEmail: options.operatorEmail || "",
        total: {
            completed: 0,
            failed: 0
        },
        sourceDates: [],
        companies: [],
        drivers: [],
        processedCount: 0,
        insertedCount: 0,
        skippedCount: 0
    };

    return stats;
}

function formatImportDate(value) {
    const parsed = parseTimestamp(value) || nowTimestampText();

    return parsed.slice(0, 10).replace(/-/g, "/");
}

/**
 * 元データのN列から日付部分のみを取得します。
 *
 * 戻り値：
 * yyyy/MM/dd
 *
 * 日付として解析できない場合は空文字を返します。
 */
function formatSourceDate(value) {
    const parsed = parseTimestamp(value);

    if (!parsed) {
        return "";
    }

    return parsed
        .slice(0, 10)
        .replace(/-/g, "/");
}

/**
 * 会社名と元データ日付を組み合わせた集計キーを作成します。
 */
function buildCompanyDateKey(company, sourceDate) {
    return JSON.stringify([
        String(company || ""),
        String(sourceDate || "")
    ]);
}

function emptyTimeBucketCounts() {
    const result = {};

    TIME_BUCKETS.forEach(label => {
        result[label] = 0;
    });

    return result;
}

function ensureFailureReasonTimeBuckets(companyItem, failureReason) {
    if (!companyItem.failureReasonBuckets) {
        companyItem.failureReasonBuckets = {};
    }

    if (!companyItem.failureReasonBuckets[failureReason]) {
        companyItem.failureReasonBuckets[failureReason] = emptyTimeBucketCounts();
    }

    return companyItem.failureReasonBuckets[failureReason];
}

function emptyCompanyStats(company, sourceDate) {
    const item = {
        company,
        sourceDate,
        allCount: 0,
        completed: 0,
        failed: 0,
        buckets: {},
        failureReasons: {},
        failureReasonBuckets: {}
    };

    TIME_BUCKETS.forEach(label => {
        item.buckets[label] = 0;
    });

    return item;
}

function emptyDriverStats(company, driverName) {
    const item = {
        company,
        driver_name: driverName,
        total: 0,
        buckets: {}
    };

    TIME_BUCKETS.forEach(label => {
        item.buckets[label] = 0;
    });

    return item;
}

function statsArrayToMap(array, keyFn) {
    const map = new Map();

    if (!Array.isArray(array)) {
        return map;
    }

    array.forEach(item => {
        map.set(keyFn(item), item);
    });

    return map;
}

function ensureCompanyStats(
    companyMap,
    company,
    sourceDate
) {
    const key = buildCompanyDateKey(
        company,
        sourceDate
    );

    if (!companyMap.has(key)) {
        companyMap.set(
            key,
            emptyCompanyStats(
                company,
                sourceDate
            )
        );
    }

    return companyMap.get(key);
}

function ensureDriverStats(driverMap, company, driverName) {
    const key = company + "|||" + driverName;

    if (!driverMap.has(key)) {
        driverMap.set(key, emptyDriverStats(company, driverName));
    }

    return driverMap.get(key);
}

function addMapCount(target, key, count = 1) {
    if (!key) {
        return;
    }

    target[key] = Number(target[key] || 0) + Number(count || 0);
}

function buildNightStatsFromRows(rows, options) {
    const stats = createEmptyNightStats(options);
    const companyMap = new Map();
    const driverMap = new Map();
    const sourceDateSet = new Set();

    for (const row of rows) {
        /*
         * 完全に空の行は集計対象外です。
         */
        if (!hasData(row)) {
            stats.skippedCount++;
            continue;
        }

        stats.processedCount++;

        /*
         * N列の日時からyyyy/MM/dd形式の日付を取得します。
         *
         * 配列の13番目は元データのN列です。
         */
        const sourceDate =
            formatSourceDate(row[13]);

        sourceDateSet.add(sourceDate);

        const company =
            normalizeText(row[3]);

        /*
         * 会社名とN列日付の組み合わせごとに
         * 別の会社集計データを作成します。
         */
        const companyItem =
            ensureCompanyStats(
                companyMap,
                company,
                sourceDate
            );

        /*
         * 全時間帯総件数は、深夜時間帯かどうかに関係なく、
         * 有効な元データ1行を1件として集計します。
         */
        companyItem.allCount =
            Number(companyItem.allCount || 0) + 1;

        const idxP =
            timeIndexFromValue(
                row[15]
            ); // P列 completed_at

        const idxR =
            timeIndexFromValue(
                row[17]
            ); // R列 delivery_failed_at

        /*
         * P列とR列の両方が深夜時間帯外の場合でも、
         * 全時間帯総件数には加算済みです。
         */
        if (idxP < 0 && idxR < 0) {
            stats.skippedCount++;
            continue;
        }

        if (idxP >= 0) {
            const timeBucket =
                TIME_BUCKETS[idxP];

            companyItem.buckets[timeBucket] =
                Number(
                    companyItem.buckets[timeBucket] || 0
                ) + 1;

            stats.total.completed++;
            companyItem.completed++;

            /*
             * 配達員集計は従来どおり、
             * 会社名と配達員名で集計します。
             *
             * N列日付では分割しません。
             */
            const driverName =
                normalizeText(row[10]);

            const driverItem =
                ensureDriverStats(
                    driverMap,
                    company,
                    driverName
                );

            driverItem.total++;

            driverItem.buckets[timeBucket] =
                Number(
                    driverItem.buckets[timeBucket] || 0
                ) + 1;

            stats.insertedCount++;
        }

        if (idxR >= 0) {
            const timeBucket =
                TIME_BUCKETS[idxR];

            companyItem.buckets[timeBucket] =
                Number(
                    companyItem.buckets[timeBucket] || 0
                ) + 1;

            stats.total.failed++;
            companyItem.failed++;

            const failureReason =
                normalizeFailureReason(row[22]);

            if (failureReason) {
                addMapCount(
                    companyItem.failureReasons,
                    failureReason,
                    1
                );

                const reasonBuckets =
                    ensureFailureReasonTimeBuckets(
                        companyItem,
                        failureReason
                    );

                reasonBuckets[timeBucket] =
                    Number(
                        reasonBuckets[timeBucket] || 0
                    ) + 1;
            }

            stats.insertedCount++;
        }
    }

    /*
     * 元ファイル内で最初に出現した日付順を保持します。
     * 日付の並べ替えは行いません。
     */
    stats.sourceDates =
        Array.from(sourceDateSet);

    stats.companies =
        Array.from(companyMap.values());

    stats.drivers =
        Array.from(driverMap.values())
            .sort(sortDriverStats);

    return stats;
}

function sortDriverStats(a, b) {
    if (Number(b.total || 0) !== Number(a.total || 0)) {
        return Number(b.total || 0) - Number(a.total || 0);
    }

    const companyCompare = String(a.company).localeCompare(String(b.company), "ja");

    if (companyCompare !== 0) {
        return companyCompare;
    }

    return String(a.driver_name).localeCompare(String(b.driver_name), "ja");
}

function mergeNightStats(baseStats, chunkStats) {
    const merged =
        baseStats && baseStats.importSessionId
            ? baseStats
            : createEmptyNightStats({
                importSessionId:
                    chunkStats.importSessionId,
                importedAt:
                    chunkStats.importedAt,
                operatorEmail:
                    chunkStats.operatorEmail
            });

    merged.importSessionId =
        chunkStats.importSessionId ||
        merged.importSessionId;

    merged.importedAt =
        chunkStats.importedAt ||
        merged.importedAt;

    merged.importDate =
        formatImportDate(
            merged.importedAt
        );

    merged.operatorEmail =
        chunkStats.operatorEmail ||
        merged.operatorEmail ||
        "";

    if (!merged.total) {
        merged.total = {
            completed: 0,
            failed: 0
        };
    }

    merged.total.completed =
        Number(merged.total.completed || 0) +
        Number(chunkStats.total.completed || 0);

    merged.total.failed =
        Number(merged.total.failed || 0) +
        Number(chunkStats.total.failed || 0);

    merged.processedCount =
        Number(merged.processedCount || 0) +
        Number(chunkStats.processedCount || 0);

    merged.insertedCount =
        Number(merged.insertedCount || 0) +
        Number(chunkStats.insertedCount || 0);

    merged.skippedCount =
        Number(merged.skippedCount || 0) +
        Number(chunkStats.skippedCount || 0);

    /*
     * 複数チャンクのN列日付を、
     * 最初に出現した順序のまま統合します。
     */
    const sourceDateSet = new Set(
        Array.isArray(merged.sourceDates)
            ? merged.sourceDates
            : []
    );

    const chunkSourceDates =
        Array.isArray(chunkStats.sourceDates)
            ? chunkStats.sourceDates
            : [];

    chunkSourceDates.forEach(sourceDate => {
        sourceDateSet.add(
            String(sourceDate || "")
        );
    });

    merged.sourceDates =
        Array.from(sourceDateSet);

    /*
     * 会社名とN列日付の組み合わせをキーにします。
     */
    const companyMap =
        statsArrayToMap(
            merged.companies,
            item => buildCompanyDateKey(
                item.company,
                item.sourceDate
            )
        );

    const chunkCompanies =
        Array.isArray(chunkStats.companies)
            ? chunkStats.companies
            : [];

    chunkCompanies.forEach(company => {
        const target =
            ensureCompanyStats(
                companyMap,
                company.company,
                company.sourceDate
            );

        if (!target.failureReasonBuckets) {
            target.failureReasonBuckets = {};
        }

        target.allCount =
            Number(target.allCount || 0) +
            Number(company.allCount || 0);

        target.completed =
            Number(target.completed || 0) +
            Number(company.completed || 0);

        target.failed =
            Number(target.failed || 0) +
            Number(company.failed || 0);

        TIME_BUCKETS.forEach(label => {
            target.buckets[label] =
                Number(
                    target.buckets[label] || 0
                ) +
                Number(
                    (company.buckets || {})[label] || 0
                );
        });

        Object
            .keys(company.failureReasons || {})
            .forEach(reason => {
                addMapCount(
                    target.failureReasons,
                    reason,
                    company.failureReasons[reason]
                );
            });

        Object
            .keys(
                company.failureReasonBuckets || {}
            )
            .forEach(reason => {
                const targetReasonBuckets =
                    ensureFailureReasonTimeBuckets(
                        target,
                        reason
                    );

                const sourceReasonBuckets =
                    company
                        .failureReasonBuckets[reason] ||
                    {};

                TIME_BUCKETS.forEach(label => {
                    targetReasonBuckets[label] =
                        Number(
                            targetReasonBuckets[label] ||
                            0
                        ) +
                        Number(
                            sourceReasonBuckets[label] ||
                            0
                        );
                });
            });
    });

    /*
     * 配達員集計のキーと集計方法は変更しません。
     */
    const driverMap =
        statsArrayToMap(
            merged.drivers,
            item =>
                item.company +
                "|||" +
                item.driver_name
        );

    const chunkDrivers =
        Array.isArray(chunkStats.drivers)
            ? chunkStats.drivers
            : [];

    chunkDrivers.forEach(driver => {
        const target =
            ensureDriverStats(
                driverMap,
                driver.company,
                driver.driver_name
            );

        target.total =
            Number(target.total || 0) +
            Number(driver.total || 0);

        TIME_BUCKETS.forEach(label => {
            target.buckets[label] =
                Number(
                    target.buckets[label] || 0
                ) +
                Number(
                    (driver.buckets || {})[label] || 0
                );
        });
    });

    merged.companies =
        Array.from(companyMap.values());

    merged.drivers =
        Array.from(driverMap.values())
            .sort(sortDriverStats);

    return merged;
}

async function buildSheetStats(importSessionId) {
    const pool = getPool();
    const client = await pool.connect();

    try {
        const result = await client.query(
            `
            SELECT
              stats_json,
              imported_at,
              operator_ip
            FROM night_delivery_import_logs
            WHERE import_session_id = $1
              AND kubun = $2
            `,
            [importSessionId, KUBUN]
        );

        if (result.rows.length === 0) {
            throw new Error("該当する深夜配送の取込履歴が見つかりません。");
        }

        const stats = result.rows[0].stats_json || {};

        stats.importedAt = stats.importedAt || formatDateTime(result.rows[0].imported_at);
        stats.importDate = stats.importDate || formatImportDate(stats.importedAt);
        stats.operatorEmail = stats.operatorEmail || result.rows[0].operator_ip || "";

        stats.companies =
            Array.isArray(stats.companies)
                ? stats.companies
                : [];

        stats.drivers =
            Array.isArray(stats.drivers)
                ? stats.drivers
                : [];

        stats.sourceDates =
            Array.isArray(stats.sourceDates)
                ? stats.sourceDates
                : [];

        if (stats.sourceDates.length === 0) {
            const sourceDateSet = new Set();

            stats.companies.forEach(company => {
                sourceDateSet.add(
                    String(company.sourceDate || "")
                );
            });

            stats.sourceDates =
                Array.from(sourceDateSet);
        }

        return stats;
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

        const { searchParams } = new URL(req.url);
        const importSessionId = text(searchParams.get("importSessionId"));

        if (!importSessionId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "importSessionId がありません"
                },
                { status: 400 }
            );
        }

        const stats = await buildSheetStats(importSessionId);

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