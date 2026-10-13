import { CustomTableColumn, CustomTableColumnType } from '../../../../projects/api/src/lib';
import { formatCurrency } from '../../shared/models/finance';

export const COLUMN_TYPE_LABELS: Record<CustomTableColumnType, string> = {
  [CustomTableColumnType.Text]: 'Text',
  [CustomTableColumnType.LongText]: 'Langer Text',
  [CustomTableColumnType.Number]: 'Zahl',
  [CustomTableColumnType.Currency]: 'Betrag (€)',
  [CustomTableColumnType.Date]: 'Datum',
  [CustomTableColumnType.Boolean]: 'Ja/Nein',
  [CustomTableColumnType.Select]: 'Auswahl',
};

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 });

/** Anzeige eines Zellwerts in der Oberfläche. */
export function formatValue(column: CustomTableColumn, value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return column.type === CustomTableColumnType.Boolean ? 'Nein' : '';
  }

  switch (column.type) {
    case CustomTableColumnType.Currency:
      return formatCurrency(Number(value));
    case CustomTableColumnType.Number:
      return numberFormat.format(Number(value));
    case CustomTableColumnType.Date: {
      const [y, m, d] = String(value).split('-');
      return d && m && y ? `${d}.${m}.${y}` : String(value);
    }
    case CustomTableColumnType.Boolean:
      return value ? 'Ja' : 'Nein';
    default:
      return String(value);
  }
}

/** CSV für Excel: Semikolon, Dezimalkomma, UTF-8 mit BOM. */
export function toCsv(columns: CustomTableColumn[], rows: Record<string, unknown>[]): string {
  const escape = (text: string) => (/[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  const cell = (column: CustomTableColumn, value: unknown) => {
    if (value === undefined || value === null) return '';
    if (
      column.type === CustomTableColumnType.Currency ||
      column.type === CustomTableColumnType.Number
    ) {
      return String(value).replace('.', ',');
    }
    return formatValue(column, value);
  };

  const lines = [
    columns.map((c) => escape(c.label)).join(';'),
    ...rows.map((row) => columns.map((c) => escape(cell(c, row[c.id]))).join(';')),
  ];
  return '﻿' + lines.join('\r\n');
}
