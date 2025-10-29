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
