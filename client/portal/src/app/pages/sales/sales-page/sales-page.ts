import { Component, computed, inject, signal } from '@angular/core';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { MatTable, MatColumnDef, MatHeaderCell, MatCell, MatHeaderRow, MatRow, MatHeaderCellDef, MatCellDef, MatHeaderRowDef, MatRowDef } from '@angular/material/table';
import { DataService } from '../../../shared/services/data.service';
import type { Sale, SaleItem, Product } from '../../../shared/models';

interface CartItem { productId: string; productName: string; quantity: number; unitPrice: number; }

@Component({
  selector: 'app-sales-page',
  imports: [
    MatCard, MatCardContent, MatCardHeader, MatCardTitle,
    MatButton, MatIconButton, MatIcon,
    MatDivider,
    MatTable, MatColumnDef, MatHeaderCell, MatCell, MatHeaderRow, MatRow,
    MatHeaderCellDef, MatCellDef, MatHeaderRowDef, MatRowDef,
  ],
  templateUrl: './sales-page.html',
  styleUrl: './sales-page.scss',
})
export class SalesPage {
  private readonly data = inject(DataService);

  readonly tab = signal<'pos' | 'history'>('pos');
  readonly cart = signal<CartItem[]>([]);

  readonly products = this.data.products;
  readonly itemTypes = this.data.itemTypes;
  readonly sales = this.data.sales;

  readonly cartTotal = computed(() => this.cart().reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  readonly historyColumns = ['date', 'seller', 'items', 'total'];

  formatCurrency = (v: number) => this.data.formatCurrency(v);

  getType(itemTypeId: string) {
    return this.itemTypes().find(t => t.id === itemTypeId);
  }

  isOutOfStock(p: Product) {
    return p.trackStock && p.stock <= 0;
  }

  isLowStock(p: Product) {
    return p.trackStock && p.stock <= p.lowStockThreshold;
  }

  addToCart(product: Product) {
    if (this.isOutOfStock(product)) return;
    this.cart.update(cart => {
      const existing = cart.find(i => i.productId === product.id);
      if (existing) return cart.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...cart, { productId: product.id, productName: product.name, quantity: 1, unitPrice: product.sellingPrice }];
    });
  }

  updateQty(productId: string, delta: number) {
    this.cart.update(cart =>
      cart.map(i => i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
          .filter(i => i.quantity > 0)
    );
  }

  removeFromCart(productId: string) {
    this.cart.update(cart => cart.filter(i => i.productId !== productId));
  }

  completeSale() {
    if (this.cart().length === 0) return;
    const sale: Sale = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      seller: 'Current User',
      items: this.cart(),
      totalAmount: this.cartTotal(),
    };
    this.data.addSale(sale);
    this.cart.set([]);
  }

  formatSaleItems(items: SaleItem[]): string {
    return items.map(i => `${i.quantity}× ${i.productName}`).join(', ');
  }
}
