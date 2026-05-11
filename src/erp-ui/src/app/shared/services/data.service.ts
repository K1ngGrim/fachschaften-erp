import { Injectable, signal } from '@angular/core';
import type {
  CustomField,
  ItemType,
  MonthlyData,
  Product,
  Purchase,
  Sale,
  StockMovement,
} from '../models';

@Injectable({ providedIn: 'root' })
export class DataService {
  readonly itemTypes = signal<ItemType[]>([
    {
      id: 't1',
      name: 'Beverages',
      description: 'Drinks and liquid refreshments',
      icon: '🍺',
      active: true,
    },
    { id: 't2', name: 'Snacks', description: 'Food items and snacks', icon: '🍿', active: true },
    {
      id: 't3',
      name: 'Merchandise',
      description: 'Branded merchandise and apparel',
      icon: '👕',
      active: true,
    },
    {
      id: 't4',
      name: 'Tickets',
      description: 'Event tickets and passes',
      icon: '🎫',
      active: true,
    },
    {
      id: 't5',
      name: 'Supplies',
      description: 'Office and event supplies',
      icon: '📦',
      active: false,
    },
  ]);

  readonly customFields = signal<CustomField[]>([
    {
      id: 'cf1',
      name: 'volume_ml',
      label: 'Volume (ml)',
      type: 'number',
      required: false,
      active: true,
      itemTypeIds: ['t1'],
      order: 0,
    },
    {
      id: 'cf2',
      name: 'alcohol_content',
      label: 'Alcohol Content (%)',
      type: 'number',
      required: false,
      active: true,
      itemTypeIds: ['t1'],
      order: 1,
    },
    {
      id: 'cf3',
      name: 'flavor',
      label: 'Flavor',
      type: 'select',
      required: false,
      active: true,
      itemTypeIds: ['t1', 't2'],
      options: ['Classic', 'Lemon', 'Berry', 'Tropical', 'Other'],
      order: 2,
    },
    {
      id: 'cf4',
      name: 'size',
      label: 'Size',
      type: 'select',
      required: false,
      active: true,
      itemTypeIds: ['t3'],
      options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      order: 3,
    },
    {
      id: 'cf5',
      name: 'event_date',
      label: 'Event Date',
      type: 'date',
      required: true,
      active: true,
      itemTypeIds: ['t4'],
      order: 4,
    },
    {
      id: 'cf6',
      name: 'is_vegan',
      label: 'Vegan',
      type: 'boolean',
      required: false,
      active: true,
      itemTypeIds: ['t1', 't2'],
      order: 5,
    },
    {
      id: 'cf7',
      name: 'expiry_date',
      label: 'Expiry Date',
      type: 'date',
      required: false,
      active: true,
      itemTypeIds: ['t1', 't2'],
      order: 6,
    },
  ]);

  readonly products = signal<Product[]>([
    {
      id: '1',
      name: 'Augustiner Helles',
      itemTypeId: 't1',
      purchasePrice: 0.85,
      sellingPrice: 1.5,
      stock: 120,
      supplier: 'Getränke Müller',
      lowStockThreshold: 24,
      trackStock: true,
      customFieldValues: {
        volume_ml: 500,
        alcohol_content: 5.2,
        flavor: 'Classic',
        is_vegan: true,
      },
    },
    {
      id: '2',
      name: 'Spezi',
      itemTypeId: 't1',
      purchasePrice: 0.55,
      sellingPrice: 1.0,
      stock: 80,
      supplier: 'Getränke Müller',
      lowStockThreshold: 20,
      trackStock: true,
      customFieldValues: { volume_ml: 500, flavor: 'Classic', is_vegan: true },
    },
    {
      id: '3',
      name: 'Club Mate',
      itemTypeId: 't1',
      purchasePrice: 0.75,
      sellingPrice: 1.5,
      stock: 48,
      supplier: 'Flora Power',
      lowStockThreshold: 12,
      trackStock: true,
      customFieldValues: { volume_ml: 500, flavor: 'Classic', is_vegan: true },
    },
    {
      id: '4',
      name: 'Mineralwasser',
      itemTypeId: 't1',
      purchasePrice: 0.2,
      sellingPrice: 0.5,
      stock: 200,
      supplier: 'Getränke Müller',
      lowStockThreshold: 48,
      trackStock: true,
      customFieldValues: { volume_ml: 500, is_vegan: true },
    },
    {
      id: '5',
      name: 'Radler',
      itemTypeId: 't1',
      purchasePrice: 0.7,
      sellingPrice: 1.2,
      stock: 60,
      supplier: 'Getränke Müller',
      lowStockThreshold: 24,
      trackStock: true,
      customFieldValues: { volume_ml: 500, alcohol_content: 2.5, flavor: 'Lemon', is_vegan: true },
    },
    {
      id: '6',
      name: 'Red Bull',
      itemTypeId: 't1',
      purchasePrice: 0.95,
      sellingPrice: 2.0,
      stock: 8,
      supplier: 'Metro',
      lowStockThreshold: 12,
      trackStock: true,
      customFieldValues: { volume_ml: 250, flavor: 'Classic', is_vegan: true },
    },
    {
      id: '7',
      name: 'Apfelschorle',
      itemTypeId: 't1',
      purchasePrice: 0.45,
      sellingPrice: 1.0,
      stock: 36,
      supplier: 'Getränke Müller',
      lowStockThreshold: 20,
      trackStock: true,
      customFieldValues: { volume_ml: 500, flavor: 'Classic', is_vegan: true },
    },
    {
      id: '8',
      name: 'Paulaner Weizen',
      itemTypeId: 't1',
      purchasePrice: 0.9,
      sellingPrice: 1.6,
      stock: 4,
      supplier: 'Metro',
      lowStockThreshold: 24,
      trackStock: true,
      customFieldValues: {
        volume_ml: 500,
        alcohol_content: 5.5,
        flavor: 'Classic',
        is_vegan: true,
      },
    },
    {
      id: '9',
      name: 'Pretzel Mix',
      itemTypeId: 't2',
      purchasePrice: 1.2,
      sellingPrice: 2.5,
      stock: 30,
      supplier: 'Snack GmbH',
      lowStockThreshold: 10,
      trackStock: true,
      customFieldValues: { flavor: 'Classic', is_vegan: true },
    },
    {
      id: '10',
      name: 'Fachschaft T-Shirt',
      itemTypeId: 't3',
      purchasePrice: 8.0,
      sellingPrice: 15.0,
      stock: 25,
      supplier: 'PrintShop',
      lowStockThreshold: 5,
      trackStock: true,
      customFieldValues: { size: 'M' },
    },
    {
      id: '11',
      name: 'Summer Party Ticket',
      itemTypeId: 't4',
      purchasePrice: 0,
      sellingPrice: 5.0,
      stock: 100,
      supplier: '—',
      lowStockThreshold: 10,
      trackStock: true,
      customFieldValues: { event_date: '2026-07-15' },
    },
    {
      id: '11',
      name: 'Summer Party Ticket',
      itemTypeId: 't4',
      purchasePrice: 0,
      sellingPrice: 5.0,
      stock: 100,
      supplier: '—',
      lowStockThreshold: 10,
      trackStock: true,
      customFieldValues: { event_date: '2026-07-15' },
    },
    {
      id: '11',
      name: 'Summer Party Ticket',
      itemTypeId: 't4',
      purchasePrice: 0,
      sellingPrice: 5.0,
      stock: 100,
      supplier: '—',
      lowStockThreshold: 10,
      trackStock: true,
      customFieldValues: { event_date: '2026-07-15' },
    },
    {
      id: '11',
      name: 'Summer Party Ticket',
      itemTypeId: 't4',
      purchasePrice: 0,
      sellingPrice: 5.0,
      stock: 100,
      supplier: '—',
      lowStockThreshold: 10,
      trackStock: true,
      customFieldValues: { event_date: '2026-07-15' },
    },
    {
      id: '11',
      name: 'Summer Party Ticket',
      itemTypeId: 't4',
      purchasePrice: 0,
      sellingPrice: 5.0,
      stock: 100,
      supplier: '—',
      lowStockThreshold: 10,
      trackStock: true,
      customFieldValues: { event_date: '2026-07-15' },
    },
    {
      id: '11',
      name: 'Summer Party Ticket',
      itemTypeId: 't4',
      purchasePrice: 0,
      sellingPrice: 5.0,
      stock: 100,
      supplier: '—',
      lowStockThreshold: 10,
      trackStock: true,
      customFieldValues: { event_date: '2026-07-15' },
    },
    {
      id: '11',
      name: 'Summer Party Ticket',
      itemTypeId: 't4',
      purchasePrice: 0,
      sellingPrice: 5.0,
      stock: 100,
      supplier: '—',
      lowStockThreshold: 10,
      trackStock: true,
      customFieldValues: { event_date: '2026-07-15' },
    },
    {
      id: '11',
      name: 'Summer Party Ticket',
      itemTypeId: 't4',
      purchasePrice: 0,
      sellingPrice: 5.0,
      stock: 100,
      supplier: '—',
      lowStockThreshold: 10,
      trackStock: true,
      customFieldValues: { event_date: '2026-07-15' },
    },
  ]);

  readonly purchases = signal<Purchase[]>([
    {
      id: 'p1',
      date: '2026-03-01',
      supplier: 'Getränke Müller',
      productId: '1',
      productName: 'Augustiner Helles',
      quantity: 48,
      totalPrice: 40.8,
    },
    {
      id: 'p2',
      date: '2026-02-28',
      supplier: 'Flora Power',
      productId: '3',
      productName: 'Club Mate',
      quantity: 24,
      totalPrice: 18.0,
    },
    {
      id: 'p3',
      date: '2026-02-25',
      supplier: 'Getränke Müller',
      productId: '2',
      productName: 'Spezi',
      quantity: 48,
      totalPrice: 26.4,
    },
    {
      id: 'p4',
      date: '2026-02-20',
      supplier: 'Metro',
      productId: '6',
      productName: 'Red Bull',
      quantity: 24,
      totalPrice: 22.8,
    },
    {
      id: 'p5',
      date: '2026-02-15',
      supplier: 'Getränke Müller',
      productId: '4',
      productName: 'Mineralwasser',
      quantity: 96,
      totalPrice: 19.2,
    },
    {
      id: 'p6',
      date: '2026-01-28',
      supplier: 'Getränke Müller',
      productId: '1',
      productName: 'Augustiner Helles',
      quantity: 48,
      totalPrice: 40.8,
    },
    {
      id: 'p7',
      date: '2026-01-20',
      supplier: 'Metro',
      productId: '8',
      productName: 'Paulaner Weizen',
      quantity: 24,
      totalPrice: 21.6,
    },
  ]);

  readonly sales = signal<Sale[]>([
    {
      id: 's1',
      date: '2026-03-01',
      seller: 'Max',
      items: [
        { productId: '1', productName: 'Augustiner Helles', quantity: 12, unitPrice: 1.5 },
        { productId: '2', productName: 'Spezi', quantity: 8, unitPrice: 1.0 },
      ],
      totalAmount: 26.0,
    },
    {
      id: 's2',
      date: '2026-03-01',
      seller: 'Lisa',
      items: [{ productId: '3', productName: 'Club Mate', quantity: 6, unitPrice: 1.5 }],
      totalAmount: 9.0,
    },
    {
      id: 's3',
      date: '2026-02-28',
      seller: 'Max',
      items: [
        { productId: '1', productName: 'Augustiner Helles', quantity: 24, unitPrice: 1.5 },
        { productId: '4', productName: 'Mineralwasser', quantity: 12, unitPrice: 0.5 },
      ],
      totalAmount: 42.0,
    },
    {
      id: 's4',
      date: '2026-02-25',
      seller: 'Anna',
      items: [
        { productId: '6', productName: 'Red Bull', quantity: 10, unitPrice: 2.0 },
        { productId: '2', productName: 'Spezi', quantity: 15, unitPrice: 1.0 },
      ],
      totalAmount: 35.0,
    },
    {
      id: 's5',
      date: '2026-02-20',
      seller: 'Lisa',
      items: [{ productId: '5', productName: 'Radler', quantity: 18, unitPrice: 1.2 }],
      totalAmount: 21.6,
    },
    {
      id: 's6',
      date: '2026-01-30',
      seller: 'Max',
      items: [{ productId: '1', productName: 'Augustiner Helles', quantity: 30, unitPrice: 1.5 }],
      totalAmount: 45.0,
    },
    {
      id: 's7',
      date: '2026-01-22',
      seller: 'Anna',
      items: [
        { productId: '3', productName: 'Club Mate', quantity: 12, unitPrice: 1.5 },
        { productId: '7', productName: 'Apfelschorle', quantity: 8, unitPrice: 1.0 },
      ],
      totalAmount: 26.0,
    },
  ]);

  readonly stockMovements = signal<StockMovement[]>([
    { id: 'sm1', productId: '1', date: '2026-03-01', type: 'purchase', quantity: 48 },
    { id: 'sm2', productId: '1', date: '2026-03-01', type: 'sale', quantity: -12 },
    { id: 'sm3', productId: '1', date: '2026-02-28', type: 'sale', quantity: -24 },
    {
      id: 'sm4',
      productId: '1',
      date: '2026-02-15',
      type: 'adjustment',
      quantity: -2,
      reason: 'Damaged bottles',
    },
    { id: 'sm5', productId: '6', date: '2026-02-20', type: 'purchase', quantity: 24 },
    { id: 'sm6', productId: '6', date: '2026-02-25', type: 'sale', quantity: -10 },
  ]);

  readonly monthlyData = signal<MonthlyData[]>([
    { month: 'Oct', revenue: 180, expenses: 120 },
    { month: 'Nov', revenue: 220, expenses: 140 },
    { month: 'Dec', revenue: 310, expenses: 200 },
    { month: 'Jan', revenue: 260, expenses: 170 },
    { month: 'Feb', revenue: 340, expenses: 210 },
    { month: 'Mar', revenue: 120, expenses: 60 },
  ]);

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  getItemTypeName(itemTypeId: string): string {
    return this.itemTypes().find((t) => t.id === itemTypeId)?.name ?? 'Unknown';
  }

  getTopSellingItems(limit = 5) {
    const counts: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const sale of this.sales()) {
      for (const item of sale.items) {
        if (!counts[item.productId])
          counts[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
        counts[item.productId].quantity += item.quantity;
        counts[item.productId].revenue += item.quantity * item.unitPrice;
      }
    }
    return Object.entries(counts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  addProduct(p: Product) {
    this.products.update((list) => [...list, p]);
  }
  updateProduct(p: Product) {
    this.products.update((list) => list.map((x) => (x.id === p.id ? p : x)));
  }
  deleteProduct(id: string) {
    this.products.update((list) => list.filter((x) => x.id !== id));
  }

  addPurchase(p: Purchase) {
    this.purchases.update((list) => [p, ...list]);
  }

  addSale(s: Sale) {
    this.sales.update((list) => [s, ...list]);
  }

  addItemType(t: ItemType) {
    this.itemTypes.update((list) => [...list, t]);
  }
  updateItemType(t: ItemType) {
    this.itemTypes.update((list) => list.map((x) => (x.id === t.id ? t : x)));
  }

  addCustomField(f: CustomField) {
    this.customFields.update((list) => [...list, f]);
  }
  updateCustomField(f: CustomField) {
    this.customFields.update((list) => list.map((x) => (x.id === f.id ? f : x)));
  }
}
