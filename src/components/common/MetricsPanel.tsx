import React from 'react';
import { ProcessedAnnouncement } from '../../api';

interface MetricsPanelProps {
  announcements: ProcessedAnnouncement[];
}

const MetricsPanel: React.FC<MetricsPanelProps> = ({ announcements }) => {
  // Calculate dashboard metrics
  const metrics = {
    totalFilings: announcements.length,
    positiveFilings: announcements.filter(a => a.sentiment === 'Positive').length,
    positivePercentage: announcements.length > 0 ? 
      Math.round((announcements.filter(a => a.sentiment === 'Positive').length / announcements.length) * 100) : 0,
    topCategories: Object.entries(
      announcements.reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]).slice(0, 3)
  };
  
  return (
    <div className="px-6 pt-6 pb-4">
      <div className="flex space-x-6">
        {/* Positive Sentiment Metric - Apple-inspired design */}
        <div className="flex items-center bg-white rounded-2xl shadow-sm px-5 py-4 w-64 border border-gray-100">
          <div className="mr-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-emerald-500"></div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Positive Sentiment</div>
            <div className="flex items-baseline mt-1">
              <span className="text-2xl font-semibold text-gray-900">{metrics.positivePercentage}%</span>
              <span className="text-xs text-gray-500 ml-2">of filings</span>
            </div>
          </div>
        </div>
        
        {/* Total Filings Metric - Apple-inspired design */}
        <div className="flex items-center bg-white rounded-2xl shadow-sm px-5 py-4 w-64 border border-gray-100">
          <div className="mr-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-blue-500"></div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Total Filings</div>
            <div className="flex items-baseline mt-1">
              <span className="text-2xl font-semibold text-gray-900">{metrics.totalFilings}</span>
              <span className="text-xs text-gray-500 ml-2">in period</span>
            </div>
          </div>
        </div>
        
        {/* Top Category Metric - Apple-inspired design */}
        {metrics.topCategories.length > 0 && (
          <div className="flex items-center bg-white rounded-2xl shadow-sm px-5 py-4 w-64 border border-gray-100">
            <div className="mr-4">
              <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-violet-500"></div>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Top Category</div>
              <div className="flex items-baseline mt-1">
                <span className="text-lg font-semibold text-gray-900">{metrics.topCategories[0]?.[0] || "N/A"}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsPanel;