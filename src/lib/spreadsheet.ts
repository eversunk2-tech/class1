/**
 * 브라우저에서 표 파일(.xlsx / .csv)을 읽는 최소 파서.
 *
 * `scripts/import-users.mjs`의 CSV·XLSX 파서를 브라우저용으로 옮긴 것이다(같은 규칙·같은 한계).
 * 새 의존성을 넣지 않기 위해 zip 해제는 표준 `DecompressionStream("deflate-raw")`을 쓴다.
 *
 * 한계(엑셀 파일을 만든 쪽 문제라 여기서 고칠 수 없는 것)
 * - 첫 번째 시트만 읽는다.
 * - 숫자 서식 셀은 엑셀이 이미 앞자리 0을 지웠을 수 있다 → `numericRefs`로 알려 주고 화면에서 경고한다.
 * - 날짜·수식 셀은 화면에 보이는 값이 아니라 저장된 값(일련번호·계산 결과)이 나온다. 아이디/비밀번호에는 쓰지 않는다.
 */

export type SheetTable = {
  /** 완전히 빈 줄을 뺀 표. rows[0]이 제목 줄. */
  rows: string[][];
  /** 숫자 서식으로 저장된 셀 주소(예: "A2"). 앞자리 0이 사라졌을 수 있는 칸. */
  numericRefs: string[];
};

export class SpreadsheetError extends Error {}

// ─────────────────────────────────────────────
// CSV (RFC 4180: 따옴표, "" 이스케이프, 따옴표 안 줄바꿈, CRLF, BOM)
// ─────────────────────────────────────────────
export function parseCsv(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

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
    } else if (c === "," || c === "\t") {
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
  if (inQuotes) throw new SpreadsheetError("닫히지 않은 따옴표가 있습니다.");
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** 엑셀에서 저장한 CSV는 한국어 Windows에서 CP949일 수 있다. UTF-8로 못 읽으면 euc-kr로 다시 읽는다. */
function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder("euc-kr").decode(buffer);
    } catch {
      // euc-kr을 지원하지 않는 환경이면 깨진 글자를 감수하고 UTF-8로 읽는다.
      return new TextDecoder("utf-8").decode(buffer);
    }
  }
}

// ─────────────────────────────────────────────
// XLSX (zip + XML을 직접 해석. 첫 번째 시트만)
// ─────────────────────────────────────────────
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new SpreadsheetError(
      "이 브라우저에서는 엑셀 파일을 열 수 없습니다. 최신 Chrome·Safari를 쓰거나, 엑셀에서 CSV로 저장해 올려 주세요.",
    );
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

type ZipReader = (name: string) => Promise<string | null>;

/** zip 중앙 디렉터리를 읽어 "이름 → 내용(UTF-8 문자열)" 함수를 만든다. */
async function openZip(buffer: ArrayBuffer): Promise<ZipReader> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const u32 = (p: number) => view.getUint32(p, true);
  const u16 = (p: number) => view.getUint16(p, true);

  // End of central directory 레코드를 뒤에서부터 찾는다(주석 최대 65535바이트).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new SpreadsheetError("엑셀(.xlsx) 파일이 아닙니다. 파일을 다시 확인해 주세요.");

  const count = u16(eocd + 10);
  let p = u32(eocd + 16);
  const entries = new Map<string, { method: number; compSize: number; localOffset: number }>();
  const nameDecoder = new TextDecoder("utf-8");
  for (let n = 0; n < count; n++) {
    if (u32(p) !== 0x02014b50) throw new SpreadsheetError("엑셀 파일이 손상되었습니다.");
    const method = u16(p + 10);
    const compSize = u32(p + 20);
    const nameLen = u16(p + 28);
    const extraLen = u16(p + 30);
    const commentLen = u16(p + 32);
    const localOffset = u32(p + 42);
    const name = nameDecoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }

  const contentDecoder = new TextDecoder("utf-8");
  return async (name: string) => {
    const e = entries.get(name);
    if (!e) return null;
    const start = e.localOffset + 30 + u16(e.localOffset + 26) + u16(e.localOffset + 28);
    const data = bytes.subarray(start, start + e.compSize);
    if (e.method === 0) return contentDecoder.decode(data);
    if (e.method === 8) return contentDecoder.decode(await inflateRaw(data));
    throw new SpreadsheetError(`지원하지 않는 압축 방식(${e.method})입니다. 엑셀에서 다시 저장해 주세요.`);
  };
}

function xmlText(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/** 셀 안의 모든 <t> 텍스트를 이어 붙인다(서식이 섞인 rich text 포함). */
function joinT(xml: string): string {
  return Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g), (m) => xmlText(m[1] ?? "")).join("");
}

/** "B12" → 1 (0부터 세는 열 번호) */
export function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function parseXlsx(buffer: ArrayBuffer): Promise<SheetTable> {
  const read = await openZip(buffer);

  const shared: string[] = [];
  const ssXml = await read("xl/sharedStrings.xml");
  if (ssXml) for (const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(joinT(m[1]));

  // 첫 번째 시트 경로: workbook.xml의 첫 sheet → rels에서 target 찾기
  const wb = (await read("xl/workbook.xml")) ?? "";
  const rid = wb.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const rels = (await read("xl/_rels/workbook.xml.rels")) ?? "";
  let target =
    rid && (rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? undefined);
  if (!target && rid) target = rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target}`) : "xl/worksheets/sheet1.xml";
  const sheet = await read(sheetPath);
  if (!sheet) throw new SpreadsheetError("첫 번째 시트를 찾을 수 없습니다.");

  const rows: string[][] = [];
  const numericRefs: string[] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
    const row: string[] = [];
    for (const cm of (rm[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const cellBody = cm[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = cellBody.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = joinT(cellBody);
      else if (type === "str") value = xmlText(v ?? "");
      else if (v !== undefined) {
        value = xmlText(v);
        if (type === undefined || type === "n") {
          // 숫자 셀: 1.2E+7 같은 표기를 정수 문자열로 되돌린다.
          if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value) && Number.isInteger(Number(value))) {
            value = BigInt(Number(value)).toString();
          }
          if (ref) numericRefs.push(ref);
        }
      }
      const at = ref ? colIndex(ref) : row.length;
      row[at] = value;
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  return { rows: rows.filter((r) => r.some((v) => String(v).trim() !== "")), numericRefs };
}

/** 파일 하나를 표로 읽는다. 확장자로 .xlsx / 그 밖(CSV·TSV)을 가른다. */
export async function readSheetFile(file: File): Promise<SheetTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) {
    throw new SpreadsheetError("예전 형식(.xls)은 읽을 수 없습니다. 엑셀에서 .xlsx 또는 CSV로 저장해 주세요.");
  }
  const buffer = await file.arrayBuffer();
  if (name.endsWith(".xlsx")) return parseXlsx(buffer);
  return { rows: parseCsv(decodeText(buffer)), numericRefs: [] };
}
