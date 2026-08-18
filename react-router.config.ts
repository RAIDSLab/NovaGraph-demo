import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src/app",
  ssr: false,
  future: {
    unstable_optimizeDeps: true,
  },
} satisfies Config;
