import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/recharts/")) return "charts";
          if (id.includes("/node_modules/leaflet/") || id.includes("/node_modules/react-leaflet/")) return "maps";
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/") || id.includes("/node_modules/scheduler/")) return "react-vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api/hrsa-sites": {
        target: "https://data.hrsa.gov",
        changeOrigin: true,
        rewrite: () => "/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv",
      },
    },
  },
});
