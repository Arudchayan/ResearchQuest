const fs = require('fs');
let content = fs.readFileSync('researchquest/src/components/entities/AddPaperModal.tsx', 'utf8');

if (!content.includes('useCallback')) {
  content = content.replace(/import \{([^}]*)\} from "react";/, 'import { $1, useCallback } from "react";');
}

// 1. Remove early return at the top
content = content.replace('  if (!isOpen) return null;\n\n  const handleDOISearch = async () => {', '  const dialogRef = useRef<HTMLDivElement>(null);\n\n  const handleClose = useCallback(() => {\n    setDoiInput("");\n    setSearchQuery("");\n    setSearchResults([]);\n    setDoiResult(null);\n    setManualTitle("");\n    setManualAuthors("");\n    setManualDoi("");\n    setManualUrl("");\n    setError("");\n    onClose();\n  }, [onClose]);\n\n  const handleDOISearch = async () => {');

// 2. Remove the old dialogRef
content = content.replace('  const dialogRef = useRef<HTMLDivElement>(null);\n\n  useEffect(() => {', '  useEffect(() => {');

// 3. Remove old handleClose
content = content.replace(/  const handleClose = \(\) => \{\n    setDoiInput\(""\);\n    setSearchQuery\(""\);\n    setSearchResults\(\[\]\);\n    setDoiResult\(null\);\n    setManualTitle\(""\);\n    setManualAuthors\(""\);\n    setManualDoi\(""\);\n    setManualUrl\(""\);\n    setError\(""\);\n    onClose\(\);\n  \};\n\n/, '');

// 4. Add the early return before the render
content = content.replace('  return (\n    <div\n', '  if (!isOpen) return null;\n\n  return (\n    <div\n');

fs.writeFileSync('researchquest/src/components/entities/AddPaperModal.tsx', content);
