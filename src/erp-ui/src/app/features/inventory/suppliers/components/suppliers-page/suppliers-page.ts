import { Component, inject, signal } from '@angular/core';
import {
  DataGrid,
  GridActionCellDirective,
  GridColumn,
} from '../../../../../shared/components/data-grid/data-grid';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatChip } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { SupplierDto, SuppliersService } from '../../../../../../../projects/api/src/lib';
import { lastValueFrom } from 'rxjs';
import { DialogService } from '../../../../../core/services/dialog-service';
import { ItemDialogConfig } from '../../../../../shared/components/base-item-dialog/base-item-dialog';

@Component({
  selector: 'app-suppliers-page',
  imports: [
    DataGrid,
    GridActionCellDirective,
    MatButton,
    MatChip,
    MatIcon,
    MatIconButton,
    MatTooltip,
    PageHeader,
  ],
  templateUrl: './suppliers-page.html',
  styleUrl: './suppliers-page.scss',
})
export class SuppliersPage {
  public supplierController = inject(SuppliersService);

  public suppliers = signal<SupplierDto[]>([]);
  private dialogService = inject(DialogService);
  public columns = signal<GridColumn<SupplierDto>[]>([]);

  public async ngOnInit() {
    this.columns.set([{ key: 'name', label: 'Name' }]);

    await this.fetchItems();
  }

  public async fetchItems() {
    const suppliers = await lastValueFrom(this.supplierController.apiSuppliersGet());
    this.suppliers.set(suppliers);
  }

  private getDialogConfig(isEdit: boolean, isView: boolean, supplier?: SupplierDto) {
    return {
      title: isEdit ? 'Edit Supplier' : isView ? 'Supplier' : 'Add Supplier',
      readonly: isView,
      data: supplier ?? null,
      fields: [{ key: 'name', label: 'Full Name', type: 'text', required: true }],
    } satisfies ItemDialogConfig<SupplierDto>;
  }

  public async openAdd() {
    const res = await this.dialogService.openDialog<SupplierDto>(
      this.getDialogConfig(false, false),
    );

    if (!res) return;

    await lastValueFrom(
      this.supplierController.apiSuppliersPost({
        upsertSupplierRequest: {
          id: null,
          name: res.name!,
        },
      }),
    );

    await this.fetchItems();
  }

  public async openEdit(p: SupplierDto) {
    const res = await this.dialogService.openDialog<SupplierDto>(
      this.getDialogConfig(true, false, p),
    );

    if (!res) return;

    await lastValueFrom(
      this.supplierController.apiSuppliersPost({
        upsertSupplierRequest: {
          id: p.id,
          name: res.name!,
        },
      }),
    );

    await this.fetchItems();
  }

  public async openView(p: SupplierDto) {
    await this.dialogService.openDialog<SupplierDto>(this.getDialogConfig(false, true, p));
  }

  public async openDelete(p: SupplierDto) {
    if (!p.id) return;

    this.dialogService.openDeleteDialog().then(async (confirmed) => {
      if (!confirmed) return;
      await lastValueFrom(
        this.supplierController.apiSuppliersIdDelete({
          id: p.id!,
        }),
      );
      await this.fetchItems();
    });
  }
}
