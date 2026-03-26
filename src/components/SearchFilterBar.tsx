import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowUpDown } from 'lucide-react';

interface SortOption {
  value: string;
  label: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  filterOptions?: FilterOption[];
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterLabel?: string;
}

const SearchFilterBar = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  sortOptions,
  sortValue,
  onSortChange,
  filterOptions,
  filterValue,
  onFilterChange,
  filterLabel = 'Filter',
}: SearchFilterBarProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>
      {filterOptions && onFilterChange && (
        <Select value={filterValue} onValueChange={onFilterChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={filterLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {filterOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {sortOptions && onSortChange && (
        <Select value={sortValue} onValueChange={onSortChange}>
          <SelectTrigger className="w-full sm:w-44">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default SearchFilterBar;
