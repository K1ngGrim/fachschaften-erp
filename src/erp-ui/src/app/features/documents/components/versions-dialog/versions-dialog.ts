import { Component, inject, OnInit, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { lastValueFrom } from 'rxjs';
import {
  DocumentsService,
  DocumentTemplateVersionDto,
  DocumentTemplateVersionSummaryDto,
} from '../../../../../../projects/api/src/lib';
import { COLUMN_TYPE_LABELS } from '../../../tables/table-values';

export interface VersionsDialogData {
  templateId: string;
  currentVersion: number;
}

/** Versionsverlauf einer Vorlage; schließt mit der Version, die in den Editor soll. */
@Component({
  selector: 'app-versions-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton],
  templateUrl: './versions-dialog.html',
  styleUrl: './versions-dialog.scss',
})
export class VersionsDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<VersionsDialog, DocumentTemplateVersionDto>);
  private readonly documentsController = inject(DocumentsService);
  protected readonly data = inject<VersionsDialogData>(MAT_DIALOG_DATA);

  protected readonly versions = signal<DocumentTemplateVersionSummaryDto[]>([]);
  protected readonly selected = signal<DocumentTemplateVersionDto | null>(null);
  protected readonly typeLabels = COLUMN_TYPE_LABELS;

  async ngOnInit() {
    const versions = await lastValueFrom(
      this.documentsController.apiDocumentsTemplatesIdVersionsGet({ id: this.data.templateId }),
    );
    this.versions.set(versions);
    if (versions.length) await this.select(versions[0].version);
  }

  protected async select(version: number) {
    this.selected.set(
      await lastValueFrom(
        this.documentsController.apiDocumentsTemplatesIdVersionsVersionGet({
          id: this.data.templateId,
          version,
        }),
      ),
    );
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected restore() {
    const version = this.selected();
    if (version) this.dialogRef.close(version);
  }

  protected close() {
    this.dialogRef.close();
  }
}
