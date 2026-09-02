import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
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
import { BookingDto, BookingsService, TaxArea } from '../../../../../../../projects/api/src/lib';
import {
  formatCurrency,
  formatDate,
  MONTH_LABELS,
  TAX_AREA_HINTS,
  TAX_AREA_LABELS,
} from '../../../../../shared/models/finance';
import { BookingDialog, BookingDialogData } from '../booking-dialog/booking-dialog';

type DirectionFilter = 'all' | 'income' | 'expense';

interface TaxAreaCard {
  taxArea: TaxArea;
  label: string;
  hint: string;
  icon: string;
  income: number;
  expense: number;
  balance: number;
  count: number;
}

@Component({
  selector: 'app-bookings-page',
  imports: [
    DataGrid,
    GridActionCellDirective,
    FormsModule,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatIcon,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatOption,
    MatSelect,
    MatTooltip,
    PageHeader,
  ],
  templateUrl: './bookings-page.html',
  styleUrl: './bookings-page.scss',
})
export class BookingsPage {
  private readonly bookingController = inject(BookingsService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogService = inject(DialogService);

  private static readonly TAX_AREA_ICONS: Record<TaxArea, string> = {
    [TaxArea.Ideell]: 'hand-heart',
    [TaxArea.Zweckbetrieb]: 'trophy-outline',
    [TaxArea.Wirtschaftsbetrieb]: 'briefcase-outline',
  };

  /** Alle Buchungen des gewählten Jahres; gefiltert wird im Browser. */
  private readonly allBookings = signal<BookingDto[]>([]);

  public readonly columns = signal<GridColumn<BookingDto>[]>([]);
  public readonly error = signal<string | null>(null);

  public readonly year = signal<number>(new Date().getFullYear());
  public readonly month = signal<number | null>(null);
  public readonly direction = signal<DirectionFilter>('all');
  public readonly taxAreaFilter = signal<TaxArea | null>(null);

  public readonly months = MONTH_LABELS.map((label, index) => ({ label, value: index + 1 }));
  public readonly years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  public readonly formatCurrency = formatCurrency;
  public readonly taxAreaLabels = TAX_AREA_LABELS;

  /** Umbuchungen zwischen Kassenbüchern sind kein Geldfluss und bleiben aussen vor. */
  private readonly realBookings = computed(() =>
    this.allBookings().filter((booking) => !booking.transferGroupId),
  );

  public readonly taxAreaCards = computed<TaxAreaCard[]>(() =>
    Object.values(TaxArea).map((taxArea) => {
      const entries = this.realBookings().filter((booking) => booking.taxArea === taxArea);
      const income = entries.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
      const expense = entries.filter((e) => e.amount < 0).reduce((sum, e) => sum - e.amount, 0);

      return {
        taxArea,
        label: TAX_AREA_LABELS[taxArea],
        hint: TAX_AREA_HINTS[taxArea],
        icon: BookingsPage.TAX_AREA_ICONS[taxArea],
        income,
        expense,
        balance: income - expense,
        count: entries.length,
      };
    }),
  );

  public readonly bookings = computed(() => {
    const month = this.month();
    const direction = this.direction();
    const taxArea = this.taxAreaFilter();

    return this.allBookings().filter((booking) => {
      if (month !== null && new Date(booking.date).getMonth() + 1 !== month) return false;
      if (taxArea !== null && booking.taxArea !== taxArea) return false;
      if (direction === 'income' && booking.amount <= 0) return false;
      if (direction === 'expense' && booking.amount >= 0) return false;
      return true;
    });
  });

  public readonly income = computed(() =>
    this.taxAreaCards().reduce((sum, card) => sum + card.income, 0),
  );

  public readonly expense = computed(() =>
    this.taxAreaCards().reduce((sum, card) => sum + card.expense, 0),
  );

  public readonly balance = computed(() => this.income() - this.expense());

  public async ngOnInit() {
    this.columns.set([
      { key: 'date', label: 'Datum', width: '9rem', value: (row) => formatDate(row.date) },
      { key: 'description', label: 'Beschreibung' },
      {
        key: 'taxArea',
        label: 'Bereich',
        value: (row) => (row.taxArea ? TAX_AREA_LABELS[row.taxArea] : 'Umbuchung'),
      },
      { key: 'categoryName', label: 'Kategorie', value: (row) => row.categoryName ?? '—' },
      { key: 'cashBookName', label: 'Kasse', value: (row) => row.cashBookName ?? '—' },
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

    this.allBookings.set(bookings);
  }

  public toggleTaxArea(taxArea: TaxArea) {
    this.taxAreaFilter.update((current) => (current === taxArea ? null : taxArea));
  }

  public async openAdd() {
    const result = await this.openDialog(null);
    if (!result) return;

    await this.save(null, result);
  }

  public async openEdit(booking: BookingDto) {
    if (booking.transferGroupId) {
      this.error.set('Umbuchungen zwischen Kassenbüchern können nicht bearbeitet werden.');
      return;
    }

    const result = await this.openDialog(booking);
    if (!result) return;

    await this.save(booking.id, result);
  }

  private async save(id: string | null, value: BookingDto) {
    this.error.set(null);

    try {
      await lastValueFrom(
        this.bookingController.apiBookingsPost({
          itemUpsertRequestOfBookingDto: { id, value },
        }),
      );
    } catch (error: any) {
      this.error.set(
        typeof error?.error === 'string'
          ? error.error
          : 'Die Buchung konnte nicht gespeichert werden.',
      );
      return;
    }

    await this.fetchItems();
  }

  public async openDelete(booking: BookingDto) {
    const isTransfer = !!booking.transferGroupId;

    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Buchung löschen',
      message: isTransfer
        ? 'Das ist eine Umbuchung — die Gegenbuchung wird ebenfalls entfernt.'
        : `„${booking.description}" wirklich löschen?`,
      confirmLabel: 'Löschen',
    });

    if (!confirmed) return;

    await lastValueFrom(this.bookingController.apiBookingsIdDelete({ id: booking.id }));
    await this.fetchItems();
  }

  public openReceipt(booking: BookingDto) {
    if (!booking.receiptUrl) return;
    window.open(booking.receiptUrl, '_blank', 'noopener');
  }

  private async openDialog(booking: BookingDto | null): Promise<BookingDto | undefined> {
    return lastValueFrom(
      this.dialog
        .open(BookingDialog, {
          width: '760px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          data: { booking } satisfies BookingDialogData,
        })
        .afterClosed(),
    );
  }
}
