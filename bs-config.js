module.exports = {
  open: false,
  server: {
    // This is a multi-page static site. Lite-server's SPA fallback rewrites
    // directory routes such as /resources/ to the root index page in browsers.
    middleware: {
      1: null,
    },
  },
};
