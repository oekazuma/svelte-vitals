import * as drafts from '$lib/clean/real-world/drafts';
import notify from '$clean-real-world/notify';

const models = { drafts };
const helpers = { notify };

export const database = { ...models, ...helpers };
