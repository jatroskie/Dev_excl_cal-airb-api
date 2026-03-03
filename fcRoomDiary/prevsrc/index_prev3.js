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
        }
      },
      // Improved resourceLabelContent with consistent styling
      resourceLabelContent: function(arg) {
        // Create a wrapper div for the label
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-room-label-wrapper';
        
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
          wrapper.appendChild(titleSpan);
        }
        
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
    window.calendar = calendar; // Make calendar accessible globally
    
    pluginStatus.textContent = 'Resource Timeline initialized successfully!';
    pluginStatus.className = 'success';
    
    // Additional fix: Set up a mutation observer to detect and fix any duplicate labels
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

  // Enhanced tooltip with additional styling
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

  // Add improved CSS styles for consistent appearance
  function addImprovedStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Consistent font sizes for room labels, linked or not */
      .custom-room-label-wrapper {
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
      }

      .custom-room-label,
      .custom-room-link {
        font-size: 13px;
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: normal;
        text-decoration: none;
      }

      /* Improve link appearance */
      .custom-room-link {
        color: #2c5282;
        position: relative;
        padding-right: 14px;  /* Space for the icon */
      }

      .custom-room-link:hover {
        color: #1a365d;
        text-decoration: underline;
      }

      /* Make the link icon smaller and position it to the right */
      .link-icon {
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        font-size: 10px !important;
        opacity: 0.7;
      }

      .custom-room-link:hover .link-icon {
        opacity: 1;
      }

      /* General calendar improvements */
      .fc-timeline-event {
        border-radius: 3px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }

      /* Add striped background for alternating rows */
      .fc-resource:nth-child(even) {
        background-color: #f8f9fa;
      }

      /* Highlight today's column more prominently */
      .today-column {
        background-color: rgba(255, 250, 230, 0.5) !important;
        border-left: 1px solid #e2c180 !important;
        border-right: 1px solid #e2c180 !important;
      }

      /* Make the header more distinct */
      .fc-resource-area-header {
        background-color: #2c5282;
        color: white;
        font-weight: bold;
      }

      /* Nicer tooltip styling */
      #reservation-tooltip {
        border-radius: 4px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        background-color: white;
        padding: 10px;
        max-width: 300px;
        z-index: 1000;
      }

      #reservation-tooltip h3 {
        margin-top: 0;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 5px;
      }

      /* Make toolbar buttons more attractive */
      .fc-button-primary {
        background-color: #4299e1 !important;
        border-color: #3182ce !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        transition: all 0.2s;
      }

      .fc-button-primary:hover {
        background-color: #3182ce !important;
        border-color: #2b6cb0 !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .fc-button-active {
        background-color: #2b6cb0 !important;
        border-color: #2c5282 !important;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.1) !important;
      }
    `;
    document.head.appendChild(style);
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
      resourceArea.style.width = '150px';
      resourceArea.style.minWidth = '150px';
      resourceArea.style.maxWidth = '150px';
    }
  }
});