import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { Marked } from 'marked';

/**
 * Zeigt Markdown (GitHub-Variante) als HTML an. Angular bereinigt das HTML beim Binden an
 * [innerHTML] (keine Skripte, keine Event-Handler, keine javascript:-Links).
 */
const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    // <input> würde von Angular entfernt; Aufgabenlisten deshalb als Symbole darstellen.
    checkbox({ checked }) {
      return `<span class="md-task" aria-hidden="true">${checked ? '☑' : '☐'}</span> `;
    },
  },
});

export function renderMarkdown(source: string): string {
  return markdown.parse(source ?? '', { async: false }) as string;
}

@Component({
  selector: 'app-markdown-view',
  template: `<div class="markdown-body" [innerHTML]="html()"></div>`,
  styleUrl: './markdown-view.scss',
  // Gilt für das per innerHTML eingefügte HTML, das keine Komponenten-Attribute trägt.
  encapsulation: ViewEncapsulation.None,
})
export class MarkdownView {
  public readonly content = input<string>('');
  public readonly html = computed(() => renderMarkdown(this.content()));
}
