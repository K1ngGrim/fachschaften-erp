import { Injectable, signal } from '@angular/core';
import { PermissionType } from '../../shared/models/permission-type';

@Injectable({
  providedIn: 'root',
})
export class Navigation {
  readonly navItems = signal<NavigationGroup[]>([
    {
      label: 'Übersicht',
      items: [
        {
          label: 'Dashboard',
          route: '/',
          icon: 'view-dashboard',
          exact: true,
        },
      ],
    },
    {
      label: 'Operations',
      items: [
        {
          label: 'Lager',
          route: '/warehouse',
          icon: 'warehouse',
          permissions: [PermissionType.InventoryCanRead],
        },
        {
          label: 'Lieferungen',
          route: '/deliveries',
          icon: 'truck-delivery',
          permissions: [PermissionType.InventoryCanRead],
        },
        {
          label: 'Kasseneinnahmen',
          route: '/cash-income',
          icon: 'cash-register',
          permissions: [PermissionType.FinanceCanWrite],
        },
      ],
    },
    {
      label: 'Finanzen',
      items: [
        {
          label: 'Übersicht',
          route: '/finance',
          icon: 'finance',
          exact: true,
          permissions: [PermissionType.FinanceCanRead],
        },
        {
          label: 'Buchungen',
          route: '/finance/bookings',
          icon: 'swap-horizontal',
          permissions: [PermissionType.FinanceCanRead],
        },
        {
          label: 'Kassenbuch',
          route: '/cash-books',
          icon: 'book-open-page-variant',
          permissions: [PermissionType.FinanceCanRead],
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
          permissions: [PermissionType.CustomFieldsCanRead],
        },
        {
          label: 'Finanzkategorien',
          route: '/booking-categories',
          icon: 'shape',
          permissions: [PermissionType.FinanceCanRead],
        },
      ],
    },
    {
      label: 'Administration',
      items: [
        {
          label: 'Benutzer',
          route: '/users',
          icon: 'account-group',
          permissions: [PermissionType.UsersCanRead],
        },
        {
          label: 'Rollen',
          route: '/roles',
          icon: 'shield-account',
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
  /** Nur bei exakt gleicher URL aktiv, z. B. wenn Unterseiten eigene Einträge haben. */
  exact?: boolean;
  permissions?: string[];
}
