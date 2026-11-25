import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { lastValueFrom } from 'rxjs';
import { StockHistoryDto, StockService } from '../../../../../../../projects/api/src/lib';

type RangePreset = '30' | '90' | '365' | 'custom';

/** Bestandsverlauf eines Artikels: Bestand am Ende jedes Tages im gewählten Zeitraum. */
@Component({
  selector: 'app-stock-history',
  imports: [
    FormsModule,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatFormField,
    MatLabel,
    MatInput,
    BaseChartDirective,
  ],
  templateUrl: './stock-history.html',
  styleUrl: './stock-history.scss',
})
export class StockHistory {
  private readonly stockController = inject(StockService);

  public readonly productId = input.required<string>();
  public readonly unit = input.required<string>();
  public readonly lowStockThreshold = input(0);

  public readonly preset = signal<RangePreset>('90');
  public readonly customFrom = signal(localIsoDate(daysAgo(29)));
  public readonly customTo = signal(localIsoDate(new Date()));

  public readonly loading = signal(false);
  public readonly error = signal(false);
  public readonly history = signal<StockHistoryDto | null>(null);

  /** Gewählter Zeitraum als `yyyy-MM-dd`; `null`, solange die eigene Eingabe ungültig ist. */
  public readonly range = computed<{ from: string; to: string } | null>(() => {
    const preset = this.preset();
    if (preset !== 'custom') {
      return { from: localIsoDate(daysAgo(Number(preset) - 1)), to: localIsoDate(new Date()) };
    }
    const from = this.customFrom();
    const to = this.customTo();
    return from && to && from <= to ? { from, to } : null;
  });

  public readonly chartData = computed<ChartData<'line'>>(() => {
    const points = this.history()?.points ?? [];
    const threshold = this.lowStockThreshold();

    return {
      labels: points.map((p) => formatDay(p.date)),
      datasets: [
        {
          label: `Bestand (${this.unit()})`,
          data: points.map((p) => p.stock),
          borderColor: '#e8912a',
          backgroundColor: 'rgba(232, 145, 42, 0.12)',
          fill: true,
          stepped: 'before',
          pointRadius: points.length > 60 ? 0 : 2,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
        ...(threshold > 0
          ? [
              {
                label: 'Mindestbestand',
                data: points.map(() => threshold),
                borderColor: '#d64545',
                borderDash: [6, 4],
                borderWidth: 1.5,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
              },
            ]
          : []),
      ],
    };
  });

  public readonly chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const point = this.history()?.points[items[0]?.dataIndex ?? -1];
            if (!point || (!point.incoming && !point.outgoing)) return '';
            const lines = [];
            if (point.incoming) lines.push(`Zugang: +${point.incoming}`);
            if (point.outgoing) lines.push(`Abgang: −${point.outgoing}`);
            return lines;
          },
        },
      },
    },
    scales: {
      x: { ticks: { maxTicksLimit: 10, autoSkip: true } },
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  /** Zählt Anfragen hoch, damit eine langsame ältere Antwort keine neuere überschreibt. */
  private requestId = 0;

  constructor() {
    effect(() => {
      const productId = this.productId();
      const range = this.range();
      if (range) void this.fetch(productId, range.from, range.to);
    });
  }

  public setPreset(preset: RangePreset) {
    if (preset === 'custom' && this.preset() !== 'custom') {
      const current = this.range();
      if (current) {
        this.customFrom.set(current.from);
        this.customTo.set(current.to);
      }
    }
    this.preset.set(preset);
  }

  private async fetch(productId: string, from: string, to: string) {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set(false);
    try {
      const history = await lastValueFrom(
        this.stockController.apiStockProductIdHistoryGet({ productId, from, to }),
      );
      if (id === this.requestId) this.history.set(history);
    } catch {
      if (id === this.requestId) {
        this.history.set(null);
        this.error.set(true);
      }
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/** Lokales Datum als `yyyy-MM-dd`; `toISOString` würde nach UTC verschieben. */
function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `yyyy-MM-dd` → `dd.MM.yy`, ohne Umweg über `Date` (Zeitzone). */
function formatDay(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year.slice(2)}`;
}
