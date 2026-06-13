#!/bin/sh
# Inject runtime SERVER_URL into env.js, loaded before the app bundle
echo "window.__HAE_SERVER_URL__=\"${SERVER_URL:-}\";" > /usr/share/nginx/html/env.js

# Patch index.html to load env.js (idempotent)
if ! grep -q 'env.js' /usr/share/nginx/html/index.html; then
  sed -i 's|<head>|<head><script src="/env.js"></script>|' /usr/share/nginx/html/index.html
fi

exec nginx -g 'daemon off;'
