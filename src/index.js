import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

try {
  if (
    typeof window !== "undefined" &&
    window.navigator &&
    window.navigator.connection
  ) {
    const connection = window.navigator.connection;

    if (typeof connection.addEventListener !== "function") {
      Object.defineProperty(connection, "addEventListener", {
        value: () => {},
        configurable: true
      });
    }

    if (typeof connection.removeEventListener !== "function") {
      Object.defineProperty(connection, "removeEventListener", {
        value: () => {},
        configurable: true
      });
    }
  }
} catch (error) {
  console.warn("navigator.connection patch failed:", error);
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

reportWebVitals();