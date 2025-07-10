import React from "react";
import "./App.css";
import ControlBar from "./ControlBar";
import ProsConsTable from "./ProsConsTable";
import Scale from "./Scale";

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
