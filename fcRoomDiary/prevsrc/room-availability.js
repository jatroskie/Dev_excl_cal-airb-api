/**
 * Room availability tracker
 */
class RoomAvailabilityTracker {
  constructor(calendarData) {
    this.resources = calendarData.resources || [];
    this.events = calendarData.events || [];
    this.availabilityMap = new Map();
    this.dateRangeCache = new Map();
    
    // Initialize the availability map
    this.initializeAvailabilityMap();
  }

  // Initialize availability with all rooms available for all dates
  initializeAvailabilityMap() {
    // Get the current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Generate dates for the next year
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
  
  // Find available rooms by type
  findAvailableRoomsByType(roomType, startDate, endDate) {
    return this.getAvailableRooms(startDate, endDate)
      .filter(room => room.roomType === roomType);
  }
}

// Create availability UI elements and attach to calendar
function createAvailabilityUI(calendar, availabilityTracker) {
  // Create UI elements for the availability panel
  const availabilityPanel = document.createElement('div');
  availabilityPanel.id = 'availability-panel';
  availabilityPanel.className = 'availability-panel';
  availabilityPanel.innerHTML = `
    <div class="panel-header">
      <h3>Check Room Availability</h3>
    </div>
    <div class="date-range-container">
      <div class="date-input-container">
        <label for="check-in-date">Check-in:</label>
        <input type="date" id="check-in-date" name="check-in-date">
      </div>
      <div class="date-input-container">
        <label for="check-out-date">Check-out:</label>
        <input type="date" id="check-out-date" name="check-out-date">
      </div>
    </div>
    <div class="filter-container">
      <div class="filter-input-container">
        <label for="room-type">Room Type:</label>
        <select id="room-type" name="room-type">
          <option value="">All Types</option>
        </select>
      </div>
    </div>
    <div class="button-container">
      <button id="check-availability-btn" class="fc-button fc-button-primary">Check Availability</button>
    </div>
    <div id="availability-results" class="availability-results"></div>
  `;
  
  // Add the panel to the page
  const calendarEl = document.getElementById('calendar');
  if (calendarEl && calendarEl.parentNode) {
    calendarEl.parentNode.insertBefore(availabilityPanel, calendarEl.nextSibling);
  }
  
  // Set default dates
  const today = new Date();
  document.getElementById('check-in-date').value = today.toISOString().split('T')[0];
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('check-out-date').value = tomorrow.toISOString().split('T')[0];
  
  // Populate room types
  const roomTypeSelect = document.getElementById('room-type');
  const roomTypes = new Set();
  
  availabilityTracker.resources.forEach(resource => {
    if (resource.extendedProps && resource.extendedProps.roomType) {
      roomTypes.add(resource.extendedProps.roomType);
    }
  });
  
  Array.from(roomTypes).sort().forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    roomTypeSelect.appendChild(option);
  });
  
  // Add event listener to check button
  document.getElementById('check-availability-btn').addEventListener('click', function() {
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
      availableRooms = availabilityTracker.findAvailableRoomsByType(roomType, checkInDate, checkOutDate);
    } else {
      availableRooms = availabilityTracker.getAvailableRooms(checkInDate, checkOutDate);
    }
    
    // Display results
    displayAvailabilityResults(availableRooms, checkInDate, checkOutDate, calendar);
  });
  
  // Add styles for the availability panel
  addAvailabilityStyles();
}

// Display the availability results
function displayAvailabilityResults(availableRooms, checkInDate, checkOutDate, calendar) {
  const resultsContainer = document.getElementById('availability-results');
  if (!resultsContainer) return;
  
  // Format dates
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
      
      // Add hover highlighting
      roomItem.addEventListener('mouseover', function() {
        const resourceRow = document.querySelector(`.fc-resource[data-resource-id="${room.id}"]`);
        if (resourceRow) {
          resourceRow.classList.add('highlight-resource');
        }
      });
      
      roomItem.addEventListener('mouseout', function() {
        document.querySelectorAll('.highlight-resource').forEach(el => {
          el.classList.remove('highlight-resource');
        });
      });
      
      roomsList.appendChild(roomItem);
    });
    
    typeSection.appendChild(roomsList);
    resultsContainer.appendChild(typeSection);
  });
  
  // Scroll calendar to check-in date if possible
  if (calendar && typeof calendar.gotoDate === 'function') {
    calendar.gotoDate(checkInDate);
  }
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

// Add styles for the availability panel
function addAvailabilityStyles() {
  const styleId = 'availability-styles';
  
  // Don't add styles if they already exist
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
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
    
    #check-availability-btn {
      padding: 8px 16px;
      background-color: #4299e1;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }
    
    #check-availability-btn:hover {
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
    
    .highlight-resource {
      background-color: rgba(66, 153, 225, 0.2) !important;
    }
  `;
  
  document.head.appendChild(style);
}

// Export the tracker and UI functions
export { RoomAvailabilityTracker, createAvailabilityUI };