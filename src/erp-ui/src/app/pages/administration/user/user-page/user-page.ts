import { Component, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { DataGrid, GridActionCellDirective, GridColumn } from '../../../../shared/components/data-grid/data-grid';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { UserDto, UsersService } from '../../../../../../projects/api/src/lib';
import { lastValueFrom } from 'rxjs';
import { MatChip } from '@angular/material/chips';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-user-page',
  imports: [
    DataGrid,
    GridActionCellDirective,
    MatIcon,
    MatIconButton,
    MatTooltip,
    PageHeader,
    MatChip,
    JsonPipe,
  ],
  templateUrl: './user-page.html',
  styleUrl: './user-page.scss',
})
export class UserPage implements OnInit {
  public roleTemplate = viewChild<TemplateRef<any>>('roleTemplate');

  public userService = inject(UsersService);
  public users = signal<UserDto[]>([]);
  public columns = signal<GridColumn<UserDto>[]>([]);

  async ngOnInit() {
    this.columns.set([
      { key: 'userName', label: 'Name' },
      { key: 'email', label: 'Email' },
      {
        key: 'roles',
        label: 'Rollen',
        cellTemplate: this.roleTemplate(),
      },
    ]);

    const users = await lastValueFrom(this.userService.apiUsersGet());
    this.users.set(users);
  }
}
