var regStrip = /^[\r\t\f\v ]+|[\r\t\f\v ]+$/gm;

var tc = {
  settings: {
    lastSpeed: 1.0, // default 1x
    enabled: true, // default enabled
    speeds: {}, // empty object to hold speed for each source

    displayKeyCode: 86, // default: V
    rememberSpeed: false, // default: false
    forceLastSavedSpeed: false, //default: false
    audioBoolean: false, // default: false
    startHidden: false, // default: false
    controllerOpacity: 0.3, // default: 0.3
    keyBindings: [],
    blacklist: `\
      www.instagram.com
      twitter.com
      vine.co
      imgur.com
      teams.microsoft.com
    `.replace(regStrip, ""),
    defaultLogLevel: 4,
    logLevel: 3
  },

  // Holds a reference to all of the AUDIO/VIDEO DOM elements we've attached to
  mediaElements: []
};
const FEEDBACK_ELEMENT_ID = "uv-feedback";
const FEEDBACK_VISIBLE_CLASS = "uv-visible";
const FEEDBACK_DURATION = 700;
const feedbackElements = new WeakMap();
const feedbackTimers = new WeakMap();

function ensureFeedbackElement(doc) {
  let el = feedbackElements.get(doc);
  if (el && el.isConnected) {
    return el;
  }
  el = doc.getElementById(FEEDBACK_ELEMENT_ID);
  if (!el) {
    el = doc.createElement("div");
    el.id = FEEDBACK_ELEMENT_ID;
    const container = doc.body || doc.documentElement || doc;
    container.appendChild(el);
  }
  feedbackElements.set(doc, el);
  return el;
}

function showFeedback(doc, message, actionType = 'default') {
  const el = ensureFeedbackElement(doc);
  el.textContent = message;
  
  // Remove existing action classes
  el.classList.remove('uv-seek', 'uv-speed', 'uv-default');
  
  // Add appropriate action class
  if (actionType === 'seek') {
    el.classList.add('uv-seek');
  } else if (actionType === 'speed') {
    el.classList.add('uv-speed');
  } else {
    el.classList.add('uv-default');
  }
  
  el.classList.add(FEEDBACK_VISIBLE_CLASS);
  const win = doc.defaultView || window;
  const existingTimer = feedbackTimers.get(doc);
  if (existingTimer) {
    win.clearTimeout(existingTimer);
  }
  const timer = win.setTimeout(() => {
    el.classList.remove(FEEDBACK_VISIBLE_CLASS);
    feedbackTimers.delete(doc);
  }, FEEDBACK_DURATION);
  feedbackTimers.set(doc, timer);
}

function formatMagnitude(value) {
  const absValue = Math.abs(value);
  const fixed = absValue % 1 === 0 ? absValue.toFixed(0) : absValue.toFixed(2);
  // Only remove trailing zeros after decimal point, not from whole numbers
  const result = fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return result;
}

function formatDelta(value, suffix) {
  if (value === 0) {
    return `0${suffix}`;
  }
  const sign = value > 0 ? "+" : "-";
  const magnitude = formatMagnitude(value);
  const result = `${sign}${magnitude}${suffix}`;
  return result;
}

function formatSpeed(value) {
  return formatMagnitude(value);
}


/* Log levels (depends on caller specifying the correct level)
  1 - none
  2 - error
  3 - warning
  4 - info
  5 - debug
  6 - debug high verbosity + stack trace on each message
*/
function log(message, level) {
  verbosity = tc.settings.logLevel;
  if (typeof level === "undefined") {
    level = tc.settings.defaultLogLevel;
  }
  if (verbosity >= level) {
    if (level === 2) {
      console.log("ERROR:" + message);
    } else if (level === 3) {
      console.log("WARNING:" + message);
    } else if (level === 4) {
      console.log("INFO:" + message);
    } else if (level === 5) {
      console.log("DEBUG:" + message);
    } else if (level === 6) {
      console.log("DEBUG (VERBOSE):" + message);
      console.trace();
    }
  }
}

// Initialize storage with error handling
function initializeSettings() {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    log("Chrome storage API not available, using defaults", 3);
    initializeWithDefaults();
    return;
  }

  chrome.storage.sync.get(['speedStep', 'rewindTime', 'advanceTime', 'lastSpeed', 'displayKeyCode', 'rememberSpeed', 'forceLastSavedSpeed', 'audioBoolean', 'startHidden', 'controllerOpacity', 'blacklist'], function (storage) {
    if (chrome.runtime.lastError) {
      log("Storage error: " + chrome.runtime.lastError.message, 3);
      initializeWithDefaults();
      return;
    }

    if (!storage) {
      log("Storage is undefined, using defaults", 3);
      initializeWithDefaults();
      return;
    }

    const speedStep = Number(storage.speedStep) || 0.25;
    const seekStep = Number(storage.rewindTime) || Number(storage.advanceTime) || 10;

    tc.settings.keyBindings = [
      {
        action: "rewind",
        key: 37,
        value: seekStep,
        force: true,
        predefined: true
      },
      {
        action: "advance",
        key: 39,
        value: seekStep,
        force: true,
        predefined: true
      },
      {
        action: "slower",
        key: 40,
        value: speedStep,
        force: true,
        predefined: true
      },
      {
        action: "faster",
        key: 38,
        value: speedStep,
        force: true,
        predefined: true
      }
    ];

    tc.settings.version = "0.6.4.0";

    chrome.storage.sync.set({
      keyBindings: tc.settings.keyBindings,
      version: tc.settings.version
    });

    tc.settings.lastSpeed = Number(storage.lastSpeed) || 1.0;
    tc.settings.displayKeyCode = Number(storage.displayKeyCode) || 86;
    tc.settings.rememberSpeed = Boolean(storage.rememberSpeed);
    tc.settings.forceLastSavedSpeed = Boolean(storage.forceLastSavedSpeed);
    tc.settings.audioBoolean = Boolean(storage.audioBoolean);
    tc.settings.enabled = true; // Always enabled
    tc.settings.startHidden = Boolean(storage.startHidden);
    tc.settings.controllerOpacity = Number(storage.controllerOpacity) || 0.3;
    tc.settings.blacklist = String(storage.blacklist || tc.settings.blacklist);

    initializeWhenReady(document);
  });
}

function initializeWithDefaults() {
  // Use default values when storage is not available
  const speedStep = 0.25;
  const seekStep = 10;

  tc.settings.keyBindings = [
    {
      action: "rewind",
      key: 37,
      value: seekStep,
      force: true,
      predefined: true
    },
    {
      action: "advance",
      key: 39,
      value: seekStep,
      force: true,
      predefined: true
    },
    {
      action: "slower",
      key: 40,
      value: speedStep,
      force: true,
      predefined: true
    },
    {
      action: "faster",
      key: 38,
      value: speedStep,
      force: true,
      predefined: true
    }
  ];

  tc.settings.version = "0.6.4.0";
  tc.settings.lastSpeed = 1.0;
  tc.settings.displayKeyCode = 86;
  tc.settings.rememberSpeed = false;
  tc.settings.forceLastSavedSpeed = false;
  tc.settings.audioBoolean = false;
  tc.settings.enabled = true;
  tc.settings.startHidden = false;
  tc.settings.controllerOpacity = 0.3;

  initializeWhenReady(document);
}

// Start initialization
initializeSettings();

// Clean old progress data on startup
cleanOldProgressData();

// Save progress before page unload
window.addEventListener('beforeunload', function() {
  tc.mediaElements.forEach(function(video) {
    if (video.nodeName === "VIDEO") {
      saveVideoProgress(video);
    }
  });
});

// Listen for storage changes to update settings dynamically
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync') {
      if (changes.rewindTime || changes.advanceTime || changes.speedStep) {
        // Update key bindings when seek or speed steps change
        const seekStep = changes.rewindTime ? changes.rewindTime.newValue : 
                       changes.advanceTime ? changes.advanceTime.newValue :
                       getKeyBindings("rewind", "value") || 10;
        const speedStep = changes.speedStep ? changes.speedStep.newValue : 
                         getKeyBindings("faster", "value") || 0.25;
        
        // Update the key bindings
        if (tc.settings.keyBindings) {
          tc.settings.keyBindings.forEach(binding => {
            if (binding.action === "rewind" || binding.action === "advance") {
              binding.value = Number(seekStep);
            } else if (binding.action === "slower" || binding.action === "faster") {
              binding.value = Number(speedStep);
            }
          });
        }
        
        log("Settings updated from storage changes", 4);
      }
    }
  });
}

function getKeyBindings(action, what = "value") {
  const binding = tc.settings.keyBindings.find((item) => item.action === action);
  if (!binding) {
    log(`Missing key binding for action: ${action}`, 4);
    return false;
  }
  if (!(what in binding)) {
    log(`Key binding property not found: ${action}.${what}`, 4);
    return false;
  }
  return binding[what];
}

function setKeyBindings(action, value) {
  let binding = tc.settings.keyBindings.find((item) => item.action === action);
  if (!binding) {
    binding = {
      action,
      key: null,
      value,
      force: false,
      predefined: false
    };
    tc.settings.keyBindings.push(binding);
    log(`Created placeholder key binding for action: ${action}`, 4);
  } else {
    binding.value = value;
  }
}

function escapeStringRegExp(str) {
  matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
  return str.replace(matchOperatorsRe, "\\$&");
}

function updateIcon(enabled) {
  const suffix = enabled ? ".png" : "_disabled.png";
  
  // Manifest V3 compatible API calls
  if (typeof browser !== 'undefined' && browser.action) {
    // Firefox with Manifest V3
    browser.action.setIcon({
      path: {
        "16": "icons/icon16" + suffix,
        "19": "icons/icon19" + suffix,
        "38": "icons/icon38" + suffix,
        "48": "icons/icon48" + suffix
      }
    }).catch(err => log("Failed to update icon (Firefox V3): " + err, 3));
  } else if (typeof chrome !== 'undefined' && chrome.action) {
    // Chrome/Edge with Manifest V3
    chrome.action.setIcon({
      path: {
        "16": "icons/icon16" + suffix,
        "19": "icons/icon19" + suffix,
        "38": "icons/icon38" + suffix,
        "48": "icons/icon48" + suffix
      }
    });
  } else if (typeof chrome !== 'undefined' && chrome.browserAction) {
    // Fallback for older versions (Manifest V2)
    chrome.browserAction.setIcon({
      path: {
        "19": "icons/icon19" + suffix,
        "38": "icons/icon38" + suffix,
        "48": "icons/icon48" + suffix
      }
    });
  }
  
  log(`Icon updated to ${enabled ? 'enabled' : 'disabled'}`, 4);
}

function isBlacklisted() {
  // Since we're now using specific domains in manifest, always enable
  updateIcon(true);
  
  // Original blacklist logic (kept for compatibility)
  blacklisted = false;
  tc.settings.blacklist.split("\n").forEach((match) => {
    match = match.replace(regStrip, "");
    if (match.length == 0) {
      return;
    }

    if (match.startsWith("/")) {
      try {
        var regexp = new RegExp(match);
      } catch (err) {
        return;
      }
    } else {
      var regexp = new RegExp(escapeStringRegExp(match));
    }

    if (regexp.test(location.href)) {
      blacklisted = true;
      return;
    }
  });
  
  if (blacklisted) {
    updateIcon(false); // Set disabled icon if blacklisted
  }
  
  return blacklisted;
}

var coolDown = false;
function refreshCoolDown() {
  log("Begin refreshCoolDown", 5);
  if (coolDown) {
    clearTimeout(coolDown);
  }
  coolDown = setTimeout(function () {
    coolDown = false;
  }, 1000);
  log("End refreshCoolDown", 5);
}

function setupListener() {
  /**
   * This function is run whenever a video speed rate change occurs.
   * It is used to update the speed that shows up in the display as well as save
   * that latest speed into the local storage.
   *
   * @param {*} video The video element to update the speed indicators for.
   */
  function updateSpeedFromEvent(video) {
    var src = video.currentSrc;
    var speed = Number(video.playbackRate.toFixed(2));

    log("Playback rate changed to " + speed, 4);

    tc.settings.speeds[src] = speed;
    log("Storing lastSpeed in settings for the rememberSpeed feature", 5);
    tc.settings.lastSpeed = speed;
    log("Syncing chrome settings for lastSpeed", 5);
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.set({ lastSpeed: speed }, function () {
        if (chrome.runtime.lastError) {
          log("Error saving speed: " + chrome.runtime.lastError.message, 3);
        } else {
          log("Speed setting saved: " + speed, 5);
        }
      });
    }
  }

  document.addEventListener(
    "ratechange",
    function (event) {
      if (coolDown) {
        log("Speed event propagation blocked", 4);
        event.stopImmediatePropagation();
      }
      var video = event.target;

      /**
       * If the last speed is forced, only update the speed based on events created by
       * video speed instead of all video speed change events.
       */
      if (tc.settings.forceLastSavedSpeed) {
        if (event.detail && event.detail.origin === "videoSpeed") {
          video.playbackRate = event.detail.speed;
          updateSpeedFromEvent(video);
        } else {
          video.playbackRate = tc.settings.lastSpeed;
        }
        event.stopImmediatePropagation();
      } else {
        updateSpeedFromEvent(video);
      }
    },
    true
  );
}

function initializeWhenReady(document) {
  log("Begin initializeWhenReady", 5);
  if (isBlacklisted()) {
    log("Extension disabled (blacklisted)", 4);
    return;
  }
  log("Extension enabled", 4);
  window.addEventListener('load', () => {
    initializeNow(window.document);
  });
  if (document) {
    if (document.readyState === "complete") {
      initializeNow(document);
    } else {
      document.onreadystatechange = () => {
        if (document.readyState === "complete") {
          initializeNow(document);
        }
      };
    }
  }
  log("End initializeWhenReady", 5);
}
function inIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}
function getShadow(parent) {
  let result = [];
  function getChild(parent) {
    if (parent.firstElementChild) {
      var child = parent.firstElementChild;
      do {
        result.push(child);
        getChild(child);
        if (child.shadowRoot) {
          result.push(getShadow(child.shadowRoot));
        }
        child = child.nextElementSibling;
      } while (child);
    }
  }
  getChild(parent);
  return result.flat(Infinity);
}

function initializeNow(document) {
  log("Begin initializeNow", 5);
  // Always enabled - removed enable/disable check
  // enforce init-once due to redundant callers
  if (!document.body || document.body.classList.contains("vsc-initialized")) {
    return;
  }
  try {
    setupListener();
  } catch {
    // no operation
  }
  document.body.classList.add("vsc-initialized");
  log("initializeNow: vsc-initialized added to document body", 5);

  if (document === window.document) {
    // Video controller removed - now using keyboard-only controls
  } else {
    var link = document.createElement("link");
    link.href = chrome.runtime.getURL("inject.css");
    link.type = "text/css";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  var docs = Array(document);
  try {
    if (inIframe()) docs.push(window.top.document);
  } catch (e) {}

  docs.forEach(function (doc) {
    doc.addEventListener(
      "keydown",
      function (event) {
        var keyCode = event.keyCode;
        log("Processing keydown event: " + keyCode, 6);

        // Ignore if following modifier is active.
        if (
          !event.getModifierState ||
          event.getModifierState("Alt") ||
          event.getModifierState("Control") ||
          event.getModifierState("Fn") ||
          event.getModifierState("Meta") ||
          event.getModifierState("Hyper") ||
          event.getModifierState("OS")
        ) {
          log("Keydown event ignored due to active modifier: " + keyCode, 5);
          return;
        }

        // Ignore keydown event if typing in an input box
        if (
          event.target.nodeName === "INPUT" ||
          event.target.nodeName === "TEXTAREA" ||
          event.target.isContentEditable
        ) {
          return false;
        }

        // Ignore keydown event if typing in a page without vsc
        if (!tc.mediaElements.length) {
          return false;
        }

        var item = tc.settings.keyBindings.find((item) => item.key === keyCode);
        if (item) {
          runAction(item.action, item.value);
          if (item.force === true) {
            // disable websites key bindings
            event.preventDefault();
            event.stopPropagation();
          }
        }

        return false;
      },
      true
    );
  });

  function checkForVideo(node, parent, added) {
    // Only proceed with supposed removal if node is missing from DOM
    if (!added && document.body.contains(node)) {
      return;
    }
    if (
      node.nodeName === "VIDEO" ||
      (node.nodeName === "AUDIO" && tc.settings.audioBoolean)
    ) {
      if (added) {
        console.info('[UniLink] video detected', node);
        // Just add to mediaElements array, no controller needed
        if (!tc.mediaElements.includes(node)) {
          tc.mediaElements.push(node);
          
          // Start progress tracking for this video
          if (node.nodeName === "VIDEO") {
            // Wait for video to load metadata before trying to restore progress
            if (node.readyState >= 1) {
              restoreVideoProgress(node);
              startProgressTracking(node);
            } else {
              node.addEventListener('loadedmetadata', function() {
                restoreVideoProgress(node);
                startProgressTracking(node);
              }, { once: true });
            }
          }
        }
      } else {
        // Remove from mediaElements array and stop tracking
        let idx = tc.mediaElements.indexOf(node);
        if (idx != -1) {
          tc.mediaElements.splice(idx, 1);
          if (node.nodeName === "VIDEO") {
            stopProgressTracking(node);
          }
        }
      }
    } else if (node.children != undefined) {
      for (var i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        checkForVideo(child, child.parentNode || parent, added);
      }
    }
  }

  var observer = new MutationObserver(function (mutations) {
    // Process the DOM nodes lazily
    requestIdleCallback(
      (_) => {
        mutations.forEach(function (mutation) {
          switch (mutation.type) {
            case "childList":
              mutation.addedNodes.forEach(function (node) {
                if (typeof node === "function") return;
                checkForVideo(node, node.parentNode || mutation.target, true);
              });
              mutation.removedNodes.forEach(function (node) {
                if (typeof node === "function") return;
                checkForVideo(node, node.parentNode || mutation.target, false);
              });
              break;
            case "attributes":
              if (
                mutation.target.attributes["aria-hidden"] &&
                mutation.target.attributes["aria-hidden"].value == "false"
              ) {
                var flattenedNodes = getShadow(document.body);
                var node = flattenedNodes.filter(
                  (x) => x.tagName == "VIDEO"
                )[0];
                if (node) {
                  checkForVideo(node, node.parentNode || mutation.target, true);
                }
              }
              break;
          }
        });
      },
      { timeout: 1000 }
    );
  });
  observer.observe(document, {
    attributeFilter: ["aria-hidden"],
    childList: true,
    subtree: true
  });

  if (tc.settings.audioBoolean) {
    var mediaTags = document.querySelectorAll("video,audio");
  } else {
    var mediaTags = document.querySelectorAll("video");
  }

  mediaTags.forEach(function (video) {
    // Just add to mediaElements array, no controller needed
    if (!tc.mediaElements.includes(video)) {
      tc.mediaElements.push(video);
      
      // Start progress tracking for existing videos
      if (video.nodeName === "VIDEO") {
        if (video.readyState >= 1) {
          restoreVideoProgress(video);
          startProgressTracking(video);
        } else {
          video.addEventListener('loadedmetadata', function() {
            restoreVideoProgress(video);
            startProgressTracking(video);
          }, { once: true });
        }
      }
    }
  });

  var frameTags = document.getElementsByTagName("iframe");
  Array.prototype.forEach.call(frameTags, function (frame) {
    // Ignore frames we don't have permission to access (different origin).
    try {
      var childDocument = frame.contentDocument;
    } catch (e) {
      return;
    }
    initializeWhenReady(childDocument);
  });
  log("End initializeNow", 5);
}

function setSpeed(video, speed) {
  log("setSpeed started: " + speed, 5);
  var speedvalue = speed.toFixed(2);
  if (tc.settings.forceLastSavedSpeed) {
    video.dispatchEvent(
      new CustomEvent("ratechange", {
        detail: { origin: "videoSpeed", speed: speedvalue }
      })
    );
  } else {
    video.playbackRate = Number(speedvalue);
  }
  // No more speedIndicator - removed visual controller
  tc.settings.lastSpeed = speed;
  refreshCoolDown();
  log("setSpeed finished: " + speed, 5);
}

function runAction(action, value, e) {
  log("runAction Begin", 5);

  var mediaTags = tc.mediaElements;

  mediaTags.forEach(function (v) {
    const doc = v.ownerDocument || document;

    // Execute the action on each video
    if (action === "rewind") {
      log("Rewind", 5);
      const step = Number(value) || 0;
      const start = v.currentTime;
      const target = Math.max(0, start - step);
      v.currentTime = target;
      const actualChange = v.currentTime - start;
      // Show the intended step value instead of actual change
      showFeedback(doc, formatDelta(-step, "s"), "seek");
    } else if (action === "advance") {
      log("Fast forward", 5);
      const step = Number(value) || 0;
      const start = v.currentTime;
      const duration = Number.isFinite(v.duration) ? v.duration : Infinity;
      const target = Math.min(duration, Math.max(0, start + step));
      v.currentTime = target;
      const actualChange = v.currentTime - start;
      // Show the intended step value instead of actual change
      showFeedback(doc, formatDelta(step, "s"), "seek");
    } else if (action === "faster") {
      log("Increase speed", 5);
      // Maximum playback speed in Chrome is set to 16:
      // https://cs.chromium.org/chromium/src/third_party/blink/renderer/core/html/media/html_media_element.cc?gsn=kMinRate&l=166
      const step = Number(value) || 0;
      const initialRate = v.playbackRate;
      const nextRate = Math.min(
        (initialRate < 0.1 ? 0.0 : initialRate) + step,
        16
      );
      setSpeed(v, nextRate);
      const actualChange = v.playbackRate - initialRate;
      const message =
        actualChange === 0
          ? `${formatSpeed(v.playbackRate)}x`
          : `${formatDelta(actualChange, "x")} (${formatSpeed(v.playbackRate)}x)`;
      showFeedback(doc, message, "speed");
    } else if (action === "slower") {
      log("Decrease speed", 5);
      // Video min rate is 0.0625:
      // https://cs.chromium.org/chromium/src/third_party/blink/renderer/core/html/media/html_media_element.cc?gsn=kMinRate&l=165
      const step = Number(value) || 0;
      const initialRate = v.playbackRate;
      const nextRate = Math.max(initialRate - step, 0.07);
      setSpeed(v, nextRate);
      const actualChange = v.playbackRate - initialRate;
      const message =
        actualChange === 0
          ? `${formatSpeed(v.playbackRate)}x`
          : `${formatDelta(actualChange, "x")} (${formatSpeed(v.playbackRate)}x)`;
      showFeedback(doc, message, "speed");
    } else if (action === "reset") {
      log("Reset speed", 5);
      resetSpeed(v, 1.0);
    } else if (action === "pause") {
      pause(v);
    } else if (action === "muted") {
      muted(v);
    } else if (action === "mark") {
      setMark(v);
    } else if (action === "jump") {
      jumpToMark(v);
    }
  });
  log("runAction End", 5);
}

function pause(v) {
  if (v.paused) {
    log("Resuming video", 5);
    v.play();
  } else {
    log("Pausing video", 5);
    v.pause();
  }
}

function resetSpeed(v, target) {
  if (v.playbackRate === target) {
    if (v.playbackRate === getKeyBindings("reset")) {
      if (target !== 1.0) {
        log("Resetting playback speed to 1.0", 4);
        setSpeed(v, 1.0);
      } else {
        log('Toggling playback speed to "fast" speed', 4);
        setSpeed(v, getKeyBindings("fast"));
      }
    } else {
      log('Toggling playback speed to "reset" speed', 4);
      setSpeed(v, getKeyBindings("reset"));
    }
  } else {
    log('Toggling playback speed to "reset" speed', 4);
    setKeyBindings("reset", v.playbackRate);
    setSpeed(v, target);
  }
}

function muted(v) {
  v.muted = v.muted !== true;
}

// Store video marks in a simple object
var videoMarks = {};

// Video progress tracking
var videoProgress = {};
var progressSaveInterval = 5000; // Save every 5 seconds
var progressTimers = new WeakMap();

function getVideoId(video) {
  // Use the video URL as unique identifier
  const src = video.currentSrc || video.src;
  if (src) {
    // Extract entry ID from URL if available
    const entryMatch = src.match(/entryId\/([^\/]+)/);
    if (entryMatch) {
      return entryMatch[1];
    }
    // Fallback to full URL
    return src;
  }
  return null;
}

function saveVideoProgress(video) {
  const videoId = getVideoId(video);
  if (!videoId || !video.duration || video.duration < 30) {
    return; // Don't save for very short videos
  }

  const currentTime = video.currentTime;
  const duration = video.duration;
  const progress = currentTime / duration;

  // Only save if we're not at the very beginning or very end
  if (currentTime > 10 && progress < 0.95) {
    const progressData = {
      currentTime: currentTime,
      duration: duration,
      timestamp: Date.now(),
      url: window.location.href
    };

    // Save to memory
    videoProgress[videoId] = progressData;

    // Save to storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const storageKey = `video_progress_${videoId}`;
      chrome.storage.local.set({
        [storageKey]: progressData
      }, function() {
        if (chrome.runtime.lastError) {
          log(`Error saving progress: ${chrome.runtime.lastError.message}`, 3);
        } else {
          log(`Progress saved for video ${videoId}: ${Math.round(currentTime)}s`, 4);
        }
      });
    }
  }
}

function restoreVideoProgress(video) {
  const videoId = getVideoId(video);
  if (!videoId || typeof chrome === 'undefined' || !chrome.storage) return;

  const storageKey = `video_progress_${videoId}`;
  chrome.storage.local.get([storageKey], function(result) {
    if (chrome.runtime.lastError) {
      log(`Error loading progress: ${chrome.runtime.lastError.message}`, 3);
      return;
    }

    const progressData = result && result[storageKey];
    if (progressData) {
      const now = Date.now();
      const monthInMs = 30 * 24 * 60 * 60 * 1000; // 30 giorni
      
      // Check if data is older than 1 month
      if (now - progressData.timestamp > monthInMs) {
        // Remove old data
        chrome.storage.local.remove([storageKey]);
        log(`Old progress data removed for video ${videoId}`, 4);
        return;
      }
      
      // Restore progress automatically (only if more than 30 seconds from start)
      if (progressData.currentTime > 30) {
        video.currentTime = progressData.currentTime;
        log(`Progress restored for video ${videoId}: ${Math.round(progressData.currentTime)}s`, 4);
        
        const doc = video.ownerDocument || document;
        const minutes = Math.floor(progressData.currentTime / 60);
        const seconds = Math.floor(progressData.currentTime % 60);
        showFeedback(doc, `Ripreso da ${minutes}:${seconds.toString().padStart(2, '0')}`, 'default');
      }
    }
  });
}

function startProgressTracking(video) {
  // Clear any existing timer
  const existingTimer = progressTimers.get(video);
  if (existingTimer) {
    clearInterval(existingTimer);
  }

  // Start new timer
  const timer = setInterval(() => {
    if (!video.paused && !video.ended) {
      saveVideoProgress(video);
    }
  }, progressSaveInterval);

  progressTimers.set(video, timer);

  // Also save on pause and before unload
  video.addEventListener('pause', () => saveVideoProgress(video));
  video.addEventListener('ended', () => {
    // Clear progress when video ends
    const videoId = getVideoId(video);
    if (videoId) {
      const storageKey = `video_progress_${videoId}`;
      chrome.storage.local.remove([storageKey]);
      log(`Progress cleared for completed video ${videoId}`, 4);
    }
  });
}

function stopProgressTracking(video) {
  const timer = progressTimers.get(video);
  if (timer) {
    clearInterval(timer);
    progressTimers.delete(video);
  }
}

function cleanOldProgressData() {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  
  chrome.storage.local.get(null, function(items) {
    if (chrome.runtime.lastError) {
      log(`Error cleaning progress data: ${chrome.runtime.lastError.message}`, 3);
      return;
    }

    const now = Date.now();
    const monthInMs = 30 * 24 * 60 * 60 * 1000; // 30 giorni
    const keysToRemove = [];
    
    for (const key in items) {
      if (key.startsWith('video_progress_')) {
        const data = items[key];
        if (data && data.timestamp && (now - data.timestamp > monthInMs)) {
          keysToRemove.push(key);
        }
      }
    }
    
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, function() {
        if (chrome.runtime.lastError) {
          log(`Error removing old progress data: ${chrome.runtime.lastError.message}`, 3);
        } else {
          log(`Cleaned ${keysToRemove.length} old progress entries`, 4);
        }
      });
    }
  });
}

function setMark(v) {
  log("Adding marker", 5);
  videoMarks[v.currentSrc] = v.currentTime;
}

function jumpToMark(v) {
  log("Recalling marker", 5);
  if (videoMarks[v.currentSrc] && typeof videoMarks[v.currentSrc] === "number") {
    v.currentTime = videoMarks[v.currentSrc];
  }
}

var timer = null;
function showController(controller) {
  log("Showing controller", 4);
  controller.classList.add("vcs-show");

  if (timer) clearTimeout(timer);

  timer = setTimeout(function () {
    controller.classList.remove("vcs-show");
    timer = false;
    log("Hiding controller", 5);
  }, 2000);
}

