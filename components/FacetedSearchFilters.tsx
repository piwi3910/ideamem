'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FunnelIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { SearchFacet, FacetFilters, FacetAnalysis, FilterSuggestion } from '../lib/search-facets';

interface FacetedSearchFiltersProps {
  facetAnalysis: FacetAnalysis | null;
  onFiltersChange: (filters: FacetFilters) => void;
  onRefreshFacets: () => void;
  loading?: boolean;
  compact?: boolean;
}

export default function FacetedSearchFilters({
  facetAnalysis,
  onFiltersChange,
  onRefreshFacets,
  loading = false,
  compact = false,
}: FacetedSearchFiltersProps) {
  const [expandedFacets, setExpandedFacets] = useState<Set<string>>(
    new Set(['contentTypes', 'languages', 'complexity'])
  );
  const [currentFilters, setCurrentFilters] = useState<FacetFilters>({});
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [facetSearch, setFacetSearch] = useState('');

  // Update current filters when facet analysis changes
  useEffect(() => {
    if (facetAnalysis?.appliedFilters) {
      setCurrentFilters(facetAnalysis.appliedFilters);
    }
  }, [facetAnalysis]);

  const toggleFacet = (facetKey: string) => {
    const newExpanded = new Set(expandedFacets);
    if (newExpanded.has(facetKey)) {
      newExpanded.delete(facetKey);
    } else {
      newExpanded.add(facetKey);
    }
    setExpandedFacets(newExpanded);
  };

  const updateFilters = useCallback(
    (updatedFilters: FacetFilters) => {
      setCurrentFilters(updatedFilters);
      onFiltersChange(updatedFilters);
    },
    [onFiltersChange]
  );

  const handleCheckboxChange = (facetKey: string, value: any, checked: boolean) => {
    const currentValues = (currentFilters as any)[facetKey] || [];
    let newValues;

    if (checked) {
      newValues = [...currentValues, value];
    } else {
      newValues = currentValues.filter((v: any) => v !== value);
    }

    updateFilters({
      ...currentFilters,
      [facetKey]: newValues.length > 0 ? newValues : undefined,
    });
  };

  const handleRangeChange = (facetKey: string, min: number, max: number) => {
    updateFilters({
      ...currentFilters,
      [facetKey]: { min, max },
    });
  };

  const handleBooleanChange = (facetKey: string, value: boolean) => {
    updateFilters({
      ...currentFilters,
      [facetKey]: value,
    });
  };

  const handleDateRangeChange = (facetKey: string, start: Date, end: Date) => {
    updateFilters({
      ...currentFilters,
      [facetKey]: { start, end },
    });
  };

  const clearAllFilters = () => {
    setCurrentFilters({});
    onFiltersChange({});
  };

  const clearFilterGroup = (facetKey: string) => {
    const newFilters = { ...currentFilters };
    delete (newFilters as any)[facetKey];
    updateFilters(newFilters);
  };

  const applySuggestion = (suggestion: FilterSuggestion) => {
    let newFilters = { ...currentFilters };

    if (suggestion.type === 'add') {
      const currentValues = (newFilters as any)[suggestion.facetKey] || [];
      if (!currentValues.includes(suggestion.value)) {
        newFilters = {
          ...newFilters,
          [suggestion.facetKey]: [...currentValues, suggestion.value],
        };
      }
    } else if (suggestion.type === 'remove') {
      delete (newFilters as any)[suggestion.facetKey];
    }

    updateFilters(newFilters);
  };

  const getActiveFilterCount = () => {
    return Object.values(currentFilters).filter(
      (value) => value !== undefined && (Array.isArray(value) ? value.length > 0 : true)
    ).length;
  };

  const filteredFacets =
    facetAnalysis?.facets.filter(
      (facet) =>
        facetSearch === '' ||
        facet.name.toLowerCase().includes(facetSearch.toLowerCase()) ||
        facet.values.some((v) => v.label.toLowerCase().includes(facetSearch.toLowerCase()))
    ) || [];

  if (!facetAnalysis) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${compact ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <FunnelIcon className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Filters</h3>
          {getActiveFilterCount() > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              {getActiveFilterCount()} active
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onRefreshFacets}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            title="Refresh filters"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
          </button>
          {getActiveFilterCount() > 0 && (
            <button onClick={clearAllFilters} className="text-sm text-red-600 hover:text-red-800">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-6 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600">
          Showing{' '}
          <span className="font-semibold text-gray-900">
            {facetAnalysis.filteredDocuments.toLocaleString()}
          </span>{' '}
          of{' '}
          <span className="font-semibold text-gray-900">
            {facetAnalysis.totalDocuments.toLocaleString()}
          </span>{' '}
          documents
          {facetAnalysis.filteredDocuments < facetAnalysis.totalDocuments && (
            <span className="text-blue-600 ml-1">
              ({Math.round((facetAnalysis.filteredDocuments / facetAnalysis.totalDocuments) * 100)}%
              filtered)
            </span>
          )}
        </div>
      </div>

      {/* Filter Suggestions */}
      {showSuggestions && facetAnalysis.suggestions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <SparklesIcon className="h-4 w-4 text-purple-600" />
              <h4 className="text-sm font-medium text-gray-900">Smart Suggestions</h4>
            </div>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {facetAnalysis.suggestions.slice(0, 3).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => applySuggestion(suggestion)}
                className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <div className="text-sm font-medium text-purple-900">{suggestion.label}</div>
                <div className="text-xs text-purple-700 mt-1">{suggestion.reason}</div>
                {suggestion.impact > 0 && (
                  <div className="text-xs text-purple-600 mt-1">+{suggestion.impact} documents</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Facet Search */}
      {!compact && filteredFacets.length > 3 && (
        <div className="mb-4">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search filters..."
              value={facetSearch}
              onChange={(e) => setFacetSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Facets */}
      <div className="space-y-4">
        {filteredFacets.map((facet) => (
          <FacetRenderer
            key={facet.key}
            facet={facet}
            expanded={expandedFacets.has(facet.key)}
            onToggle={() => toggleFacet(facet.key)}
            onCheckboxChange={handleCheckboxChange}
            onRangeChange={handleRangeChange}
            onBooleanChange={handleBooleanChange}
            onDateRangeChange={handleDateRangeChange}
            onClear={() => clearFilterGroup(facet.key)}
            compact={compact}
          />
        ))}
      </div>

      {filteredFacets.length === 0 && facetSearch !== '' && (
        <div className="text-center py-8 text-gray-500">
          <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No filters match "{facetSearch}"</p>
          <button
            onClick={() => setFacetSearch('')}
            className="text-blue-600 hover:text-blue-800 text-sm mt-2"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}

// Individual facet renderer component
function FacetRenderer({
  facet,
  expanded,
  onToggle,
  onCheckboxChange,
  onRangeChange,
  onBooleanChange,
  onDateRangeChange,
  onClear,
  compact,
}: {
  facet: SearchFacet;
  expanded: boolean;
  onToggle: () => void;
  onCheckboxChange: (facetKey: string, value: any, checked: boolean) => void;
  onRangeChange: (facetKey: string, min: number, max: number) => void;
  onBooleanChange: (facetKey: string, value: boolean) => void;
  onDateRangeChange: (facetKey: string, start: Date, end: Date) => void;
  onClear: () => void;
  compact: boolean;
}) {
  const hasSelectedValues = facet.selectedValues && facet.selectedValues.length > 0;

  return (
    <div className="border border-gray-200 rounded-lg">
      {/* Facet Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <div className="flex items-center space-x-2">
          <span className="font-medium text-gray-900">{facet.name}</span>
          {hasSelectedValues && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
              {facet.selectedValues?.length || 0}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {hasSelectedValues && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="text-red-600 hover:text-red-800 text-xs"
            >
              Clear
            </button>
          )}
          {expanded ? (
            <ChevronUpIcon className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Facet Content */}
      {expanded && (
        <div className="px-4 pb-4">
          {facet.type === 'checkbox' && (
            <CheckboxFacet facet={facet} onCheckboxChange={onCheckboxChange} compact={compact} />
          )}

          {facet.type === 'range' && <RangeFacet facet={facet} onRangeChange={onRangeChange} />}

          {facet.type === 'select' && (
            <SelectFacet facet={facet} onCheckboxChange={onCheckboxChange} compact={compact} />
          )}

          {facet.type === 'boolean' && (
            <BooleanFacet facet={facet} onBooleanChange={onBooleanChange} />
          )}

          {facet.type === 'date_range' && (
            <DateRangeFacet facet={facet} onDateRangeChange={onDateRangeChange} />
          )}

          {facet.type === 'tags' && (
            <TagsFacet facet={facet} onCheckboxChange={onCheckboxChange} compact={compact} />
          )}
        </div>
      )}
    </div>
  );
}

// Checkbox facet component
function CheckboxFacet({
  facet,
  onCheckboxChange,
  compact,
}: {
  facet: SearchFacet;
  onCheckboxChange: (facetKey: string, value: any, checked: boolean) => void;
  compact: boolean;
}) {
  const displayLimit = compact ? 5 : 10;
  const [showAll, setShowAll] = useState(false);
  const displayValues = showAll ? facet.values : facet.values.slice(0, displayLimit);

  return (
    <div className="space-y-2">
      {displayValues.map((value, index) => (
        <label
          key={index}
          className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-1 rounded"
        >
          <input
            type="checkbox"
            checked={value.selected || false}
            onChange={(e) => onCheckboxChange(facet.key, value.value, e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1 flex items-center justify-between">
            <span className="text-sm text-gray-700">{value.label}</span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">{value.count}</span>
              {value.percentage !== undefined && (
                <div className="w-12 h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(value.percentage, 100)}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </label>
      ))}

      {facet.values.length > displayLimit && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showAll ? 'Show less' : `Show ${facet.values.length - displayLimit} more`}
        </button>
      )}
    </div>
  );
}

// Range facet component
function RangeFacet({
  facet,
  onRangeChange,
}: {
  facet: SearchFacet;
  onRangeChange: (facetKey: string, min: number, max: number) => void;
}) {
  const [minValue, maxValue] = facet.selectedValues || [facet.min, facet.max];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{minValue}</span>
        <span>{maxValue}</span>
      </div>
      <div className="px-2">
        <input
          type="range"
          min={facet.min}
          max={facet.max}
          step={facet.step}
          value={minValue}
          onChange={(e) => onRangeChange(facet.key, parseFloat(e.target.value), maxValue)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
        <input
          type="range"
          min={facet.min}
          max={facet.max}
          step={facet.step}
          value={maxValue}
          onChange={(e) => onRangeChange(facet.key, minValue, parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider mt-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min={facet.min}
          max={facet.max}
          step={facet.step}
          value={minValue}
          onChange={(e) =>
            onRangeChange(facet.key, parseFloat(e.target.value) || facet.min!, maxValue)
          }
          className="px-2 py-1 border border-gray-300 rounded text-sm"
          placeholder="Min"
        />
        <input
          type="number"
          min={facet.min}
          max={facet.max}
          step={facet.step}
          value={maxValue}
          onChange={(e) =>
            onRangeChange(facet.key, minValue, parseFloat(e.target.value) || facet.max!)
          }
          className="px-2 py-1 border border-gray-300 rounded text-sm"
          placeholder="Max"
        />
      </div>
    </div>
  );
}

// Select facet component (similar to checkbox but with search)
function SelectFacet({
  facet,
  onCheckboxChange,
  compact,
}: {
  facet: SearchFacet;
  onCheckboxChange: (facetKey: string, value: any, checked: boolean) => void;
  compact: boolean;
}) {
  const [search, setSearch] = useState('');
  const filteredValues = facet.values.filter((value) =>
    value.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {filteredValues.slice(0, compact ? 5 : 10).map((value, index) => (
          <label
            key={index}
            className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-1 rounded"
          >
            <input
              type="checkbox"
              checked={value.selected || false}
              onChange={(e) => onCheckboxChange(facet.key, value.value, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1 flex items-center justify-between">
              <span className="text-sm text-gray-700">{value.label}</span>
              <span className="text-xs text-gray-500">{value.count}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// Boolean facet component
function BooleanFacet({
  facet,
  onBooleanChange,
}: {
  facet: SearchFacet;
  onBooleanChange: (facetKey: string, value: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      {facet.values.map((value, index) => (
        <label
          key={index}
          className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-1 rounded"
        >
          <input
            type="radio"
            name={facet.key}
            checked={value.selected || false}
            onChange={() => onBooleanChange(facet.key, value.value as boolean)}
            className="border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1 flex items-center justify-between">
            <span className="text-sm text-gray-700">{value.label}</span>
            <span className="text-xs text-gray-500">{value.count}</span>
          </div>
        </label>
      ))}
    </div>
  );
}

// Date range facet component
function DateRangeFacet({
  facet,
  onDateRangeChange,
}: {
  facet: SearchFacet;
  onDateRangeChange: (facetKey: string, start: Date, end: Date) => void;
}) {
  const [startDate, endDate] = (facet.selectedValues as [Date, Date]) || [new Date(), new Date()];

  return (
    <div className="grid grid-cols-1 gap-2">
      <div>
        <label className="block text-xs text-gray-500 mb-1">From</label>
        <input
          type="date"
          value={startDate.toISOString().split('T')[0]}
          onChange={(e) => onDateRangeChange(facet.key, new Date(e.target.value), endDate)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">To</label>
        <input
          type="date"
          value={endDate.toISOString().split('T')[0]}
          onChange={(e) => onDateRangeChange(facet.key, startDate, new Date(e.target.value))}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </div>
    </div>
  );
}

// Tags facet component (like checkbox but with pill design)
function TagsFacet({
  facet,
  onCheckboxChange,
  compact,
}: {
  facet: SearchFacet;
  onCheckboxChange: (facetKey: string, value: any, checked: boolean) => void;
  compact: boolean;
}) {
  const displayLimit = compact ? 8 : 15;
  const [showAll, setShowAll] = useState(false);
  const displayValues = showAll ? facet.values : facet.values.slice(0, displayLimit);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {displayValues.map((value, index) => (
          <button
            key={index}
            onClick={() => onCheckboxChange(facet.key, value.value, !value.selected)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              value.selected
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:text-blue-600'
            }`}
          >
            {value.label} <span className="text-xs opacity-75">({value.count})</span>
          </button>
        ))}
      </div>

      {facet.values.length > displayLimit && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showAll ? 'Show less' : `Show ${facet.values.length - displayLimit} more tags`}
        </button>
      )}
    </div>
  );
}
