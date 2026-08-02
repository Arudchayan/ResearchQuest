const fs = require('fs');
const filepath = 'researchquest/src/components/entities/AddPaperModal.tsx';
let code = fs.readFileSync(filepath, 'utf8');

const earlyReturnSearch = `  if (!isOpen) return null;`;
const removeReturn = code.replace(earlyReturnSearch, '');

const endSearch = `  return (
    <div`;
const replaceEnd = `  if (!isOpen) return null;

  return (
    <div`;

const newCode = removeReturn.replace(endSearch, replaceEnd);
fs.writeFileSync(filepath, newCode, 'utf8');
console.log("Moved early return");
