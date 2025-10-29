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

/**
 * DatePicker component
 * @param {Object} props
 * @param {string} props.value - ISO date string (YYYY-MM-DD)
 * @param {Function} props.onChange - Callback with ISO date string
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.disabled - Whether the picker is disabled
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.id - Input ID for label association
 * @param {string} props.name - Input name for form submission
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  id,
  name,
  ...props
}) {
  // Convert ISO string to Date object for the calendar
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    try {
      const [year, month, day] = value.split('-').map(Number);
      if (year && month && day) {
        // Create date in local timezone (matching native date input behavior)
        return new Date(year, month - 1, day);
      }
    } catch (error) {
      // Error is handled gracefully by returning undefined
    }
    return undefined;
  }, [value]);

  const handleSelect = (date) => {
    if (!date) {
      onChange?.('');
      return;
    }

    // Format as ISO date string (YYYY-MM-DD)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const isoString = `${year}-${month}-${day}`;

    onChange?.(isoString);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          name={name}
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          {...props}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "PPP") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}