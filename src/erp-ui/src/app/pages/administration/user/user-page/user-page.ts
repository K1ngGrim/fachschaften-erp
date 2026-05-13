import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  DataGrid,
  GridActionCellDirective,
  GridColumn,
} from '../../../../shared/components/data-grid/data-grid';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import type { Product } from '../../../../shared/models';
import { UserDto, UsersService } from '../../../../../../projects/api/src/lib';
import { lastValueFrom } from 'rxjs';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-user-page',
  imports: [
    DataGrid,
    GridActionCellDirective,
    MatIcon,
    MatIconButton,
    MatTooltip,
    PageHeader,
    AsyncPipe,
  ],
  templateUrl: './user-page.html',
  styleUrl: './user-page.scss',
})
export class UserPage implements OnInit {
  public userService = inject(UsersService);

  public users = signal<UserDto[]>([]);

  columns: GridColumn<UserDto>[] = [
    { key: 'userName', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'roles',
      label: 'Rollen',
      value: (row) => row.roles.join(', '),
    }
  ];

  async ngOnInit() {
    const users = await lastValueFrom(this.userService.apiUsersGet());
    this.users.set(users);

    console.log(users);
  }
}
