import React, { useState } from "react";
import "./styles/background.css";
import "./styles/layout.css";
import "./styles/typography.css";
import "./styles/proconitem.css";
import "./styles/scale.css";
import ControlBar from "./components/ControlBar";
import ProsConsTable from "./components/ProsConsTable";
import Scale from "./components/Scale";

function App() {
  const [prosData, setProsData] = useState([]);
  const [consData, setConsData] = useState([]);

  return (
    <div className="notepad-bg">
      <div className="app-layout">
        <ProsConsTable 
          prosData={prosData}
          setProsData={setProsData}
          consData={consData}
          setConsData={setConsData}
        />
        <Scale prosData={prosData} consData={consData} />
      </div>
      <ControlBar />
    </div>
  );
}

export default App;