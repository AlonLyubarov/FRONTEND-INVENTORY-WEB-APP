import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReminderService } from '../../core/reminder.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';
import { ReminderDto } from '../../core/models';

interface CalendarCell {
  /** YYYY-MM-DD key for the cell's day. */
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Personal reminders on a month-grid calendar. */
@Component({
  selector: 'app-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './calendar.component.html'
})
export class CalendarComponent {
  private readonly reminderService = inject(ReminderService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  private readonly today = toIso(new Date());
  protected readonly viewYear = signal(new Date().getFullYear());
  protected readonly viewMonth = signal(new Date().getMonth());
  protected readonly selectedDate = signal<string>(toIso(new Date()));

  protected readonly reminders = signal<ReminderDto[] | null>(null);
  protected readonly pending = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    notes: ['', Validators.maxLength(500)]
  });

  protected readonly monthLabel = computed(() =>
    new Date(this.viewYear(), this.viewMonth(), 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    })
  );

  /** Reminders grouped by day key (YYYY-MM-DD). */
  private readonly byDay = computed(() => {
    const map = new Map<string, ReminderDto[]>();
    for (const reminder of this.reminders() ?? []) {
      const key = reminder.date.slice(0, 10);
      const list = map.get(key);
      if (list) {
        list.push(reminder);
      } else {
        map.set(key, [reminder]);
      }
    }
    return map;
  });

  /** 6 weeks × 7 days covering the viewed month, starting on Sunday. */
  protected readonly cells = computed<CalendarCell[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const firstOffset = new Date(year, month, 1).getDay();
    const cells: CalendarCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(year, month, 1 - firstOffset + i);
      const iso = toIso(date);
      cells.push({
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === month,
        isToday: iso === this.today
      });
    }
    return cells;
  });

  protected readonly selectedReminders = computed(
    () => this.byDay().get(this.selectedDate()) ?? []
  );

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.reminderService.getAll().subscribe({
      next: (reminders) => this.reminders.set(reminders),
      error: () => this.reminders.set([])
    });
  }

  dayReminders(iso: string): ReminderDto[] {
    return this.byDay().get(iso) ?? [];
  }

  selectDay(iso: string): void {
    this.selectedDate.set(iso);
    this.serverError.set(null);
  }

  prevMonth(): void {
    const month = this.viewMonth() - 1;
    if (month < 0) {
      this.viewMonth.set(11);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.set(month);
    }
  }

  nextMonth(): void {
    const month = this.viewMonth() + 1;
    if (month > 11) {
      this.viewMonth.set(0);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.set(month);
    }
  }

  goToday(): void {
    const now = new Date();
    this.viewYear.set(now.getFullYear());
    this.viewMonth.set(now.getMonth());
    this.selectedDate.set(this.today);
  }

  onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.pending.set(true);
    this.serverError.set(null);

    this.reminderService
      .create({
        date: this.selectedDate(),
        title: value.title.trim(),
        notes: value.notes.trim() || undefined
      })
      .subscribe({
        next: () => {
          this.pending.set(false);
          this.form.reset({ title: '', notes: '' });
          this.toast.success('Reminder added.');
          this.reload();
        },
        error: (err: unknown) => {
          this.pending.set(false);
          this.serverError.set(extractErrorMessage(err));
        }
      });
  }

  deleteReminder(reminder: ReminderDto): void {
    this.reminderService.delete(reminder.id).subscribe({
      next: () => {
        this.toast.success('Reminder deleted.');
        this.reload();
      },
      error: (err: unknown) => this.toast.error(extractErrorMessage(err))
    });
  }
}
