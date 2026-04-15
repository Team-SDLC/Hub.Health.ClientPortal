import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

function ensureEventTargetLike(target) {
  if (!target || (typeof target !== "object" && typeof target !== "function")) {
    return;
  }

  if (typeof target.addEventListener !== "function") {
    Object.defineProperty(target, "addEventListener", {
      value: (eventName, listener) => {
        const handlerName = `on${eventName}`;

        if (typeof target.addListener === "function") {
          target.addListener(listener);
          return;
        }

        if (handlerName in target && typeof listener === "function") {
          target[handlerName] = listener;
        }
      },
      configurable: true
    });
  }

  if (typeof target.removeEventListener !== "function") {
    Object.defineProperty(target, "removeEventListener", {
      value: (eventName, listener) => {
        const handlerName = `on${eventName}`;

        if (typeof target.removeListener === "function") {
          target.removeListener(listener);
          return;
        }

        if (handlerName in target && target[handlerName] === listener) {
          target[handlerName] = null;
        }
      },
      configurable: true
    });
  }
}

function ensureConstructorInstancesAreEventTargetLike(name) {
  const Original = window[name];

  if (typeof Original !== "function") {
    return;
  }

  if (Original.__acsPatched) {
    return;
  }

  const Wrapped = function (...args) {
    const instance = new Original(...args);
    ensureEventTargetLike(instance);
    return instance;
  };

  Wrapped.prototype = Original.prototype;
  Object.setPrototypeOf(Wrapped, Original);
  Object.defineProperty(Wrapped, "__acsPatched", {
    value: true,
    configurable: true
  });

  window[name] = Wrapped;
  ensureEventTargetLike(Original.prototype);
}

try {
  if (typeof window !== "undefined" && window.navigator) {
    ensureEventTargetLike(window.navigator.connection);
    ensureEventTargetLike(window.navigator.mediaDevices);
    ensureEventTargetLike(window.screen?.orientation);
    ensureEventTargetLike(window.BroadcastChannel?.prototype);
    ensureEventTargetLike(window.AudioContext?.prototype);
    ensureEventTargetLike(window.webkitAudioContext?.prototype);

    ensureConstructorInstancesAreEventTargetLike("BroadcastChannel");
    ensureConstructorInstancesAreEventTargetLike("AudioContext");
    ensureConstructorInstancesAreEventTargetLike("webkitAudioContext");

    if (typeof window.navigator.getBattery === "function") {
      const originalGetBattery = window.navigator.getBattery.bind(window.navigator);

      window.navigator.getBattery = async (...args) => {
        const battery = await originalGetBattery(...args);
        ensureEventTargetLike(battery);
        return battery;
      };
    }

    if (window.navigator.wakeLock?.request) {
      const originalWakeLockRequest =
        window.navigator.wakeLock.request.bind(window.navigator.wakeLock);

      window.navigator.wakeLock.request = async (...args) => {
        const sentinel = await originalWakeLockRequest(...args);
        ensureEventTargetLike(sentinel);
        return sentinel;
      };
    }
  }
} catch (error) {
  console.warn("navigator API patch failed:", error);
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
