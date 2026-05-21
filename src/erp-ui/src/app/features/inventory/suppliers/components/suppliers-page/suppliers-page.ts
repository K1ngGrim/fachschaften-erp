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
  public columns = signal<GridColumn<SupplierDto>[]>([]);

  public async ngOnInit() {
    this.columns.set([{ key: 'name', label: 'Name' }]);

    await this.loadSuppliers();
  }

  public async loadSuppliers() {
    const suppliers = await lastValueFrom(this.supplierController.apiSuppliersGet());
    this.suppliers.set(suppliers);
  }

  public async openAdd() {}

  public async openEdit(p: SupplierDto) {}

  public async openView(p: SupplierDto) {}
}
