/** Fixture config declaring a directory casing convention (design 2026-07-29). */
export default {
  rules: {
    'architecture/directory-naming': {
      options: { directories: { 'src/lib/**': 'camelCase' } }
    }
  }
};
