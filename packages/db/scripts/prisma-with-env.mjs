import { config as loadEnv } from "dotenv";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const rootEnvPath = resolve(process.cwd(), "..", "..", ".env");
loadEnv({ path: rootEnvPath, override: true });

const [, , ...args] = process.argv;
const result = spawnSync("prisma", args, {
  stdio: "inherit",
  shell: true,
  env: process.env
});

process.exit(result.status ?? 1);