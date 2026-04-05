import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@lottery/domain", "@lottery/application", "@lottery/infrastructure", "@lottery/lottery-handlers"],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"]
    };

    return config;
  }
};

export default nextConfig;
