export const industries = [
  "Abrasives", "Air Conditioning", "Aluminum", "Appliances", "Aquaculture", "Auto & Auto Parts", 
  "Automobiles", "Banks", "Batteries", "Bearings", "Breweries & Distilleries", "Cables", 
  "Cement", "Cement Products", "Chemicals", "Chlor Alkali", "Cigarettes", "Compressors & Drilling", 
  "Computer Education", "Computer Hardware", "Computer Software", "Construction", "Couriers", 
  "Cycles & Accessories", "Detergents", "Diamond & Jewelry", "Diversified", "Dyes & Pigments", 
  "Electrical Equipment", "Electrodes & Welding", "Electronics", "Engineering", "Engines", 
  "Entertainment & Media", "Fasteners", "Fertilizers & Pesticides", "Finance & Investments", 
  "Finance - Housing", "Food Processing", "Glass & Ceramics", "Healthcare", "Hotels", 
  "Leather Goods", "Luggage", "Mining & Metals", "Oil & Gas", "Packaging", "Paints & Varnishes", 
  "Paper", "Personal Care", "Petrochemicals", "Pharmaceuticals", "Photographic Products", 
  "Plastics", "Power Generation", "Printing & Stationery", "Pumps", "Recreation & Amusement", 
  "Refineries", "Refractories", "Solvent Extraction", "Steel", "Sugar", "Tea", 
  "Telecommunications", "Textile Machinery", "Textiles", "Trading", "Transmission Towers", 
  "Transport & Airlines", "Travel", "Tyres"
];

export const categories = [
  "Expansion Plans", 
  "Investor Conferences", 
  "Management Changes", 
  "Financial Results", 
  "Mergers & Acquisitions", 
  "Contract Awards", 
  "Capital Structure Changes", 
  "Other Situations"
];

export const sentiments = ["Positive", "Neutral", "Negative"];

export const sampleAnnouncements = [
  {
    id: 1,
    company: "Cellecor Gadgets Ltd",
    ticker: "CELLECOR",
    category: "Expansion Plans",
    summary: "Cellecor Gadgets Limited announced on March 17, 2025, a partnership with B New Mobiles and Celekt Retail Chains to expand in South India, aiming for INR 500 Million in annual business.",
    sentiment: "Positive",
    date: "Mar 17, 2025 17:00 IST",
    detailedContent: "Cellecor Gadgets Limited has entered into a strategic partnership with B New Mobiles and Celekt Retail Chains to strengthen its presence in South India. The company aims to generate INR 500 Million in annual business through this expansion. The partnership will enable Cellecor to leverage the extensive retail network of B New Mobiles and Celekt Retail Chains across Karnataka, Tamil Nadu, Andhra Pradesh, and Telangana. This move is part of Cellecor's broader strategy to enhance its market share in the mobile accessories and gadgets segment in India.",
    industry: "Electronics"
  },
  {
    id: 2,
    company: "Divine Power Energy Ltd",
    ticker: "DPEL",
    category: "Expansion Plans",
    summary: "Divine Power Energy Limited announced a significant increase in turnover, exceeding Rs. 300 crore by February 28, 2025, compared to the previous year, demonstrating strong market demand and operational efficiency.",
    sentiment: "Positive",
    date: "Mar 17, 2025 16:54 IST",
    detailedContent: "Divine Power Energy Limited has reported a remarkable growth in its turnover, surpassing Rs. 300 crore by the end of February 2025. This represents a substantial increase compared to the same period in the previous financial year. The company attributes this growth to strong market demand for its renewable energy solutions and improved operational efficiency across its manufacturing facilities. Divine Power Energy has also successfully implemented cost optimization measures that have contributed to enhanced profit margins. The management remains optimistic about maintaining this growth trajectory throughout the remainder of the fiscal year.",
    industry: "Power Generation"
  },
  {
    id: 3,
    company: "Innova Captab Ltd",
    ticker: "INNOVACAP",
    category: "Investor Conferences",
    summary: "Innova Captab Ltd will hold an investor meeting and facility visit on March 21, 2025, to discuss publicly available information.",
    sentiment: "Neutral",
    date: "Mar 17, 2025 16:52 IST",
    detailedContent: "Innova Captab Limited has scheduled an investor meeting and facility visit on March 21, 2025. During this event, the company will provide insights into its operations and discuss publicly available information regarding its business performance and future prospects. The meeting will take place at the company's manufacturing facility in Baddi, Himachal Pradesh. Institutional investors and analysts are invited to participate in this event, which will include a tour of the production facilities and a presentation by the senior management team. Registration is required for attendance, and the company has emphasized that no material non-public information will be disclosed during the event.",
    industry: "Pharmaceuticals"
  },
  {
    id: 4,
    company: "Indian Energy Exchange Ltd",
    ticker: "IEX",
    category: "Investor Conferences",
    summary: "Indian Energy Exchange Ltd will hold a meeting with analysts and institutional investors on March 19, 2025, to discuss company performance and industry trends.",
    sentiment: "Neutral",
    date: "Mar 17, 2025 16:48 IST",
    detailedContent: "Indian Energy Exchange Limited has announced that it will be hosting a meeting with analysts and institutional investors on March 19, 2025. The purpose of the meeting is to provide an update on the company's performance, discuss current industry trends, and outline the strategic direction for the coming quarters. The company's senior management team, including the CEO and CFO, will be present to address questions from the participants. This meeting is part of IEX's ongoing efforts to maintain transparent communication with its investors and the financial community. The company has clarified that all information shared during the meeting will be strictly in line with publicly disclosed data.",
    industry: "Power Generation"
  },
  {
    id: 5,
    company: "Tata Consultancy Services Ltd",
    ticker: "TCS",
    category: "Contract Awards",
    summary: "Tata Consultancy Services announced a major contract win with a leading European bank for digital transformation services valued at approximately USD 200 million over five years.",
    sentiment: "Positive",
    date: "Mar 17, 2025 15:30 IST",
    detailedContent: "Tata Consultancy Services (TCS) has secured a significant contract with a leading European banking institution for comprehensive digital transformation services. The deal, valued at approximately USD 200 million, spans a period of five years and encompasses cloud migration, application modernization, and implementation of AI-driven customer experience solutions. This contract reinforces TCS's strong position in the European financial services sector and demonstrates the company's capabilities in delivering large-scale digital transformation initiatives. The project is expected to commence in April 2025, with initial phases focusing on infrastructure modernization and cloud migration. TCS has stated that this engagement will contribute meaningfully to its European revenue stream beginning in the first quarter of FY 2025-26.",
    industry: "Computer Software"
  }
];