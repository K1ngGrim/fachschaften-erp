import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatFormField, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { lastValueFrom } from 'rxjs';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { MetricCard } from '../../../../../shared/components/metric-card/metric-card';
import {
  BookingsService,
  BookingSummaryDto,
  CashBookDto,
  CashBooksService,
} from '../../../../../../../projects/api/src/lib';
import {
  formatCurrency,
  MONTH_LABELS,
  TAX_AREA_HINTS,
  TAX_AREA_LABELS,
} from '../../../../../shared/models/finance';

@Component({
  selector: 'app-finance-dashboard-page',
  imports: [
    FormsModule,
    BaseChartDirective,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatFormField,
    MatLabel,
    MatOption,
    MatSelect,
    MetricCard,
    PageHeader,
  ],
  templateUrl: './finance-dashboard-page.html',
  styleUrl: './finance-dashboard-page.scss',
})
export class FinanceDashboardPage {
  private readonly bookingController = inject(BookingsService);
  private readonly cashBookController = inject(CashBooksService);

  public readonly summary = signal<BookingSummaryDto | null>(null);
  public readonly cashBooks = signal<CashBookDto[]>([]);

  public readonly year = signal<number>(new Date().getFullYear());
  public readonly years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  public readonly taxAreaLabels = TAX_AREA_LABELS;
  public readonly taxAreaHints = TAX_AREA_HINTS;
  public readonly formatCurrency = formatCurrency;

  public readonly cashTotal = computed(() =>
    this.cashBooks()
      .filter((book) => !book.isClosed)
      .reduce((sum, book) => sum + book.balance, 0),
  );

  public readonly openCashBooks = computed(() =>
    this.cashBooks().filter((book) => !book.isClosed),
  );

  public readonly chartData = computed<ChartData<'bar'>>(() => {
    const months = this.summary()?.byMonth ?? [];

    return {
      labels: MONTH_LABELS,
      datasets: [
        {
          label: 'Einnahmen',
          data: months.map((month) => month.income),
          backgroundColor: '#e8912a',
          borderRadius: 4,
        },
        {
          label: 'Ausgaben',
          data: months.map((month) => month.expense),
          backgroundColor: '#1f2437',
          borderRadius: 4,
        },
      ],
    };
  });

  public readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y ?? 0) } },
    },
    scales: {
      y: { ticks: { callback: (value) => formatCurrency(Number(value)) } },
    },
  };

  public async ngOnInit() {
    await this.fetch();
  }

  public async fetch() {
    const [summary, cashBooks] = await Promise.all([
      lastValueFrom(this.bookingController.apiBookingsSummaryGet({ year: this.year() })),
      lastValueFrom(this.cashBookController.apiCashBooksGet()),
    ]);

    this.summary.set(summary);
    this.cashBooks.set(cashBooks);
  }
}
