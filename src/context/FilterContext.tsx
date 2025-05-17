import React, { createContext, useContext, useState } from 'react';

// Helper function to get formatted date strings
const getFormattedDate = (date: Date): string => {
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
};

// Default date range: 30 days ago to today
const today = new Date();
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const defaultDateRange = {
  start: getFormattedDate(thirtyDaysAgo),
  end: getFormattedDate(today)
};

// Define the filter state interface
interface FilterState {
  searchTerm: string;
  dateRange: {
    start: string;
    end: string;
  };
  selectedCompany: string | null;
  selectedCategories: string[];
  selectedSentiments: string[];
  selectedIndustries: string[];
}

// Define the filter context interface
interface FilterContextType {
  filters: FilterState;
  setSearchTerm: (term: string) => void;
  setDateRange: (start: string, end: string) => void;
  setSelectedCompany: (company: string | null) => void;
  setSelectedCategories: (categories: string[]) => void;
  setSelectedSentiments: (sentiments: string[]) => void;
  setSelectedIndustries: (industries: string[]) => void;
}

// Create the context with a default value
const FilterContext = createContext<FilterContextType>({
  filters: {
    searchTerm: '',
    dateRange: defaultDateRange,
    selectedCompany: null,
    selectedCategories: [],
    selectedSentiments: [],
    selectedIndustries: []
  },
  setSearchTerm: () => {},
  setDateRange: () => {},
  setSelectedCompany: () => {},
  setSelectedCategories: () => {},
  setSelectedSentiments: () => {},
  setSelectedIndustries: () => {}
});

// Create a provider component
export const FilterProvider = ({ children }: { children: React.ReactNode }) => {
  // Initialize state with defaults
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    dateRange: defaultDateRange,
    selectedCompany: null,
    selectedCategories: [],
    selectedSentiments: [],
    selectedIndustries: []
  });

  // Define update functions
  const setSearchTerm = (term: string) => {
    setFilters(prev => ({ ...prev, searchTerm: term }));
  };

  const setDateRange = (start: string, end: string) => {
    console.log(`Setting date range: start=${start}, end=${end}`);
    
    // Validate dates are in correct format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    // Use default if invalid
    const validStart = dateRegex.test(start) ? start : defaultDateRange.start;
    const validEnd = dateRegex.test(end) ? end : defaultDateRange.end;
    
    if (validStart !== start) {
      console.warn(`Invalid start date format: ${start}. Using ${validStart} instead.`);
    }
    
    if (validEnd !== end) {
      console.warn(`Invalid end date format: ${end}. Using ${validEnd} instead.`);
    }
    
    setFilters(prev => ({
      ...prev,
      dateRange: { start: validStart, end: validEnd }
    }));
  };

  const setSelectedCompany = (company: string | null) => {
    setFilters(prev => ({ ...prev, selectedCompany: company }));
  };

  const setSelectedCategories = (categories: string[]) => {
    setFilters(prev => ({ ...prev, selectedCategories: categories }));
  };

  const setSelectedSentiments = (sentiments: string[]) => {
    setFilters(prev => ({ ...prev, selectedSentiments: sentiments }));
  };

  const setSelectedIndustries = (industries: string[]) => {
    setFilters(prev => ({ ...prev, selectedIndustries: industries }));
  };

  // Value to be provided
  const value = {
    filters,
    setSearchTerm,
    setDateRange,
    setSelectedCompany,
    setSelectedCategories,
    setSelectedSentiments,
    setSelectedIndustries
  };

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
};

// Create a custom hook to use the filter context
export const useFilters = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};