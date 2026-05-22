import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';

// delete-dialog.ts
export interface DeleteDialogData {
  title?: string;
  message?: string;
}

@Component({
  selector: 'app-delete-dialog',
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton],
  template: `
    <h2 mat-dialog-title>{{ data.title ?? 'Delete' }}</h2>
    <mat-dialog-content>
      <p>
        {{
          data.message ?? 'Are you sure you want to delete this item? This action cannot be undone.'
        }}
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">Cancel</button>
      <button mat-raised-button color="warn" (click)="dialogRef.close(true)">Delete</button>
    </mat-dialog-actions>
  `,
})
export class DeleteDialog {
  dialogRef = inject(MatDialogRef<DeleteDialog, boolean>);
  data = inject<DeleteDialogData>(MAT_DIALOG_DATA);
}
