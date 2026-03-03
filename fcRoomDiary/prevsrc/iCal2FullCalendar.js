import { Calendar } from '@fullcalendar/core';
import iCalendarPlugin from '@fullcalendar/icalendar';
import dayGridPlugin from '@fullcalendar/daygrid';

document.addEventListener('DOMContentLoaded', function() {
  const calendarEl = document.getElementById('calendar');
  
  const calendar = new Calendar(calendarEl, {
    plugins: [iCalendarPlugin, dayGridPlugin],
    initialView: 'dayGridMonth',
    events: {
      url: 'https://www.airbnb.co.za/calendar/ical/1378086011732802323.ics?s=7e46b634c9f88077f23c460a999ba237', // Replace with your Airbnb iCal URL
      format: 'ics',
      failure: function() {
        alert('There was an error loading Airbnb calendar data');
      }
    },
    eventDisplay: 'block',
    eventColor: '#ff5a5f', // Airbnb red color
    eventTextColor: '#ffffff',
    eventContent: function(arg) {
      // Custom display for occupied days
      return {
        html: '<div class="fc-event-occupied">Booked</div>'
      };
    }
  });
  
  calendar.render();
});