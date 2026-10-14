import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { lastValueFrom } from 'rxjs';
import {
  DocumentsService,
  DocumentTemplateSummaryDto,
} from '../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Auth } from '../../../../core/services/auth';
import { PermissionType } from '../../../../shared/models/permission-type';

/** Übersicht der Vorlagen. */
@Component({
  selector: 'app-documents-page',
  imports: [RouterLink, MatCard, MatCardContent, MatButton, MatIcon, PageHeader],
  templateUrl: './documents-page.html',
  styleUrl: './documents-page.scss',
})
export class DocumentsPage implements OnInit {
  private readonly documentsController = inject(DocumentsService);

  public readonly templates = signal<DocumentTemplateSummaryDto[]>([]);
  public readonly loaded = signal(false);
  public readonly canDesign = inject(Auth).hasPermission(PermissionType.DocumentTemplatesCanWrite);

  async ngOnInit() {
    try {
      this.templates.set(await lastValueFrom(this.documentsController.apiDocumentsTemplatesGet()));
    } finally {
      this.loaded.set(true);
    }
  }
}
