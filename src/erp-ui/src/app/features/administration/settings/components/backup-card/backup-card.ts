import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { lastValueFrom } from 'rxjs';
import {
  BackupRunDto,
  BackupService,
  BackupSettingsDto,
  BackupStatus,
  BackupTrigger,
} from '../../../../../../../projects/api/src/lib';

/** Backup per WebDAV: Einstellungen, Verbindungstest, manueller Start und letzte Läufe. */
@Component({
  selector: 'app-backup-card',
  imports: [
    FormsModule,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatSlideToggle,
    MatProgressSpinner,
  ],
  templateUrl: './backup-card.html',
  styleUrl: './backup-card.scss',
})
export class BackupCard implements OnInit, OnDestroy {
  private readonly backupController = inject(BackupService);
  private poll: ReturnType<typeof setInterval> | null = null;

  protected readonly settings = signal<BackupSettingsDto | null>(null);
  protected readonly runs = signal<BackupRunDto[]>([]);

  protected readonly enabled = signal(false);
  protected readonly url = signal('');
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly time = signal('03:00');
  protected readonly keepCount = signal(30);
  protected readonly includeCsv = signal(true);
  protected readonly archivePassword = signal('');
  protected readonly removeArchivePassword = signal(false);
  protected readonly notifyEmail = signal('');

  protected readonly busy = signal<'save' | 'test' | 'run' | null>(null);
  protected readonly message = signal<{ text: string; ok: boolean } | null>(null);

  protected readonly BackupStatus = BackupStatus;
  protected readonly running = computed(
    () =>
      this.runs().some((r) => r.status === BackupStatus.Running) || !!this.settings()?.isRunning,
  );

  protected readonly problem = computed(() => {
    if (this.enabled() && !this.url().trim())
      return 'Für automatische Backups fehlt der WebDAV-Ordner.';
    if (this.url().trim() && !/^https?:\/\//i.test(this.url().trim())) {
      return 'Der WebDAV-Ordner muss mit https:// beginnen.';
    }
    if (!/^\d{2}:\d{2}$/.test(this.time())) return 'Bitte eine Uhrzeit angeben.';
    if (!(this.keepCount() >= 1 && this.keepCount() <= 365)) return 'Behalten: 1 bis 365 Backups.';
    return null;
  });

  async ngOnInit() {
    const [settings, runs] = await Promise.all([
      lastValueFrom(this.backupController.apiBackupSettingsGet()),
      lastValueFrom(this.backupController.apiBackupRunsGet()),
    ]);
    this.apply(settings);
    this.runs.set(runs);
    if (this.running()) this.startPolling();
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  protected async save() {
    if (this.problem()) return;
    await this.run('save', async () => {
      const archivePassword = this.removeArchivePassword() ? '' : this.archivePassword() || null;
      const settings = await lastValueFrom(
        this.backupController.apiBackupSettingsPut({
          saveBackupSettingsRequest: {
            enabled: this.enabled(),
            webDavUrl: this.url().trim() || null,
            username: this.username().trim() || null,
            password: this.password() || null,
            time: this.time(),
            keepCount: this.keepCount(),
            includeCsv: this.includeCsv(),
            archivePassword,
            notifyEmail: this.notifyEmail().trim() || null,
          },
        }),
      );
      this.apply(settings);
      this.message.set({ text: 'Die Backup-Einstellungen sind gespeichert.', ok: true });
    });
  }

  protected async test() {
    if (!this.url().trim()) return;
    await this.run('test', async () => {
      const result = await lastValueFrom(
        this.backupController.apiBackupTestPost({
          testBackupConnectionRequest: {
            webDavUrl: this.url().trim(),
            username: this.username().trim() || null,
            password: this.password() || null,
          },
        }),
      );
      this.message.set({ text: result.message, ok: result.success });
    });
  }

  protected async runNow() {
    await this.run('run', async () => {
      const run = await lastValueFrom(this.backupController.apiBackupRunPost());
      this.runs.update((runs) => [run, ...runs]);
      this.message.set({ text: 'Das Backup läuft.', ok: true });
      this.startPolling();
    });
  }

  protected statusLabel(run: BackupRunDto): string {
    switch (run.status) {
      case BackupStatus.Running:
        return 'Läuft';
      case BackupStatus.Succeeded:
        return 'Erfolgreich';
      default:
        return 'Fehlgeschlagen';
    }
  }

  protected triggerLabel(run: BackupRunDto): string {
    return run.trigger === BackupTrigger.Manual
      ? `von Hand${run.triggeredBy ? ' (' + run.triggeredBy + ')' : ''}`
      : 'automatisch';
  }

  protected formatDateTime(value: string | null): string {
    if (!value) return '';
    return new Date(value).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected formatSize(bytes: number | null): string {
    if (bytes === null) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
  }

  private apply(settings: BackupSettingsDto) {
    this.settings.set(settings);
    this.enabled.set(settings.enabled);
    this.url.set(settings.webDavUrl ?? '');
    this.username.set(settings.username ?? '');
    this.password.set('');
    this.time.set(settings.time);
    this.keepCount.set(settings.keepCount);
    this.includeCsv.set(settings.includeCsv);
    this.archivePassword.set('');
    this.removeArchivePassword.set(false);
    this.notifyEmail.set(settings.notifyEmail ?? '');
  }

  private async run(kind: 'save' | 'test' | 'run', action: () => Promise<void>) {
    this.busy.set(kind);
    this.message.set(null);
    try {
      await action();
    } catch (error) {
      this.message.set({
        text:
          error instanceof HttpErrorResponse && error.status === 409
            ? 'Es läuft bereits ein Backup.'
            : error instanceof HttpErrorResponse && typeof error.error === 'string'
              ? `Abgelehnt: ${error.error}`
              : 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
        ok: false,
      });
    } finally {
      this.busy.set(null);
    }
  }

  /** Solange ein Backup läuft, alle 3 Sekunden den Verlauf neu laden. */
  private startPolling() {
    if (this.poll) return;
    this.poll = setInterval(async () => {
      const runs = await lastValueFrom(this.backupController.apiBackupRunsGet()).catch(() => null);
      if (!runs) return;
      this.runs.set(runs);
      if (!runs.some((r) => r.status === BackupStatus.Running)) {
        this.stopPolling();
        this.settings.update((s) => (s ? { ...s, isRunning: false } : s));
      }
    }, 3000);
  }

  private stopPolling() {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }
}
