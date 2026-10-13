import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { lastValueFrom } from 'rxjs';
import {
  CustomFieldDto,
  CustomFieldType,
  InventoryTransactionsService,
  InventoryTransactionType,
  ItemTypesService,
  ProductDetailDto,
  ProductsService,
  SimpleInventoryTransactionDto,
} from '../../../../../../../projects/api/src/lib';
import { formatCurrency, formatDate } from '../../../../../shared/models/finance';
import { Auth } from '../../../../../core/services/auth';
import { PermissionType } from '../../../../../shared/models/permission-type';
import { ItemDialog, ItemDialogData } from '../item-dialog/item-dialog';

const MOVEMENT_LABELS: Record<InventoryTransactionType, string> = {
  [InventoryTransactionType.Delivery]: 'Lieferung',
  [InventoryTransactionType.Sale]: 'Verkauf',
  [InventoryTransactionType.Adjustment]: 'Korrektur',
  [InventoryTransactionType.Return]: 'Rückgabe',
  [InventoryTransactionType.Loss]: 'Schwund',
  [InventoryTransactionType.StockTake]: 'Inventur',
};

interface CustomValue {
  label: string;
  value: string;
}

@Component({
  selector: 'app-item-detail',
  imports: [MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatButton, MatIcon, RouterLink],
  templateUrl: './item-detail.html',
  styleUrl: './item-detail.scss',
})
export class ItemDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly productsController = inject(ProductsService);
  private readonly itemTypesController = inject(ItemTypesService);
  private readonly transactionsController = inject(InventoryTransactionsService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(Auth);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  public readonly loading = signal(true);
  public readonly product = signal<ProductDetailDto | null>(null);
  public readonly movements = signal<SimpleInventoryTransactionDto[]>([]);
  public readonly customFields = signal<CustomFieldDto[]>([]);

  public readonly canEdit = this.auth.hasPermission(PermissionType.ProductsCanWrite);
  /** Lagerbewegungen brauchen ein eigenes Recht; ohne wird der Abschnitt ausgeblendet. */
  public readonly canSeeMovements = this.auth.hasPermission(PermissionType.InventoryCanRead);

  public readonly formatCurrency = formatCurrency;
  public readonly formatDate = formatDate;

  public readonly isLowStock = computed(() => {
    const p = this.product();
    return !!p && p.trackStock && p.stock <= p.lowStockThreshold;
  });

  /** Werte der Zusatzfelder; ohne Felddefinitionen (fehlendes Recht) mit den Rohnamen. */
  public readonly customValues = computed<CustomValue[]>(() => {
    const values: Record<string, unknown> = this.product()?.customFieldValues ?? {};
    const fields = this.customFields();
    if (fields.length) {
      return fields.map((f) => ({ label: f.label, value: displayValue(values[f.name], f.type) }));
    }
    return Object.entries(values).map(([key, value]) => ({
      label: key,
      value: displayValue(value),
    }));
  });

  async ngOnInit() {
    await this.load();
  }

  public margin(sellingPrice: number): string {
    const p = this.product();
    if (!p) return '—';
    const margin = sellingPrice - p.purchasePrice;
    const percent = p.purchasePrice > 0 ? Math.round((margin / p.purchasePrice) * 100) : 0;
    return `${formatCurrency(margin)} (${percent} %)`;
  }

  public movementLabel(type: InventoryTransactionType): string {
    return MOVEMENT_LABELS[type] ?? type;
  }

  public async edit() {
    const product = this.product();
    if (!product) return;

    const saved = await lastValueFrom(
      this.dialog
        .open(ItemDialog, {
          width: '600px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          data: { product } satisfies ItemDialogData,
        })
        .afterClosed(),
    );
    if (saved) await this.load();
  }

  private async load() {
    this.loading.set(true);
    try {
      const product = await lastValueFrom(
        this.productsController.apiProductsIdGet({ id: this.id }),
      );
      this.product.set(product);

      await Promise.all([
        this.loadMovements(),
        lastValueFrom(
          this.itemTypesController.apiItemTypesTypeIdCustomFieldsGet({
            typeId: product.itemTypeId,
          }),
        )
          .then((fields) => this.customFields.set(fields))
          .catch(() => this.customFields.set([])),
      ]);
    } catch {
      this.product.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMovements() {
    if (!this.canSeeMovements) return;
    this.movements.set(
      await lastValueFrom(
        this.transactionsController.apiInventoryTransactionsProductProductIdGet({
          productId: this.id,
        }),
      ),
    );
  }
}

function displayValue(value: unknown, type?: CustomFieldType): string {
  if (value === undefined || value === null || value === '') return '—';
  if (type === CustomFieldType.Boolean || typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (type === CustomFieldType.Date) return formatDate(String(value));
  return String(value);
}
