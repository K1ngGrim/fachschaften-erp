import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { lastValueFrom } from 'rxjs';
import { StockTakeDto, StockTakesService } from '../../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { Organization } from '../../../../../core/services/organization';
import { formatCurrency, formatDate } from '../../../../../shared/models/finance';

@Component({
  selector: 'app-stock-take-page',
  imports: [RouterLink, MatButton, MatIcon, MatCard, MatCardContent, PageHeader],
  templateUrl: './stock-take-page.html',
  styleUrl: './stock-take-page.scss',
})
export class StockTakePage implements OnInit {
  private readonly stockTakesController = inject(StockTakesService);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  public readonly organization = inject(Organization).settings;

  public readonly stockTake = signal<StockTakeDto | null>(null);
  public readonly loading = signal(true);
  public readonly formatCurrency = formatCurrency;
  public readonly formatDate = formatDate;

  public readonly totals = computed(() => {
    const positions = this.stockTake()?.positions ?? [];
    return {
      differences: positions.filter((p) => p.difference !== 0).length,
      value: positions.reduce((sum, p) => sum + p.differenceValue, 0),
      countedValue: positions.reduce((sum, p) => sum + p.countedStock * p.unitPurchasePrice, 0),
    };
  });

  async ngOnInit() {
    try {
      this.stockTake.set(
        await lastValueFrom(this.stockTakesController.apiStockTakesIdGet({ id: this.id })),
      );
    } catch {
      this.stockTake.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  public print() {
    window.print();
  }
}
