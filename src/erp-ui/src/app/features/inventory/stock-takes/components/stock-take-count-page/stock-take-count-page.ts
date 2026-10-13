import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatFormField, MatInput, MatLabel, MatPrefix } from '@angular/material/input';
import { lastValueFrom } from 'rxjs';
import { StockService, StockTakesService } from '../../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { DialogService } from '../../../../../core/services/dialog-service';
import { formatCurrency } from '../../../../../shared/models/finance';

interface CountRow {
  productId: string;
  name: string;
  expected: number;
  purchasePrice: number;
  /** null = nicht gezählt, bleibt unverändert. */
  counted: number | null;
}

@Component({
  selector: 'app-stock-take-count-page',
  imports: [
    RouterLink,
    FormsModule,
    MatButton,
    MatIcon,
    MatCard,
    MatCardContent,
    MatFormField,
    MatLabel,
    MatInput,
    MatPrefix,
    PageHeader,
  ],
  templateUrl: './stock-take-count-page.html',
  styleUrl: './stock-take-count-page.scss',
})
export class StockTakeCountPage implements OnInit {
  private readonly stockController = inject(StockService);
  private readonly stockTakesController = inject(StockTakesService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);

  public readonly rows = signal<CountRow[]>([]);
  public readonly search = signal('');
  public readonly note = signal('');
  public readonly saving = signal(false);
  public readonly error = signal<string | null>(null);
  public readonly formatCurrency = formatCurrency;

  public readonly visibleRows = computed(() => {
    const query = this.search().trim().toLowerCase();
    return query ? this.rows().filter((r) => r.name.toLowerCase().includes(query)) : this.rows();
  });

  public readonly counted = computed(() => this.rows().filter((r) => r.counted !== null));
  public readonly differences = computed(() =>
    this.counted().filter((r) => this.difference(r) !== 0),
  );
  public readonly differenceValue = computed(() =>
    this.counted().reduce((sum, r) => sum + this.difference(r) * r.purchasePrice, 0),
  );

  async ngOnInit() {
    const stock = await lastValueFrom(this.stockController.apiStockGet());
    this.rows.set(
      stock
        .filter((s) => s.trackStock)
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
        .map((s) => ({
          productId: s.productId,
          name: s.name,
          expected: s.stock,
          purchasePrice: s.purchasePrice,
          counted: null,
        })),
    );
  }

  public difference(row: CountRow): number {
    return row.counted === null ? 0 : row.counted - row.expected;
  }

  public setCounted(productId: string, value: string | number | null) {
    const parsed = value === '' || value === null ? null : Math.max(0, Math.round(Number(value)));
    this.rows.update((rows) =>
      rows.map((r) =>
        r.productId === productId ? { ...r, counted: Number.isNaN(parsed) ? null : parsed } : r,
      ),
    );
  }

  /** Für schnelles Zählen: Soll übernehmen, wenn der Bestand stimmt. */
  public takeExpected(row: CountRow) {
    this.setCounted(row.productId, row.expected);
  }

  public async submit() {
    const counted = this.counted();
    if (counted.length === 0) return;

    const value = this.differenceValue();
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Inventur buchen',
      message:
        `${counted.length} Artikel gezählt, ${this.differences().length} mit Abweichung ` +
        `(Wert ${formatCurrency(value)}). Die Abweichungen werden als Lagerbewegung gebucht; ` +
        'nicht gezählte Artikel bleiben unverändert.',
      confirmLabel: 'Buchen',
    });
    if (!confirmed) return;

    this.saving.set(true);
    this.error.set(null);
    try {
      const result = await lastValueFrom(
        this.stockTakesController.apiStockTakesPost({
          createStockTakeRequest: {
            note: this.note().trim() || null,
            positions: counted.map((r) => ({ productId: r.productId, countedStock: r.counted! })),
          },
        }),
      );
      await this.router.navigate(['/stock-takes', result.id]);
    } catch {
      this.error.set('Die Inventur konnte nicht gebucht werden.');
    } finally {
      this.saving.set(false);
    }
  }
}
