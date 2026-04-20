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

            # Simple check for icon-only buttons (no text inside button except maybe inside an icon tag)
            buttons = re.finditer(r'(<button[^>]*>)(.*?)(</button>)', content, re.DOTALL)
            for match in buttons:
                start_tag = match.group(1)
                inner = match.group(2)

                # Check if inner content has visible text
                inner_text = re.sub(r'<[^>]+>', '', inner).strip()

                # Filter out standard text content
                if not inner_text or inner_text == '{}' or (inner_text.startswith('{') and inner_text.endswith('}')):
                    # check if aria-label is missing in start_tag
                    if 'aria-label' not in start_tag and 'title=' not in start_tag:
                        print(f"File: {filepath}")
                        print(f"Tag: {start_tag}")
                        print(f"Content: {inner.strip()}")
                        print("-" * 40)

if __name__ == '__main__':
    main()
