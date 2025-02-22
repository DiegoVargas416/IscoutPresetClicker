document.addEventListener('DOMContentLoaded', async () => {
  const addPresetBtn = document.getElementById('addPresetBtn');
  const presetsContainer = document.getElementById('presetsContainer');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const enabledCheckbox = document.getElementById('enabled');
  const serverResetTimeInput = document.getElementById('serverResetTime');

  // Load from storage:
  chrome.storage.local.get(['presetList', 'enabled', 'serverResetTime'], (result) => {
    const presetList = result.presetList || [];
    const enabled = result.enabled || false;
    const serverResetTime = result.serverResetTime || '03:00';

    enabledCheckbox.checked = enabled;
    serverResetTimeInput.value = serverResetTime;

    // Build UI rows for each preset:
    presetList.forEach(preset => {
      createPresetUIRow(preset);
    });
  });

  // Add new preset UI row when user clicks "Add Preset"
  addPresetBtn.addEventListener('click', () => {
    // Default blank preset for new entries
    const newPreset = {
      name: '',
      interval: 180,
      days: [ false, false, false, false, false, false, false ],
    };
    createPresetUIRow(newPreset);
  });

  // Called by "Save Settings" button
  saveSettingsBtn.addEventListener('click', () => {
    const presetList = [];
    // Read each .preset-item row from the container
    const rows = presetsContainer.querySelectorAll('.preset-item');
    rows.forEach(row => {
      const nameEl = row.querySelector('.preset-name');
      const intervalEl = row.querySelector('.preset-interval');
      const dayCheckboxes = row.querySelectorAll('.day-checkbox');

      const days = Array.from(dayCheckboxes).map(chk => chk.checked);

      const preset = {
        name: nameEl.value.trim(),
        interval: parseInt(intervalEl.value, 10) || 60,
        days: days,
      };
      presetList.push(preset);
    });

    const enabledVal = enabledCheckbox.checked;
    const serverResetVal = serverResetTimeInput.value || '03:00';

    chrome.storage.local.set({
      presetList: presetList,
      enabled: enabledVal,
      serverResetTime: serverResetVal
    }, () => {
      // close popup
      window.close();
    });
  });

  /**
   * Create UI row for one preset object in the presetsContainer
   */
  function createPresetUIRow(preset) {
    const row = document.createElement('div');
    row.className = 'preset-item';

    // Name
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Preset Name:';
    row.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'preset-name';
    nameInput.value = preset.name;
    row.appendChild(nameInput);

    // Interval
    const intervalLabel = document.createElement('label');
    intervalLabel.textContent = 'Interval (seconds):';
    row.appendChild(intervalLabel);

    const intervalInput = document.createElement('input');
    intervalInput.type = 'number';
    intervalInput.className = 'preset-interval';
    intervalInput.value = preset.interval;
    row.appendChild(intervalInput);

    // Days
    const daysContainer = document.createElement('div');
    daysContainer.className = 'days-container';
    const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    for (let i = 0; i < 7; i++) {
      const lbl = document.createElement('label');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'day-checkbox';
      chk.checked = !!preset.days[i];
      lbl.appendChild(chk);
      lbl.appendChild(document.createTextNode(dayNames[i]));
      daysContainer.appendChild(lbl);
    }
    row.appendChild(daysContainer);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove Preset';
    removeBtn.className = 'remove-btn';
    removeBtn.addEventListener('click', () => {
      row.remove();
    });
    row.appendChild(removeBtn);

    presetsContainer.appendChild(row);
  }
});
