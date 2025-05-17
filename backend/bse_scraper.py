import requests
import os
import logging
import time
import json
from google import genai
from dotenv import load_dotenv
from collections import deque
import re
from supabase import create_client, Client
from urllib.parse import urlparse
import tempfile
import shutil
from datetime import datetime
import uuid
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("bse_scraper.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("BSEScraper")

# Load environment variables
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    logger.error("Missing GEMINI_API_KEY environment variable")
    raise EnvironmentError("Missing GEMINI_API_KEY environment variable")

SUPABASE_URL = os.getenv("SUPABASE_URL2")
SUPABASE_KEY = os.getenv("SUPABASE_KEY2")
if not (SUPABASE_URL and SUPABASE_KEY):
    logger.error("Missing Supabase credentials")
    raise EnvironmentError("Missing Supabase credentials")

# Initialize Supabase client
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
    raise

# Add functions to handle announcement tracking in JSON file
def save_latest_announcement(announcement, filename="latest_announcement.json"):
    """Save the latest announcement details to a JSON file with proper path handling"""
    try:
        # Get the absolute directory of the current script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Create a dedicated directory for persistent data if it doesn't exist
        data_dir = os.path.join(script_dir, "data")
        os.makedirs(data_dir, exist_ok=True)
        
        # Use absolute path for the file
        filepath = os.path.join(data_dir, filename)
        
        # Log file path to diagnose path issues
        logger.info(f"Saving latest announcement to: {filepath}")
        
        with open(filepath, 'w') as f:
            json.dump(announcement, f, indent=4)
        
        logger.info(f"Successfully saved latest announcement to {filepath}")
        return True
    except Exception as e:
        logger.error(f"Error saving latest announcement to file: {e}")
        return False

# Modified load_latest_announcement function with matching path handling
def load_latest_announcement(filename="latest_announcement.json"):
    """Load the latest processed announcement from JSON file with proper path handling"""
    try:
        # Get the absolute directory of the current script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Use the same data directory as in save function
        data_dir = os.path.join(script_dir, "data")
        filepath = os.path.join(data_dir, filename)
        
        logger.info(f"Attempting to load announcement from: {filepath}")
        
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                data = json.load(f)
            logger.info(f"Successfully loaded announcement from {filepath}")
            return data
        else:
            logger.warning(f"No saved announcement file found at {filepath}")
            return None
    except Exception as e:
        logger.error(f"Error loading latest announcement from file: {e}")
        return None

def announcements_are_equal(a1, a2):
    """Compare two announcements to check if they are the same, with improved debugging"""
    if not a1 or not a2:
        logger.debug("One or both announcements are empty or None")
        return False
        
    # Compare key fields that would indicate it's the same announcement
    fields_to_compare = ['SCRIP_CD', 'HEADLINE', 'News_submission_dt', 'ATTACHMENTNAME']
    
    for field in fields_to_compare:
        if a1.get(field) != a2.get(field):
            logger.debug(f"Announcements differ in field '{field}': '{a1.get(field)}' vs '{a2.get(field)}'")
            return False
    
    logger.debug("Announcements are identical")
    return True

class RateLimitedGeminiClient:
    def __init__(self, api_key, rpm_limit=15, max_retries=3):
        try:
            self.client = genai.Client(api_key=api_key)
            self.rpm_limit = rpm_limit
            self.request_timestamps = deque()
            self.max_retries = max_retries
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            raise

    def _enforce_rate_limit(self):
        """Enforce API rate limit (requests per minute)"""
        current_time = time.time()
        while self.request_timestamps and current_time - self.request_timestamps[0] > 60:
            self.request_timestamps.popleft()

        if len(self.request_timestamps) >= self.rpm_limit:
            wait_time = 60 - (current_time - self.request_timestamps[0]) + 0.1
            logger.info(f"Rate limit reached. Waiting {wait_time:.2f} seconds...")
            time.sleep(wait_time)

        self.request_timestamps.append(time.time())

    def generate_content(self, model, contents):
        """Rate-limited wrapper for generate_content with retries"""
        for attempt in range(1, self.max_retries + 1):
            try:
                self._enforce_rate_limit()
                return self.client.models.generate_content(model=model, contents=contents)
            except Exception as e:
                if attempt == self.max_retries:
                    logger.error(f"Failed to generate content after {self.max_retries} attempts: {e}")
                    raise
                logger.warning(f"Attempt {attempt} failed: {e}. Retrying...")
                time.sleep(2 * attempt)  # Exponential backoff

    def chats(self):
        """Rate-limited access to the chats API"""
        return RateLimitedChatWrapper(self)

    @property
    def files(self):
        """Expose the original client's .files attribute"""
        return self.client.files


class RateLimitedChatWrapper:
    def __init__(self, rate_limited_client):
        self.rate_limited_client = rate_limited_client
        self.client = rate_limited_client.client

    def create(self, model):
        """Rate-limited wrapper for chats.create"""
        try:
            self.rate_limited_client._enforce_rate_limit()
            return RateLimitedChatSession(self.client.chats.create(model=model), self.rate_limited_client)
        except Exception as e:
            logger.error(f"Failed to create chat session: {e}")
            raise


class RateLimitedChatSession:
    def __init__(self, chat_session, rate_limited_client):
        self.chat_session = chat_session
        self.rate_limited_client = rate_limited_client

    def send_message(self, content):
        """Rate-limited wrapper for send_message with retries"""
        for attempt in range(1, self.rate_limited_client.max_retries + 1):
            try:
                self.rate_limited_client._enforce_rate_limit()
                return self.chat_session.send_message(content)
            except Exception as e:
                if attempt == self.rate_limited_client.max_retries:
                    logger.error(f"Failed to send message after {self.rate_limited_client.max_retries} attempts: {e}")
                    raise
                logger.warning(f"Send message attempt {attempt} failed: {e}. Retrying...")
                time.sleep(2 * attempt)  # Exponential backoff


def remove_markdown_tags(text):
    """Remove Markdown tags and adjust indentation of the text"""
    if not isinstance(text, str):
        logger.warning(f"Expected string for markdown removal, got {type(text)}")
        return "" if text is None else str(text)
        
    # Check if code blocks are present
    has_code_blocks = re.search(r'```', text) is not None

    # Remove code blocks (content between ```)
    text = re.sub(r'```[^\n]*\n(.*?)```', r'\1', text, flags=re.DOTALL)
    
    # Remove HTML tags
    text = re.sub(r"<.*?>", "", text)
    
    # Only adjust indentation if code blocks were detected
    if has_code_blocks:
        lines = text.split('\n')
        if lines:
            # Find the minimum indentation (excluding empty lines)
            non_empty_lines = [line for line in lines if line.strip()]
            if non_empty_lines:
                min_indent = min(len(line) - len(line.lstrip()) for line in non_empty_lines)
                # Reduce indentation by half of the minimum (to maintain some indentation)
                shift = max(min_indent // 2, 1) if min_indent > 0 else 0
                lines = [line[shift:] if line.strip() else line for line in lines]
            text = '\n'.join(lines)
    
    return text.strip()

def clean_summary(text):
    """Removes everything before **Category:** and returns the rest."""
    marker = "**Category:**"
    if marker in text:
        return text[text.index(marker):].strip()
    else:
        return text


def check_for_negative_keywords(summary):
    """Check for negative keywords in the announcements"""
    if not isinstance(summary, str):
        logger.warning(f"Expected string for keyword check, got {type(summary)}")
        return True  # Treat non-string values as containing negative keywords
        
    negative_keywords = [
        "Trading Window", "Compliance Report", "Advertisement(s)", "Advertisement", "Public Announcement",
        "Share Certificate(s)", "Share Certificate", "Depositories and Participants", "Depository and Participant",
        "Depository and Participant", "Depository and Participants", "74(5)", "XBRL", "Newspaper Publication",
        "Published in the Newspapers", "Clippings", "Book Closure", "Change in Company Secretary/Compliance Officer",
        "Record Date",
    ]

    special_keywords = [
        "Board", "Outcome", "General Updates",
    ]

    for keyword in special_keywords:
        if keyword.lower() in summary.lower():
            logger.info(f"Special keyword '{keyword}' found in announcement: {summary}")
            return False
            
    for keyword in negative_keywords:
        if keyword.lower() in summary.lower():
            logger.info(f"Negative keyword '{keyword}' found in announcement: {summary}")
            return True
            
    return False


def check_for_pdf(desc):
    """Check if the description contains a PDF file name"""
    return isinstance(desc, str) and desc.lower().endswith('.pdf')


def extract_symbol(url):
    """Extract symbol from URL safely"""
    if not url:
        logger.warning("Cannot extract symbol from empty URL")
        return None
        
    try:
        path = urlparse(url).path  # get the path from URL
        segments = path.strip('/').split('/')  # split path into parts
        if len(segments) >= 2 and segments[-1].isdigit():
            return segments[-2]  # return the segment just before the numeric ID
    except Exception as e:
        logger.error(f"Error extracting symbol from URL {url}: {e}")
    
    return None


# Initialize Gemini client with retries
try:
    genai_client = RateLimitedGeminiClient(api_key=API_KEY)
except Exception as e:
    logger.error(f"Failed to initialize Gemini client: {e}")
    genai_client = None  # Allow the script to continue but log the error


class BseScraper:
    def __init__(self, prev_date, to_date, max_retries=3, request_timeout=30):
        self.url = "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w"
        self.params = {
            "pageno": 1,
            "strCat": -1,
            "strPrevDate": prev_date,
            "strScrip": "",
            "strSearch": "P",
            "strToDate": to_date,
            "strType": "C",
            "subcategory": -1
        }

        self.headers = {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.bseindia.com/",
            "Origin": "https://www.bseindia.com"
        }
        
        self.max_retries = max_retries
        self.request_timeout = request_timeout
        self.temp_dir = tempfile.mkdtemp(prefix="bse_scraper_")
        logger.info(f"Created temporary directory: {self.temp_dir}")

    def __del__(self):
        """Clean up temporary directory on object destruction"""
        try:
            if hasattr(self, 'temp_dir') and os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
                logger.info(f"Removed temporary directory: {self.temp_dir}")
        except Exception as e:
            logger.error(f"Error cleaning up temporary directory: {e}")

    def fetch_data(self):
        """Fetch announcement data with retries and error handling"""
        for attempt in range(1, self.max_retries + 1):
            try:
                with requests.Session() as session:
                    session.headers.update(self.headers)
                    response = session.get(
                        self.url, 
                        params=self.params, 
                        timeout=self.request_timeout
                    )
                    
                    response.raise_for_status()  # Raises an exception for 4XX/5XX responses
                    
                    data = response.json()
                    announcements = data.get("Table", [])
                    
                    if not announcements and isinstance(announcements, list):
                        logger.warning("API returned empty announcement list")
                    
                    return announcements
            except requests.exceptions.Timeout:
                logger.warning(f"Request timed out (attempt {attempt}/{self.max_retries})")
            except requests.exceptions.HTTPError as e:
                logger.error(f"HTTP error occurred: {e}, Status code: {e.response.status_code}")
            except requests.exceptions.ConnectionError:
                logger.error(f"Connection error (attempt {attempt}/{self.max_retries})")
            except requests.exceptions.RequestException as e:
                logger.error(f"Request error: {e}")
            except ValueError as e:  # Includes JSONDecodeError
                logger.error(f"Failed to parse JSON response: {e}")
            except Exception as e:
                logger.error(f"Unexpected error in fetch_data: {e}")
                
            if attempt < self.max_retries:
                wait_time = 2 ** attempt  # Exponential backoff
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                logger.error(f"Failed to fetch data after {self.max_retries} attempts")
                return []  # Return empty list after all retries fail

    def ai_process(self, filename):
        """Process PDF with AI, with proper error handling"""
        if not filename:
            logger.error("No valid filename provided for AI processing")
            return "Error", "No valid filename provided"
            
        if not os.path.exists(filename):
            logger.error(f"File not found: {filename}")
            return "Error", "File not found"
            
        # Handle case where Gemini client failed to initialize
        if not genai_client:
            logger.error("Cannot process file: Gemini client not initialized")
            return "Error", "AI client not available"

        uploaded_file = None
        chat_session = None
        
        try:
            logger.info(f"Uploading file: {filename}")
            # Upload the PDF file
            uploaded_file = genai_client.files.upload(file=filename)
            
            # Create a chat session
            chat_session = genai_client.chats().create(model="gemini-2.0-flash")
            
            prompt = """
                   Role: You are an expert AI Financial Analyst. Make ssure that you give the output in the specified format only. dont forget to mark things with ** in markdown to make it bold a described.
Task: Analyze the provided Announcement Content. First, determine the single, most specific category it belongs to from the Target Categories list, using the Category Descriptions & Disambiguation Guide for help. Second, generate the specified output based on the identified category:
Dont write anything else other than the information/output specified in the output section.
Output: Generate a Structured Narrative Report in Markdown containing ONLY:
**Category:** [Identified Category Name]
**Headline:** (A concise, informative headline summarizing the core event or announcement.)
## Structured Narrative (Under this heading, provide the report)
This report should present all material facts and key data points (values, financials, dates, terms, parties, rationale, ratios etc.) clearly and accurately based only on the provided text.
Organize information logically using appropriate subheadings (###) if needed.
Write in coherent sentences and paragraphs, integrating extracted facts smoothly for readability, like an objective report.
Crucially, this is NOT a brief summary (do not omit material facts) and NOT just a list of raw data points (ensure readability and connect related facts).
Maintain an objective, factual tone. Do not add external information, interpretation, or opinions.
Include essential tables (recreated accurately in Markdown) where they are the best way to present comparative data (e.g., financial results).
State Not specified only if key information expected for this category type is genuinely absent in the text.
Exclusion: Irrelevant details like specific street addresses, GST numbers, routine contact information, or other non-essential administrative identifiers MUST be omitted.
Context:
Target Categories & Descriptions Guide:
Annual Report: Contains the full Annual Report document for the financial year. (Distinguish from quarterly Financial Results).
Agreements/MoUs: Formal business agreements or understandings (e.g., supply, marketing, tech sharing).
Anti-dumping Duty: Updates on tariffs related to unfair import pricing.
Buyback: Company repurchasing its own shares.
Bonus/Stock Split: Issuing extra shares (Bonus) or dividing shares (Split). (Note: Intimation of Record date alone is Procedural/Administrative).
Change in Address: Change in Registered or Corporate Office address. (Often Procedural/Administrative unless significant context).
Change in MOA: Modifications to the company's foundational charter. (Often Procedural/Administrative unless detailing significant strategic shifts).
Clarifications/Confirmations: Addressing market rumors or news; confirming/denying information.
Closure of Factory: Shutting down a significant production facility.
Concall Transcript: Contains the verbatim transcript of an earnings/investor call.
Consolidation of Shares: Reverse stock split (combining shares).
Credit Rating: Updates on credit ratings from agencies.
Debt Reduction: Specific actions aimed at decreasing outstanding debt principal.
Debt & Financing: Broader debt matters: new loans, bonds, refinancing, restructuring, defaults, FCCB updates.
Delisting: Removal of shares from a stock exchange.
Demerger: Separating a business unit into a new independent company.
Change in KMP: Specifically the appointment of a new CEO or new Managing Director. (Other KMP changes fall under Procedural/Administrative).
Demise of KMP: Announcement of the death of Key Management Personnel.
Disruption of Operations: Significant interruptions (fire, flood, strike, pandemic impact).
Divestitures: Selling assets, business units, or subsidiaries.
DRHP: Filing of Draft Red Herring Prospectus for an IPO.
Expansion: Increasing capacity, market presence, new plants, CAPEX announcements.
Financial Results: Reporting quarterly, half-yearly, or annual financial performance.
Fundraise - Preferential Issue: Raising capital from select investors (includes related meeting notices/outcomes).
Fundraise - QIP: Raising capital from Qualified Institutional Buyers (includes related meeting notices/outcomes).
Fundraise - Rights Issue: Offering shares to existing shareholders (includes related meeting notices/outcomes). (Note: Intimation of Record date alone is Procedural/Administrative).
Global Pharma Regulation: Updates from international regulators (excluding USFDA).
Incorporation/Cessation of Subsidiary: Creating or closing/selling a subsidiary.
Increase in Share Capital: Primarily increasing the authorized share capital limit. (Often Procedural/Administrative).
Insolvency and Bankruptcy: Updates on IBC proceedings or similar distress processes.
Interest Rates Updates: Changes in interest rates offered/payable by the company.
Investor Presentation: Release of presentations for investors/analysts.
Investor/Analyst Meet: Intimation or summary of meetings with investors/analysts.
Joint Ventures: Creating a new entity jointly owned with partners.
Litigation & Notices: Updates on significant legal cases or regulatory notices with potential material impact. (Minor cases/updates are Procedural/Administrative).
Mergers/Acquisitions: Combining with or acquiring other companies.
Name Change: Official change in the company's registered name. (Often Procedural/Administrative).
New Order: Securing significant new contracts or purchase orders.
New Product: Launch or introduction of a new product/service line.
One Time Settlement (OTS): Resolving dues with lenders/creditors via a lump-sum payment.
Open Offer: Offer to buy shares from public shareholders (triggered or voluntary).
Operational Update: Updates on key operational metrics (production, sales volumes, utilization) outside formal results.
PLI Scheme: Updates regarding participation/approval/benefits under Production Linked Incentive schemes.
Procedural/Administrative: Covers routine administrative, compliance filings, meeting notices (without major non-procedural agenda items), routine corporate actions (record dates, payment dates, ESOP allotments, trading window closures), minor personnel changes (non-CEO/MD KMP changes), standard regulatory reports (Corp Gov, BRSR), change in RTA/Auditor etc.
Reduction in Share Capital: Decreasing authorized or paid-up capital. (Often Procedural/Administrative unless detailing significant restructuring).
Regulatory Approvals/Orders: Receiving specific non-pharma, non-legal, non-tax approvals (e.g., environmental clearance, license grant).
Trading Suspension: Announcement regarding the suspension of trading in the company's shares.
USFDA: Updates specifically concerning the US Food and Drug Administration.

Also if there are any tables in the document, please recreate them in markdown format. and make sure the values are correct and it should render beautifully in markdown.
Dont start with something like intro like "Okay here is the summary". You should directly deliver the content.
"""
            
            # Include the file in the message
            response = chat_session.send_message([prompt, uploaded_file])
            
            if not hasattr(response, 'text'):
                logger.error("AI response missing text attribute")
                return "Error", "AI processing failed: invalid response format"
                
            summary_text = response.text.strip()
            
            # Extract category from the summary
            try:
                category_text = summary_text.split("**Category:**")[1].split("**Headline:**")[0].strip()
                logger.info(f"Category: {category_text}")
                return category_text, summary_text
            except IndexError:
                logger.error("Failed to extract category from AI response")
                return "Error", "Failed to extract category from AI response"
                
        except Exception as e:
            logger.error(f"Error in AI processing: {e}")
            return "Error", f"Error processing file: {str(e)}"

    def process_pdf(self, pdf_file):
        """Download and process PDF with error handling"""
        if not pdf_file:
            logger.error("No PDF file specified")
            return "Error", "No PDF file specified"
            
        # Use the temp directory for downloads
        filepath = os.path.join(self.temp_dir, pdf_file.split("/")[-1])
        
        try:
            url = f"https://www.bseindia.com/xml-data/corpfiling/AttachLive/{pdf_file}"
            
            # Download with retries
            for attempt in range(1, self.max_retries + 1):
                try:
                    response = requests.get(url, timeout=self.request_timeout, headers=self.headers)
                    response.raise_for_status()
                    
                    with open(filepath, "wb") as file:
                        file.write(response.content)
                    logger.info(f"Downloaded: {filepath}")
                    break
                except requests.exceptions.Timeout:
                    logger.warning(f"PDF download timed out (attempt {attempt}/{self.max_retries})")
                except requests.exceptions.HTTPError as e:
                    logger.error(f"HTTP error downloading PDF: {e}")
                    return "Error", f"Failed to download PDF: HTTP error {e.response.status_code}"
                except requests.exceptions.RequestException as e:
                    logger.error(f"Error downloading PDF (attempt {attempt}/{self.max_retries}): {e}")
                
                if attempt < self.max_retries:
                    wait_time = 2 ** attempt
                    logger.info(f"Retrying download in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    logger.error("Failed to download PDF after all retries")
                    return "Error", "Failed to download PDF after multiple attempts"
                    
            # Process the PDF if download was successful
            if os.path.exists(filepath):
                category, ai_summary = self.ai_process(filepath)
                if category == "Error":
                    logger.error(f"AI processing error: {ai_summary}")
                    return "Error", ai_summary
                
                ai_summary = remove_markdown_tags(ai_summary)
                return category, ai_summary
            else:
                logger.error("PDF file not found after download attempt")
                return "Error", "PDF file not found after download attempt"
                
        except Exception as e:
            logger.error(f"Unexpected error processing PDF: {e}")
            return "Error", f"Unexpected error: {str(e)}"
        finally:
            # Clean up even if an error occurred
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    logger.info(f"Deleted temporary file: {filepath}")
                except Exception as e:
                    logger.warning(f"Failed to delete temporary file {filepath}: {e}")

    def get_isin(self, scrip_id):
        """Get ISIN with error handling and retries"""
        if not scrip_id:
            logger.error("Invalid scrip ID for ISIN lookup")
            return "N/A"
            
        isin_url = f"https://api.bseindia.com/BseIndiaAPI/api/ComHeadernew/w?quotetype=EQ&scripcode={scrip_id}&seriesid="
        
        for attempt in range(1, self.max_retries + 1):
            try:
                response = requests.get(isin_url, headers=self.headers, timeout=self.request_timeout)
                response.raise_for_status()
                
                data = response.json()
                isin = data.get("ISIN", "N/A")
                logger.info(f"ISIN for {scrip_id}: {isin}")
                return isin
            except requests.exceptions.Timeout:
                logger.warning(f"ISIN request timed out (attempt {attempt}/{self.max_retries})")
            except requests.exceptions.HTTPError as e:
                logger.error(f"HTTP error getting ISIN: {e}")
            except requests.exceptions.RequestException as e:
                logger.error(f"Request error getting ISIN: {e}")
            except ValueError as e:  # JSON decode error
                logger.error(f"Error parsing ISIN response: {e}")
            except Exception as e:
                logger.error(f"Unexpected error getting ISIN: {e}")
                
            if attempt < self.max_retries:
                wait_time = 2 ** attempt
                logger.info(f"Retrying ISIN lookup in {wait_time} seconds...")
                time.sleep(wait_time)
                
        logger.error(f"Failed to get ISIN for {scrip_id} after {self.max_retries} attempts")
        return "N/A"

    def process_data(self, announcement):
        """Process a single announcement with comprehensive error handling"""
        try:
            # Extract and validate announcement data
            scrip_id = announcement.get("SCRIP_CD")
            bse_summary = announcement.get("HEADLINE", "")
            pdf_file = announcement.get("ATTACHMENTNAME", "")
            date = announcement.get("News_submission_dt")
            company_name = announcement.get("SLONGNAME", "")
            company_url = announcement.get("NSURL", "")
            
            # Log the announcement being processed
            logger.info(f"Processing announcement: {bse_summary}")
            
            # Basic validation
            if not scrip_id:
                logger.warning("Skipping announcement without scrip ID")
                return False
                
            # Check if this is scrip_id 1 (special case to skip)
            if scrip_id == 1:
                logger.info("Skipping announcement with scrip_id 1")
                return False
                
            # Format company name if needed
            if isinstance(company_name, str) and company_name.endswith(" LTD"):
                company_name = company_name[:-4]
            
            # Extract symbol from URL
            symbol = extract_symbol(company_url)
            if symbol:
                symbol = symbol.upper()
            else:
                symbol = ""

            ai_summary = None
            category = "Procedural/Administrative"
            
            # Check for negative keywords
            if check_for_negative_keywords(bse_summary):
                logger.info(f"Negative keyword found in announcement: {bse_summary}")
            elif check_for_pdf(pdf_file):
                logger.info(f"Processing PDF: {pdf_file}")
                category, ai_summary = self.process_pdf(pdf_file) 
                ai_summary = remove_markdown_tags(ai_summary)
                ai_summary = clean_summary(ai_summary)
            
            # Get ISIN
            isin = self.get_isin(scrip_id)
            
            # Validate ISIN format
            if not isin or isin == "N/A" or (len(isin) > 3 and isin[2] != "E"):
                logger.warning(f"Invalid ISIN: {isin} for scrip_id {scrip_id}")
                return False
                
            # Create file URL
            file_url = f"https://www.bseindia.com/xml-data/corpfiling/AttachLive/{pdf_file}" if pdf_file else None
            
            # Prepare data for upload
            data = {
                "corp_id": str(uuid.uuid4()),
                "securityid": scrip_id,
                "summary": bse_summary,
                "fileurl": file_url,
                "date": date,
                "ai_summary": ai_summary,
                "category": category,
                "isin": isin,
                "companyname": company_name,
                "symbol": symbol
            }
            
            # Upload to Supabase with retries
            for attempt in range(1, self.max_retries + 1):
                try:
                    response = supabase.table("corporatefilings").insert(data).execute()
                    # logger.info(f"Data uploaded to Supabase for {scrip_id}")
                    # latest_ann = load_latest_announcement()
                    # lat_date = latest_ann.get("News_submission_dt", "")
                    # now_date = date.fromisoformat(date)
                    # lat_date = date.fromisoformat(lat_date)
                    # if lat_date < now_date:
                    #     logger.info(f"New announcement detected: {bse_summary}")
                    post_url = "http://localhost:5001/api/insert_new_announcement"
                    res = requests.post(url=post_url, json=data)
                    #     save_success = save_latest_announcement(announcement)
                    #     if not save_success:
                    #         logger.error("Failed to save the latest announcement")
                    
                    # return True 
                except Exception as e:
                    logger.error(f"Error uploading to Supabase (attempt {attempt}/{self.max_retries}): {e}")
                    
                    if attempt < self.max_retries:
                        wait_time = 2 ** attempt
                        logger.info(f"Retrying upload in {wait_time} seconds...")
                        time.sleep(wait_time)
                    else:
                        logger.error(f"Failed to upload after {self.max_retries} attempts")
                        return False
                        
        except Exception as e:
            logger.error(f"Unexpected error processing announcement: {e}")
            return False

    def run(self):
        """Main execution method with comprehensive error handling"""
        try:
            logger.info(f"Starting BSE scraper for dates: {self.params['strPrevDate']} to {self.params['strToDate']}")
            
            # Fetch announcements
            announcements = self.fetch_data()
            
            if not announcements:
                logger.warning("No announcements found or failed to fetch data")
                return 0
                
            logger.info(f"Found {len(announcements)} announcements to process")
            
            # Process each announcement, continuing even if some fail
            success_count = 0
            fail_count = 0
            
            for i, announcement in enumerate(announcements):
                try:
                    logger.info(f"Processing announcement {i+1}/{len(announcements)}")
                    result = self.process_data(announcement)
                    if result:
                        success_count += 1
                    else:
                        fail_count += 1
                except Exception as e:
                    logger.error(f"Error processing announcement {i+1}: {e}")
                    fail_count += 1
                    # Continue processing the next announcement
                    
            logger.info(f"Completed processing. Success: {success_count}, Failed: {fail_count}")
            return success_count
            
        except Exception as e:
            logger.error(f"Critical error in BSE scraper: {e}")
            return 0
        finally:
            # Ensure temp directory is cleaned up
            try:
                if hasattr(self, 'temp_dir') and os.path.exists(self.temp_dir):
                    shutil.rmtree(self.temp_dir)
                    logger.info(f"Cleaned up temporary directory: {self.temp_dir}")
            except Exception as e:
                logger.error(f"Error cleaning up: {e}")

    def run_continuous(self, check_interval=10):
        """Run the scraper continuously with improved error handling and debugging"""
        logger.info(f"Starting continuous BSE scraper, checking every {check_interval} seconds")
        
        # Create a data directory for persistence if it doesn't exist
        script_dir = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.join(script_dir, "data")
        os.makedirs(data_dir, exist_ok=True)
        logger.info(f"Using data directory: {data_dir}")
        
        while True:
            try:
                # Update the date parameters to current date
                today = datetime.today().strftime('%Y%m%d')
                self.params["strPrevDate"] = today
                self.params["strToDate"] = today
                
                logger.info(f"Fetching announcements for date: {today}")
                
                # Fetch latest announcements
                announcements = self.fetch_data()
                
                if not announcements:
                    logger.warning("No announcements found or failed to fetch data")
                    time.sleep(check_interval)
                    continue
                
                logger.info(f"Fetched {len(announcements)} announcements")
                
                # Get the most recent announcement
                latest_announcement = announcements[0] if announcements else None
                
                # Load the previously saved announcement
                previous_announcement = load_latest_announcement()
                
                if latest_announcement:
                    logger.info(f"Latest announcement: {latest_announcement.get('HEADLINE', '')}")
                if previous_announcement:
                    logger.info(f"Previous announcement: {previous_announcement.get('HEADLINE', '')}")
                
                # Check if we have a new announcement
                if latest_announcement and not announcements_are_equal(latest_announcement, previous_announcement):
                    logger.info("New announcement detected!")
                    
                    # Process the new announcement
                    result = self.process_data(latest_announcement)
                    
                    if result:
                        logger.info("Successfully processed new announcement")
                        # Save this as our latest processed announcement
                        save_success = save_latest_announcement(latest_announcement)
                        if not save_success:
                            logger.error("Failed to save the latest announcement")
                    else:
                        logger.error("Failed to process new announcement")
                else:
                    logger.info("No new announcements found")
                
                # Wait for the specified interval before checking again
                logger.info(f"Waiting {check_interval} seconds before next check...")
                time.sleep(check_interval)
                
            except Exception as e:
                logger.error(f"Error in continuous run loop: {e}")
                logger.error(f"Error traceback: {traceback.format_exc()}")
                logger.info(f"Waiting {check_interval} seconds before retry...")
                time.sleep(check_interval)


if __name__ == "__main__":
    today = datetime.today().strftime('%Y%m%d')
    scraper = BseScraper(today, today)
    
    # Run in continuous mode
    try:
        scraper.run_continuous(check_interval=10)
    except KeyboardInterrupt:
        logger.info("Script stopped by user")
    except Exception as e:
        logger.error(f"Script terminated due to error: {e}")

