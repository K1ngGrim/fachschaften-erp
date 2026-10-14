import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { lastValueFrom } from 'rxjs';
import {
  CustomTableColumn,
  CustomTableColumnType,
  DocumentAssetDto,
  DocumentLibraryService,
  DocumentsService,
  DocumentTemplateDto,
  DocumentTemplateVersionDto,
} from '../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { DialogService } from '../../../../core/services/dialog-service';
import { COLUMN_TYPE_LABELS } from '../../../tables/table-values';
import { DocumentError, DocumentsPdf, fieldKey } from '../../documents-pdf';
import { FieldsForm } from '../fields-form/fields-form';
import { PdfPreview } from '../pdf-preview/pdf-preview';
import { VersionsDialog, VersionsDialogData } from '../versions-dialog/versions-dialog';

/** Feld im Editor; Optionen als kommagetrennter Text. */
interface EditableField {
  uid: string;
  key: string;
  /** Schlüssel von Hand geändert: dann nicht mehr aus der Bezeichnung ableiten. */
  keyEdited: boolean;
  label: string;
  type: CustomTableColumnType;
  required: boolean;
  options: string;
}

const EXAMPLE_SOURCE = `#let daten = json("data.json")
#set page(paper: "a4", margin: 2.5cm)
#set text(lang: "de", size: 11pt)

#daten.organisation #h(1fr) #daten.erstellt

= Bescheinigung

Hiermit bestätigen wir, dass *#daten.text.name* am #daten.text.datum
teilgenommen hat.

#v(2cm)
#line(length: 6cm)
Unterschrift
`;

@Component({
  selector: 'app-template-editor-page',
  imports: [
    RouterLink,
    FormsModule,
    MatButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    MatCheckbox,
    MatSlideToggle,
    PageHeader,
    FieldsForm,
    PdfPreview,
  ],
  templateUrl: './template-editor-page.html',
  styleUrl: './template-editor-page.scss',
})
export class TemplateEditorPage implements OnInit, OnDestroy {
  private readonly documentsController = inject(DocumentsService);
  private readonly libraryController = inject(DocumentLibraryService);
  private readonly pdf = inject(DocumentsPdf);
  private readonly dialog = inject(MatDialog);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private previewRun = 0;

  public readonly id = signal<string | null>(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  public readonly loading = signal(true);
  public readonly currentVersion = signal(0);

  public readonly name = signal('');
  public readonly description = signal('');
  public readonly storeDocuments = signal(false);
  public readonly source = signal(EXAMPLE_SOURCE);
  public readonly fields = signal<EditableField[]>([
    this.newField('Name', 'name', CustomTableColumnType.Text, true),
    this.newField('Datum', 'datum', CustomTableColumnType.Date, false),
  ]);
  public readonly assets = signal<DocumentAssetDto[]>([]);
  public readonly comment = signal('');
  public readonly testValues = signal<Record<string, unknown>>({ name: 'Erika Musterfrau' });
  /** Was alle Vorlagen nutzen können (für die Hilfe). */
  public readonly variableKeys = signal<string[]>([]);
  public readonly publicPaths = signal<string[]>([]);

  public readonly saving = signal(false);
  public readonly uploading = signal(false);
  public readonly message = signal<{ text: string; ok: boolean } | null>(null);

  public readonly previewBlob = signal<Blob | null>(null);
  public readonly previewError = signal<string | null>(null);
  public readonly previewLoading = signal(false);

  public readonly types = Object.entries(COLUMN_TYPE_LABELS) as [CustomTableColumnType, string][];
  public readonly Type = CustomTableColumnType;

  /** Felder in der Form, wie sie gespeichert werden. */
  public readonly columns = computed<CustomTableColumn[]>(() =>
    this.fields().map((f) => ({
      id: f.key,
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      options: f.type === CustomTableColumnType.Select ? splitOptions(f.options) : null,
    })),
  );

  private readonly saved = signal<string>('');
  private readonly snapshot = computed(() =>
    JSON.stringify([
      this.name(),
      this.description(),
      this.storeDocuments(),
      this.source(),
      this.columns(),
      this.assets().map((a) => a.id),
    ]),
  );
  public readonly dirty = computed(() => this.snapshot() !== this.saved());

  public readonly problem = computed<string | null>(() => {
    if (!this.name().trim()) return 'Die Vorlage braucht einen Namen.';
    if (!this.source().trim()) return 'Der Typst-Quelltext ist leer.';
    const keys = this.fields().map((f) => f.key);
    if (this.fields().some((f) => !f.label.trim())) return 'Jedes Feld braucht eine Bezeichnung.';
    if (keys.some((k) => !/^[a-z][a-z0-9_]{0,39}$/.test(k))) {
      return 'Feld-Schlüssel: mit Buchstaben beginnen, nur a–z, 0–9 und _.';
    }
    if (new Set(keys).size !== keys.length)
      return 'Jeder Feld-Schlüssel darf nur einmal vorkommen.';
    if (
      this.fields().some(
        (f) => f.type === CustomTableColumnType.Select && !splitOptions(f.options).length,
      )
    ) {
      return 'Auswahl-Felder brauchen mindestens eine Option.';
    }
    return null;
  });

  constructor() {
    // Vorschau automatisch, kurz nachdem sich Quelltext, Felder, Dateien oder Testwerte ändern.
    effect(() => {
      this.source();
      this.columns();
      this.assets();
      this.testValues();
      if (!this.loading() && this.id()) this.schedulePreview();
    });
  }

  async ngOnInit() {
    void this.loadLibrary();
    const id = this.id();
    try {
      if (id)
        this.apply(
          await lastValueFrom(this.documentsController.apiDocumentsTemplatesIdGet({ id })),
        );
      else this.saved.set('');
    } catch {
      this.message.set({ text: 'Die Vorlage konnte nicht geladen werden.', ok: false });
    } finally {
      this.loading.set(false);
    }
  }

  private async loadLibrary() {
    const [variables, files] = await Promise.all([
      lastValueFrom(this.libraryController.apiDocumentsVariablesGet()).catch(() => []),
      lastValueFrom(this.libraryController.apiDocumentsPublicFilesGet()).catch(() => []),
    ]);
    this.variableKeys.set(variables.map((v) => v.key));
    this.publicPaths.set(files.map((f) => f.path));
  }

  ngOnDestroy() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
  }

  // ── Felder ─────────────────────────────────────────────────────────────

  public updateField(index: number, patch: Partial<EditableField>) {
    this.fields.update((fields) =>
      fields.map((f, i) => {
        if (i !== index) return f;
        const next = { ...f, ...patch };
        if (patch.label !== undefined && !f.keyEdited) next.key = fieldKey(patch.label);
        if (patch.key !== undefined) next.keyEdited = true;
        return next;
      }),
    );
  }

  public addField() {
    this.fields.update((fields) => [
      ...fields,
      this.newField('', '', CustomTableColumnType.Text, false),
    ]);
  }

  public removeField(index: number) {
    this.fields.update((fields) => fields.filter((_, i) => i !== index));
  }

  public moveField(index: number, direction: -1 | 1) {
    this.fields.update((fields) => {
      const target = index + direction;
      if (target < 0 || target >= fields.length) return fields;
      const next = [...fields];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // ── Dateien ────────────────────────────────────────────────────────────

  public async upload(input: HTMLInputElement) {
    const id = this.id();
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!id || !files.length) return;

    this.uploading.set(true);
    this.message.set(null);
    try {
      for (const file of files) {
        const asset = await lastValueFrom(
          this.documentsController.apiDocumentsTemplatesIdAssetsPost({
            id,
            uploadDocumentAssetRequest: {
              fileName: file.name,
              contentBase64: await toBase64(file),
            },
          }),
        );
        // Gleichnamige Datei ersetzt die bisherige in dieser Version.
        this.assets.update((assets) => [
          ...assets.filter((a) => a.fileName.toLowerCase() !== asset.fileName.toLowerCase()),
          asset,
        ]);
      }
    } catch (error) {
      this.message.set({
        text:
          error instanceof HttpErrorResponse && typeof error.error === 'string'
            ? `Hochladen abgelehnt: ${error.error}`
            : 'Die Datei konnte nicht hochgeladen werden.',
        ok: false,
      });
    } finally {
      this.uploading.set(false);
    }
  }

  public removeAsset(asset: DocumentAssetDto) {
    this.assets.update((assets) => assets.filter((a) => a.id !== asset.id));
  }

  public formatSize(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
  }

  // ── Quelltext ──────────────────────────────────────────────────────────

  /** Tab fügt zwei Leerzeichen ein, statt das Feld zu verlassen. */
  public onSourceKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || event.shiftKey) return;
    event.preventDefault();
    const area = event.target as HTMLTextAreaElement;
    const { selectionStart: start, selectionEnd: end, value } = area;
    this.source.set(value.slice(0, start) + '  ' + value.slice(end));
    queueMicrotask(() => area.setSelectionRange(start + 2, start + 2));
  }

  // ── Speichern, Versionen, Löschen ──────────────────────────────────────

  public async save() {
    if (this.problem() || this.saving()) return;
    this.saving.set(true);
    this.message.set(null);

    const request = {
      name: this.name().trim(),
      description: this.description().trim() || null,
      storeDocuments: this.storeDocuments(),
      source: this.source(),
      fields: this.columns(),
      assetIds: this.assets().map((a) => a.id),
      comment: this.comment().trim() || null,
    };
    try {
      const id = this.id();
      const before = this.currentVersion();
      const template = id
        ? await lastValueFrom(
            this.documentsController.apiDocumentsTemplatesIdPut({
              id,
              saveDocumentTemplateRequest: request,
            }),
          )
        : await lastValueFrom(
            this.documentsController.apiDocumentsTemplatesPost({
              saveDocumentTemplateRequest: request,
            }),
          );
      this.apply(template);
      this.comment.set('');
      this.message.set({
        text:
          template.currentVersion !== before
            ? `Gespeichert als Version ${template.currentVersion}.`
            : 'Gespeichert (ohne inhaltliche Änderung, keine neue Version).',
        ok: true,
      });
      if (!id) {
        this.id.set(template.id);
        await this.router.navigate(['/documents/templates', template.id, 'edit'], {
          replaceUrl: true,
        });
        this.schedulePreview(0);
      }
    } catch (error) {
      this.message.set({
        text:
          error instanceof HttpErrorResponse && typeof error.error === 'string'
            ? `Nicht gespeichert: ${error.error}`
            : 'Die Vorlage konnte nicht gespeichert werden.',
        ok: false,
      });
    } finally {
      this.saving.set(false);
    }
  }

  public async showVersions() {
    const id = this.id();
    if (!id) return;
    const version = await lastValueFrom(
      this.dialog
        .open<VersionsDialog, VersionsDialogData, DocumentTemplateVersionDto>(VersionsDialog, {
          width: '900px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          data: { templateId: id, currentVersion: this.currentVersion() },
        })
        .afterClosed(),
    );
    if (!version) return;
    this.applyVersion(version);
    this.comment.set(`Version ${version.version} wiederhergestellt`);
    this.message.set({
      text: `Version ${version.version} ist im Editor. Mit „Speichern“ wird sie zur neuen Version.`,
      ok: true,
    });
  }

  public async deleteTemplate() {
    const id = this.id();
    if (!id) return;
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Vorlage löschen',
      message: `„${this.name()}“ löschen? Bereits abgelegte Dokumente bleiben erhalten.`,
      confirmLabel: 'Löschen',
    });
    if (!confirmed) return;
    await lastValueFrom(this.documentsController.apiDocumentsTemplatesIdDelete({ id }));
    await this.router.navigate(['/documents']);
  }

  // ── Vorschau ───────────────────────────────────────────────────────────

  public schedulePreview(delay = 900) {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => void this.refreshPreview(), delay);
  }

  private async refreshPreview() {
    const id = this.id();
    if (!id) return;
    const run = ++this.previewRun;
    this.previewLoading.set(true);
    try {
      const blob = await this.pdf.preview(id, {
        source: this.source(),
        fields: this.columns(),
        assetIds: this.assets().map((a) => a.id),
        values: this.testValues(),
      });
      if (run !== this.previewRun) return; // Inzwischen gibt es eine neuere Vorschau.
      this.previewBlob.set(blob);
      this.previewError.set(null);
    } catch (error) {
      if (run !== this.previewRun) return;
      this.previewError.set(
        error instanceof DocumentError ? error.message : 'Vorschau fehlgeschlagen.',
      );
    } finally {
      if (run === this.previewRun) this.previewLoading.set(false);
    }
  }

  // ── Hilfen ─────────────────────────────────────────────────────────────

  private apply(template: DocumentTemplateDto) {
    this.name.set(template.name);
    this.description.set(template.description ?? '');
    this.storeDocuments.set(template.storeDocuments);
    this.currentVersion.set(template.currentVersion);
    this.applyVersion(template.version);
    this.saved.set(this.snapshot());
  }

  private applyVersion(version: DocumentTemplateVersionDto) {
    this.source.set(version.source);
    this.fields.set(
      version.fields.map((f) => ({
        uid: crypto.randomUUID(),
        key: f.id,
        keyEdited: true,
        label: f.label,
        type: f.type,
        required: f.required,
        options: (f.options ?? []).join(', '),
      })),
    );
    this.assets.set(version.assets);
  }

  private newField(
    label: string,
    key: string,
    type: CustomTableColumnType,
    required: boolean,
  ): EditableField {
    return { uid: crypto.randomUUID(), key, keyEdited: false, label, type, required, options: '' };
  }
}

function splitOptions(text: string): string[] {
  return [
    ...new Set(
      text
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  ];
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
