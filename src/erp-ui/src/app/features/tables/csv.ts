import { CustomTableColumn, CustomTableColumnType } from '../../../../projects/api/src/lib';

export type DecimalSeparator = ',' | '.';

export interface CsvRecord {
  /** Zeile in der Datei (1-basiert), in der der Datensatz beginnt. */
  line: number;
  cells: string[];
}

export interface CsvFormat {
  delimiter: string;
  decimal: DecimalSeparator;
}

/** Übliche Trennzeichen; "Anderes" erlaubt ein beliebiges Zeichen. */
export const DELIMITERS: { value: string; label: string }[] = [
  { value: ';', label: 'Semikolon ( ; )' },
  { value: ',', label: 'Komma ( , )' },
  { value: '\t', label: 'Tabulator' },
  { value: '|', label: 'Senkrechter Strich ( | )' },
];

/** Excel (deutsch) und das international übliche Format. */
export const EXCEL_FORMAT: CsvFormat = { delimiter: ';', decimal: ',' };
export const STANDARD_FORMAT: CsvFormat = { delimiter: ',', decimal: '.' };

/**
 * Liest den Dateiinhalt als UTF-8; ist die Datei kein gültiges UTF-8 (typisch für ältere
 * Excel-Exporte), als Windows-1252.
 */
export function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** Errät das Trennzeichen aus der ersten Zeile; ohne Treffer Semikolon. */
export function detectDelimiter(text: string): string {
  let best = ';';
  let bestCount = 0;
  for (const { value } of DELIMITERS) {
    const count = countInFirstLine(text, value);
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Zerlegt CSV nach RFC 4180: Felder in Anführungszeichen dürfen Trennzeichen, Zeilenumbrüche
 * und verdoppelte Anführungszeichen enthalten. Leere Zeilen werden übersprungen.
 */
export function parseCsv(text: string, delimiter: string): CsvRecord[] {
  return splitRecords(text, delimiter).filter((r) => r.cells.some((c) => c.trim() !== ''));
}

function splitRecords(text: string, delimiter: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        if (char === '\n') line++;
        cell += char;
      }
      continue;
    }

    // Auch nach Leerzeichen ("a; "b"") beginnt ein Feld in Anführungszeichen.
    if (char === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (char === delimiter) {
      cells.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      cells.push(cell);
      records.push({ line: recordLine, cells });
      cells = [];
      cell = '';
      line++;
      recordLine = line;
    } else {
      cell += char;
    }
  }

  if (cell !== '' || cells.length) {
    cells.push(cell);
    records.push({ line: recordLine, cells });
  }
  return records;
}

/** Zählt das Zeichen außerhalb von Anführungszeichen bis zum ersten Zeilenende. */
function countInFirstLine(text: string, char: string): number {
  let count = 0;
  let quoted = false;
  for (const c of text) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === '\n' || c === '\r')) break;
    else if (!quoted && c === char) count++;
  }
  return count;
}

// ── Werte umwandeln ──────────────────────────────────────────────────────────

export type CellResult = { value: unknown } | { error: string };

const TRUE_WORDS = ['ja', 'j', 'true', 'wahr', 'yes', 'y', 'x', '1', '✓', '✔'];
const FALSE_WORDS = ['nein', 'n', 'false', 'falsch', 'no', '0', '-', '✗'];
/** Ohne 0/1, "x" und "-": solche Spalten sind eher Zahlen bzw. Text. */
const BOOLEAN_INFER_WORDS = [
  'ja',
  'nein',
  'j',
  'n',
  'true',
  'false',
  'wahr',
  'falsch',
  'yes',
  'no',
];

/** Ja/Nein für bekannte Wörter, sonst <c>null</c>. */
export function parseBoolean(raw: string): boolean | null {
  const word = raw.trim().toLowerCase();
  if (TRUE_WORDS.includes(word)) return true;
  if (FALSE_WORDS.includes(word)) return false;
  return null;
}

/** Schlüssel für die Werte-Zuordnung: ohne Leerzeichen am Rand, Groß-/Kleinschreibung egal. */
export function valueKey(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Zahl mit Dezimal- und optionalem Tausendertrennzeichen; Währungszeichen werden entfernt. */
export function parseNumber(raw: string, decimal: DecimalSeparator): number | null {
  const text = raw.replace(/€|EUR/gi, '').replace(/[\s ]/g, '');
  const thousands = decimal === ',' ? '\\.' : ',';
  const dec = decimal === ',' ? ',' : '\\.';
  // Tausendertrennzeichen nur in Dreiergruppen, sonst wäre "1.5" bei Dezimalkomma 15.
  const pattern = new RegExp(`^-?(\\d{1,3}(${thousands}\\d{3})+|\\d+)(${dec}\\d+)?$`);
  if (!pattern.test(text)) return null;

  const normalized = text.replace(new RegExp(thousands, 'g'), '').replace(decimal, '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

/** Datum als TT.MM.JJJJ (auch zweistellige Jahre) oder JJJJ-MM-TT; Ergebnis im ISO-Format. */
export function parseDate(raw: string): string | null {
  const text = raw.trim();
  let year: number, month: number, day: number;

  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(text);
  if (german) {
    [day, month, year] = [Number(german[1]), Number(german[2]), Number(german[3])];
    if (german[3].length === 2) year += 2000;
  } else if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Wandelt den Text einer Zelle in den Wert für die Spalte um. Leere Zellen ergeben
 * <c>undefined</c> (bzw. einen Fehler bei Pflichtfeldern), bei Ja/Nein "Nein".
 * Mit <paramref name="valueMap"/> (Schlüssel aus {@link valueKey}) werden Ja/Nein- und
 * Auswahlwerte darüber zugeordnet statt erkannt.
 */
export function convertCell(
  column: CustomTableColumn,
  raw: string | undefined,
  decimal: DecimalSeparator,
  valueMap?: ReadonlyMap<string, unknown>,
): CellResult {
  const text = (raw ?? '').trim();

  if (text === '') {
    if (column.type === CustomTableColumnType.Boolean) return { value: false };
    return column.required ? { error: 'Pflichtfeld ist leer' } : { value: undefined };
  }

  if (valueMap) {
    const value = valueMap.get(valueKey(text));
    return value === undefined || value === null
      ? { error: `„${text}“ ist keinem Wert zugeordnet` }
      : { value };
  }

  if (column.type === CustomTableColumnType.Boolean) {
    const value = parseBoolean(text);
    return value === null ? { error: `„${text}“ ist weder Ja noch Nein` } : { value };
  }

  switch (column.type) {
    case CustomTableColumnType.Text:
      return text.length > 1000
        ? { error: 'Text ist zu lang (max. 1000 Zeichen)' }
        : { value: text };
    case CustomTableColumnType.LongText:
      return text.length > 20000 ? { error: 'Text ist zu lang' } : { value: text };
    case CustomTableColumnType.Number:
    case CustomTableColumnType.Currency: {
      const number = parseNumber(text, decimal);
      if (number === null) return { error: `„${text}“ ist keine Zahl` };
      return {
        value:
          column.type === CustomTableColumnType.Currency ? Math.round(number * 100) / 100 : number,
      };
    }
    case CustomTableColumnType.Date: {
      const date = parseDate(text);
      return date ? { value: date } : { error: `„${text}“ ist kein Datum` };
    }
    case CustomTableColumnType.Select: {
      const option = column.options?.find((o) => o.toLowerCase() === text.toLowerCase());
      return option ? { value: option } : { error: `„${text}“ ist keine erlaubte Auswahl` };
    }
  }
  return { value: text };
}

/** Anteil passender Werte, ab dem ein Typ vorgeschlagen wird; Ausreißer erscheinen als Fehler. */
const INFER_SHARE = 0.8;

/** Schlägt einen Spaltentyp anhand der (nicht leeren) Werte einer CSV-Spalte vor. */
export function inferColumnType(
  values: string[],
  decimal: DecimalSeparator,
): CustomTableColumnType {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (!filled.length) return CustomTableColumnType.Text;
  const mostly = (test: (v: string) => boolean) =>
    filled.filter(test).length >= filled.length * INFER_SHARE;

  if (mostly((v) => BOOLEAN_INFER_WORDS.includes(v.toLowerCase()))) {
    return CustomTableColumnType.Boolean;
  }
  if (mostly((v) => parseDate(v) !== null)) return CustomTableColumnType.Date;
  if (mostly((v) => parseNumber(v, decimal) !== null)) {
    return filled.some((v) => /€|EUR/i.test(v))
      ? CustomTableColumnType.Currency
      : CustomTableColumnType.Number;
  }
  if (filled.some((v) => v.length > 200 || v.includes('\n'))) {
    return CustomTableColumnType.LongText;
  }
  return CustomTableColumnType.Text;
}

/** Verschiedene Werte in Reihenfolge des ersten Vorkommens (Groß-/Kleinschreibung egal). */
export function distinctValues(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const text = value.trim();
    if (text && !seen.has(text.toLowerCase())) seen.set(text.toLowerCase(), text);
  }
  return [...seen.values()];
}

/** Verschiedene nicht leere Werte mit Häufigkeit, in Reihenfolge des ersten Vorkommens. */
export function countValues(values: string[]): { key: string; label: string; count: number }[] {
  const counts = new Map<string, { key: string; label: string; count: number }>();
  for (const value of values) {
    const label = value.trim();
    if (!label) continue;
    const key = valueKey(label);
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { key, label, count: 1 });
  }
  return [...counts.values()];
}

// ── Export ───────────────────────────────────────────────────────────────────

/**
 * CSV aus den Einträgen. Im Excel-Format mit Dezimalkomma, deutschem Datum und BOM,
 * damit Excel Umlaute richtig erkennt; sonst mit Punkt und ISO-Datum.
 */
export function toCsv(
  columns: CustomTableColumn[],
  rows: Record<string, unknown>[],
  format: CsvFormat,
): string {
  const { delimiter, decimal } = format;
  const german = decimal === ',';
  const escape = (text: string) =>
    text.includes(delimiter) || /["\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

  const cell = (column: CustomTableColumn, value: unknown): string => {
    if (column.type === CustomTableColumnType.Boolean) {
      return german ? (value ? 'Ja' : 'Nein') : value ? 'true' : 'false';
    }
    if (value === undefined || value === null || value === '') return '';
    switch (column.type) {
      case CustomTableColumnType.Currency:
        return Number(value).toFixed(2).replace('.', decimal);
      case CustomTableColumnType.Number:
        return String(value).replace('.', decimal);
      case CustomTableColumnType.Date: {
        if (!german) return String(value);
        const [y, m, d] = String(value).split('-');
        return `${d}.${m}.${y}`;
      }
      default:
        return String(value);
    }
  };

  const lines = [
    columns.map((c) => escape(c.label)).join(delimiter),
    ...rows.map((row) => columns.map((c) => escape(cell(c, row[c.id]))).join(delimiter)),
  ];
  return (german ? '﻿' : '') + lines.join('\r\n');
}
