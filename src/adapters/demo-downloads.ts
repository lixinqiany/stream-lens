import type { DownloadPort } from '../application/ports';
import type { Media, Scene } from '../domain/media';
import { filenameFor, transitionTask, type Task, type TaskEvent } from '../domain/task';

/** Presentation-only adapter. Never requests media, downloads files, or calls Chrome APIs. */
export class DemoDownloads implements DownloadPort {
  private tasks: Task[] = [];
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  getSnapshot = () => this.tasks;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private emit() { for (const listener of this.listeners) listener(); }
  private ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const next = this.tasks.map(t => transitionTask(t, { type: 'tick' }));
      if (next.some((t, i) => t !== this.tasks[i])) { this.tasks = next; this.emit(); }
      if (!this.tasks.some(t => ['resolving', 'downloading', 'merging', 'saving'].includes(t.status))) {
        clearInterval(this.timer); this.timer = undefined;
      }
    }, 300);
  }
  start(media: Media, qualityId: string, scene: Scene, name?: string) {
    const existing = this.tasks.find(t => t.mediaId === media.id && t.quality === qualityId + 'p' && !['failed', 'cancelled', 'completed'].includes(t.status));
    if (existing) return { id: existing.id, duplicate: true };
    if (!media.supported || !media.qualities.some(q => q.id === qualityId)) throw new Error('该视频或清晰度暂不支持下载');
    const task: Task = {
      id: crypto.randomUUID(), mediaId: media.id, title: media.title,
      filename: filenameFor(name?.trim() || media.title, qualityId + 'p'), quality: qualityId + 'p',
      status: 'resolving', progress: 0, failOnce: scene === 'expired', phaseTicks: 0, protocol: media.protocol,
    };
    this.tasks = [task, ...this.tasks]; this.emit(); this.ensureTimer();
    return { id: task.id, duplicate: false };
  }
  dispatch(id: string, event: TaskEvent) {
    this.tasks = this.tasks.map(t => t.id === id ? transitionTask(t, event) : t);
    this.emit(); this.ensureTimer();
  }
  clearFinished() {
    this.tasks = this.tasks.filter(t => !['completed', 'cancelled'].includes(t.status)); this.emit();
  }
}
