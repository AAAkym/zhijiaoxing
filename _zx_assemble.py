import os, shutil

WORK = r'c:\Users\33552\.trae-cn\work\6a61d22acba77db697edb85b'
FINAL = r'c:\Users\33552\Desktop\project_code\zhijiaoxing-home-redesign\pages\index.html'

def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def strip_bom(s):
    return s[1:] if s.startswith('\ufeff') else s

backup = os.path.join(WORK, 'orig_backup.html')
shutil.copyfile(FINAL, backup)
print('backup ->', backup, os.path.getsize(backup), 'bytes')

orig = read(FINAL)
idx = orig.index('<main>')
head_part = orig[:idx]

p1 = strip_bom(read(os.path.join(WORK, 'new_body.html')))
p1 = p1.rstrip()

parts = ['part2a.html', 'part2b.html', 'part2c.html', 'part2d.html', 'part2e.html']
chunks = [p1]
for name in parts:
    chunks.append(strip_bom(read(os.path.join(WORK, name))))
body = ''.join(chunks)
final = head_part + body

print('HEAD_PART ends:', repr(head_part[-50:]))
print('P1 starts:', repr(p1[:18]))
print('P1 ends  :', repr(p1[-22:]))
p2a = strip_bom(read(os.path.join(WORK, 'part2a.html')))
print('P2a starts:', repr(p2a[:18]))
print('SPLICE   :', repr(p1[-9:] + p2a[:13]))
print('FINAL len:', len(final))
print('FINAL ends:', repr(final[-26:]))

with open(FINAL, 'w', encoding='utf-8', newline='') as f:
    f.write(final)
print('WRITTEN OK ->', os.path.getsize(FINAL), 'bytes')
