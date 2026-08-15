const fs = require('fs');
const https = require('https');
const path = require('path');

const configPath = path.join(__dirname, 'www', 'config.js');

async function translateText(text, targetLang) {
    return new Promise((resolve, reject) => {
        // Fallback or fix some language codes
        let tl = targetLang;
        if (tl.includes('-')) {
            // just use the primary subtag for simplicity, or handle specific exceptions
            tl = tl.split('-')[0];
        }
        // specifically, zh-CN and zh-TW might need to be passed as is, but let's try standardizing
        if (targetLang === 'zh-CN') tl = 'zh-CN';
        if (targetLang === 'zh-TW') tl = 'zh-TW';

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed && parsed[0] && parsed[0][0]) {
                        resolve(parsed[0][0][0]);
                    } else {
                        resolve(text);
                    }
                } catch (e) {
                    resolve(text);
                }
            });
        }).on('error', (e) => {
            resolve(text); // fallback on error
        });
    });
}

async function main() {
    let code = fs.readFileSync(configPath, 'utf8');
    const match = code.match(/const TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
    if (!match) {
        console.log("Could not find TRANSLATIONS object.");
        return;
    }

    let translations;
    try {
        translations = (new Function('return ' + match[1]))();
    } catch(e) {
        console.error("Failed to parse TRANSLATIONS", e);
        return;
    }

    const enTexts = {
        "error_overlap": "Error: The event overlaps with an existing one.",
        "settings_permissions_title": "Permissions (Android)",
        "settings_perm_alarm": "Alarm Permission"
    };

    const keys = Object.keys(translations);
    console.log(`Found ${keys.length} languages.`);

    for (const lang of keys) {
        if (['en', 'es', 'af'].includes(lang)) {
            continue; // already correct
        }

        const langDict = translations[lang];
        let modified = false;

        for (const [key, text] of Object.entries(enTexts)) {
            // Check if it's identical to the English fallback (which means it's untranslated) or missing
            if (!langDict[key] || langDict[key] === text) {
                // translate
                const translated = await translateText(text, lang);
                if (translated && translated !== text) {
                    langDict[key] = translated;
                    modified = true;
                }
                // Rate limit slightly
                await new Promise(r => setTimeout(r, 200));
            }
        }

        if (modified) {
            console.log(`Translated [${lang}] -> ${langDict["error_overlap"]}`);
        }
    }

    const newStr = JSON.stringify(translations, null, 4);
    const newCode = code.replace(/const TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/, `const TRANSLATIONS = ${newStr};`);
    
    fs.writeFileSync(configPath, newCode, 'utf8');
    console.log("Translations finished!");
}

main().catch(console.error);
