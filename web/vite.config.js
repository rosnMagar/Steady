import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: {
        // Proxy real API calls to FastAPI in dev; until the server exists, the app uses mocks.
        proxy: {
            "/api": "http://localhost:8000",
            "/ingest": "http://localhost:8000",
        },
    },
});
