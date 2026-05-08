import { Component, computed, inject } from '@angular/core';
import { MetricCard } from '../metric-card/metric-card';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { BaseChartDirective } from 'ng2-charts';
import {
  BarElement,
  CategoryScale,
  Chart,
  ChartData,
  ChartOptions,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { DataService } from '../../../shared/services/data.service';

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

@Component({
  selector: 'app-dashboard-page',
  imports: [
    MetricCard,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatIcon,
    MatChip,
    MatChipSet,
    BaseChartDirective,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  readonly data = inject(DataService);

  readonly monthly = this.data.monthlyData;
  readonly currentMonth = computed(() => this.monthly()[this.monthly().length - 1]);
  readonly totalRevenue = computed(() => this.monthly().reduce((s, m) => s + m.revenue, 0));
  readonly totalExpenses = computed(() => this.monthly().reduce((s, m) => s + m.expenses, 0));
  readonly inventoryValue = computed(() =>
    this.data.products().reduce((s, p) => s + p.stock * p.purchasePrice, 0),
  );
  readonly totalStockUnits = computed(() => this.data.products().reduce((s, p) => s + p.stock, 0));
  readonly lowStockProducts = computed(() =>
    this.data.products().filter((p) => p.trackStock && p.stock <= p.lowStockThreshold),
  );
  readonly topSelling = computed(() => this.data.getTopSellingItems(5));

  formatCurrency = (v: number) => this.data.formatCurrency(v);

  readonly barChartData = computed<ChartData<'bar'>>(() => ({
    labels: this.monthly().map((m) => m.month),
    datasets: [
      {
        label: 'Revenue',
        data: this.monthly().map((m) => m.revenue),
        backgroundColor: '#e07b2a',
        borderRadius: 4,
      },
      {
        label: 'Expenses',
        data: this.monthly().map((m) => m.expenses),
        backgroundColor: '#1a1d2e',
        borderRadius: 4,
      },
    ],
  }));

  readonly lineChartData = computed<ChartData<'line'>>(() => ({
    labels: this.monthly().map((m) => m.month),
    datasets: [
      {
        label: 'Profit',
        data: this.monthly().map((m) => m.revenue - m.expenses),
        borderColor: '#2e7d32',
        backgroundColor: 'rgba(46,125,50,0.12)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 4,
      },
    ],
  }));

  readonly chartOptions: ChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      tooltip: { callbacks: { label: (ctx) => this.formatCurrency(ctx.parsed.y ?? 0) } },
    },
    scales: { y: { ticks: { callback: (v: string | number) => this.formatCurrency(Number(v)) } } },
  };
}
