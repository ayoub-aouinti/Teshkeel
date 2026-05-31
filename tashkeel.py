#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reads Arabic text from stdin, returns JSON with the tashkeel-ified result.
Called by server.cjs via subprocess.

Install: pip install mishkal
"""
import sys
import json


def main():
    try:
        text = sys.stdin.buffer.read().decode('utf-8')
    except Exception as e:
        sys.stdout.write(json.dumps({'error': f'stdin read error: {e}'}))
        sys.exit(1)

    if not text.strip():
        sys.stdout.write(json.dumps({'result': ''}))
        return

    try:
        from mishkal.tashkeel import TashkeelClass  # type: ignore
        vocalizer = TashkeelClass()
        result = vocalizer.tashkeel(text)
        sys.stdout.buffer.write(
            json.dumps({'result': result}, ensure_ascii=False).encode('utf-8')
        )
    except ImportError:
        sys.stdout.write(
            json.dumps(
                {'error': 'mishkal not installed. Run: pip install mishkal'},
                ensure_ascii=False,
            )
        )
        sys.exit(1)
    except Exception as e:
        sys.stdout.write(json.dumps({'error': str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
