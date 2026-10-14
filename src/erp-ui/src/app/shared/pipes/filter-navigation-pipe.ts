import { inject, Pipe, PipeTransform } from '@angular/core';
import { Auth } from '../../core/services/auth';
import { NavigationItem } from '../../core/services/navigation';

@Pipe({
  name: 'filterNavigation',
})
export class FilterNavigationPipe implements PipeTransform {
  private auth = inject(Auth);

  /** <paramref name="enabledModules"/> als Argument, damit die Pipe bei Änderungen neu rechnet. */
  transform(items: NavigationItem[], enabledModules: ReadonlySet<string>): NavigationItem[] {
    return items.filter(
      (item) =>
        (!item.module || enabledModules.has(item.module)) &&
        (!item.permissions?.length || item.permissions.some((p) => this.auth.hasPermission(p))),
    );
  }
}
