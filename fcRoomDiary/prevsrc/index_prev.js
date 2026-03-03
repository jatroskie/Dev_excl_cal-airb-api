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

  // Get today's date - using hardcoded date for this example
  const TODAY = new Date('2025-03-14');
  const TODAY_ISO = TODAY.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  // Function to get date range from today
  function getDateRangeFromToday(days) {
    return {
      start: TODAY,
      end: new Date(TODAY.getTime() + days * 24 * 60 * 60 * 1000)
    };
  }

  let calendar;
  try {
    calendar = new Calendar(calendarEl, {
      schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
      plugins: [resourceTimelinePlugin],
      initialView: 'resourceTimelineMonth',
      height: '900px', // Set fixed height for 1080p display
      aspectRatio: 2.1, // Optimized for 1920x1080
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'resourceTimeline7Days,resourceTimeline14Days,resourceTimeline30Days,resourceTimeline60Days,resourceTimeline90Days,resourceTimelineMonth'
      },
      views: {
        resourceTimeline7Days: {
          type: 'resourceTimeline',
          duration: { days: 7 },
          buttonText: '7d', // Shortened for space
          // Dynamic date range from today
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
      resourceAreaWidth: '140px', // Fixed width to save space
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
        }
      },
      // Complete replacement of resource labels using resourceLabelContent
      // This gives us full control over label rendering and prevents duplicates
      resourceLabelContent: function(arg) {
        // Create a wrapper div for the label
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-room-label-wrapper';
        
        // Create the label with the room title
        const titleSpan = document.createElement('span');
        titleSpan.className = 'custom-room-label';
        titleSpan.textContent = arg.resource.title || `Room ${arg.resource.id}`;
        
        wrapper.appendChild(titleSpan);
        
        // Return the DOM nodes directly
        return { domNodes: [wrapper] };
      },
      eventDidMount: function(info) {
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
      }
    });

    calendar.render();
    pluginStatus.textContent = 'Resource Timeline initialized successfully!';
    pluginStatus.className = 'success';
    
    // Additional fix: Set up a mutation observer to detect and fix any duplicate labels
    // This serves as a backup in case the resourceLabelContent approach isn't enough
    setupResourceLabelObserver();

    // Load preprocessed data
    fetch('calendar-data.json')
      .then(response => response.json())
      .then(data => {
        console.log('Loaded resources:', data.resources);
        calendar.setOption('resources', data.resources);
        calendar.setOption('events', data.events);
        calendar.refetchResources();
        calendar.refetchEvents();
        
        // Trigger today button click to set initial position
        setTimeout(() => {
          document.querySelector('.fc-today-button').click();
        }, 500);
        
        showStatus(`Updated with ${data.resources.length} rooms and ${data.events.length} reservations.`, 'success');
      })
      .catch(error => {
        console.error('Error loading calendar-data.json:', error);
        showStatus('Error loading reservation data. Check console.', 'error');
      });

    // Apply responsive CSS after calendar is rendered
    setTimeout(() => {
      applyResponsiveStyles();
    }, 600);

  } catch (error) {
    console.error('Error initializing Resource Timeline:', error);
    pluginStatus.textContent = 'Error: Resource Timeline initialization failed. Falling back to basic view.';
    pluginStatus.className = 'error';
    initializeBasicCalendar();
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

  function showTooltip(event, element) {
    const props = event.extendedProps;
    const resource = calendar.getResourceById(event._def.resourceIds[0]);
    const roomId = resource ? resource.id : 'Unknown';
    tooltip.innerHTML = `
      <h3>${event.title}</h3>
      <p><strong>Room:</strong> ${roomId}</p>
      <p><strong>Check-in:</strong> ${formatDisplayDate(event.start)}</p>
      <p><strong>Check-out:</strong> ${formatDisplayDate(event.end)}</p>
      <p><strong>Nights:</strong> ${props.nights || 'N/A'}</p>
      <p><strong>Status:</strong> ${props.status || 'N/A'}</p>
      ${props.rate ? `<p><strong>Rate:</strong> ${props.rate}</p>` : ''}
      <p><strong>Guests:</strong> ${props.adults || 0} Adults, ${props.children || 0} Children</p>
      ${props.source ? `<p><strong>Source:</strong> ${props.source}</p>` : ''}
      ${props.confirmationNumber ? `<p><strong>Confirmation:</strong> ${props.confirmationNumber}</p>` : ''}
    `;
    const rect = element.getBoundingClientRect();
    tooltip.style.display = 'block';
    tooltip.style.top = `${rect.bottom + window.scrollY + 10}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  function formatDisplayDate(date) {
    if (!date) return 'N/A';
    return date instanceof Date ? date.toLocaleDateString() : new Date(date).toLocaleDateString();
  }

  function showStatus(message, type) {
    if (statusMessage) {
      statusMessage.textContent = message;
      statusMessage.className = type || 'info';
    } else {
      console.warn('status-message element not found.');
    }
  }
  
  // Utility function to monitor and fix duplicate room labels
  function setupResourceLabelObserver() {
    // Create a mutation observer to monitor changes to the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Look for resource cells that might have been modified
          const resourceCells = document.querySelectorAll('.fc-resource-cell');
          
          resourceCells.forEach(cell => {
            // Find all label elements in this cell
            const labels = cell.querySelectorAll('.custom-room-label, .custom-room-label-wrapper');
            
            // If there's more than one label, remove all but the first one
            if (labels.length > 1) {
              for (let i = 1; i < labels.length; i++) {
                if (labels[i]) {
                  labels[i].remove();
                }
              }
              console.log(`Fixed duplicate label in resource cell`);
            }
          });
        }
      });
    });
    
    // Start monitoring the calendar for changes
    observer.observe(document.getElementById('calendar'), {
      childList: true,
      subtree: true
    });
    
    console.log('Resource label observer set up');
  }

  // Additional function to apply responsive styles for 1920x1080
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
      resourceArea.style.width = '140px';
      resourceArea.style.minWidth = '140px';
      resourceArea.style.maxWidth = '140px';
    }
  }
});