import {
  AfterContentInit,
  Component,
  computed,
  ContentChildren,
  Directive,
  input,
  QueryList,
  signal,
  TemplateRef,
} from '@angular/core';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatFormField, MatInput, MatPrefix, MatSuffix } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';

@Directive({ selector: '[gridActionCell]', standalone: true })
export class GridActionCellDirective {
  constructor(public templateRef: TemplateRef<any>) {}
}

@Component({
  selector: 'app-data-grid',
  imports: [
    MatIcon,
    MatIconButton,
    MatFormField,
    MatInput,
    FormsModule,
    NgTemplateOutlet,
    MatIconModule,
    MatSuffix,
    MatPrefix,
  ],
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.scss',
})
export class DataGrid<T extends Record<string, any>> implements AfterContentInit {
  public columns = input.required<GridColumn<T>[]>();
  public data = input.required<T[]>();
  public toolbarTemplate = input<TemplateRef<any>>();

  public searchable = input(false);
  public searchKeys = input<string[]>([]);

  @ContentChildren(GridActionCellDirective)
  actionCellDirectives!: QueryList<GridActionCellDirective>;
  actionCellDirective: GridActionCellDirective | null = null;

  public searchQuery = signal('');

  ngAfterContentInit() {
    this.actionCellDirective = this.actionCellDirectives.first ?? null;
  }

  displayedColumns = computed(() => {
    const cols = this.columns().map((c) => c.key);
    if (this.actionCellDirective) cols.push('__actions');
    return cols;
  });

  filteredData = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.data();

    const keys = this.searchKeys().length ? this.searchKeys() : this.columns().map((c) => c.key);

    return this.data().filter((row) =>
      keys.some((key) =>
        String(row[key] ?? '')
          .toLowerCase()
          .includes(q),
      ),
    );
  });

  headerClass(col: GridColumn) {
    return col.align === 'end' ? 'text-end' : col.align === 'center' ? 'text-center' : '';
  }

  cellClass(col: GridColumn) {
    return col.align === 'end' ? 'text-end' : col.align === 'center' ? 'text-center' : '';
  }
}

export interface GridColumn<T = any> {
  key: string;
  label: string;
  align?: 'start' | 'end' | 'center';
  width?: string;
  cellTemplate?: TemplateRef<{ $implicit: T ; value: any }>;
  value?: (row: T) => any;
}
