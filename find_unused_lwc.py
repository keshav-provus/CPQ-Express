import os
import re

lwc_dir = '/Users/admin/work/CPQ-Express/force-app/main/default/lwc'
src_dir = '/Users/admin/work/CPQ-Express/force-app/main/default'

def camel_to_kebab(name):
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1-\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1-\2', s1).lower()

lwcs = [d for d in os.listdir(lwc_dir) if os.path.isdir(os.path.join(lwc_dir, d))]
unused = []

for lwc in lwcs:
    if lwc.startswith('.'): continue
    kebab_name = 'c-' + camel_to_kebab(lwc)
    camel_name = lwc
    
    # Check if used
    cmd = f"grep -rnw -e '{kebab_name}' -e '{camel_name}' {src_dir} --exclude-dir=lwc/{lwc}"
    res = os.popen(cmd).read()
    if not res.strip():
        unused.append(lwc)

print("Potentially unused LWCs:", unused)
