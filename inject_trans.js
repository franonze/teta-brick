const fs = require('fs');
const content = fs.readFileSync('www/config.js', 'utf-8');
const newTrans = JSON.parse(fs.readFileSync('new_translations.json', 'utf-8'));

let updated = content;

for (const lang in newTrans) {
    const obj = newTrans[lang];
    let newKeysStr = '';
    for (const k in obj) {
        newKeysStr += `\n        ${k}: ${JSON.stringify(obj[k])},`;
    }
    
    const regex = new RegExp(`(^\\s*${lang}\\s*:\\s*\\{)`, 'm');
    updated = updated.replace(regex, `$1${newKeysStr}`);
}

fs.writeFileSync('www/config.js', updated, 'utf-8');
