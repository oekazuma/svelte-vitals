/** Fixture config file for analyzeProject precedence-matrix and e2e tests. */
export default {
  failOn: 'warning',
  metaComponents: ['Seo'],
  treatDynamicAs: 'warn',
  rules: {
    SEO001: 'off'
  },
  weights: {
    seo: 2
  }
};
