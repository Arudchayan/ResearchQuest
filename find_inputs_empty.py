import os
import re

def main():
    directory = 'researchquest/src/components'
    for root, _, files in os.walk(directory):
        for file in files:
            if not file.endswith('.tsx'):
                continue
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()

            # Find inputs
            inputs = re.finditer(r'<input\b([^>]*)>', content)
            for match in inputs:
                start_tag = match.group(0)
                attrs = match.group(1)

                # Filter out ones we know are fine or hidden
                if 'type="hidden"' in attrs or 'type="file"' in attrs or 'type="checkbox"' in attrs or 'aria-label=' in attrs:
                    continue

                id_match = re.search(r'id=["\']([^"\']+)["\']', attrs)
                if id_match:
                    input_id = id_match.group(1)
                    if f'htmlFor="{input_id}"' not in content and f"htmlFor='{input_id}'" not in content:
                        print(f"File: {filepath}")
                        print(f"Input without label: {start_tag}")
                        print("-" * 40)
                else:
                    print(f"File: {filepath}")
                    print(f"Input without ID/aria-label: {start_tag}")
                    print("-" * 40)

if __name__ == '__main__':
    main()
