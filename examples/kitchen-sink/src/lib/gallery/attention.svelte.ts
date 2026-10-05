import { browser } from '$app/environment';

export function syncTitle(unread: number) {
  if (!browser) return;
  document.title = unread > 0 ? `(${unread}) SPA route titled from a module` : 'SPA route titled from a module';
}
