import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

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
 * Modern TimePickerSelect - Allows both typing and dropdown selection
 * Users can type time directly or click the clock icon to select from a list
 */
export function TimePickerSelect({
  value,
  onChange,
  placeholder = "HH:MM",
  disabled = false,
  className,
  id,
  name,
  minuteStep = 15,
  startHour = 6,
  endHour = 23,
  required = false,
  ...props
}) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value || '');

  // Sync input value with prop value
  React.useEffect(() => {
    setInputValue(value || '');
  }, [value]);

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

  // Handle manual input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Validate HH:MM format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (timeRegex.test(newValue) || newValue === '') {
      onChange?.(newValue);
    }
  };

  // Handle selection from dropdown
  const handleSelect = (selectedValue) => {
    setInputValue(selectedValue);
    onChange?.(selectedValue);
    setOpen(false);
  };

  // Format input value for display
  const displayValue = React.useMemo(() => {
    if (!inputValue) return '';
    const [hour, minute] = inputValue.split(':').map(Number);
    if (!isNaN(hour) && !isNaN(minute)) {
      return formatTimeDisplay(hour, minute);
    }
    return inputValue;
  }, [inputValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <Input
          type="text"
          id={id}
          name={name}
          value={inputValue}
          onChange={handleInputChange}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          className={cn("pr-10", className)}
          {...props}
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            disabled={disabled}
          >
            <Clock className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-[200px] p-0" align="start" side="bottom">
        <ScrollArea className="h-[250px]">
          <div className="p-1">
            {timeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors",
                  option.value === inputValue && "bg-accent text-accent-foreground font-medium"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}