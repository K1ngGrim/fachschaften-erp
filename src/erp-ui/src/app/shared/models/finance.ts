import { CashIncomeSource, TaxArea } from '../../../../projects/api/src/lib';

export const TAX_AREA_LABELS: Record<TaxArea, string> = {
  [TaxArea.Ideell]: 'Ideeller Bereich',
  [TaxArea.Zweckbetrieb]: 'Zweckbetrieb',
  [TaxArea.Wirtschaftsbetrieb]: 'Wirtschaftlicher Geschäftsbetrieb',
};

export const TAX_AREA_HINTS: Record<TaxArea, string> = {
  [TaxArea.Ideell]: 'Mitgliedsbeiträge, Spenden, Zuschüsse',
  [TaxArea.Zweckbetrieb]: 'Veranstaltungen und Angebote im Satzungszweck',
  [TaxArea.Wirtschaftsbetrieb]: 'Getränkeverkauf, Werbung, Vermietung',
};

export const CASH_INCOME_SOURCE_LABELS: Record<CashIncomeSource, string> = {
  [CashIncomeSource.Cash]: 'Bar',
  [CashIncomeSource.TallyList]: 'Strichliste (SEPA)',
  [CashIncomeSource.SumUp]: 'SumUp',
};

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];

const currencyFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function formatCurrency(value: number): string {
  return currencyFormat.format(value);
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('de-DE');
}

/** Wandelt einen ISO-Zeitstempel in den Wert eines `input[type=date]`. */
export function toDateInput(value: string | null | undefined): string {
  return (value ?? new Date().toISOString()).substring(0, 10);
}

/** Wandelt den Wert eines `input[type=date]` zurück in einen ISO-Zeitstempel. */
export function fromDateInput(value: string): string {
  return new Date(value).toISOString();
}

export function taxAreaOptions(): { label: string; value: TaxArea }[] {
  return Object.values(TaxArea).map((value) => ({ label: TAX_AREA_LABELS[value], value }));
}
