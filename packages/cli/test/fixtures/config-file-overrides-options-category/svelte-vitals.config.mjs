/** Options are rule-specific and meaningless on a category key ('architecture'). */
export default {
  overrides: [{ files: 'src/**', rules: { architecture: { options: { max: 3 } } } }]
};
