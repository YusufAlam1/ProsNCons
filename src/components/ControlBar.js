import React from "react";

function ControlBar({ onClearAll, onExport }) {
  return (
    <div className="control-bar">
      <button 
        className="control-btn clear-btn"
        onClick={onClearAll}
        title="Clear all pros and cons"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3,6 5,6 21,6"></polyline>
          <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        Clear All
      </button>
      
      <button 
        className="control-btn save-btn"
        onClick={onExport}
        title="Export decision as JSON file"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7,10 12,15 17,10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Export
      </button>
      
      <button 
        className="control-btn sort-btn"
        onClick={() => {
          // Future functionality for sorting by weight
          console.log('Sort functionality coming soon!');
        }}
        title="Sort items by weight (coming soon)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 16 4 4 4-4"></path>
          <path d="M7 20V4"></path>
          <path d="m21 8-4-4-4 4"></path>
          <path d="M17 4v16"></path>
        </svg>
        Sort
      </button>
      
      <button 
        className="control-btn undo-btn"
        onClick={() => {
          // Future functionality for undo
          console.log('Undo functionality coming soon!');
        }}
        title="Undo last action (coming soon)"
        disabled
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7v6h6"></path>
          <path d="m21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
        </svg>
        Undo
      </button>
    </div>
  );
}

export default ControlBar;