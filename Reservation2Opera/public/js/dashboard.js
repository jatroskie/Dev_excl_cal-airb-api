// dashboard.js - Main JavaScript file for the Property Reservations Dashboard

// Property groups data - matches the properties in your system
const PROPERTY_GROUPS = [
  {
    id: "waterfront",
    name: "Waterfront Village",
    properties: ["WFV"]
  },
  {
    id: "crystal",
    name: "The Crystal Apartments",
    properties: ["CRY"]
  },
  {
    id: "harbouredge",
    name: "Harbouredge Suites",
    properties: ["HES"]
  },
  {
    id: "lawhill",
    name: "Lawhill Apartments",
    properties: ["LAW"]
  },
  {
    id: "mouille",
    name: "Mouille Point Village",
    properties: ["MPA"]
  },
  {
    id: "barracks",
    name: "The Barracks",
    properties: ["TBA"]
  },
  {
    id: "quarter",
    name: "The Quarter Apartments",
    properties: ["TQA"]
  },
  {
    id: "trade",
    name: "The Trade Boutique Hotel",
    properties: ["TTBH"]
  }
];

// Sync frequency options
const SYNC_FREQUENCY_OPTIONS = [
  { label: 'Every 5 minutes', value: 5 },
  { label: 'Every 15 minutes', value: 15 },
  { label: 'Every 30 minutes', value: 30 },
  { label: 'Every hour', value: 60 },
  { label: 'Every 2 hours', value: 120 },
  { label: 'Off', value: 0 },
];

// Global variables
let properties = [];
let expandedProperties = {};
let selectedGroup = "all";

document.addEventListener('DOMContentLoaded', function() {
  // Initialize the dashboard
  initializeDashboard();
  
  // Load reservations on page load
  loadPropertiesAndReservations();
  
  // Set up event listeners
  document.getElementById('sync-button').addEventListener('click', triggerSyncAll);
  document.getElementById('filter-button').addEventListener('click', applyFilters);
  
  // Set up modal functionality
  setupModal();
});

// Initialize the dashboard UI
function initializeDashboard() {
  // Populate property group dropdown
  const propertySelect = document.getElementById('property-select');
  propertySelect.innerHTML = '<option value="all">All Properties</option>';
  
  PROPERTY_GROUPS.forEach(group => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name;
    propertySelect.appendChild(option);
  });
  
  // Set up event listener for group selection
  propertySelect.addEventListener('change', function() {
    selectedGroup = this.value;
    filterPropertiesByGroup();
  });
}

// Function to load properties and their reservations
function loadPropertiesAndReservations() {
  // Show loading indicator
  document.getElementById('dashboard-content').innerHTML = '<div class="loading">Loading properties and reservations...</div>';
  
  // Build query params for API call
  const params = buildQueryParams();
  
  // Fetch reservations from API
  fetch(`/api/reservations?${params.toString()}`)
    .then(response => response.json())
    .then(data => {
      // Transform the data to match our structure
      properties = transformReservationsData(data.reservations);
      
      // Render the properties
      renderPropertiesTable();
    })
    .catch(error => {
      console.error('Error loading reservations:', error);
      document.getElementById('dashboard-content').innerHTML = 
        '<div class="error">Failed to load reservations. Please try again later.</div>';
    });
}

// Build query parameters for API calls
function buildQueryParams() {
  const propertySelect = document.getElementById('property-select');
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  const guestInfoSelect = document.getElementById('guest-info-select');
  
  const params = new URLSearchParams();
  
  if (propertySelect.value !== 'all') {
    // Map the group ID to property codes
    const group = PROPERTY_GROUPS.find(g => g.id === propertySelect.value);
    if (group && group.properties.length) {
      params.append('property', group.properties[0]);
    }
  }
  
  if (dateFrom.value) {
    params.append('startDate', dateFrom.value);
  }
  
  if (dateTo.value) {
    params.append('endDate', dateTo.value);
  }
  
  if (guestInfoSelect.value === 'needed') {
    params.append('needsGuestInfo', 'true');
  } else if (guestInfoSelect.value === 'complete') {
    params.append('needsGuestInfo', 'false');
  }
  
  return params;
}

// Transform API data to our component structure
function transformReservationsData(apiReservations) {
  // Group reservations by property
  const reservationsByProperty = {};
  
  apiReservations.forEach(reservation => {
    const propertyId = reservation.propertyId;
    
    if (!reservationsByProperty[propertyId]) {
      reservationsByProperty[propertyId] = [];
    }
    
    // Find property group
    const propertyGroup = PROPERTY_GROUPS.find(group => 
      group.properties.includes(propertyId)
    );
    
    // Transform reservation to our structure
    reservationsByProperty[propertyId].push({
      id: reservation.id,
      property: propertyId,
      source: reservation.source.charAt(0).toUpperCase() + reservation.source.slice(1),
      checkIn: new Date(reservation.start).toLocaleDateString(),
      checkOut: new Date(reservation.end).toLocaleDateString(),
      guest: reservation.guestInfo?.fullName || 'Not available yet',
      contact: reservation.guestInfo?.phoneNumber || 
              (reservation.partialPhone ? 
                `xxxx-xxxx-${reservation.partialPhone}` : 
                'Not available'),
      status: reservation.needsGuestInfo !== false ? 'Needs Info' : 'Confirmed',
      operaConfirmation: reservation.operaConfirmation || '',
      reservationUrl: reservation.reservationUrl || null,
      guestInfo: reservation.guestInfo || null
    });
  });
  
  // Create property objects
  return Object.keys(reservationsByProperty).map(propertyId => {
    // Find property group
    const propertyGroup = PROPERTY_GROUPS.find(group => 
      group.properties.includes(propertyId)
    );
    
    // Get property name from the group or use property ID if not found
    const propertyName = propertyGroup ? propertyGroup.name : propertyId;
    const groupId = propertyGroup ? propertyGroup.id : 'unknown';
    
    return {
      code: propertyId,
      name: propertyName,
      groupId: groupId,
      groupName: propertyName,
      id: propertyId,
      lastSync: new Date().toISOString(), // We'll get this from API in a real implementation
      currentFrequency: 30, // Default, to be replaced with actual data
      reservationsCount: reservationsByProperty[propertyId].length,
      reservations: reservationsByProperty[propertyId]
    };
  });
}

// Render the properties table
function renderPropertiesTable() {
  const dashboardContent = document.getElementById('dashboard-content');
  
  // Filter properties by selected group
  const filteredProperties = selectedGroup === "all" 
    ? properties 
    : properties.filter(p => p.groupId === selectedGroup);
  
  if (filteredProperties.length === 0) {
    dashboardContent.innerHTML = '<div class="no-data">No properties found with the current filters.</div>';
    return;
  }
  
  // Create the table
  let tableHTML = `
    <table class="properties-table">
      <thead>
        <tr>
          <th>Property</th>
          <th>Group</th>
          <th>Last Sync</th>
          <th>Check for New</th>
          <th>Reservations</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  // Add rows for each property
  filteredProperties.forEach(property => {
    tableHTML += `
      <tr class="property-row" data-property-id="${property.id}">
        <td class="property-name">${property.name}</td>
        <td>${property.groupName}</td>
        <td>${formatDateTime(property.lastSync)}</td>
        <td>
          <select class="frequency-select" data-property-id="${property.id}">
            ${SYNC_FREQUENCY_OPTIONS.map(option => 
              `<option value="${option.value}" ${property.currentFrequency === option.value ? 'selected' : ''}>
                ${option.label}
              </option>`
            ).join('')}
          </select>
        </td>
        <td>
          <button class="reservation-toggle" data-property-id="${property.id}">
            ${property.reservationsCount} Reservations
            <span class="chevron-${expandedProperties[property.id] ? 'up' : 'down'}"></span>
          </button>
        </td>
        <td>
          <button class="sync-button" data-property-id="${property.id}">
            <span class="refresh-icon"></span> Sync Now
          </button>
        </td>
      </tr>
    `;
    
    // Add expandable reservations section
    if (expandedProperties[property.id]) {
      tableHTML += `
        <tr class="reservations-row" data-property-id="${property.id}">
          <td colspan="6" class="reservations-container">
      `;
      
      if (property.reservations.length === 0) {
        tableHTML += '<div class="no-data">No reservations found for this property.</div>';
      } else {
        tableHTML += `
          <table class="reservations-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Guest</th>
                <th>Contact</th>
                <th>Opera Confirmation</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
        `;
        
        // Add rows for each reservation
        property.reservations.forEach(reservation => {
          const statusClass = reservation.status === 'Confirmed' ? 'status-confirmed' : 'status-needs-info';
          
          tableHTML += `
            <tr class="reservation-row" data-reservation-id="${reservation.id}">
              <td>${reservation.source}</td>
              <td>${reservation.checkIn}</td>
              <td>${reservation.checkOut}</td>
              <td>${reservation.guest}</td>
              <td>${reservation.contact}</td>
              <td>${reservation.operaConfirmation}</td>
              <td><span class="status-tag ${statusClass}">${reservation.status}</span></td>
              <td>
                <button class="edit-button" data-reservation-id="${reservation.id}">Edit</button>
                ${reservation.reservationUrl ? 
                  `<a href="${reservation.reservationUrl}" target="_blank" class="view-link">View</a>` : 
                  ''}
              </td>
            </tr>
          `;
        });
        
        tableHTML += `
            </tbody>
          </table>
        `;
      }
      
      tableHTML += `
          </td>
        </tr>
      `;
    }
  });
  
  tableHTML += `
      </tbody>
    </table>
  `;
  
  dashboardContent.innerHTML = tableHTML;
  
  // Set up event listeners for the new elements
  setupTableEventListeners();
}

// Set up event listeners for the property table
function setupTableEventListeners() {
  // Toggle reservations visibility
  document.querySelectorAll('.reservation-toggle').forEach(button => {
    button.addEventListener('click', function() {
      const propertyId = this.getAttribute('data-property-id');
      togglePropertyExpansion(propertyId);
    });
  });
  
  // Frequency select change
  document.querySelectorAll('.frequency-select').forEach(select => {
    select.addEventListener('change', function() {
      const propertyId = this.getAttribute('data-property-id');
      const newFrequency = parseInt(this.value);
      handleFrequencyChange(propertyId, newFrequency);
    });
  });
  
  // Sync buttons
  document.querySelectorAll('.sync-button').forEach(button => {
    button.addEventListener('click', function() {
      const propertyId = this.getAttribute('data-property-id');
      triggerManualSync(propertyId);
    });
  });
  
  // Edit buttons
  document.querySelectorAll('.edit-button').forEach(button => {
    button.addEventListener('click', function() {
      const reservationId = this.getAttribute('data-reservation-id');
      openGuestInfoModal(reservationId);
    });
  });
}

// Toggle property expansion
function togglePropertyExpansion(propertyId) {
  expandedProperties[propertyId] = !expandedProperties[propertyId];
  renderPropertiesTable();
}

// Handle frequency change
function handleFrequencyChange(propertyId, newFrequency) {
  // Update the property in our data
  properties = properties.map(property => 
    property.id === propertyId 
      ? { ...property, currentFrequency: newFrequency } 
      : property
  );
  
  // In a real implementation, you would save this to the server
  console.log(`Changed frequency for property ${propertyId} to ${newFrequency}`);
}

// Format date time
function formatDateTime(dateTimeString) {
  const date = new Date(dateTimeString);
  return date.toLocaleString();
}

// Trigger manual sync for a property
function triggerManualSync(propertyId) {
  const syncButton = document.querySelector(`.sync-button[data-property-id="${propertyId}"]`);
  syncButton.disabled = true;
  syncButton.innerHTML = '<span class="refresh-icon spinning"></span> Syncing...';
  
  fetch('/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ propertyId })
  })
    .then(response => response.json())
    .then(data => {
      alert('Sync started successfully. This may take a few minutes.');
      
      // Update the last sync time in the UI
      const now = new Date().toISOString();
      properties = properties.map(property => 
        property.id === propertyId 
          ? { ...property, lastSync: now } 
          : property
      );
      
      // Re-enable the button and update the table
      syncButton.disabled = false;
      syncButton.innerHTML = '<span class="refresh-icon"></span> Sync Now';
      
      // Reload data after a delay to show updated reservations
      setTimeout(() => {
        loadPropertiesAndReservations();
      }, 5000);
    })
    .catch(error => {
      console.error('Error triggering sync:', error);
      alert('Error starting sync');
      syncButton.disabled = false;
      syncButton.innerHTML = '<span class="refresh-icon"></span> Sync Now';
    });
}

// Trigger sync for all properties
function triggerSyncAll() {
  const syncAllButton = document.getElementById('sync-button');
  syncAllButton.disabled = true;
  syncAllButton.textContent = 'Syncing...';
  
  fetch('/api/sync', {
    method: 'POST'
  })
    .then(response => response.json())
    .then(data => {
      alert('Sync started successfully for all properties. This may take a few minutes.');
      
      // Update all last sync times in the UI
      const now = new Date().toISOString();
      properties = properties.map(property => ({ ...property, lastSync: now }));
      
      // Re-enable the button
      setTimeout(() => {
        syncAllButton.disabled = false;
        syncAllButton.textContent = 'Sync Now';
        
        // Reload data
        loadPropertiesAndReservations();
      }, 5000);
    })
    .catch(error => {
      console.error('Error triggering sync:', error);
      alert('Error starting sync');
      syncAllButton.disabled = false;
      syncAllButton.textContent = 'Sync Now';
    });
}

// Apply filters and reload data
function applyFilters() {
  loadPropertiesAndReservations();
}

// Filter properties by selected group
function filterPropertiesByGroup() {
  renderPropertiesTable();
}

// Set up modal functionality
function setupModal() {
  const modal = document.getElementById('guest-info-modal');
  const closeBtn = document.querySelector('.close');
  
  closeBtn.addEventListener('click', function() {
    modal.style.display = 'none';
  });
  
  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  // Set up form submission
  const guestInfoForm = document.getElementById('guest-info-form');
  guestInfoForm.addEventListener('submit', function(event) {
    event.preventDefault();
    saveGuestInfo();
  });
}

// Open guest info modal
function openGuestInfoModal(reservationId) {
  const modal = document.getElementById('guest-info-modal');
  document.getElementById('reservation-id').value = reservationId;
  
  // Reset form
  document.getElementById('guest-name').value = '';
  document.getElementById('guest-phone').value = '';
  document.getElementById('guest-email').value = '';
  document.getElementById('guest-notes').value = '';
  
  // Find the reservation in our already-loaded data
  let foundReservation = null;
  
  for (const property of properties) {
    const reservation = property.reservations.find(r => r.id === reservationId);
    if (reservation) {
      foundReservation = reservation;
      break;
    }
  }
  
  if (foundReservation && foundReservation.guestInfo) {
    // Pre-fill form if we have guest info
    document.getElementById('guest-name').value = foundReservation.guestInfo.fullName || '';
    document.getElementById('guest-phone').value = foundReservation.guestInfo.phoneNumber || '';
    document.getElementById('guest-email').value = foundReservation.guestInfo.email || '';
    document.getElementById('guest-notes').value = foundReservation.guestInfo.notes || '';
  } else {
    // If not found in our data, fetch it from the API
    fetch(`/api/reservations/${reservationId}`)
      .then(response => response.json())
      .then(reservation => {
        if (reservation.guestInfo) {
          document.getElementById('guest-name').value = reservation.guestInfo.fullName || '';
          document.getElementById('guest-phone').value = reservation.guestInfo.phoneNumber || '';
          document.getElementById('guest-email').value = reservation.guestInfo.email || '';
          document.getElementById('guest-notes').value = reservation.guestInfo.notes || '';
        }
      })
      .catch(error => {
        console.error('Error fetching reservation details:', error);
      });
  }
  
  // Show the modal
  modal.style.display = 'block';
}

// Save guest info
function saveGuestInfo() {
  const reservationId = document.getElementById('reservation-id').value;
  const fullName = document.getElementById('guest-name').value;
  const phoneNumber = document.getElementById('guest-phone').value;
  const email = document.getElementById('guest-email').value;
  const notes = document.getElementById('guest-notes').value;
  
  fetch(`/api/reservations/${reservationId}/guestInfo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fullName,
      phoneNumber,
      email,
      notes
    })
  })
    .then(response => response.json())
    .then(data => {
      document.getElementById('guest-info-modal').style.display = 'none';
      
      // Reload data to show updated information
      loadPropertiesAndReservations();
      alert('Guest information updated successfully!');
    })
    .catch(error => {
      console.error('Error saving guest information:', error);
      alert('Error saving guest information. Please try again.');
    });
}

// Make functions available globally for HTML event handlers
window.openGuestInfoModal = openGuestInfoModal;
window.saveGuestInfo = saveGuestInfo;
window.triggerSyncAll = triggerSyncAll;
window.applyFilters = applyFilters;
