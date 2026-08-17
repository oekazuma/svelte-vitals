/** scopes is a list of globs, not a single string. */
export default {
  rules: {
    'architecture/private-scope-import': { options: { scopes: '**/parts' } }
  }
};
