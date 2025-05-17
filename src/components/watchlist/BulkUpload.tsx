import React, { useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, FileText, ChevronDown } from 'lucide-react';
import { Company } from '../../api';
import { useWatchlist } from '../../context/WatchlistContext';
import axios from 'axios';

interface BulkUploadProps {
  onClose: () => void;
  watchlistId?: string;
}

const BulkUpload: React.FC<BulkUploadProps> = ({ onClose, watchlistId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedCompanies, setUploadedCompanies] = useState<Company[]>([]);
  const [uploadSummary, setUploadSummary] = useState<{
    total: number;
    success: number;
    failed: number;
    duplicates: number;
  }>({ total: 0, success: 0, failed: 0, duplicates: 0 });
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(watchlistId || null);
  const [showWatchlistDropdown, setShowWatchlistDropdown] = useState(false);
  
  const { 
    watchlists, 
    bulkAddToWatchlist, 
    isWatchListId
  } = useWatchlist();
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file type - allow only CSV
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setErrorMessage('Please upload a CSV file');
        setUploadStatus('error');
        return;
      }
      
      setFile(selectedFile);
      setUploadStatus('idle');
      setErrorMessage('');
    }
  };
  
  const handleUpload = async () => {
    if (!file) {
      setErrorMessage('Please select a file to upload');
      setUploadStatus('error');
      return;
    }
    
    if (!selectedWatchlistId) {
      setErrorMessage('Please select a watchlist');
      setUploadStatus('error');
      return;
    }
    
    setIsUploading(true);
    setUploadStatus('idle');
    
    try {
      // Read the file as text
      const text = await file.text();
      
      // Split into lines and parse
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Check for required columns (symbol/ticker and name)
      const symbolIndex = headers.findIndex(h => 
        h.toLowerCase() === 'symbol' || h.toLowerCase() === 'ticker');
      const nameIndex = headers.findIndex(h => 
        h.toLowerCase() === 'name' || h.toLowerCase() === 'company');
      
      // Check for optional columns (isin)
      const isinIndex = headers.findIndex(h => 
        h.toLowerCase() === 'isin');
      const industryIndex = headers.findIndex(h => 
        h.toLowerCase() === 'industry');
      
      if (symbolIndex === -1 && nameIndex === -1 && isinIndex === -1) {
        throw new Error('CSV must contain at least one identifier column: Symbol/Ticker, Name/Company, or ISIN');
      }
      
      // Parse companies
      const companiesFromCSV: Partial<Company>[] = [];
      let duplicatesCount = 0;
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const columns = lines[i].split(',').map(col => col.trim());
        
        if (columns.length >= Math.max(symbolIndex >= 0 ? symbolIndex : 0, 
                                    nameIndex >= 0 ? nameIndex : 0, 
                                    isinIndex >= 0 ? isinIndex : 0) + 1) {
          const companyData: Partial<Company> = {};
          
          if (symbolIndex !== -1 && columns[symbolIndex]) {
            companyData.symbol = columns[symbolIndex];
          }
          
          if (nameIndex !== -1 && columns[nameIndex]) {
            companyData.name = columns[nameIndex];
          }
          
          if (isinIndex !== -1 && columns[isinIndex]) {
            companyData.isin = columns[isinIndex];
          }
          
          if (industryIndex !== -1 && columns[industryIndex]) {
            companyData.industry = columns[industryIndex];
          }
          
          if (Object.keys(companyData).length > 0) {
            companiesFromCSV.push(companyData);
          }
        }
      }
      
      if (companiesFromCSV.length === 0) {
        throw new Error('No valid companies found in the CSV');
      }
      
      // Try to find matching companies in the database
      const validatedCompanies: Company[] = [];
      const failedCompanies: Partial<Company>[] = [];
      let successCount = 0;
      
      // Process each company by making individual queries
      for (const companyData of companiesFromCSV) {
        try {
          // Build query parameter based on available identifiers
          let queryParam = '';
          if (companyData.symbol) {
            queryParam = `q=${encodeURIComponent(companyData.symbol)}`;
          } else if (companyData.name) {
            queryParam = `q=${encodeURIComponent(companyData.name)}`;
          } else if (companyData.isin) {
            queryParam = `q=${encodeURIComponent(companyData.isin)}`;
          }
          
          // Skip if no query parameter
          if (!queryParam) {
            failedCompanies.push(companyData);
            continue;
          }
          
          // Make API call to search for the company
          const response = await axios.get(`/api/company-search?${queryParam}`);
          
          if (response.data && response.data.length > 0) {
            // Get the first matching company
            const foundCompany = response.data[0];
            
            // Check if already in watchlist
            if (isWatched(foundCompany.id, selectedWatchlistId)) {
              duplicatesCount++;
              continue;
            }
            
            // Create complete company object
            const completeCompany: Company = {
              id: foundCompany.id,
              symbol: foundCompany.symbol || companyData.symbol || '',
              name: foundCompany.name || companyData.name || '',
              isin: foundCompany.isin || companyData.isin || '',
              industry: foundCompany.industry || companyData.industry || ''
            };
            
            validatedCompanies.push(completeCompany);
            successCount++;
          } else {
            // If API doesn't find a match, create a company with a temporary ID
            if (companyData.symbol && companyData.name) {
              const tempCompany: Company = {
                id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                symbol: companyData.symbol,
                name: companyData.name || '',
                isin: companyData.isin || '',
                industry: companyData.industry || ''
              };
              
              validatedCompanies.push(tempCompany);
              successCount++;
            } else {
              failedCompanies.push(companyData);
            }
          }
        } catch (error) {
          console.error('Error processing company:', companyData, error);
          failedCompanies.push(companyData);
        }
      }
      
      // Update summary stats
      setUploadSummary({
        total: companiesFromCSV.length,
        success: successCount,
        failed: failedCompanies.length,
        duplicates: duplicatesCount
      });
      
      // Add validated companies to watchlist
      if (validatedCompanies.length > 0 && selectedWatchlistId) {
        setUploadedCompanies(validatedCompanies);
        bulkAddToWatchlist(validatedCompanies, selectedWatchlistId);
        setUploadStatus('success');
      } else {
        if (duplicatesCount > 0 && failedCompanies.length === 0) {
          setErrorMessage(`All ${duplicatesCount} companies are already in your watchlist.`);
        } else {
          setErrorMessage('Could not add any companies to your watchlist. Please check the format of your CSV file.');
        }
        setUploadStatus('error');
      }
    } catch (error) {
      console.error('Error processing CSV:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process the file');
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Generate a simple CSV template for download
  const generateCSVTemplate = () => {
    const templateData = 'Symbol,Name,ISIN,Industry\nRELIANCE,Reliance Industries Ltd,INE002A01018,Oil & Gas\nTCS,Tata Consultancy Services Ltd,INE467B01029,Computer Software';
    const blob = new Blob([templateData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'watchlist_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Get selected watchlist name
  const getSelectedWatchlistName = () => {
    if (!selectedWatchlistId) return 'Select a watchlist';
    const watchlist = watchlists.find(w => w.id === selectedWatchlistId);
    return watchlist ? watchlist.name : 'Select a watchlist';
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-float w-full max-w-lg overflow-hidden animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Bulk Add Companies</h3>
            <button 
              className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
          
          {uploadStatus === 'success' ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Upload Complete</h4>
              <div className="text-sm text-gray-600 mb-6">
                <p className="mb-2">
                  {uploadedCompanies.length} companies have been added to your watchlist.
                </p>
                <div className="bg-gray-50 rounded-xl p-4 mt-4 text-left">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between px-2 py-1">
                      <span className="text-gray-500">Total companies:</span>
                      <span className="font-medium">{uploadSummary.total}</span>
                    </div>
                    <div className="flex justify-between px-2 py-1 bg-emerald-50 rounded">
                      <span className="text-gray-500">Successfully added:</span>
                      <span className="font-medium text-emerald-600">{uploadSummary.success}</span>
                    </div>
                    {uploadSummary.duplicates > 0 && (
                      <div className="flex justify-between px-2 py-1 bg-amber-50 rounded">
                        <span className="text-gray-500">Already in watchlist:</span>
                        <span className="font-medium text-amber-600">{uploadSummary.duplicates}</span>
                      </div>
                    )}
                    {uploadSummary.failed > 0 && (
                      <div className="flex justify-between px-2 py-1 bg-rose-50 rounded">
                        <span className="text-gray-500">Failed to add:</span>
                        <span className="font-medium text-rose-600">{uploadSummary.failed}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button
                className="px-5 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-900 focus:outline-none"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  Upload a CSV file containing company information. The CSV should include at least one of the following: Symbol/Ticker, Company Name, or ISIN.
                </p>
                
                {/* Select Watchlist Dropdown */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Watchlist
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      onClick={() => setShowWatchlistDropdown(!showWatchlistDropdown)}
                    >
                      <span>{getSelectedWatchlistName()}</span>
                      <ChevronDown size={16} className={`transition-transform ${showWatchlistDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showWatchlistDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-md">
                        <ul className="py-1 max-h-60 overflow-y-auto">
                          {watchlists.map(watchlist => (
                            <li key={watchlist.id}>
                              <button
                                type="button"
                                className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50 ${
                                  selectedWatchlistId === watchlist.id ? 'bg-gray-50 font-medium text-black' : 'text-gray-700'
                                }`}
                                onClick={() => {
                                  setSelectedWatchlistId(watchlist.id);
                                  setShowWatchlistDropdown(false);
                                }}
                              >
                                {watchlist.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* File upload zone */}
                <div 
                  className={`border-2 border-dashed rounded-xl p-8 text-center ${
                    file ? 'border-black/30 bg-gray-50' : 'border-gray-200 hover:border-black/30'
                  }`}
                >
                  {file ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center mr-3">
                          <FileText size={20} className="text-gray-500" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium text-gray-900">{file.name}</div>
                          <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      <button
                        className="text-gray-400 hover:text-gray-900"
                        onClick={() => setFile(null)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center">
                      <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                        <Upload size={24} className="text-gray-400" />
                      </div>
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        Drag and drop your CSV file here
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        or browse to upload
                      </div>
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <div className="px-4 py-2 text-xs font-medium text-white bg-black rounded-lg hover:bg-gray-900">
                        Browse Files
                      </div>
                    </label>
                  )}
                </div>
                
                {/* Error message */}
                {uploadStatus === 'error' && (
                  <div className="mt-4 p-3 bg-rose-50 text-rose-700 rounded-lg flex items-start">
                    <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">{errorMessage}</div>
                  </div>
                )}
                
                {/* Template download link */}
                <div className="mt-4 text-sm text-gray-600">
                  Need a template? <button onClick={generateCSVTemplate} className="text-black underline hover:text-gray-600">Download CSV template</button>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none"
                  onClick={onClose}
                >
                  Cancel
                </button>
                
                <button
                  className="px-5 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-900 focus:outline-none disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={handleUpload}
                  disabled={!file || !selectedWatchlistId || isUploading}
                >
                  {isUploading ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⟳</span>
                      Uploading...
                    </>
                  ) : (
                    'Upload'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUpload;