/**
 * Fixture for the doubly-silent half of rules-flag-clobbers-config-options: this file declares
 * `architecture/reserved-name-placement` with a glob that matches no directory in `src/`, so the
 * rule emits its aggregated "this declaration does not check what it says" project-scoped
 * diagnostic. A discarded options map would silence that diagnostic along with everything else,
 * making a dead glob and a fully compliant tree produce identical (empty) output.
 */
export default {
  rules: {
    'architecture/reserved-name-placement': { options: { placements: { e2e: 'src/nowhere/**' } } }
  }
};
