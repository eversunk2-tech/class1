#!/usr/bin/env node
/**
 * 사전 발급 계정 일괄 생성 스크립트 (spec §5.1) — 관리자가 로컬에서 1회 실행한다.
 *
 * 준비
 *   1. 구글시트를 CSV(파일 > 다운로드 > CSV) 또는 엑셀 .xlsx로 내보낸다. .xlsx는 첫 번째 시트만 읽는다.
 *      열 이름: id/아이디/학번, password/비밀번호/초기비밀번호 (선택: name/이름)
 *      파일에는 비밀번호가 들어 있으므로 커밋하지 말고, 작업 후 삭제하는 것을 권장한다.
 *   2. .env.local 에 아래 두 값을 넣는다(서비스 롤 키는 Supabase 대시보드 > Project Settings > API).
 *        NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=<service role key>   ← 절대 공유/커밋 금지
 *
 * 사용법 (프로젝트 루트에서)
 *   node scripts/import-users.mjs <CSV 또는 XLSX 경로> [옵션]
 *
 *   node scripts/import-users.mjs ~/Downloads/users.xlsx --dry-run
 *
 *   node scripts/import-users.mjs scripts/users.csv --dry-run   # 확인만(네트워크 요청 없음)
 *   node scripts/import-users.mjs scripts/users.csv             # 실제 생성
 *
 * 옵션
 *   --dry-run               계정을 만들지 않고 CSV 검사 결과와 생성 예정 목록만 출력
 *   --id-column <이름>      아이디 열 이름 (기본: id)
 *   --password-column <이름> 비밀번호 열 이름 (기본: password)
 *   --name-column <이름>    이름 열 이름 (기본: name, 없으면 무시)
 *   --env <경로>            환경변수 파일 경로 (기본: .env.local)
 *   -h, --help              도움말
 *
 * 동작
 *   - 아이디에 @ 가 없으면 {아이디}@class1.local 로 바꿔 이메일로 사용한다(로그인 화면과 같은 규칙).
 *   - email_confirm: true 로 생성하고, name 열 값은 user_metadata.full_name 에 넣는다
 *     (handle_new_user 트리거가 profiles.display_name 으로 복사).
 *   - 이름이 50자(profiles.display_name 제한)를 넘으면 앞 50자만 쓰고 경고를 출력한다.
 *   - 이미 있는 계정은 건너뛰고, 마지막에 생성/건너뜀/실패 수를 요약한다.
 *   - 비밀번호와 서비스 롤 키는 화면에 출력하지 않는다.
 *   - 관리자 지정은 이 스크립트가 하지 않는다. SQL Editor에서
 *       update public.profiles set role = 'admin' where id = '<auth.users id>';
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { inflateRawSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

const LOGIN_EMAIL_DOMAIN = "class1.local"; // src/lib/auth.ts 의 LOGIN_EMAIL_DOMAIN 과 같아야 한다.
const MIN_PASSWORD_LENGTH = 6; // Supabase Auth 기본 최소 길이

function printHelp() {
  const src = readFileSync(new URL(import.meta.url), "utf8");
  const header = src.slice(src.indexOf("/**") + 3, src.indexOf("*/"));
  console.log(header.replace(/^ \* ?/gm, "").trim());
}

function fail(message) {
  console.error(`오류: ${message}`);
  process.exit(1);
}

// ─────────────────────────────────────────────
// 인자
// ─────────────────────────────────────────────
let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      "id-column": { type: "string", default: "id" },
      "password-column": { type: "string", default: "password" },
      "name-column": { type: "string", default: "name" },
      env: { type: "string", default: ".env.local" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
} catch (e) {
  fail(`${e.message}\n도움말: node scripts/import-users.mjs --help`);
}

const { values: opts, positionals } = args;
if (opts.help) {
  printHelp();
  process.exit(0);
}
if (positionals.length !== 1) fail("CSV 또는 XLSX 파일 경로를 하나 지정하세요. 예: node scripts/import-users.mjs users.xlsx --dry-run");

const csvPath = resolve(positionals[0]);
if (!existsSync(csvPath)) fail(`파일을 찾을 수 없습니다: ${csvPath}`);

// ─────────────────────────────────────────────
// CSV 파서 (RFC 4180: 따옴표, "" 이스케이프, 따옴표 안 줄바꿈, CRLF, BOM)
// ─────────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (inQuotes) throw new Error("닫히지 않은 따옴표가 있습니다.");
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // 완전히 빈 줄 제거
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

// ─────────────────────────────────────────────
// XLSX 파서 (첫 번째 시트만, 추가 패키지 없이 zip + XML 직접 해석)
// ─────────────────────────────────────────────
function unzipEntries(buf) {
  // End of central directory 레코드를 뒤에서부터 찾는다.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("xlsx(zip) 형식이 아닙니다.");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip 중앙 디렉터리가 손상되었습니다.");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    entries.set(name, { method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return (name) => {
    const e = entries.get(name);
    if (!e) return null;
    const start = e.localOffset + 30 + buf.readUInt16LE(e.localOffset + 26) + buf.readUInt16LE(e.localOffset + 28);
    const data = buf.subarray(start, start + e.compSize);
    if (e.method === 0) return data.toString("utf8");
    if (e.method === 8) return inflateRawSync(data).toString("utf8");
    throw new Error(`지원하지 않는 zip 압축 방식(${e.method})`);
  };
}

function xmlText(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/** 셀 안의 모든 <t> 텍스트를 이어 붙인다(서식이 섞인 rich text 포함). */
function joinT(xml) {
  return Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g), (m) => xmlText(m[1] ?? "")).join("");
}

function colIndex(ref) {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseXlsx(buf) {
  const read = unzipEntries(buf);
  const shared = [];
  const ssXml = read("xl/sharedStrings.xml");
  if (ssXml) for (const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(joinT(m[1]));

  // 첫 번째 시트 경로: workbook.xml의 첫 sheet → rels에서 target 찾기
  const wb = read("xl/workbook.xml") ?? "";
  const rid = wb.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const rels = read("xl/_rels/workbook.xml.rels") ?? "";
  let target = rid && rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1];
  if (!target && rid) target = rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target}`) : "xl/worksheets/sheet1.xml";
  const sheet = read(sheetPath);
  if (!sheet) throw new Error("첫 번째 시트를 찾을 수 없습니다.");

  const rows = [];
  const numericCells = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
    const row = [];
    for (const cm of (rm[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = joinT(body);
      else if (v !== undefined) {
        value = xmlText(v);
        if (type === undefined || type === "n") {
          // 숫자 셀: 1.2E+7 같은 표기를 정수 문자열로. 앞자리 0은 엑셀이 이미 지웠을 수 있다(경고).
          if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value) && Number.isInteger(Number(value))) value = BigInt(Number(value)).toString();
          if (ref) numericCells.push(ref);
        }
      }
      row[ref ? colIndex(ref) : row.length] = value;
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  return { rows: rows.filter((r) => r.some((v) => String(v).trim() !== "")), numericCells };
}

// ─────────────────────────────────────────────
// .env 파일 읽기 (값은 출력하지 않는다)
// ─────────────────────────────────────────────
function readEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!m) continue;
    let value = (m[2] ?? "").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    env[m[1]] = value;
  }
  return env;
}

function toEmail(id) {
  const trimmed = id.trim();
  return (trimmed.includes("@") ? trimmed : `${trimmed}@${LOGIN_EMAIL_DOMAIN}`).toLowerCase();
}

// ─────────────────────────────────────────────
// CSV 검사
// ─────────────────────────────────────────────
let table;
let numericCells = [];
const isXlsx = /\.xlsx$/i.test(csvPath);
try {
  if (isXlsx) ({ rows: table, numericCells } = parseXlsx(readFileSync(csvPath)));
  else table = parseCsv(readFileSync(csvPath, "utf8"));
} catch (e) {
  fail(`${isXlsx ? "엑셀" : "CSV"} 파일을 읽지 못했습니다: ${e.message}`);
}
if (table.length < 2) fail("파일에 헤더와 데이터 행이 필요합니다.");

const header = table[0].map((h) => String(h).replace(/\s+/g, "").toLowerCase());
// 옵션으로 지정하지 않았으면 한국어 열 이름도 찾는다.
const ALIASES = {
  "id-column": ["id", "아이디", "학번", "loginid"],
  "password-column": ["password", "비밀번호", "초기비밀번호", "초기비번", "비번"],
  "name-column": ["name", "이름", "성명"],
};
const col = (option) => {
  const given = String(opts[option]).replace(/\s+/g, "").toLowerCase();
  const isDefault = given === ALIASES[option][0];
  for (const cand of isDefault ? ALIASES[option] : [given]) {
    const i = header.indexOf(cand);
    if (i >= 0) return i;
  }
  return -1;
};
const idIdx = col("id-column");
const pwIdx = col("password-column");
const nameIdx = col("name-column");
// 숫자 셀로 저장된 아이디/비밀번호는 앞자리 0이 사라졌을 수 있다.
const numericIdPw = numericCells.filter((ref) => [idIdx, pwIdx].includes(colIndex(ref)) && !/^[A-Z]+1$/.test(ref));
if (numericIdPw.length) {
  console.log(
    `주의: 숫자 형식 셀 ${numericIdPw.length}개(${numericIdPw.slice(0, 6).join(", ")}${numericIdPw.length > 6 ? " …" : ""}). ` +
      "엑셀에서 0으로 시작하던 값이면 앞자리 0이 빠졌을 수 있으니 원본과 비교하세요.",
  );
}
if (idIdx < 0) fail(`아이디 열 "${opts["id-column"]}"이 없습니다. 헤더: ${table[0].join(", ")} (--id-column 으로 지정)`);
if (pwIdx < 0) fail(`비밀번호 열 "${opts["password-column"]}"이 없습니다. 헤더: ${table[0].join(", ")} (--password-column 으로 지정)`);

const MAX_NAME_LENGTH = 50; // profiles.display_name check 제약과 같음
const users = [];
const invalid = [];
const truncated = [];
const seen = new Set();
table.slice(1).forEach((cells, i) => {
  const line = i + 2; // 헤더가 1행
  const id = (cells[idIdx] ?? "").trim();
  const password = cells[pwIdx] ?? "";
  let name = nameIdx >= 0 ? (cells[nameIdx] ?? "").trim() : "";
  // char_length와 같게 코드 포인트 단위로 센다.
  if (Array.from(name).length > MAX_NAME_LENGTH) {
    name = Array.from(name).slice(0, MAX_NAME_LENGTH).join("").trim();
    truncated.push(line);
  }
  if (!id) return invalid.push({ line, reason: "아이디가 비어 있음" });
  const email = toEmail(id);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid.push({ line, reason: `이메일 형식이 아님(${email})` });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return invalid.push({ line, reason: `비밀번호가 ${MIN_PASSWORD_LENGTH}자 미만(${email})` });
  }
  if (seen.has(email)) return invalid.push({ line, reason: `CSV 안에서 중복(${email})` });
  seen.add(email);
  users.push({ line, email, password, name });
});

console.log(`파일: ${csvPath}`);
console.log(`유효한 행 ${users.length}개, 잘못된 행 ${invalid.length}개`);
for (const { line, reason } of invalid) console.log(`  - ${line}행: ${reason}`);
if (truncated.length) {
  console.log(`이름이 ${MAX_NAME_LENGTH}자를 넘어 앞 ${MAX_NAME_LENGTH}자만 사용하는 행: ${truncated.join(", ")}`);
}

if (opts["dry-run"]) {
  console.log("\n[dry-run] 계정을 만들지 않습니다. 생성 예정:");
  for (const u of users) console.log(`  + ${u.email}${u.name ? ` (${u.name})` : ""}`);
  console.log("\n실제로 만들려면 --dry-run 없이 다시 실행하세요. (이미 있는 계정은 실행 시 건너뜁니다)");
  process.exit(0);
}

if (!users.length) fail("생성할 계정이 없습니다.");

// ─────────────────────────────────────────────
// Supabase 관리자 클라이언트 (Node 전용, 브라우저 번들과 무관)
// ─────────────────────────────────────────────
const fileEnv = readEnvFile(resolve(opts.env));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !/^https?:\/\//.test(url)) fail(`${opts.env}에 NEXT_PUBLIC_SUPABASE_URL이 없거나 올바르지 않습니다.`);
if (!serviceKey || serviceKey === "your-service-role-key") {
  fail(`${opts.env}에 SUPABASE_SERVICE_ROLE_KEY가 없습니다. (주석 처리되어 있다면 # 을 지우세요)`);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

/** 이미 있는 계정의 이메일 목록 (페이지 단위 조회) */
async function listExistingEmails() {
  const emails = new Set();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const u of data.users) if (u.email) emails.add(u.email.toLowerCase());
    if (data.users.length < perPage) break;
  }
  return emails;
}

let existing;
try {
  existing = await listExistingEmails();
} catch (e) {
  fail(`기존 계정 목록을 가져오지 못했습니다: ${e.message ?? e} (URL/서비스 롤 키 확인)`);
}

const result = { created: [], skipped: [], failed: [] };
for (const u of users) {
  if (existing.has(u.email)) {
    result.skipped.push(u.email);
    console.log(`  = ${u.email} 이미 있음, 건너뜀`);
    continue;
  }
  const { error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: u.name ? { full_name: u.name } : {},
  });
  if (!error) {
    result.created.push(u.email);
    console.log(`  + ${u.email} 생성`);
  } else if (error.code === "email_exists" || /already (been )?registered|already exists/i.test(error.message)) {
    result.skipped.push(u.email);
    console.log(`  = ${u.email} 이미 있음, 건너뜀`);
  } else {
    // 오류 메시지에는 비밀번호가 포함되지 않는다.
    result.failed.push({ email: u.email, message: error.message });
    console.log(`  ! ${u.email} 실패: ${error.message}`);
  }
}

console.log("\n요약");
console.log(`  생성   ${result.created.length}`);
console.log(`  건너뜀 ${result.skipped.length}`);
console.log(`  실패   ${result.failed.length}`);
console.log(`  잘못된 행 ${invalid.length}`);
if (result.failed.length) process.exitCode = 1;
