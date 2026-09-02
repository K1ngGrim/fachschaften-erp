import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { lastValueFrom } from 'rxjs';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { DialogService } from '../../../../../core/services/dialog-service';
import { ItemDialogConfig } from '../../../../../shared/components/base-item-dialog/base-item-dialog';
import { CashBookDto, CashBooksService } from '../../../../../../../projects/api/src/lib';
import { formatCurrency, fromDateInput, toDateInput } from '../../../../../shared/models/finance';
import { EMPTY_GUID } from '../../../../../shared/models/guid';

interface CashBookForm {
  name: string;
  parentId: string | null;
  openingAmount: number;
}

interface TransferForm {
  fromCashBookId: string;
  toCashBookId: string;
  amount: number;
  date: string;
  description: string;
}

/** Eine Hauptkasse mit ihren Unterkassen. */
interface CashBookGroup {
  book: CashBookDto;
  children: CashBookDto[];
}

@Component({
  selector: 'app-cash-books-page',
  imports: [NgTemplateOutlet, MatButton, MatIcon, MatIconButton, MatTooltip, PageHeader],
  templateUrl: './cash-books-page.html',
  styleUrl: './cash-books-page.scss',
})
export class CashBooksPage {
  private readonly cashBookController = inject(CashBooksService);
  private readonly dialogService = inject(DialogService);

  public readonly cashBooks = signal<CashBookDto[]>([]);
  public readonly error = signal<string | null>(null);
  public readonly showClosed = signal(false);

  public readonly formatCurrency = formatCurrency;

  public readonly openBooks = computed(() => this.cashBooks().filter((book) => !book.isClosed));

  public readonly closedBooks = computed(() => this.cashBooks().filter((book) => book.isClosed));

  public readonly groups = computed<CashBookGroup[]>(() =>
    this.openBooks()
      .filter((book) => book.parentId === null)
      .map((book) => ({
        book,
        children: this.openBooks().filter((child) => child.parentId === book.id),
      })),
  );

  public readonly totalBalance = computed(() =>
    this.openBooks().reduce((sum, book) => sum + book.balance, 0),
  );

  public async ngOnInit() {
    await this.fetchItems();
  }

  private async fetchItems() {
    const cashBooks = await lastValueFrom(this.cashBookController.apiCashBooksGet());
    this.cashBooks.set(cashBooks);
  }

  private getCashBookConfig(cashBook?: CashBookDto): ItemDialogConfig<CashBookForm> {
    const parents = this.openBooks()
      .filter((book) => book.parentId === null && book.id !== cashBook?.id)
      .map((book) => ({ label: book.name, value: book.id as string | null }));

    const fields: ItemDialogConfig<CashBookForm>['fields'] = [
      { key: 'name', label: 'Name', type: 'text', required: true, cssClasses: 'col-12' },
      {
        key: 'parentId',
        label: 'Untergeordnet zu',
        type: 'select',
        cssClasses: 'col-12',
        options: [{ label: 'Eigenständige Kasse', value: null }, ...parents],
      },
    ];

    if (!cashBook) {
      fields.push({
        key: 'openingAmount',
        label: 'Wechselgeld aus übergeordneter Kasse',
        type: 'number',
        cssClasses: 'col-12',
        min: 0,
      });
    }

    return {
      title: cashBook ? 'Kassenbuch bearbeiten' : 'Neues Kassenbuch',
      data: cashBook
        ? { name: cashBook.name, parentId: cashBook.parentId ?? null, openingAmount: 0 }
        : { parentId: null, openingAmount: 0 },
      fields,
    };
  }

  public async openAdd(parent?: CashBookDto) {
    const config = this.getCashBookConfig();
    if (parent) config.data = { parentId: parent.id, openingAmount: 0 };

    const result = await this.dialogService.openDialog<CashBookForm>(config);
    if (!result) return;

    await this.save(null, result);
  }

  public async openEdit(cashBook: CashBookDto) {
    const result = await this.dialogService.openDialog<CashBookForm>(
      this.getCashBookConfig(cashBook),
    );
    if (!result) return;

    await this.save(cashBook.id, result);
  }

  private async save(id: string | null, value: Partial<CashBookForm>) {
    await this.run(() =>
      lastValueFrom(
        this.cashBookController.apiCashBooksPost({
          itemUpsertRequestOfCashBookUpsertDto: {
            id,
            value: {
              id: id ?? EMPTY_GUID,
              name: value.name!,
              parentId: value.parentId ?? null,
              openingAmount: Number(value.openingAmount ?? 0),
            },
          },
        }),
      ),
    );
  }

  public async openTransfer(from?: CashBookDto) {
    const options = this.openBooks().map((book) => ({ label: book.name, value: book.id }));

    const result = await this.dialogService.openDialog<TransferForm>({
      title: 'Geld umbuchen',
      data: {
        date: toDateInput(null),
        amount: 0,
        description: 'Umbuchung',
        fromCashBookId: from?.id,
      },
      fields: [
        {
          key: 'fromCashBookId',
          label: 'Von',
          type: 'select',
          required: true,
          cssClasses: 'col-12 col-md-6',
          options,
        },
        {
          key: 'toCashBookId',
          label: 'Nach',
          type: 'select',
          required: true,
          cssClasses: 'col-12 col-md-6',
          options,
        },
        {
          key: 'amount',
          label: 'Betrag (€)',
          type: 'number',
          required: true,
          cssClasses: 'col-12 col-md-6',
          min: 0,
        },
        { key: 'date', label: 'Datum', type: 'date', required: true, cssClasses: 'col-12 col-md-6' },
        {
          key: 'description',
          label: 'Verwendungszweck',
          type: 'text',
          required: true,
          cssClasses: 'col-12',
        },
      ],
    });

    if (!result) return;

    await this.run(() =>
      lastValueFrom(
        this.cashBookController.apiCashBooksTransferPost({
          cashBookTransferRequest: {
            fromCashBookId: result.fromCashBookId!,
            toCashBookId: result.toCashBookId!,
            amount: Number(result.amount),
            date: fromDateInput(result.date!),
            description: result.description!,
          },
        }),
      ),
    );
  }

  public async close(cashBook: CashBookDto) {
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Kassenbuch schließen',
      message:
        `„${cashBook.name}" wird geschlossen. Ein Restbestand von ` +
        `${formatCurrency(cashBook.balance)} wird an die übergeordnete Kasse zurückgebucht.`,
      confirmLabel: 'Schließen',
    });
    if (!confirmed) return;

    await this.run(() =>
      lastValueFrom(this.cashBookController.apiCashBooksIdClosePost({ id: cashBook.id })),
    );
  }

  public async openDelete(cashBook: CashBookDto) {
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Kassenbuch löschen',
      message: `„${cashBook.name}" wirklich löschen?`,
      confirmLabel: 'Löschen',
    });
    if (!confirmed) return;

    await this.run(() =>
      lastValueFrom(this.cashBookController.apiCashBooksIdDelete({ id: cashBook.id })),
    );
  }

  private async run(action: () => Promise<unknown>) {
    this.error.set(null);

    try {
      await action();
    } catch (error: any) {
      this.error.set(
        typeof error?.error === 'string' ? error.error : 'Die Aktion war nicht möglich.',
      );
    }

    await this.fetchItems();
  }
}
