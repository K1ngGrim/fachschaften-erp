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
      // Operations
      {
        path: 'warehouse',
        loadComponent: () =>
          import('./features/inventory/warehouse/components/warehouse-page/warehouse-page').then(
            (m) => m.WarehousePage,
          ),
      },

      {
        path: 'deliveries',
        loadComponent: () =>
          import(
            './features/inventory/deliveries/components/deliveries-page/deliveries-page'
          ).then((m) => m.DeliveriesPage),
      },

      {
        path: 'cash-income',
        loadComponent: () =>
          import(
            './features/finance/cash-income/components/cash-income-page/cash-income-page'
          ).then((m) => m.CashIncomePage),
      },

      // Finanzen
      {
        path: 'finance',
        loadComponent: () =>
          import(
            './features/finance/dashboard/components/finance-dashboard-page/finance-dashboard-page'
          ).then((m) => m.FinanceDashboardPage),
      },
      {
        path: 'finance/bookings',
        loadComponent: () =>
          import('./features/finance/bookings/components/bookings-page/bookings-page').then(
            (m) => m.BookingsPage,
          ),
      },
      {
        path: 'cash-books',
        loadComponent: () =>
          import('./features/finance/cash-books/components/cash-books-page/cash-books-page').then(
            (m) => m.CashBooksPage,
          ),
      },

      // Stammdaten
      {
        path: 'catalog',
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
        path: 'booking-categories',
        loadComponent: () =>
          import(
            './features/finance/categories/components/booking-categories-page/booking-categories-page'
          ).then((m) => m.BookingCategoriesPage),
      },
      {
        path: 'custom-fields',
        loadComponent: () =>
          import(
            './features/inventory/custom-fields/components/custom-fields-page/custom-fields-page'
          ).then((m) => m.CustomFieldsPage),
      },

      // Administration
      {
        path: 'users',
        loadComponent: () =>
          import('./features/administration/users/components/user-page/user-page').then(
            (m) => m.UserPage,
          ),
      },

      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
