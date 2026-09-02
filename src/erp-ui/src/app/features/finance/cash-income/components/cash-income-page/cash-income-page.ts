import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { lastValueFrom } from 'rxjs';
import {
  DataGrid,
  GridActionCellDirective,
  GridColumn,
} from '../../../../../shared/components/data-grid/data-grid';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { DialogService } from '../../../../../core/services/dialog-service';
import {
  BookingDto,
  BookingsService,
  CashIncomeRequest,
  CashIncomeSource,
} from '../../../../../../../projects/api/src/lib';
import {
  CASH_INCOME_SOURCE_LABELS,
  formatCurrency,
  formatDate,
  MONTH_LABELS,
} from '../../../../../shared/models/finance';
import { CashIncomeDialog } from '../cash-income-dialog/cash-income-dialog';

interface SourceAmount {
  source: CashIncomeSource;
  label: string;
  amount: number;
}

interface MonthSummary {
  month: number;
  label: string;
  sources: SourceAmount[];
  total: number;
}

@Component({
  selector: 'app-cash-income-page',
  imports: [
    DataGrid,
    GridActionCellDirective,
    FormsModule,
    MatButton,
    MatIcon,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatOption,
    MatSelect,
    MatTooltip,
    PageHeader,
  ],
  templateUrl: './cash-income-page.html',
  styleUrl: './cash-income-page.scss',
})
export class CashIncomePage {
  private readonly bookingController = inject(BookingsService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogService = inject(DialogService);

  public readonly sourceTemplate = viewChild<TemplateRef<any>>('sourceTemplate');

  public readonly entries = signal<BookingDto[]>([]);
  public readonly columns = signal<GridColumn<BookingDto>[]>([]);
  public readonly error = signal<string | null>(null);

  public readonly year = signal<number>(new Date().getFullYear());
  public readonly years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  public readonly formatCurrency = formatCurrency;

  public sourceLabel(source: CashIncomeSource): string {
    return CASH_INCOME_SOURCE_LABELS[source];
  }

  public readonly total = computed(() =>
    this.entries().reduce((sum, entry) => sum + entry.amount, 0),
  );

  /** Die jüngsten Monate mit Einnahmen, aufgeschlüsselt nach Quelle. */
  public readonly monthSummaries = computed<MonthSummary[]>(() => {
    const months = [...new Set(this.entries().map((e) => new Date(e.date).getMonth()))].sort(
      (a, b) => b - a,
    );

    return months.slice(0, 3).map((month) => {
      const entries = this.entries().filter((e) => new Date(e.date).getMonth() === month);

      return {
        month,
        label: `${MONTH_LABELS[month]} ${this.year()}`,
        sources: Object.values(CashIncomeSource).map((source) => ({
          source,
          label: CASH_INCOME_SOURCE_LABELS[source],
          amount: entries
            .filter((e) => e.source === source)
            .reduce((sum, e) => sum + e.amount, 0),
        })),
        total: entries.reduce((sum, e) => sum + e.amount, 0),
      };
    });
  });

  public async ngOnInit() {
    this.columns.set([
      { key: 'date', label: 'Datum', width: '9rem', value: (row) => formatDate(row.date) },
      { key: 'source', label: 'Typ', width: '11rem', cellTemplate: this.sourceTemplate() },
      { key: 'description', label: 'Beschreibung' },
      { key: 'cashBookName', label: 'Kasse', value: (row) => row.cashBookName ?? '—' },
      { key: 'categoryName', label: 'Kategorie', value: (row) => row.categoryName ?? '—' },
      {
        key: 'amount',
        label: 'Betrag',
        align: 'end',
        width: '9rem',
        value: (row) => formatCurrency(row.amount),
      },
    ]);

    await this.fetchItems();
  }

  public async fetchItems() {
    const bookings = await lastValueFrom(
      this.bookingController.apiBookingsGet({ year: this.year() }),
    );

    this.entries.set(bookings.filter((booking) => booking.source));
  }

  public async openAdd() {
    const request = await lastValueFrom(
      this.dialog
        .open(CashIncomeDialog, { width: '760px', maxWidth: '95vw', maxHeight: '90vh' })
        .afterClosed(),
    );

    if (!request) return;

    this.error.set(null);

    try {
      await lastValueFrom(
        this.bookingController.apiBookingsCashIncomePost({
          cashIncomeRequest: request as CashIncomeRequest,
        }),
      );
    } catch (error: any) {
      this.error.set(
        typeof error?.error === 'string'
          ? error.error
          : 'Die Einnahmen konnten nicht gebucht werden.',
      );
      return;
    }

    await this.fetchItems();
  }

  public async openDelete(booking: BookingDto) {
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Einnahme löschen',
      message: `„${booking.description}" wirklich löschen?`,
      confirmLabel: 'Löschen',
    });

    if (!confirmed) return;

    await lastValueFrom(this.bookingController.apiBookingsIdDelete({ id: booking.id }));
    await this.fetchItems();
  }
}
