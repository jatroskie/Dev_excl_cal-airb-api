// src/components/TimelineSkeleton.js

import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

function TimelineSkeleton() {
  return (
    <SkeletonTheme baseColor="#2d3748" highlightColor="#4a5568">
      <div className="timeline-grid">
        {/* Skeleton Header */}
        <div className="timeline-row header">
          <div className="timeline-label">
            <Skeleton width={80} />
          </div>
          <div className="timeline-container">
            <Skeleton height={40} style={{width: '100%'}} />
          </div>
        </div>
        
        {/* Render 5 ghost rows */}
        {[...Array(5)].map((_, i) => (
          <div className="timeline-row" key={i}>
            <div className="timeline-label">
              <Skeleton width={100} />
            </div>
            <div className="timeline-container">
              <Skeleton height={34} style={{width: '98%', borderRadius: '6px'}} />
            </div>
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}

export default TimelineSkeleton;