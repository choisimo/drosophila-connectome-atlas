# Portable runtime dependencies

The portable build includes unmodified production CommonJS payloads for React
18.2.0, React DOM 18.2.0 and the corresponding Scheduler, enclosed in small ESM
wrappers. They were recovered from the source maps distributed with the installed
Jupyter Notebook frontend. The upstream license headers are preserved.

React upstream: https://github.com/facebook/react/tree/v18.2.0
License: MIT, see LICENSE-REACT.txt.

Three.js r180 is **not** vendored in the portable build. It is loaded from the
version-pinned jsDelivr URLs in portable/index.html. The normal Vite build instead
bundles the installed npm dependency, with no runtime CDN request.
Three.js upstream: https://github.com/mrdoob/three.js/tree/r180 (MIT).

No font files are included.
