import axios from 'axios';

// Types for the Angel One API responses
export interface AngelOneQuote {
  symbolToken: string;
  symbolName: string;
  tradingSymbol: string;
  exchange: string;
  companyName: string;
  ltp: number;
  percentageChange: number;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap?: number;
  yearHigh?: number;
  yearLow?: number;
  pe?: number;
  eps?: number;
  bookValue?: number;
}

export interface CompanyProfile {
  name: string;
  description: string;
  website?: string;
  industry: string;
  sector: string;
  founded?: string;
  ceo?: string;
  headquarters?: string;
  marketCap?: number;
  employees?: number;
}

export interface HistoricalData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CompanyInfo {
  symbol: string;
  token: string;
  name: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: any;
}

class AngelOneService {
  private apiUrl: string = '/api/stock'; // Using relative URL for proxy
  private companies: CompanyInfo[] = [];
  private isLoaded: boolean = false;
  private debugMode: boolean = true; // Set to true to see detailed logs

  constructor() {
    // Load company info when service is instantiated
    this.loadCompanyInfo();
  }

  // Helper method for logging
  private log(...args: any[]) {
    if (this.debugMode) {
      console.log('[AngelOneService]', ...args);
    }
  }

  /**
   * Load company information
   */
  async loadCompanyInfo(): Promise<CompanyInfo[]> {
    try {
      this.log('Loading company information...');
      const response = await axios.get<ApiResponse<CompanyInfo[]>>(`${this.apiUrl}/company_info`);
      
      if (response.data?.success && response.data.data) {
        this.companies = response.data.data;
        this.isLoaded = true;
        this.log(`Loaded ${this.companies.length} companies`);
        return this.companies;
      }
      
      this.log('Failed to load company info:', response.data?.message || 'Unknown error');
      return [];
    } catch (error) {
      this.log('Error loading company information:', error);
      return [];
    }
  }

  /**
   * Check if the service is authenticated with Angel One
   */
  isAuthenticated(): boolean {
    // We don't have a reliable way to check authentication status
    // without making an API call, so we'll just return true
    return true;
  }

  /**
   * Get token for a company symbol
   */
  async getTokenForSymbol(symbol: string): Promise<string | null> {
    try {
      // Wait for companies to load if not already loaded
      if (!this.isLoaded) {
        await this.loadCompanyInfo();
      }
      
      const company = this.companies.find(c => c.symbol.toUpperCase() === symbol.toUpperCase());
      if (company) {
        this.log(`Found token for ${symbol}: ${company.token}`);
        return company.token;
      }
      
      this.log(`Token not found for symbol: ${symbol}`);
      return null;
    } catch (error) {
      this.log('Error getting token for symbol:', error);
      return null;
    }
  }

  /**
   * Get stock quote from symbol
   */
  async getQuote(symbol: string): Promise<AngelOneQuote | null> {
    try {
      this.log(`Getting quote for ${symbol}...`);
      
      // Get token for symbol
      const token = await this.getTokenForSymbol(symbol);
      
      if (!token) {
        this.log(`Token not found for symbol: ${symbol}, using mock data`);
        return this.getMockQuote(symbol);
      }
      
      this.log(`Fetching quote data for ${symbol} with token ${token}`);
      const response = await axios.get<ApiResponse<any>>(`${this.apiUrl}/quote`, {
        params: {
          symbol_token: token,
          trading_symbol: symbol,
          exchange: "NSE"
        }
      });
      
      if (response.data?.success && response.data.data) {
        this.log('Quote data received successfully');
        const data = response.data.data;
        const ltp = data[`NSE:${symbol}`]?.ltp || 0;
        
        // Get previous close from historical data to calculate percentage change
        const historicalData = await this.getHistoricalData(symbol, "NSE", "ONE_DAY", 2);
        
        let close = ltp;
        let percentageChange = 0;
        
        if (historicalData && historicalData.length > 0) {
          close = historicalData[0].close;
          percentageChange = ((ltp - close) / close) * 100;
        }
        
        const company = this.companies.find(c => c.symbol === symbol);
        
        return {
          symbolToken: token,
          symbolName: symbol,
          tradingSymbol: symbol,
          exchange: "NSE",
          companyName: company?.name || symbol,
          ltp: ltp,
          percentageChange: Number(percentageChange.toFixed(2)),
          close: close,
          open: data[`NSE:${symbol}`]?.open || close * 0.998,
          high: data[`NSE:${symbol}`]?.high || ltp * 1.005,
          low: data[`NSE:${symbol}`]?.low || ltp * 0.995,
          volume: data[`NSE:${symbol}`]?.tradedQty || 1000000,
          marketCap: ltp * 100000000,
          yearHigh: ltp * 1.2,
          yearLow: ltp * 0.8,
          pe: 20,
          eps: ltp / 20,
          bookValue: ltp * 0.3
        };
      }
      
      this.log('Failed to get quote data:', response.data?.message || 'Unknown error');
      return this.getMockQuote(symbol);
    } catch (error) {
      this.log('Error fetching quote:', error);
      return this.getMockQuote(symbol);
    }
  }

  /**
   * Get company profile information (mocked since API doesn't provide it)
   */
  async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
    return this.getMockCompanyProfile(symbol);
  }

  /**
   * Get historical price data
   */
  async getHistoricalData(
    symbol: string, 
    exchange: string = 'NSE', 
    interval: string = 'ONE_DAY',
    days: number = 30
  ): Promise<HistoricalData[]> {
    try {
      this.log(`Getting historical data for ${symbol}...`);
      
      // Get token for symbol
      const token = await this.getTokenForSymbol(symbol);
      
      if (!token) {
        this.log(`Token not found for symbol: ${symbol}, using mock data`);
        return this.getMockHistoricalData();
      }
      
      this.log(`Fetching historical data with params: symbol=${symbol}, token=${token}, exchange=${exchange}, interval=${interval}, days=${days}`);
      
      const response = await axios.get<ApiResponse<HistoricalData[]>>(`${this.apiUrl}/historical`, {
        params: {
          symbol_token: token,
          exchange: exchange,
          interval: interval,
          days: days
        }
      });
      
      this.log('Historical data response:', response.data);
      
      if (response.data?.success && response.data.data) {
        this.log(`Retrieved ${response.data.data.length} historical data points`);
        return response.data.data;
      }
      
      this.log('Failed to get historical data:', response.data?.message || 'Unknown error', 'Falling back to mock data');
      return this.getMockHistoricalData();
    } catch (error) {
      this.log('Error fetching historical data:', error);
      return this.getMockHistoricalData();
    }
  }

  /**
   * Example method to get HCL price changes
   */
  async getHCLPriceChange(): Promise<any> {
    try {
      this.log('Getting HCL price change...');
      const response = await axios.get(`${this.apiUrl}/hcl-price-change`);
      this.log('HCL price change response:', response.data);
      return response.data;
    } catch (error) {
      this.log('Error fetching HCL price change:', error);
      return {
        success: false,
        message: 'Failed to fetch HCL price change'
      };
    }
  }

  // Utility methods for mock data

  /**
   * Create mock quote data for testing/fallback
   */
  private getMockQuote(symbol: string): AngelOneQuote {
    this.log(`Generating mock data for ${symbol}`);
    // Generate a random price between 500 and 4000
    const ltp = Math.floor(Math.random() * 3500) + 500;
    const close = ltp - (Math.random() * 20 - 10);
    const percentageChange = Number(((ltp - close) / close * 100).toFixed(2));
    
    // Find company name if available
    const company = this.companies.find(c => c.symbol === symbol);
    const companyName = company ? company.name : `${symbol} Ltd`;
    
    return {
      symbolToken: company?.token || Math.floor(Math.random() * 100000).toString(),
      symbolName: symbol,
      tradingSymbol: `${symbol}`,
      exchange: 'NSE',
      companyName: companyName,
      ltp: ltp,
      percentageChange: percentageChange,
      close: close,
      open: close * (1 + (Math.random() * 0.02 - 0.01)),
      high: ltp * (1 + Math.random() * 0.02),
      low: close * (1 - Math.random() * 0.02),
      volume: Math.floor(Math.random() * 10000000),
      marketCap: Math.floor(Math.random() * 5000) * 100000000,
      yearHigh: ltp * (1 + Math.random() * 0.2),
      yearLow: ltp * (1 - Math.random() * 0.2),
      pe: Math.floor(Math.random() * 30) + 5,
      eps: Math.floor(Math.random() * 200) + 10,
      bookValue: Math.floor(Math.random() * 1000) + 100
    };
  }
  
  private getMockCompanyProfile(symbol: string): CompanyProfile {
    this.log(`Generating mock company profile for ${symbol}`);
    const industries = [
      "Information Technology", "Banking", "Oil & Gas", "Pharmaceuticals", 
      "Automobiles", "Consumer Goods", "Telecommunications", "Steel", 
      "Power Generation", "Mining"
    ];
    
    const sectors = {
      "Information Technology": ["Software", "IT Services", "Hardware"],
      "Banking": ["Private Banking", "Public Banking", "Financial Services"],
      "Oil & Gas": ["Exploration", "Refining", "Marketing"],
      "Pharmaceuticals": ["Generic Drugs", "Specialty Pharma", "R&D"],
      "Automobiles": ["Passenger Vehicles", "Commercial Vehicles", "Auto Parts"],
      "Consumer Goods": ["FMCG", "Consumer Durables", "Electronics"],
      "Telecommunications": ["Wireless Services", "Infrastructure", "Internet"],
      "Steel": ["Integrated Steel", "Steel Products", "Specialty Steel"],
      "Power Generation": ["Thermal Power", "Renewable Energy", "Distribution"],
      "Mining": ["Coal Mining", "Metal Mining", "Minerals"]
    };
    
    // Find company name if available
    const company = this.companies.find(c => c.symbol === symbol);
    const companyName = company ? company.name : `${symbol} Ltd`;
    
    const randomIndustry = industries[Math.floor(Math.random() * industries.length)];
    const randomSector = sectors[randomIndustry as keyof typeof sectors][
      Math.floor(Math.random() * sectors[randomIndustry as keyof typeof sectors].length)
    ];
    
    return {
      name: companyName,
      description: `A leading ${randomSector.toLowerCase()} company in the ${randomIndustry.toLowerCase()} industry with a strong market presence and innovative solutions for customers across India and global markets.`,
      website: `https://www.${symbol.toLowerCase()}.com`,
      industry: randomIndustry,
      sector: randomSector,
      founded: `${1950 + Math.floor(Math.random() * 60)}`,
      ceo: this.getRandomName(),
      headquarters: this.getRandomCity() + ", India",
      marketCap: Math.floor(Math.random() * 5000) * 100000000,
      employees: Math.floor(Math.random() * 100000) + 1000
    };
  }
  
  private getMockHistoricalData(): HistoricalData[] {
    this.log('Generating mock historical data');
    const data: HistoricalData[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    let price = 1000 + Math.random() * 1000;
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Random price movement
      price = price * (1 + (Math.random() * 0.06 - 0.03));
      
      data.push({
        timestamp: date.toISOString(),
        open: price * (1 - Math.random() * 0.01),
        high: price * (1 + Math.random() * 0.02),
        low: price * (1 - Math.random() * 0.02),
        close: price,
        volume: Math.floor(Math.random() * 10000000)
      });
    }
    
    return data;
  }
  
  private getRandomName(): string {
    const firstNames = ['Rahul', 'Amit', 'Priya', 'Neha', 'Vikram', 'Sanjay', 'Deepak', 'Ankit', 'Sunita', 'Rajesh'];
    const lastNames = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Mehta', 'Joshi', 'Verma', 'Shah', 'Reddy'];
    
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  }
  
  private getRandomCity(): string {
    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'];
    return cities[Math.floor(Math.random() * cities.length)];
  }
}

// Export a singleton instance
const angelOneService = new AngelOneService();
export default angelOneService;