import { defineConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginSolid } from "@rsbuild/plugin-solid";

export default defineConfig({
  // pluginBabel cria a regra babel que o pluginSolid configura com babel-preset-solid
  plugins: [pluginBabel({ include: /\.(?:jsx|tsx)$/ }), pluginSolid()],
  server: {
    proxy: {
      "/v1": "http://localhost:3000",
    },
  },
});
