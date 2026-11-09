/** Einheit ohne eigene Angabe; entspricht ProductBase.DefaultUnit im Backend. */
export const DEFAULT_UNIT = 'Stück';

interface WithUnits {
  unit?: string | null;
  priceUnit?: string | null;
  priceUnitsPerStockUnit?: number | null;
}

/** Einheit für Bestand, Mindestbestand und Lieferungen, z. B. Kiste. */
export function stockUnit(product: WithUnits | null | undefined): string {
  return product?.unit?.trim() || DEFAULT_UNIT;
}

/** Einheit, auf die sich EK und VK beziehen, z. B. Flasche; ohne Angabe die Bestandseinheit. */
export function priceUnit(product: WithUnits | null | undefined): string {
  return product?.priceUnit?.trim() || stockUnit(product);
}

/** Preise beziehen sich auf eine andere Einheit als der Bestand. */
export function hasSeparatePriceUnit(product: WithUnits | null | undefined): boolean {
  return priceUnit(product).toLowerCase() !== stockUnit(product).toLowerCase();
}

/** Preiseinheiten pro Bestandseinheit, z. B. 20 Flaschen pro Kiste; ohne eigene Preiseinheit 1. */
export function priceUnitsPerStockUnit(product: WithUnits | null | undefined): number {
  const factor = Number(product?.priceUnitsPerStockUnit);
  return hasSeparatePriceUnit(product) && factor > 0 ? factor : 1;
}

/** Rechnet einen Preis pro Preiseinheit in einen Preis pro Bestandseinheit um. */
export function perStockUnit(price: number, product: WithUnits | null | undefined): number {
  return price * priceUnitsPerStockUnit(product);
}

/** Warenwert eines Bestands (in Bestandseinheiten) zum Einkaufspreis pro Preiseinheit. */
export function stockValue(
  stock: number,
  product: (WithUnits & { purchasePrice: number }) | null | undefined,
): number {
  return product ? stock * perStockUnit(product.purchasePrice, product) : 0;
}

/** Kurzform der Umrechnung, z. B. "1 Kiste = 20 Flasche"; leer ohne eigene Preiseinheit. */
export function unitConversionLabel(product: WithUnits | null | undefined): string {
  if (!hasSeparatePriceUnit(product)) return '';
  const factor = priceUnitsPerStockUnit(product).toLocaleString('de-DE', { maximumFractionDigits: 3 });
  return `1 ${stockUnit(product)} = ${factor} ${priceUnit(product)}`;
}
