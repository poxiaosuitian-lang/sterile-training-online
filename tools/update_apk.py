#!/usr/bin/env python3
"""Download a published APK from GitHub and announce it after verification."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.request import Request, urlopen

REPOSITORY = 'poxiaosuitian-lang/sterile-training-online'


def fetch(url):
    return urlopen(Request(url, headers={'User-Agent': 'sterile-training-updater'}), timeout=120)


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path,
                        default=Path(__file__).resolve().parent.parent / 'deploy/releases')
    args = parser.parse_args()
    # Public release downloads do not consume the anonymous GitHub API quota.
    with fetch(f'https://github.com/{REPOSITORY}/releases/latest/download/latest.json') as response:
        manifest = json.load(response)
    filename = manifest.get('fileName', '')
    version = manifest.get('versionCode')
    if (type(version) is not int or version < 1 or
            not re.fullmatch(r'sterile-online-[0-9]+\.apk', filename) or
            filename != f'sterile-online-{version}.apk' or
            not isinstance(manifest.get('versionName'), str) or
            not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', manifest['versionName']) or
            not isinstance(manifest.get('notes'), str)):
        raise ValueError('Invalid release manifest')
    # Pin every remaining download to this version even if a new release lands.
    asset_base = f"https://github.com/{REPOSITORY}/releases/download/v{manifest['versionName']}/"
    with fetch(asset_base + 'SHA256SUMS') as response:
        checksums = dict((line.split()[1], line.split()[0])
                         for line in response.read().decode('utf-8').splitlines() if line.strip())
    expected = checksums[filename]
    if not re.fullmatch(r'[a-fA-F0-9]{64}', expected):
        raise ValueError('Invalid APK checksum')
    directory = args.directory.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    current = directory / 'latest.json'
    if current.exists():
        previous = json.loads(current.read_text(encoding='utf-8-sig'))
        if previous.get('versionCode', 0) > version:
            raise ValueError('Refusing to replace a newer server release')
    apk = directory / filename
    if not apk.exists() or digest(apk) != expected.lower():
        handle, temporary = tempfile.mkstemp(prefix=filename + '.', suffix='.part', dir=directory)
        try:
            with os.fdopen(handle, 'wb') as output, fetch(asset_base + filename) as response:
                for chunk in iter(lambda: response.read(1024 * 1024), b''):
                    output.write(chunk)
            if digest(Path(temporary)) != expected.lower():
                raise ValueError('APK checksum mismatch; current release is unchanged')
            os.chmod(temporary, 0o644)
            os.replace(temporary, apk)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    handle, temporary = tempfile.mkstemp(prefix='latest.', suffix='.json.tmp', dir=directory)
    try:
        with os.fdopen(handle, 'w', encoding='utf-8') as output:
            json.dump(manifest, output, ensure_ascii=False, indent=2)
            output.write('\n')
        os.chmod(temporary, 0o644)
        os.replace(temporary, current)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(f"Published {manifest['versionName']} (versionCode {version}) to {directory}")
    print('APK SHA-256 verified. No container restart is required.')


if __name__ == '__main__':
    main()
