import { Component, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { lastValueFrom } from 'rxjs';
import { WikiService } from '../../../../../../projects/api/src/lib';
import { MarkdownView } from '../../../../shared/components/markdown-view/markdown-view';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

interface ToolbarAction {
  icon: string;
  label: string;
  apply: (selection: string) => { text: string; select?: [number, number] };
}

/** Umschließt die Auswahl, oder fügt einen Platzhalter ein, der danach markiert ist. */
const wrap = (before: string, after: string, placeholder: string) => (selection: string) => {
  const inner = selection || placeholder;
  return {
    text: `${before}${inner}${after}`,
    select: [before.length, before.length + inner.length] as [number, number],
  };
};

/** Setzt ein Präfix vor jede Zeile der Auswahl. */
const prefixLines =
  (prefix: (index: number) => string, placeholder: string) => (selection: string) => {
    const lines = (selection || placeholder).split('\n');
    return { text: lines.map((line, i) => prefix(i) + line).join('\n') };
  };

@Component({
  selector: 'app-wiki-editor-page',
  imports: [
    RouterLink,
    FormsModule,
    MatButton,
    MatIconButton,
    MatIcon,
    MatCard,
    MatCardContent,
    MatFormField,
    MatLabel,
    MatInput,
    MatTooltip,
    MarkdownView,
    PageHeader,
  ],
  templateUrl: './wiki-editor-page.html',
  styleUrl: './wiki-editor-page.scss',
})
export class WikiEditorPage implements OnInit {
  private readonly wikiController = inject(WikiService);
  private readonly router = inject(Router);
  public readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('editor');

  public readonly isNew = !this.id;
  public readonly title = signal('');
  public readonly category = signal('');
  public readonly content = signal('');
  public readonly categories = signal<string[]>([]);
  public readonly saving = signal(false);
  public readonly error = signal<string | null>(null);

  public readonly actions: ToolbarAction[] = [
    {
      icon: 'format-header-2',
      label: 'Überschrift',
      apply: prefixLines(() => '## ', 'Überschrift'),
    },
    { icon: 'format-bold', label: 'Fett', apply: wrap('**', '**', 'fetter Text') },
    { icon: 'format-italic', label: 'Kursiv', apply: wrap('_', '_', 'kursiver Text') },
    { icon: 'format-list-bulleted', label: 'Liste', apply: prefixLines(() => '- ', 'Punkt') },
    {
      icon: 'format-list-numbered',
      label: 'Nummerierte Liste',
      apply: prefixLines((i) => `${i + 1}. `, 'Schritt'),
    },
    {
      icon: 'format-list-checks',
      label: 'Checkliste',
      apply: prefixLines(() => '- [ ] ', 'Aufgabe'),
    },
    { icon: 'link-variant', label: 'Link', apply: wrap('[', '](https://)', 'Linktext') },
    { icon: 'code-tags', label: 'Code', apply: wrap('`', '`', 'Code') },
  ];

  async ngOnInit() {
    const pages = await lastValueFrom(this.wikiController.apiWikiGet());
    this.categories.set(
      [...new Set(pages.map((p) => p.category).filter((c): c is string => !!c))].sort(),
    );

    if (this.id) {
      const page = await lastValueFrom(this.wikiController.apiWikiIdGet({ id: this.id }));
      this.title.set(page.title);
      this.category.set(page.category ?? '');
      this.content.set(page.content);
    }
  }

  public apply(action: ToolbarAction) {
    const textarea = this.textarea()?.nativeElement;
    if (!textarea) return;

    const { selectionStart: start, selectionEnd: end, value } = textarea;
    const result = action.apply(value.slice(start, end));
    const next = value.slice(0, start) + result.text + value.slice(end);
    this.content.set(next);

    // Nach dem Rendern Fokus und Auswahl wiederherstellen.
    requestAnimationFrame(() => {
      textarea.focus();
      const [from, to] = result.select ?? [result.text.length, result.text.length];
      textarea.setSelectionRange(start + from, start + to);
    });
  }

  public async save() {
    if (!this.title().trim()) return;

    this.saving.set(true);
    this.error.set(null);
    const request = {
      title: this.title().trim(),
      category: this.category().trim() || null,
      content: this.content(),
    };

    try {
      const page = this.id
        ? await lastValueFrom(
            this.wikiController.apiWikiIdPut({ id: this.id, upsertWikiPageRequest: request }),
          )
        : await lastValueFrom(this.wikiController.apiWikiPost({ upsertWikiPageRequest: request }));
      await this.router.navigate(['/wiki', page.id]);
    } catch {
      this.error.set('Die Seite konnte nicht gespeichert werden.');
    } finally {
      this.saving.set(false);
    }
  }
}
