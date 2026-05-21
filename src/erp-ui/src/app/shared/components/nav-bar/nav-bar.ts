import { Component, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatToolbar } from '@angular/material/toolbar';
import { MatIconButton, MatMiniFabButton } from '@angular/material/button';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatListItem, MatNavList } from '@angular/material/list';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Navigation } from '../../../core/services/navigation';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { FilterNavigationPipe } from '../../pipes/filter-navigation-pipe';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-nav-bar',
  imports: [
    MatToolbar,
    MatIconButton,
    MatSidenavContainer,
    MatSidenav,
    MatSidenavContent,
    MatNavList,
    MatIcon,
    MatListItem,
    MatTooltip,
    RouterLink,
    RouterLinkActive,
    MatMiniFabButton,
    FilterNavigationPipe,
    MatProgressBar,
  ],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.scss',
})
export class NavBar implements OnInit, OnDestroy {
  navContent = viewChild.required<ElementRef<HTMLElement>>('content');

  private readonly navigation = inject(Navigation);
  private readonly auth = inject(Auth);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private sub?: Subscription;

  readonly isMobile = signal(false);
  readonly collapsed = signal(false);
  readonly navItems = this.navigation.navItems;

  public isDarkMode = signal<boolean>(false);

  public switchTheme() {
    this.isDarkMode.set(document.documentElement.classList.toggle('dark'));
  }

  private router = inject(Router);
  routeLoading = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter(
          (e) =>
            e instanceof NavigationStart ||
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel,
        ),
      )
      .subscribe((e) => {
        this.routeLoading.set(e instanceof NavigationStart);
      });
  }

  ngOnInit() {
    this.sub = this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small])
      .subscribe((result) => this.isMobile.set(result.matches));
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  toggleCollapse() {
    this.collapsed.update((v) => !v);
  }

  protected async logout() {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
