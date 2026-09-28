import { writable } from 'svelte/store';

export const lastVisited = writable<string | null>(null);
