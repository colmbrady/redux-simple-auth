module.exports = {
  presets: [['@babel/env', { modules: false }]],
  plugins: ['@babel/proposal-object-rest-spread'],
  env: {
    test: {
      presets: ['@babel/env']
    }
  }
}
