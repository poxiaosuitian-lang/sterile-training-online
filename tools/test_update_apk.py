import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import update_apk


class UpdateApkTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.apk = b'test release bytes'
        self.manifest = {'versionCode': 87, 'versionName': '1.0.86',
                         'fileName': 'sterile-online-87.apk', 'notes': 'test'}
        base = f'https://github.com/{update_apk.REPOSITORY}/releases/'
        self.apk_url = base + 'download/v1.0.86/sterile-online-87.apk'
        self.urls = {
            base + 'latest/download/latest.json': json.dumps(self.manifest).encode(),
            self.apk_url: self.apk,
            base + 'download/v1.0.86/SHA256SUMS':
                (hashlib.sha256(self.apk).hexdigest() + '  sterile-online-87.apk\n').encode(),
        }

    def run_update(self):
        def fetch(url):
            self.assertNotIn('api.github.com', url)
            if url == self.apk_url:
                # The old announcement must remain available while downloading.
                self.assertEqual(json.loads((self.directory / 'latest.json').read_text())['versionCode'], 86)
            return io.BytesIO(self.urls[url])
        with patch('sys.argv', ['update_apk', '--directory', str(self.directory)]), \
                patch.object(update_apk, 'fetch', side_effect=fetch) as request:
            update_apk.main()
        return [call.args[0] for call in request.call_args_list]

    def test_publish_verified_apk_then_manifest_and_reuse_on_repeat(self):
        (self.directory / 'latest.json').write_text('{"versionCode":86}')
        self.run_update()
        self.assertEqual((self.directory / self.manifest['fileName']).read_bytes(), self.apk)
        self.assertEqual(json.loads((self.directory / 'latest.json').read_text()), self.manifest)
        self.assertNotIn(self.apk_url, self.run_update())

    def test_bad_checksum_keeps_previous_release(self):
        (self.directory / 'latest.json').write_text('{"versionCode":86}')
        self.urls[self.apk_url] = b'corrupt download'
        with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
            self.run_update()
        self.assertEqual((self.directory / 'latest.json').read_text(), '{"versionCode":86}')
        self.assertEqual([p.name for p in self.directory.iterdir()], ['latest.json'])

    def test_refuse_downgrade(self):
        (self.directory / 'latest.json').write_text('{"versionCode":88}')
        with self.assertRaisesRegex(ValueError, 'newer server release'):
            self.run_update()
        self.assertEqual((self.directory / 'latest.json').read_text(), '{"versionCode":88}')


if __name__ == '__main__':
    unittest.main()
