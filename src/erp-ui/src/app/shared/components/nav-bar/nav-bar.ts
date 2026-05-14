import { Component, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatToolbar } from '@angular/material/toolbar';
import { MatIconButton, MatMiniFabButton } from '@angular/material/button';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatListItem, MatNavList } from '@angular/material/list';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Navigation } from '../../services/navigation';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { FilterNavigationPipe } from '../../pipes/filter-navigation-pipe';

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
  ],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.scss',
})
export class NavBar implements OnInit, OnDestroy {
  navContent = viewChild.required<ElementRef<HTMLElement>>('content');

  private readonly navigation = inject(Navigation);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private sub?: Subscription;

  readonly isMobile = signal(false);
  readonly collapsed = signal(false);
  readonly navItems = this.navigation.navItems;

  public isDarkMode = signal<boolean>(false);

  public switchTheme() {
    this.isDarkMode.set(document.documentElement.classList.toggle('dark'));
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
}
