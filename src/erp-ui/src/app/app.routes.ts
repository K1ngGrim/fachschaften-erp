import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
  },

  {
    path: 'inventory',
    loadComponent: () =>
      import('./pages/inventory/inventory-page/inventory-page').then((m) => m.InventoryPage),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./pages/administration/user/user-page/user-page').then((m) => m.UserPage),
  },

  {
    path: 'catalog',
    loadComponent: () => import('./pages/items/items-page/items-page').then((m) => m.ItemsPage),
  },
  {
    path: 'catalog/:id',
    loadComponent: () => import('./pages/items/item-detail/item-detail').then((m) => m.ItemDetail),
  },

  {
    path: 'purchases',
    loadComponent: () =>
      import('./pages/purchases/purchases-page/purchases-page').then((m) => m.PurchasesPage),
  },
  {
    path: 'sales',
    loadComponent: () => import('./pages/sales/sales-page/sales-page').then((m) => m.SalesPage),
  },
  {
    path: 'finances',
    loadComponent: () =>
      import('./pages/finances/finance-page/finance-page').then((m) => m.FinancePage),
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./pages/reports/reports-page/reports-page').then((m) => m.ReportsPage),
  },
  {
    path: 'item-types',
    loadComponent: () =>
      import('./pages/item-types/item-types-page/item-types-page').then((m) => m.ItemTypesPage),
  },
  {
    path: 'custom-fields',
    loadComponent: () =>
      import('./pages/custom-fields/custom-fields-page/custom-fields-page').then(
        (m) => m.CustomFieldsPage,
      ),
  },
  { path: '**', redirectTo: '' },
];
