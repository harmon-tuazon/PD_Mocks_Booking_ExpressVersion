import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

/**
 * DateTimePicker component
 * Combines date and time selection in a single component
 * @param {Object} props
 * @param {string} props.value - ISO datetime string or datetime-local format (YYYY-MM-DDTHH:mm)
 * @param {Function} props.onChange - Callback with datetime-local format string
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.disabled - Whether the picker is disabled
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.minDateTime - Minimum datetime allowed
 * @param {string} props.id - Input ID for label association
 * @param {string} props.name - Input name for form submission
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  disabled = false,
  className,
  minDateTime,
  id,
  name,
  ...props
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Parse the datetime value
  const [selectedDate, selectedTime] = React.useMemo(() => {
    if (!value) return [undefined, { hours: "09", minutes: "00" }];

    try {
      // Handle datetime-local format (YYYY-MM-DDTHH:mm)
      const [datePart, timePart] = value.split('T');

      if (datePart && timePart) {
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':');

        const date = new Date(year, month - 1, day);
        return [date, { hours: hours || "09", minutes: minutes || "00" }];
      }
    } catch (error) {
      console.error('Error parsing datetime:', error);
    }

    return [undefined, { hours: "09", minutes: "00" }];
  }, [value]);

  // Generate time options
  const hours = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, '0')
  );

  const minutes = ["00", "15", "30", "45"];

  const handleDateSelect = (date) => {
    if (!date) {
      onChange?.('');
      return;
    }

    // Format as datetime-local string (YYYY-MM-DDTHH:mm)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = `${selectedTime.hours}:${selectedTime.minutes}`;
    const datetimeString = `${year}-${month}-${day}T${time}`;

    onChange?.(datetimeString);
  };

  const handleTimeChange = (type, value) => {
    const newTime = {
      ...selectedTime,
      [type]: value
    };

    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const datetimeString = `${year}-${month}-${day}T${newTime.hours}:${newTime.minutes}`;

      onChange?.(datetimeString);
    }
  };

  // Parse minimum date if provided
  const minDate = React.useMemo(() => {
    if (!minDateTime) return undefined;

    try {
      const [datePart] = minDateTime.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day);
    } catch {
      return undefined;
    }
  }, [minDateTime]);

  const formattedValue = React.useMemo(() => {
    if (!selectedDate) return placeholder;

    const dateStr = format(selectedDate, "PPP");
    const timeStr = `${selectedTime.hours}:${selectedTime.minutes}`;
    return `${dateStr} at ${timeStr}`;
  }, [selectedDate, selectedTime, placeholder]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          name={name}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-gray-500 dark:text-gray-400",
            className
          )}
          disabled={disabled}
          {...props}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          <span className="truncate">{formattedValue}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          {/* Date Selection */}
          <div>
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Select Date
            </Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => {
                if (minDate && date < minDate) return true;
                return disabled;
              }}
              initialFocus
            />
          </div>

          {/* Time Selection */}
          <div className="border-t pt-3">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Select Time
            </Label>
            <div className="flex gap-2">
              <Select
                value={selectedTime.hours}
                onValueChange={(value) => handleTimeChange('hours', value)}
                disabled={disabled || !selectedDate}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent>
                  {hours.map((hour) => (
                    <SelectItem key={hour} value={hour}>
                      {hour}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedTime.minutes}
                onValueChange={(value) => handleTimeChange('minutes', value)}
                disabled={disabled || !selectedDate}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue placeholder="Min" />
                </SelectTrigger>
                <SelectContent>
                  {minutes.map((minute) => (
                    <SelectItem key={minute} value={minute}>
                      :{minute}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Apply button */}
          <div className="pt-2">
            <Button
              className="w-full"
              onClick={() => setIsOpen(false)}
              disabled={!selectedDate}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}