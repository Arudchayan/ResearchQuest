import re

filepath = "researchquest/src/components/ideas/IdeasOverview.tsx"

with open(filepath, "r") as f:
    content = f.read()

# Fix Title
content = re.sub(
    r'<label className="block text-sm font-semibold text-text-secondary mb-1">\s*Idea title\s*</label>\s*<input',
    r'<label htmlFor="idea-title" className="block text-sm font-semibold text-text-secondary mb-1">\n                Idea title\n              </label>\n              <input\n                id="idea-title"',
    content
)

# Fix Description
content = re.sub(
    r'<label className="block text-sm font-semibold text-text-secondary mb-1">\s*Description\s*</label>\s*<textarea',
    r'<label htmlFor="idea-description" className="block text-sm font-semibold text-text-secondary mb-1">\n                Description\n              </label>\n              <textarea\n                id="idea-description"',
    content
)

# Fix Stage
content = re.sub(
    r'<label className="text-sm font-semibold text-text-secondary">\s*Stage\s*</label>\s*<select',
    r'<label htmlFor="idea-stage" className="text-sm font-semibold text-text-secondary">\n                  Stage\n                </label>\n                <select\n                  id="idea-stage"',
    content
)

with open(filepath, "w") as f:
    f.write(content)
