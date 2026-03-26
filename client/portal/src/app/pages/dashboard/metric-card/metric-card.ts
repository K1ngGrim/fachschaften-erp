import { Component, input } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-metric-card',
  imports: [MatCard, MatCardContent, MatIcon, NgClass],
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.scss',
})
export class MetricCard {
  // Neue Signal Inputs
  title = input.required<string>();
  value = input.required<string>();
  subtitle = input<string>();
  icon = input.required<string>(); // Material Icon Name
  trend = input<'up' | 'down' | 'neutral'>();

  // Hilfsmethode für Bootstrap Text-Farben
  getTrendClass(): string {
    const t = this.trend();
    if (t === 'up') return 'text-success';
    if (t === 'down') return 'text-danger';
    return 'text-muted';
  }
}
