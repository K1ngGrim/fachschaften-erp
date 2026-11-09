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
import { CashIncomeRequest } from '../../../../../../../projects/api/src/lib';
import { formatCurrency, fromDateInput, toDateInput } from '../../../../../shared/models/finance';

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
  ],
  templateUrl: './cash-income-dialog.html',
  styleUrl: './cash-income-dialog.scss',
})
export class CashIncomeDialog {
  private readonly dialogRef = inject(MatDialogRef<CashIncomeDialog>);

  public readonly date = signal<string>(toDateInput(null));
  public readonly description = signal<string>('');

  public readonly cashAmount = signal<number>(0);
  public readonly tallyListAmount = signal<number>(0);
  public readonly sumUpAmount = signal<number>(0);

  public readonly total = computed(
    () => this.cashAmount() + this.tallyListAmount() + this.sumUpAmount(),
  );

  public readonly isValid = computed(() => this.total() > 0);

  public readonly formatCurrency = formatCurrency;

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
      description: this.description().trim() || null,
    };

    this.dialogRef.close(request);
  }

  public cancel() {
    this.dialogRef.close();
  }
}
