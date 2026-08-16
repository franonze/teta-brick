const fs = require('fs');
const configPath = 'www/config.js';
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace " (Android)" or "(Android)" in settings_permissions_title
// Example: "settings_permissions_title": "Permisos (Android)", -> "settings_permissions_title": "Permisos",
// Be careful to only replace inside the settings_permissions_title lines.
const regex = /("settings_permissions_title"\s*:\s*".*?)\s*\(Android\)(.*?")/g;
configContent = configContent.replace(regex, '$1$2');

fs.writeFileSync(configPath, configContent, 'utf8');

const scriptPath = 'www/script.js';
let scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Add logic to hide Android permissions if not android
// I'll put it in the initialization block (window.addEventListener('DOMContentLoaded'))
// Let's find "initApp();" inside DOMContentLoaded.
const domContentLoadedRegex = /window\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*\{/;
if (scriptContent.match(domContentLoadedRegex)) {
    const hiddenLogic = `
    const platform = Capacitor.getPlatform();
    if (platform !== 'android') {
        const androidPerms = document.getElementById('android-permissions-section');
        if (androidPerms) {
            androidPerms.style.display = 'none';
        }
    }
`;
    scriptContent = scriptContent.replace(domContentLoadedRegex, `window.addEventListener('DOMContentLoaded', () => {${hiddenLogic}`);
    fs.writeFileSync(scriptPath, scriptContent, 'utf8');
} else {
    console.error("Could not find DOMContentLoaded in script.js");
}

console.log("Updated config.js and script.js");
