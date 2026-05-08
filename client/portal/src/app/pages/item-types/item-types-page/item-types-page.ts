import { Component, inject } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { DataService } from '../../../shared/services/data.service';
import { ItemTypeDialogComponent } from '../item-type-dialog/item-type-dialog.component';
import type { ItemType } from '../../../shared/models';

@Component({
  selector: 'app-item-types-page',
  imports: [MatCard, MatCardContent, MatButton, MatIconButton, MatIcon, MatSlideToggle],
  templateUrl: './item-types-page.html',
  styleUrl: './item-types-page.scss',
})
export class ItemTypesPage {
  private readonly data = inject(DataService);
  private readonly dialog = inject(MatDialog);

  readonly itemTypes = this.data.itemTypes;

  openAdd() {
    const ref = this.dialog.open(ItemTypeDialogComponent, { width: '420px', data: { type: null } });
    ref.afterClosed().subscribe((t: ItemType | undefined) => {
      if (t) this.data.addItemType(t);
    });
  }

  openEdit(t: ItemType) {
    const ref = this.dialog.open(ItemTypeDialogComponent, { width: '420px', data: { type: t } });
    ref.afterClosed().subscribe((updated: ItemType | undefined) => {
      if (updated) this.data.updateItemType(updated);
    });
  }

  toggleActive(t: ItemType) {
    this.data.updateItemType({ ...t, active: !t.active });
  }
}
