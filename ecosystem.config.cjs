module.exports = {
  apps: [
    {
      name: "heat-api",
      script: "apps/api/dist/index.js",
      cwd: "/var/www/heat/heat-modern",
      env_production: {
        NODE_ENV: "production",
        PORT: 8787,
      },
    },
  ],
};
