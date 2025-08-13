const { google } = require('googleapis');
const AdvancedJSAnalyzer = require('./analyzer.js');

class BatchAnalyzer {
  constructor() {
    this.sheetId = process.env.GOOGLE_SHEET_ID;
    this.credentials = process.env.GOOGLE_SERVICE_ACCOUNT;
    this.analysisType = process.env.ANALYSIS_TYPE || 'full';
    this.maxBatchSize = parseInt(process.env.MAX_BATCH_SIZE) || 50; // Limit batch size
    this.delayBetweenUrls = parseInt(process.env.DELAY_BETWEEN_URLS) || 5000; // 5 second delay
    
    if (!this.sheetId || !this.credentials) {
      throw new Error('GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT required for batch processing');
    }
    
    console.log(`🔧 Batch Analyzer initialized`);
    console.log(`📊 Analysis Type: ${this.analysisType}`);
    console.log(`📏 Max Batch Size: ${this.maxBatchSize}`);
    console.log(`⏱️ Delay Between URLs: ${this.delayBetweenUrls}ms`);
  }

  async runBatch() {
    console.log('🚀 Starting batch analysis...');
    
    try {
      // Setup Google Sheets
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(this.credentials),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      
      const sheets = google.sheets({ version: 'v4', auth });
      
      // Get all data from the sheet
      console.log('📖 Reading Google Sheet data...');
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: 'A:U', // Read all columns
      });
      
      const rows = response.data.values || [];
      if (rows.length === 0) {
        console.log('❌ No data found in spreadsheet');
        return;
      }
      
      // Find URLs that need analysis (column A has URL, column B is empty)
      const urlsToProcess = [];
      for (let i = 1; i < rows.length; i++) { // Skip header row
        const row = rows[i];
        const url = row[0]; // Column A
        const rawHtmlLength = row[1]; // Column B
        
        if (url && (!rawHtmlLength || rawHtmlLength === '')) {
          urlsToProcess.push({
            url: url.trim(),
            rowNumber: i + 1 // Google Sheets is 1-indexed
          });
        }
      }
      
      console.log(`📋 Found ${urlsToProcess.length} URLs to process`);
      
      if (urlsToProcess.length === 0) {
        console.log('✅ All URLs already have analysis data');
        return;
      }
      
      // Limit batch size
      const limitedUrls = urlsToProcess.slice(0, this.maxBatchSize);
      if (urlsToProcess.length > this.maxBatchSize) {
        console.log(`⚠️ Limiting batch to ${this.maxBatchSize} URLs (${urlsToProcess.length - this.maxBatchSize} remaining)`);
      }
      
      // Process each URL
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < limitedUrls.length; i++) {
        const { url, rowNumber } = limitedUrls[i];
        
        console.log(`\n🔍 Processing ${i + 1}/${limitedUrls.length}: ${url}`);
        console.log(`📍 Row ${rowNumber} in spreadsheet`);
        
        try {
          // Set environment variables for this URL
          process.env.TARGET_URL = url;
          process.env.ROW_NUMBER = rowNumber.toString();
          
          // Create new analyzer instance
          const analyzer = new AdvancedJSAnalyzer();
          
          // Run analysis
          await analyzer.analyze();
          
          successCount++;
          console.log(`✅ Successfully analyzed: ${url}`);
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to analyze ${url}:`, error.message);
          
          // Update sheet with error status
          try {
            await sheets.spreadsheets.values.update({
              spreadsheetId: this.sheetId,
              range: `F${rowNumber}:G${rowNumber}`, // Status and Recommendations columns
              valueInputOption: 'RAW',
              requestBody: {
                values: [['Error', `Analysis failed: ${error.message}`]]
              }
            });
          } catch (updateError) {
            console.error(`❌ Failed to update error status in sheet:`, updateError.message);
          }
        }
        
        // Add delay between URLs to be respectful
        if (i < limitedUrls.length - 1) {
          console.log(`⏱️ Waiting ${this.delayBetweenUrls}ms before next URL...`);
          await this.sleep(this.delayBetweenUrls);
        }
      }
      
      // Summary
      console.log('\n🎯 BATCH ANALYSIS COMPLETE');
      console.log('==========================');
      console.log(`✅ Successful: ${successCount}`);
      console.log(`❌ Failed: ${errorCount}`);
      console.log(`📊 Total processed: ${limitedUrls.length}`);
      
      if (urlsToProcess.length > this.maxBatchSize) {
        console.log(`📋 Remaining URLs: ${urlsToProcess.length - this.maxBatchSize}`);
        console.log('💡 Run batch analysis again to process remaining URLs');
      }
      
    } catch (error) {
      console.error('❌ Batch analysis failed:', error);
      throw error;
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run batch analysis if called directly
if (require.main === module) {
  console.log('🚀 Starting batch analyzer...');
  console.log('📋 Environment check:');
  console.log(`  GOOGLE_SHEET_ID: ${process.env.GOOGLE_SHEET_ID ? 'Present' : 'MISSING'}`);
  console.log(`  GOOGLE_SERVICE_ACCOUNT: ${process.env.GOOGLE_SERVICE_ACCOUNT ? 'Present' : 'MISSING'}`);
  console.log(`  ANALYSIS_TYPE: ${process.env.ANALYSIS_TYPE || 'full (default)'}`);
  console.log(`  MAX_BATCH_SIZE: ${process.env.MAX_BATCH_SIZE || '50 (default)'}`);
  
  const batchAnalyzer = new BatchAnalyzer();
  batchAnalyzer.runBatch()
    .then(() => {
      console.log('🎉 Batch analysis completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ FATAL ERROR:', error);
      process.exit(1);
    });
}

module.exports = BatchAnalyzer;
