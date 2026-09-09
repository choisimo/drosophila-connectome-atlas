#!/usr/bin/env python3
"""Serve the prepared frontend on localhost without third-party dependencies."""
from __future__ import annotations
import argparse
import functools
import http.server
import pathlib
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.mjs': 'text/javascript', '.js': 'text/javascript',
        '.gz': 'application/octet-stream', '.json': 'application/json',
    }

    def __init__(self, *args, data_directory=None, **kwargs):
        self.data_directory = pathlib.Path(data_directory).resolve() if data_directory else None
        super().__init__(*args, **kwargs)

    def translate_path(self, path):
        """Packaged portable files share public/data rather than duplicate 65 MB.

        A complete portable build or dist always uses its own data directory.
        The fallback is restricted to descendants of the known dataset root.
        """
        request = urllib.parse.unquote(urllib.parse.urlsplit(path).path)
        local_data = pathlib.Path(self.directory) / 'data'
        if (self.data_directory and not local_data.is_dir()
                and request.startswith('/data/')):
            target = (self.data_directory / request[len('/data/'):]).resolve()
            if not target.is_relative_to(self.data_directory):
                return str(self.data_directory / '__invalid_request__')
            return str(target)
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        # Send raw gzip bytes. The worker verifies SHA-256 BEFORE decompression.
        # Content-Encoding: gzip would cause automatic browser decompression.
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=pathlib.Path, default=ROOT / 'portable')
    parser.add_argument('--port', type=int, default=4173)
    args = parser.parse_args()
    directory = args.directory.resolve()
    if not (directory / 'index.html').is_file():
        sys.exit(f'No index.html in {directory}. Build the frontend first.')
    fallback = ROOT / 'public' / 'data' if directory == ROOT / 'portable' else None
    if not (directory / 'data' / 'manifest.json').is_file() and not (fallback and (fallback / 'manifest.json').is_file()):
        sys.exit('Dataset missing. Run: python3 scripts/prepare_data.py --input source-data --output public/data')
    try:
        server = http.server.ThreadingHTTPServer(
            ('127.0.0.1', args.port),
            functools.partial(Handler, directory=str(directory), data_directory=fallback),
        )
    except OSError as error:
        sys.exit(f'Could not bind port {args.port}: {error}. Choose another --port.')
    print(f'Neuro Atlas: http://127.0.0.1:{args.port}', flush=True)
    if directory == ROOT / 'portable':
        print('Portable mode needs access to the pinned Three.js CDN. Ctrl+C stops the server.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
