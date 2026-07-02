/**
 * PM2 生产启动配置
 *
 * 首次部署：
 *   corepack enable
 *   pnpm install --frozen-lockfile
 *   pnpm build
 *   pm2 start ecosystem.config.cjs
 *
 * 若 pnpm install 报 Invalid Version，升级 pnpm 并清理后重装：
 *   npm install -g pnpm@10.27.0
 *   rm -rf node_modules
 *   pnpm install --frozen-lockfile
 *
 * 更新后：
 *   pnpm build && pm2 reload ecosystem.config.cjs --update-env
 *
 * 常用：
 *   pm2 logs momoro-rules-web
 *   pm2 status
 *   pm2 stop momoro-rules-web
 */
module.exports = {
  apps: [
    {
      name: "momoro-rules-web",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      // 2GB 机器建议单实例；Pyodide 沙盒内存占用较高
      max_memory_restart: "1536M",
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // PM2 ≥ 5.3 自动加载 .env；旧版本请先 export 环境变量或改用 dotenv-cli
      env_file: ".env",
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
