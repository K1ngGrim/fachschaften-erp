import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { CustomTableColumn } from '../../../../projects/api/src/lib';

/** Typst oder die API hat das Dokument abgelehnt; <c>message</c> ist für Menschen gedacht. */
export class DocumentError extends Error {}

/**
 * PDF-Endpunkte des Dokumente-Moduls. Sie liefern Binärdaten und stehen deshalb nicht im
 * generierten API-Client.
 */
@Injectable({ providedIn: 'root' })
export class DocumentsPdf {
  private readonly http = inject(HttpClient);

  /** Vorschau eines ungespeicherten Vorlagen-Stands. */
  public async preview(
    templateId: string,
    draft: {
      source: string;
      fields: CustomTableColumn[];
      assetIds: string[];
      values: Record<string, unknown>;
    },
  ): Promise<Blob> {
    return (await this.post(`/api/documents/templates/${templateId}/preview`, draft)).blob;
  }

  /** Erzeugt das PDF; mit <c>store</c> wird es abgelegt, sofern die Vorlage das vorsieht. */
  public render(
    templateId: string,
    request: { values: Record<string, unknown>; title: string | null },
    store: boolean,
  ): Promise<{ blob: Blob; documentId: string | null }> {
    return this.post(
      `/api/documents/templates/${templateId}/render`,
      request,
      new HttpParams().set('store', store),
    );
  }

  public async storedPdf(documentId: string): Promise<Blob> {
    try {
      return await lastValueFrom(
        this.http.get(`/api/documents/documents/${documentId}/pdf`, { responseType: 'blob' }),
      );
    } catch (error) {
      throw await toDocumentError(error);
    }
  }

  private async post(url: string, body: unknown, params?: HttpParams) {
    try {
      const response = await lastValueFrom(
        this.http.post(url, body, { responseType: 'blob', observe: 'response', params }),
      );
      return { blob: response.body!, documentId: response.headers.get('X-Document-Id') };
    } catch (error) {
      throw await toDocumentError(error);
    }
  }
}

/** Fehlertext aus der Antwort (TypstErrorDto, Text oder Status). */
async function toDocumentError(error: unknown): Promise<DocumentError> {
  if (!(error instanceof HttpErrorResponse)) return new DocumentError('Das hat nicht geklappt.');
  if (error.status === 404) return new DocumentError('Die Vorlage gibt es nicht mehr.');
  if (error.status === 403) return new DocumentError('Dafür fehlt dir die Berechtigung.');

  let text = '';
  if (error.error instanceof Blob) text = await error.error.text();
  else if (typeof error.error === 'string') text = error.error;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === 'string') return new DocumentError(parsed.message);
    if (typeof parsed === 'string') return new DocumentError(parsed);
  } catch {
    // kein JSON
  }
  return new DocumentError(text || 'Das Dokument konnte nicht erzeugt werden.');
}

/** Bietet ein Blob als Datei an. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Schlüssel für data.json aus einer Bezeichnung: "Straße & Nr." → "strasse_nr". */
export function fieldKey(label: string): string {
  const key = label
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return /^[a-z]/.test(key) ? key : key ? `f_${key}`.slice(0, 40) : '';
}
