import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * TimePicker component
 * Uses native time input with shadcn styling to preserve existing timezone logic
 * @param {Object} props
 * @param {string} props.value - Time in HH:mm format (24-hour)
 * @param {Function} props.onChange - Callback with HH:mm time string
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.disabled - Whether the picker is disabled
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.id - Input ID for label association
 * @param {string} props.name - Input name for form submission
 * @param {boolean} props.required - Whether the field is required
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
  className,
  id,
  name,
  required = false,
  ...props
}) {
  // Handle change event from native input
  const handleChange = (e) => {
    const newValue = e.target.value;
    // Native time input returns HH:mm format which is what we need
    onChange?.(newValue);
  };

  return (
    <div className="relative">
      <Input
        type="time"
        id={id}
        name={name}
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        className={cn(
          "pr-10",
          className
        )}
        {...props}
      />
      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}

/**
 * Alternative TimePicker with custom dropdown (optional enhanced version)
 * This provides a more controlled experience with specific time options
 */
export function TimePickerSelect({
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
  className,
  id,
  name,
  minuteStep = 15,
  startHour = 0,
  endHour = 23,
  ...props
}) {
  // Generate time options based on parameters
  const timeOptions = React.useMemo(() => {
    const options = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += minuteStep) {
        const hourStr = String(hour).padStart(2, '0');
        const minuteStr = String(minute).padStart(2, '0');
        const timeValue = `${hourStr}:${minuteStr}`;
        const displayValue = formatTimeDisplay(hour, minute);
        options.push({
          value: timeValue,
          label: displayValue
        });
      }
    }
    return options;
  }, [startHour, endHour, minuteStep]);

  // Format time for display (12-hour format with AM/PM)
  function formatTimeDisplay(hour, minute) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
  }

  // Find display value for current selection
  const displayValue = React.useMemo(() => {
    if (!value) return '';
    const [hour, minute] = value.split(':').map(Number);
    if (!isNaN(hour) && !isNaN(minute)) {
      return formatTimeDisplay(hour, minute);
    }
    return value;
  }, [value]);

  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none pr-10",
          className
        )}
        {...props}
      >
        <option value="">{placeholder}</option>
        {timeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}