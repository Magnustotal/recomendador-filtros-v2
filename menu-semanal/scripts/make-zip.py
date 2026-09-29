"""Empaqueta public/ en dist/menu-semanal-netlify.zip (index.html en la raíz) para Netlify Drop."""
import os, zipfile
root = os.path.join(os.path.dirname(__file__), '..')
src = os.path.join(root, 'public')
out = os.path.join(root, 'dist', 'menu-semanal-netlify.zip')
os.makedirs(os.path.dirname(out), exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, _, files in os.walk(src):
        for f in sorted(files):
            full = os.path.join(base, f)
            z.write(full, os.path.relpath(full, src))
print(out)
