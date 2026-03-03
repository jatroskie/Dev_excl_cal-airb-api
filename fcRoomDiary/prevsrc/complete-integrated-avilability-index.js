import { Calendar } from '@fullcalendar/core';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import Papa from 'papaparse';

/**
 * RoomAvailabilityTracker - Utility for tracking room availability based on calendar data
 */
class RoomAvailabilityTracker {
  constructor(calendarData) {
    this.resources = calendarData.resources || [];
    this.events = calendarData.events || [];
    this.availabilityMap = new Map(); // Will store room => date => boolean (available/unavailable)
    this.dateRangeCache = new Map(); // For quick retrieval of date ranges
    
    // Initialize the availability map
    this.initializeAvailabilityMap();
  }

  // Initialize availability with all rooms available for all dates
  initializeAvailabilityMap() {
    // Get the current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Generate dates for the next year (or any desired period)
    const dates = this.generateDateRange(
      today,
      new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
    );
    
    // Initialize all rooms as available for all dates
    this.resources.forEach(resource => {
      const roomId = resource.id.trim();
      const roomMap = new Map();
      
      dates.forEach(date => {
        roomMap.set(date, true); // true = available
      });
      
      this.availabilityMap.set(roomId, roomMap);
    });
    
    // Update availability based on events
    this.updateAvailabilityFromEvents();
  }
  
  // Generate an array of date strings between start and end
  generateDateRange(startDate, endDate) {
    const key = `${startDate.toISOString()}_${endDate.toISOString()}`;
    
    // Check if this range is already cached
    if (this.dateRangeCache.has(key)) {
      return this.dateRangeCache.get(key);
    }
    
    const dates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate < endDate) {
      dates.push(this.formatDate(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Cache this range for future use
    this.dateRangeCache.set(key, dates);
    
    return dates;
  }
  
  // Format date to YYYY-MM-DD
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }
  
  // Parse date string from event
  parseDate(dateString) {
    return new Date(dateString);
  }
  
  // Update availability based on events
  updateAvailabilityFromEvents() {
    this.events.forEach(event => {
      // Skip cancelled events as they don't affect availability
      if (event.classNames && event.classNames.includes('reservation-cancelled')) {
        return;
      }
      
      const roomId = event.resourceId.trim();
      const startDate = this.parseDate(event.start);
      const endDate = this.parseDate(event.end);
      
      // Mark all dates in the range as unavailable
      const dateRange = this.generateDateRange(startDate, endDate);
      const roomMap = this.availabilityMap.get(roomId);
      
      if (roomMap) {
        dateRange.forEach(date => {
          roomMap.set(date, false); // false = unavailable
        });
      }
    });
  }
  
  // Check if a room is available for a specific date range
  isRoomAvailable(roomId, startDate, endDate) {
    roomId = roomId.trim();
    const roomMap = this.availabilityMap.get(roomId);
    
    if (!roomMap) {
      return false; // Room not found
    }
    
    // Convert dates to proper format if they are string dates
    if (typeof startDate === 'string') {
      startDate = new Date(startDate);
    }
    if (typeof endDate === 'string') {
      endDate = new Date(endDate);
    }
    
    const dateRange = this.generateDateRange(startDate, endDate);
    
    // All dates in the range must be available
    return dateRange.every(date => roomMap.get(date) === true);
  }
  
  // Get all available rooms for a specific date range
  getAvailableRooms(startDate, endDate) {
    const availableRooms = [];
    
    this.resources.forEach(resource => {
      const roomId = resource.id.trim();
      if (this.isRoomAvailable(roomId, startDate, endDate)) {
        availableRooms.push({
          id: roomId,
          title: resource.title,
          roomType: resource.extendedProps.roomType,
          url: resource.extendedProps.url
        });
      }
    });
    
    return availableRooms;
  }
  
  // Get availability summary for all rooms within a date range
  getAvailabilitySummary(startDate, endDate) {
    const summary = {};
    
    this.resources.forEach(resource => {
      const roomId = resource.id.trim();
      summary[roomId] = {
        room: resource.title,
        type: resource.extendedProps.roomType,
        available: this.isRoomAvailable(roomId, startDate, endDate)
      };
    });
    
    return summary;
  }
  
  // Find next available date for a specific room
  findNextAvailableDate(roomId, startDate, daysToCheck = 90) {
    roomId = roomId.trim();
    const roomMap = this.availabilityMap.get(roomId);
    
    if (!roomMap) {
      return null; // Room not found
    }
    
    const checkDate = new Date(startDate);
    for (let i = 0; i < daysToCheck; i++) {
      const dateString = this.formatDate(checkDate);
      if (roomMap.get(dateString) === true) {
        return dateString;
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }
    
    return null; // No availability found within the period
  }
  
  // Find all available date ranges for a specific room within a period
  findAvailableDateRanges(roomId, startDate, endDate) {
    roomId = roomId.trim();
    const roomMap = this.availabilityMap.get(roomId);
    
    if (!roomMap) {
      return []; // Room not found
    }
    
    const dateRange = this.generateDateRange(
      new Date(startDate), 
      new Date(endDate)
    );
    
    const availableRanges = [];
    let currentRange = null;
    
    dateRange.forEach(date => {
      const isAvailable = roomMap.get(date) === true;
      
      if (isAvailable) {
        if (!currentRange) {
          currentRange = { start: date, end: date };
        } else {
          currentRange.end = date;
        }
      } else if (currentRange) {
        // Add one day to the end date since bookings end on checkout day
        const endDateObj = new Date(currentRange.end);
        endDateObj.setDate(endDateObj.getDate() + 1);
        currentRange.end = this.formatDate(endDateObj);
        
        availableRanges.push(currentRange);
        currentRange = null;
      }
    });
    
    // Handle last range if it extends to the end date
    if (currentRange) {
      // Add one day to the end date
      const endDateObj = new Date(currentRange.end);
      endDateObj.setDate(endDateObj.getDate() + 1);
      currentRange.end = this.formatDate(endDateObj);
      
      availableRanges.push(currentRange);
    }
    
    return availableRanges;
  }
  
  // Filter rooms by type and check availability
  findAvailableRoomsByType(roomType, startDate, endDate) {
    return this.getAvailableRooms(startDate, endDate)
      .filter(room => room.roomType === roomType);
  }
}

// Function to display availability results
function displayAvailabilityResults(availableRooms, checkInDate, checkOutDate) {
  const resultsContainer = document.getElementById('availability-results');
  if (!resultsContainer) return;
  
  // Format dates for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };
  
  // Clear previous results
  resultsContainer.innerHTML = '';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'results-header';
  header.innerHTML = `
    <h4>Availability Results</h4>
    <p>For ${formatDate(checkInDate)} to ${formatDate(checkOutDate)}</p>
    <p class="results-count">${availableRooms.length} room${availableRooms.length !== 1 ? 's' : ''} available</p>
  `;
  resultsContainer.appendChild(header);
  
  if (availableRooms.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'no-results';
    noResults.textContent = 'No rooms available for the selected dates.';
    resultsContainer.appendChild(noResults);
    return;
  }
  
  // Group rooms by type
  const roomsByType = {};
  availableRooms.forEach(room => {
    if (!roomsByType[room.roomType]) {
      roomsByType[room.roomType] = [];
    }
    roomsByType[room.roomType].push(room);
  });
  
  // Create room type sections
  Object.keys(roomsByType).sort().forEach(type => {
    const typeSection = document.createElement('div');
    typeSection.className = 'room-type-section';
    
    const typeHeader = document.createElement('h5');
    typeHeader.className = 'type-header';
    typeHeader.textContent = type;
    typeSection.appendChild(typeHeader);
    
    const roomsList = document.createElement('ul');
    roomsList.className = 'rooms-list';
    
    roomsByType[type].forEach(room => {
      const roomItem = document.createElement('li');
      roomItem.className = 'room-item';
      
      // If room has URL, make it clickable
      if (room.url && room.url !== 'null') {
        roomItem.innerHTML = `
          <a href="${room.url.startsWith('http') ? room.url : `https://${room.url}`}" target="_blank">
            ${room.title} <span class="link-icon">🔗</span>
          </a>
        `;
      } else {
        roomItem.textContent = room.title;
      }
      
      // Add highlight action on hover
      roomItem.addEventListener('mouseover', function() {
        // Find the resource row for this room in the calendar
        const resourceRow = document.querySelector(`.fc-resource[data-resource-id="${room.id}"]`);
        if (resourceRow) {
          resourceRow.classList.add('highlight-resource');
        }
      });
      
      roomItem.addEventListener('mouseout', function() {
        // Remove highlight
        document.querySelectorAll('.highlight-resource').forEach(el => {
          el.classList.remove('highlight-resource');
        });
      });
      
      roomsList.appendChild(roomItem);
    });
    
    typeSection.appendChild(roomsList);
    resultsContainer.appendChild(typeSection);
  });
  
  // Add "Export to CSV" button
  const exportBtn = document.createElement('button');
  exportBtn.className = 'export-btn fc-button fc-button-primary';
  exportBtn.textContent = 'Export to CSV';
  exportBtn.addEventListener('click', function() {
    exportAvailabilityToCSV(availableRooms, checkInDate, checkOutDate);
  });
  
  resultsContainer.appendChild(exportBtn);
}

// Helper function to display availability message
function showAvailabilityResults(message, type) {
  const resultsContainer = document.getElementById('availability-results');
  if (!resultsContainer) return;
  
  resultsContainer.innerHTML = '';
  
  const messageEl = document.createElement('div');
  messageEl.className = `results-message ${type}`;
  messageEl.textContent = message;
  
  resultsContainer.appendChild(messageEl);
}

// Export availability results to CSV
function exportAvailabilityToCSV(rooms, checkInDate, checkOutDate) {
  // Create CSV content
  let csvContent = 'Room ID,Room Name,Room Type,URL\n';
  
  rooms.forEach(room => {
    const url = room.url || '';
    csvContent += `${room.id},${room.title},${room.roomType},"${url}"\n`;
  });
  
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  // Format dates for filename
  const formatDateForFile = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  link.setAttribute('href', url);
  link.setAttribute('download', `available-rooms-${formatDateForFile(checkInDate)}-to-${formatDateForFile(checkOutDate)}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Create UI elements for availability checking
function createAvailabilityUI(calendar) {
  // Create availability panel container
  const availabilityPanel = document.createElement('div');
  availabilityPanel.id = 'availability-panel';
  availabilityPanel.className = 'availability-panel';
  
  // Create panel header with style
  const panelHeader = document.createElement('div');
  panelHeader.className = 'panel-header';
  panelHeader.innerHTML = '<h3>Check Room Availability</h3>';
  
  // Create form elements
  const dateRangeContainer = document.createElement('div');
  dateRangeContainer.className = 'date-range-container';
  
  // Check-in date
  const checkInContainer = document.createElement('div');
  checkInContainer.className = 'date-input-container';
  checkInContainer.innerHTML = '<label for="check-in-date">Check-in:</label>';
  const checkInInput = document.createElement('input');
  checkInInput.type = 'date';
  checkInInput.id = 'check-in-date';
  checkInInput.name = 'check-in-date';
  // Set default to today
  const today = new Date();
  checkInInput.value = today.toISOString().split('T')[0];
  checkInContainer.appendChild(checkInInput);
  
  // Check-out date
  const checkOutContainer = document.createElement('div');
  checkOutContainer.className = 'date-input-container';
  checkOutContainer.innerHTML = '<label for="check-out-date">Check-out:</label>';
  const checkOutInput = document.createElement('input');
  checkOutInput.type = 'date';
  checkOutInput.id = 'check-out-date';
  checkOutInput.name = 'check-out-date';
  // Set default to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  checkOutInput.value = tomorrow.toISOString().split('T')[0];
  checkOutContainer.appendChild(checkOutInput);
  
  // Add filter options
  const filterContainer = document.createElement('div');
  filterContainer.className = 'filter-container';
  
  // Room type dropdown
  const roomTypeContainer = document.createElement('div');
  roomTypeContainer.className = 'filter-input-container';
  roomTypeContainer.innerHTML = '<label for="room-type">Room Type:</label>';
  const roomTypeSelect = document.createElement('select');
  roomTypeSelect.id = 'room-type';
  roomTypeSelect.name = 'room-type';
  
  // Add "All Types" option
  const allTypesOption = document.createElement('option');
  allTypesOption.value = '';
  allTypesOption.textContent = 'All Types';
  roomTypeSelect.appendChild(allTypesOption);
  
  // Collect room types from the resources
  const roomTypes = new Set();
  if (window.availabilityTracker) {
    window.availabilityTracker.resources.forEach(resource => {
      if (resource.extendedProps && resource.extendedProps.roomType) {
        roomTypes.add(resource.extendedProps.roomType);
      }
    });
    
    // Add room types to dropdown
    Array.from(roomTypes).sort().forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      roomTypeSelect.appendChild(option);
    });
  }
  
  roomTypeContainer.appendChild(roomTypeSelect);
  
  // Check availability button
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'button-container';
  const checkButton = document.createElement('button');
  checkButton.id = 'check-availability-btn';
  checkButton.className = 'fc-button fc-button-primary';
  checkButton.textContent = 'Check Availability';
  buttonContainer.appendChild(checkButton);
  
  // Results container
  const resultsContainer = document.createElement('div');
  resultsContainer.id = 'availability-results';
  resultsContainer.className = 'availability-results';
  
  // Append all elements to the panel
  dateRangeContainer.appendChild(checkInContainer);
  dateRangeContainer.appendChild(checkOutContainer);
  filterContainer.appendChild(roomTypeContainer);
  
  availabilityPanel.appendChild(panelHeader);
  availabilityPanel.appendChild(dateRangeContainer);
  availabilityPanel.appendChild(filterContainer);
  availabilityPanel.appendChild(buttonContainer);
  availabilityPanel.appendChild(resultsContainer);
  
  // Add the panel to the page, right after the calendar
  const calendarEl = document.getElementById('calendar');
  if (calendarEl && calendarEl.parentNode) {
    calendarEl.parentNode.insertBefore(availabilityPanel, calendarEl.nextSibling);
  }
  
  // Add event listener to the check button
  checkButton.addEventListener('click', function() {
    const checkInDate = new Date(document.getElementById('check-in-date').value);
    const checkOutDate = new Date(document.getElementById('check-out-date').value);
    const roomType = document.getElementById('room-type').value;
    
    // Validate dates
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      showAvailabilityResults('Please select valid check-in and check-out dates.', 'error');
      return;
    }
    
    if (checkInDate >= checkOutDate) {
      showAvailabilityResults('Check-out date must be after check-in date.', 'error');
      return;
    }
    
    // Get available rooms
    let availableRooms;
    if (roomType) {
      availableRooms = window.availabilityTracker.findAvailableRoomsByType(roomType, checkInDate, checkOutDate);
    } else {
      availableRooms = window.availabilityTracker.getAvailableRooms(checkInDate, checkOutDate);
    }
    
    // Display results
    displayAvailabilityResults(availableRooms, checkInDate, checkOutDate);
    
    // Scroll the calendar to the check-in date
    calendar.gotoDate(checkInDate);
  });
  
  // Add styles for the availability panel
  addAvailabilityStyles();
}

// Add styles for the availability panel
function addAvailabilityStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .availability-panel {
      margin: 20px 0;
      padding: 15px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      background-color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    .panel-header h3 {
      margin-top: 0;
      margin-bottom: 15px;
      color: #2c5282;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 10px;
    }
    
    .date-range-container, .filter-container {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-bottom: 15px;
    }
    
    .date-input-container, .filter-input-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 200px;
    }
    
    .date-input-container label, .filter-input-container label {
      margin-bottom: 5px;
      font-weight: 500;
      color: #4a5568;
    }
    
    .date-input-container input, .filter-input-container select {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .button-container {
      margin-bottom: 20px;
    }
    
    #check-availability-btn, .export-btn {
      padding: 8px 16px;
      background-color: #4299e1;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }
    
    #check-availability-btn:hover, .export-btn:hover {
      background-color: #3182ce;
    }
    
    .availability-results {
      margin-top: 20px;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
    }
    
    .results-header {
      margin-bottom: 15px;
    }
    
    .results-header h4 {
      margin: 0 0 5px 0;
      color: #2c5282;
    }
    
    .results-header p {
      margin: 0 0 5px 0;
      color: #4a5568;
    }
    
    .results-count {
      font-weight: bold;
      color: #2c5282;
    }
    
    .room-type-section {
      margin-bottom: 15px;
    }
    
    .type-header {
      margin: 0 0 5px 0;
      color: #2d3748;
      font-size: 16px;
    }
    
    .rooms-list {
      list-style-type: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
    }
    
    .room-item {
      padding: 8px 12px;
      background-color: #f7fafc;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    
    .room-item:hover {
      background-color: #edf2f7;
    }
    
    .room-item a {
      text-decoration: none;
      color: #3182ce;
      display: block;
      position: relative;
    }
    
    .room-item a:hover {
      text-decoration: underline;
    }
    
    .link-icon {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      font-size: 10px;
      opacity: 0.7;
    }
    
    .no-results {
      padding: 15px;
      background-color: #f7fafc;
      border-radius: 4px;
      color: #4a5568;
      text-align: center;
    }
    
    .results-message {
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    
    .results-message.error {
      background-color: #fed7d7;
      color: #c53030;
    }
    
    .results-message.success {
      background-color: #c6f6d5;
      color: #2f855a;
    }
    
    .highlight-resource {
      background-color: rgba(66, 153, 225, 0.2) !important;
    }
    
    .export-btn {
      margin-top: 15px;
      background-color: #38a169;
    }
    
    .export-btn:hover {
      background-color: #2f855a;
    }
    
    @media (max-width: 768px) {
      .date-input-container, .filter-input-container {
        min-width: 100%;
      }
      
      .rooms-list {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
    }
  `;
  document.head.appendChild(style);
}

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
      // Set compact row height - events will automatically cause expansion when needed
      resourcesInitiallyExpanded: false,
      resourceLabelDidMount: function(info) {
        // Make resource rows more compact
        info.el.closest('.fc-resource').style.height = 'auto';
        info.el.style.height = 'auto';
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
        
        // Apply compact row styles after rendering
        applyCompactRows();
      }