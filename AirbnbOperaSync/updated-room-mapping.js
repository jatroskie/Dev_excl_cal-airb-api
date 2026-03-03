// Updated Room Mapping with property field based on airbnbId prefix
const roomMapping = {
  // STU-BALC
  "TBA-0302": {
    airbnbId: "B302",
    airbnbTitle: "Fabulous studio with balcony & views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview302",
    property: "TBA"
  },
  "TBA-0303": {
    airbnbId: "B303",
    airbnbTitle: "Spectacular studio with balcony & views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview303",
    property: "TBA"
  },
  "TBA-0400": {
    airbnbId: "B400",
    airbnbTitle: "Fabulous views in trendy Breë",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview400",
    property: "TBA"
  },
  "TBA-0401": {
    airbnbId: "B401",
    airbnbTitle: "Fabulous spacious apartment!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview401",
    property: "TBA"
  },
  "TBA-0402": {
    airbnbId: "B402",
    airbnbTitle: "Absolutely fabulous personified!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview402",
    property: "TBA"
  },
  "TBA-0501": {
    airbnbId: "B501",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview501",
    property: "TBA"
  },
  "TBA-0502": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-BALC",
    url: null,
    property: null
  },
  "TBA-0503": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-BALC",
    url: null,
    property: null
  },
  "TBA-0514": {
    airbnbId: "B514",
    airbnbTitle: "Fun studio with balcony in Bree",
    roomType: "STU-BALC",
    url: "airbnb.co.za/h/cityview514",
    property: "TBA"
  },

  // STU-URB
  "TBA-0304": {
    airbnbId: "B404",
    airbnbTitle: "Spacious studio, great views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview404",
    property: "TBA"
  },
  "TBA-0305": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0306": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0307": {
    airbnbId: "B307",
    airbnbTitle: "Sublime studio with everything!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview307",
    property: "TBA"
  },
  "TBA-0308": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0309": {
    airbnbId: "B309",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview309",
    property: "TBA"
  },
  "TBA-0311": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0312": {
    airbnbId: "B312",
    airbnbTitle: "Spacious studio with living room",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview312",
    property: "TBA"
  },
  "TBA-0313": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0314": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0318": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0319": {
    airbnbId: "B319",
    airbnbTitle: "Sunny 1 bed great views & decor",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview319",
    property: "TBA"
  },
  "TBA-0320": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0321": {
    airbnbId: "B321",
    airbnbTitle: "Sunny studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview321",
    property: "TBA"
  },
  "TBA-0323": {
    airbnbId: "B323",
    airbnbTitle: "Spacious sunny studio with views",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview323",
    property: "TBA"
  },
  "TBA-0403": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0404": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0405": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0406": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0407": {
    airbnbId: "B407",
    airbnbTitle: "Spacious studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview407",
    property: "TBA"
  },
  "TBA-0408": {
    airbnbId: "B408",
    airbnbTitle: "Splendid spacious studio with views!",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview408",
    property: "TBA"
  },
  "TBA-0409": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0411": {
    airbnbId: "B411",
    airbnbTitle: "Super studio with sep living room",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview411",
    property: "TBA"
  },
  "TBA-0412": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0416": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0417": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0418": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0419": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-URB",
    url: null,
    property: null
  },
  "TBA-0420": {
    airbnbId: "B420",
    airbnbTitle: "Sunny studio with fabulous views",
    roomType: "STU-URB",
    url: "airbnb.co.za/h/cityview420",
    property: "TBA"
  },

  // 1-BR
  "TBA-0315": {
    airbnbId: "B315",
    airbnbTitle: "Fab 1 bed with balcony and views",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview315",
    property: "TBA"
  },
  "TBA-0317": {
    airbnbId: "B317",
    airbnbTitle: "Great 1 bed with balcony & views",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview317",
    property: "TBA"
  },
  "TBA-0413": {
    airbnbId: "B413",
    airbnbTitle: "Fabulous 1 bed with balcony & views!",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityview413",
    property: "TBA"
  },
  "TBA-0415": {
    airbnbId: "S415",
    airbnbTitle: "Sunny spacious 1 bed with views!",
    roomType: "1-BR",
    url: "airbnb.co.za/h/cityviews415",
    property: "TQA"
  },

  // STU-LUX
  "TBA-0504": {
    airbnbId: "B504",
    airbnbTitle: "Spacious studio with fab views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview504",
    property: "TBA"
  },
  "TBA-0506": {
    airbnbId: "B506",
    airbnbTitle: "City Views with all the comfort",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview506",
    property: "TBA"
  },
  "TBA-0507": {
    airbnbId: "B507",
    airbnbTitle: "Stunning studio with views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview507",
    property: "TBA"
  },
  "TBA-0508": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null,
    property: null
  },
  "TBA-0509": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null,
    property: null
  },
  "TBA-0511": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null,
    property: null
  },
  "TBA-0516": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null,
    property: null
  },
  "TBA-0517": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null,
    property: null
  },
  "TBA-0518": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null,
    property: null
  },
  "TBA-0519": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "STU-LUX",
    url: null,
    property: null
  },
  "TBA-0520": {
    airbnbId: "B520",
    airbnbTitle: "Sunny studio & fabulous views!",
    roomType: "STU-LUX",
    url: "airbnb.co.za/h/cityview520",
    property: "TBA"
  },

  // 2-BR
  "TBA-0513": {
    // No exact match in PDF, potential mapping needed
    airbnbId: null,
    airbnbTitle: null,
    roomType: "2-BR",
    url: null,
    property: null
  },
  "TBA-0515": {
    airbnbId: "B515",
    airbnbTitle: "Fabulous finishes, views & space!",
    roomType: "2-BR",
    url: "airbnb.co.za/h/cityview515",
    property: "TBA"
  },

  // Additional rooms from PDF not in your room types
  "G102": {
    airbnbId: "G102",
    airbnbTitle: "Exceptional Waterfront Living!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-g102",
    property: "WFV"
  },
  "G205": {
    airbnbId: "G205",
    airbnbTitle: "Fabulous waterfront lifestyle!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-g205",
    property: "WFV"
  },
  "H003": {
    airbnbId: "H003",
    airbnbTitle: "Fabulous waterfront living!",
    roomType: "waterfront",
    url: "airbnb.co.za/h/waterfront-h003",
    property: "WFV"
  }
};

// Create a function to generate a mapping for use with the AirbnbAvailabilitySyncer
function createTBAtoAirbnbMapping() {
  const mapping = {};
  
  // Loop through all rooms and add TBA rooms to the mapping
  Object.entries(roomMapping).forEach(([roomId, details]) => {
    // Only include rooms that have a valid airbnbId and are part of TBA
    if (details.airbnbId && details.property === "TBA") {
      mapping[roomId] = details.airbnbId;
    }
  });
  
  return mapping;
}

// Function to identify property based on airbnbId prefix
function identifyProperty(airbnbId) {
  if (!airbnbId) return null;
  
  if (airbnbId.startsWith('B')) {
    return 'TBA';
  } else if (airbnbId.startsWith('S')) {
    return 'TQA';
  } else if (airbnbId.startsWith('G') || airbnbId.startsWith('H')) {
    return 'WFV';
  }
  
  return null;
}

// Function to update property fields based on airbnbId prefixes
function updatePropertyFields() {
  Object.keys(roomMapping).forEach(roomId => {
    const room = roomMapping[roomId];
    if (room.airbnbId) {
      room.property = identifyProperty(room.airbnbId);
    }
  });
}

// Example of generating the room to property mapping for the syncer
const tbaToAirbnbMapping = createTBAtoAirbnbMapping();
console.log("TBA to Airbnb Property Mapping:", tbaToAirbnbMapping);

// Export the mapping and helper functions
module.exports = { 
  roomMapping, 
  createTBAtoAirbnbMapping,
  identifyProperty,
  updatePropertyFields
};
