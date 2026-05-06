import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Navigation {

  readonly navItems = signal<NavigationItem[]>([
    { label: 'Dashboard', route: '/', icon: 'grid_view' },
    { label: 'Items', route: '/items', icon: 'inventory_2' },
    { label: 'Purchases', route: '/purchases', icon: 'shopping_cart' },
    { label: 'Sales', route: '/sales', icon: 'point_of_sale' },
    { label: 'Finances', route: '/finances', icon: 'bar_chart' },
    { label: 'Reports', route: '/reports', icon: 'description' },
  ]);

  readonly configItems = signal<NavigationItem[]>([
    { label: 'Item Types', route: '/item-types', icon: 'layers' },
    { label: 'Custom Fields', route: '/custom-fields', icon: 'tune' },
  ]);




}


export interface NavigationItem {
  label: string;
  route: string;
  icon?: string;
}
