"""Empaqueta public/ en dist/menu-semanal-v<versión>.zip (index.html en la raíz) para Netlify Drop.
La versión sale de public/version.js."""
import glob, os, re, zipfile

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = os.path.join(root, 'public')
version = re.search(r"VERSION\s*=\s*'([^']+)'", open(os.path.join(src, 'version.js'), encoding='utf-8').read()).group(1)
dist = os.path.join(root, 'dist')
os.makedirs(dist, exist_ok=True)
for old in glob.glob(os.path.join(dist, '*.zip')):
    os.remove(old)  # un solo zip vigente, sin versiones antiguas que confundan
out = os.path.join(dist, f'menu-semanal-v{version}.zip')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, _, files in os.walk(src):
        for f in sorted(files):
            full = os.path.join(base, f)
            z.write(full, os.path.relpath(full, src))
print(out)
