import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Navigation {

  readonly items = signal(
    [
      { label: 'Dashboard', route: '/', icon: 'menu' },
      { label: 'Items', route: '/items', icon: 'info' },
      { label: 'Purchases', route: '/purchases', icon: 'contact_mail' },
      { label: 'Sales', route: '/sales', icon: 'contact_mail' },
      { label: 'Finances', route: '/finances', icon: 'contact_mail' },
    ]
  );




}


export interface NavigationItem {
  label: string;
  route: string;
  icon?: string;
}
