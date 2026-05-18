import { Injectable, signal } from '@angular/core';
import { PermissionType } from '../../shared/models/permission-type';

@Injectable({
  providedIn: 'root',
})
export class Navigation {
  readonly navItems = signal<NavigationGroup[]>([
    {
      label: 'Operation',
      items: [
        {
          label: 'Lager',
          route: '/inventory',
          icon: 'inventory',
          permissions: [PermissionType.ProductsCanRead],
        },
        {
          label: 'Lieferungen',
          route: '/deliveries',
          icon: 'local_shipping',
          permissions: [PermissionType.ProductsCanRead],
        },
        {
          label: 'Kasseneinnahmen',
          route: '/incomes',
          icon: 'point_of_sale',
          permissions: [PermissionType.ProductsCanRead],
        },
      ],
    },
    {
      label: 'Finanzen',
      items: [
        {
          label: 'Übersicht',
          route: '/finances',
          icon: 'bar_chart',
          permissions: [PermissionType.ProductsCanRead],
        },
        {
          label: 'Kassenbücher',
          route: '/books',
          icon: 'description',
          permissions: [PermissionType.ProductsCanRead],
        },
      ],
    },
    {
      label: 'Stammdaten',
      items: [
        {
          label: 'Artikel',
          route: '/catalog',
          icon: 'inventory_2',
          permissions: [PermissionType.ProductsCanRead],
        },
        {
          label: 'Artikeltypen',
          route: '/item-types',
          icon: 'layers',
          permissions: [PermissionType.ItemTypesCanRead],
        },
        {
          label: 'Lieferanten',
          route: '/suppliers',
          icon: 'storefront',
          permissions: [PermissionType.SuppliersCanRead],
        },
        {
          label: 'Custom Fields',
          route: '/custom-fields',
          icon: 'tune',
          permissions: [PermissionType.ItemTypesCanRead],
        },
      ],
    },
    {
      label: 'Administration',
      items: [
        {
          label: 'Benutzer',
          route: '/administration/users',
          icon: 'group',
          permissions: [PermissionType.UsersCanRead],
        },
        {
          label: 'Rollen',
          route: '/administration/roles',
          icon: 'shield',
          permissions: [PermissionType.RolesCanRead],
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
