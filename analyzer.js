/**
 * Simplified JavaScript Rendering Analyzer - Google Apps Script
 * Two options: Single Row Analysis + Batch Analysis (All Empty Rows)
 */

// Configuration - Will be updated automatically during setup
const GITHUB_CONFIG = {
  owner: 'YOUR_GITHUB_USERNAME',  // Updated during setup
  repo: 'js-rendering-analyzer',
  workflow: 'analyze-url.yml',
  batchWorkflow: 'batch-analyze.yml'  // New batch workflow
};

/**
 * Normalize URL to proper format
 */
function normalizeURL(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  let url = input.toString().trim();
  
  // If it's already a complete URL, return as-is
  if (url.match(/^https?:\/\//i)) {
    return url;
  }
  
  // Remove common prefixes that users might add
  url = url.replace(/^(www\.)/i, '');
  
  // Add https:// prefix
  url = 'https://' + url;
  
  // Basic validation - check if it looks like a domain
  if (!url.match(/^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\/?/)) {
    return null;
  }
  
  return url;
}

/**
 * Trigger Playwright analysis via GitHub Actions (Stealth Mode)
 */
function triggerPlaywrightAnalysis(url) {
  if (!url) {
    return "Please provide a URL";
  }
  
  try {
    // Get GitHub configuration from Script Properties
    const properties = PropertiesService.getScriptProperties();
    const token = properties.getProperty('GITHUB_TOKEN');
    const username = properties.getProperty('GITHUB_USERNAME');
    
    if (!token || !username) {
      SpreadsheetApp.getUi().alert('Setup Required', 'Please run "🔧 Setup GitHub Integration" from the menu first.', SpreadsheetApp.getUi().ButtonSet.OK);
      return "GitHub integration not configured";
    }
    
    const sheet = SpreadsheetApp.getActiveSheet();
    const row = SpreadsheetApp.getActiveRange().getRow();
    const sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    
    // Update status
    sheet.getRange(row, 6).setValue('🥷 Starting stealth analysis...');
    
    // Always use stealth analysis with enhanced evasion
    const payload = {
      ref: 'main',
      inputs: {
        url: url,
        analysis_type: 'stealth',
        enhanced_evasion: 'true',  // Enable enhanced evasion
        sheet_id: sheetId,
        row_number: row.toString()
      }
    };
    
    const response = UrlFetchApp.fetch(
      `https://api.github.com/repos/${username}/${GITHUB_CONFIG.repo}/actions/workflows/${GITHUB_CONFIG.workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'GoogleSheets-PlaywrightAnalyzer/3.0'
        },
        payload: JSON.stringify(payload)
      }
    );
    
    if (response.getResponseCode() === 204) {
      sheet.getRange(row, 6).setValue('🥷 Stealth analysis queued...');
      
      // Add link to GitHub Actions
      const githubUrl = `https://github.com/${username}/${GITHUB_CONFIG.repo}/actions`;
      sheet.getRange(row, 8).setValue(githubUrl);
      
      const message = `✅ Stealth analysis started!

URL: ${url}
Row: ${row}
Enhanced bot evasion: Enabled

Results will update automatically in 3-5 minutes.
Perfect for protected sites like banking, healthcare, etc.`;
      
      return message;
    } else {
      const error = `GitHub API error: ${response.getResponseCode()}`;
      sheet.getRange(row, 6).setValue(error);
      return error;
    }
    
  } catch (error) {
    const sheet = SpreadsheetApp.getActiveSheet();
    const row = SpreadsheetApp.getActiveRange().getRow();
    sheet.getRange(row, 6).setValue(`Error: ${error.toString().substring(0, 50)}`);
    console.error('Full error:', error.toString());
    return `Error: ${error.toString()}`;
  }
}

/**
 * Trigger batch analysis for all empty rows
 */
function triggerBatchAnalysis() {
  try {
    // Get GitHub configuration from Script Properties
    const properties = PropertiesService.getScriptProperties();
    const token = properties.getProperty('GITHUB_TOKEN');
    const username = properties.getProperty('GITHUB_USERNAME');
    
    if (!token || !username) {
      SpreadsheetApp.getUi().alert('Setup Required', 'Please run "🔧 Setup GitHub Integration" from the menu first.', SpreadsheetApp.getUi().ButtonSet.OK);
      return "GitHub integration not configured";
    }
    
    const sheet = SpreadsheetApp.getActiveSheet();
    const sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    
    // Count URLs that need analysis
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    let urlsToProcess = 0;
    
    for (let i = 1; i < values.length; i++) { // Skip header row
      const url = values[i][0]; // Column A
      const rawHtmlLength = values[i][1]; // Column B
      
      if (url && (!rawHtmlLength || rawHtmlLength === '')) {
        urlsToProcess++;
      }
    }
    
    if (urlsToProcess === 0) {
      SpreadsheetApp.getUi().alert('No URLs to Process', 'All URLs already have analysis data in column B.', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    
    // Confirm batch analysis
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'Confirm Batch Analysis',
      `Found ${urlsToProcess} URLs that need analysis.
      
This will:
• Use stealth analysis with enhanced bot evasion
• Process URLs sequentially with delays
• Take approximately ${Math.round(urlsToProcess * 4)} minutes total
• Update results automatically in the spreadsheet

Continue with batch analysis?`,
      ui.ButtonSet.YES_NO
    );
    
    if (response !== ui.Button.YES) {
      return;
    }
    
    // Update status for tracking
    const statusCell = sheet.getRange(1, 9); // Column I (next to headers)
    statusCell.setValue(`🚀 Batch analysis started: ${urlsToProcess} URLs`);
    
    // Trigger batch workflow
    const payload = {
      ref: 'main',
      inputs: {
        analysis_type: 'stealth',
        enhanced_evasion: 'true',
        sheet_id: sheetId,
        max_batch_size: '50',  // Process up to 50 URLs
        delay_between_urls: '5000'  // 5 second delay
      }
    };
    
    const apiResponse = UrlFetchApp.fetch(
      `https://api.github.com/repos/${username}/${GITHUB_CONFIG.repo}/actions/workflows/batch-analyze.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'GoogleSheets-BatchAnalyzer/1.0'
        },
        payload: JSON.stringify(payload)
      }
    );
    
    if (apiResponse.getResponseCode() === 204) {
      const githubUrl = `https://github.com/${username}/${GITHUB_CONFIG.repo}/actions`;
      
      ui.alert(
        'Batch Analysis Started! ✅',
        `Processing ${urlsToProcess} URLs with stealth analysis.

• Enhanced bot evasion enabled
• 5 second delays between URLs  
• Estimated completion: ${Math.round(urlsToProcess * 4)} minutes

Track progress: ${githubUrl}

Results will update automatically in the spreadsheet.`,
        ui.ButtonSet.OK
      );
      
    } else {
      statusCell.setValue(`❌ Batch start failed: HTTP ${apiResponse.getResponseCode()}`);
      ui.alert('Batch Analysis Failed', `GitHub API error: ${apiResponse.getResponseCode()}`, ui.ButtonSet.OK);
    }
    
  } catch (error) {
    console.error('Batch analysis error:', error.toString());
    SpreadsheetApp.getUi().alert('Batch Analysis Error', `Failed to start batch analysis: ${error.toString()}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Simplified menu with just two main options
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔍 JS Rendering Analyzer')
    .addItem('🔍 Analyze Current Row (Stealth)', 'analyzeCurrentRow')
    .addItem('🚀 Analyze All Empty Rows (Batch)', 'analyzeAllEmptyRows')
    .addSeparator()
    .addItem('🔧 Setup GitHub Integration', 'setupGitHubIntegration')
    .addItem('🧪 Add Test Sites', 'addTestSites')
    .addItem('🧹 Clear All Results', 'clearResults')
    .addItem('❓ Help', 'showHelp')
    .addToUi();
}

/**
 * Analyze current row (stealth mode)
 */
function analyzeCurrentRow() {
  const url = getSelectedURL();
  if (!url) return;
  
  const result = triggerPlaywrightAnalysis(url);
  SpreadsheetApp.getUi().alert('Stealth Analysis Started', result, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Analyze all empty rows (batch stealth mode)
 */
function analyzeAllEmptyRows() {
  triggerBatchAnalysis();
}

function getSelectedURL() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = SpreadsheetApp.getActiveRange().getRow();
  
  if (row === 1) {
    SpreadsheetApp.getUi().alert('Please select a data row (not the header row)');
    return null;
  }
  
  const url = sheet.getRange(row, 1).getValue();
  const normalizedURL = normalizeURL(url);
  
  if (!normalizedURL) {
    SpreadsheetApp.getUi().alert('Please enter a valid URL in column A');
    return null;
  }
  
  return normalizedURL;
}

/**
 * Setup GitHub integration with step-by-step guide
 */
function setupGitHubIntegration() {
  const ui = SpreadsheetApp.getUi();
  
  // Step 1: Get GitHub username
  const usernameResponse = ui.prompt(
    'GitHub Setup - Step 1 of 3',
    'Enter your GitHub username:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (usernameResponse.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  
  const username = usernameResponse.getResponseText().trim();
  if (!username) {
    ui.alert('Setup cancelled - no username provided');
    return;
  }
  
  // Step 2: Get GitHub token
  const tokenResponse = ui.prompt(
    'GitHub Setup - Step 2 of 3',
    `Please create a GitHub Personal Access Token:

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name like "Google Sheets Integration"
4. Select scopes: "repo" and "workflow"
5. Click "Generate token"
6. Copy the token and paste it below:`,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (tokenResponse.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  
  const token = tokenResponse.getResponseText().trim();
  if (!token) {
    ui.alert('Setup cancelled - no token provided');
    return;
  }
  
  // Step 3: Test the connection
  try {
    const testResponse = UrlFetchApp.fetch(
      `https://api.github.com/repos/${username}/js-rendering-analyzer`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (testResponse.getResponseCode() === 200) {
      // Save the configuration
      const properties = PropertiesService.getScriptProperties();
      properties.setProperties({
        'GITHUB_TOKEN': token,
        'GITHUB_USERNAME': username
      });
      
      ui.alert(
        'Setup Complete! ✅',
        `Successfully connected to your repository:
        
• Repository: ${username}/js-rendering-analyzer
• Analysis Mode: Stealth (enhanced bot evasion)
• Ready to use!

Two options available:
🔍 Analyze Current Row - Single URL analysis
🚀 Analyze All Empty Rows - Batch processing

Try selecting a URL and using "Analyze Current Row"!`,
        ui.ButtonSet.OK
      );
      
    } else {
      ui.alert(
        'Setup Failed ❌',
        `Could not access your repository. Please check:

• Repository exists: ${username}/js-rendering-analyzer
• Token has correct permissions (repo, workflow)
• Repository is public (required for free GitHub Actions)

Error: HTTP ${testResponse.getResponseCode()}`,
        ui.ButtonSet.OK
      );
    }
    
  } catch (error) {
    ui.alert(
      'Setup Failed ❌',
      `Connection test failed: ${error.toString()}

Please check:
• Your internet connection
• GitHub token is valid
• Repository name is correct`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Add test sites for protected domains
 */
function addTestSites() {
  const sites = [
    'anthem.com/medicare/medicare-advantage-plans',
    'bankofamerica.com',
    'chase.com/personal',
    'netflix.com',
    'linkedin.com/login',
    'lolovivijewelry.com/products/the-romney-14k-solid-gold-diamond-huggie-hoops'
  ];
  
  const sheet = SpreadsheetApp.getActiveSheet();
  const startRow = sheet.getLastRow() + 2;
  
  sites.forEach((site, index) => {
    sheet.getRange(startRow + index, 1).setValue(site);
  });
  
  SpreadsheetApp.getUi().alert(
    'Test Sites Added ✅',
    `Added ${sites.length} test sites starting at row ${startRow}.

These include protected sites that typically block automation.
Perfect for testing stealth analysis capabilities!

Select any row and try "Analyze Current Row" or use "Analyze All Empty Rows" to process them all.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Clear all results
 */
function clearResults() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Clear All Results',
    'This will clear all analysis data (columns B through U).\n\nAre you sure?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    const sheet = SpreadsheetApp.getActiveSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow > 1) {
      sheet.getRange(2, 2, lastRow - 1, 20).clearContent(); // Clear B through U
      ui.alert('All results cleared!');
    }
  }
}

/**
 * Show simplified help
 */
function showHelp() {
  const properties = PropertiesService.getScriptProperties();
  const isSetup = properties.getProperty('GITHUB_TOKEN') ? true : false;
  
  const helpText = `🔍 JavaScript Rendering Analyzer - Simplified Guide

${isSetup ? '✅ GitHub integration configured' : '❌ Run "Setup GitHub Integration" first'}

🎯 TWO SIMPLE OPTIONS:

🔍 ANALYZE CURRENT ROW
• Select any row with a URL
• Click "Analyze Current Row (Stealth)"
• Gets detailed before/after analysis
• Perfect for single URLs

🚀 ANALYZE ALL EMPTY ROWS  
• Automatically finds URLs without analysis data
• Click "Analyze All Empty Rows (Batch)"
• Processes all empty rows with stealth mode
• Perfect for bulk analysis

🥷 STEALTH MODE (Always Enabled):
• Enhanced bot detection evasion
• Works on protected sites (banking, healthcare)
• Advanced browser fingerprint masking
• Human behavior simulation

📊 WHAT YOU GET:
• LLM Accessibility Score (0-100)
• Detailed before/after content comparison
• Framework detection (React, Vue, Angular, etc.)
• Specific recommendations
• Screenshots available in GitHub Actions

💡 COLUMN GUIDE:
A: URL | B: Raw HTML Length | C: Rendered HTML Length
D: Content Change % | E: JS Frameworks | F: LLM Score
G: Status | H: Recommendations | I: GitHub URL
J: Last Updated | K-U: Detailed JS Analysis

${isSetup ? 
  '✅ Ready to use! Try "Analyze Current Row" with any URL.' :
  '🔧 Run "Setup GitHub Integration" to get started.'
}`;

  SpreadsheetApp.getUi().alert('Quick Start Guide', helpText, SpreadsheetApp.getUi().ButtonSet.OK);
}
