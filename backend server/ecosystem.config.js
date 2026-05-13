module.exports = {
  apps: [
    {
      name: 'klians-api',
      script: 'server.js',
      exec_mode: 'cluster',
      instances: 'max',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '300M',
      time: true,
    }
  ]
};
