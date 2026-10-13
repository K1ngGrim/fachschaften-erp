import { Component, inject } from '@angular/core';
import { Organization } from '../../../core/services/organization';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';

interface StorageEntry {
  name: string;
  purpose: string;
  lifetime: string;
}

/** Öffentliche Datenschutzhinweise; die Liste muss zu den tatsächlich gesetzten Cookies passen. */
@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink, MatIcon],
  templateUrl: './privacy-page.html',
  styleUrl: './privacy-page.scss',
})
export class PrivacyPage {
  protected readonly organization = inject(Organization).settings;

  public readonly cookies: StorageEntry[] = [
    {
      name: 'Identity.Application',
      purpose: 'Hält dich nach der Anmeldung angemeldet.',
      lifetime: 'Bis zur Abmeldung, längstens 14 Tage nach der letzten Nutzung',
    },
    {
      name: 'Identity.TwoFactorUserId',
      purpose: 'Merkt sich während der Anmeldung mit Zwei-Faktor-Code, wer sich gerade anmeldet.',
      lifetime: 'Bis zum Ende der Anmeldung bzw. Schließen des Browsers',
    },
  ];

  public readonly browserStorage: StorageEntry[] = [
    {
      name: 'erp.cookie-notice',
      purpose: 'Merkt sich, dass du den Cookie-Hinweis geschlossen hast.',
      lifetime: 'Bis du die Website-Daten im Browser löschst',
    },
  ];
}
