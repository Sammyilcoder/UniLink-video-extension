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
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get(defaults, function(storage) {
        if (chrome.runtime.lastError) {
          console.log("Error loading settings:", chrome.runtime.lastError.message);
          // Use defaults if error
          seekStepInput.value = defaults.rewindTime;
          speedStepInput.value = defaults.speedStep;
          return;
        }
        
        seekStepInput.value = storage.rewindTime || defaults.rewindTime;
        speedStepInput.value = storage.speedStep || defaults.speedStep;
      });
    } else {
      // Fallback to defaults if chrome.storage not available
      seekStepInput.value = defaults.rewindTime;
      speedStepInput.value = defaults.speedStep;
    }
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
    if (seekStep < 1 || seekStep > 500) {
      showStatus('Skip step must be between 1 and 500 seconds', 'error');
      return;
    }

    if (speedStep < 0.05 || speedStep > 1) {
      showStatus('Playback rate step must be between 0.05 and 1', 'error');
      return;
    }

    // Save to storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.set({
        rewindTime: seekStep,
        advanceTime: seekStep, // Keep both for compatibility
        speedStep: speedStep
      }, function() {
        if (chrome.runtime.lastError) {
          console.log("Error saving settings:", chrome.runtime.lastError.message);
          showStatus('Error saving settings!', 'error');
          return;
        }
        
        showStatus('Settings saved successfully!', 'success');
        
        // Hide status after 2 seconds
        setTimeout(() => {
          hideStatus();
        }, 2000);
      });
    } else {
      showStatus('Storage not available!', 'error');
    }
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