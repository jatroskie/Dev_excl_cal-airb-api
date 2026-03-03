// airbnb-config.js
// This file helps manage the mapping between Airbnb listings and your rooms

document.addEventListener('DOMContentLoaded', function() {
  const configContainer = document.getElementById('airbnb-config-container');
  
  if (!configContainer) {
    console.warn('Airbnb config container not found. Skipping configuration setup.');
    return;
  }
  
  // Create UI for Airbnb iCal configuration
  createConfigUI();
  
  // Load existing mappings
  loadMappings();
  
  function createConfigUI() {
    configContainer.innerHTML = `
      <div class="config-panel">
        <h3>Airbnb Calendar Integration</h3>
        <h4>Room iCal Feeds</h4>
      <p>Add the iCal URL for each of your Airbnb properties and map it to the corresponding room in your system:</p>
        
        <div id="mappings-container">
          <!-- Mappings will be added here -->
        </div>
        
        <div class="form-group">
          <button id="add-mapping" class="btn btn-secondary">Add Mapping</button>
          <button id="save-mappings" class="btn btn-primary">Save All Mappings</button>
        </div>
        
        <div id="sync-status" class="mt-3"></div>
      </div>
    `;
    
    // Add styling
    const style = document.createElement('style');
    style.textContent = `
      .config-panel {
        background-color: #f8f9fa;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 15px;
        margin-bottom: 20px;
      }
      
      .form-group {
        margin-bottom: 15px;
      }
      
      .form-control {
        width: 100%;
        padding: 8px;
        border: 1px solid #cbd5e0;
        border-radius: 4px;
        margin-bottom: 10px;
      }
      
      .btn {
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .btn-primary {
        background-color: #3182ce;
        color: white;
        border: none;
      }
      
      .btn-secondary {
        background-color: #718096;
        color: white;
        border: none;
      }
      
      .mapping-row {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
        align-items: center;
      }
      
      .mapping-remove {
        background-color: #e53e3e;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
      }
      
      .success {
        color: #38a169;
      }
      
      .error {
        color: #e53e3e;
      }
    `;
    document.head.appendChild(style);
    
    // Add event listeners
    document.getElementById('add-mapping').addEventListener('click', () => addMappingRow());
    document.getElementById('save-mappings').addEventListener('click', saveMappings);
  }
  
  function loadMappings() {
    // No main calendar URL to load
    
    // Load room mappings from localStorage or from API
    fetch('/api/room-ical-mappings')
      .then(response => response.json())
      .then(mappings => {
        // Clear existing mappings
        const container = document.getElementById('mappings-container');
        container.innerHTML = '';
        
        // If we have mappings, add them to the UI
        if (Object.keys(mappings).length > 0) {
          for (const [roomId, icalUrl] of Object.entries(mappings)) {
            addMappingRow(roomId, icalUrl);
          }
        } else {
          // Add an empty mapping row if none exist
          addMappingRow();
        }
      })
      .catch(error => {
        console.error('Error loading mappings:', error);
        // Add an empty mapping row
        addMappingRow();
      });
  }
  
  function addMappingRow(roomId = '', icalUrl = '') {
    const container = document.getElementById('mappings-container');
    const row = document.createElement('div');
    row.className = 'mapping-row';
    
    row.innerHTML = `
      <input type="text" class="form-control room-id" placeholder="Room ID (e.g., Room101)" value="${roomId}">
      <input type="text" class="form-control ical-url" placeholder="iCal URL" value="${icalUrl}">
      <button class="mapping-remove">Remove</button>
    `;
    
    container.appendChild(row);
    
    // Add event listener for remove button
    row.querySelector('.mapping-remove').addEventListener('click', function() {
      row.remove();
    });
  }
  
  // We no longer need the saveMainCalendar function since we're using individual feeds
  
  function saveMappings() {
    const mappings = {};
    const rows = document.querySelectorAll('.mapping-row');
    
    rows.forEach(row => {
      const roomId = row.querySelector('.room-id').value.trim();
      const icalUrl = row.querySelector('.ical-url').value.trim();
      
      if (roomId && icalUrl) {
        mappings[roomId] = icalUrl;
      }
    });
    
    // Save mappings to the API
    fetch('/api/room-ical-mappings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mappings)
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showStatus('Mappings saved successfully', 'success');
          
          // Update the window variable
          window.roomIcalMappings = mappings;
          
          // Refresh calendar by removing old iCal sources and adding new ones
          if (window.calendar) {
            // Remove existing iCal sources
            const sources = window.calendar.getEventSources();
            sources.forEach(source => {
              if (source.id && source.id.startsWith('ical-')) {
                source.remove();
              }
            });
            
            // Add new sources for each mapping
            Object.entries(mappings).forEach(([roomId, icalUrl]) => {
              if (!icalUrl) return;
              
              window.calendar.addEventSource({
                id: `ical-${roomId}`,
                url: `/proxy-ical?url=${encodeURIComponent(icalUrl)}`,
                format: 'ics',
                resourceId: roomId,
                eventDataTransform: function(eventData) {
                  // Add Airbnb source marker and set the resource ID
                  eventData.resourceId = roomId;
                  eventData.extendedProps = {
                    ...eventData.extendedProps,
                    source: 'airbnb',
                    status: 'Confirmed'
                  };
                  
                  // Override display properties
                  eventData.backgroundColor = '#FF5A5F'; // Airbnb red
                  eventData.borderColor = '#FF385C';
                  eventData.textColor = 'white';
                  
                  return eventData;
                }
              });
            });
            
            // Refresh events
            window.calendar.refetchEvents();
          }
        } else {
          showStatus('Error saving mappings: ' + data.message, 'error');
        }
      })
      .catch(error => {
        console.error('Error saving mappings:', error);
        showStatus('Error saving mappings: ' + error.message, 'error');
      });
  }
  
  function showStatus(message, type) {
    const statusEl = document.getElementById('sync-status');
    statusEl.textContent = message;
    statusEl.className = type;
    
    // Clear status after 5 seconds
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = '';
    }, 5000);
  }
});
