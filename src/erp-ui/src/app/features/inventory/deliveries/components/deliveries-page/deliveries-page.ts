import { Component, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
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
import {
  DeliveriesService,
  DeliveryDto,
  DeliveryOverviewDto,
} from '../../../../../../../projects/api/src/lib';
import { DeliveryDialog, DeliveryDialogData } from '../delivery-dialog/delivery-dialog';

@Component({
  selector: 'app-deliveries-page',
  imports: [
    DataGrid,
    GridActionCellDirective,
    MatButton,
    MatIcon,
    MatIconButton,
    MatTooltip,
    PageHeader,
  ],
  templateUrl: './deliveries-page.html',
  styleUrl: './deliveries-page.scss',
})
export class DeliveriesPage {
  private readonly deliveryController = inject(DeliveriesService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogService = inject(DialogService);

  public readonly deliveries = signal<DeliveryOverviewDto[]>([]);
  public readonly columns = signal<GridColumn<DeliveryOverviewDto>[]>([]);
  public readonly error = signal<string | null>(null);

  public async ngOnInit() {
    this.columns.set([
      {
        key: 'deliveryDate',
        label: 'Datum',
        value: (row) => new Date(row.deliveryDate).toLocaleDateString('de-DE'),
      },
      { key: 'supplierName', label: 'Lieferant' },
      { key: 'documentNumber', label: 'Beleg' },
      { key: 'positionCount', label: 'Positionen', align: 'end' },
      { key: 'totalQuantity', label: 'Menge', align: 'end' },
      {
        key: 'totalAmount',
        label: 'Summe',
        align: 'end',
        value: (row) => this.formatCurrency(row.totalAmount),
      },
    ]);

    await this.fetchItems();
  }

  private async fetchItems() {
    const deliveries = await lastValueFrom(this.deliveryController.apiDeliveriesGet());
    this.deliveries.set(deliveries);
  }

  public formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  }

  public async openAdd() {
    const result = await this.openDialog(null);
    if (!result) return;

    await this.save(null, result);
  }

  public async openEdit(row: DeliveryOverviewDto) {
    const delivery = await lastValueFrom(
      this.deliveryController.apiDeliveriesIdGet({ id: row.id }),
    );

    const result = await this.openDialog(delivery);
    if (!result) return;

    await this.save(row.id, result);
  }

  private async save(id: string | null, value: DeliveryDto) {
    this.error.set(null);

    try {
      await lastValueFrom(
        this.deliveryController.apiDeliveriesPost({
          itemUpsertRequestOfDeliveryDto: { id, value },
        }),
      );
    } catch (error: any) {
      this.error.set(
        typeof error?.error === 'string'
          ? error.error
          : 'Die Lieferung konnte nicht gespeichert werden.',
      );
      return;
    }

    await this.fetchItems();
  }

  public async openDelete(row: DeliveryOverviewDto) {
    const confirmed = await this.dialogService.openDeleteDialog();
    if (!confirmed) return;

    await lastValueFrom(this.deliveryController.apiDeliveriesIdDelete({ id: row.id }));
    await this.fetchItems();
  }

  public openReceipt(row: DeliveryOverviewDto) {
    if (!row.receiptUrl) return;
    window.open(row.receiptUrl, '_blank', 'noopener');
  }

  private async openDialog(delivery: DeliveryDto | null): Promise<DeliveryDto | undefined> {
    return lastValueFrom(
      this.dialog
        .open(DeliveryDialog, {
          width: '860px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          data: { delivery } satisfies DeliveryDialogData,
        })
        .afterClosed(),
    );
  }
}
