document.addEventListener('DOMContentLoaded', function() {
    // Load reservations on page load
    loadReservations();
    
    // Set up event listeners
    document.getElementById('sync-button').addEventListener('click', triggerSync);
    document.getElementById('filter-button').addEventListener('click', loadReservations);
    
    // Set up modal functionality
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
    
    // Function to load reservations
    function loadReservations() {
      const propertySelect = document.getElementById('property-select');
      const dateFrom = document.getElementById('date-from');
      const dateTo = document.getElementById('date-to');
      const guestInfoSelect = document.getElementById('guest-info-select');
      
      // Build query params
      const params = new URLSearchParams();
      
      if (propertySelect.value !== 'all') {
        params.append('property', propertySelect.value);
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
      
      // Fetch reservations
      fetch(`/api/reservations?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
          displayReservations(data.reservations);
        })
        .catch(error => {
          console.error('Error loading reservations:', error);
          alert('Error loading reservations. Please check the console for details.');
        });
    }
    
    // Function to display reservations
    function displayReservations(reservations) {
      const tbody = document.getElementById('reservations-body');
      tbody.innerHTML = '';
      
      if (reservations.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="8" style="text-align: center;">No reservations found</td>';
        tbody.appendChild(row);
        return;
      }
      
      // Sort reservations by start date (newest first)
      reservations.sort((a, b) => new Date(a.start) - new Date(b.start));
      
      reservations.forEach(reservation => {
        const row = document.createElement('tr');
        
        // Format dates
        const startDate = new Date(reservation.start).toLocaleDateString();
        const endDate = new Date(reservation.end).toLocaleDateString();
        
        // Get guest info
        const guestName = reservation.guestInfo?.fullName || 'Not available';
        const guestContact = reservation.guestInfo?.phoneNumber || 
                             (reservation.partialPhone ? 
                              'Last digits: ' + reservation.partialPhone : 
                              'Not available');
        
        // Determine status
        const needsGuestInfo = reservation.needsGuestInfo !== false;
        const statusClass = needsGuestInfo ? 'status-needed' : 'status-complete';
        const statusText = needsGuestInfo ? 'Needs Info' : 'Complete';
        
        row.innerHTML = `
          <td>${reservation.propertyId}</td>
          <td>${reservation.source.charAt(0).toUpperCase() + reservation.source.slice(1)}</td>
          <td>${startDate}</td>
          <td>${endDate}</td>
          <td>${guestName}</td>
          <td>${guestContact}</td>
          <td><span class="status-tag ${statusClass}">${statusText}</span></td>
          <td>
            <button class="action-btn" onclick="openGuestInfoModal('${reservation.id}')">Edit</button>
            ${reservation.reservationUrl ? 
              `<a href="${reservation.reservationUrl}" target="_blank">View</a>` : 
              ''}
          </td>
        `;
        
        tbody.appendChild(row);
      });
    }
    
    // Function to trigger manual sync
    function triggerSync() {
      const syncButton = document.getElementById('sync-button');
      syncButton.disabled = true;
      syncButton.textContent = 'Syncing...';
      
      fetch('/api/sync', {
        method: 'POST'
      })
        .then(response => response.json())
        .then(data => {
          alert('Sync started successfully. This may take a few minutes.');
          setTimeout(() => {
            syncButton.disabled = false;
            syncButton.textContent = 'Sync Now';
            loadReservations();
          }, 5000);
        })
        .catch(error => {
          console.error('Error triggering sync:', error);
          syncButton.disabled = false;
          syncButton.textContent = 'Sync Now';
          alert('Error starting sync');
        });
    }
    
    // Expose these functions to global scope
    window.openGuestInfoModal = openGuestInfoModal;
    window.saveGuestInfo = saveGuestInfo;
  });
  
  // Function to open the guest info modal
  function openGuestInfoModal(reservationId) {
    const modal = document.getElementById('guest-info-modal');
    document.getElementById('reservation-id').value = reservationId;
    
    // Reset form
    document.getElementById('guest-name').value = '';
    document.getElementById('guest-phone').value = '';
    document.getElementById('guest-email').value = '';
    document.getElementById('guest-notes').value = '';
    
    // If we have existing data, pre-fill the form
    fetch(`/api/reservations/${reservationId}`)
      .then(response => response.json())
      .then(reservation => {
        if (reservation.guestInfo) {
          document.getElementById('guest-name').value = reservation.guestInfo.fullName || '';
          document.getElementById('guest-phone').value = reservation.guestInfo.phoneNumber || '';
          document.getElementById('guest-email').value = reservation.guestInfo.email || '';
          document.getElementById('guest-notes').value = reservation.guestInfo.notes || '';
        }
        
        // Show the modal
        modal.style.display = 'block';
      })
      .catch(error => {
        console.error('Error fetching reservation details:', error);
        alert('Error loading reservation details. Please try again.');
      });
  }
  
  // Function to save guest info
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
        loadReservations();
        alert('Guest information updated successfully!');
      })
      .catch(error => {
        console.error('Error saving guest information:', error);
        alert('Error saving guest information. Please try again.');
      });
  }
  
  // Make sure loadReservations is accessible
  function loadReservations() {
    // This is a wrapper function to call the inner loadReservations
    // defined in the DOMContentLoaded event
    document.dispatchEvent(new CustomEvent('refreshReservations'));
  }
  
  // Add event listener for the custom event
  document.addEventListener('refreshReservations', function() {
    // Get the real function
    const event = new Event('click');
    document.getElementById('filter-button').dispatchEvent(event);
  });