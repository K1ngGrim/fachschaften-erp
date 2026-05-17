import { inject, Pipe, PipeTransform } from '@angular/core';
import { Auth } from '../../core/services/auth';
import { NavigationItem } from '../../core/services/navigation';

@Pipe({
  name: 'filterNavigation',
})
export class FilterNavigationPipe implements PipeTransform {
  private auth = inject(Auth);

  transform(items: NavigationItem[]): NavigationItem[] {
    return items.filter(
      (item) =>
        !item.permissions?.length || item.permissions.some((p) => this.auth.hasPermission(p)),
    );
  }
}
