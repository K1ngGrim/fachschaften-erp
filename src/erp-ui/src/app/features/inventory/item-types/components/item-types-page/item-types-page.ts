import { Component, inject, OnInit, signal } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { DataService } from '../../../../../shared/services/data.service';
import { ItemTypeDialogComponent } from '../item-type-dialog_old/item-type-dialog.component';
import type { ItemType, Product } from '../../../../../shared/models';
import { DataGrid, GridActionCellDirective, GridColumn } from '../../../../../shared/components/data-grid/data-grid';
import { MatTooltip } from '@angular/material/tooltip';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { ItemTypeDto } from '../../../../../../../projects/api/src/lib';

@Component({
  selector: 'app-item-types-page',
  imports: [
    MatCard,
    MatCardContent,
    MatButton,
    MatIconButton,
    MatIcon,
    MatSlideToggle,
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
    this.columns.set([
      { key: 'name', label: 'Name' },
    ]);
  }

  openAdd() {
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
