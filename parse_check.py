import json, re
from pathlib import Path
p = Path(r'c:\Users\ZOJKRAFF\OneDrive - Carl Zeiss AG\Dokumente\6. Semester\Kennzeichen\wiki.json')
text = json.loads(p.read_text(encoding='utf-8-sig'))['parse']['wikitext']
lines = text.splitlines()
for i, line in enumerate(lines):
    if "'''BL'''" in line or "'''AA'''" in line or "'''A'''" in line:
        start = max(0, i-2)
        end = min(len(lines), i+12)
        print('--- around index', i, '---')
        for j in range(start, end):
            print(lines[j])
        print('---')
