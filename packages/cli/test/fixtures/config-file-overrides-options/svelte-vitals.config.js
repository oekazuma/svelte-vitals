/** A rule-id key in overrides may carry options (severity is optional). */
export default {
  overrides: [{ files: 'src/lib/**', rules: { 'architecture/prop-count': { options: { max: 4 } } } }]
};
