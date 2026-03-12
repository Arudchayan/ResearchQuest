import os
import re

for root, dirs, files in os.walk("researchquest/src/components"):
    for file in files:
        if file.endswith(".tsx"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            buttons = re.findall(r'<button[^>]*>.*?</button>', content, re.DOTALL)
            for button in buttons:
                if 'aria-label' not in button and 'aria-labelledby' not in button:
                    # check if it only contains JSX tags (like icons) and no text
                    inner = re.search(r'<button[^>]*>(.*?)</button>', button, re.DOTALL).group(1)
                    # remove all JSX tags
                    text = re.sub(r'<[^>]+>', '', inner).strip()
                    # remove curly braces evaluating to vars
                    text = re.sub(r'\{[^}]+\}', '', text).strip()

                    if not text:
                        print(f"Possible missing aria-label in {path}:")
                        print(button)
                        print("-" * 40)
