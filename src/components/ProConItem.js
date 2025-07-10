import React, { useEffect, useRef, useState } from "react";
import "../styles/proconitem.css";

function ProConItem({
  label,
  weight,
  type,
  onEditWeight,
  onDelete,
  onEditText,
  editingText,
  editingTextValue,
  onEditTextChange,
  onEditTextSave,
  onEditTextCancel,
}) {
  // Color shades for weights 1-11 (for gradient end)
  const proShades = [
    "#d4f8e8",
    "#aaf0c6",
    "#7ee6a2",
    "#4ed97a",
    "#28c95a",
    "#20b34e",
    "#1a9c43",
    "#158638",
    "#106f2d",
    "#0b5923",
    "#06401a",
  ];
  const conShades = [
    "#ffd6d6",
    "#ffb3b3",
    "#ff8f8f",
    "#ff6a6a",
    "#ff4545",
    "#e63b3b",
    "#cc3232",
    "#b32929",
    "#991f1f",
    "#801616",
    "#4d0d0d",
  ];
  const shades = type === "pro" ? proShades : conShades;
  const leftColor = shades[weight - 1];
  const rightColor = shades[weight];

  const [editingWeight, setEditingWeight] = useState(false);
  const [editWeightValue, setEditWeightValue] = useState(weight);
  const inputRef = useRef(null);
  const textInputRef = useRef(null);

  useEffect(() => {
    if (editingText && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [editingText]);

  const handleEditWeight = () => setEditingWeight(true);
  const handleWeightChange = (e) => setEditWeightValue(e.target.value);
  const handleWeightBlur = () => {
    setEditingWeight(false);
    if (
      editWeightValue !== weight &&
      editWeightValue >= 1 &&
      editWeightValue <= 10
    ) {
      onEditWeight(Number(editWeightValue));
    } else {
      setEditWeightValue(weight);
    }
  };
  const handleWeightKeyDown = (e) => {
    if (e.key === "Enter") {
      handleWeightBlur();
    } else if (e.key === "Escape") {
      setEditWeightValue(weight);
      setEditingWeight(false);
    }
  };

  // Text editing handlers
  const handleTextKeyDown = (e) => {
    if (e.key === "Enter") {
      onEditTextSave();
    } else if (e.key === "Escape") {
      onEditTextCancel();
    }
  };

  return (
    <div
      className={"procon-row-pill"}
      style={{
        background: `linear-gradient(90deg, ${leftColor} 0%, ${rightColor} 100%)`,
        position: "relative",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        className="procon-label-area"
        style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}
      >
        {editingText ? (
          <input
            ref={textInputRef}
            type="text"
            className="procon-edit-text-input"
            value={editingTextValue}
            onChange={onEditTextChange}
            onBlur={onEditTextSave}
            onKeyDown={handleTextKeyDown}
            style={{ width: "100%" }}
          />
        ) : (
          <>
            <span className="procon-label-text">{label}</span>
            <button
              className="procon-edit-btn"
              onClick={onEditText}
              title="Edit text"
              tabIndex={0}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                stroke="#222"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.7 3.3a1 1 0 0 1 1.4 1.4l-9.4 9.4-2 0.6 0.6-2 9.4-9.4z" />
                <path d="M13.5 5.5l1 1" />
              </svg>
            </button>
          </>
        )}
      </div>
      <div
        className="procon-weight-area"
        style={{ display: "flex", alignItems: "center", gap: 10 }}
      >
        <span
          className="procon-weight-num"
          onClick={handleEditWeight}
          tabIndex={0}
          title="Edit weight"
        >
          {editingWeight ? (
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={10}
              value={editWeightValue}
              onChange={handleWeightChange}
              onBlur={handleWeightBlur}
              onKeyDown={handleWeightKeyDown}
              autoFocus
              className="procon-weight-input"
            />
          ) : (
            weight
          )}
        </span>
        <button
          className="procon-x-btn"
          onClick={onDelete}
          title="Delete"
          tabIndex={0}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="12" fill="#111" />
            <path d="M8 8l8 8M16 8l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ProConItem;
