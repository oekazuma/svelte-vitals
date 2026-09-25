export const CATEGORIES = ['Tea', 'Coffee', 'Cocoa'];

export function createFilter() {
  let active = $state(CATEGORIES[0]);
  return {
    get active() {
      return active;
    },
    set active(value: string) {
      active = value;
    }
  };
}
