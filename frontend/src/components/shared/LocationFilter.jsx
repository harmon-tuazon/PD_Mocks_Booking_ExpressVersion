import React from 'react';

const LocationFilter = ({ selectedLocation = 'all', onLocationChange }) => {
  return (
    <div className="location-filter">
      <label htmlFor="location-select" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Filter by Location
      </label>
      <select
        id="location-select"
        value={selectedLocation}
        onChange={(e) => onLocationChange(e.target.value)}
        className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:focus:border-primary-400 bg-white dark:bg-dark-hover dark:text-gray-100"
        aria-label="Filter sessions by location"
      >
        <option value="all">All Locations</option>
        <option value="Mississauga">Mississauga</option>
        <option value="Vancouver">Vancouver</option>
        <option value="Montreal">Montreal</option>
        <option value="Calgary">Calgary</option>
        <option value="Online">Online</option>
        <option value="B9">B9</option>
      </select>
    </div>
  );
};

export default LocationFilter;
