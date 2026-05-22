import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import {
  DataGrid,
  GridActionCellDirective,
  GridColumn,
} from '../../../../../shared/components/data-grid/data-grid';
import { MatTooltip } from '@angular/material/tooltip';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { ItemTypeDto, ItemTypesService } from '../../../../../../../projects/api/src/lib';
import {
  BaseItemDialog,
  ItemDialogConfig,
} from '../../../../../shared/components/base-item-dialog/base-item-dialog';
import { lastValueFrom } from 'rxjs';
import { DialogService } from '../../../../../core/services/dialog-service';

@Component({
  selector: 'app-item-types-page',
  imports: [
    MatButton,
    MatIconButton,
    MatIcon,
    DataGrid,
    GridActionCellDirective,
    MatTooltip,
    PageHeader,
  ],
  templateUrl: './item-types-page.html',
  styleUrl: './item-types-page.scss',
})
export class ItemTypesPage implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly dialogService = inject(DialogService);

  readonly itemTypesController = inject(ItemTypesService);

  readonly itemTypes = signal<Array<ItemTypeDto>>([]);
  public readonly columns = signal<Array<GridColumn<ItemTypeDto>>>([]);

  public async ngOnInit() {
    this.columns.set([{ key: 'name', label: 'Name' }]);
    await this.fetchItemTypes();
  }

  private async fetchItemTypes() {
    const types = await lastValueFrom(this.itemTypesController.apiItemTypesGet());
    this.itemTypes.set(types);
  }

  openAdd() {
    this.dialog
      .open(BaseItemDialog<ItemTypeDto>, {
        data: this.getDialogConfig(false),
      })
      .afterClosed()
      .subscribe(async (result) => {
        if (result) {
          await lastValueFrom(
            this.itemTypesController.apiItemTypesPost({
              upsertItemTypeRequest: {
                icon: result.icon,
                name: result.name,
                id: result.id,
              },
            }),
          );

          await this.fetchItemTypes();
        }
      });
  }

  openEdit(t: ItemTypeDto) {
    this.dialog
      .open(BaseItemDialog<ItemTypeDto>, {
        data: this.getDialogConfig(false, t),
      })
      .afterClosed()
      .subscribe(async (result) => {
        if (result) {
          await lastValueFrom(
            this.itemTypesController.apiItemTypesPost({
              upsertItemTypeRequest: {
                icon: result.icon,
                name: result.name,
                id: result.id,
              },
            }),
          );

          await this.fetchItemTypes();
        }
      });
  }

  openView(type: ItemTypeDto) {
    this.dialog.open(BaseItemDialog<ItemTypeDto>, {
      data: this.getDialogConfig(true, type),
    });
  }

  deleteItem(type: ItemTypeDto) {
    this.dialogService.openDeleteDialog().then(async (confirmed) => {
      if (!confirmed) return;
      await lastValueFrom(
        this.itemTypesController.apiItemTypesIdDelete({
          id: type.id,
        }),
      );
      await this.fetchItemTypes();
    });
  }

  public getDialogConfig(readonly: boolean, existing?: ItemTypeDto) {
    return {
      title: 'Item Type',
      data: existing ?? null,
      readonly: readonly,
      fields: [
        {
          key: 'name',
          label: 'Name',
          type: 'text',
          required: true,
          cssClasses: 'col-12 col-sm-6',
        },
        { key: 'icon', label: 'Icon', type: 'text', cssClasses: 'col-12 col-sm-6' },
      ],
    } satisfies ItemDialogConfig<ItemTypeDto>;
  }
}
