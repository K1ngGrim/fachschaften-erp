import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import type { ItemType } from '../../../shared/models';

@Component({
  selector: 'app-item-type-dialog',
  imports: [FormsModule, MatDialogTitle, MatDialogContent, MatDialogActions, MatFormField, MatLabel, MatInput, MatButton],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit Item Type' : 'Create Item Type' }}</h2>
    <mat-dialog-content class="pt-2">
      <div class="d-flex flex-column gap-3">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:80px">
          <mat-label>Icon</mat-label>
          <input matInput [(ngModel)]="icon" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Name</mat-label>
          <input matInput [(ngModel)]="name" required />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Description</mat-label>
          <input matInput [(ngModel)]="description" />
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="!name">
        {{ isEdit ? 'Save' : 'Create' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ItemTypeDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ItemTypeDialogComponent>);
  readonly dialogData = inject<{ type: ItemType | null }>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.dialogData.type;
  icon = this.dialogData.type?.icon ?? '📦';
  name = this.dialogData.type?.name ?? '';
  description = this.dialogData.type?.description ?? '';

  save() {
    const t: ItemType = {
      id: this.dialogData.type?.id ?? crypto.randomUUID(),
      name: this.name,
      description: this.description,
      icon: this.icon || '📦',
      active: this.dialogData.type?.active ?? true,
    };
    this.dialogRef.close(t);
  }

  cancel() { this.dialogRef.close(); }
}
