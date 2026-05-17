import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Navigation {
  readonly navItems = signal<NavigationGroup[]>([
    {
      label: 'Operation',
      items: [
        { label: 'Lager', route: '/inventory', icon: 'inventory' },
        { label: 'Lieferungen', route: '/deliveries', icon: 'delivery' },
        { label: 'Kasseneinnahmen', route: '/incomes', icon: 'income' },
      ],
    },
    {
      label: 'Finances',
      items: [
        { label: 'Finances', route: '/finances', icon: 'bar_chart' },
        { label: 'Kassenbücher', route: '/books', icon: 'description' },
      ],
    },
    {
      label: 'Configuration',
      items: [
        { label: 'Items', route: '/catalog', icon: 'catalog' },
        { label: 'Item Types', route: '/item-types', icon: 'layers' },
        { label: 'Custom Fields', route: '/custom-fields', icon: 'tune' },
      ],
    },
    {
      label: 'Administration',
      items: [
        {
          label: 'Benutzer Verwaltung',
          route: '/users',
          icon: 'account-details',
          permissions: ['users.canread'],
        },
        {
          label: 'Rollen Verwaltung',
          route: '/item-types',
          icon: 'layers',
          permissions: ['roles.canread'],
        },
      ],
    },
  ]);
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}


export interface NavigationItem {
  label: string;
  route: string;
  icon?: string;
  permissions?: string[];
}
