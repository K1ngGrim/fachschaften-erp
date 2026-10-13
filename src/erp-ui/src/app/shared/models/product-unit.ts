/** Einheit ohne eigene Angabe; entspricht ProductBase.DefaultUnit im Backend. */
export const DEFAULT_UNIT = 'Stück';

interface WithUnits {
  unit?: string | null;
  priceUnit?: string | null;
}

/** Einheit für Bestand, Mindestbestand und Einkaufspreis, z. B. Kiste. */
export function stockUnit(product: WithUnits | null | undefined): string {
  return product?.unit?.trim() || DEFAULT_UNIT;
}

/** Einheit der Verkaufspreise, z. B. Flasche; ohne Angabe die Bestandseinheit. */
export function priceUnit(product: WithUnits | null | undefined): string {
  return product?.priceUnit?.trim() || stockUnit(product);
}

/** Verkaufspreise beziehen sich auf eine andere Einheit als Bestand und Einkaufspreis. */
export function hasSeparatePriceUnit(product: WithUnits | null | undefined): boolean {
  return priceUnit(product).toLowerCase() !== stockUnit(product).toLowerCase();
}
