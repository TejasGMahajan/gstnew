'use client';

import React, { useState, useCallback, memo } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FilterOption {
  key: string;
  label: string;
  type: 'select' | 'date' | 'text';
  options?: { value: string; label: string }[];
}

interface GlobalSearchProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  filters?: FilterOption[];
  onFilterChange?: (filters: Record<string, string>) => void;
  activeFilters?: Record<string, string>;
}

function GlobalSearch({
  placeholder = 'Search by name, GSTIN, document...',
  onSearch,
  filters = [],
  onFilterChange,
  activeFilters = {},
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<Record<string, string>>(activeFilters);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      onSearch(value);
    },
    [onSearch]
  );

  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      const updated = { ...localFilters, [key]: value };
      if (!value) delete updated[key];
      setLocalFilters(updated);
      onFilterChange?.(updated);
    },
    [localFilters, onFilterChange]
  );

  const clearFilters = useCallback(() => {
    setLocalFilters({});
    onFilterChange?.({});
  }, [onFilterChange]);

  const activeFilterCount = Object.keys(localFilters).filter((k) => localFilters[k]).length;

  return (
    <div className="w-full space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
          {query && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {filters.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="relative flex items-center gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge className="bg-blue-600 text-white text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      {filtersOpen && filters.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Filters</h4>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline">
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filters.map((filter) => (
              <div key={filter.key}>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  {filter.label}
                </label>
                {filter.type === 'select' ? (
                  <select
                    value={localFilters[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All</option>
                    {filter.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : filter.type === 'date' ? (
                  <input
                    type="date"
                    value={localFilters[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={localFilters[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    placeholder={`Filter by ${filter.label.toLowerCase()}`}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Active filter badges */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
              {Object.entries(localFilters)
                .filter(([, v]) => v)
                .map(([key, value]) => {
                  const filterDef = filters.find((f) => f.key === key);
                  const label = filterDef?.options?.find((o) => o.value === value)?.label || value;
                  return (
                    <Badge
                      key={key}
                      className="bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200"
                      onClick={() => handleFilterChange(key, '')}
                    >
                      {filterDef?.label}: {label}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(GlobalSearch);
