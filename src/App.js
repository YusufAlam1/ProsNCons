import React from "react";
import "./styles/index.css";
import Scale from "./components/Scale";

export default function App() {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#eef2fb" }}>
      <Scale style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }} />
    </div>
  );
}
