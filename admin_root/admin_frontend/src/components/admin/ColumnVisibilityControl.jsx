import { ColumnsIcon, RefreshCwIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

/**
 * ColumnVisibilityControl Component
 *
 * Provides a dropdown menu to toggle visibility of table columns
 * with a reset to defaults option
 */
const ColumnVisibilityControl = ({
  columns = [],
  visibleColumns = [],
  onToggleColumn,
  onResetDefaults,
  className = ''
}) => {
  // Count how many columns are currently visible
  const visibleCount = visibleColumns.length;
  const totalCount = columns.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`flex items-center gap-2 ${className}`}
        >
          <ColumnsIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Columns</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({visibleCount}/{totalCount})
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Dynamic Columns */}
        <div className="max-h-[300px] overflow-y-auto">
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={visibleColumns.includes(column.id)}
              onCheckedChange={() => onToggleColumn(column.id)}
              className="cursor-pointer"
            >
              {column.label}
              {column.defaultVisible && (
                <span className="ml-auto text-xs text-gray-400">default</span>
              )}
            </DropdownMenuCheckboxItem>
          ))}
        </div>

        <DropdownMenuSeparator />

        {/* Reset to Defaults */}
        <DropdownMenuItem
          onClick={onResetDefaults}
          className="cursor-pointer flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          <RefreshCwIcon className="h-3 w-3" />
          <span>Reset to Defaults</span>
        </DropdownMenuItem>

        {/* Info about default columns */}
        <div className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">
          Default: Time, Token Used, Booking Date
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ColumnVisibilityControl;