// app/api/driver-rollcall/route.js
import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split("；")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeRow(row) {
  const record_key = normalizeText(row.record_key);
  const record_date = normalizeText(row.record_date);
  const record_date_key = normalizeText(row.record_date_key);
  const driver_name = normalizeText(row.driver_name);

  if (!record_key || !record_date || !record_date_key || !driver_name) {
    return null;
  }

  return {
    record_key,
    record_date,
    record_date_key,
    driver_name,
    sheet_name: normalizeText(row.sheet_name),
    source_row: row.source_row ? Number(row.source_row) : null,

    call_time_1: normalizeText(row.call_time_1),
    place_1: normalizeText(row.place_1),
    method_1: normalizeText(row.method_1),
    vehicle_1: normalizeText(row.vehicle_1),
    alcohol_1: normalizeText(row.alcohol_1),
    measurement_image_1: normalizeText(row.measurement_image_1),
    disease_status_1: normalizeText(row.disease_status_1),
    fatigue_status_1: normalizeText(row.fatigue_status_1),
    sleep_status_1: normalizeText(row.sleep_status_1),
    carry_items_1: normalizeArray(row.carry_items_1),
    instructions_1: normalizeArray(row.instructions_1),
    other_items_1: normalizeText(row.other_items_1),
    executor_1: normalizeText(row.executor_1),
    call_image_1: normalizeText(row.call_image_1),

    call_time_2: normalizeText(row.call_time_2),
    place_2: normalizeText(row.place_2),
    method_2: normalizeText(row.method_2),
    vehicle_2: normalizeText(row.vehicle_2),
    alcohol_2: normalizeText(row.alcohol_2),
    measurement_image_2: normalizeText(row.measurement_image_2),
    disease_status_2: normalizeText(row.disease_status_2),
    fatigue_status_2: normalizeText(row.fatigue_status_2),
    sleep_status_2: normalizeText(row.sleep_status_2),
    daily_check_2: normalizeText(row.daily_check_2),
    instructions_2: normalizeArray(row.instructions_2),
    other_items_2: normalizeText(row.other_items_2),
    executor_2: normalizeText(row.executor_2),
    call_image_2: normalizeText(row.call_image_2),

    call_time_3: normalizeText(row.call_time_3),
    place_3: normalizeText(row.place_3),
    method_3: normalizeText(row.method_3),
    vehicle_3: normalizeText(row.vehicle_3),
    alcohol_3: normalizeText(row.alcohol_3),
    measurement_image_3: normalizeText(row.measurement_image_3),
    operation_status_3: normalizeText(row.operation_status_3),
    handover_contact_3: normalizeArray(row.handover_contact_3),
    instructions_3: normalizeText(row.instructions_3),
    other_items_3: normalizeText(row.other_items_3),
  };
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const ip = getClientIp(request);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "rows 不能为空" },
        { status: 400 }
      );
    }

    const normalizedRows = rows.map(normalizeRow).filter(Boolean);
    const skipped_invalid = rows.length - normalizedRows.length;

    if (normalizedRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "有效数据为空",
          received: rows.length,
          skipped_invalid,
        },
        { status: 400 }
      );
    }

    // 大批量时分块，避免单次 SQL 过大
    const CHUNK_SIZE = 500;
    const chunks = chunkArray(normalizedRows, CHUNK_SIZE);

    let inserted = 0;

    for (const chunk of chunks) {
      const payload = JSON.stringify(chunk);

      const result = await sql`
        WITH input_rows AS (
          SELECT *
          FROM jsonb_to_recordset(${payload}::jsonb) AS x(
            record_key text,
            record_date text,
            record_date_key text,
            driver_name text,
            sheet_name text,
            source_row integer,

            call_time_1 text,
            place_1 text,
            method_1 text,
            vehicle_1 text,
            alcohol_1 text,
            measurement_image_1 text,
            disease_status_1 text,
            fatigue_status_1 text,
            sleep_status_1 text,
            carry_items_1 jsonb,
            instructions_1 jsonb,
            other_items_1 text,
            executor_1 text,
            call_image_1 text,

            call_time_2 text,
            place_2 text,
            method_2 text,
            vehicle_2 text,
            alcohol_2 text,
            measurement_image_2 text,
            disease_status_2 text,
            fatigue_status_2 text,
            sleep_status_2 text,
            daily_check_2 text,
            instructions_2 jsonb,
            other_items_2 text,
            executor_2 text,
            call_image_2 text,

            call_time_3 text,
            place_3 text,
            method_3 text,
            vehicle_3 text,
            alcohol_3 text,
            measurement_image_3 text,
            operation_status_3 text,
            handover_contact_3 jsonb,
            instructions_3 text,
            other_items_3 text
          )
        ),
        inserted_rows AS (
          INSERT INTO driver_rollcall_records (
            record_key,
            record_date,
            record_date_key,
            driver_name,
            sheet_name,
            source_row,

            call_time_1,
            place_1,
            method_1,
            vehicle_1,
            alcohol_1,
            measurement_image_1,
            disease_status_1,
            fatigue_status_1,
            sleep_status_1,
            carry_items_1,
            instructions_1,
            other_items_1,
            executor_1,
            call_image_1,

            call_time_2,
            place_2,
            method_2,
            vehicle_2,
            alcohol_2,
            measurement_image_2,
            disease_status_2,
            fatigue_status_2,
            sleep_status_2,
            daily_check_2,
            instructions_2,
            other_items_2,
            executor_2,
            call_image_2,

            call_time_3,
            place_3,
            method_3,
            vehicle_3,
            alcohol_3,
            measurement_image_3,
            operation_status_3,
            handover_contact_3,
            instructions_3,
            other_items_3,

            created_ip,
            updated_ip
          )
          SELECT
            record_key,
            record_date::date,
            record_date_key,
            driver_name,
            sheet_name,
            source_row,

            call_time_1,
            place_1,
            method_1,
            vehicle_1,
            alcohol_1,
            measurement_image_1,
            disease_status_1,
            fatigue_status_1,
            sleep_status_1,
            COALESCE(carry_items_1, '[]'::jsonb),
            COALESCE(instructions_1, '[]'::jsonb),
            other_items_1,
            executor_1,
            call_image_1,

            call_time_2,
            place_2,
            method_2,
            vehicle_2,
            alcohol_2,
            measurement_image_2,
            disease_status_2,
            fatigue_status_2,
            sleep_status_2,
            daily_check_2,
            COALESCE(instructions_2, '[]'::jsonb),
            other_items_2,
            executor_2,
            call_image_2,

            call_time_3,
            place_3,
            method_3,
            vehicle_3,
            alcohol_3,
            measurement_image_3,
            operation_status_3,
            COALESCE(handover_contact_3, '[]'::jsonb),
            instructions_3,
            other_items_3,

            ${ip},
            ${ip}
          FROM input_rows
          ON CONFLICT (record_key) DO NOTHING
          RETURNING record_key
        )
        SELECT COUNT(*)::int AS inserted_count
        FROM inserted_rows
      `;

      inserted += result[0]?.inserted_count ?? 0;
    }

    return NextResponse.json({
      success: true,
      received: rows.length,
      valid: normalizedRows.length,
      skipped_invalid,
      inserted,
      skipped_duplicate: normalizedRows.length - inserted,
    });
  } catch (err) {
    console.error("❌ POST /api/driver-rollcall error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}