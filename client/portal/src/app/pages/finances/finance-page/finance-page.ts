// pages/finance/finance.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';

type TypeFilter = 'alle' | 'einnahme' | 'ausgabe';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDividerModule,
    MatMenuModule,
  ],
  template: `
    <!-- ── Header ── -->
    <mat-toolbar class="page-header" color="primary">
      <mat-icon>account_balance_wallet</mat-icon>
      <span class="header-title">Finanzen</span>
      <span class="spacer"></span>

      <mat-form-field class="year-select" appearance="outline">
        <mat-select [(ngModel)]="selectedYear" (ngModelChange)="applyFilters()">
          <mat-option [value]="2025">2025</mat-option>
          <mat-option [value]="2024">2024</mat-option>
          <mat-option [value]="2023">2023</mat-option>
        </mat-select>
      </mat-form-field>

      <button mat-flat-button class="add-btn" (click)="null">
        <mat-icon>add</mat-icon> Buchung
      </button>
    </mat-toolbar>

    <div class="page-content">
      <!-- ── Bereichs-Übersicht ── -->
      <section class="section">
        <div class="section-header">
          <h2>Steuerbereiche</h2>
          <button mat-button *ngIf="activeAreaFilter" (click)="clearAreaFilter()">
            <mat-icon>close</mat-icon> Filter aufheben
          </button>
        </div>
        <div class="area-grid">

        </div>
      </section>

      <!-- ── Gesamt-Saldo ── -->
      <div class="total-bar">
        <div class="total-item">
          <mat-icon>trending_up</mat-icon>
          <span>Gesamt Einnahmen</span>
          <strong class="income">{{
            totalIncome | currency: 'EUR' : 'symbol' : '1.2-2' : 'de'
          }}</strong>
        </div>
        <div class="total-divider"></div>
        <div class="total-item">
          <mat-icon>trending_down</mat-icon>
          <span>Gesamt Ausgaben</span>
          <strong class="expense">{{
            totalExpense | currency: 'EUR' : 'symbol' : '1.2-2' : 'de'
          }}</strong>
        </div>
        <div class="total-divider"></div>
        <div
          class="total-item highlight"
          [class.positive]="totalSaldo >= 0"
          [class.negative]="totalSaldo < 0"
        >
          <mat-icon>{{ totalSaldo >= 0 ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
          <span>Gesamtsaldo {{ selectedYear }}</span>
          <strong
            >{{ totalSaldo >= 0 ? '+' : ''
            }}{{ totalSaldo | currency: 'EUR' : 'symbol' : '1.2-2' : 'de' }}</strong
          >
        </div>
      </div>

      <!-- ── Buchungsliste + Filter ── -->
      <section class="section">
        <div class="filter-row">
          <h2>
            Buchungen
            <span *ngIf="activeAreaFilter" class="filter-hint">
              — {{ taxAreaMeta[activeAreaFilter].label }}
            </span>
          </h2>

          <div class="filters">
            <!-- Typ-Filter -->
            <mat-button-toggle-group [(ngModel)]="typeFilter" (ngModelChange)="applyFilters()">
              <mat-button-toggle value="alle">Alle</mat-button-toggle>
              <mat-button-toggle value="einnahme">
                <mat-icon>arrow_downward</mat-icon> Einnahmen
              </mat-button-toggle>
              <mat-button-toggle value="ausgabe">
                <mat-icon>arrow_upward</mat-icon> Ausgaben
              </mat-button-toggle>
            </mat-button-toggle-group>

            <!-- Monat-Filter -->
            <mat-form-field appearance="outline" class="month-select">
              <mat-label>Monat</mat-label>
              <mat-select [(ngModel)]="selectedMonth" (ngModelChange)="applyFilters()">
                <mat-option [value]="null">Alle Monate</mat-option>
                <mat-option *ngFor="let m of months; let i = index" [value]="i + 1">{{
                  m
                }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* Header */
      .page-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 24px;
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .page-header mat-icon {
        font-size: 22px;
      }
      .header-title {
        font-size: 18px;
        font-weight: 600;
      }
      .spacer {
        flex: 1;
      }
      .year-select {
        width: 100px;
        margin: 0 12px;
      }
      .year-select ::ng-deep .mat-mdc-text-field-wrapper {
        background: rgba(255, 255, 255, 0.12);
      }
      .year-select ::ng-deep .mat-mdc-select-value,
      .year-select ::ng-deep label {
        color: white !important;
      }
      .add-btn {
        background: white;
        color: var(--mat-sys-primary, #1976d2);
        font-weight: 600;
      }

      /* Content */
      .page-content {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 32px;
        max-width: 1200px;
      }

      /* Sections */
      .section {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .filter-hint {
        text-transform: none;
        letter-spacing: 0;
        font-weight: 400;
        color: var(--mat-sys-on-surface-variant, #666);
      }

      /* Area grid */
      .area-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }

      /* Gesamt-Saldo-Leiste */
      .total-bar {
        display: flex;
        align-items: stretch;
        gap: 0;
        background: var(--mat-sys-surface-container, #f5f5f5);
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
      }
      .total-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 18px;
      }
      .total-item mat-icon {
        opacity: 0.6;
      }
      .total-item span {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--mat-sys-on-surface-variant, #666);
      }
      .total-item strong {
        font-size: 20px;
      }
      .total-item.highlight {
        background: var(--mat-sys-surface-container-highest, #ebebeb);
      }
      .total-item.positive strong {
        color: #16a34a;
      }
      .total-item.negative strong {
        color: #dc2626;
      }
      .income {
        color: #16a34a;
      }
      .expense {
        color: #dc2626;
      }
      .total-divider {
        width: 1px;
        background: var(--mat-sys-outline-variant, #e0e0e0);
      }

      /* Filter-Zeile */
      .filter-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .filters {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .month-select {
        width: 140px;
      }
    `,
  ],
})
export class FinancePage implements OnInit {
  taxAreaMeta = TAX_AREA_META;
  months = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ];

  // ── State ─────────────────────────────────────────────────
  transactions: Transaction[] = [...MOCK_TRANSACTIONS];
  filteredTransactions: Transaction[] = [];

  activeAreaFilter: TaxArea | null = null;
  typeFilter: TypeFilter = 'alle';
  selectedYear = 2025;
  selectedMonth: number | null = null;

  // ── Computed ──────────────────────────────────────────────
  get totalIncome() {
    return this.filteredTransactions
      .filter((t) => t.type === 'einnahme')
      .reduce((s, t) => s + t.amount, 0);
  }
  get totalExpense() {
    return this.filteredTransactions
      .filter((t) => t.type === 'ausgabe')
      .reduce((s, t) => s + t.amount, 0);
  }
  get totalSaldo() {
    return this.totalIncome - this.totalExpense;
  }

  get areaSummaries(): any[] {
    // Summaries immer aus ALLEN Buchungen des Jahres (unabhängig von Typ-Filter)
    const yearTx = this.transactions.filter((t) => t.date.getFullYear() === this.selectedYear);
    return (['ideell', 'zweckbetrieb', 'wirtschaft'] as TaxArea[]).map((area) => {
      const areaT = yearTx.filter((t) => t.taxArea === area);
      const einnahmen = areaT
        .filter((t) => t.type === 'einnahme')
        .reduce((s, t) => s + t.amount, 0);
      const ausgaben = areaT.filter((t) => t.type === 'ausgabe').reduce((s, t) => s + t.amount, 0);
      return {
        meta: TAX_AREA_META[area],
        einnahmen,
        ausgaben,
        saldo: einnahmen - ausgaben,
        transactionCount: areaT.length,
      };
    });
  }

  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.applyFilters();
  }

  applyFilters() {
    this.filteredTransactions = this.transactions.filter((t) => {
      const matchYear = t.date.getFullYear() === this.selectedYear;
      const matchMonth = !this.selectedMonth || t.date.getMonth() + 1 === this.selectedMonth;
      const matchArea = !this.activeAreaFilter || t.taxArea === this.activeAreaFilter;
      const matchType = this.typeFilter === 'alle' || t.type === this.typeFilter;
      return matchYear && matchMonth && matchArea && matchType;
    });
  }

  onAreaSelected(area: TaxArea) {
    this.activeAreaFilter = this.activeAreaFilter === area ? null : area;
    this.applyFilters();
  }

  clearAreaFilter() {
    this.activeAreaFilter = null;
    this.applyFilters();
  }
  /*
    // ── CRUD (Mock) ───────────────────────────────────────────
    openAddDialog() {
      this.dialog
        .open(TransactionFormDialogComponent, {
          data: {},
          width: '560px',
        })
        .afterClosed()
        .subscribe((result: Omit<Transaction, 'id'> | null) => {
          if (!result) return;
          const newTx: Transaction = { ...result, id: crypto.randomUUID() };
          this.transactions = [newTx, ...this.transactions];
          this.applyFilters();
          this.snackBar.open('Buchung angelegt', 'OK', { duratn: 2500 });
        });
    }
  /*
    openEditDialog(tx: Transaction) {
      this.dialog
        .open(TransactionFormDialogComponent, {
          data: { transaction: tx },
          width: '560px',
        })
        .afterClosed()
        .subscribe((result: Omit<Transaction, 'id'> | null) => {
          if (!result) return;
          this.transactions = this.transactions.map((t) =>
            t.id === tx.id ? { ...t, ...result } : t,
          );
          this.applyFilters();
          this.snackBar.open('Buchung gespeichert', 'OK', { duration: 2500 });
        });
    }
    */

  deleteTransaction(tx: Transaction) {
    // In Produktion: Bestätigungsdialog vorschalten
    this.transactions = this.transactions.filter((t) => t.id !== tx.id);
    this.applyFilters();
    this.snackBar
      .open('Buchung gelöscht', 'Rückgängig', { duration: 3000 })
      .onAction()
      .subscribe(() => {
        this.transactions = [...this.transactions, tx];
        this.applyFilters();
      });
  }
}

export type TaxArea = 'ideell' | 'zweckbetrieb' | 'wirtschaft';
export type TransactionType = 'einnahme' | 'ausgabe';

export interface Transaction {
  id: string;
  date: Date;
  type: TransactionType;
  taxArea: TaxArea;
  amount: number;
  description: string;
  category: string;
}

export interface TaxAreaMeta {
  key: TaxArea;
  label: string;
  description: string;
  icon: string;
  color: string; // CSS custom property suffix, z.B. 'teal'
}

export const TAX_AREA_META: Record<TaxArea, TaxAreaMeta> = {
  ideell: {
    key: 'ideell',
    label: 'Ideeller Bereich',
    description: 'Vereinszweck, Mitgliederbeiträge, Spenden',
    icon: 'volunteer_activism',
    color: 'teal',
  },
  zweckbetrieb: {
    key: 'zweckbetrieb',
    label: 'Zweckbetrieb',
    description: 'Sportturniere, Kurse, gemeinnützige Veranstaltungen',
    icon: 'sports',
    color: 'blue',
  },
  wirtschaft: {
    key: 'wirtschaft',
    label: 'Wirtschaftl. Betrieb',
    description: 'Kiosk, Werbung, Vermietung, steuerpflichtige Einnahmen',
    icon: 'storefront',
    color: 'amber',
  },
};

export const CATEGORIES: Record<TaxArea, string[]> = {
  ideell: ['Mitgliedsbeitrag', 'Spende', 'Förderung', 'Ehrenamt', 'Sonstiges'],
  zweckbetrieb: ['Turnier', 'Kurs', 'Training', 'Veranstaltung', 'Ausrüstung', 'Sonstiges'],
  wirtschaft: ['Kiosk', 'Werbung', 'Vermietung', 'Sponsoring', 'Sonstiges'],
};

// ─── Mock-Daten ───────────────────────────────────────────────────────────────
export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    date: new Date('2025-01-15'),
    type: 'einnahme',
    taxArea: 'ideell',
    amount: 1200.0,
    description: 'Mitgliedsbeiträge Q1',
    category: 'Mitgliedsbeitrag',
  },
  {
    id: '2',
    date: new Date('2025-01-22'),
    type: 'einnahme',
    taxArea: 'ideell',
    amount: 500.0,
    description: 'Spende Mustermann GmbH',
    category: 'Spende',
  },
  {
    id: '3',
    date: new Date('2025-02-03'),
    type: 'ausgabe',
    taxArea: 'ideell',
    amount: 340.0,
    description: 'Büromaterial & Verwaltung',
    category: 'Sonstiges',
  },
  {
    id: '4',
    date: new Date('2025-02-10'),
    type: 'ausgabe',
    taxArea: 'ideell',
    amount: 85.5,
    description: 'Porto & Druckkosten',
    category: 'Sonstiges',
  },
  {
    id: '5',
    date: new Date('2025-02-18'),
    type: 'einnahme',
    taxArea: 'ideell',
    amount: 250.0,
    description: 'Fördermittel Stadtjugendring',
    category: 'Förderung',
  },
  {
    id: '6',
    date: new Date('2025-03-01'),
    type: 'einnahme',
    taxArea: 'zweckbetrieb',
    amount: 980.0,
    description: 'Startgelder Frühjahrsturnier',
    category: 'Turnier',
  },
  {
    id: '7',
    date: new Date('2025-03-05'),
    type: 'ausgabe',
    taxArea: 'zweckbetrieb',
    amount: 420.0,
    description: 'Hallenmiete Frühjahrsturnier',
    category: 'Veranstaltung',
  },
  {
    id: '8',
    date: new Date('2025-03-12'),
    type: 'ausgabe',
    taxArea: 'zweckbetrieb',
    amount: 175.0,
    description: 'Pokale & Urkunden',
    category: 'Turnier',
  },
  {
    id: '9',
    date: new Date('2025-03-20'),
    type: 'einnahme',
    taxArea: 'zweckbetrieb',
    amount: 320.0,
    description: 'Kursgebühren Frühjahrs-Yoga',
    category: 'Kurs',
  },
  {
    id: '10',
    date: new Date('2025-03-25'),
    type: 'ausgabe',
    taxArea: 'zweckbetrieb',
    amount: 210.0,
    description: 'Trainingsgeräte',
    category: 'Ausrüstung',
  },
  {
    id: '11',
    date: new Date('2025-04-02'),
    type: 'einnahme',
    taxArea: 'wirtschaft',
    amount: 1540.0,
    description: 'Kiosk-Einnahmen März',
    category: 'Kiosk',
  },
  {
    id: '12',
    date: new Date('2025-04-08'),
    type: 'ausgabe',
    taxArea: 'wirtschaft',
    amount: 620.0,
    description: 'Wareneinkauf Kiosk',
    category: 'Kiosk',
  },
  {
    id: '13',
    date: new Date('2025-04-15'),
    type: 'einnahme',
    taxArea: 'wirtschaft',
    amount: 800.0,
    description: 'Trikotwerbung FC Musterstadt',
    category: 'Werbung',
  },
  {
    id: '14',
    date: new Date('2025-04-20'),
    type: 'ausgabe',
    taxArea: 'wirtschaft',
    amount: 95.0,
    description: 'Steuerberatung',
    category: 'Sonstiges',
  },
  {
    id: '15',
    date: new Date('2025-04-28'),
    type: 'einnahme',
    taxArea: 'wirtschaft',
    amount: 350.0,
    description: 'Hallenvermietung Firmenteam',
    category: 'Vermietung',
  },
  {
    id: '16',
    date: new Date('2025-05-05'),
    type: 'einnahme',
    taxArea: 'ideell',
    amount: 180.0,
    description: 'Mitgliedsbeiträge Nachzahlung',
    category: 'Mitgliedsbeitrag',
  },
  {
    id: '17',
    date: new Date('2025-05-10'),
    type: 'ausgabe',
    taxArea: 'zweckbetrieb',
    amount: 300.0,
    description: 'Schiedsrichterkosten',
    category: 'Turnier',
  },
  {
    id: '18',
    date: new Date('2025-05-15'),
    type: 'einnahme',
    taxArea: 'zweckbetrieb',
    amount: 450.0,
    description: 'Anmeldegebühren Sommerkurs',
    category: 'Kurs',
  },
];
