module.exports = {
  apps: [
    {
      name: 'samantha-api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
