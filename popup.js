document.addEventListener("DOMContentLoaded", function () {
  const seekStepInput = document.getElementById('seekStep');
  const speedStepInput = document.getElementById('speedStep');
  const resetButton = document.getElementById('reset');
  const saveButton = document.getElementById('save');
  const status = document.getElementById('status');

  // Default values
  const defaults = {
    rewindTime: 10,
    speedStep: 0.25
  };

  // Load current settings
  loadSettings();

  // Event listeners
  resetButton.addEventListener('click', resetToDefaults);
  saveButton.addEventListener('click', saveSettings);

  function loadSettings() {
    chrome.storage.sync.get(defaults, function(storage) {
      seekStepInput.value = storage.rewindTime || defaults.rewindTime;
      speedStepInput.value = storage.speedStep || defaults.speedStep;
    });
  }

  function resetToDefaults() {
    seekStepInput.value = defaults.rewindTime;
    speedStepInput.value = defaults.speedStep;
    showStatus('Settings reset to defaults', 'success');
  }

  function saveSettings() {
    const seekStep = parseInt(seekStepInput.value);
    const speedStep = parseFloat(speedStepInput.value);

    // Validation
    if (seekStep < 1 || seekStep > 60) {
      showStatus('Skip step must be between 1 and 60 seconds', 'error');
      return;
    }

    if (speedStep < 0.05 || speedStep > 1) {
      showStatus('Playback rate step must be between 0.05 and 1', 'error');
      return;
    }

    // Save to storage
    chrome.storage.sync.set({
      rewindTime: seekStep,
      advanceTime: seekStep, // Keep both for compatibility
      speedStep: speedStep
    }, function() {
      showStatus('Settings saved successfully!', 'success');
      
      // Hide status after 2 seconds
      setTimeout(() => {
        hideStatus();
      }, 2000);
    });
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove('hidden');
  }

  function hideStatus() {
    status.classList.add('hidden');
  }
});