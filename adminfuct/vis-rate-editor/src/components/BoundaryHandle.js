// src/components/BoundaryHandle.js

import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import { addDays, format } from 'date-fns';

function BoundaryHandle({ leftSeason, rightSeason, onDragStop, pixelsPerDay }) {
  const nodeRef = useRef(null);
  const dateDisplayRef = useRef(null); // Ref for the date display

  // This function runs continuously while dragging
  const handleDrag = (e, data) => {
    // Update the date display's content and position in real-time
    const dateDisplay = dateDisplayRef.current;
    if (dateDisplay) {
      const originalBoundaryDate = rightSeason.startDate.toDate();
      const daysMoved = Math.round(data.x / pixelsPerDay);
      const newDate = addDays(originalBoundaryDate, daysMoved);
      
      dateDisplay.textContent = format(newDate, 'd');
      dateDisplay.style.display = 'block';
    }
  };

  // This function runs ONCE when the drag stops
  const handleStop = (e, data) => {
    // Hide the date display
    const dateDisplay = dateDisplayRef.current;
    if (dateDisplay) {
      dateDisplay.style.display = 'none';
    }

    // Calculate the final position and update the database
    const daysMoved = Math.round(data.x / pixelsPerDay);
    if (daysMoved !== 0) {
      onDragStop(leftSeason, rightSeason, daysMoved);
    }
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      axis="x"
      defaultPosition={{ x: 0, y: 0 }} // Let the library handle position internally
      onDrag={handleDrag}
      onStop={handleStop}
    >
      <div ref={nodeRef} className="boundary-handle" title="Drag to adjust boundary">
        {/* The date display is now simpler and controlled via a ref */}
        <div ref={dateDisplayRef} className="drag-date-display" style={{ display: 'none' }}></div>
      </div>
    </Draggable>
  );
}

export default BoundaryHandle;