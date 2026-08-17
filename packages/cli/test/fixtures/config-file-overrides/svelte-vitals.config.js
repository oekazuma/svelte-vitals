/** Valid scoped overrides: category key, rule-id key, route and files globs. */
export default {
  overrides: [
    { files: 'src/routes/(app)/**', rules: { seo: 'off' } },
    { route: ['/admin', '/admin/**'], rules: { 'seo/title-presence': 'warning' } }
  ]
};
