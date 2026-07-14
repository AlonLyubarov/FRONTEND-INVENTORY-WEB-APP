import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PersonalTaskService } from '../../core/personal-task.service';
import { ToastService } from '../../core/toast.service';
import { extractErrorMessage } from '../../core/error-message.util';
import { PersonalTaskDto } from '../../core/models';

/** Personal to-do list — private per user. */
@Component({
  selector: 'app-tasks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './tasks.component.html'
})
export class TasksComponent {
  private readonly taskService = inject(PersonalTaskService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly tasks = signal<PersonalTaskDto[] | null>(null);
  protected readonly pending = signal(false);
  protected readonly serverError = signal<string | null>(null);
  /** IDs currently being toggled/deleted, to disable their row controls. */
  protected readonly busyIds = signal<ReadonlySet<number>>(new Set());

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    notes: ['', Validators.maxLength(1000)],
    dueDate: ['']
  });

  protected readonly openTasks = computed(() => (this.tasks() ?? []).filter((t) => !t.isCompleted));
  protected readonly doneTasks = computed(() => (this.tasks() ?? []).filter((t) => t.isCompleted));
  protected readonly openCount = computed(() => this.openTasks().length);

  private readonly todayIso = new Date().toISOString().slice(0, 10);

  constructor() {
    this.load();
  }

  /** A due date strictly before today, on an open task, is overdue. */
  protected isOverdue(task: PersonalTaskDto): boolean {
    return !task.isCompleted && task.dueDate !== null && task.dueDate.slice(0, 10) < this.todayIso;
  }

  protected isBusy(id: number): boolean {
    return this.busyIds().has(id);
  }

  private load(): void {
    this.taskService.getAll().subscribe({
      next: (tasks) => this.tasks.set(tasks),
      error: (err) => {
        this.tasks.set([]);
        this.toast.error(extractErrorMessage(err));
      }
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.serverError.set(null);

    const { title, notes, dueDate } = this.form.getRawValue();
    this.taskService
      .create({
        title: title.trim(),
        notes: notes.trim() || undefined,
        dueDate: dueDate || undefined
      })
      .subscribe({
        next: (created) => {
          this.tasks.update((list) => [created, ...(list ?? [])]);
          this.form.reset({ title: '', notes: '', dueDate: '' });
          this.pending.set(false);
          this.toast.success('Task added.');
        },
        error: (err) => {
          this.pending.set(false);
          this.serverError.set(extractErrorMessage(err));
        }
      });
  }

  protected toggle(task: PersonalTaskDto): void {
    this.setBusy(task.id, true);
    this.taskService
      .update(task.id, {
        title: task.title,
        notes: task.notes ?? undefined,
        isCompleted: !task.isCompleted,
        dueDate: task.dueDate
      })
      .subscribe({
        next: (updated) => {
          this.tasks.update((list) => (list ?? []).map((t) => (t.id === updated.id ? updated : t)));
          this.setBusy(task.id, false);
        },
        error: (err) => {
          this.setBusy(task.id, false);
          this.toast.error(extractErrorMessage(err));
        }
      });
  }

  protected deleteTask(task: PersonalTaskDto): void {
    this.setBusy(task.id, true);
    this.taskService.delete(task.id).subscribe({
      next: () => {
        this.tasks.update((list) => (list ?? []).filter((t) => t.id !== task.id));
        this.toast.success('Task deleted.');
      },
      error: (err) => {
        this.setBusy(task.id, false);
        this.toast.error(extractErrorMessage(err));
      }
    });
  }

  private setBusy(id: number, busy: boolean): void {
    this.busyIds.update((set) => {
      const next = new Set(set);
      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }
}
