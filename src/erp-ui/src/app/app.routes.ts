import { Routes } from '@angular/router';
import { authGuard, setup2faGuard } from './core/guards/auth-guard';
import { AppShell } from './shared/components/app-shell/app-shell';

export const routes: Routes = [
  {
    path: 'login/2fa',
    loadComponent: () =>
      import('./features/auth/components/login-two-fa-page/login-two-fa-page').then(
        (m) => m.LoginTwoFaPage,
      ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/components/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'accept-invite',
    loadComponent: () =>
      import('./features/auth/components/accept-invite-page/accept-invite-page').then(
        (m) => m.AcceptInvitePage,
      ),
  },
  {
    path: 'setup-2fa',
    loadComponent: () =>
      import('./features/auth/components/setup-fa-page/setup-fa-page').then((m) => m.Setup2faPage),
  },
  {
    path: '',
    canActivate: [authGuard, setup2faGuard],
    component: AppShell,
    children: [
      //refactored components/routes
      {
        path: 'users',
        //canActivate: [permissionGuard('users.canread')],
        loadComponent: () =>
          import('./features/administration/users/components/user-page/user-page').then(
            (m) => m.UserPage,
          ),
      },

      {
        path: 'catalog',
        //canActivate: [permissionGuard('products.canread')],
        loadComponent: () =>
          import('./features/inventory/catalog/components/items-page/items-page').then(
            (m) => m.ItemsPage,
          ),
      },

      {
        path: 'catalog/item/:id',
        loadComponent: () =>
          import('./features/inventory/catalog/components/item-detail/item-detail').then(
            (m) => m.ItemDetail,
          ),
      },
      {
        path: 'inventory',
        //canActivate: [permissionGuard('users.canread')],
        loadComponent: () =>
          import('./pages/inventory/inventory-page/inventory-page').then((m) => m.InventoryPage),
      },
      {
        path: 'item-types',
        loadComponent: () =>
          import('./features/inventory/item-types/components/item-types-page/item-types-page').then(
            (m) => m.ItemTypesPage,
          ),
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/inventory/suppliers/components/suppliers-page/suppliers-page').then(
            (m) => m.SuppliersPage,
          ),
      },
      {
        path: 'custom-fields',
        loadComponent: () =>
          import('./features/inventory/custom-fields/components/custom-fields-page/custom-fields-page').then(
            (m) => m.CustomFieldsPage,
          ),
      },

      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
      },
    ],
  },

  {
    path: 'catalog/:id',
    loadComponent: () =>
      import('./features/inventory/catalog/components/item-detail/item-detail').then(
        (m) => m.ItemDetail,
      ),
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
  { path: '**', redirectTo: '' },
];
