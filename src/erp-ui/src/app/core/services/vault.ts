import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import {
  CustomTableAccessService,
  CustomTableDto,
  VaultDto,
  VaultKeyDto,
  VaultService,
} from '../../../../projects/api/src/lib';
import {
  changePassphrase,
  createVault,
  decryptValues,
  encryptValues,
  generateTableKey,
  rowContext,
  StoredVault,
  unlockVault,
  unwrapTableKey,
  wrapTableKey,
} from '../../shared/crypto/vault-crypto';
import { Auth } from './auth';

/** none: noch kein Tresor; locked: eingerichtet, aber Passphrase nicht eingegeben. */
export type VaultStatus = 'unknown' | 'none' | 'locked' | 'unlocked';

/** Eintrag mit Klartext-Werten, wie ihn die Tabellenseite hält. */
export interface PlainRow {
  id: string;
  values: Record<string, unknown>;
}

/** Tresor, für den ein Tabellenschlüssel verschlüsselt werden soll. */
export interface KeyRecipient {
  vaultId: string;
  publicKey: string;
}

/**
 * Tresor des angemeldeten Benutzers. Der entsperrte private Schlüssel und die Tabellenschlüssel
 * liegen nur im Arbeitsspeicher (nicht exportierbar bzw. nicht gespeichert); nach Neuladen der
 * Seite oder Abmelden muss der Tresor wieder entsperrt werden.
 */
@Injectable({ providedIn: 'root' })
export class Vault {
  private readonly vaultController = inject(VaultService);
  private readonly accessController = inject(CustomTableAccessService);
  private readonly auth = inject(Auth);

  private readonly stored = signal<VaultDto | null>(null);
  private privateKey: CryptoKey | null = null;
  private readonly tableKeys = new Map<string, Promise<CryptoKey>>();
  private loading: Promise<VaultStatus> | null = null;

  public readonly status = signal<VaultStatus>('unknown');
  public readonly vaultId = computed(() => this.stored()?.id ?? null);
  public readonly publicKey = computed(() => this.stored()?.publicKey ?? null);

  constructor() {
    // Anderer Benutzer oder abgemeldet: nichts vom vorherigen Tresor behalten.
    let previousUser: string | undefined;
    effect(() => {
      const user = this.auth.userId();
      if (previousUser !== undefined && previousUser !== user) this.forget();
      previousUser = user;
    });
  }

  /** Lädt den Tresor einmalig vom Server. */
  public load(): Promise<VaultStatus> {
    if (this.status() !== 'unknown') return Promise.resolve(this.status());
    this.loading ??= lastValueFrom(this.vaultController.apiVaultGet())
      .then((vault) => {
        this.stored.set(vault);
        this.status.set('locked');
        return 'locked' as const;
      })
      .catch((error) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.status.set('none');
          return 'none' as const;
        }
        throw error;
      })
      .finally(() => (this.loading = null));
    return this.loading;
  }

  public async setup(passphrase: string) {
    const { stored, privateKey } = await createVault(passphrase);
    await this.save(stored);
    this.privateKey = privateKey;
    this.status.set('unlocked');
  }

  /** @throws WrongPassphraseError */
  public async unlock(passphrase: string) {
    const stored = this.stored();
    if (!stored) throw new Error('Kein Tresor eingerichtet.');
    this.privateKey = await unlockVault(stored, passphrase);
    this.status.set('unlocked');
  }

  public lock() {
    this.privateKey = null;
    this.tableKeys.clear();
    if (this.stored()) this.status.set('locked');
  }

  /** @throws WrongPassphraseError */
  public async changePassphrase(oldPassphrase: string, newPassphrase: string) {
    const stored = this.stored();
    if (!stored) throw new Error('Kein Tresor eingerichtet.');
    await this.save(await changePassphrase(stored, oldPassphrase, newPassphrase));
  }

  /**
   * Neues Schlüsselpaar, z. B. bei vergessener Passphrase. Alle Freigaben gehen verloren und
   * müssen von anderen Mitgliedern (oder per Wiederherstellungsschlüssel) neu erteilt werden.
   */
  public async reset(passphrase: string) {
    this.tableKeys.clear();
    await this.setup(passphrase);
  }

  // ── Tabellen ───────────────────────────────────────────────────────────────

  /** Schlüssel einer vertraulichen Tabelle; nur entsperrt und mit Freigabe. */
  public tableKey(table: CustomTableDto): Promise<CryptoKey> {
    const privateKey = this.privateKey;
    if (!privateKey) return Promise.reject(new Error('Der Tresor ist gesperrt.'));
    if (!table.wrappedKey) return Promise.reject(new Error('Kein Zugriff auf diese Tabelle.'));

    const cacheKey = `${table.id}:${table.keyVersion}`;
    let key = this.tableKeys.get(cacheKey);
    if (!key) {
      key = unwrapTableKey(table.wrappedKey, privateKey);
      key.catch(() => this.tableKeys.delete(cacheKey));
      this.tableKeys.set(cacheKey, key);
    }
    return key;
  }

  public async encryptRow(table: CustomTableDto, values: Record<string, unknown>) {
    return encryptValues(
      values,
      await this.tableKey(table),
      rowContext(table.id, table.keyVersion),
    );
  }

  /** @throws DecryptionError */
  public async decryptRow(table: CustomTableDto, encrypted: string) {
    return decryptValues(
      encrypted,
      await this.tableKey(table),
      rowContext(table.id, table.keyVersion),
    );
  }

  /**
   * Ergänzt den Schlüssel für den Wiederherstellungs-Tresor, falls er fehlt (z. B. weil der
   * Wiederherstellungsschlüssel nach dem Verschlüsseln der Tabelle eingerichtet wurde).
   */
  public async ensureRecoveryKey(table: CustomTableDto) {
    if (!table.recoveryKeyMissing || !table.wrappedKey || !this.privateKey) return;
    const recovery = await lastValueFrom(this.vaultController.apiVaultRecoveryGet());
    await lastValueFrom(
      this.accessController.apiCustomTablesIdRecoveryKeyPost({
        id: table.id,
        addRecoveryKeyRequest: {
          wrappedKey: await wrapTableKey(await this.tableKey(table), recovery.publicKey),
          keyVersion: table.keyVersion,
        },
      }),
    );
  }

  /** Macht eine Tabelle vertraulich: neuer Schlüssel für sich selbst und den Wiederherstellungs-Tresor. */
  public async makeConfidential(tableId: string, rows: PlainRow[]) {
    const tableKey = await generateTableKey();
    const keys = await this.wrapFor(tableKey, await this.defaultRecipients());
    const context = rowContext(tableId, 1);
    await lastValueFrom(
      this.accessController.apiCustomTablesIdConfidentialPost({
        id: tableId,
        encryptTableRequest: {
          keys,
          rows: await Promise.all(
            rows.map(async (r) => ({
              id: r.id,
              encryptedValues: await encryptValues(r.values, tableKey, context),
            })),
          ),
        },
      }),
    );
  }

  /**
   * Neuer Tabellenschlüssel nur für <paramref name="recipients"/> (plus sich selbst und den
   * Wiederherstellungs-Tresor); alle Einträge werden neu verschlüsselt.
   */
  public async rotateKey(table: CustomTableDto, rows: PlainRow[], recipients: KeyRecipient[]) {
    const tableKey = await generateTableKey();
    const all = new Map<string, KeyRecipient>();
    for (const r of [...(await this.defaultRecipients()), ...recipients]) all.set(r.vaultId, r);

    const context = rowContext(table.id, table.keyVersion + 1);
    await lastValueFrom(
      this.accessController.apiCustomTablesIdRotateKeyPost({
        id: table.id,
        rotateTableKeyRequest: {
          baseKeyVersion: table.keyVersion,
          keys: await this.wrapFor(tableKey, [...all.values()]),
          rows: await Promise.all(
            rows.map(async (r) => ({
              id: r.id,
              encryptedValues: await encryptValues(r.values, tableKey, context),
            })),
          ),
        },
      }),
    );
  }

  /** Gibt einem anderen Tresor Zugriff auf eine Tabelle. */
  public async grant(table: CustomTableDto, userId: string, publicKey: string) {
    await lastValueFrom(
      this.accessController.apiCustomTablesIdAccessPost({
        id: table.id,
        grantTableAccessRequest: {
          userId,
          wrappedKey: await wrapTableKey(await this.tableKey(table), publicKey),
          keyVersion: table.keyVersion,
        },
      }),
    );
  }

  /** Eigener Tresor und, falls eingerichtet, der Wiederherstellungs-Tresor. */
  private async defaultRecipients(): Promise<KeyRecipient[]> {
    const own = this.stored();
    if (!own || !this.privateKey) throw new Error('Der Tresor ist gesperrt.');

    const recipients: KeyRecipient[] = [{ vaultId: own.id, publicKey: own.publicKey }];
    try {
      const recovery = await lastValueFrom(this.vaultController.apiVaultRecoveryGet());
      recipients.push({ vaultId: recovery.id, publicKey: recovery.publicKey });
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.status === 404)) throw error;
    }
    return recipients;
  }

  private async wrapFor(tableKey: CryptoKey, recipients: KeyRecipient[]): Promise<VaultKeyDto[]> {
    return Promise.all(
      recipients.map(async (r) => ({
        vaultId: r.vaultId,
        wrappedKey: await wrapTableKey(tableKey, r.publicKey),
      })),
    );
  }

  private async save(stored: StoredVault) {
    this.stored.set(
      await lastValueFrom(this.vaultController.apiVaultPut({ saveVaultRequest: stored })),
    );
  }

  private forget() {
    this.privateKey = null;
    this.tableKeys.clear();
    this.stored.set(null);
    this.status.set('unknown');
    this.loading = null;
  }
}
