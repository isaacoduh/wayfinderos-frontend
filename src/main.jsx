import React from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import "./styles.css";
import App from "./App.jsx";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <App />
      </ClerkProvider>
    ) : (
      <main className="app">
        <section className="access-screen" aria-label="Wayfinder OS auth configuration">
          <div className="access-card">
            <div className="brand-lockup" aria-label="Wayfinder OS">
              <span className="brand-mark" aria-hidden="true" />
              <div>
                <p className="brand-name">Wayfinder</p>
                <p className="brand-subtitle">OS</p>
              </div>
            </div>
            <p className="eyebrow">Auth configuration</p>
            <h1>Clerk is not configured.</h1>
            <p className="hero-copy">Set VITE_CLERK_PUBLISHABLE_KEY to run Wayfinder OS v0.8 locally.</p>
          </div>
        </section>
      </main>
    )}
  </React.StrictMode>,
);
