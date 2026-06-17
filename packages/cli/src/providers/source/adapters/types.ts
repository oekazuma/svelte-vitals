import type { ImportInfo } from '../imports.js';
import type { ComponentUse, ParsedTag } from '../parse.js';

export interface AdapterResult {
  /** Specific head tags this usage definitely sets. */
  tags: ParsedTag[];
  /** True when the component may set further unknown tags (e.g. spread props). */
  broad: boolean;
}

export interface Adapter {
  match(info: ImportInfo): boolean;
  resolve(use: ComponentUse): AdapterResult;
}
