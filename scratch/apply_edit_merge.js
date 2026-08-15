const fs = require('fs');

const scriptPath = 'www/script.js';
const newCodePath = 'scratch/replace_btnEditSave.js';

let scriptContent = fs.readFileSync(scriptPath, 'utf8');
const newCode = fs.readFileSync(newCodePath, 'utf8');

const startIndex = scriptContent.indexOf(`btnEditSave.addEventListener('click', () => {`);
const endIndex = scriptContent.indexOf(`// --- Time Modal Logic ---`);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find boundaries!");
    process.exit(1);
}

const finalContent = scriptContent.substring(0, startIndex) + newCode + '\n\n' + scriptContent.substring(endIndex);

fs.writeFileSync(scriptPath, finalContent, 'utf8');
console.log("Successfully replaced btnEditSave logic!");
