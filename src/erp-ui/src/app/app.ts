import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavBar } from './shared/components/nav-bar/nav-bar';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavBar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('portal');

  constructor() {
    ModuleRegistry.registerModules([AllCommunityModule]);
  }
}
