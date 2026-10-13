import { Routes } from '@angular/router';
import {
  authGuard,
  passwordChangeGuard,
  permissionGuard,
  setup2faGuard,
} from './core/guards/auth-guard';
import { PermissionType } from './shared/models/permission-type';
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
    path: 'datenschutz',
    loadComponent: () =>
      import('./pages/privacy/privacy-page/privacy-page').then((m) => m.PrivacyPage),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/components/forgot-password-page/forgot-password-page').then(
        (m) => m.ForgotPasswordPage,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/components/reset-password-page/reset-password-page').then(
        (m) => m.ResetPasswordPage,
      ),
  },
  {
    path: 'accept-invite',
    loadComponent: () =>
      import('./features/auth/components/accept-invite-page/accept-invite-page').then(
        (m) => m.AcceptInvitePage,
      ),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/components/change-password-page/change-password-page').then(
        (m) => m.ChangePasswordPage,
      ),
  },
  {
    path: 'setup-2fa',
    loadComponent: () =>
      import('./features/auth/components/setup-fa-page/setup-fa-page').then((m) => m.Setup2faPage),
  },
  {
    path: '',
    canActivate: [authGuard, passwordChangeGuard, setup2faGuard],
    component: AppShell,
    children: [
      // Operations
      {
        path: 'warehouse',
        canActivate: [permissionGuard(PermissionType.InventoryCanRead)],
        loadComponent: () =>
          import('./features/inventory/warehouse/components/warehouse-page/warehouse-page').then(
            (m) => m.WarehousePage,
          ),
      },

      {
        path: 'deliveries',
        canActivate: [permissionGuard(PermissionType.InventoryCanRead)],
        loadComponent: () =>
          import(
            './features/inventory/deliveries/components/deliveries-page/deliveries-page'
          ).then((m) => m.DeliveriesPage),
      },

      {
        path: 'cash-income',
        canActivate: [permissionGuard(PermissionType.FinanceCanWrite)],
        loadComponent: () =>
          import(
            './features/finance/cash-income/components/cash-income-page/cash-income-page'
          ).then((m) => m.CashIncomePage),
      },

      // Finanzen
      {
        path: 'finance',
        canActivate: [permissionGuard(PermissionType.FinanceCanRead)],
        loadComponent: () =>
          import(
            './features/finance/dashboard/components/finance-dashboard-page/finance-dashboard-page'
          ).then((m) => m.FinanceDashboardPage),
      },
      {
        path: 'finance/report',
        canActivate: [permissionGuard(PermissionType.FinanceCanRead)],
        loadComponent: () =>
          import(
            './features/finance/report/components/annual-report-page/annual-report-page'
          ).then((m) => m.AnnualReportPage),
      },
      {
        path: 'finance/bookings',
        canActivate: [permissionGuard(PermissionType.FinanceCanRead)],
        loadComponent: () =>
          import('./features/finance/bookings/components/bookings-page/bookings-page').then(
            (m) => m.BookingsPage,
          ),
      },
      {
        path: 'cash-books',
        canActivate: [permissionGuard(PermissionType.FinanceCanRead)],
        loadComponent: () =>
          import('./features/finance/cash-books/components/cash-books-page/cash-books-page').then(
            (m) => m.CashBooksPage,
          ),
      },

      // Stammdaten
      {
        path: 'catalog',
        canActivate: [permissionGuard(PermissionType.ProductsCanRead)],
        loadComponent: () =>
          import('./features/inventory/catalog/components/items-page/items-page').then(
            (m) => m.ItemsPage,
          ),
      },
      {
        path: 'catalog/item/:id',
        canActivate: [permissionGuard(PermissionType.ProductsCanRead)],
        loadComponent: () =>
          import('./features/inventory/catalog/components/item-detail/item-detail').then(
            (m) => m.ItemDetail,
          ),
      },
      {
        path: 'item-types',
        canActivate: [permissionGuard(PermissionType.ItemTypesCanRead)],
        loadComponent: () =>
          import('./features/inventory/item-types/components/item-types-page/item-types-page').then(
            (m) => m.ItemTypesPage,
          ),
      },
      {
        path: 'suppliers',
        canActivate: [permissionGuard(PermissionType.SuppliersCanRead)],
        loadComponent: () =>
          import('./features/inventory/suppliers/components/suppliers-page/suppliers-page').then(
            (m) => m.SuppliersPage,
          ),
      },
      {
        path: 'booking-categories',
        canActivate: [permissionGuard(PermissionType.FinanceCanRead)],
        loadComponent: () =>
          import(
            './features/finance/categories/components/booking-categories-page/booking-categories-page'
          ).then((m) => m.BookingCategoriesPage),
      },
      {
        path: 'custom-fields',
        canActivate: [permissionGuard(PermissionType.CustomFieldsCanRead)],
        loadComponent: () =>
          import(
            './features/inventory/custom-fields/components/custom-fields-page/custom-fields-page'
          ).then((m) => m.CustomFieldsPage),
      },

      // Administration
      {
        path: 'users',
        canActivate: [permissionGuard(PermissionType.UsersCanRead)],
        loadComponent: () =>
          import('./features/administration/users/components/user-page/user-page').then(
            (m) => m.UserPage,
          ),
      },
      {
        path: 'roles',
        canActivate: [permissionGuard(PermissionType.RolesCanRead)],
        loadComponent: () =>
          import('./features/administration/roles/components/roles-page/roles-page').then(
            (m) => m.RolesPage,
          ),
      },

      {
        path: 'account',
        loadComponent: () =>
          import('./features/account/components/account-page/account-page').then(
            (m) => m.AccountPage,
          ),
      },
      // Organisation
      {
        path: 'wiki',
        canActivate: [permissionGuard(PermissionType.WikiCanRead)],
        loadComponent: () =>
          import('./features/wiki/components/wiki-list-page/wiki-list-page').then(
            (m) => m.WikiListPage,
          ),
      },
      {
        path: 'wiki/new',
        canActivate: [permissionGuard(PermissionType.WikiCanWrite)],
        loadComponent: () =>
          import('./features/wiki/components/wiki-editor-page/wiki-editor-page').then(
            (m) => m.WikiEditorPage,
          ),
      },
      {
        path: 'wiki/:id',
        canActivate: [permissionGuard(PermissionType.WikiCanRead)],
        loadComponent: () =>
          import('./features/wiki/components/wiki-page/wiki-page').then((m) => m.WikiPage),
      },
      {
        path: 'wiki/:id/edit',
        canActivate: [permissionGuard(PermissionType.WikiCanWrite)],
        loadComponent: () =>
          import('./features/wiki/components/wiki-editor-page/wiki-editor-page').then(
            (m) => m.WikiEditorPage,
          ),
      },
      {
        path: 'tables',
        canActivate: [permissionGuard(PermissionType.TablesCanRead)],
        loadComponent: () =>
          import('./features/tables/components/tables-page/tables-page').then((m) => m.TablesPage),
      },
      {
        path: 'tables/:id',
        canActivate: [permissionGuard(PermissionType.TablesCanRead)],
        loadComponent: () =>
          import('./features/tables/components/table-page/table-page').then((m) => m.TablePage),
      },
      {
        path: 'settings',
        canActivate: [permissionGuard(PermissionType.SettingsCanWrite)],
        loadComponent: () =>
          import('./features/administration/settings/components/settings-page/settings-page').then(
            (m) => m.SettingsPage,
          ),
      },
      {
        path: 'forbidden',
        loadComponent: () =>
          import('./pages/forbidden/forbidden-page/forbidden-page').then((m) => m.ForbiddenPage),
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
