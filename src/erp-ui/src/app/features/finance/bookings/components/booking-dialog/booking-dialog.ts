import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { lastValueFrom } from 'rxjs';
import {
  BookingCategoriesService,
  BookingCategoryDto,
  BookingDto,
  CashBookDto,
  CashBooksService,
  TaxArea,
} from '../../../../../../../projects/api/src/lib';
import {
  formatCurrency,
  fromDateInput,
  TAX_AREA_HINTS,
  taxAreaOptions,
  toDateInput,
} from '../../../../../shared/models/finance';
import { EMPTY_GUID } from '../../../../../shared/models/guid';

export interface BookingDialogData {
  booking: BookingDto | null;
}

@Component({
  selector: 'app-booking-dialog',
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatFormField,
    MatLabel,
    MatInput,
    MatOption,
    MatSelect,
  ],
  templateUrl: './booking-dialog.html',
  styleUrl: './booking-dialog.scss',
})
export class BookingDialog {
  private readonly dialogRef = inject(MatDialogRef<BookingDialog>);
  private readonly data = inject<BookingDialogData>(MAT_DIALOG_DATA);
  private readonly categoryController = inject(BookingCategoriesService);
  private readonly cashBookController = inject(CashBooksService);

  public readonly isEdit = this.data.booking !== null;

  public readonly categories = signal<BookingCategoryDto[]>([]);
  public readonly cashBooks = signal<CashBookDto[]>([]);

  public readonly taxAreas = taxAreaOptions();
  public readonly taxAreaHints = TAX_AREA_HINTS;

  public readonly direction = signal<'income' | 'expense'>(
    (this.data.booking?.amount ?? 0) < 0 ? 'expense' : 'income',
  );
  public readonly amount = signal<number>(Math.abs(this.data.booking?.amount ?? 0));
  public readonly date = signal<string>(toDateInput(this.data.booking?.date));
  public readonly description = signal<string>(this.data.booking?.description ?? '');
  public readonly taxArea = signal<TaxArea>(this.data.booking?.taxArea ?? TaxArea.Wirtschaftsbetrieb);
  public readonly categoryId = signal<string | null>(this.data.booking?.categoryId ?? null);
  public readonly cashBookId = signal<string | null>(this.data.booking?.cashBookId ?? null);
  public readonly receiptUrl = signal<string>(this.data.booking?.receiptUrl ?? '');

  public readonly availableCategories = computed(() =>
    this.categories().filter((category) => category.taxArea === this.taxArea()),
  );

  public readonly signedAmount = computed(() =>
    this.direction() === 'expense' ? -Math.abs(this.amount()) : Math.abs(this.amount()),
  );

  public readonly isValid = computed(
    () => this.amount() > 0 && this.description().trim().length > 0,
  );

  public readonly formatCurrency = formatCurrency;

  public async ngOnInit() {
    const [categories, cashBooks] = await Promise.all([
      lastValueFrom(this.categoryController.apiBookingCategoriesGet({})),
      lastValueFrom(this.cashBookController.apiCashBooksGet()),
    ]);

    this.categories.set(categories);
    this.cashBooks.set(cashBooks.filter((book) => !book.isClosed));
  }

  public setTaxArea(taxArea: TaxArea) {
    this.taxArea.set(taxArea);

    const stillValid = this.availableCategories().some(
      (category) => category.id === this.categoryId(),
    );

    if (!stillValid) this.categoryId.set(null);
  }

  public setAmount(value: unknown) {
    const parsed = Number(value);
    this.amount.set(Number.isFinite(parsed) ? Math.abs(parsed) : 0);
  }

  public save() {
    if (!this.isValid()) return;

    const booking: BookingDto = {
      id: this.data.booking?.id ?? EMPTY_GUID,
      date: fromDateInput(this.date()),
      amount: this.signedAmount(),
      description: this.description().trim(),
      taxArea: this.taxArea(),
      categoryId: this.categoryId(),
      cashBookId: this.cashBookId(),
      receiptUrl: this.receiptUrl().trim() || null,
      source: this.data.booking?.source ?? null,
      transferGroupId: null,
    };

    this.dialogRef.close(booking);
  }

  public cancel() {
    this.dialogRef.close();
  }
}
