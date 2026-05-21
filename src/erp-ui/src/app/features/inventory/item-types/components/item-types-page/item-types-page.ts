import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import type { ItemType } from '../../../../../shared/models';
import { DataGrid, GridActionCellDirective, GridColumn } from '../../../../../shared/components/data-grid/data-grid';
import { MatTooltip } from '@angular/material/tooltip';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { ItemTypeDto } from '../../../../../../../projects/api/src/lib';
import { BaseItemDialog, ItemDialogConfig } from '../../../../../shared/components/base-item-dialog/base-item-dialog';

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

  readonly itemTypes = signal<Array<ItemTypeDto>>([]);
  public readonly columns = signal<Array<GridColumn<ItemTypeDto>>>([]);

  public async ngOnInit() {
    this.columns.set([{ key: 'name', label: 'Name' }]);
  }

  openAdd() {
    this.dialog
      .open(BaseItemDialog<ItemTypeDto>, {
        data: {
          title: 'Item Type',
          data: null,
          fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'icon', label: 'Icon', type: 'text' },
          ],
        } satisfies ItemDialogConfig<ItemTypeDto>,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          // Handle the result, e.g., save the new item type
          console.log('New Item Type:', result);
        }
      });

    /*const ref = this.dialog.open(ItemTypeDialogComponent, { width: '420px', data: { type: null } });
    ref.afterClosed().subscribe((t: ItemType | undefined) => {
      if (t) this.data.addItemType(t);
    });**/
  }

  openEdit(t: ItemType) {
    /*const ref = this.dialog.open(ItemTypeDialogComponent, { width: '420px', data: { type: t } });
    ref.afterClosed().subscribe((updated: ItemType | undefined) => {
      if (updated) this.data.updateItemType(updated);
    });*/
  }

  toggleActive(t: ItemType) {
    //this.data.updateItemType({ ...t, active: !t.active });
  }
}
