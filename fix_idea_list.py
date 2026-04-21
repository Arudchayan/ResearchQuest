import re

filepath = "researchquest/src/components/entities/IdeaList.tsx"

with open(filepath, "r") as f:
    content = f.read()

# Fix IdeaList
content = re.sub(
    r'<input\s+value=\{searchQuery\}',
    r'<input\n              id="idea-list-search"\n              value={searchQuery}',
    content
)

content = re.sub(
    r'<Search className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />\s*<input',
    r'<label htmlFor="idea-list-search" className="sr-only">Search ideas</label>\n            <Search className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />\n            <input',
    content
)

with open(filepath, "w") as f:
    f.write(content)
