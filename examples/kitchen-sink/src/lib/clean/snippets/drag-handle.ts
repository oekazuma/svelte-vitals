import type { Action } from 'svelte/action';

export const dragHandle: Action<HTMLElement> = (node) => {
  node.setAttribute('role', 'button');
  node.tabIndex = 0;
};
