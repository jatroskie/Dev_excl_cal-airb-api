// CSV Processing Script for Hotel Reservation Calendar
// This script reads and processes the CSV files directly

document.addEventListener('DOMContentLoaded', function() {
  // Initialize variables
  let allReservations = [];
  let allRooms = [];
  let roomTypes = {};
  let calendar;
  
  // Function to parse date from DD.MM.YYYY format to YYYY-MM-DD
function parseDate(dateStr) { if (!dateStr) return null; try { const [day, month, year] = dateStr.split('.'); return `${year}-${month}-${day}`; } catch (error) { console.error('Date parsing error for:', dateStr, error); return null; } } // Process a single CSV file function processCSVFile(fileContent, roomNumber, fileName) { return new Promise((resolve, reject) => { try { console.log(`Processing file: ${fileName}`); Papa.parse(fileContent, { header: true, skipEmptyLines: true, dynamicTyping: true, error: function(error) { console.error("PapaParse error:", error, "in file", fileName); reject(error); }, complete: function(results) { console.log(`Successfully parsed ${fileName}, found ${results.data.length} rows`); const reservations = []; results.data.forEach((row, index) => { try { // Use the custom column mappings const roomValue = row['Room']; if (!roomValue) { console.warn(`Row ${index} missing Room value in ${fileName}`); return; } if (!row['Arrival'] || !row['Departure']) { console.warn(`Row ${index} missing date values in ${fileName}`, row); return; } // Save room type info const roomType = row['Room Type'] || ''; roomTypes[roomValue] = roomType; if (!allRooms.includes(roomValue)) { allRooms.push(roomValue); } const startDate = parseDate(row['Arrival']); const endDate = parseDate(row['Departure']); if (!startDate || !endDate) { console.warn(`Invalid date format for row ${index} in ${fileName}`, row['Arrival'], row['Departure']); return; } // Create reservation object reservations.push({ id: row['Confirmation Number'] || `res_${index}_${fileName}`, resourceId: roomValue.toString(), title: row['Name'] || 'Unnamed Reservation', start: startDate, end: endDate, nights: row['Nights'], status: row['Rate Code'], color: row['Display Color'], className: getReservationColor(row['Rate Code']), extendedProps: { roomType: roomType, rate: row['Rate'], adults: row['Adults'], children: row['Children'], company: row['Company'], source: row['Source'], status: row['Rate Code'] } }); } catch (rowError) { console.error(`Error processing row ${index} in ${fileName}:`, rowError, row); } }); console.log(`Created ${reservations.length} reservation objects from ${fileName}`); resolve(reservations); } }); } catch (error) { console.error(`Error in processCSVFile for ${fileName}:`, error); reject(error); } }); }
  
  // Function to get reservation color based on status
  function getReservationColor(status) {
    status = (status || '').toLowerCase();
    if (status.includes('in house')) {
      return 'reservation-inhouse';
    } else if (status.includes('guaranteed')) {
      return 'reservation-guaranteed';
    } else if (status.includes('non')) {
      return 'reservation-nonguarantee';
    } else if (status.includes('tentative')) {
      return 'reservation-tentative';
    } else if (status.includes('stay over')) {
      return 'reservation-stayover';
    }
    return 'reservation-guaranteed'; // Default
  }
  
  // Process a single CSV file
  function processCSVFile(fileContent, roomNumber) {
    return new Promise((resolve) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: function(results) {
          const reservations = [];
          
          results.data.forEach(row => {
            if (row.Room && row.Arrival && row.Departure) {
              // Save room type info
              if (row['Room Type']) {
                roomTypes[row.Room] = row['Room Type'];
                if (!allRooms.includes(row.Room)) {
                  allRooms.push(row.Room);
                }
              }
              
              // Create reservation object
              reservations.push({
                id: row['Confirmation Number'],
                resourceId: row.Room.toString(),
                title: row.Name || 'Unnamed Reservation',
                start: parseDate(row.Arrival),
                end: parseDate(row.Departure),
                nights: row.Nights,
                status: row['Reservation Type'],
                color: row['Display Color'],
                className: getReservationColor(row['Reservation Type']),
                extendedProps: {
                  roomType: row['Room Type'],
                  rate: row['Rate'],
                  adults: row['Adults'],
                  children: row['Children'],
                  company: row['Company'],
                  source: row['Source'],
                  status: row['Reservation Type']
                }
              });
            }
          });
          
          resolve(reservations);
        }
      });
    });
  }
  
  // Handle file uploads
  document.getElementById('csv-files').addEventListener('change', async function(e) {
    const files = e.target.files;
    
    if (files.length === 0) {
      alert('Please select at least one CSV file.');
      return;
    }
    
    // Show loading indicator
    document.getElementById('loading').style.display = 'flex';
    
    // Reset data
    allReservations = [];
    allRooms = [];
    roomTypes = {};
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Extract room number from filename if possible
      let roomNumber = null;
      const match = file.name.match(/(\d{4})_reservations\.csv/);
      if (match) {
        roomNumber = match[1];
      }
      
      // Read and process file
      const reader = new FileReader();
      
      reader.onload = async function(event) {
        const fileContent = event.target.result;
        const reservations = await processCSVFile(fileContent, roomNumber);
        allReservations = [...allReservations, ...reservations];
        
        // If all files have been processed, initialize the calendar
        if (i === files.length - 1) {
          initializeCalendar();
        }
      };
      
      reader.onerror = function() {
        console.error('Error reading file:', file.name);
      };
      
      reader.readAsText(file);
    }
  });
  
  // Function to create resource groups based on room types
  function createResourceGroups() {
    allRooms.sort((a, b) => a - b);
    
    const resources = allRooms.map(room => {
      const roomType = roomTypes[room] || '';
      return {
        id: room.toString(),
        title: `Room ${room}`,
        type: roomType,
        classNames: `room-${roomType.toLowerCase().replace(' ', '-')}`
      };
    });
    
    return resources;
  }
  
  // Initialize FullCalendar
  function initializeCalendar() {
    try {
      // Create resources
      const resources = createResourceGroups();
      
      // Initialize filter options
      populateFilterOptions(resources);
      
      // Calculate initial date to show (closest future month)
      let initialDate = new Date();
      
      // Check for March 2025 data
      if (allReservations.some(res => res.start && res.start.includes('2025-03'))) {
        initialDate = new Date('2025-03-01');
      }
      
      // Initialize calendar
      const calendarEl = document.getElementById('calendar');
      calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'resourceTimelineMonth',
        initialDate: initialDate,
        headerToolbar: false, // We use our custom header
        schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source', // For non-commercial use
        resources: resources,
        events: allReservations,
        resourceAreaWidth: '150px',
        height: 'auto',
        slotDuration: { days: 1 },
        slotLabelFormat: {
          day: 'numeric',
          weekday: 'short'
        },
        resourceAreaHeaderContent: 'Rooms',
        eventTimeFormat: {
          hour: 'numeric',
          minute: '2-digit',
          omitZeroMinute: true,
          meridiem: 'short'
        },
        eventClick: function(info) {
          showEventDetails(info.event, info.el);
        },
        datesSet: function(dateInfo) {
          document.getElementById('current-date').textContent = dateInfo.start.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
          });
        },
        resourceLabelDidMount: function(info) {
          // Add room type to the resource label
          const roomType = info.resource.extendedProps.type || '';
          info.el.innerHTML = `<div class="room-label">Room ${info.resource.id}<br><small>${roomType}</small></div>`;
        }
      });
      
      // Render the calendar
      calendar.render();
      
      // Hide loading indicator
      document.getElementById('loading').style.display = 'none';
      
      // Set up event handlers
      setupEventHandlers();
      
    } catch (error) {
      console.error('Error initializing calendar:', error);
      document.getElementById('loading').textContent = 'Error loading data. Please try again.';
    }
  }
  
  // Populate filter options
  function populateFilterOptions(resources) {
    // Room filter
    const roomFilter = document.getElementById('room-filter');
    roomFilter.innerHTML = '<option value="all">All Rooms</option>'; // Reset
    
    resources.forEach(resource => {
      const option = document.createElement('option');
      option.value = resource.id;
      option.textContent = `Room ${resource.id}`;
      roomFilter.appendChild(option);
    });
    
    // Room type filter
    const typeFilter = document.getElementById('type-filter');
    typeFilter.innerHTML = '<option value="all">All Types</option>'; // Reset
    
    const uniqueTypes = [...new Set(resources.map(resource => resource.type))];
    uniqueTypes.forEach(type => {
      if (type) {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
      }
    });
  }
  
  // Set up event handlers for buttons and filters
  function setupEventHandlers() {
    // Navigation buttons
    document.getElementById('prev-button').addEventListener('click', () => {
      calendar.prev();
    });
    
    document.getElementById('next-button').addEventListener('click', () => {
      calendar.next();
    });
    
    document.getElementById('today-button').addEventListener('click', () => {
      calendar.today();
    });
    
    // View selector
    document.getElementById('view-selector').addEventListener('change', (e) => {
      const days = parseInt(e.target.value);
      calendar.setOption('duration', { days: days });
      calendar.refetchEvents();
    });
    
    // Filter button
    document.getElementById('filter-button').addEventListener('click', applyFilters);
    
    // Reset button
    document.getElementById('reset-button').addEventListener('click', resetFilters);
    
    // Search input
    document.getElementById('search-input').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        applyFilters();
      }
    });
    
    // Close tooltip when clicking outside
    document.addEventListener('click', (e) => {
      const tooltip = document.getElementById('reservation-tooltip');
      if (!tooltip.contains(e.target) && e.target.className !== 'fc-event-title') {
        tooltip.style.display = 'none';
      }
    });
  }
  
  // Apply filters to the calendar
  function applyFilters() {
    const roomFilter = document.getElementById('room-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    const searchFilter = document.getElementById('search-input').value.toLowerCase();
    
    let filteredEvents = allReservations;
    
    // Apply room filter
    if (roomFilter !== 'all') {
      filteredEvents = filteredEvents.filter(event => event.resourceId === roomFilter);
    }
    
    // Apply room type filter
    if (typeFilter !== 'all') {
      filteredEvents = filteredEvents.filter(event => 
        event.extendedProps.roomType === typeFilter
      );
    }
    
    // Apply search filter
    if (searchFilter) {
      filteredEvents = filteredEvents.filter(event => 
        event.title.toLowerCase().includes(searchFilter)
      );
    }
    
    // Update calendar events
    calendar.setOption('events', filteredEvents);
    calendar.refetchEvents();
  }
  
  // Reset all filters
  function resetFilters() {
    document.getElementById('room-filter').value = 'all';
    document.getElementById('type-filter').value = 'all';
    document.getElementById('search-input').value = '';
    
    calendar.setOption('events', allReservations);
    calendar.refetchEvents();
  }
  
  // Show event details in tooltip
  function showEventDetails(event, element) {
    const tooltip = document.getElementById('reservation-tooltip');
    const rect = element.getBoundingClientRect();
    
    // Format dates
    const startDate = new Date(event.start);
    const endDate = event.end ? new Date(event.end) : null;
    
    const formattedStart = startDate.toLocaleDateString();
    const formattedEnd = endDate ? endDate.toLocaleDateString() : '';
    
    // Build tooltip content
    tooltip.innerHTML = `
      <h3>${event.title}</h3>
      <p><strong>Room:</strong> ${event.resourceId}</p>
      <p><strong>Room Type:</strong> ${event.extendedProps.roomType || 'N/A'}</p>
      <p><strong>Check-in:</strong> ${formattedStart}</p>
      <p><strong>Check-out:</strong> ${formattedEnd}</p>
      <p><strong>Nights:</strong> ${event.extendedProps.nights || 'N/A'}</p>
      <p><strong>Status:</strong> ${event.extendedProps.status || 'N/A'}</p>
      <p><strong>Rate:</strong> ${event.extendedProps.rate || 'N/A'}</p>
      <p><strong>Guests:</strong> ${event.extendedProps.adults || 0} Adults, ${event.extendedProps.children || 0} Children</p>
      <p><strong>Company:</strong> ${event.extendedProps.company || 'N/A'}</p>
      <p><strong>Source:</strong> ${event.extendedProps.source || 'N/A'}</p>
    `;
    
    // Position the tooltip
    tooltip.style.display = 'block';
    tooltip.style.top = `${rect.bottom + window.scrollY + 10}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;
  }
});
