export interface ItemType {
  id: string;
  name: string;
  description: string;
  icon: string;
  active: boolean;
}

export type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'date';

export interface CustomField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  active: boolean;
  itemTypeIds: string[];
  options?: string[];
  order: number;
}

export interface Product {
  id: string;
  name: string;
  itemTypeId: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  supplier: string;
  lowStockThreshold: number;
  trackStock: boolean;
  customFieldValues: Record<string, string | number | boolean>;
}

export interface Purchase {
  id: string;
  date: string;
  supplier: string;
  productId: string;
  productName: string;
  quantity: number;
  totalPrice: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  date: string;
  seller: string;
  items: SaleItem[];
  totalAmount: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  date: string;
  type: 'purchase' | 'sale' | 'adjustment';
  quantity: number;
  reason?: string;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
}
