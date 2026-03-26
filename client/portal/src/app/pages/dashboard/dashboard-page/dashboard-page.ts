import { Component } from '@angular/core';
import { MetricCard } from '../metric-card/metric-card';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatChip, MatChipSet } from '@angular/material/chips';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    MetricCard,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    MatIcon,
    MatChip,
    MatChipSet,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  monthlyData = monthlyData;
  products = products;
  formatCurrency = formatCurrency;

  get currentMonth() {
    return this.monthlyData[this.monthlyData.length - 1];
  }
  get totalRevenue() {
    return this.monthlyData.reduce((s, m) => s + m.revenue, 0);
  }
  get totalExpenses() {
    return this.monthlyData.reduce((s, m) => s + m.expenses, 0);
  }
  get inventoryValue() {
    return this.products.reduce((s, p) => s + p.stock * p.purchasePrice, 0);
  }
  get totalStockUnits() {
    return this.products.reduce((s, p) => s + p.stock, 0);
  }
  get lowStockProducts() {
    return this.products.filter((p) => p.trackStock && p.stock <= p.lowStockThreshold);
  }
  get topSelling() {
    return getTopSellingItems(5);
  }
}

export interface Product {
  id: string;
  name: string;
  supplier: string;
  purchasePrice: number;
  stock: number;
  lowStockThreshold: number;
  trackStock: boolean;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
}

export interface TopSellingItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export const products: Product[] = [
  { id: '1', name: 'Premium Espresso Beans', supplier: 'Java Roasters', purchasePrice: 15.50, stock: 45, lowStockThreshold: 10, trackStock: true },
  { id: '2', name: 'Organic Oat Milk', supplier: 'Dairy Free Co', purchasePrice: 1.20, stock: 8, lowStockThreshold: 15, trackStock: true }, // Low Stock!
  { id: '3', name: 'Eco-Friendly Paper Cups', supplier: 'Green Pack', purchasePrice: 0.05, stock: 2500, lowStockThreshold: 500, trackStock: true },
  { id: '4', name: 'Artisan Syrups (Vanilla)', supplier: 'Sweet Flavors', purchasePrice: 8.90, stock: 3, lowStockThreshold: 5, trackStock: true }, // Low Stock!
  { id: '5', name: 'Cleaning Tablets', supplier: 'Clean Machine', purchasePrice: 25.00, stock: 12, lowStockThreshold: 2, trackStock: true },
];

export const monthlyData: MonthlyData[] = [
  { month: 'Oct 2025', revenue: 12500, expenses: 8400 },
  { month: 'Nov 2025', revenue: 14200, expenses: 9100 },
  { month: 'Dec 2025', revenue: 18500, expenses: 11000 },
  { month: 'Jan 2026', revenue: 13100, expenses: 8900 },
  { month: 'Feb 2026', revenue: 15800, expenses: 9400 },
  { month: 'Mar 2026', revenue: 17450, expenses: 10200 }, // Aktueller Monat
];

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

export const getTopSellingItems = (limit: number): TopSellingItem[] => {
  const items: TopSellingItem[] = [
    { id: '1', name: 'Cappuccino Large', quantity: 842, revenue: 3789.00 },
    { id: '2', name: 'Iced Latte', quantity: 654, revenue: 2943.00 },
    { id: '3', name: 'Croissant', quantity: 521, revenue: 1563.00 },
    { id: '4', name: 'Flat White', quantity: 412, revenue: 1854.00 },
    { id: '5', name: 'Avocado Toast', quantity: 289, revenue: 2601.00 },
  ];
  return items.slice(0, limit);
};
