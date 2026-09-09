"""Real local-HTTP checks for the packaged, non-duplicated data layout."""
import functools
import hashlib
import http.server
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.request import urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('atlas_server', ROOT / 'scripts' / 'serve.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PackagedServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        Path(cls.temp.name, 'index.html').write_text('<h1>server contract</h1>')
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(
            module.Handler, directory=cls.temp.name, data_directory=ROOT / 'public' / 'data'))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join(); cls.temp.cleanup()

    def test_index_is_served(self):
        with urlopen(self.url + '/') as response:
            self.assertIn(b'server contract', response.read())
            self.assertEqual(response.headers.get('X-Content-Type-Options'), 'nosniff')

    def test_shared_dataset_manifest_works_without_portable_data_copy(self):
        with urlopen(self.url + '/data/manifest.json') as response:
            manifest = json.load(response)
        self.assertEqual(manifest['neurons'], 139255)
        self.assertEqual(manifest['synapses'], 50666648)

    def test_compressed_bytes_are_not_automatically_decoded(self):
        manifest = json.loads((ROOT / 'public/data/manifest.json').read_text())
        name = 'out/0000.bin.gz'
        with urlopen(self.url + '/data/' + name) as response:
            self.assertIsNone(response.headers.get('Content-Encoding'))
            payload = response.read()
        self.assertEqual(payload[:2], b'\x1f\x8b')
        self.assertEqual(hashlib.sha256(payload).hexdigest(), manifest['files'][name]['sha256'])

    def test_encoded_traversal_cannot_leave_data_root(self):
        with self.assertRaises(HTTPError) as context:
            urlopen(self.url + '/data/%2e%2e/README.md')
        self.assertEqual(context.exception.code, 404)

if __name__ == '__main__':
    unittest.main(verbosity=2)
