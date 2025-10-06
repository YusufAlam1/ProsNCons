import React, { useEffect, useRef, useState } from "react";

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
  // Color shades for weights 1-10 (gradient colors)
  const proShades = [
    "#d4f8e8", "#aaf0c6", "#7ee6a2", "#4ed97a", "#28c95a",
    "#20b34e", "#1a9c43", "#158638", "#106f2d", "#0b5923"
  ];
  const conShades = [
    "#ffd6d6", "#ffb3b3", "#ff8f8f", "#ff6a6a", "#ff4545",
    "#e63b3b", "#cc3232", "#b32929", "#991f1f", "#801616"
  ];
  
  const shades = type === "pro" ? proShades : conShades;
  const leftColor = shades[Math.max(0, weight - 1)];
  const rightColor = shades[Math.min(shades.length - 1, weight)];

  const [editingWeight, setEditingWeight] = useState(false);
  const [editWeightValue, setEditWeightValue] = useState(weight);
  const inputRef = useRef(null);
  const textInputRef = useRef(null);

  useEffect(() => {
    if (editingText && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [editingText]);

  useEffect(() => {
    setEditWeightValue(weight);
  }, [weight]);

  const handleEditWeight = () => {
    setEditingWeight(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  
  const handleWeightChange = (e) => setEditWeightValue(e.target.value);
  
  const handleWeightBlur = () => {
    setEditingWeight(false);
    const newWeight = Number(editWeightValue);
    if (newWeight !== weight && newWeight >= 1 && newWeight <= 10) {
      onEditWeight(newWeight);
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

  const handleTextKeyDown = (e) => {
    if (e.key === "Enter") {
      onEditTextSave();
    } else if (e.key === "Escape") {
      onEditTextCancel();
    }
  };

  return (
    <div
      className="procon-row-pill"
      style={{
        background: `linear-gradient(90deg, ${leftColor} 0%, ${rightColor} 100%)`,
      }}
    >
      <div className="procon-label-area">
        {editingText ? (
          <input
            ref={textInputRef}
            type="text"
            className="procon-edit-text-input"
            value={editingTextValue}
            onChange={onEditTextChange}
            onBlur={onEditTextSave}
            onKeyDown={handleTextKeyDown}
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
      
      <div className="procon-weight-area">
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