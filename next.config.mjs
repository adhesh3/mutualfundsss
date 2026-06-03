import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This project lives in a folder alongside others with their own lockfiles;
  // pin the tracing root so deploy bundles don't pull in sibling projects.
  outputFileTracingRoot: projectRoot,
  // Native/optional libSQL packages shouldn't be bundled by the server compiler.
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client"],
};

export default nextConfig;
