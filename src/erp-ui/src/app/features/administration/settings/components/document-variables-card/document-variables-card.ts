import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { lastValueFrom } from 'rxjs';
import {
  DocumentLibraryService,
  DocumentVariableDto,
} from '../../../../../../../projects/api/src/lib';

interface EditableVariable {
  uid: string;
  key: string;
  value: string;
  description: string;
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

/** Werte für alle Vorlagen, z. B. Anschrift oder Bankverbindung: <c>daten.variablen.&lt;name&gt;</c>. */
@Component({
  selector: 'app-document-variables-card',
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
    MatInput,
  ],
  templateUrl: './document-variables-card.html',
  styleUrl: './document-variables-card.scss',
})
export class DocumentVariablesCard implements OnInit {
  private readonly libraryController = inject(DocumentLibraryService);

  protected readonly variables = signal<EditableVariable[]>([]);
  protected readonly saved = signal('');
  protected readonly saving = signal(false);
  protected readonly message = signal<{ text: string; ok: boolean } | null>(null);

  private readonly snapshot = computed(() =>
    JSON.stringify(
      this.variables().map(({ key, value, description }) => [key, value, description]),
    ),
  );
  protected readonly dirty = computed(() => this.snapshot() !== this.saved());

  protected readonly problem = computed<string | null>(() => {
    const keys = this.variables().map((v) => v.key.trim());
    const invalid = keys.find((k) => !KEY_PATTERN.test(k));
    if (invalid !== undefined) {
      return `„${invalid || '(leer)'}“: Namen beginnen mit einem Buchstaben, danach nur a–z, 0–9 und _.`;
    }
    const duplicate = keys.find((k, i) => keys.indexOf(k) !== i);
    if (duplicate) return `„${duplicate}“ kommt doppelt vor.`;
    return null;
  });

  async ngOnInit() {
    this.apply(await lastValueFrom(this.libraryController.apiDocumentsVariablesGet()));
  }

  protected update(index: number, patch: Partial<EditableVariable>) {
    this.variables.update((list) => list.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  protected add() {
    this.variables.update((list) => [
      ...list,
      { uid: crypto.randomUUID(), key: '', value: '', description: '' },
    ]);
  }

  protected remove(index: number) {
    this.variables.update((list) => list.filter((_, i) => i !== index));
  }

  protected move(index: number, direction: -1 | 1) {
    this.variables.update((list) => {
      const target = index + direction;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  protected async save() {
    if (this.problem() || this.saving()) return;
    this.saving.set(true);
    this.message.set(null);
    try {
      const saved = await lastValueFrom(
        this.libraryController.apiDocumentsVariablesPut({
          documentVariableDto: this.variables().map((v) => ({
            key: v.key.trim(),
            value: v.value,
            description: v.description.trim() || null,
          })),
        }),
      );
      this.apply(saved);
      this.message.set({ text: 'Die Variablen sind gespeichert.', ok: true });
    } catch (error) {
      this.message.set({
        text:
          error instanceof HttpErrorResponse && typeof error.error === 'string'
            ? `Nicht gespeichert: ${error.error}`
            : 'Die Variablen konnten nicht gespeichert werden.',
        ok: false,
      });
    } finally {
      this.saving.set(false);
    }
  }

  private apply(variables: DocumentVariableDto[]) {
    this.variables.set(
      variables.map((v) => ({
        uid: crypto.randomUUID(),
        key: v.key,
        value: v.value,
        description: v.description ?? '',
      })),
    );
    this.saved.set(this.snapshot());
  }
}
