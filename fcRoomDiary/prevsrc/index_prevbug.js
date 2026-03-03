import { Calendar } from '@fullcalendar/core';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import Papa from 'papaparse';

document.addEventListener('DOMContentLoaded', function() {
  const pluginStatus = document.getElementById('plugin-status');
  const calendarEl = document.getElementById('calendar');
  const statusMessage = document.getElementById('status-message');
  const tooltip = document.getElementById('reservation-tooltip');

  if (!pluginStatus) {
    console.error('Element with ID "plugin-status" not found in the DOM.');
    return;
  }

  if (typeof Calendar === 'undefined') {
    pluginStatus.textContent = 'Error: FullCalendar core not loaded.';
    pluginStatus.className = 'error';
    return;
  }

  pluginStatus.textContent = 'Attempting to initialize Resource Timeline...';
  pluginStatus.className = 'info';

  // Get today's date
  const TODAY = new Date();
  const TODAY_ISO = TODAY.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  // Track available rooms and filter state
  let availableRooms = [];
  let showingAvailableOnly = false;
  let allResources = [];

  // Function to get date range from today
  function getDateRangeFromToday(days) {
    return {
      start: TODAY,
      end: new Date(TODAY.getTime() + days * 24 * 60 * 60 * 1000)
    };
  }

  // Add improved styles for the calendar
  addImprovedStyles();

  let calendar;
  try {
    calendar = new Calendar(calendarEl, {
      schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
      plugins: [resourceTimelinePlugin],
      initialView: 'resourceTimelineMonth',
      height: '900px', // Set fixed height for 1080p display
      aspectRatio: 2.1, // Optimized for 1920x1080
      headerToolbar: {
        // Place availableRooms button right after today button
        left: 'prev,next today availableRooms',
        center: 'title',
        right: 'resourceTimeline7Days,resourceTimeline14Days,resourceTimeline30Days,resourceTimeline60Days,resourceTimeline90Days,resourceTimelineMonth'
      },
      views: {
        resourceTimeline7Days: {
          type: 'resourceTimeline',
          duration: { days: 7 },
          buttonText: '7d', // Shortened for space
          visibleRange: function() {
            return getDateRangeFromToday(7);
          }
        },
        resourceTimeline14Days: {
          type: 'resourceTimeline',
          duration: { days: 14 },
          buttonText: '14d', // Shortened for space
          visibleRange: function() {
            return getDateRangeFromToday(14);
          }
        },
        resourceTimeline30Days: {
          type: 'resourceTimeline',
          duration: { days: 30 },
          buttonText: '30d', // Shortened for space
          visibleRange: function() {
            return getDateRangeFromToday(30);
          }
        },
        resourceTimeline60Days: {
          type: 'resourceTimeline',
          duration: { days: 60 },
          buttonText: '60d', // Shortened for space
          visibleRange: function() {
            return getDateRangeFromToday(60);
          }
        },
        resourceTimeline90Days: {
          type: 'resourceTimeline',
          duration: { days: 90 },
          buttonText: '90d', // Shortened for space
          visibleRange: function() {
            return getDateRangeFromToday(90);
          }
        },
        resourceTimelineMonth: {
          type: 'resourceTimeline',
          duration: { months: 1 },
          buttonText: 'Month'
        }
      },
      resources: [],
      events: [],
      resourceAreaWidth: '150px', // Slightly increased for better readability
      resourceAreaHeaderContent: 'Rooms',
      slotDuration: { days: 1 },
      initialDate: TODAY, // Start at today's date
      scrollTime: '00:00:00', // Start at beginning of day
      nowIndicator: true, // Show an indicator for current time
      buttonText: {
        today: 'Today'
      },
      customButtons: {
        today: {
          text: 'Today',
          click: function() {
            // Go to today's date
            calendar.gotoDate(TODAY);
            // Force FullCalendar to recalculate scroll position
            setTimeout(() => {
              const todayEl = document.querySelector(`.fc-col-header-cell[data-date="${TODAY_ISO}"]`);
              if (todayEl) {
                // Calculate the scroll position to make today the leftmost visible date
                const headerScroller = todayEl.closest('.fc-scroller');
                if (headerScroller) {
                  const scrollLeft = todayEl.offsetLeft;
                  headerScroller.scrollLeft = scrollLeft;
                  
                  // Sync the main body scroll position
                  const bodyScroller = document.querySelector('.fc-timeline-body .fc-scroller');
                  if (bodyScroller) {
                    bodyScroller.scrollLeft = scrollLeft;
                  }
                }
              }
            }, 100);
          }
        },
        availableRooms: {
          text: 'Available Rooms',
          click: toggleAvailableRoomsFilter
        }
      },
      // Rest of calendar initialization code...

      // Improved resourceLabelContent with consistent styling
      resourceLabelContent: function(arg) {
        // Create a wrapper div for the label
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-room-label-wrapper';
        wrapper.style.textAlign = 'left'; // Force left alignment
        wrapper.style.height = 'auto'; // Let content determine height
        wrapper.style.padding = '2px 5px'; // Reduced padding (top/bottom, left/right)
        
        // Get resource data
        const resource = arg.resource;
        const roomId = resource.id;
        const roomUrl = resource.extendedProps?.url;
        
        // Ensure consistent display for title
        const displayTitle = resource.title || `Room ${roomId}`;
        
        // Create the label element
        if (roomUrl && roomUrl !== 'tba' && roomUrl !== 'null') {
          // Create an anchor element for rooms with URLs
          const anchor = document.createElement('a');
          anchor.href = roomUrl.startsWith('http') ? roomUrl : `https://${roomUrl}`;
          anchor.target = '_blank'; // Open in new tab
          anchor.className = 'custom-room-link';
          anchor.textContent = displayTitle;
          anchor.style.textAlign = 'left'; // Force left alignment
          anchor.style.lineHeight = '1.2'; // Reduced line height
          
          // Add a small icon to indicate it's a link
          const icon = document.createElement('span');
          icon.className = 'link-icon';
          icon.innerHTML = '🔗'; // Link icon
          
          anchor.appendChild(icon);
          wrapper.appendChild(anchor);
        } else {
          // Create a regular span for rooms without URLs
          const titleSpan = document.createElement('span');
          titleSpan.className = 'custom-room-label';
          titleSpan.textContent = displayTitle;
          titleSpan.style.textAlign = 'left'; // Force left alignment
          titleSpan.style.lineHeight = '1.2'; // Reduced line height
          wrapper.appendChild(titleSpan);
        }
        
        return { domNodes: [wrapper] };
      },
      resourceLabelDidMount: function(info) {
        // Make resource rows more compact
        info.el.closest('.fc-resource').style.height = 'auto';
        info.el.style.height = 'auto';
        
        // If this room is available today, add an "available" class for highlighting
        const resourceId = info.resource.id;
        if (availableRooms.includes(resourceId)) {
          info.el.closest('.fc-resource').classList.add('room-available-today');
        }
      },
      eventDidMount: function(info) {
        // Adjust event rendering for more compact display
        info.el.style.margin = '1px 0'; // Reduced margins
        info.el.style.fontSize = '11px'; // Smaller font
        info.el.style.lineHeight = '1.1'; // Tighter line height
        
        // Set up tooltips
        info.el.addEventListener('mouseover', () => showTooltip(info.event, info.el));
        info.el.addEventListener('mouseout', hideTooltip);
      },
      // Improved date highlighting
      datesSet: function(info) {
        // Clear previous highlights
        document.querySelectorAll('.today-column').forEach(el => el.classList.remove('today-column'));

        // Get today's column and highlight it
        const todayCells = document.querySelectorAll(`.fc-col-header-cell[data-date="${TODAY_ISO}"]`);
        todayCells.forEach(headerCell => {
          headerCell.classList.add('today-column');
          
          // Get index of today's column
          const headerRow = headerCell.parentElement;
          if (!headerRow) return;
          
          const colIndex = Array.from(headerRow.children).indexOf(headerCell);
          if (colIndex === -1) return;
          
          // Apply highlighting to slots in this column
          document.querySelectorAll('.fc-timeline-slot-lane').forEach(slotRow => {
            const slots = slotRow.querySelectorAll('.fc-timeline-slot');
            if (slots.length > colIndex) {
              slots[colIndex].classList.add('today-column');
            }
          });
        });
        
        // Apply compact row styles and highlight available rooms after rendering
        applyCompactRows();
        highlightAvailableRooms();
      }
    });

    calendar.render();
    window.calendar = calendar; // Make calendar accessible globally
    
    pluginStatus.textContent = 'Resource Timeline initialized successfully!';
    pluginStatus.className = 'success';
    
    // Additional fix: Set up a mutation observer to detect and fix any duplicate labels
    setupResourceLabelObserver();

    // Apply left alignment and compact rows
    setTimeout(() => {
      forceLeftAlignment();
      applyCompactRows();
      
      // Ensure the Available Rooms button is positioned correctly
      positionAvailableRoomsButton();
    }, 500);

    // Load preprocessed data
    fetch('calendar-data.json')
      .then(response => response.json())
      .then(data => {
        console.log('Loaded resources:', data.resources);
        allResources = data.resources; // Store all resources
        calendar.setOption('resources', data.resources);
        calendar.setOption('events', data.events);
        
        // Determine which rooms are available today
        findAvailableRooms(data.resources, data.events);
        
        calendar.refetchResources();
        calendar.refetchEvents();
        
        // Trigger today button click to set initial position
        setTimeout(() => {
          document.querySelector('.fc-today-button').click();
          // Re-apply left alignment and compact rows after data loads
          forceLeftAlignment();
          applyCompactRows();
          
          // Highlight available rooms
          highlightAvailableRooms();
          
          // Update the availability button text
          updateAvailabilityButtonText();
        }, 500);
        
        showStatus(`Updated with ${data.resources.length} rooms and ${data.events.length} reservations. ${availableRooms.length} rooms available today.`, 'success');
      })
      .catch(error => {
        console.error('Error loading calendar-data.json:', error);
        showStatus('Error loading reservation data. Check console.', 'error');
      });

    // Apply responsive CSS after calendar is rendered
    setTimeout(() => {
      applyResponsiveStyles();
      // Re-apply left alignment and compact rows
      forceLeftAlignment();
      applyCompactRows();
    }, 600);

  } catch (error) {
    console.error('Error initializing Resource Timeline:', error);
    pluginStatus.textContent = 'Error: Resource Timeline initialization failed. Falling back to basic view.';
    pluginStatus.className = 'error';
    initializeBasicCalendar();
  }

  // Ensure the Available Rooms button is positioned next to the Today button
  function positionAvailableRoomsButton() {
    const availableButton = document.querySelector('.fc-availableRooms-button');
    const todayButton = document.querySelector('.fc-today-button');
    
    if (availableButton && todayButton) {
      // Apply similar styling as the Today button
      availableButton.style.marginLeft = '5px';
      availableButton.style.marginRight = '10px';
    }
  }

  // Find rooms available today (no reservations on today's date)
  function findAvailableRooms(resources, events) {
    // Reset the array
    availableRooms = [];
    
    // Get all room IDs
    const allRoomIds = resources.map(resource => resource.id);
    
    // Find rooms with events today
    const bookedRooms = new Set();
    
    const todayStartStr = TODAY_ISO + 'T00:00:00';
    const todayEndStr = TODAY_ISO + 'T23:59:59';
    
    events.forEach(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      const today = new Date(TODAY);
      
      // Check if event overlaps with today
      if (eventStart <= new Date(todayEndStr) && eventEnd >= new Date(todayStartStr)) {
        bookedRooms.add(event.resourceId);
      }
    });
    
    // Rooms not in the booked set are available
    availableRooms = allRoomIds.filter(roomId => !bookedRooms.has(roomId));
    
    console.log(`Found ${availableRooms.length} available rooms today`);
  }

  // Update the button text based on filter state
  function updateAvailabilityButtonText() {
    const button = document.querySelector('.fc-availableRooms-button');
    if (button) {
      button.textContent = showingAvailableOnly 
        ? `Show All Rooms (${availableRooms.length} Available)` 
        : `Available Rooms (${availableRooms.length})`;
      
      // Update button styling based on state
      if (showingAvailableOnly) {
        button.classList.add('fc-button-active');
      } else {
        button.classList.remove('fc-button-active');
      }
    }
  }

  // Toggle the available rooms filter
  function toggleAvailableRoomsFilter() {
    showingAvailableOnly = !showingAvailableOnly;
    
    if (showingAvailableOnly) {
      // Filter to show only available rooms
      const availableResources = allResources.filter(resource => 
        availableRooms.includes(resource.id)
      );
      calendar.setOption('resources', availableResources);
    } else {
      // Show all rooms
      calendar.setOption('resources', allResources);
    }
    
    // Update button text
    updateAvailabilityButtonText();
    
    // Refetch and highlight
    calendar.refetchResources();
    
    setTimeout(() => {
      highlightAvailableRooms();
      forceLeftAlignment();
      applyCompactRows();
    }, 100);
    
    // Show status message
    const message = showingAvailableOnly
      ? `Showing ${availableRooms.length} available rooms for today.`
      : `Showing all ${allResources.length} rooms. ${availableRooms.length} are available today.`;
    
    showStatus(message, 'info');
  }

  // Highlight rooms that are available today
  function highlightAvailableRooms() {
    // Remove existing highlights
    document.querySelectorAll('.room-available-today').forEach(el => {
      el.classList.remove('room-available-today');
    });
    
    // Add highlights to available rooms
    availableRooms.forEach(roomId => {
      const roomElements = document.querySelectorAll(`.fc-resource[data-resource-id="${roomId}"]`);
      roomElements.forEach(el => {
        el.classList.add('room-available-today');
      });
    });
  }

  // Other helper functions remain the same...
  
  // Add improved CSS styles for consistent appearance
  function addImprovedStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Other styles remain the same... */
      
      /* Ensure the Available Rooms button is styled properly */
      .fc-availableRooms-button {
        margin-left: 5px !important;
        margin-right: 10px !important;
      }
      
      /* Available Rooms button - special styling when active */
      .fc-availableRooms-button.fc-button-active {
        background-color: #38a169 !important; /* Green */
        border-color: #2f855a !important;
      }
      
      /* Available Rooms highlighting */
      .room-available-today {
        background-color: #e6ffed !important; /* Light green background */
      }
      
      /* When showing only available rooms, make the highlight more subtle */
      .fc-availableRooms-button.fc-button-active ~ .fc-view .room-available-today {
        background-color: #f8f9fa !important; /* Default alternating color */
      }
    `;
    document.head.appendChild(style);
  }

  function applyResponsiveStyles() {
    // Force toolbar to be more compact
    const toolbarRight = document.querySelector('.fc-toolbar .fc-right');
    if (toolbarRight) {
      toolbarRight.style.display = 'flex';
      toolbarRight.style.gap = '2px';
      
      // Make buttons more compact
      const buttons = toolbarRight.querySelectorAll('button');
      buttons.forEach(button => {
        button.style.padding = '4px 8px';
        button.style.fontSize = '12px';
      });
    }
    
    // Ensure the resource area width is fixed
    const resourceArea = document.querySelector('.fc-resource-area');
    if (resourceArea) {
      resourceArea.style.width = '150px';
      resourceArea.style.minWidth = '150px';
      resourceArea.style.maxWidth = '150px';
    }
    
    // Reapply positioning for the Available Rooms button
    positionAvailableRoomsButton();
  }

  function initializeBasicCalendar() {
    try {
      calendar = new Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listMonth'
        },
        events: [],
        initialDate: TODAY,
        eventDidMount: function(info) {
          info.el.addEventListener('mouseover', () => showTooltip(info.event, info.el));
          info.el.addEventListener('mouseout', hideTooltip);
        }
      });
      calendar.render();
      showStatus('Basic calendar initialized. Resource timeline not available.', 'warning');
    } catch (error) {
      console.error('Error initializing basic calendar:', error);
      showStatus('Error initializing calendar. Check console.', 'error');
    }
  }


  function applyCompactRows() {
    // Make resource rows more compact
    document.querySelectorAll('.fc-resource').forEach(row => {
      row.style.height = 'auto';
      row.style.minHeight = '20px'; // Minimum height to prevent total collapse
    });

    // Make resource cells more compact
    document.querySelectorAll('.fc-resource-cell').forEach(cell => {
      cell.style.height = 'auto';
      cell.style.padding = '2px 5px'; // Reduced padding
    });

    // Adjust row lane heights
    document.querySelectorAll('.fc-timeline-lane').forEach(lane => {
      lane.style.minHeight = '20px'; // Set minimum height
      lane.style.height = 'auto'; // Let content dictate height
    });

    // Make event slots more compact
    document.querySelectorAll('.fc-timeline-slot').forEach(slot => {
      slot.style.height = 'auto';
    });

    // Compact event display
    document.querySelectorAll('.fc-timeline-event').forEach(event => {
      event.style.margin = '1px 0'; // Reduced margins
      event.style.padding = '1px 2px'; // Reduced padding
      event.style.fontSize = '11px'; // Smaller font
      event.style.lineHeight = '1.1'; // Tighter line height
    });
  }

});