const fs = require('fs');

const file = 'researchquest/src/components/papers/CitationDialog.tsx';
const content = fs.readFileSync(file, 'utf8');

if (content.includes('aria-label="Copy to clipboard"')) {
    console.log("Already has aria-label");
} else {
    console.log("Needs aria-label");
}
