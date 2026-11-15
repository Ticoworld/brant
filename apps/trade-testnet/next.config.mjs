export default {
  ...(process.env.R7_NEXT_DIST_DIR ? { distDir: process.env.R7_NEXT_DIST_DIR } : {}),
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  devIndicators: false,
};
