import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { lastValueFrom } from 'rxjs';
import {
  DocumentsService,
  DocumentTemplateDto,
  GeneratedDocumentDto,
} from '../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Auth } from '../../../../core/services/auth';
import { DialogService } from '../../../../core/services/dialog-service';
import { PermissionType } from '../../../../shared/models/permission-type';
import { toFileName } from '../../../../shared/models/download';
import { DocumentError, DocumentsPdf, downloadBlob } from '../../documents-pdf';
import { FieldsForm, missingRequired } from '../fields-form/fields-form';
import { PdfPreview } from '../pdf-preview/pdf-preview';

/** Vorlage ausfüllen, Vorschau ansehen, PDF erzeugen; bei Ablage auch die abgelegten Dokumente. */
@Component({
  selector: 'app-document-page',
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
    PageHeader,
    FieldsForm,
    PdfPreview,
  ],
  templateUrl: './document-page.html',
  styleUrl: './document-page.scss',
})
export class DocumentPage implements OnInit, OnDestroy {
  private readonly documentsController = inject(DocumentsService);
  private readonly pdf = inject(DocumentsPdf);
  private readonly dialogService = inject(DialogService);
  private readonly auth = inject(Auth);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  private readonly preview = viewChild(PdfPreview);
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private previewRun = 0;

  public readonly template = signal<DocumentTemplateDto | null>(null);
  public readonly documents = signal<GeneratedDocumentDto[]>([]);
  public readonly loaded = signal(false);
  public readonly values = signal<Record<string, unknown>>({});
  public readonly title = signal('');

  public readonly busy = signal<'download' | 'print' | 'store' | null>(null);
  public readonly message = signal<{ text: string; ok: boolean } | null>(null);
  public readonly previewBlob = signal<Blob | null>(null);
  public readonly previewError = signal<string | null>(null);
  public readonly previewLoading = signal(false);

  public readonly canWrite = this.auth.hasPermission(PermissionType.DocumentsCanWrite);
  public readonly canDesign = this.auth.hasPermission(PermissionType.DocumentTemplatesCanWrite);

  public readonly fields = computed(() => this.template()?.version.fields ?? []);
  public readonly missing = computed(() => missingRequired(this.fields(), this.values()));

  constructor() {
    effect(() => {
      this.values();
      if (this.template() && this.canWrite) this.schedulePreview();
    });
  }

  async ngOnInit() {
    try {
      const template = await lastValueFrom(
        this.documentsController.apiDocumentsTemplatesIdGet({ id: this.id }),
      );
      this.template.set(template);
      if (template.storeDocuments) await this.loadDocuments();
    } catch {
      this.template.set(null);
    } finally {
      this.loaded.set(true);
    }
  }

  ngOnDestroy() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
  }

  public async download() {
    const blob = await this.render('download', false);
    if (blob) downloadBlob(blob, toFileName(this.documentTitle(), 'pdf'));
  }

  /** Druckt die Vorschau; ist sie veraltet, erst neu erzeugen. */
  public async print() {
    if (this.previewTimer || !this.previewBlob() || this.previewError()) {
      if (this.previewTimer) clearTimeout(this.previewTimer);
      this.previewTimer = null;
      await this.refreshPreview();
    }
    if (this.previewBlob() && !this.previewError()) this.preview()?.print();
  }

  public async store() {
    const blob = await this.render('store', true);
    if (!blob) return;
    downloadBlob(blob, toFileName(this.documentTitle(), 'pdf'));
    this.message.set({ text: 'Das Dokument ist abgelegt.', ok: true });
    this.title.set('');
    await this.loadDocuments();
  }

  public async downloadStored(document: GeneratedDocumentDto) {
    try {
      downloadBlob(await this.pdf.storedPdf(document.id), toFileName(document.title, 'pdf'));
    } catch (error) {
      this.message.set({ text: (error as Error).message, ok: false });
    }
  }

  /** Werte eines abgelegten Dokuments ins Formular übernehmen, z. B. für einen ähnlichen Vertrag. */
  public async reuse(document: GeneratedDocumentDto) {
    const values = await lastValueFrom(
      this.documentsController.apiDocumentsDocumentsDocumentIdValuesGet({
        documentId: document.id,
      }),
    );
    this.values.set({ ...(values as Record<string, unknown>) });
    this.message.set({ text: `Werte aus „${document.title}“ übernommen.`, ok: true });
  }

  public async deleteStored(document: GeneratedDocumentDto) {
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Dokument löschen',
      message: `„${document.title}“ endgültig löschen?`,
      confirmLabel: 'Löschen',
    });
    if (!confirmed) return;
    await lastValueFrom(
      this.documentsController.apiDocumentsDocumentsDocumentIdDelete({ documentId: document.id }),
    );
    await this.loadDocuments();
  }

  public formatDate(value: string): string {
    return new Date(value).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private documentTitle(): string {
    return this.title().trim() || this.template()?.name || 'Dokument';
  }

  private async render(kind: 'download' | 'store', store: boolean): Promise<Blob | null> {
    if (this.missing().length) {
      this.message.set({ text: `Bitte noch ausfüllen: ${this.missing().join(', ')}.`, ok: false });
      return null;
    }
    this.busy.set(kind);
    this.message.set(null);
    try {
      const result = await this.pdf.render(
        this.id,
        { values: this.values(), title: this.title().trim() || null },
        store,
      );
      return result.blob;
    } catch (error) {
      this.message.set({
        text:
          error instanceof DocumentError
            ? error.message
            : 'Das Dokument konnte nicht erzeugt werden.',
        ok: false,
      });
      return null;
    } finally {
      this.busy.set(null);
    }
  }

  private schedulePreview() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      this.previewTimer = null;
      void this.refreshPreview();
    }, 700);
  }

  private async refreshPreview() {
    const run = ++this.previewRun;
    this.previewLoading.set(true);
    try {
      const { blob } = await this.pdf.render(
        this.id,
        { values: this.values(), title: null },
        false,
      );
      if (run !== this.previewRun) return;
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

  private async loadDocuments() {
    this.documents.set(
      await lastValueFrom(
        this.documentsController.apiDocumentsTemplatesIdDocumentsGet({ id: this.id }),
      ),
    );
  }
}
