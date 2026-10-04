import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Keep drizzle-kit away from PostGIS's own tables (e.g. spatial_ref_sys).
  extensionsFilters: ["postgis"],
});
