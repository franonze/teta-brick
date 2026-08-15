const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'www', 'config.js');
let code = fs.readFileSync(configPath, 'utf8');

// Regex to find all lang blocks
const regex = /("[a-z]{2}(?:-[A-Z]{2})?":\s*\{)([\s\S]*?)(\n\s*\})/g;

const en_texts = {
    "error_overlap": "Error: The event overlaps with an existing one.",
    "settings_permissions_title": "Permissions (Android)",
    "settings_perm_alarm": "Alarm Permission"
};

const es_texts = {
    "error_overlap": "Error: El evento se solapa con otro existente.",
    "settings_permissions_title": "Permisos (Android)",
    "settings_perm_alarm": "Permiso de Alarma"
};

const af_texts = {
    "error_overlap": "Fout: Die gebeurtenis oorvleuel met 'n bestaande een.",
    "settings_permissions_title": "Toestemmings (Android)",
    "settings_perm_alarm": "Alarm Toestemming"
};

let match;
let newCode = code;

newCode = code.replace(regex, (m, start, content, end) => {
    let langMatch = start.match(/"([^"]+)"/);
    if (!langMatch) return m;
    let lang = langMatch[1];
    
    let texts = en_texts;
    if (lang === 'es') texts = es_texts;
    if (lang === 'af') texts = af_texts;
    
    let lines = content;
    for (const [k, v] of Object.entries(texts)) {
        if (!lines.includes(`"${k}"`)) {
            lines += `,\n        "${k}": "${v}"`;
        } else if (lang === 'es' || lang === 'af') {
            // override for specific languages
            let re = new RegExp(`"${k}":\\s*"[^"]*"`);
            lines = lines.replace(re, `"${k}": "${v}"`);
        }
    }
    
    return start + lines + end;
});

fs.writeFileSync(configPath, newCode, 'utf8');
console.log("Translations injected!");
