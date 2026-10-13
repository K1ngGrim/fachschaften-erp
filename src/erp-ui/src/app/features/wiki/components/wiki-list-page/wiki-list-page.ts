import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatInput, MatLabel, MatPrefix } from '@angular/material/input';
import { lastValueFrom } from 'rxjs';
import { WikiPageSummaryDto, WikiService } from '../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Auth } from '../../../../core/services/auth';
import { PermissionType } from '../../../../shared/models/permission-type';
import { formatDate } from '../../../../shared/models/finance';

interface WikiGroup {
  category: string;
  pages: WikiPageSummaryDto[];
}

@Component({
  selector: 'app-wiki-list-page',
  imports: [
    RouterLink,
    FormsModule,
    MatCard,
    MatCardContent,
    MatButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatInput,
    MatPrefix,
    PageHeader,
  ],
  templateUrl: './wiki-list-page.html',
  styleUrl: './wiki-list-page.scss',
})
export class WikiListPage implements OnInit {
  private readonly wikiController = inject(WikiService);

  public readonly pages = signal<WikiPageSummaryDto[]>([]);
  public readonly search = signal('');
  public readonly canWrite = inject(Auth).hasPermission(PermissionType.WikiCanWrite);
  public readonly formatDate = formatDate;

  /** Nach Kategorie gruppiert; Seiten ohne Kategorie stehen unter "Allgemein". */
  public readonly groups = computed<WikiGroup[]>(() => {
    const query = this.search().trim().toLowerCase();
    const filtered = this.pages().filter(
      (p) =>
        !query ||
        p.title.toLowerCase().includes(query) ||
        (p.category ?? '').toLowerCase().includes(query),
    );

    const groups = new Map<string, WikiPageSummaryDto[]>();
    for (const page of filtered) {
      const category = page.category || 'Allgemein';
      groups.set(category, [...(groups.get(category) ?? []), page]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'de'))
      .map(([category, pages]) => ({ category, pages }));
  });

  async ngOnInit() {
    this.pages.set(await lastValueFrom(this.wikiController.apiWikiGet()));
  }
}
