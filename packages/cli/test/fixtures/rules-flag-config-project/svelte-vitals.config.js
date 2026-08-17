/**
 * Fixture config declaring options for two rules (design: rules-flag-clobbers-config-options).
 * `architecture/component-size` lowers `max` well below any default-sized fixture component, and
 * `architecture/directory-naming` is inert without its `directories` declaration — both only
 * produce their findings when this file's `rules` map survives a `--rules`/`--ignore` run.
 */
export default {
  rules: {
    'architecture/component-size': { options: { max: 3 } },
    'architecture/directory-naming': { options: { directories: { 'src/lib/**': 'camelCase' } } }
  }
};
