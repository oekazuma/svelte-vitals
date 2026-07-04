export type WriteStatus = 'created' | 'added' | 'exists' | 'updated' | 'manual';

export interface CodemodResult {
  status: WriteStatus;
  /** New file content to write. Absent when status is 'manual' (nothing is written). */
  content?: string;
  /** Snippet to show the user when status is 'manual'. */
  snippet?: string;
}
