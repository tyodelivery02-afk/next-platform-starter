import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";
import { v2 as cloudinary } from "cloudinary";

const sql = neon();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

function isDataImage(value) {
    return typeof value === "string" && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

async function uploadImageToCloudinary(imageData, folder, publicIdBase) {
    if (!isDataImage(imageData)) {
        return { url: "", public_id: "" };
    }

    const result = await cloudinary.uploader.upload(imageData, {
        folder,
        public_id: publicIdBase,
        resource_type: "image",
        overwrite: true,
        invalidate: true,
    });

    return {
        url: result.secure_url || "",
        public_id: result.public_id || "",
    };
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
        measurement_image_1: row.measurement_image_1 || "",
        measurement_image_1_public_id: "",
        disease_status_1: normalizeText(row.disease_status_1),
        fatigue_status_1: normalizeText(row.fatigue_status_1),
        sleep_status_1: normalizeText(row.sleep_status_1),
        carry_items_1: normalizeArray(row.carry_items_1),
        instructions_1: normalizeArray(row.instructions_1),
        other_items_1: normalizeText(row.other_items_1),
        executor_1: normalizeText(row.executor_1),
        call_image_1: row.call_image_1 || "",
        call_image_1_public_id: "",

        call_time_2: normalizeText(row.call_time_2),
        place_2: normalizeText(row.place_2),
        method_2: normalizeText(row.method_2),
        vehicle_2: normalizeText(row.vehicle_2),
        alcohol_2: normalizeText(row.alcohol_2),
        measurement_image_2: row.measurement_image_2 || "",
        measurement_image_2_public_id: "",
        disease_status_2: normalizeText(row.disease_status_2),
        fatigue_status_2: normalizeText(row.fatigue_status_2),
        sleep_status_2: normalizeText(row.sleep_status_2),
        daily_check_2: normalizeText(row.daily_check_2),
        instructions_2: normalizeArray(row.instructions_2),
        other_items_2: normalizeText(row.other_items_2),
        executor_2: normalizeText(row.executor_2),

        call_time_3: normalizeText(row.call_time_3),
        place_3: normalizeText(row.place_3),
        method_3: normalizeText(row.method_3),
        vehicle_3: normalizeText(row.vehicle_3),
        alcohol_3: normalizeText(row.alcohol_3),
        measurement_image_3: row.measurement_image_3 || "",
        measurement_image_3_public_id: "",
        operation_status_3: normalizeText(row.operation_status_3),
        handover_contact_3: normalizeArray(row.handover_contact_3),
        instructions_3: normalizeText(row.instructions_3),
        other_items_3: normalizeText(row.other_items_3),
        executor_3: normalizeText(row.executor_3),
    };
}

async function enrichRowWithUploadedImages(row) {
    const folder = `driver-rollcall/${row.record_date_key}/${row.record_key}`;

    const [
        measurement1,
        call1,
        measurement2,
        measurement3,
    ] = await Promise.all([
        uploadImageToCloudinary(row.measurement_image_1, folder, "measurement_image_1"),
        uploadImageToCloudinary(row.call_image_1, folder, "call_image_1"),
        uploadImageToCloudinary(row.measurement_image_2, folder, "measurement_image_2"),
        uploadImageToCloudinary(row.measurement_image_3, folder, "measurement_image_3"),
    ]);

    return {
        ...row,
        measurement_image_1: measurement1.url,
        measurement_image_1_public_id: measurement1.public_id,

        call_image_1: call1.url,
        call_image_1_public_id: call1.public_id,

        measurement_image_2: measurement2.url,
        measurement_image_2_public_id: measurement2.public_id,

        measurement_image_3: measurement3.url,
        measurement_image_3_public_id: measurement3.public_id,
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

        const CHUNK_SIZE = 100;
        const chunks = chunkArray(normalizedRows, CHUNK_SIZE);

        let inserted = 0;
        let uploaded_images = 0;

        for (const rawChunk of chunks) {
            const uploadedChunk = await Promise.all(
                rawChunk.map(enrichRowWithUploadedImages)
            );

            uploaded_images += uploadedChunk.reduce((sum, row) => {
                let c = 0;
                if (row.measurement_image_1) c += 1;
                if (row.call_image_1) c += 1;
                if (row.measurement_image_2) c += 1;
                if (row.measurement_image_3) c += 1;
                return sum + c;
            }, 0);

            const payload = JSON.stringify(uploadedChunk);

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
            measurement_image_1_public_id text,
            disease_status_1 text,
            fatigue_status_1 text,
            sleep_status_1 text,
            carry_items_1 jsonb,
            instructions_1 jsonb,
            other_items_1 text,
            executor_1 text,
            call_image_1 text,
            call_image_1_public_id text,

            call_time_2 text,
            place_2 text,
            method_2 text,
            vehicle_2 text,
            alcohol_2 text,
            measurement_image_2 text,
            measurement_image_2_public_id text,
            disease_status_2 text,
            fatigue_status_2 text,
            sleep_status_2 text,
            daily_check_2 text,
            instructions_2 jsonb,
            other_items_2 text,
            executor_2 text,

            call_time_3 text,
            place_3 text,
            method_3 text,
            vehicle_3 text,
            alcohol_3 text,
            measurement_image_3 text,
            measurement_image_3_public_id text,
            operation_status_3 text,
            handover_contact_3 jsonb,
            instructions_3 text,
            other_items_3 text,
            executor_3 text
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
            measurement_image_1_public_id,
            disease_status_1,
            fatigue_status_1,
            sleep_status_1,
            carry_items_1,
            instructions_1,
            other_items_1,
            executor_1,
            call_image_1,
            call_image_1_public_id,

            call_time_2,
            place_2,
            method_2,
            vehicle_2,
            alcohol_2,
            measurement_image_2,
            measurement_image_2_public_id,
            disease_status_2,
            fatigue_status_2,
            sleep_status_2,
            daily_check_2,
            instructions_2,
            other_items_2,
            executor_2,

            call_time_3,
            place_3,
            method_3,
            vehicle_3,
            alcohol_3,
            measurement_image_3,
            measurement_image_3_public_id,
            operation_status_3,
            handover_contact_3,
            instructions_3,
            other_items_3,
            executor_3,

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
            measurement_image_1_public_id,
            disease_status_1,
            fatigue_status_1,
            sleep_status_1,
            COALESCE(carry_items_1, '[]'::jsonb),
            COALESCE(instructions_1, '[]'::jsonb),
            other_items_1,
            executor_1,
            call_image_1,
            call_image_1_public_id,

            call_time_2,
            place_2,
            method_2,
            vehicle_2,
            alcohol_2,
            measurement_image_2,
            measurement_image_2_public_id,
            disease_status_2,
            fatigue_status_2,
            sleep_status_2,
            daily_check_2,
            COALESCE(instructions_2, '[]'::jsonb),
            other_items_2,
            executor_2,

            call_time_3,
            place_3,
            method_3,
            vehicle_3,
            alcohol_3,
            measurement_image_3,
            measurement_image_3_public_id,
            operation_status_3,
            COALESCE(handover_contact_3, '[]'::jsonb),
            instructions_3,
            other_items_3,
            executor_3,

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
            uploaded_images,
        });
    } catch (err) {
        console.error("POST /api/driver-rollcall error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "unknown error" },
            { status: 500 }
        );
    }
}