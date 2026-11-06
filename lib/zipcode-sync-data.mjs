import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import csv from 'csv-parser';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';

export const SOURCES = {
  zipcode: {
    url: 'https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip',
    filename: 'utf_ken_all.csv', encoding: 'utf8', minimum: 100000, maximum: 180000,
    columns: ['local_government_code', 'old_zip_code', 'zip_code', 'prefecture_kana', 'city_kana', 'town_kana', 'prefecture_kanji', 'city_kanji', 'town_kanji', 'is_multiple_zip', 'is_address_with_banchi', 'is_has_chome', 'is_multiple_town', 'update_status', 'update_reason'],
    flags: [9, 10, 11, 12, 13, 14],
  },
  jigyosyo_zipcode: {
    url: 'https://www.post.japanpost.jp/service/search/zipcode/download/office/zip/jigyosyo.zip',
    filename: 'jigyosyo.csv', encoding: 'shift_jis', minimum: 15000, maximum: 50000,
    columns: ['local_government_code', 'office_name_kana', 'office_name_kanji', 'prefecture_kanji', 'city_kanji', 'town_kanji', 'street_address_kanji', 'zip_code', 'old_zip_code', 'post_office_name', 'type_flag', 'multiple_flag', 'status_flag'],
    flags: [10, 11, 12],
  },
};

export async function parsePostalCSV(buffer, kind) {
  const source = SOURCES[kind];
  if (!source) throw new Error('Unknown postal source');
  const text = iconv.decode(buffer, source.encoding).replace(/^\uFEFF/, '');
  if (text.includes('\uFFFD')) throw new Error('郵便番号データの文字コードが不正です。');
  const parser = Readable.from([text]).pipe(csv({ headers: source.columns, strict: true }));
  const seen = new Set();
  const rows = [];
  for await (const record of parser) {
    const row = source.columns.map(column => record[column]);
    const zip = row[kind === 'zipcode' ? 2 : 7];
    if (!/^\d{5}$/.test(row[0]) || !/^\d{7}$/.test(zip) || +row[0].slice(0, 2) < 1 || +row[0].slice(0, 2) > 47) {
      throw new Error('郵便番号または自治体コードが不正です。');
    }
    for (const index of source.flags) {
      const allowed = kind === 'zipcode' ? (index < 13 ? /^[01]$/ : index === 13 ? /^[012]$/ : /^[0-6]$/) : index === 10 ? /^[01]$/ : index === 11 ? /^[0-3]$/ : /^[015]$/;
      if (!allowed.test(row[index])) throw new Error('郵便番号データの区分値が不正です。');
    }
    if (!(kind === 'zipcode' ? row[6] && row[7] && row[8] : row[2] && row[3] && row[4])) throw new Error('住所情報が不足しています。');
    const key = JSON.stringify(row);
    if (!seen.has(key)) { seen.add(key); rows.push(row); }
    if (rows.length > source.maximum) throw new Error('郵便番号データ件数が想定範囲外です。');
  }
  return rows;
}

export function validatePostalCoverage(rows, kind, previousCount = 0) {
  const source = SOURCES[kind];
  const prefectures = new Set(rows.map(row => row[0].slice(0, 2)));
  if (rows.length < source.minimum || rows.length > source.maximum || prefectures.size !== 47 || (previousCount && rows.length < previousCount * 0.9)) {
    throw new Error('全国データの件数・都道府県を確認できないため、同期を中止しました。');
  }
}

export async function downloadPostalSource(kind, fetcher = fetch) {
  const source = SOURCES[kind];
  const res = await fetcher(source.url, { signal: AbortSignal.timeout(45000), cache: 'no-store', redirect: 'error' });
  if (!res.ok) throw new Error('日本郵便のデータを取得できませんでした。');
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > 12 * 1024 * 1024) throw new Error('ダウンロードサイズが想定範囲外です。');
    chunks.push(chunk);
  }
  const zip = new AdmZip(Buffer.concat(chunks));
  const entry = zip.getEntries().find(item => item.entryName.toLowerCase() === source.filename);
  if (!entry || entry.header.size > 80 * 1024 * 1024) throw new Error('郵便番号ファイルの構成が不正です。');
  const buffer = entry.getData();
  return { hash: createHash('sha256').update(buffer).digest('hex'), buffer, modified: res.headers.get('last-modified') };
}

export function csvLine(row) {
  return row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',') + '\n';
}
