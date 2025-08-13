const { chromium, firefox, webkit } = require('playwright');
const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const { createBrowserConfig, detectFrameworks, calculateScore } = require('./utils');

class AdvancedJSAnalyzer {
  constructor() {
    this.targetUrl = process.env.TARGET_URL;
    this.analysisType = process.env.ANALYSIS_TYPE || 'full';
    this.results = {
      url: this.targetUrl,
      timestamp: new Date().toISOString(),
      analysisType: this.analysisType,
      browsers: {},
      summary: {},
      recommendations: [],
      githubRunId: process.env.GITHUB_RUN_ID,
      artifactUrls: {}
    };
  }

  async analyze() {
    console.log(`🚀 Starting ${this.analysisType} analysis for: ${this.targetUrl}`);
    
    try {
      await fs.mkdir('screenshots', { recursive: true });
      
      const browsers = this.getBrowsersToTest();
      
      for (const { name, engine } of browsers) {
        console.log(`\n🌐 Testing with ${name.toUpperCase()}...`);
        this.results.browsers[name] = await this.analyzeBrowser(engine, name);
      }

      await this.generateSummary();
      await this.generateRecommendations();
      await this.saveResults();
      
      if (process.env.GOOGLE_SHEET_ID) {
        await this.updateGoogleSheet();
      }

      console.log('✅ Analysis complete!');
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      await this.handleError(error);
    }
  }

  getBrowsersToTest() {
    const allBrowsers = [
      { name: 'chromium', engine: chromium },
      { name: 'firefox', engine: firefox },
      { name: 'webkit', engine: webkit }
    ];

    switch (this.analysisType) {
      case 'quick':
        return [allBrowsers[0]]; // Chromium only
      case 'stealth':
        return [allBrowsers[0]]; // Chromium with stealth
      default:
        return allBrowsers; // Full cross-browser
    }
  }

  async analyzeBrowser(browserType, browserName) {
    const config = createBrowserConfig(this.analysisType, browserName);
    const browser = await browserType.launch(config.launchOptions);

    try {
      const context = await browser.newContext(config.contextOptions);
      
      // Add stealth techniques for protected sites
      if (this.analysisType === 'stealth' || this.shouldUseStealth()) {
        await this.applyStealth(context);
      }
      
      const page = await context.newPage();
      
      // Set up monitoring
      const requests = [];
      const responses = [];
      
      page.on('request', req => requests.push({
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType()
      }));
      
      page.on('response', resp => responses.push({
        url: resp.url(),
        status: resp.status()
      }));

      // Navigate and capture initial state
      console.log(`  📄 Fetching raw HTML...`);
      const rawResponse = await page.goto(this.targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      if (!rawResponse) {
        throw new Error('Failed to load page');
      }

      const rawHtml = await rawResponse.text();
      
      // Wait for JavaScript rendering
      console.log(`  ⚡ Waiting for JavaScript execution...`);
      await page.waitForLoadState('networkidle', { timeout: 20000 });
      
      // Additional wait for dynamic content
      await page.waitForTimeout(3000);
      
      // Try to detect if page is still loading
      const isStillLoading = await page.evaluate(() => {
        return document.readyState !== 'complete' || 
               document.querySelectorAll('[data-loading], .loading, .spinner').length > 0;
      });
      
      if (isStillLoading) {
        console.log(`  ⏳ Page still loading, waiting longer...`);
        await page.waitForTimeout(5000);
      }

      // Get final rendered content
      const renderedHtml = await page.content();
      
      // Take screenshot
      console.log(`  📸 Taking screenshot...`);
      const screenshotPath = `screenshots/${browserName}-${Date.now()}.png`;
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });

      // Analyze content differences
      const analysis = await this.analyzeContent(page, rawHtml, renderedHtml);
      
      // Get performance metrics
      const metrics = await this.getPerformanceMetrics(page);
      
      await context.close();
      
      return {
        ...analysis,
        performanceMetrics: metrics,
        requestCount: requests.length,
        responseErrors: responses.filter(r => r.status >= 400).length,
        screenshotPath: screenshotPath,
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await browser.close();
    }
  }

  shouldUseStealth() {
    // Use stealth for known protected domains
    const protectedDomains = [
      'anthem.com',
      'bankofamerica.com',
      'chase.com',
      'netflix.com',
      'linkedin.com'
    ];
    
    return protectedDomains.some(domain => 
      this.targetUrl.toLowerCase().includes(domain)
    );
  }

  async applyStealth(context) {
    console.log(`  🥷 Applying stealth techniques...`);
    
    // Override navigator properties
    await context.addInitScript(() => {
      // Remove webdriver property
      delete Object.getPrototypeOf(navigator).webdriver;
      
      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chromium PDF Plugin', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' }
        ]
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
        Promise.resolve({ state: Cypress ? 'denied' : 'granted' }) :
        originalQuery(parameters)
      );
    });
  }

  async analyzeContent(page, rawHtml, renderedHtml) {
    // Clean content for comparison
    const cleanRaw = this.cleanHtml(rawHtml);
    const cleanRendered = this.cleanHtml(renderedHtml);
    
    const difference = cleanRendered.length - cleanRaw.length;
    const percentChange = cleanRaw.length > 0 ? 
      Math.round((difference / cleanRaw.length) * 100) : 0;
    
    // Detect frameworks
    const frameworks = detectFrameworks(renderedHtml, page);
    
    // Count dynamic elements
    const dynamicElements = await page.evaluate(() => {
      return {
        totalElements: document.querySelectorAll('*').length,
        scriptTags: document.querySelectorAll('script').length,
        emptyDivs: document.querySelectorAll('div:empty').length,
        loadingElements: document.querySelectorAll('[data-loading], .loading, .spinner, .skeleton').length
      };
    });

    return {
      rawHtmlLength: rawHtml.length,
      renderedHtmlLength: renderedHtml.length,
      contentDifference: difference,
      contentDifferencePercent: percentChange,
      significantChange: Math.abs(percentChange) > 15 || Math.abs(difference) > 2000,
      frameworks: frameworks,
      dynamicElements: dynamicElements,
      rawContentLength: cleanRaw.length,
      renderedContentLength: cleanRendered.length
    };
  }

  cleanHtml(html) {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async getPerformanceMetrics(page) {
    try {
      return await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        
        return {
          domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
          loadComplete: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          totalLoadTime: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0
        };
      });
    } catch (error) {
      return { error: error.message };
    }
  }

  async generateSummary() {
    const browsers = Object.values(this.results.browsers);
    const hasSignificantChanges = browsers.some(b => b.significantChange);
    const avgDifferencePercent = browsers.reduce((sum, b) => sum + Math.abs(b.contentDifferencePercent || 0), 0) / browsers.length;
    
    // Collect all frameworks
    const allFrameworks = [...new Set(browsers.flatMap(b => b.frameworks || []))];
    
    // Calculate LLM accessibility score
    const accessibilityScore = calculateScore(browsers, allFrameworks, avgDifferencePercent);
    
    this.results.summary = {
      requiresJSRendering: hasSignificantChanges,
      averageContentChange: Math.round(avgDifferencePercent),
      frameworksDetected: allFrameworks,
      llmAccessibilityScore: accessibilityScore,
      crossBrowserConsistency: this.calculateConsistency(browsers),
      analysisConfidence: this.calculateConfidence(browsers),
      totalLoadTime: Math.round(browsers.reduce((sum, b) => sum + (b.performanceMetrics?.totalLoadTime || 0), 0) / browsers.length)
    };
  }

  calculateConsistency(browsers) {
    if (browsers.length < 2) return 'N/A';
    
    const differences = browsers.map(b => Math.abs(b.contentDifferencePercent || 0));
    const variance = differences.reduce((sum, diff) => sum + Math.pow(diff - (differences.reduce((a, b) => a + b) / differences.length), 2), 0) / differences.length;
    
    return variance < 25 ? 'High' : variance < 100 ? 'Medium' : 'Low';
  }

  calculateConfidence(browsers) {
    let confidence = 100;
    
    // Reduce confidence for errors
    const errorCount = browsers.filter(b => b.responseErrors > 0).length;
    confidence -= errorCount * 20;
    
    // Reduce confidence for inconsistent results
    if (this.calculateConsistency(browsers) === 'Low') {
      confidence -= 15;
    }
    
    // Reduce confidence for timeouts or failures
    const failureCount = browsers.filter(b => !b.renderedHtmlLength).length;
    confidence -= failureCount * 30;
    
    return Math.max(0, confidence);
  }

  async generateRecommendations() {
    const { summary } = this.results;
    const recommendations = [];

    // LLM Accessibility recommendations
    if (summary.llmAccessibilityScore >= 80) {
      recommendations.push("✅ Excellent LLM accessibility - content readily available");
    } else if (summary.llmAccessibilityScore >= 60) {
      recommendations.push("⚠️ Good LLM accessibility - minor JS dependency");
    } else if (summary.llmAccessibilityScore >= 40) {
      recommendations.push("⚠️ Moderate JS dependency - test with specific LLM tools");
    } else {
      recommendations.push("❌ Poor LLM accessibility - heavy JS rendering required");
    }

    // Technical recommendations
    if (summary.requiresJSRendering) {
      recommendations.push("🔧 Use Playwright, Puppeteer, or similar for content extraction");
      recommendations.push("📊 Consider implementing SSR for better LLM/SEO accessibility");
    }

    if (summary.frameworksDetected.length > 0) {
      recommendations.push(`🎯 Modern frameworks detected: ${summary.frameworksDetected.join(', ')}`);
    }

    if (summary.crossBrowserConsistency === 'Low') {
      recommendations.push("🌐 Cross-browser testing recommended - rendering varies significantly");
    }

    if (summary.analysisConfidence < 80) {
      recommendations.push("⚠️ Analysis confidence below 80% - results may be unreliable");
    }

    if (summary.totalLoadTime > 5000) {
      recommendations.push("⏰ Slow loading site - performance optimization recommended");
    }

    this.results.recommendations = recommendations;
  }

  async saveResults() {
    const reportPath = 'analysis-report.json';
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 Report saved: ${reportPath}`);
    
    // Also save a human-readable summary
    const summaryPath = 'analysis-summary.txt';
    const summary = this.generateTextSummary();
    await fs.writeFile(summaryPath, summary);
    console.log(`📄 Summary saved: ${summaryPath}`);
  }

  generateTextSummary() {
    const { summary, recommendations } = this.results;
    
    return `
🔍 JavaScript Rendering Analysis Report
=====================================

URL: ${this.targetUrl}
Analysis Type: ${this.analysisType}
Timestamp: ${this.results.timestamp}

📊 SUMMARY
----------
LLM Accessibility Score: ${summary.llmAccessibilityScore}/100
Requires JS Rendering: ${summary.requiresJSRendering ? 'YES' : 'NO'}
Average Content Change: ${summary.averageContentChange}%
Frameworks Detected: ${summary.frameworksDetected.join(', ') || 'None'}
Cross-Browser Consistency: ${summary.crossBrowserConsistency}
Analysis Confidence: ${summary.analysisConfidence}%

🎯 RECOMMENDATIONS
------------------
${recommendations.map(r => `• ${r}`).join('\n')}

🌐 BROWSER RESULTS
------------------
${Object.entries(this.results.browsers).map(([browser, data]) => `
${browser.toUpperCase()}:
  Content Change: ${data.contentDifferencePercent || 0}%
  Frameworks: ${data.frameworks?.join(', ') || 'None'}
  Load Time: ${data.performanceMetrics?.totalLoadTime || 0}ms
  Screenshot: ${data.screenshotPath}
`).join('\n')}

📈 ARTIFACTS
------------
GitHub Run: https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}
Screenshots: Available in GitHub Actions artifacts
Full Report: analysis-report.json
    `.trim();
  }

  async updateGoogleSheet() {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT || !process.env.GOOGLE_SHEET_ID || !process.env.ROW_NUMBER) {
      console.log('📊 Skipping Google Sheets update - missing configuration');
      return;
    }

    try {
      console.log('📊 Updating Google Sheet...');
      
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const rowNumber = parseInt(process.env.ROW_NUMBER);

      const { summary, browsers } = this.results;
      const chromiumResults = browsers.chromium || {};

      const githubUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

      const updateData = [
        [
          chromiumResults.rawHtmlLength || '',
          chromiumResults.renderedHtmlLength || '',
          summary.averageContentChange || '',
          summary.frameworksDetected.join(', ') || 'None',
          summary.llmAccessibilityScore || '',
          `Complete (${this.analysisType})`,
          summary.recommendations.slice(0, 2).join(' | ') || '',
          githubUrl,
          new Date().toISOString()
        ]
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `B${rowNumber}:J${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: updateData
        }
      });

      console.log('✅ Google Sheet updated successfully');

    } catch (error) {
      console.error('❌ Failed to update Google Sheet:', error.message);
    }
  }

  async handleError(error) {
    const errorReport = {
      url: this.targetUrl,
      error: error.message,
      timestamp: new Date().toISOString(),
      analysisType: this.analysisType
    };

    await fs.writeFile('error-report.json', JSON.stringify(errorReport, null, 2));
    
    if (process.env.GOOGLE_SHEET_ID && process.env.ROW_NUMBER) {
      // Update sheet with error
      // Implementation similar to updateGoogleSheet but with error status
    }
  }

  printSummary() {
    const { summary } = this.results;
    
    console.log('\n🎯 ANALYSIS COMPLETE');
    console.log('==================');
    console.log(`🔗 URL: ${this.targetUrl}`);
    console.log(`📊 LLM Score: ${summary.llmAccessibilityScore}/100`);
    console.log(`⚡ JS Required: ${summary.requiresJSRendering ? 'YES' : 'NO'}`);
    console.log(`🎭 Frameworks: ${summary.frameworksDetected.join(', ') || 'None'}`);
    console.log(`🌐 Consistency: ${summary.crossBrowserConsistency}`);
    console.log(`📈 Confidence: ${summary.analysisConfidence}%`);
    console.log(`🔗 Artifacts: https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`);
  }
}

// Run the analysis
if (require.main === module) {
  const analyzer = new AdvancedJSAnalyzer();
  analyzer.analyze().catch(console.error);
}

module.exports = AdvancedJSAnalyzer;
