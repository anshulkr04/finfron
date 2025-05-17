import React from 'react';
import { ArrowLeft, Star, ChevronRight, ExternalLink, Calendar, Tag, CircleDot } from 'lucide-react';
import { ProcessedAnnouncement } from '../../api';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
// Import the required plugins for table support
import remarkGfm from 'remark-gfm';

interface DetailPanelProps {
  announcement: ProcessedAnnouncement;
  isSaved: boolean;
  onClose: () => void;
  onSave: (id: string) => void;
  onViewAllAnnouncements: (company: string) => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  announcement,
  isSaved,
  onClose,
  onSave,
  onViewAllAnnouncements
}) => {
  // Helper function to sanitize and prepare markdown content
  const prepareMarkdown = (text: string): string => {
    if (!text) return '';
    
    // Convert pipe-separated text to proper markdown tables
    const lines = text.split('\n');
    let inTable = false;
    let tableStart = -1;
    let enhancedText = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect the start of a potential pipe-table (has multiple pipe characters)
      if (!inTable && line.split('|').length > 2 && line.includes('|')) {
        inTable = true;
        tableStart = i;
        enhancedText += line + '\n';
      } 
      // If we're in a table and the line doesn't have pipes or is empty, end the table
      else if (inTable && (line.split('|').length <= 2 || line.trim() === '')) {
        inTable = false;
        
        // Go back and insert proper markdown table formatting
        const tableLines = lines.slice(tableStart, i);
        if (tableLines.length > 0) {
          // Get the header row
          const headerRow = tableLines[0];
          const columns = headerRow.split('|').filter(col => col.trim() !== '').length;
          
          // Create a separation row for markdown tables if it doesn't exist
          const needsSeparator = tableLines.length === 1 || 
                               !tableLines[1].includes('---') ||
                               tableLines[1].split('|').length <= 2;
          
          if (needsSeparator) {
            const separationRow = '|' + Array(columns).fill('---').join('|') + '|';
            
            // Insert the separation row after the header
            enhancedText = enhancedText.replace(headerRow + '\n', headerRow + '\n' + separationRow + '\n');
          }
        }
        
        enhancedText += line + '\n';
      } 
      else {
        enhancedText += line + '\n';
      }
    }
    
    // Handle case where table is at the end of the text
    if (inTable) {
      const tableLines = lines.slice(tableStart);
      if (tableLines.length > 0) {
        const headerRow = tableLines[0];
        const columns = headerRow.split('|').filter(col => col.trim() !== '').length;
        
        // Check if there's already a separator row
        const needsSeparator = tableLines.length === 1 || 
                             !tableLines[1].includes('---') ||
                             tableLines[1].split('|').length <= 2;
        
        if (needsSeparator) {
          const separationRow = '|' + Array(columns).fill('---').join('|') + '|';
          enhancedText = enhancedText.replace(headerRow + '\n', headerRow + '\n' + separationRow + '\n');
        }
      }
    }
    
    // Add line breaks before headings
    enhancedText = enhancedText
      .replace(/^(#{1,6})/gm, '\n$1')
      // Ensure proper spacing for lists
      .replace(/^([*-])/gm, '\n$1')
      // Fix common markdown syntax issues
      .replace(/(?<!\*)\*(?!\*)/g, '\\*') // Escape single asterisks not used for emphasis
      .replace(/(?<!_)_(?!_)/g, '\\_'); // Escape single underscores not used for emphasis
    
    return enhancedText;
  };

  // Extract category and headline from API response if available
  const getCategory = () => {
    if (announcement.summary) {
      const categoryMatch = announcement.summary.match(/\*\*Category:\*\*\s*([A-Za-z0-9\s&]+)/i);
      return categoryMatch && categoryMatch[1] ? categoryMatch[1].trim() : announcement.category;
    }
    return announcement.category;
  };

  const getHeadline = () => {
    if (announcement.summary) {
      const headlineMatch = announcement.summary.match(/\*\*Headline:\*\*\s*([^\n]+)/i);
      return headlineMatch && headlineMatch[1] ? headlineMatch[1].trim() : '';
    }
    return '';
  };

  // Special handler for text that looks like a table but isn't formatted as markdown
  const renderContent = () => {
    // For content that looks like a voting result table (has lots of pipe characters)
    if (announcement.detailedContent && announcement.detailedContent.includes('voting results') && 
        announcement.detailedContent.split('|').length > 10) {
      return (
        <div className="text-sm text-gray-600 leading-relaxed">
          <div dangerouslySetInnerHTML={{ 
            __html: formatVotingTable(announcement.detailedContent) 
          }} />
        </div>
      );
    }
    
    // Otherwise use normal markdown rendering with table support
    return (
      <div className="text-sm text-gray-600 leading-relaxed">
        <div className="markdown-wrapper">
          <ReactMarkdown 
            rehypePlugins={[rehypeRaw]}
            remarkPlugins={[remarkGfm]} // Add remarkGfm for table support
          >
            {prepareMarkdown(announcement.detailedContent)}
          </ReactMarkdown>
        </div>
      </div>
    );
  };
  
  // Special formatter for voting result tables
  const formatVotingTable = (content: string) => {
    const lines = content.split('\n');
    let formattedHtml = '';
    let inTableSection = false;
    
    lines.forEach(line => {
      // Detect headings and item titles
      if (line.startsWith('Item No.') || /^[A-Za-z\s]+:/.test(line)) {
        if (inTableSection) {
          formattedHtml += '</table>';
          inTableSection = false;
        }
        formattedHtml += `<h3 class="text-lg font-medium my-4">${line}</h3>`;
      }
      // Detect table headers or rows (contains multiple pipe characters)
      else if (line.split('|').length > 3) {
        if (!inTableSection) {
          formattedHtml += '<table class="min-w-full divide-y divide-gray-200 my-4">';
          inTableSection = true;
          
          // Add special handling for header rows
          if (line.includes('Particulars') || line.includes('No. of Members')) {
            formattedHtml += '<thead><tr>';
            line.split('|').forEach(cell => {
              if (cell.trim()) {
                formattedHtml += `<th class="px-3 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${cell.trim()}</th>`;
              }
            });
            formattedHtml += '</tr></thead><tbody>';
            return;
          }
        }
        
        // Regular table rows
        formattedHtml += '<tr>';
        line.split('|').forEach(cell => {
          if (cell.trim() === '--------------------' || cell.trim().startsWith(':---')) {
            return; // Skip separator rows
          }
          formattedHtml += `<td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${cell.trim()}</td>`;
        });
        formattedHtml += '</tr>';
      }
      // Empty lines or non-table content
      else {
        if (inTableSection) {
          formattedHtml += '</tbody></table>';
          inTableSection = false;
        }
        if (line.trim()) {
          formattedHtml += `<p class="my-2">${line}</p>`;
        }
      }
    });
    
    // Close any open table
    if (inTableSection) {
      formattedHtml += '</tbody></table>';
    }
    
    return formattedHtml;
  };

  return (
    <div className="fixed right-0 top-0 w-2/5 h-full bg-white shadow-lg z-30 overflow-y-auto transform transition-transform duration-300 ease-out border-l border-gray-100">
      <style>{`
        .markdown-wrapper {
          font-size: 14px;
          line-height: 1.6;
        }
        
        .markdown-wrapper h1 {
          font-size: 1.8em;
          margin-top: 1em;
          margin-bottom: 0.5em;
          font-weight: 600;
        }
        
        .markdown-wrapper h2 {
          font-size: 1.5em;
          margin-top: 1em;
          margin-bottom: 0.5em;
          font-weight: 600;
        }
        
        .markdown-wrapper h3 {
          font-size: 1.3em;
          margin-top: 1em;
          margin-bottom: 0.5em;
          font-weight: 600;
        }
        
        .markdown-wrapper p {
          margin-bottom: 1em;
        }
        
        .markdown-wrapper ul, 
        .markdown-wrapper ol {
          margin-bottom: 1em;
          padding-left: 2em;
        }
        
        .markdown-wrapper li {
          margin-bottom: 0.5em;
        }
        
        .markdown-wrapper pre {
          background-color: #f5f5f5;
          padding: 1em;
          border-radius: 4px;
          overflow-x: auto;
          margin-bottom: 1em;
        }
        
        .markdown-wrapper code {
          background-color: #f5f5f5;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: monospace;
        }
        
        .markdown-wrapper blockquote {
          border-left: 4px solid #ddd;
          padding-left: 1em;
          margin-left: 0;
          color: #666;
          margin-bottom: 1em;
        }
        
        .markdown-wrapper table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 1em;
          margin-top: 1em;
        }
        
        .markdown-wrapper th, 
        .markdown-wrapper td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        
        .markdown-wrapper th {
          background-color: #f5f5f5;
        }
      `}</style>

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <button 
            className="p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100/80 transition-colors"
            onClick={onClose}
          >
            <ArrowLeft size={18} />
          </button>
          <button 
            className="p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100/80 transition-colors"
            onClick={() => onSave(announcement.id)}
          >
            {isSaved ? 
              <Star size={18} className="fill-current text-black" /> : 
              <Star size={18} />}
          </button>
        </div>
        
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{announcement.company}</h2>
          <div className="flex items-center mt-2">
            <span className="px-2.5 py-0.5 text-sm font-medium rounded-full bg-gray-100/80 text-gray-800 border border-gray-100/60">
              {announcement.ticker}
            </span>
            <button
              className="ml-2 text-xs text-gray-500 hover:text-black px-2 py-1 rounded-full hover:bg-gray-100/80 flex items-center transition-colors"
              onClick={() => onViewAllAnnouncements(announcement.company)}
            >
              View all announcements <ChevronRight size={12} className="ml-1" />
            </button>
          </div>
        </div>

        {getHeadline() && (
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">{getHeadline()}</h3>
          </div>
        )}
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-start">
              <Tag size={16} className="text-gray-400 mt-0.5 mr-2" />
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase mb-1">Category</div>
                <div className="text-sm font-medium text-gray-900">{getCategory()}</div>
              </div>
            </div>
            
            <div className="flex items-start">
              <Calendar size={16} className="text-gray-400 mt-0.5 mr-2" />
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase mb-1">Date</div>
                <div className="text-sm font-medium text-gray-900">{announcement.date}</div>
              </div>
            </div>
          </div>
          
          <div className="flex items-start">
            <CircleDot size={16} className="text-gray-400 mt-0.5 mr-2" />
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Sentiment</div>
              <div className="flex items-center">
                <span className={`inline-block w-2.5 h-2.5 mr-2 rounded-full ${
                  announcement.sentiment === 'Positive' ? 'bg-emerald-500' :
                  announcement.sentiment === 'Negative' ? 'bg-rose-500' : 'bg-amber-400'
                } shadow-sm`}></span>
                <span className="text-sm font-medium text-gray-900">{announcement.sentiment}</span>
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Summary</div>
            <div className="text-sm text-gray-600 leading-relaxed p-4 bg-gray-50/70 rounded-2xl border border-gray-100/60">
              <div className="markdown-wrapper">
                <ReactMarkdown 
                  rehypePlugins={[rehypeRaw]}
                  remarkPlugins={[remarkGfm]} // Add remarkGfm for table support in summary
                >
                  {prepareMarkdown(announcement.summary)}
                </ReactMarkdown>
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Details</div>
            {renderContent()}
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-100">
          {announcement.url && (
            <a 
              href={announcement.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-full hover:bg-gray-100/80 border border-gray-100/60 transition-colors"
            >
              <span>View original filing</span>
              <ExternalLink size={14} className="ml-2" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailPanel;