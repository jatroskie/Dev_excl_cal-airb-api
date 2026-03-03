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

  let calendar;
  try {
    calendar = new Calendar(calendarEl, {
      schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
      plugins: [resourceTimelinePlugin],
      initialView: 'resourceTimelineMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'resourceTimeline7Days,resourceTimeline14Days,resourceTimeline30Days,resourceTimeline60Days,resourceTimeline90Days,resourceTimelineMonth,dayGridMonth'
      },
      views: {
        resourceTimeline7Days: {
          type: 'resourceTimeline',
          duration: { days: 7 },
          buttonText: '7 days',
          visibleRange: function() {
            const today = new Date('2025-03-14');
            return { start: today, end: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) };
          }
        },
        resourceTimeline14Days: {
          type: 'resourceTimeline',
          duration: { days: 14 },
          buttonText: '14 days',
          visibleRange: function() {
            const today = new Date('2025-03-14');
            return { start: today, end: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000) };
          }
        },
        resourceTimeline30Days: {
          type: 'resourceTimeline',
          duration: { days: 30 },
          buttonText: '30 days',
          visibleRange: function() {
            const today = new Date('2025-03-14');
            return { start: today, end: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) };
          }
        },
        resourceTimeline60Days: {
          type: 'resourceTimeline',
          duration: { days: 60 },
          buttonText: '60 days',
          visibleRange: function() {
            const today = new Date('2025-03-14');
            return { start: today, end: new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000) };
          }
        },
        resourceTimeline90Days: {
          type: 'resourceTimeline',
          duration: { days: 90 },
          buttonText: '90 days',
          visibleRange: function() {
            const today = new Date('2025-03-14');
            return { start: today, end: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000) };
          }
        },
        resourceTimelineMonth: {
          type: 'resourceTimeline',
          duration: { months: 1 },
          buttonText: 'month'
        }
      },
      resources: [],
      events: [],
      resourceAreaWidth: '150px',
      resourceAreaHeaderContent: 'Rooms',
      slotDuration: { days: 1 },
      initialDate: '2025-03-14', // Start at today’s date
      customButtons: {
        today: {
          text: 'today',
          click: function() {
            const today = new Date('2025-03-14');
            calendar.gotoDate(today); // Move to today
            calendar.scrollToTime({ days: 0 }); // Ensure today is leftmost
          }
        }
      },
      resourceLabelDidMount: function(info) {
        // Clear all existing content to prevent duplicates
        info.el.innerHTML = '';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'custom-room-label';
        titleSpan.textContent = info.resource.title || `Room ${info.resource.id}`;
        info.el.appendChild(titleSpan);
      },
      eventDidMount: function(info) {
        info.el.addEventListener('mouseover', () => showTooltip(info.event, info.el));
        info.el.addEventListener('mouseout', hideTooltip);
      },
      datesSet: function(info) {
        // Clear previous highlights
        document.querySelectorAll('.today-column').forEach(el => el.classList.remove('today-column'));

        // Highlight today’s column
        const today = new Date('2025-03-14').toISOString().split('T')[0]; // Format: YYYY-MM-DD
        const todayCells = document.querySelectorAll(`.fc-col-header-cell[data-date="${today}"]`);
        todayCells.forEach(headerCell => {
          headerCell.classList.add('today-column');
          const colIndex = Array.from(headerCell.parentElement.children).indexOf(headerCell);
          document.querySelectorAll('.fc-timeline-lane .fc-timeline-slot').forEach(slotRow => {
            const slot = slotRow.children[colIndex];
            if (slot) slot.classList.add('today-column');
          });
        });
      }
    });

    calendar.render();
    pluginStatus.textContent = 'Resource Timeline initialized successfully!';
    pluginStatus.className = 'success';

    // Load preprocessed data
    fetch('calendar-data.json')
      .then(response => response.json())
      .then(data => {
        console.log('Loaded resources:', data.resources);
        calendar.setOption('resources', data.resources);
        calendar.setOption('events', data.events);
        calendar.refetchResources();
        calendar.refetchEvents();
        showStatus(`Updated with ${data.resources.length} rooms and ${data.events.length} reservations.`, 'success');
      })
      .catch(error => {
        console.error('Error loading calendar-data.json:', error);
        showStatus('Error loading reservation data. Check console.', 'error');
      });

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
        initialDate: '2025-03-14',
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
});