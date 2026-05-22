import { Component, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { DataGrid, GridActionCellDirective, GridColumn } from '../../../../../shared/components/data-grid/data-grid';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { CustomFieldDto, CustomFieldsService, ItemTypesService } from '../../../../../../../projects/api/src/lib';
import { last, lastValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../../../core/services/dialog-service';

@Component({
  selector: 'app-custom-fields-page',
  imports: [
    DataGrid,
    GridActionCellDirective,
    MatButton,
    MatChip,
    MatIcon,
    MatIconButton,
    MatTooltip,
    PageHeader,
    MatChipSet,
    FormsModule,
  ],
  templateUrl: './custom-fields-page.html',
  styleUrl: './custom-fields-page.scss',
})
export class CustomFieldsPage {
  public typeTpl = viewChild<TemplateRef<any>>('typeTpl');
  public itemTypesTpl = viewChild<TemplateRef<any>>('itemTypesTpl');

  private fieldsController = inject(CustomFieldsService);
  private itemTypesController = inject(ItemTypesService);
  private dialogService = inject(DialogService);

  public readonly columns = signal<GridColumn<CustomFieldDto>[]>([]);

  public fields = signal<CustomFieldDto[]>([]);

  public async ngOnInit() {
    this.columns.set([
      { key: 'label', label: 'Label' },
      { key: 'name', label: 'Key', value: (f) => f.name },
      { key: 'type', label: 'Type', cellTemplate: this.typeTpl() },
      { key: 'itemTypes', label: 'Item Types', cellTemplate: this.itemTypesTpl() },
      { key: 'required', label: 'Required', value: (f) => (f.required ? 'Required' : 'Optional') },
    ]);
    await this.fetchItems();
  }

  private async fetchItems() {
    const fields = await lastValueFrom(this.fieldsController.apiCustomFieldsGet());
    this.fields.set(fields);
  }

  public async openAdd() {
    const itemTypes = await lastValueFrom(this.itemTypesController.apiItemTypesGet());
    const res = await this.dialogService.openCustomFieldDialog(itemTypes);

    if (!res) return;

    await lastValueFrom(
      this.fieldsController.apiCustomFieldsPost({
        itemUpsertRequestOfCustomFieldDto: {
          id: null,
          value: res,
        },
      }),
    );
    await this.fetchItems();
  }

  public async openEdit(p: CustomFieldDto) {
    const itemTypes = await lastValueFrom(this.itemTypesController.apiItemTypesGet());
    const res = await this.dialogService.openCustomFieldDialog(itemTypes, p, 'edit');

    if (!res) return;

    await lastValueFrom(
      this.fieldsController.apiCustomFieldsPost({
        itemUpsertRequestOfCustomFieldDto: {
          id: p.id,
          value: res,
        },
      }),
    );

   await this.fetchItems();
  }

  public async openView(p: CustomFieldDto) {
    const itemTypes = await lastValueFrom(this.itemTypesController.apiItemTypesGet());
    const res = await this.dialogService.openCustomFieldDialog(itemTypes, p, 'view');

    if (!res) return;

    await lastValueFrom(
      this.fieldsController.apiCustomFieldsPost({
        itemUpsertRequestOfCustomFieldDto: {
          id: null,
          value: res,
        },
      }),
    );
  }

  public async openDelete(p: CustomFieldDto) {
    if (!p.id) return;

    const res = await this.dialogService.openDeleteDialog();
    if (!res) return;

    await lastValueFrom(this.fieldsController.apiCustomFieldsIdDelete({
      id: p.id,
    }));

    await this.fetchItems();
  }
}
