import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { lastValueFrom } from 'rxjs';
import {
  PermissionsService,
  RoleDto,
  RolesService,
} from '../../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { Auth } from '../../../../../core/services/auth';
import { DialogService } from '../../../../../core/services/dialog-service';
import { PermissionType } from '../../../../../shared/models/permission-type';

type Access = 'read' | 'write';

interface PermissionArea {
  key: string;
  label: string;
  read?: string;
  write?: string;
}

/** Anzeigenamen und Reihenfolge der Bereiche; unbekannte Bereiche kommen ans Ende. */
const AREA_LABELS: Record<string, string> = {
  inventory: 'Lager & Lieferungen',
  products: 'Artikel',
  itemtypes: 'Artikeltypen',
  suppliers: 'Lieferanten',
  customfields: 'Custom Fields',
  finance: 'Finanzen',
  wiki: 'Wiki',
  tables: 'Eigene Tabellen: Einträge',
  tabledesign: 'Eigene Tabellen: Aufbau',
  users: 'Benutzer',
  roles: 'Rollen',
  permissions: 'Rechte vergeben',
  settings: 'Einstellungen',
};

@Component({
  selector: 'app-roles-page',
  imports: [
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatButton,
    MatIconButton,
    MatCheckbox,
    MatIcon,
    MatTooltip,
    PageHeader,
  ],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss',
})
export class RolesPage implements OnInit {
  private readonly rolesController = inject(RolesService);
  private readonly permissionsController = inject(PermissionsService);
  private readonly dialogService = inject(DialogService);
  private readonly auth = inject(Auth);

  public readonly roles = signal<RoleDto[]>([]);
  public readonly areas = signal<PermissionArea[]>([]);
  public readonly selectedId = signal<string | null>(null);
  public readonly granted = signal<ReadonlySet<string>>(new Set());
  public readonly saving = signal(false);
  public readonly error = signal<string | null>(null);

  public readonly selected = computed(
    () => this.roles().find((role) => role.id === this.selectedId()) ?? null,
  );

  public readonly canManageRoles = this.auth.hasPermission(PermissionType.RolesCanWrite);

  /** Rechte ändern braucht Schreibrecht auf Rollen und auf die Rechtevergabe. */
  public readonly canEditPermissions = computed(
    () =>
      this.canManageRoles &&
      this.auth.hasPermission(PermissionType.PermissionsCanWrite) &&
      !this.selected()?.isProtected,
  );

  async ngOnInit() {
    const [roles, permissions] = await Promise.all([
      lastValueFrom(this.rolesController.apiRolesGet()),
      lastValueFrom(this.permissionsController.apiPermissionsGet()),
    ]);

    this.areas.set(buildAreas(permissions as string[]));
    this.roles.set(roles);
    if (roles.length) await this.select(roles[0]);
  }

  public async select(role: RoleDto) {
    this.selectedId.set(role.id);
    this.error.set(null);
    await this.loadPermissions(role.id);
  }

  public isGranted(permission: string | undefined): boolean {
    return !!permission && this.granted().has(permission);
  }

  /**
   * Schreiben setzt Lesen voraus: Schreibrecht vergeben vergibt auch Lesen,
   * Leserecht entziehen entzieht auch Schreiben.
   */
  public async toggle(area: PermissionArea, access: Access, checked: boolean) {
    const role = this.selected();
    if (!role) return;

    const changes: { permission: string; grant: boolean }[] = [];
    const add = (permission?: string) =>
      permission && !this.isGranted(permission) && changes.push({ permission, grant: true });
    const remove = (permission?: string) =>
      permission && this.isGranted(permission) && changes.push({ permission, grant: false });

    if (checked) {
      if (access === 'write') add(area.read);
      add(area[access]);
    } else {
      remove(area[access]);
      if (access === 'read') remove(area.write);
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      for (const { permission, grant } of changes) {
        const request = { id: role.id, permission };
        await lastValueFrom(
          grant
            ? this.rolesController.apiRolesIdPermissionsPermissionPost(request)
            : this.rolesController.apiRolesIdPermissionsPermissionDelete(request),
        );
      }
    } catch {
      this.error.set('Die Rechte konnten nicht gespeichert werden.');
    } finally {
      // Immer neu laden, damit die Anzeige dem tatsächlichen Stand entspricht.
      await this.loadPermissions(role.id);
      this.saving.set(false);
    }
  }

  public async create() {
    const result = await this.dialogService.openDialog<{ name: string }>({
      title: 'Neue Rolle',
      fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
    });
    if (!result?.name) return;

    this.error.set(null);
    try {
      const role = await lastValueFrom(
        this.rolesController.apiRolesPost({ createRoleRequest: { name: result.name } }),
      );
      await this.loadRoles();
      await this.select(role);
    } catch (error) {
      this.error.set(
        isDuplicateName(error)
          ? `Eine Rolle „${result.name}“ gibt es bereits.`
          : 'Die Rolle konnte nicht angelegt werden.',
      );
    }
  }

  public async delete(role: RoleDto) {
    const users =
      role.userCount === 1 ? '1 Benutzer verliert' : `${role.userCount} Benutzer verlieren`;
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Rolle löschen',
      message: role.userCount
        ? `„${role.name}“ löschen? ${users} damit die Rechte dieser Rolle.`
        : `„${role.name}“ löschen?`,
      confirmLabel: 'Löschen',
    });
    if (!confirmed) return;

    this.error.set(null);
    try {
      await lastValueFrom(this.rolesController.apiRolesIdDelete({ id: role.id }));
      await this.loadRoles();
      const next = this.roles()[0];
      if (next) {
        await this.select(next);
      } else {
        this.selectedId.set(null);
        this.granted.set(new Set());
      }
    } catch {
      this.error.set('Die Rolle konnte nicht gelöscht werden.');
    }
  }

  private async loadRoles() {
    this.roles.set(await lastValueFrom(this.rolesController.apiRolesGet()));
  }

  private async loadPermissions(roleId: string) {
    const permissions = await lastValueFrom(
      this.rolesController.apiRolesIdPermissionsGet({ id: roleId }),
    );
    if (this.selectedId() === roleId) this.granted.set(new Set(permissions));
  }
}

/** Gruppiert "bereich.canread"/"bereich.canwrite" zu einer Zeile je Bereich. */
function buildAreas(permissions: string[]): PermissionArea[] {
  const areas = new Map<string, PermissionArea>();
  for (const permission of permissions) {
    const [key, action] = permission.split('.');
    const area = areas.get(key) ?? { key, label: AREA_LABELS[key] ?? key };
    if (action === 'canread') area.read = permission;
    if (action === 'canwrite') area.write = permission;
    areas.set(key, area);
  }

  const order = Object.keys(AREA_LABELS);
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
  return [...areas.values()].sort((a, b) => rank(a.key) - rank(b.key));
}

function isDuplicateName(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    Array.isArray(error.error) &&
    error.error.some((e: { code?: string }) => e.code === 'DuplicateRoleName')
  );
}
