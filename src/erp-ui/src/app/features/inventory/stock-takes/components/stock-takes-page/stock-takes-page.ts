import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { lastValueFrom } from 'rxjs';
import { StockTakesService, StockTakeSummaryDto } from '../../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { Auth } from '../../../../../core/services/auth';
import { PermissionType } from '../../../../../shared/models/permission-type';
import { formatCurrency, formatDate } from '../../../../../shared/models/finance';

@Component({
  selector: 'app-stock-takes-page',
  imports: [RouterLink, MatButton, MatIcon, MatCard, MatCardContent, PageHeader],
  templateUrl: './stock-takes-page.html',
})
export class StockTakesPage implements OnInit {
  private readonly stockTakesController = inject(StockTakesService);

  public readonly stockTakes = signal<StockTakeSummaryDto[]>([]);
  public readonly canWrite = inject(Auth).hasPermission(PermissionType.InventoryCanWrite);
  public readonly formatCurrency = formatCurrency;
  public readonly formatDate = formatDate;

  async ngOnInit() {
    this.stockTakes.set(await lastValueFrom(this.stockTakesController.apiStockTakesGet()));
  }
}
