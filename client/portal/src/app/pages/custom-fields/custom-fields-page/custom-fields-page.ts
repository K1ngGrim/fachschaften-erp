import { Component, inject } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatTable, MatColumnDef, MatHeaderCell, MatCell, MatHeaderRow, MatRow, MatHeaderCellDef, MatCellDef, MatHeaderRowDef, MatRowDef } from '@angular/material/table';
import { DataService } from '../../../shared/services/data.service';
import { CustomFieldDialogComponent } from '../custom-field-dialog/custom-field-dialog.component';
import type { CustomField } from '../../../shared/models';

@Component({
  selector: 'app-custom-fields-page',
  imports: [
    MatCard, MatCardContent,
    MatButton, MatIconButton, MatIcon,
    MatChip, MatChipSet,
    MatSlideToggle,
    MatTable, MatColumnDef, MatHeaderCell, MatCell, MatHeaderRow, MatRow,
    MatHeaderCellDef, MatCellDef, MatHeaderRowDef, MatRowDef,
  ],
  templateUrl: './custom-fields-page.html',
})
export class CustomFieldsPage {
  private readonly data = inject(DataService);
  private readonly dialog = inject(MatDialog);

  readonly fields = this.data.customFields;
  readonly itemTypes = this.data.itemTypes;
  readonly displayedColumns = ['label', 'key', 'type', 'itemTypes', 'required', 'status', 'actions'];

  getItemType(id: string) { return this.itemTypes().find(t => t.id === id); }

  openAdd() {
    const ref = this.dialog.open(CustomFieldDialogComponent, { width: '520px', data: { field: null } });
    ref.afterClosed().subscribe((f: CustomField | undefined) => { if (f) this.data.addCustomField(f); });
  }

  openEdit(f: CustomField) {
    const ref = this.dialog.open(CustomFieldDialogComponent, { width: '520px', data: { field: f } });
    ref.afterClosed().subscribe((updated: CustomField | undefined) => { if (updated) this.data.updateCustomField(updated); });
  }

  toggleActive(f: CustomField) {
    this.data.updateCustomField({ ...f, active: !f.active });
  }
}
