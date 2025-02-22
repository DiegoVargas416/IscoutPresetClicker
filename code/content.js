
// content.js

let Queue = [];
let queueIndex = 0;  // We'll store and retrieve this from chrome.storage

console.log("Init All");

initExtension();

/**
 * Main entry point - builds the queue, loads the queueIndex, and starts.
 */
function initExtension() {
  console.log("Init Clicker");

  chrome.storage.local.get([
    'presetList',
    'enabled',
    'serverResetTime',
    'lastReloadTime',
    'queueIndex'
  ], async function (result) {
    const Enabled = result.enabled || false;
    const presetList = result.presetList || [];
    const serverResetTime = result.serverResetTime || '03:00';
    const lastReload = result.lastReloadTime || 0;
    // Load the stored queueIndex if it exists:
    queueIndex = (typeof result.queueIndex === 'number') ? result.queueIndex : 0;

    if (!Enabled || presetList.length === 0) {
      console.log("Not enabled or no presets found; exiting.");
      return;
    }

    // Step 1: Build the queue for today's day-of-week
    const serverDayIndex = getServerDayIndex(serverResetTime);
    console.log("Server day index =", serverDayIndex);

    // Build the list of "active" presets
    const activePresets = [];
    presetList.forEach(preset => {
      if (preset.days && preset.days[serverDayIndex]) {
        activePresets.push({
          name: preset.name,
          interval: preset.interval
        });
      }
    });

    if (activePresets.length === 0) {
      console.log("No presets active for today's day-of-week.");
      return;
    }

    Queue = activePresets;
    console.log("Queue =", Queue);

    // Ensure the stored queueIndex is in range
    if (queueIndex >= Queue.length) {
      queueIndex = 0;
    }
    console.log("Current queueIndex =", queueIndex);

    // Step 2: Begin cycling after a short delay (to let page load)
    setTimeout(processQueue, 10000);
  });
}

/**
 * Round-robin through the queue using queueIndex and store it.
 */
function processQueue() {
  if (Queue.length === 0) {
    console.log("Queue is empty, nothing to do.");
    return;
  }

  const currentItem = Queue[queueIndex];
  console.log(`Processing queueIndex=${queueIndex}, preset="${currentItem.name}"`);

  switchPreset(currentItem.name)
    .then(() => {
      // After switching, schedule the next item
      setTimeout(async () => {
        // Advance queueIndex, store in chrome.storage
        queueIndex = (queueIndex + 1) % Queue.length;
        await setQueueIndex(queueIndex);
        console.log("Next queueIndex =", queueIndex);

        processQueue(); // move on
      }, currentItem.interval * 1000);
    })
    .catch(err => {
      console.error("Error while switching preset:", err);
      // Even if there's an error, advance after the same delay
      setTimeout(async () => {
        queueIndex = (queueIndex + 1) % Queue.length;
        await setQueueIndex(queueIndex);
        processQueue();
      }, currentItem.interval * 1000);
    });
}

/**
 * Switch to a given preset name:
 *  1) Click "Presets list"
 *  2) Click the preset
 *  3) Click "Apply"
 *  4) Possibly reload (if last reload > 60s ago)
 */
async function switchPreset(name) {
  console.log("Switching Preset:", name);

  try {
    // 1) Click "Presets list"
    if (!getButtonScript("Presets list")) {
      console.log("Could not find 'Presets list' button; aborting switch.");
      return;
    }
    await delay(500);

    // 2) Select the preset by name
    if (!getPresetScript(name)) {
      console.log(`Could not find preset "${name}" in the list; aborting switch.`);
      return;
    }
    await delay(500);

    // 3) Click "Apply"
    getButtonScript("Apply");
    await delay(1000);

    // 4) Check loop safeguard
    const lastReload = await getLastReloadTimestamp();
    const now = Date.now();
    if (now - lastReload < 60 * 1000) {
      console.log("Reloaded less than a minute ago; skipping reload to avoid loop.");
      return;
    }

    // If enough time has passed, record new reload time, then no-cache reload
    await setLastReloadTimestamp(now);
    console.log(`Reloading page now (no-cache). Preset="${name}"`);
    window.location.reload(true);

  } catch (error) {
    console.error("Error in switchPreset:", error);
  }
}

//============================================================
// Helpers
//============================================================

function getButtonScript(buttonText) {
  try {
    const buttons = document.querySelectorAll('button');
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i].innerText === buttonText) {
        buttons[i].click();
        console.log(`Clicked button: ${buttonText}`);
        return true;
      }
    }
    console.log(`Button not found: ${buttonText}`);
    return false;
  } catch (error) {
    console.error('Error in getButtonScript:', error);
    return false;
  }
}

function getPresetScript(presetName) {
  try {
    const elements = document.querySelectorAll(
      '.flex.cursor-pointer div.text-gray-700.flex-grow.px-4.py-2.text-sm'
    );
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].innerText === presetName) {
        elements[i].click();
        console.log(`Clicked Preset: ${presetName}`);
        return true;
      }
    }
    console.log(`Preset not found: ${presetName}`);
    return false;
  } catch (error) {
    console.error('Error in getPresetScript:', error);
    return false;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 0=Mon, 1=Tue, ... 6=Sun, based on local time vs serverResetTime
 */
function getServerDayIndex(serverResetTime) {
  const now = new Date();
  let dayOfWeek = now.getDay(); // Sunday=0, Monday=1, ... Saturday=6
  let dayIndex = (dayOfWeek + 6) % 7; // shift so Monday=0, Sunday=6

  const [resetH, resetM] = serverResetTime.split(':').map(Number);
  const resetMinutes = resetH * 60 + (resetM || 0);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (currentMinutes < resetMinutes) {
    // treat it as "yesterday"
    dayIndex = (dayIndex + 6) % 7;
  }
  return dayIndex;
}

//============================================================
// Chrome Storage helpers
//============================================================
function getLastReloadTimestamp() {
  return new Promise(resolve => {
    chrome.storage.local.get(['lastReloadTime'], result => {
      resolve(result.lastReloadTime || 0);
    });
  });
}
function setLastReloadTimestamp(ts) {
  return new Promise(resolve => {
    chrome.storage.local.set({ lastReloadTime: ts }, () => resolve());
  });
}

/** Store the current queue index in Chrome Storage. */
function setQueueIndex(idx) {
  return new Promise(resolve => {
    chrome.storage.local.set({ queueIndex: idx }, () => resolve());
  });
}
