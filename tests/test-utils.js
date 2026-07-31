const fs = require('fs');
const path = require('path');

function setupDOM() {
  const mockStorage = {};
  
  global.Notification = {
    permission: 'default',
    requestPermission: jest.fn().mockResolvedValue('granted')
  };
  global.window.alert = jest.fn();
  
  global.AudioContext = class {
    resume() { return Promise.resolve(); }
    createOscillator() {
      return { connect: jest.fn(), start: jest.fn(), stop: jest.fn(), frequency: { value: 0 } };
    }
    createGain() {
      return { connect: jest.fn(), gain: { exponentialRampToValueAtTime: jest.fn(), setValueAtTime: jest.fn() } };
    }
  };
  global.webkitAudioContext = global.AudioContext;

  const htmlPath = path.resolve(__dirname, '../www/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  document.body.innerHTML = html;

  const configPath = path.resolve(__dirname, '../www/config.js');
  const configCode = fs.readFileSync(configPath, 'utf8');
  
  const scriptPath = path.resolve(__dirname, '../www/script.js');
  const scriptCode = fs.readFileSync(scriptPath, 'utf8');

  // Wrap in a function so that let/const declarations are locally scoped
  // and do not cause "Identifier has already been declared" errors between tests.
  // We attach `jestContext` to window so the script can expose internal variables if needed
  // although it's better to test behavior via DOM and localStorage.
  const runScripts = new Function(`
    ${configCode}
    ${scriptCode}
  `);
  
  runScripts();
}

module.exports = { setupDOM };
