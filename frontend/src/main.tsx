import "./fonts.css";
import React from "react";
import ReactDOM from "react-dom/client";
import ResearchDemo from "./research/ResearchDemo";
import Landing from "./landing/Landing";
import "./index.css";

// Minimal path routing (no router dependency):  /  → landing,  /dashboard → research demo
const path = window.location.pathname.replace(/\/+$/, "");
const Page = path === "/dashboard" ? ResearchDemo : Landing;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);
