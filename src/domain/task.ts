export type TaskStatus = 'resolving' | 'downloading' | 'paused' | 'merging' | 'saving' | 'completed' | 'failed' | 'cancelled';
export type Task = {
  id: string; mediaId: string; title: string; filename: string; quality: string;
  status: TaskStatus; progress: number; failOnce: boolean; phaseTicks: number;
  protocol: 'HLS' | 'MP4' | 'DASH'; error?: string;
};
export type TaskEvent = { type: 'tick' } | { type: 'pause' | 'resume' | 'retry' | 'cancel' };
export function filenameFor(title: string, quality: string): string {
  const clean = title.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 100) || 'video';
  return `${clean}_${quality}.mp4`;
}
export function transitionTask(task: Task, event: TaskEvent): Task {
  if (event.type === 'cancel') {
    return ['completed', 'cancelled'].includes(task.status) ? task : { ...task, status: 'cancelled' };
  }
  if (event.type === 'pause') return task.status === 'downloading' ? { ...task, status: 'paused' } : task;
  if (event.type === 'resume') return task.status === 'paused' ? { ...task, status: 'downloading' } : task;
  if (event.type === 'retry') return task.status === 'failed' ? { ...task, status: 'resolving', progress: 0, phaseTicks: 0, error: undefined, failOnce: false } : task;
  if (event.type !== 'tick') return task;
  if (task.status === 'resolving') return task.phaseTicks < 3 ? { ...task, phaseTicks: task.phaseTicks + 1 } : { ...task, status: 'downloading', phaseTicks: 0 };
  if (task.status === 'downloading') {
    if (task.failOnce && task.progress >= 27) return { ...task, status: 'failed', error: '视频链接已过期。重新获取链接后，可从头重试。' };
    const progress = Math.min(100, task.progress + 3);
    return { ...task, progress, status: progress === 100 ? (task.protocol === 'MP4' ? 'saving' : 'merging') : 'downloading', phaseTicks: 0 };
  }
  if (task.status === 'merging' || task.status === 'saving') {
    if (task.phaseTicks < 5) return { ...task, phaseTicks: task.phaseTicks + 1 };
    return { ...task, status: task.status === 'merging' ? 'saving' : 'completed', phaseTicks: 0 };
  }
  return task;
}
export const taskLabels: Record<TaskStatus, string> = {
  resolving: '准备下载', downloading: '下载中', paused: '已暂停', merging: '正在合并视频',
  saving: '正在保存文件', completed: '已完成', failed: '需要重试', cancelled: '已取消',
};
