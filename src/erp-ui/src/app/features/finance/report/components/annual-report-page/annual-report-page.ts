import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { lastValueFrom } from 'rxjs';
import {
  AnnualReportDto,
  BookingDto,
  BookingsService,
  CategorySummaryDto,
  ReportsService,
  TaxArea,
} from '../../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { Organization } from '../../../../../core/services/organization';
import { formatCurrency, TAX_AREA_LABELS } from '../../../../../shared/models/finance';
import { downloadText } from '../../../../../shared/models/download';

interface CategoryGroup {
  taxArea: TaxArea | null;
  label: string;
  categories: CategorySummaryDto[];
}

@Component({
  selector: 'app-annual-report-page',
  imports: [
    FormsModule,
    MatButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    PageHeader,
  ],
  templateUrl: './annual-report-page.html',
  styleUrl: './annual-report-page.scss',
})
export class AnnualReportPage implements OnInit {
  private readonly reportsController = inject(ReportsService);
  private readonly bookingsController = inject(BookingsService);
  public readonly organization = inject(Organization).settings;

  private readonly currentYear = new Date().getFullYear();
  public readonly years = Array.from({ length: 6 }, (_, i) => this.currentYear - i);
  public readonly year = signal(this.currentYear);
  public readonly report = signal<AnnualReportDto | null>(null);
  public readonly loading = signal(false);
  public readonly generatedAt = new Date().toLocaleDateString('de-DE');

  public readonly formatCurrency = formatCurrency;
  public readonly taxAreaLabel = (area: TaxArea | null | undefined) =>
    area ? TAX_AREA_LABELS[area] : 'Ohne Steuerbereich';

  public readonly categoryGroups = computed<CategoryGroup[]>(() => {
    const groups = new Map<string, CategoryGroup>();
    for (const category of this.report()?.categories ?? []) {
      const key = category.taxArea ?? '';
      const group = groups.get(key) ?? {
        taxArea: category.taxArea ?? null,
        label: this.taxAreaLabel(category.taxArea),
        categories: [],
      };
      group.categories.push(category);
      groups.set(key, group);
    }
    return [...groups.values()];
  });

  public readonly cashTotals = computed(() => {
    const books = this.report()?.cashBooks ?? [];
    const sum = (pick: (b: (typeof books)[number]) => number) =>
      books.reduce((total, b) => total + pick(b), 0);
    return {
      opening: sum((b) => b.opening),
      inflow: sum((b) => b.inflow),
      outflow: sum((b) => b.outflow),
      closing: sum((b) => b.closing),
    };
  });

  async ngOnInit() {
    await this.load();
  }

  public async changeYear(year: number) {
    this.year.set(year);
    await this.load();
  }

  public print() {
    window.print();
  }

  /** Alle Buchungen des Jahres als CSV für Excel (Semikolon, Dezimalkomma, BOM). */
  public async downloadBookings() {
    const bookings = await lastValueFrom(
      this.bookingsController.apiBookingsGet({ year: this.year() }),
    );
    const rows = [...bookings].sort((a, b) => a.date.localeCompare(b.date));
    const amount = (value: number) => (value === 0 ? '' : value.toFixed(2).replace('.', ','));
    const escape = (text: string) =>
      /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

    const header = [
      'Datum',
      'Beschreibung',
      'Steuerbereich',
      'Kategorie',
      'Kasse',
      'Einnahme',
      'Ausgabe',
      'Umbuchung',
      'Beleg',
    ];
    const lines = rows.map((b: BookingDto) =>
      [
        csvDate(b.date),
        b.description ?? '',
        b.transferGroupId ? '' : this.taxAreaLabel(b.taxArea),
        b.categoryName ?? '',
        b.cashBookName ?? '',
        amount(b.amount > 0 ? b.amount : 0),
        amount(b.amount < 0 ? -b.amount : 0),
        b.transferGroupId ? 'ja' : '',
        b.receiptUrl ?? '',
      ]
        .map((cell) => escape(String(cell)))
        .join(';'),
    );

    downloadText(
      `buchungen-${this.year()}.csv`,
      '﻿' + [header.join(';'), ...lines].join('\r\n'),
      'text/csv',
    );
  }

  private async load() {
    this.loading.set(true);
    try {
      this.report.set(
        await lastValueFrom(this.reportsController.apiReportsAnnualGet({ year: this.year() })),
      );
    } finally {
      this.loading.set(false);
    }
  }
}

/** Datum wie gespeichert (UTC) als TT.MM.JJJJ, passend zur Jahresabgrenzung des Berichts. */
function csvDate(iso: string): string {
  const [year, month, day] = iso.substring(0, 10).split('-');
  return `${day}.${month}.${year}`;
}
