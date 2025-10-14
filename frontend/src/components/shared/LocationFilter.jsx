import React from 'react';

const LOCATIONS = [
  { value: 'all', label: 'All Locations', icon: '🌍' },
  { value: 'Mississauga', label: 'Mississauga', icon: '📍' },
  { value: 'Vancouver', label: 'Vancouver', icon: '📍' },
  { value: 'Montreal', label: 'Montreal', icon: '📍' },
  { value: 'Calgary', label: 'Calgary', icon: '📍' },
  { value: 'Online', label: 'Online', icon: '💻' },
  { value: 'B9', label: 'B9', icon: '📍' }
];

const LocationFilter = ({ selectedLocation = 'all', onLocationChange }) => {
  return (
    <div className="location-filter">
      <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
        📍 Filter by Location
      </p>
      <div className="flex flex-wrap gap-2">
        {LOCATIONS.map((location) => (
          <button
            key={location.value}
            onClick={() => onLocationChange(location.value)}
            className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 ${
              selectedLocation === location.value
                ? 'bg-[#0660B2] text-white shadow-sm'
                : 'bg-[#EFEFEF] text-[#02376D] hover:bg-[#44D3BB] hover:text-white'
            }`}
            aria-pressed={selectedLocation === location.value}
            aria-label={`Filter by ${location.label}`}
          >
            <span className="hidden sm:inline">{location.icon} {location.label}</span>
            <span className="sm:hidden">{location.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LocationFilter;
