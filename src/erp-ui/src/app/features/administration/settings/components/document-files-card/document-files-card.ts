import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { lastValueFrom } from 'rxjs';
import {
  DocumentLibraryService,
  DocumentPublicFileDto,
} from '../../../../../../../projects/api/src/lib';
import { DialogService } from '../../../../../core/services/dialog-service';

interface Folder {
  path: string;
  files: DocumentPublicFileDto[];
}

/**
 * Dateien für alle Vorlagen. Beim Übersetzen liegen sie im Ordner "template" neben dem
 * Arbeitsordner der Vorlage, in Vorlagen also unter "/template/<pfad>".
 */
@Component({
  selector: 'app-document-files-card',
  imports: [
    FormsModule,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
  ],
  templateUrl: './document-files-card.html',
  styleUrl: './document-files-card.scss',
})
export class DocumentFilesCard implements OnInit {
  private readonly libraryController = inject(DocumentLibraryService);
  private readonly dialogService = inject(DialogService);

  protected readonly files = signal<DocumentPublicFileDto[]>([]);
  protected readonly target = signal('');
  protected readonly progress = signal<string | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly copied = signal<string | null>(null);

  /** Nach Ordnern gruppiert; Dateien ohne Ordner zuerst. */
  protected readonly folders = computed<Folder[]>(() => {
    const groups = new Map<string, DocumentPublicFileDto[]>();
    for (const file of this.files()) {
      const folder = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
      groups.set(folder, [...(groups.get(folder) ?? []), file]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'de'))
      .map(([path, files]) => ({ path, files }));
  });

  protected readonly totalSize = computed(() => this.files().reduce((sum, f) => sum + f.size, 0));

  async ngOnInit() {
    await this.load();
  }

  /** Dateien oder ein ganzer Ordner (dann mit relativem Pfad samt Unterordnern). */
  protected async upload(input: HTMLInputElement) {
    const selected = Array.from(input.files ?? []).filter(
      // Versteckte Systemdateien wie .DS_Store oder Thumbs.db nicht mitnehmen.
      (f) => !f.name.startsWith('.') && f.name !== 'Thumbs.db' && f.name !== 'desktop.ini',
    );
    input.value = '';
    if (!selected.length) return;

    const prefix = this.target()
      .trim()
      .replace(/^\/+|\/+$/g, '');
    const errors: string[] = [];
    for (const [index, file] of selected.entries()) {
      const relative = file.webkitRelativePath || file.name;
      const path = prefix ? `${prefix}/${relative}` : relative;
      this.progress.set(`Lädt ${index + 1} von ${selected.length}: ${path}`);
      try {
        await lastValueFrom(
          this.libraryController.apiDocumentsPublicFilesPost({
            uploadDocumentPublicFileRequest: { path, contentBase64: await toBase64(file) },
          }),
        );
      } catch (error) {
        errors.push(
          `${path}: ${error instanceof HttpErrorResponse && typeof error.error === 'string' ? error.error : 'nicht hochgeladen'}`,
        );
      }
    }
    this.progress.set(null);
    this.errors.set(errors);
    await this.load();
  }

  protected async deleteFile(file: DocumentPublicFileDto) {
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Datei löschen',
      message: `„${file.path}“ löschen? Vorlagen, die sie nutzen, lassen sich danach nicht mehr übersetzen.`,
      confirmLabel: 'Löschen',
    });
    if (!confirmed) return;
    await lastValueFrom(this.libraryController.apiDocumentsPublicFilesIdDelete({ id: file.id }));
    await this.load();
  }

  protected async deleteFolder(folder: Folder) {
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Ordner löschen',
      message: `Den Ordner „${folder.path}“ mit allen Dateien und Unterordnern löschen?`,
      confirmLabel: 'Löschen',
    });
    if (!confirmed) return;
    await lastValueFrom(
      this.libraryController.apiDocumentsPublicFilesDelete({ folder: folder.path }),
    );
    await this.load();
  }

  /** Kopiert den Pfad, wie er in Vorlagen verwendet wird. */
  protected async copy(file: DocumentPublicFileDto) {
    await navigator.clipboard?.writeText(`/template/${file.path}`);
    this.copied.set(file.id);
    setTimeout(() => this.copied.set(null), 1500);
  }

  protected fileName(file: DocumentPublicFileDto): string {
    return file.path.slice(file.path.lastIndexOf('/') + 1);
  }

  protected formatSize(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
  }

  private async load() {
    this.files.set(await lastValueFrom(this.libraryController.apiDocumentsPublicFilesGet()));
  }
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
