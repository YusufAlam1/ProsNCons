import React, { useState } from "react";
import "../styles/proscons.css";
import ProConItem from "./ProConItem";

function ProsConsTable({ onProsChange, onConsChange }) {
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
  const [editingType, setEditingType] = useState(null);

  // Validation helpers
  const isValidWeight = (w) => Number.isInteger(Number(w)) && w >= 1 && w <= 10;
  const isValidText = (t) => t.trim().length > 0;

  // Calculate totals and notify parent
  const updatePros = (newPros) => {
    setPros(newPros);
    const total = newPros.reduce((sum, pro) => sum + pro.weight, 0);
    onProsChange?.(total, newPros.length);
  };

  const updateCons = (newCons) => {
    setCons(newCons);
    const total = newCons.reduce((sum, con) => sum + con.weight, 0);
    onConsChange?.(total, newCons.length);
  };

  const addPro = () => {
    if (!isValidText(newPro)) {
      setProError("Please enter a pro.");
      return;
    }
    if (!isValidWeight(Number(newProWeight))) {
      setProError("Weight must be 1-10.");
      return;
    }
    const newPros = [
      ...pros,
      { id: Date.now(), label: newPro, weight: Number(newProWeight) },
    ];
    updatePros(newPros);
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
    const newCons = [
      ...cons,
      { id: Date.now(), label: newCon, weight: Number(newConWeight) },
    ];
    updateCons(newCons);
    setNewCon("");
    setNewConWeight(1);
    setConError("");
  };

  const deletePro = (id) => {
    const newPros = pros.filter((pro) => pro.id !== id);
    updatePros(newPros);
  };

  const deleteCon = (id) => {
    const newCons = cons.filter((con) => con.id !== id);
    updateCons(newCons);
  };

  const editProWeight = (id, newWeight) => {
    const newPros = pros.map((pro) => 
      pro.id === id ? { ...pro, weight: newWeight } : pro
    );
    updatePros(newPros);
  };

  const editConWeight = (id, newWeight) => {
    const newCons = cons.map((con) => 
      con.id === id ? { ...con, weight: newWeight } : con
    );
    updateCons(newCons);
  };

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
      const newPros = pros.map((pro) =>
        pro.id === editingTextId ? { ...pro, label: editingTextValue } : pro
      );
      updatePros(newPros);
    } else if (editingType === "con") {
      const newCons = cons.map((con) =>
        con.id === editingTextId ? { ...con, label: editingTextValue } : con
      );
      updateCons(newCons);
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

  return (
    <div className="pros-cons-container">
      <div className="pros-cons-header">
        <div className="pros-header">
          <h2>Pros</h2>
        </div>
        <div className="header-divider"></div>
        <div className="cons-header">
          <h2>Cons</h2>
        </div>
      </div>

      <div className="pros-cons-content">
        <div className="pros-column">
          {pros.map((pro, index) => (
            <ProConItem
              key={pro.id}
              label={pro.label}
              weight={pro.weight}
              type="pro"
              onEditWeight={(w) => editProWeight(pro.id, w)}
              onDelete={() => deletePro(pro.id)}
              onEditText={() => startEditText(pro.id, pro.label, "pro")}
              editingText={editingTextId === pro.id}
              editingTextValue={editingTextValue}
              onEditTextChange={handleEditTextChange}
              onEditTextSave={saveEditText}
              onEditTextCancel={cancelEditText}
            />
          ))}
        </div>

        <div className="content-divider"></div>

        <div className="cons-column">
          {cons.map((con, index) => (
            <ProConItem
              key={con.id}
              label={con.label}
              weight={con.weight}
              type="con"
              onEditWeight={(w) => editConWeight(con.id, w)}
              onDelete={() => deleteCon(con.id)}
              onEditText={() => startEditText(con.id, con.label, "con")}
              editingText={editingTextId === con.id}
              editingTextValue={editingTextValue}
              onEditTextChange={handleEditTextChange}
              onEditTextSave={saveEditText}
              onEditTextCancel={cancelEditText}
            />
          ))}
        </div>
      </div>

      <div className="pros-cons-inputs">
        <div className="pro-input-section">
          <input
            type="text"
            className="procon-input"
            placeholder="Add a pro..."
            value={newPro}
            onChange={(e) => setNewPro(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPro()}
          />
          <input
            type="number"
            className="procon-input weight-input"
            min={1}
            max={10}
            value={newProWeight}
            onChange={(e) => setNewProWeight(e.target.value)}
          />
          <button
            className="add-button"
            onClick={addPro}
            disabled={!isValidText(newPro) || !isValidWeight(Number(newProWeight))}
          >
            Add
          </button>
          {proError && <div className="error-message">{proError}</div>}
        </div>

        <div className="input-divider"></div>

        <div className="con-input-section">
          <input
            type="text"
            className="procon-input"
            placeholder="Add a con..."
            value={newCon}
            onChange={(e) => setNewCon(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCon()}
          />
          <input
            type="number"
            className="procon-input weight-input"
            min={1}
            max={10}
            value={newConWeight}
            onChange={(e) => setNewConWeight(e.target.value)}
          />
          <button
            className="add-button"
            onClick={addCon}
            disabled={!isValidText(newCon) || !isValidWeight(Number(newConWeight))}
          >
            Add
          </button>
          {conError && <div className="error-message">{conError}</div>}
        </div>
      </div>
    </div>
  );
}

export default ProsConsTable;