import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { lastValueFrom } from 'rxjs';
import {
  BookingCategoriesService,
  BookingCategoryDto,
  CashBookDto,
  CashBooksService,
  CashIncomeRequest,
  TaxArea,
} from '../../../../../../../projects/api/src/lib';
import {
  formatCurrency,
  fromDateInput,
  taxAreaOptions,
  toDateInput,
} from '../../../../../shared/models/finance';

@Component({
  selector: 'app-cash-income-dialog',
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatOption,
    MatSelect,
  ],
  templateUrl: './cash-income-dialog.html',
  styleUrl: './cash-income-dialog.scss',
})
export class CashIncomeDialog {
  private readonly dialogRef = inject(MatDialogRef<CashIncomeDialog>);
  private readonly categoryController = inject(BookingCategoriesService);
  private readonly cashBookController = inject(CashBooksService);

  public readonly categories = signal<BookingCategoryDto[]>([]);
  public readonly cashBooks = signal<CashBookDto[]>([]);

  public readonly taxAreas = taxAreaOptions();

  public readonly date = signal<string>(toDateInput(null));
  public readonly description = signal<string>('');
  public readonly taxArea = signal<TaxArea>(TaxArea.Wirtschaftsbetrieb);
  public readonly categoryId = signal<string | null>(null);
  public readonly cashBookId = signal<string | null>(null);

  public readonly cashAmount = signal<number>(0);
  public readonly tallyListAmount = signal<number>(0);
  public readonly sumUpAmount = signal<number>(0);

  public readonly availableCategories = computed(() =>
    this.categories().filter((category) => category.taxArea === this.taxArea()),
  );

  public readonly total = computed(
    () => this.cashAmount() + this.tallyListAmount() + this.sumUpAmount(),
  );

  public readonly needsCashBook = computed(() => this.cashAmount() > 0 && !this.cashBookId());

  public readonly isValid = computed(() => this.total() > 0 && !this.needsCashBook());

  public readonly formatCurrency = formatCurrency;

  public async ngOnInit() {
    const [categories, cashBooks] = await Promise.all([
      lastValueFrom(this.categoryController.apiBookingCategoriesGet({})),
      lastValueFrom(this.cashBookController.apiCashBooksGet()),
    ]);

    this.categories.set(categories);

    const openBooks = cashBooks.filter((book) => !book.isClosed);
    this.cashBooks.set(openBooks);

    const mainBook = openBooks.find((book) => book.parentId === null);
    if (mainBook) this.cashBookId.set(mainBook.id);
  }

  public setTaxArea(taxArea: TaxArea) {
    this.taxArea.set(taxArea);

    const stillValid = this.availableCategories().some(
      (category) => category.id === this.categoryId(),
    );

    if (!stillValid) this.categoryId.set(null);
  }

  public setAmount(target: 'cash' | 'tally' | 'sumUp', value: unknown) {
    const parsed = Number(value);
    const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

    if (target === 'cash') this.cashAmount.set(amount);
    else if (target === 'tally') this.tallyListAmount.set(amount);
    else this.sumUpAmount.set(amount);
  }

  public save() {
    if (!this.isValid()) return;

    const request: CashIncomeRequest = {
      date: fromDateInput(this.date()),
      cashAmount: this.cashAmount(),
      tallyListAmount: this.tallyListAmount(),
      sumUpAmount: this.sumUpAmount(),
      taxArea: this.taxArea(),
      cashBookId: this.cashAmount() > 0 ? this.cashBookId() : null,
      categoryId: this.categoryId(),
      description: this.description().trim() || null,
    };

    this.dialogRef.close(request);
  }

  public cancel() {
    this.dialogRef.close();
  }
}
