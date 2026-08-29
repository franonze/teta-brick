const fs = require('fs');

const configPath = 'c:/Users/franr/Repositories/teta-brick/www/config.js';
const content = fs.readFileSync(configPath, 'utf8');

const match = content.match(/(const TRANSLATIONS = )(\{[\s\S]*?\});\s*$/);
if (!match) {
    console.log('Could not find TRANSLATIONS object.');
    process.exit(1);
}

const translations = eval('(' + match[2] + ')');
const baseLang = 'es';
const baseKeys = Object.keys(translations[baseLang]);

async function translateText(text, lang) {
    let tLang = lang;
    if (tLang === 'bho') tLang = 'bhojpuri';
    if (tLang === 'ceb') tLang = 'cebuano';
    if (tLang === 'rm') tLang = 'romansh';
    if (tLang === 'sq') tLang = 'sq';
    if (tLang === 'zh') tLang = 'zh-CN';
    
    for (let i = 0; i < 3; i++) {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${baseLang}&tl=${tLang}&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return data[0][0][0];
        } catch (e) {
            console.log(`Retry ${i+1} for "${text}" to ${lang}`);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return text; // fallback to original if completely fails
}

async function run() {
    let modified = false;

    for (const lang in translations) {
        if (lang === baseLang) continue;

        for (const key of baseKeys) {
            if (!translations[lang][key]) {
                const originalText = translations[baseLang][key];
                console.log(`Translating [${key}] for ${lang}...`);
                const result = await translateText(originalText, lang);
                translations[lang][key] = result;
                modified = true;
                await new Promise(r => setTimeout(r, 250)); // prevent rate limit
            }
        }
    }

    if (modified) {
        const newContent = content.substring(0, match.index) + match[1] + JSON.stringify(translations, null, 4) + ';\n';
        fs.writeFileSync(configPath, newContent, 'utf8');
        console.log('Translations updated and injected successfully.');
    } else {
        console.log('All translations are up to date. No changes made.');
    }
}

run().catch(console.error);
