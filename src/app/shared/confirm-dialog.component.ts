import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent],
  template: `
    <app-modal [title]="title()" (closed)="cancelled.emit()">
      <p class="confirm-message">{{ message() }}</p>
      @if (warning(); as warningText) {
        <p class="confirm-warning">⚠️ {{ warningText }}</p>
      }
      @if (error(); as errorText) {
        <p class="form-error" role="alert">{{ errorText }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="btn btn--ghost" (click)="cancelled.emit()">Cancel</button>
        <button type="button" class="btn btn--danger" [disabled]="pending()" (click)="confirmed.emit()">
          {{ pending() ? 'Working…' : confirmLabel() }}
        </button>
      </div>
    </app-modal>
  `
})
export class ConfirmDialogComponent {
  readonly title = input<string>('Please confirm');
  readonly message = input.required<string>();
  readonly warning = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly confirmLabel = input<string>('Delete');
  readonly pending = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
