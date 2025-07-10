import React, { useState } from "react";

function ProsConsTable() {
  const [pros, setPros] = useState([
    // Example: { id: 1, label: 'Homework will be done', weight: 10 }
  ]);
  const [cons, setCons] = useState([
    // Example: { id: 1, label: 'Might not have enough time for gym', weight: 6 }
  ]);
  const [newPro, setNewPro] = useState("");
  const [newProWeight, setNewProWeight] = useState(1);
  const [newCon, setNewCon] = useState("");
  const [newConWeight, setNewConWeight] = useState(1);

  const addPro = () => {
    if (newPro.trim()) {
      setPros([
        ...pros,
        { id: Date.now(), label: newPro, weight: Number(newProWeight) },
      ]);
      setNewPro("");
      setNewProWeight(1);
    }
  };

  const addCon = () => {
    if (newCon.trim()) {
      setCons([
        ...cons,
        { id: Date.now(), label: newCon, weight: Number(newConWeight) },
      ]);
      setNewCon("");
      setNewConWeight(1);
    }
  };

  return (
    <div className="pros-cons-table">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ width: "48%" }}>
          <h2>Pros</h2>
          <ul>
            {pros.map((pro) => (
              <li key={pro.id}>
                {pro.label}{" "}
                <span style={{ fontWeight: "bold" }}>({pro.weight})</span>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              type="text"
              placeholder="Add a pro..."
              value={newPro}
              onChange={(e) => setNewPro(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={1}
              max={10}
              value={newProWeight}
              onChange={(e) => setNewProWeight(e.target.value)}
              style={{ width: 48 }}
            />
            <button onClick={addPro}>Add</button>
          </div>
        </div>
        <div style={{ width: "48%" }}>
          <h2>Cons</h2>
          <ul>
            {cons.map((con) => (
              <li key={con.id}>
                {con.label}{" "}
                <span style={{ fontWeight: "bold" }}>({con.weight})</span>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              type="text"
              placeholder="Add a con..."
              value={newCon}
              onChange={(e) => setNewCon(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={1}
              max={10}
              value={newConWeight}
              onChange={(e) => setNewConWeight(e.target.value)}
              style={{ width: 48 }}
            />
            <button onClick={addCon}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProsConsTable;
