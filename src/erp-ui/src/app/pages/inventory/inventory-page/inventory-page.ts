import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { DataGrid, GridActionCellDirective, GridColumn } from '../../../shared/components/data-grid/data-grid';
import { Product } from '../../../shared/models';

@Component({
  selector: 'app-inventory-page',
  imports: [
    FormsModule,
    MatCard,
    MatCardContent,
    MatIcon,
    MatIconButton,
    MatTooltip,
    PageHeader,
    DataGrid,
    GridActionCellDirective,
  ],
  templateUrl: './inventory-page.html',
  styleUrl: './inventory-page.scss',
})
export class InventoryPage {
  public products = signal<Product[]>([]);

  constructor() {

    this.products.set( [
      {
        id: '1',
        name: 'Club T-Shirt (S)',
        itemTypeId: 'clothing',
        purchasePrice: 8.50,
        sellingPrice: 15.00,
        stock: 42,
        supplier: 'SportsDruck GmbH',
        lowStockThreshold: 10,
        trackStock: true,
        customFieldValues: { color: 'navy', size: 'S' },
      },
      {
        id: '2',
        name: 'Club T-Shirt (M)',
        itemTypeId: 'clothing',
        purchasePrice: 8.50,
        sellingPrice: 15.00,
        stock: 7,
        supplier: 'SportsDruck GmbH',
        lowStockThreshold: 10,
        trackStock: true,
        customFieldValues: { color: 'navy', size: 'M' },
      },
      {
        id: '3',
        name: 'Hoodie',
        itemTypeId: 'clothing',
        purchasePrice: 22.00,
        sellingPrice: 38.00,
        stock: 3,
        supplier: 'SportsDruck GmbH',
        lowStockThreshold: 5,
        trackStock: true,
        customFieldValues: { color: 'black', size: 'L' },
      },
      {
        id: '4',
        name: 'Mate Tee (0,5l)',
        itemTypeId: 'beverage',
        purchasePrice: 0.89,
        sellingPrice: 1.50,
        stock: 144,
        supplier: 'Getränke Müller',
        lowStockThreshold: 24,
        trackStock: true,
        customFieldValues: { alcoholic: false, deposit: 0.25 },
      },
      {
        id: '5',
        name: 'Club Bier (Kasten)',
        itemTypeId: 'beverage',
        purchasePrice: 14.00,
        sellingPrice: 20.00,
        stock: 8,
        supplier: 'Getränke Müller',
        lowStockThreshold: 3,
        trackStock: true,
        customFieldValues: { alcoholic: true, deposit: 3.10 },
      },
      {
        id: '6',
        name: 'Wasser still (0,5l)',
        itemTypeId: 'beverage',
        purchasePrice: 0.25,
        sellingPrice: 1.00,
        stock: 2,
        supplier: 'Getränke Müller',
        lowStockThreshold: 12,
        trackStock: true,
        customFieldValues: { alcoholic: false, deposit: 0.25 },
      },
      {
        id: '7',
        name: 'Kugelschreiber (10er Pack)',
        itemTypeId: 'stationery',
        purchasePrice: 3.20,
        sellingPrice: 5.00,
        stock: 15,
        supplier: 'Bürobedarf Schmidt',
        lowStockThreshold: 5,
        trackStock: true,
        customFieldValues: { color: 'blue' },
      },
      {
        id: '8',
        name: 'A4 Druckerpapier (500 Blatt)',
        itemTypeId: 'stationery',
        purchasePrice: 4.50,
        sellingPrice: 6.00,
        stock: 20,
        supplier: 'Bürobedarf Schmidt',
        lowStockThreshold: 5,
        trackStock: true,
        customFieldValues: { grammage: 80 },
      },
      {
        id: '9',
        name: 'Eintrittsbändchen (100 Stk)',
        itemTypeId: 'event',
        purchasePrice: 6.00,
        sellingPrice: 0,
        stock: 300,
        supplier: 'EventSupply AG',
        lowStockThreshold: 50,
        trackStock: true,
        customFieldValues: { reusable: false },
      },
      {
        id: '10',
        name: 'Tischdecken (10 Stk)',
        itemTypeId: 'event',
        purchasePrice: 8.00,
        sellingPrice: 0,
        stock: 4,
        supplier: 'EventSupply AG',
        lowStockThreshold: 2,
        trackStock: false,
        customFieldValues: { color: 'white', reusable: true },
      },
      {
        id: '11',
        name: 'HDMI Kabel (2m)',
        itemTypeId: 'equipment',
        purchasePrice: 7.00,
        sellingPrice: 0,
        stock: 6,
        supplier: 'Elektronik Depot',
        lowStockThreshold: 2,
        trackStock: true,
        customFieldValues: { lengthM: 2 },
      },
      {
        id: '12',
        name: 'Verlängerungskabel (5m)',
        itemTypeId: 'equipment',
        purchasePrice: 12.00,
        sellingPrice: 0,
        stock: 1,
        supplier: 'Elektronik Depot',
        lowStockThreshold: 2,
        trackStock: true,
        customFieldValues: { lengthM: 5, outlets: 4 },
      },
    ]);


  }


  columns: GridColumn<Product>[] = [
    { key: 'name', label: 'Name' },
    { key: 'supplier', label: 'Supplier' },
    {
      key: 'purchasePrice',
      label: 'Purchase',
      align: 'end',
    },
    {
      key: 'stock',
      label: 'Stock',
      align: 'end',
    },
  ];

  protected isLowStock(p: any) {
    return false;
  }

  protected viewDetail(id: any) {}

  protected openEdit(p: any) {}

  protected delete(id: any) {}
}
