export const SIZES = ['small', 'medium', 'large'];

export const sizeLabels: Record<string, string> = {};
for (const size of SIZES) sizeLabels[size] = size[0].toUpperCase() + size.slice(1);
