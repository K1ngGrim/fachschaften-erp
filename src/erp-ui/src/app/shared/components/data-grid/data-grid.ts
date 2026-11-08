import {
  AfterContentInit,
  Component,
  computed,
  ContentChildren,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  QueryList,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatFormField, MatInput, MatPrefix, MatSuffix } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';

@Directive({ selector: '[gridActionCell]', standalone: true })
export class GridActionCellDirective {
  constructor(public templateRef: TemplateRef<any>) {}
}

/** Schlüssel der Aktionsspalte – wird für Breiten wie eine normale Spalte behandelt. */
const ACTIONS_KEY = '__actions';

const WIDTH_STORAGE_PREFIX = 'erp.data-grid.widths:';

/** Kleinste Spaltenbreite beim Ziehen. */
const MIN_COLUMN_WIDTH = 64;

export type GridFilterType = 'text' | 'number' | 'date' | 'boolean' | 'select';

export type GridFilterOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'regex'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'on'
  | 'before'
  | 'after'
  | 'isTrue'
  | 'isFalse'
  | 'empty'
  | 'notEmpty';

export interface GridColumnFilter {
  operator: GridFilterOperator;
  value: string;
  value2: string;
}

export interface GridFilterOption {
  value: string;
  label: string;
}

const OPERATOR_LABELS: Record<GridFilterOperator, string> = {
  contains: 'enthält',
  notContains: 'enthält nicht',
  equals: 'ist gleich',
  notEquals: 'ist nicht gleich',
  startsWith: 'beginnt mit',
  endsWith: 'endet mit',
  regex: 'Regex',
  gt: 'größer als',
  gte: 'größer oder gleich',
  lt: 'kleiner als',
  lte: 'kleiner oder gleich',
  between: 'zwischen',
  on: 'am',
  before: 'vor dem',
  after: 'nach dem',
  isTrue: 'ist ja',
  isFalse: 'ist nein',
  empty: 'ist leer',
  notEmpty: 'ist nicht leer',
};

/** Wie viele Eingabefelder ein Operator braucht. */
const OPERATOR_VALUE_COUNT: Record<GridFilterOperator, 0 | 1 | 2> = {
  contains: 1,
  notContains: 1,
  equals: 1,
  notEquals: 1,
  startsWith: 1,
  endsWith: 1,
  regex: 1,
  gt: 1,
  gte: 1,
  lt: 1,
  lte: 1,
  between: 2,
  on: 1,
  before: 1,
  after: 1,
  isTrue: 0,
  isFalse: 0,
  empty: 0,
  notEmpty: 0,
};

const OPERATORS_BY_TYPE: Record<GridFilterType, GridFilterOperator[]> = {
  text: [
    'contains',
    'notContains',
    'equals',
    'notEquals',
    'startsWith',
    'endsWith',
    'regex',
    'empty',
    'notEmpty',
  ],
  number: ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'notEmpty'],
  date: ['on', 'before', 'after', 'between', 'empty', 'notEmpty'],
  boolean: ['isTrue', 'isFalse', 'empty', 'notEmpty'],
  select: ['equals', 'notEquals', 'contains', 'notContains', 'empty', 'notEmpty'],
};

/** Mehr Werte als das bietet keine sinnvolle Auswahlliste mehr. */
const MAX_FILTER_OPTIONS = 200;

/** „8.11.2026“ oder „2026-11-08“ – nur vollständige Datumsangaben. */
const DATE_PATTERN = /^(\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2})$/;

const TRUE_WORDS = ['true', 'ja', 'yes', '1', '✓', 'x'];
const FALSE_WORDS = ['false', 'nein', 'no', '0', '–', '-'];

/** Zellen ohne Wert werden in vielen Spalten als „—“ dargestellt. */
const EMPTY_PLACEHOLDERS = ['', '—', '-', '–'];

@Component({
  selector: 'app-data-grid',
  imports: [
    MatIconModule,
    MatIconButton,
    MatFormField,
    MatInput,
    MatPrefix,
    MatSuffix,
    MatMenuModule,
    MatTooltip,
    FormsModule,
    NgTemplateOutlet,
  ],
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.scss',
})
export class DataGrid<T extends Record<string, any>> implements AfterContentInit {
  public columns = input.required<GridColumn<T>[]>();
  public title = input<string>();
  public data = input.required<T[]>();
  public toolbarTemplate = input<TemplateRef<any>>();

  public searchable = input(false);
  public searchKeys = input<string[]>([]);

  /** Spaltenfilter anbieten (Filterzeile unter den Spaltenköpfen). */
  public columnFilters = input(true);

  /** Spaltenbreiten per Ziehen änderbar. */
  public resizableColumns = input(true);

  /** Breite der Aktionsspalte, solange sie nicht gezogen wurde. */
  public actionsWidth = input('8rem');

  /**
   * Schlüssel, unter dem die gezogenen Spaltenbreiten gespeichert werden.
   * Ohne Angabe werden die Spaltenschlüssel verwendet, damit jede Tabelle
   * ihre eigenen Breiten behält.
   */
  public storageKey = input<string>();

  @ContentChildren(GridActionCellDirective)
  actionCellDirectives!: QueryList<GridActionCellDirective>;
  actionCellDirective: GridActionCellDirective | null = null;

  public searchQuery = signal('');

  protected readonly actionsKey = ACTIONS_KEY;

  private readonly headerRow = viewChild<ElementRef<HTMLTableRowElement>>('headerRow');
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly regexCache = new Map<string, RegExp | null>();

  /** Gesetzte Filter je Spaltenschlüssel. */
  private readonly filters = signal<Record<string, GridColumnFilter>>({});

  /** Gezogene Spaltenbreiten in Pixeln je Spaltenschlüssel. */
  protected readonly widths = signal<Record<string, number>>({});

  protected readonly resizingKey = signal<string | null>(null);
  protected readonly filtersOpen = signal(false);

  constructor() {
    effect(() => {
      const key = this.resolvedStorageKey();
      if (!this.isBrowser || !key) return;
      this.widths.set(this.readStoredWidths(key));
    });
  }

  ngAfterContentInit() {
    this.actionCellDirective = this.actionCellDirectives.first ?? null;
  }

  // ── Spalten ────────────────────────────────────────────────────────────────

  private readonly columnMap = computed(
    () => new Map(this.columns().map((column) => [column.key, column])),
  );

  displayedColumns = computed(() => {
    const cols = this.columns().map((c) => c.key);
    if (this.actionCellDirective) cols.push(ACTIONS_KEY);
    return cols;
  });

  // ── Filter ─────────────────────────────────────────────────────────────────

  /** Filtertyp je Spalte: aus der Spaltendefinition oder aus den Daten geraten. */
  protected readonly filterTypes = computed<Record<string, GridFilterType>>(() => {
    const rows = this.data();
    const types: Record<string, GridFilterType> = {};
    for (const column of this.columns()) {
      types[column.key] = column.filterType ?? this.inferFilterType(column, rows);
    }
    return types;
  });

  /**
   * Auswahlwerte je Spalte mit `filterType: 'select'` – entweder aus der
   * Spaltendefinition oder aus den vorhandenen Daten zusammengetragen.
   */
  protected readonly filterOptions = computed<Record<string, GridFilterOption[]>>(() => {
    const types = this.filterTypes();
    const rows = this.data();
    const options: Record<string, GridFilterOption[]> = {};

    for (const column of this.columns()) {
      if (types[column.key] !== 'select') continue;

      if (column.filterOptions?.length) {
        options[column.key] = column.filterOptions;
        continue;
      }

      const values = new Map<string, string>();
      for (const row of rows) {
        const text = String(this.filterSource(column, row) ?? '').trim();
        if (EMPTY_PLACEHOLDERS.includes(text.toLowerCase())) continue;
        if (!values.has(text.toLowerCase())) values.set(text.toLowerCase(), text);
        if (values.size >= MAX_FILTER_OPTIONS) break;
      }

      options[column.key] = [...values.values()]
        .sort((a, b) => a.localeCompare(b, 'de'))
        .map((value) => ({ value, label: value }));
    }

    return options;
  });

  /** Für jede Spalte der aktuelle Filterzustand (mit gültigem Standardoperator). */
  protected readonly filterStates = computed<Record<string, GridColumnFilter>>(() => {
    const types = this.filterTypes();
    const stored = this.filters();
    const states: Record<string, GridColumnFilter> = {};

    for (const column of this.columns()) {
      const operators = OPERATORS_BY_TYPE[types[column.key] ?? 'text'];
      const current = stored[column.key];
      const operator =
        current && operators.includes(current.operator) ? current.operator : operators[0];

      states[column.key] = {
        operator,
        value: current?.value ?? '',
        value2: current?.value2 ?? '',
      };
    }

    return states;
  });

  /** Filter, die tatsächlich greifen (Operator gesetzt und Wert vorhanden). */
  protected readonly activeFilters = computed(() => {
    const states = this.filterStates();
    const stored = this.filters();
    const active: { column: GridColumn<T>; filter: GridColumnFilter }[] = [];

    for (const column of this.columns()) {
      if (!this.isFilterable(column) || !stored[column.key]) continue;

      const filter = states[column.key];
      const needed = OPERATOR_VALUE_COUNT[filter.operator];
      if (needed === 1 && !filter.value.trim()) continue;
      if (needed === 2 && !filter.value.trim() && !filter.value2.trim()) continue;

      active.push({ column, filter });
    }

    return active;
  });

  protected readonly activeFilterCount = computed(() => this.activeFilters().length);

  protected readonly filterToggleVisible = computed(
    () => this.columnFilters() && this.columns().some((column) => this.isFilterable(column)),
  );

  protected readonly filtersVisible = computed(
    () => this.filterToggleVisible() && (this.filtersOpen() || this.activeFilterCount() > 0),
  );

  protected isFilterable(column: GridColumn<T>) {
    return this.columnFilters() && (column.filterable ?? true);
  }

  protected filterState(key: string): GridColumnFilter {
    return this.filterStates()[key] ?? { operator: 'contains', value: '', value2: '' };
  }

  protected operatorsFor(key: string) {
    const type = this.filterTypes()[key] ?? 'text';
    return OPERATORS_BY_TYPE[type].map((operator) => ({
      value: operator,
      label: OPERATOR_LABELS[operator],
    }));
  }

  protected operatorLabel(key: string) {
    return OPERATOR_LABELS[this.filterState(key).operator];
  }

  protected operatorValueCount(key: string) {
    return OPERATOR_VALUE_COUNT[this.filterState(key).operator];
  }

  protected inputType(key: string) {
    const type = this.filterTypes()[key] ?? 'text';
    if (type === 'number') return 'number';
    if (type === 'date') return 'date';
    return 'text';
  }

  protected isFilterType(key: string, type: GridFilterType) {
    return (this.filterTypes()[key] ?? 'text') === type;
  }

  /** Auswahlliste statt Eingabefeld – nur für „ist gleich“ und „ist nicht gleich“. */
  protected usesOptionList(key: string) {
    if (!this.isFilterType(key, 'select')) return false;
    const operator = this.filterState(key).operator;
    return operator === 'equals' || operator === 'notEquals';
  }

  protected optionsFor(key: string) {
    return this.filterOptions()[key] ?? [];
  }

  protected isFilterActive(key: string) {
    return this.activeFilters().some((entry) => entry.column.key === key);
  }

  protected toggleFilters() {
    this.filtersOpen.update((open) => !open);
  }

  protected setOperator(key: string, operator: GridFilterOperator) {
    this.filtersOpen.set(true);
    this.filters.update((filters) => {
      const current = filters[key];
      return {
        ...filters,
        [key]: {
          operator,
          value: current?.value ?? '',
          value2: current?.value2 ?? '',
        },
      };
    });
  }

  protected setFilterValue(key: string, event: Event, second = false) {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.filters.update((filters) => {
      const current = filters[key] ?? this.filterState(key);
      return {
        ...filters,
        [key]: {
          operator: current.operator,
          value: second ? current.value : value,
          value2: second ? value : current.value2,
        },
      };
    });
  }

  protected clearFilter(key: string) {
    this.filters.update((filters) => {
      const { [key]: _removed, ...rest } = filters;
      return rest;
    });
  }

  protected clearAllFilters() {
    this.filters.set({});
  }

  protected resetView() {
    this.clearAllFilters();
    this.searchQuery.set('');
  }

  // ── Daten ──────────────────────────────────────────────────────────────────

  filteredData = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const active = this.activeFilters();
    if (!query && active.length === 0) return this.data();

    const keys = this.searchKeys().length ? this.searchKeys() : this.columns().map((c) => c.key);

    return this.data().filter((row) => {
      if (query && !keys.some((key) => this.searchText(row, key).includes(query))) return false;
      return active.every((entry) => this.matches(entry.column, entry.filter, row));
    });
  });

  private searchText(row: T, key: string) {
    const column = this.columnMap().get(key);
    const value = column ? this.displayValue(column, row) : row[key];
    return String(value ?? '').toLowerCase();
  }

  private displayValue(column: GridColumn<T>, row: T) {
    return column.value ? column.value(row) : row[column.key];
  }

  /**
   * Wert, auf dem gefiltert wird: das Datenfeld selbst, wenn es Zahl, Wahrheitswert
   * oder Datum ist, sonst der angezeigte (formatierte) Wert.
   */
  private filterSource(column: GridColumn<T>, row: T): unknown {
    if (column.filterValue) return column.filterValue(row);

    const raw = row[column.key];
    if (typeof raw === 'number' || typeof raw === 'boolean' || raw instanceof Date) return raw;

    return this.displayValue(column, row);
  }

  private inferFilterType(column: GridColumn<T>, rows: readonly T[]): GridFilterType {
    if (column.filterOptions?.length) return 'select';

    for (const row of rows.slice(0, 25)) {
      const value = this.filterSource(column, row);
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'number') return 'number';
      if (typeof value === 'boolean') return 'boolean';
      if (value instanceof Date) return 'date';
      if (typeof value === 'string' && DATE_PATTERN.test(value.trim())) return 'date';
      return 'text';
    }

    return 'text';
  }

  private matches(column: GridColumn<T>, filter: GridColumnFilter, row: T): boolean {
    const type = this.filterTypes()[column.key] ?? 'text';
    const source = this.filterSource(column, row);
    const text = String(source ?? '')
      .trim()
      .toLowerCase();

    switch (filter.operator) {
      case 'empty':
        return EMPTY_PLACEHOLDERS.includes(text);
      case 'notEmpty':
        return !EMPTY_PLACEHOLDERS.includes(text);
      case 'isTrue':
        return this.toBoolean(source) === true;
      case 'isFalse':
        return this.toBoolean(source) === false;
      default:
        break;
    }

    if (type === 'number') {
      const value = this.toNumber(source);
      const from = this.toNumber(filter.value);
      const to = this.toNumber(filter.value2);
      if (value === null) return false;

      switch (filter.operator) {
        case 'equals':
          return from !== null && value === from;
        case 'notEquals':
          return from === null || value !== from;
        case 'gt':
          return from !== null && value > from;
        case 'gte':
          return from !== null && value >= from;
        case 'lt':
          return from !== null && value < from;
        case 'lte':
          return from !== null && value <= from;
        case 'between':
          return (from === null || value >= from) && (to === null || value <= to);
        default:
          break;
      }
    }

    if (type === 'date') {
      const value = this.toDay(source);
      const from = this.toDay(filter.value);
      const to = this.toDay(filter.value2);
      if (value === null) return false;

      switch (filter.operator) {
        case 'on':
        case 'equals':
          return from !== null && value === from;
        case 'before':
        case 'lt':
          return from !== null && value < from;
        case 'after':
        case 'gt':
          return from !== null && value > from;
        case 'between':
          return (from === null || value >= from) && (to === null || value <= to);
        default:
          break;
      }
    }

    const needle = filter.value.trim().toLowerCase();

    switch (filter.operator) {
      case 'contains':
        return text.includes(needle);
      case 'notContains':
        return !text.includes(needle);
      case 'equals':
        return text === needle;
      case 'notEquals':
        return text !== needle;
      case 'startsWith':
        return text.startsWith(needle);
      case 'endsWith':
        return text.endsWith(needle);
      case 'regex': {
        const regex = this.compileRegex(filter.value);
        return regex ? regex.test(String(source ?? '')) : true;
      }
      default:
        return true;
    }
  }

  private compileRegex(pattern: string) {
    if (!this.regexCache.has(pattern)) {
      if (this.regexCache.size > 50) this.regexCache.clear();
      try {
        this.regexCache.set(pattern, new RegExp(pattern, 'i'));
      } catch {
        this.regexCache.set(pattern, null);
      }
    }
    return this.regexCache.get(pattern) ?? null;
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;

    const text = String(value ?? '')
      .trim()
      .toLowerCase();
    if (TRUE_WORDS.includes(text)) return true;
    if (FALSE_WORDS.includes(text)) return false;
    return null;
  }

  /** Zahl aus einem rohen Wert oder einem formatierten Text wie „1.234,56 €“. */
  private toNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean' || value === null || value === undefined) return null;

    let text = String(value)
      .replace(/\s/g, '')
      .replace(/[^\d,.\-]/g, '');
    if (!text) return null;

    const comma = text.lastIndexOf(',');
    const dot = text.lastIndexOf('.');

    if (comma > -1 && dot > -1) {
      // Das hintere Zeichen ist das Dezimaltrennzeichen.
      text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    } else if (comma > -1) {
      text = text.replace(',', '.');
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
      // Nur Tausenderpunkte, kein Dezimalteil.
      text = text.replace(/\./g, '');
    }

    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /** Tagesgenauer Zeitstempel (UTC), damit Zeitzonen nicht hineinspielen. */
  private toDay(value: unknown): number | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? null
        : Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
    }
    if (typeof value !== 'string') return null;

    const text = value.trim();
    const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(text);
    if (german) return Date.UTC(Number(german[3]), Number(german[2]) - 1, Number(german[1]));

    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

    return null;
  }

  // ── Spaltenbreiten ─────────────────────────────────────────────────────────

  private readonly resolvedStorageKey = computed(
    () => this.storageKey() ?? this.columns().map((column) => column.key).join('|'),
  );

  /** Sobald eine Breite gesetzt ist, liegen alle Spalten in Pixeln fest. */
  protected readonly frozen = computed(() => Object.keys(this.widths()).length > 0);

  protected readonly totalWidth = computed(() => {
    const widths = this.widths();
    return this.displayedColumns().reduce((sum, key) => sum + (widths[key] ?? 0), 0);
  });

  protected columnWidth(column: GridColumn<T>) {
    const override = this.widths()[column.key];
    return override ? `${override}px` : (column.width ?? 'auto');
  }

  protected actionsColumnWidth() {
    const override = this.widths()[ACTIONS_KEY];
    return override ? `${override}px` : this.actionsWidth();
  }

  protected isResizable(column: GridColumn<T>) {
    return this.resizableColumns() && (column.resizable ?? true);
  }

  protected startResize(event: PointerEvent, key: string) {
    if (!this.isBrowser) return;

    const row = this.headerRow()?.nativeElement;
    if (!row) return;

    event.preventDefault();
    event.stopPropagation();

    // Erst alle aktuellen Breiten festhalten, damit nur die gezogene Spalte wächst.
    const frozen: Record<string, number> = { ...this.widths() };
    row.querySelectorAll<HTMLElement>('th[data-key]').forEach((cell) => {
      const cellKey = cell.dataset['key'];
      if (!cellKey) return;
      if (frozen[cellKey] === undefined) {
        frozen[cellKey] = Math.round(cell.getBoundingClientRect().width);
      }
    });

    const startWidth = frozen[key];
    const startX = event.clientX;
    this.widths.set(frozen);
    this.resizingKey.set(key);

    const move = (moveEvent: PointerEvent) => {
      const next = Math.max(MIN_COLUMN_WIDTH, Math.round(startWidth + moveEvent.clientX - startX));
      this.widths.update((widths) => ({ ...widths, [key]: next }));
    };

    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      this.resizingKey.set(null);
      this.storeWidths();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  /** Doppelklick auf den Ziehgriff: Spalte zurück auf ihre Standardbreite. */
  protected resetWidth(key: string) {
    this.widths.update((widths) => {
      const { [key]: _removed, ...rest } = widths;
      return rest;
    });
    this.storeWidths();
  }

  protected resetWidths() {
    this.widths.set({});
    this.storeWidths();
  }

  private readStoredWidths(key: string): Record<string, number> {
    try {
      const raw = localStorage.getItem(WIDTH_STORAGE_PREFIX + key);
      if (!raw) return {};

      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};

      const widths: Record<string, number> = {};
      for (const [columnKey, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'number' && Number.isFinite(value) && value >= MIN_COLUMN_WIDTH) {
          widths[columnKey] = Math.round(value);
        }
      }
      return widths;
    } catch {
      return {};
    }
  }

  private storeWidths() {
    if (!this.isBrowser) return;

    const key = this.resolvedStorageKey();
    if (!key) return;

    try {
      const widths = this.widths();
      if (Object.keys(widths).length === 0) localStorage.removeItem(WIDTH_STORAGE_PREFIX + key);
      else localStorage.setItem(WIDTH_STORAGE_PREFIX + key, JSON.stringify(widths));
    } catch {
      // Ohne Speicher (privater Modus) bleiben die Breiten einfach nur für diese Sitzung.
    }
  }

  // ── Darstellung ────────────────────────────────────────────────────────────

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
  cellTemplate?: TemplateRef<{ $implicit: T; value: any }>;
  value?: (row: T) => any;

  /** Spalte lässt sich per Ziehen in der Breite ändern (Standard: ja). */
  resizable?: boolean;

  /** Spalte bietet einen Filter an (Standard: ja). */
  filterable?: boolean;

  /** Filtertyp; ohne Angabe wird er aus den Daten abgeleitet. */
  filterType?: GridFilterType;

  /** Auswahlwerte für `filterType: 'select'`. */
  filterOptions?: GridFilterOption[];

  /** Wert, auf dem gefiltert wird – sonst das Datenfeld bzw. der angezeigte Wert. */
  filterValue?: (row: T) => unknown;
}
