import React from 'react';

const LocationSelector = ({ value, onChange, required = false }) => {
  const locations = [
    { value: 'mississauga', label: 'Mississauga' },
    { value: 'calgary', label: 'Calgary' },
    { value: 'vancouver', label: 'Vancouver' },
    { value: 'montreal', label: 'Montreal' },
    { value: 'richmond_hill', label: 'Richmond Hill' }
  ];

  return (
    <div className="w-full">
      <label className="text-sm font-subheading font-medium text-navy-700 mb-3 block">
        Please select your Prep Doctors location {required && <span className="text-red-500">*</span>}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {locations.map((location) => (
          <label
            key={location.value}
            className={`
              relative flex items-center justify-center px-4 py-4 rounded-lg border-2 cursor-pointer transition-all
              ${value === location.value
                ? 'border-primary-600 bg-primary-50 shadow-sm'
                : 'border-gray-300 bg-white hover:border-primary-400 hover:bg-gray-50'
              }
            `}
          >
            <input
              type="radio"
              name="location"
              value={location.value}
              checked={value === location.value}
              onChange={(e) => {
                console.log('📍 LocationSelector onChange called with:', e.target.value);
                onChange(e.target.value);
              }}
              className="sr-only"
              required={required}
            />
            <div className="flex items-center">
              <div className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 transition-all
                ${value === location.value
                  ? 'border-primary-600 bg-primary-600'
                  : 'border-gray-400'
                }
              `}>
                {value === location.value && (
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                )}
              </div>
              <span className={`
                text-base font-body font-medium
                ${value === location.value ? 'text-primary-900' : 'text-gray-700'}
              `}>
                {location.label}
              </span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

export default LocationSelector;
