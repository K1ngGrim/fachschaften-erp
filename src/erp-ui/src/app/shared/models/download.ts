/** Bietet Text als Datei zum Herunterladen an (ohne Server-Umweg). */
export function downloadText(fileName: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** Dateiname aus einem Titel: Kleinbuchstaben, Umlaute ausgeschrieben, nur a-z, 0-9 und "-". */
export function toFileName(title: string, extension: string): string {
  const base = title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'export'}.${extension}`;
}
