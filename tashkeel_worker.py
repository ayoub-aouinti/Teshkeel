#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Persistent mishkal worker.
Protocol: one JSON object per line on stdin → one JSON object per line on stdout.
  Input:  {"id": <int>, "text": "<arabic>"}
  Output: {"id": <int>, "result": "<vocalized>"} | {"id": <int>, "error": "<msg>"}
Signals ready with: {"ready": true}
"""
import io
import sys
import json

# Force UTF-8 on Windows where the default console encoding (cp850/cp1252) breaks Arabic
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)


def main():
    try:
        from mishkal.tashkeel import TashkeelClass  # type: ignore
        vocalizer = TashkeelClass()
    except ImportError as e:
        sys.stdout.write(json.dumps({'startup_error': str(e)}) + '\n')
        sys.stdout.flush()
        sys.exit(1)
    except Exception as e:
        sys.stdout.write(json.dumps({'startup_error': str(e)}) + '\n')
        sys.stdout.flush()
        sys.exit(1)

    # Signal that the worker is ready
    sys.stdout.write(json.dumps({'ready': True}) + '\n')
    sys.stdout.flush()

    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        req_id = None
        try:
            req = json.loads(raw)
            req_id = req.get('id')
            text = req.get('text', '')
            result = vocalizer.tashkeel(text)
            out = json.dumps({'id': req_id, 'result': result}, ensure_ascii=False)
        except Exception as e:
            out = json.dumps({'id': req_id, 'error': str(e)})

        sys.stdout.write(out + '\n')
        sys.stdout.flush()


if __name__ == '__main__':
    main()
