module.exports = {
  core: {
    version: '2.0.0',
    name: 'Smart Queue Core'
  },
  plugins: [
    {
      name: 'token-system',
      enabled: true,  
      path: './plugins/token-system',
      version: '1.0.0',
      dependencies: []
    },
    {
      name: 'reporting-module',
      enabled: false,
      path: './plugins/reporting',
      version: '0.0.1',
      dependencies: ['token-system']
    }
  ]
};