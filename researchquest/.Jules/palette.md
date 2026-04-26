## 2024-05-24 - Multi-line JSX Attribute Validation
**Learning:** Automated scripts checking for missing accessibility attributes (like `aria-label` or `htmlFor`) in React components often fail to identify attributes if they span multiple lines, leading to false positives.
**Action:** Always enable multi-line matching (e.g., `re.DOTALL` in Python) when parsing TSX/JSX to accurately identify existing attributes before making DOM changes.
