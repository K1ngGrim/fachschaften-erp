import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { lastValueFrom } from 'rxjs';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { MetricCard } from '../../../shared/components/metric-card/metric-card';
import {
  BookingsService,
  BookingSummaryDto,
  CashBookDto,
  CashBooksService,
  DeliveriesService,
  DeliveryOverviewDto,
  StockOverviewDto,
  StockService,
} from '../../../../../projects/api/src/lib';
import { formatCurrency, formatDate } from '../../../shared/models/finance';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatButton,
    MatIcon,
    MetricCard,
    PageHeader,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly stockController = inject(StockService);
  private readonly deliveryController = inject(DeliveriesService);
  private readonly cashBookController = inject(CashBooksService);
  private readonly bookingController = inject(BookingsService);
  private readonly router = inject(Router);

  public readonly stock = signal<StockOverviewDto[]>([]);
  public readonly deliveries = signal<DeliveryOverviewDto[]>([]);
  public readonly cashBooks = signal<CashBookDto[]>([]);
  public readonly summary = signal<BookingSummaryDto | null>(null);

  public readonly formatCurrency = formatCurrency;
  public readonly formatDate = formatDate;

  public readonly inventoryValue = computed(() =>
    this.stock().reduce((sum, entry) => sum + entry.stock * entry.purchasePrice, 0),
  );

  public readonly totalUnits = computed(() =>
    this.stock().reduce((sum, entry) => sum + entry.stock, 0),
  );

  public readonly lowStock = computed(() =>
    this.stock()
      .filter((entry) => entry.stock <= entry.threshold)
      .sort((a, b) => a.stock - a.threshold - (b.stock - b.threshold)),
  );

  public readonly cashTotal = computed(() =>
    this.cashBooks()
      .filter((book) => !book.isClosed)
      .reduce((sum, book) => sum + book.balance, 0),
  );

  public readonly recentDeliveries = computed(() => this.deliveries().slice(0, 5));

  public async ngOnInit() {
    const [stock, deliveries, cashBooks, summary] = await Promise.all([
      lastValueFrom(this.stockController.apiStockGet()),
      lastValueFrom(this.deliveryController.apiDeliveriesGet()),
      lastValueFrom(this.cashBookController.apiCashBooksGet()),
      lastValueFrom(
        this.bookingController.apiBookingsSummaryGet({ year: new Date().getFullYear() }),
      ),
    ]);

    this.stock.set(stock);
    this.deliveries.set(deliveries);
    this.cashBooks.set(cashBooks);
    this.summary.set(summary);
  }

  public isCritical(entry: StockOverviewDto): boolean {
    return entry.stock <= entry.threshold / 2;
  }

  public async goTo(route: string) {
    await this.router.navigate([route]);
  }
}
