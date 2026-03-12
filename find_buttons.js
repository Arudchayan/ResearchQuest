const fs = require('fs');
const glob = require('glob'); // Note: we might not have glob, I'll use simple fs recursive

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = require('path').join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('researchquest/src/components', (filePath) => {
  if (filePath.endsWith('.tsx')) {
    const content = fs.readFileSync(filePath, 'utf8');
    // Simple regex to find <button ...> ... </button>
    const matches = content.match(/<button[^>]*>[\s\S]*?<\/button>/g);
    if (matches) {
      matches.forEach(match => {
        // If it doesn't contain aria-label
        if (!match.includes('aria-label') && !match.match(/>[^<]*[a-zA-Z]+[^<]*<\/button>/)) {
          // Check if it has a string child (meaning not icon-only)
          console.log(`Found in ${filePath}:\n${match}\n`);
        }
      });
    }
  }
});
