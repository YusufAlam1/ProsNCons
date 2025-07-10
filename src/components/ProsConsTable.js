import React, { useState } from "react";
import "../styles/pill.css";
import ProConItem from "./ProConItem";

function ProsConsTable() {
  const [pros, setPros] = useState([]);
  const [cons, setCons] = useState([]);
  const [newPro, setNewPro] = useState("");
  const [newProWeight, setNewProWeight] = useState(1);
  const [newCon, setNewCon] = useState("");
  const [newConWeight, setNewConWeight] = useState(1);
  const [proError, setProError] = useState("");
  const [conError, setConError] = useState("");
  const [editingTextId, setEditingTextId] = useState(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const [editingType, setEditingType] = useState(null); // 'pro' or 'con'

  // Validation helpers
  const isValidWeight = (w) => Number.isInteger(Number(w)) && w >= 1 && w <= 10;
  const isValidText = (t) => t.trim().length > 0;

  const addPro = () => {
    if (!isValidText(newPro)) {
      setProError("Please enter a pro.");
      return;
    }
    if (!isValidWeight(Number(newProWeight))) {
      setProError("Weight must be 1-10.");
      return;
    }
    setPros([
      ...pros,
      { id: Date.now(), label: newPro, weight: Number(newProWeight) },
    ]);
    setNewPro("");
    setNewProWeight(1);
    setProError("");
  };

  const addCon = () => {
    if (!isValidText(newCon)) {
      setConError("Please enter a con.");
      return;
    }
    if (!isValidWeight(Number(newConWeight))) {
      setConError("Weight must be 1-10.");
      return;
    }
    setCons([
      ...cons,
      { id: Date.now(), label: newCon, weight: Number(newConWeight) },
    ]);
    setNewCon("");
    setNewConWeight(1);
    setConError("");
  };

  const deletePro = (id) => setPros(pros.filter((pro) => pro.id !== id));
  const deleteCon = (id) => setCons(cons.filter((con) => con.id !== id));
  const editProWeight = (id, newWeight) =>
    setPros(
      pros.map((pro) => (pro.id === id ? { ...pro, weight: newWeight } : pro))
    );
  const editConWeight = (id, newWeight) =>
    setCons(
      cons.map((con) => (con.id === id ? { ...con, weight: newWeight } : con))
    );

  // Edit text handlers
  const startEditText = (id, label, type) => {
    setEditingTextId(id);
    setEditingTextValue(label);
    setEditingType(type);
  };
  const handleEditTextChange = (e) => setEditingTextValue(e.target.value);
  const saveEditText = () => {
    if (!isValidText(editingTextValue)) return;
    if (editingType === "pro") {
      setPros(
        pros.map((pro) =>
          pro.id === editingTextId ? { ...pro, label: editingTextValue } : pro
        )
      );
    } else if (editingType === "con") {
      setCons(
        cons.map((con) =>
          con.id === editingTextId ? { ...con, label: editingTextValue } : con
        )
      );
    }
    setEditingTextId(null);
    setEditingTextValue("");
    setEditingType(null);
  };
  const cancelEditText = () => {
    setEditingTextId(null);
    setEditingTextValue("");
    setEditingType(null);
  };

  // Table rows: max of pros.length or cons.length
  const maxRows = Math.max(pros.length, cons.length);

  return (
    <div className="pros-cons-table" style={{ marginLeft: 0, maxWidth: 900 }}>
      <table
        style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                fontWeight: 700,
                fontSize: "1.3em",
                width: "45%",
              }}
            >
              Pros
            </th>
            <th style={{ width: 2, background: "#222", minWidth: 2 }}></th>
            <th
              style={{
                textAlign: "left",
                fontWeight: 700,
                fontSize: "1.3em",
                width: "45%",
              }}
            >
              Cons
            </th>
          </tr>
        </thead>
        <tbody>
          {[...Array(maxRows)].map((_, i) => (
            <tr key={i}>
              <td style={{ verticalAlign: "middle", width: "45%" }}>
                {pros[i] && (
                  <ProConItem
                    label={pros[i].label}
                    weight={pros[i].weight}
                    type="pro"
                    onEditWeight={(w) => editProWeight(pros[i].id, w)}
                    onDelete={() => deletePro(pros[i].id)}
                    onEditText={() =>
                      startEditText(pros[i].id, pros[i].label, "pro")
                    }
                    editingText={editingTextId === pros[i].id}
                    editingTextValue={editingTextValue}
                    onEditTextChange={handleEditTextChange}
                    onEditTextSave={saveEditText}
                    onEditTextCancel={cancelEditText}
                  />
                )}
              </td>
              <td style={{ background: "#222", minWidth: 2, width: 2 }}></td>
              <td style={{ verticalAlign: "middle", width: "45%" }}>
                {cons[i] && (
                  <ProConItem
                    label={cons[i].label}
                    weight={cons[i].weight}
                    type="con"
                    onEditWeight={(w) => editConWeight(cons[i].id, w)}
                    onDelete={() => deleteCon(cons[i].id)}
                    onEditText={() =>
                      startEditText(cons[i].id, cons[i].label, "con")
                    }
                    editingText={editingTextId === cons[i].id}
                    editingTextValue={editingTextValue}
                    onEditTextChange={handleEditTextChange}
                    onEditTextSave={saveEditText}
                    onEditTextCancel={cancelEditText}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            className="procon-input"
            placeholder="Add a pro..."
            value={newPro}
            onChange={(e) => setNewPro(e.target.value)}
            style={{ width: "60%" }}
          />
          <input
            type="number"
            className="procon-input"
            min={1}
            max={10}
            value={newProWeight}
            onChange={(e) => setNewProWeight(e.target.value)}
            style={{ width: 48, marginLeft: 8 }}
          />
          <button
            onClick={addPro}
            disabled={
              !isValidText(newPro) || !isValidWeight(Number(newProWeight))
            }
            style={{ marginLeft: 8 }}
          >
            Add
          </button>
          {proError && (
            <div style={{ color: "red", fontSize: "0.95em", marginTop: 4 }}>
              {proError}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            className="procon-input"
            placeholder="Add a con..."
            value={newCon}
            onChange={(e) => setNewCon(e.target.value)}
            style={{ width: "60%" }}
          />
          <input
            type="number"
            className="procon-input"
            min={1}
            max={10}
            value={newConWeight}
            onChange={(e) => setNewConWeight(e.target.value)}
            style={{ width: 48, marginLeft: 8 }}
          />
          <button
            onClick={addCon}
            disabled={
              !isValidText(newCon) || !isValidWeight(Number(newConWeight))
            }
            style={{ marginLeft: 8 }}
          >
            Add
          </button>
          {conError && (
            <div style={{ color: "red", fontSize: "0.95em", marginTop: 4 }}>
              {conError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProsConsTable;
