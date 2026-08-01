const fs = require('fs');
const path = require('path');

function setupDOM() {
  // Reset mock storage
  let storage = {};
  global.localStorage = {
    getItem: jest.fn(key => storage[key] || null),
    setItem: jest.fn((key, value) => { storage[key] = value; }),
    removeItem: jest.fn(key => { delete storage[key]; }),
    clear: jest.fn(() => { storage = {}; })
  };

  // Mock Notification API
  global.Notification = {
    permission: 'default',
    requestPermission: jest.fn().mockResolvedValue('granted')
  };
  global.window.alert = jest.fn();
  
  // Mock AudioContext
  global.AudioContext = class {
    resume() { return Promise.resolve(); }
    createOscillator() {
      return { connect: jest.fn(), start: jest.fn(), stop: jest.fn(), frequency: { value: 0, setValueAtTime: jest.fn() } };
    }
    createGain() {
      return { connect: jest.fn(), gain: { exponentialRampToValueAtTime: jest.fn(), setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() } };
    }
  };
  global.webkitAudioContext = global.AudioContext;

  // Mock Capacitor
  global.window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    Plugins: {
      SystemAlarmPlugin: {
        setAlarm: jest.fn().mockResolvedValue({}),
        cancelAlarm: jest.fn().mockResolvedValue({}),
        checkExactAlarmPermission: jest.fn().mockResolvedValue({ granted: true }),
        requestExactAlarmPermission: jest.fn().mockResolvedValue({ granted: true }),
        stopAlarmSound: jest.fn().mockResolvedValue({}),
        openNotificationSettings: jest.fn().mockResolvedValue({}),
        playAlarmSound: jest.fn().mockResolvedValue({})
      },
      LocalNotifications: {
        schedule: jest.fn().mockResolvedValue({}),
        cancel: jest.fn().mockResolvedValue({}),
        requestPermissions: jest.fn().mockResolvedValue({ display: 'granted' }),
        checkPermissions: jest.fn().mockResolvedValue({ display: 'prompt' }),
        createChannel: jest.fn().mockResolvedValue({})
      }
    }
  };

  const htmlPath = path.resolve(__dirname, '../www/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  document.body.innerHTML = html;

  const configPath = path.resolve(__dirname, '../www/config.js');
  const configCode = fs.readFileSync(configPath, 'utf8');
  
  const scriptPath = path.resolve(__dirname, '../www/script.js');
  const scriptCode = fs.readFileSync(scriptPath, 'utf8');

  // Load scripts into DOM
  const runScripts = new Function(`
    ${configCode}
    ${scriptCode}
  `);
  
  runScripts();
}

module.exports = { setupDOM };
