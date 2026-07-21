/** rules values must be 'off' or a severity. */
export default {
  overrides: [{ route: '/(app)/**', rules: { 'seo/title-presence': 'nope' } }]
};
