import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

// List of available categories
const availableCategories = [
  "Annual Report",
  "Agreements/MoUs",
  "Anti-dumping Duty",
  "Buyback",
  "Bonus/Stock Split",
  "Change in Address",
  "Change in MOA",
  "Clarifications/Confirmations",
  "Closure of Factory",
  "Concall Transcript",
  "Consolidation of Shares",
  "Credit Rating",
  "Debt Reduction",
  "Debt & Financing",
  "Delisting",
  "Demerger",
  "Change in KMP",
  "Demise of KMP",
  "Disruption of Operations",
  "Divestitures",
  "DRHP",
  "Expansion",
  "Financial Results",
  "Fundraise - Preferential Issue",
  "Fundraise - QIP",
  "Fundraise - Rights Issue",
  "Global Pharma Regulation",
  "Incorporation/Cessation of Subsidiary",
  "Increase in Share Capital",
  "Insolvency and Bankruptcy",
  "Interest Rates Updates",
  "Investor Presentation",
  "Investor/Analyst Meet",
  "Joint Ventures",
  "Litigation & Notices",
  "Mergers/Acquisitions",
  "Name Change",
  "New Order",
  "New Product",
  "One Time Settlement (OTS)",
  "Open Offer",
  "Operational Update",
  "PLI Scheme",
  "Procedural/Administrative",
  "Reduction in Share Capital",
  "Regulatory Approvals/Orders",
  "Trading Suspension",
  "USFDA"
];

interface CategorySelectorProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategories,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Filter categories based on search term
  const filteredCategories = availableCategories.filter(category => 
    category.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Toggle category selection
  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      onChange(selectedCategories.filter(c => c !== category));
    } else {
      onChange([...selectedCategories, category]);
    }
  };
  
  // Group categories by first letter for better organization
  const groupedCategories: Record<string, string[]> = {};
  
  filteredCategories.forEach(category => {
    const firstLetter = category.charAt(0).toUpperCase();
    if (!groupedCategories[firstLetter]) {
      groupedCategories[firstLetter] = [];
    }
    groupedCategories[firstLetter].push(category);
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected categories display */}
      <div 
        className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedCategories.length > 0 ? (
          selectedCategories.map(category => (
            <div 
              key={category}
              className="inline-flex items-center bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-sm font-medium"
            >
              {category}
              <button
                className="ml-1.5 text-indigo-400 hover:text-indigo-600"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCategory(category);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          ))
        ) : (
          <div className="text-gray-500">Select categories...</div>
        )}
        <div className="ml-auto flex items-center">
          <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>
      
      {/* Dropdown for category selection */}
      {isOpen && (
        <div className="absolute z-40 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="sticky top-0 p-2 bg-white border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search categories..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border-none rounded-lg text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-72">
            {Object.keys(groupedCategories).sort().map(letter => (
              <div key={letter} className="mb-2">
                <div className="text-xs font-semibold text-gray-500 uppercase p-2">{letter}</div>
                <div>
                  {groupedCategories[letter].map(category => (
                    <div
                      key={category}
                      className={`flex items-center justify-between px-3 py-2 cursor-pointer ${
                        selectedCategories.includes(category)
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                      onClick={() => toggleCategory(category)}
                    >
                      <span className="text-sm">{category}</span>
                      {selectedCategories.includes(category) && (
                        <Check size={16} className="text-indigo-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {filteredCategories.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No categories match your search
              </div>
            )}
          </div>
          
          <div className="sticky bottom-0 p-2 border-t border-gray-100 bg-white">
            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-500">
                {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected
              </div>
              <button
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                onClick={() => setIsOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategorySelector;