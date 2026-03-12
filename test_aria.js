const fs = require('fs');

const file = 'researchquest/src/components/notes/NotesView.tsx';
const content = fs.readFileSync(file, 'utf8');

if (content.includes('aria-label="Export notes"')) {
    console.log("Already has aria-label");
} else {
    console.log("Needs aria-label");
}
