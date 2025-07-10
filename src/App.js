import React from "react";
import "./styles/background.css";
import "./styles/layout.css";
import "./styles/typography.css";
import ControlBar from "./components/ControlBar";
import ProsConsTable from "./components/ProsConsTable";
import Scale from "./components/Scale";

function App() {
  return (
    <div className="notepad-bg">
      <div className="app-layout">
        <ProsConsTable />
        <Scale />
      </div>
      <ControlBar />
    </div>
  );
}

export default App;
