import { Component, inject, signal } from '@angular/core';
import { MatToolbar } from '@angular/material/toolbar';
import { MatIconButton } from '@angular/material/button';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatListItem, MatNavList } from '@angular/material/list';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Navigation } from '../../services/navigation';
import { RouterLink, RouterLinkActive } from '@angular/router';

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
  ],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.scss',
})
export class NavBar {
  private readonly navigation = inject(Navigation);

  readonly isMobile = signal(false);
  readonly collapsed = signal(false);
  readonly navItems = this.navigation.navItems;
  readonly configItems = this.navigation.configItems;

  toggleCollapse() {
    this.collapsed.update(v => !v);
  }
}
