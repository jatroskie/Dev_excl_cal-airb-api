# Hotel Room Reservation Calendar - Installation and Usage Guide

This guide will help you set up and use the Hotel Room Reservation Calendar system to visualize your room bookings in a Gantt chart style similar to your room diary image.

## Overview

The system provides two implementation options:
1. **Static HTML file with built-in data loading** - for simpler setup
2. **File uploader version** - for more flexibility and privacy

Both implementations use:
- FullCalendar library for the timeline visualization
- PapaParse for CSV parsing
- Pure JavaScript with no backend requirements

## Option 1: Installation (Simple)

For the first option, follow these steps:

1. Save the file `hotel-calendar.html` to your computer
2. Place your CSV files in the same folder as the HTML file
3. Ensure the CSV files are named according to the room number (e.g., `0302_reservations.csv`)
4. Open the HTML file in your web browser

## Option 2: Installation (File Uploader)

For the more flexible option:

1. Save both files to your computer:
   - `hotel-calendar-uploader.html`
   - `process-csv.js`
2. Place both files in the same folder
3. Open `hotel-calendar-uploader.html` in your web browser
4. Click "Choose Files" and select your CSV files
5. The calendar will automatically load and display your reservations

## CSV Format Requirements

Your CSV files should have the following columns:
- `Room` - The room number
- `Room Type` - Type of room (e.g., STU-BALC, STU-URB)
- `Name` - Guest name
- `Arrival` - Check-in date in DD.MM.YYYY format
- `Departure` - Check-out date in DD.MM.YYYY format
- `Nights` - Number of nights
- `Reservation Type` - Status of reservation (In House, Guaranteed, etc.)

Additional columns that will be displayed if available:
- `Rate` - Room rate
- `Adults` - Number of adult guests
- `Children` - Number of child guests
- `Company` - Associated company
- `Source` - Booking source

## Features

### Calendar View
- Displays reservations for multiple rooms in a timeline view
- Color-coded bookings based on reservation status
- Room information shown on the left side

### Controls
- Navigate between months using Previous/Next buttons
- Change the view duration (7, 14, 30, or 60 days)
- Reset to current date with the Today button

### Filtering
- Filter by room number
- Filter by room type
- Search for guest names
- Reset filters to see all reservations

### Tooltips
- Click on any reservation to see detailed information
- Shows guest details, dates, rate, and other booking information

## Customization

### Changing Colors

You can modify the appearance by editing the CSS styles in the HTML file. For example, to change the color for "In House" reservations:

```css
.reservation-inhouse {
  background-color: #YOUR_COLOR_HERE !important;
  border-color: #YOUR_BORDER_COLOR_HERE !important;
  color: white !important;
}
```

### Adding More Room Types

The system automatically detects room types from your CSV data. If you need to add special styling for new room types, add a CSS class like:

```css
.room-new-type {
  color: #333;
  background-color: #f0f0f0;
}
```

### Date Format

By default, the system expects dates in DD.MM.YYYY format. If your CSV files use a different format, you'll need to modify the `parseDate` function in the JavaScript code.

## Troubleshooting

### CSV Files Not Loading
- Ensure your CSV files have the correct column headers
- Check that the date format matches DD.MM.YYYY
- Verify that the files are in the same folder as the HTML file (for Option 1)

### Reservations Not Appearing
- Check if the date range shown includes your reservation dates
- Use the filters to ensure you haven't accidentally filtered out your data
- Verify that your room numbers match between the filename and the data

### Calendar Display Issues
- Try a different browser if the calendar doesn't render correctly
- Ensure you have an internet connection (to load the required libraries)
- Check your browser console for any JavaScript errors

## Advanced: Hosting on a Web Server

If you want to make the calendar available online:

1. Upload all the files to your web hosting server
2. For Option 1, ensure your CSV files are also uploaded
3. For Option 2, users can access the page and upload their own CSV files

## Dependencies

The system uses these libraries, loaded from CDN:
- FullCalendar 5.10.2
- PapaParse 5.3.2

No installation of these libraries is required as they're loaded automatically.

## Support and Feedback

If you encounter any issues or have suggestions for improvements, you can modify the code as needed - it's all client-side JavaScript with no backend dependencies.
