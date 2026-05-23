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
          icon: 'apps-box',
          permissions: [PermissionType.ProductsCanRead],
        },
        {
          label: 'Lieferungen',
          route: '/deliveries',
          icon: 'truck-delivery',
          permissions: [PermissionType.ProductsCanRead],
        },
        {
          label: 'Kasseneinnahmen',
          route: '/incomes',
          icon: 'cash-register',
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
          icon: 'finance',
          permissions: [PermissionType.ProductsCanRead],
        },
        {
          label: 'Kassenbücher',
          route: '/books',
          icon: 'book-open-page-variant',
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
          icon: 'format-list-bulleted-type',
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
          route: '/users',
          icon: 'group',
          permissions: [PermissionType.UsersCanRead],
        },
        {
          label: 'Rollen',
          route: '/roles',
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
