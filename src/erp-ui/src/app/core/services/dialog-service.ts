import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DeleteDialog } from '../../shared/components/delete-dialog/delete-dialog';
import {
  BaseItemDialog,
  ItemDialogConfig,
} from '../../shared/components/base-item-dialog/base-item-dialog';
import { lastValueFrom } from 'rxjs';
import {
  CustomFieldDialog,
  CustomFieldDialogData,
} from '../../features/inventory/custom-fields/components/custom-field-dialog/custom-field-dialog';
import { CustomFieldDto, ItemTypeDto } from '../../../../projects/api/src/lib';

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  private readonly dialog = inject(MatDialog);

  public async openDeleteDialog() {
    return await this.dialog
      .open(DeleteDialog, {
        data: { title: 'Delete Item', message: 'Are you sure you want to delete this item?' },
      })
      .afterClosed()
      .toPromise();
  }

  async openDialog<T extends Record<string, any>>(
    config: ItemDialogConfig<T>,
  ): Promise<Partial<T> | null> {
    return lastValueFrom(
      this.dialog
        .open(BaseItemDialog<T>, {
          width: '480px',
          data: config,
        })
        .afterClosed(),
    );
  }

  async openCustomFieldDialog(
    itemTypes: ItemTypeDto[],
    field?: CustomFieldDto | null,
    mode: 'add' | 'edit' | 'view' = 'add',
  ): Promise<CustomFieldDto | null> {
    return lastValueFrom(
      this.dialog
        .open(CustomFieldDialog, {
          width: '480px',
          data: { field: field ?? null, itemTypes, mode} satisfies CustomFieldDialogData,
        })
        .afterClosed(),
    );
  }
}
