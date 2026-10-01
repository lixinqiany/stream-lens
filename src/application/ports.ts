import type { Media, Scene } from '../domain/media';
import type { Task, TaskEvent } from '../domain/task';
export interface DownloadPort {
  getSnapshot(): Task[];
  subscribe(listener: () => void): () => void;
  start(media: Media, qualityId: string, scene: Scene, name?: string): { id: string; duplicate: boolean };
  dispatch(id: string, event: TaskEvent): void;
  clearFinished(): void;
}
