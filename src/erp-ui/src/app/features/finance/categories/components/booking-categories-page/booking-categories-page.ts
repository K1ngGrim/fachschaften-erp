import { Component, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { lastValueFrom } from 'rxjs';
import {
  DataGrid,
  GridActionCellDirective,
  GridColumn,
} from '../../../../../shared/components/data-grid/data-grid';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { DialogService } from '../../../../../core/services/dialog-service';
import { ItemDialogConfig } from '../../../../../shared/components/base-item-dialog/base-item-dialog';
import {
  BookingCategoriesService,
  BookingCategoryDto,
  TaxArea,
} from '../../../../../../../projects/api/src/lib';
import { TAX_AREA_LABELS, taxAreaOptions } from '../../../../../shared/models/finance';
import { EMPTY_GUID } from '../../../../../shared/models/guid';

@Component({
  selector: 'app-booking-categories-page',
  imports: [
    DataGrid,
    GridActionCellDirective,
    MatButton,
    MatIcon,
    MatIconButton,
    MatTooltip,
    PageHeader,
  ],
  templateUrl: './booking-categories-page.html',
  styleUrl: './booking-categories-page.scss',
})
export class BookingCategoriesPage {
  private readonly categoryController = inject(BookingCategoriesService);
  private readonly dialogService = inject(DialogService);

  public readonly categories = signal<BookingCategoryDto[]>([]);
  public readonly columns = signal<GridColumn<BookingCategoryDto>[]>([]);
  public readonly error = signal<string | null>(null);

  public async ngOnInit() {
    this.columns.set([
      { key: 'name', label: 'Kategorie' },
      {
        key: 'taxArea',
        label: 'Steuerbereich',
        value: (row) => TAX_AREA_LABELS[row.taxArea],
      },
    ]);

    await this.fetchItems();
  }

  private async fetchItems() {
    const categories = await lastValueFrom(this.categoryController.apiBookingCategoriesGet({}));
    this.categories.set(categories);
  }

  private getDialogConfig(category?: BookingCategoryDto) {
    return {
      title: category ? 'Kategorie bearbeiten' : 'Neue Kategorie',
      data: category ?? { taxArea: TaxArea.Wirtschaftsbetrieb },
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, cssClasses: 'col-12' },
        {
          key: 'taxArea',
          label: 'Steuerbereich',
          type: 'select',
          required: true,
          cssClasses: 'col-12',
          options: taxAreaOptions(),
        },
      ],
    } satisfies ItemDialogConfig<BookingCategoryDto>;
  }

  public async openAdd() {
    const result = await this.dialogService.openDialog<BookingCategoryDto>(this.getDialogConfig());
    if (!result) return;

    await this.save(null, result);
  }

  public async openEdit(category: BookingCategoryDto) {
    const result = await this.dialogService.openDialog<BookingCategoryDto>(
      this.getDialogConfig(category),
    );
    if (!result) return;

    await this.save(category.id, result);
  }

  private async save(id: string | null, value: Partial<BookingCategoryDto>) {
    this.error.set(null);

    await lastValueFrom(
      this.categoryController.apiBookingCategoriesPost({
        itemUpsertRequestOfBookingCategoryDto: {
          id,
          value: {
            id: id ?? EMPTY_GUID,
            name: value.name!,
            taxArea: value.taxArea!,
          },
        },
      }),
    );

    await this.fetchItems();
  }

  public async openDelete(category: BookingCategoryDto) {
    const confirmed = await this.dialogService.openDeleteDialog();
    if (!confirmed) return;

    this.error.set(null);

    try {
      await lastValueFrom(
        this.categoryController.apiBookingCategoriesIdDelete({ id: category.id }),
      );
    } catch {
      this.error.set(
        `„${category.name}" wird noch von Buchungen verwendet und kann nicht gelöscht werden.`,
      );
      return;
    }

    await this.fetchItems();
  }
}
