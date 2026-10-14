import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

/** Zeigt ein PDF (Blob) im eingebauten PDF-Viewer des Browsers oder eine Typst-Fehlermeldung. */
@Component({
  selector: 'app-pdf-preview',
  imports: [MatProgressSpinner],
  template: `
    <div class="pdf-preview">
      @if (error(); as message) {
        <pre class="preview-error">{{ message }}</pre>
      } @else if (url(); as src) {
        <iframe #frame [src]="src" title="PDF-Vorschau"></iframe>
      } @else {
        <div class="preview-empty text-hint small">{{ placeholder() }}</div>
      }
      @if (loading()) {
        <div class="preview-loading">
          <mat-progress-spinner mode="indeterminate" diameter="28" />
        </div>
      }
    </div>
  `,
  styles: `
    .pdf-preview {
      position: relative;
      height: 100%;
      min-height: 32rem;
      border: 1px solid var(--app-border);
      border-radius: 8px;
      background: var(--app-canvas);
      overflow: hidden;
    }
    iframe {
      width: 100%;
      height: 100%;
      min-height: 32rem;
      border: 0;
      display: block;
    }
    .preview-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 32rem;
      padding: 2rem;
      text-align: center;
    }
    .preview-error {
      margin: 0;
      padding: 1rem;
      height: 100%;
      font-size: 0.8rem;
      white-space: pre-wrap;
      color: var(--brand-negative);
    }
    .preview-loading {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
    }
  `,
})
export class PdfPreview implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private objectUrl: string | null = null;

  public readonly blob = input<Blob | null>(null);
  public readonly error = input<string | null>(null);
  public readonly loading = input(false);
  public readonly placeholder = input('Noch keine Vorschau.');

  protected readonly url = computed<SafeResourceUrl | null>(() => {
    const blob = this.blob();
    if (!blob) return null;
    // Blob-URL gehört uns. Ohne Miniatur-Leiste, Seite auf Breite eingepasst.
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      this.track(URL.createObjectURL(blob)) + '#navpanes=0&view=FitH',
    );
  });

  /** Öffnet den Druckdialog für das angezeigte PDF (sonst in neuem Tab). */
  public print() {
    const frame = this.frame()?.nativeElement;
    try {
      frame?.contentWindow?.focus();
      frame?.contentWindow?.print();
    } catch {
      if (this.objectUrl) window.open(this.objectUrl, '_blank');
    }
  }

  ngOnDestroy() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  private track(url: string): string {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = url;
    return url;
  }
}
