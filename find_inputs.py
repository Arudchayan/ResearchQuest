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

                # Check for id and htmlFor
                id_match = re.search(r'id=["\']([^"\']+)["\']', attrs)
                if id_match:
                    input_id = id_match.group(1)
                    # Check if there's a label with htmlFor=input_id
                    if f'htmlFor="{input_id}"' not in content and f"htmlFor='{input_id}'" not in content and 'aria-label=' not in attrs:
                        print(f"File: {filepath}")
                        print(f"Input without label: {start_tag}")
                        print("-" * 40)
                elif 'type="hidden"' not in attrs and 'aria-label=' not in attrs:
                     # no id, check for aria-label, if no aria-label, it's missing label completely unless wrapped in <label>
                     # simple check, print if no aria-label and no id
                     # Need to check if it's wrapped in <label>. Difficult with regex.
                     print(f"File: {filepath}")
                     print(f"Input without ID/aria-label: {start_tag}")
                     print("-" * 40)

if __name__ == '__main__':
    main()
