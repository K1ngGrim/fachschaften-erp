import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { lastValueFrom } from 'rxjs';
import { WikiPageDto, WikiService } from '../../../../../../projects/api/src/lib';
import { MarkdownView } from '../../../../shared/components/markdown-view/markdown-view';
import { Auth } from '../../../../core/services/auth';
import { DialogService } from '../../../../core/services/dialog-service';
import { PermissionType } from '../../../../shared/models/permission-type';
import { formatDate } from '../../../../shared/models/finance';
import { downloadText, toFileName } from '../../../../shared/models/download';

@Component({
  selector: 'app-wiki-page',
  imports: [RouterLink, MatButton, MatIcon, MatCard, MatCardContent, MarkdownView],
  templateUrl: './wiki-page.html',
  styleUrl: './wiki-page.scss',
})
export class WikiPage implements OnInit {
  private readonly wikiController = inject(WikiService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  public readonly page = signal<WikiPageDto | null>(null);
  public readonly loading = signal(true);
  public readonly canWrite = inject(Auth).hasPermission(PermissionType.WikiCanWrite);
  public readonly formatDate = formatDate;

  async ngOnInit() {
    try {
      this.page.set(await lastValueFrom(this.wikiController.apiWikiIdGet({ id: this.id })));
    } catch {
      this.page.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  /** Markdown-Datei mit dem Titel als Überschrift, damit sie für sich allein verständlich ist. */
  public download() {
    const page = this.page();
    if (!page) return;
    downloadText(
      toFileName(page.title, 'md'),
      `# ${page.title}\n\n${page.content}\n`,
      'text/markdown',
    );
  }

  public print() {
    window.print();
  }

  public async delete() {
    const page = this.page();
    if (!page) return;

    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Seite löschen',
      message: `„${page.title}“ löschen?`,
      confirmLabel: 'Löschen',
    });
    if (!confirmed) return;

    await lastValueFrom(this.wikiController.apiWikiIdDelete({ id: page.id }));
    await this.router.navigate(['/wiki']);
  }
}
