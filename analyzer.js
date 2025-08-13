const { chromium, firefox, webkit } = require('playwright');
const { google } = require('googleapis');
const fs = require('fs').promises;

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
      githubRunId: process.env.GITHUB_RUN_ID
    };
  }

  async analyze() {
    console.log(`🚀 Starting ${this.analysisType} analysis for: ${this.targetUrl}`);
    
    try {
      // Create required directories
      await fs.mkdir('screenshots', { recursive: true });
      
      const browsers = this.getBrowsersToTest();
      
      for (const { name, engine } of browsers) {
        console.log(`\n🌐 Testing with ${name.toUpperCase()}...`);
        try {
          this.results.browsers[name] = await this.analyzeBrowser(engine, name);
        } catch (error) {
          console.error(`❌ ${name} failed:`, error.message);
          this.results.browsers[name] = {
            error: error.message,
            status: 'failed'
          };
        }
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
      process.exit(1);
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
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote'
      ]
    };

    // Add stealth techniques
    if (this.analysisType === 'stealth' || this.shouldUseStealth()) {
      console.log(`  🥷 Applying stealth mode for ${browserName}...`);
      launchOptions.args.push(
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
    }

    const browser = await browserType.launch(launchOptions);

    try {
      const contextOptions = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US'
      };

      const context = await browser.newContext(contextOptions);
      
      // Apply additional stealth if needed
      if (this.analysisType === 'stealth' || this.shouldUseStealth()) {
        await this.applyStealth(context);
      }
      
      const page = await context.newPage();

      // Navigate and get raw HTML
      console.log(`  📄 Fetching page...`);
      const response = await page.goto(this.targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      if (!response) {
        throw new Error('Failed to load page');
      }

      const rawHtml = await response.text();
      
      // Wait for JavaScript rendering
      console.log(`  ⚡ Waiting for JavaScript execution...`);
      try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
      } catch (e) {
        console.log(`  ⏰ Network timeout - continuing...`);
      }
      
      await page.waitForTimeout(3000);

      // Get final rendered content
      const renderedHtml = await page.content();
      
      // Take screenshot
      console.log(`  📸 Taking screenshot...`);
      const screenshotPath = `screenshots/${browserName}-${Date.now()}.png`;
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true,
        timeout: 10000
      });

      // Analyze content
      const analysis = await this.analyzeContent(page, rawHtml, renderedHtml);
      
      // Get performance metrics
      const metrics = await this.getPerformanceMetrics(page);
      
      await context.close();
      
      return {
        ...analysis,
        performanceMetrics: metrics,
        screenshotPath: screenshotPath,
        statusCode: response.status(),
        timestamp: new Date().toISOString(),
        status: 'success'
      };
      
    } finally {
      await browser.close();
    }
  }

  shouldUseStealth() {
    const protectedDomains = [
      'anthem.com',
      'bankofamerica.com',
      'chase.com',
      'netflix.com',
      'linkedin.com',
      'amazon.com'
    ];
    
    return protectedDomains.some(domain => 
      this.targetUrl.toLowerCase().includes(domain)
    );
  }

  async applyStealth(context) {
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
    });
  }

  async analyzeContent(page, rawHtml, renderedHtml) {
    const cleanRaw = this.cleanHtml(rawHtml);
    const cleanRendered = this.cleanHtml(renderedHtml);
    
    const difference = cleanRendered.length - cleanRaw.length;
    const percentChange = cleanRaw.length > 0 ? 
      Math.round((difference / cleanRaw.length) * 100) : 0;
    
    // Detect frameworks
    const frameworks = await this.detectFrameworks(renderedHtml, page);
    
    // Get dynamic elements info
    const dynamicElements = await page.evaluate(() => {
      return {
        totalElements: document.querySelectorAll('*').length,
        scriptTags: document.querySelectorAll('script').length,
        loadingElements: document.querySelectorAll('[data-loading], .loading, .spinner, .skeleton').length
      };
    }).catch(() => ({ totalElements: 0, scriptTags: 0, loadingElements: 0 }));

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

  async detectFrameworks(html, page) {
    const frameworks = [];
    const patterns = {
      'React': [/react/i, /_reactInternalFiber/i, /data-reactroot/i, /__webpack_require__/],
      'Vue.js': [/vue(?:\.js)?/i, /data-v-[a-f0-9]/i, /\[data-v-/i],
      'Angular': [/angular/i, /ng-version/i, /ng-app/i, /\[ng-/i],
      'Next.js': [/__NEXT_DATA__/i, /_next\/static/i, /next\.js/i],
      'Nuxt.js': [/__NUXT__/i, /_nuxt\//i],
      'Svelte': [/svelte/i, /s-[A-Za-z0-9]/],
      'Alpine.js': [/x-data/i, /alpine/i],
      'jQuery': [/jquery/i, /\$\(/]
    };

    for (const [name, regexes] of Object.entries(patterns)) {
      if (regexes.some(regex => regex.test(html))) {
        frameworks.push(name);
      }
    }

    // Try to detect frameworks via JavaScript
    try {
      const jsFrameworks = await page.evaluate(() => {
        const detected = [];
        if (window.React) detected.push('React');
        if (window.Vue) detected.push('Vue.js');
        if (window.angular) detected.push('Angular');
        if (window.jQuery || window.$) detected.push('jQuery');
        return detected;
      });
      
      jsFrameworks.forEach(fw => {
        if (!frameworks.includes(fw)) {
          frameworks.push(fw);
        }
      });
    } catch (e) {
      // Ignore JS detection errors
    }

    return frameworks;
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
    const browsers = Object.values(this.results.browsers).filter(b => !b.error);
    
    if (browsers.length === 0) {
      this.results.summary = {
        requiresJSRendering: false,
        averageContentChange: 0,
        frameworksDetected: [],
        llmAccessibilityScore: 0,
        crossBrowserConsistency: 'N/A',
        analysisConfidence: 0,
        error: 'All browsers failed'
      };
      return;
    }

    const hasSignificantChanges = browsers.some(b => b.significantChange);
    const avgDifferencePercent = browsers.reduce((sum, b) => sum + Math.abs(b.contentDifferencePercent || 0), 0) / browsers.length;
    
    const allFrameworks = [...new Set(browsers.flatMap(b => b.frameworks || []))];
    const accessibilityScore = this.calculateScore(browsers, allFrameworks, avgDifferencePercent);
    
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

  calculateScore(browsers, frameworks, avgDifferencePercent) {
    let score = 100;
    
    if (avgDifferencePercent > 50) score -= 40;
    else if (avgDifferencePercent > 25) score -= 30;
    else if (avgDifferencePercent > 10) score -= 20;
    
    if (frameworks.length > 0) {
      const modernFrameworks = ['React', 'Vue.js', 'Angular', 'Next.js', 'Nuxt.js', 'Svelte'];
      const modernCount = frameworks.filter(f => modernFrameworks.includes(f)).length;
      score -= modernCount * 15;
    }
    
    const hasSignificantChanges = browsers.some(b => b.significantChange);
    if (hasSignificantChanges) score -= 25;
    
    const avgRawContent = browsers.reduce((sum, b) => sum + (b.rawContentLength || 0), 0) / browsers.length;
    if (avgRawContent < 500) score -= 20;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  calculateConsistency(browsers) {
    if (browsers.length < 2) return 'N/A';
    
    const differences = browsers.map(b => Math.abs(b.contentDifferencePercent || 0));
    const variance = differences.reduce((sum, diff) => sum + Math.pow(diff - (differences.reduce((a, b) => a + b) / differences.length), 2), 0) / differences.length;
    
    return variance < 25 ? 'High' : variance < 100 ? 'Medium' : 'Low';
  }

  calculateConfidence(browsers) {
    let confidence = 100;
    const errorCount = browsers.filter(b => b.error).length;
    confidence -= errorCount * 30;
    
    if (this.calculateConsistency(browsers) === 'Low') confidence -= 15;
    
    return Math.max(0, confidence);
  }

  async generateRecommendations() {
    const { summary } = this.results;
    const recommendations = [];

    if (summary.error) {
      recommendations.push("❌ Analysis failed - unable to determine JS dependency");
      recommendations.push("🔧 Try manual testing or different analysis approach");
      this.results.recommendations = recommendations;
      return;
    }

    if (summary.llmAccessibilityScore >= 80) {
      recommendations.push("✅ Excellent LLM accessibility - content readily available");
    } else if (summary.llmAccessibilityScore >= 60) {
      recommendations.push("⚠️ Good LLM accessibility - minor JS dependency");
    } else if (summary.llmAccessibilityScore >= 40) {
      recommendations.push("⚠️ Moderate JS dependency - test with specific LLM tools");
    } else {
      recommendations.push("❌ Poor LLM accessibility - heavy JS rendering required");
    }

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

    this.results.recommendations = recommendations;
  }

  async saveResults() {
    // Save JSON report
    const reportPath = 'analysis-report.json';
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 Report saved: ${reportPath}`);
    
    // Save human-readable summary
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
  Status: ${data.status || 'Unknown'}
  Content Change: ${data.contentDifferencePercent || 0}%
  Frameworks: ${data.frameworks?.join(', ') || 'None'}
  Load Time: ${data.performanceMetrics?.totalLoadTime || 0}ms
  Screenshot: ${data.screenshotPath || 'None'}
  ${data.error ? `Error: ${data.error}` : ''}
`).join('\n')}

📈 ARTIFACTS
------------
GitHub Run: https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}
Screenshots: Available in GitHub Actions artifacts
Full Report: analysis-report.json
    `.trim();
  }

  async updateGoogleSheet() {
    console.log('🔍 DEBUG: Starting Google Sheet update process...');
    console.log(`Sheet ID: ${process.env.GOOGLE_SHEET_ID || 'Missing'}`);
    console.log(`Row Number: ${process.env.ROW_NUMBER || 'Missing'}`);
    console.log(`Service Account: ${process.env.GOOGLE_SERVICE_ACCOUNT ? 'Present' : 'Missing'}`);
    
    if (!process.env.GOOGLE_SERVICE_ACCOUNT || !process.env.GOOGLE_SHEET_ID || !process.env.ROW_NUMBER) {
      console.log('📊 Skipping Google Sheets update - missing configuration');
      return;
    }

    try {
      console.log('📊 Updating Google Sheet...');
      
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
      console.log(`✅ Service account credentials parsed successfully: ${credentials.client_email}`);
      
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const rowNumber = parseInt(process.env.ROW_NUMBER);

      const { summary, browsers } = this.results;
      const chromiumResults = browsers.chromium || {};

      // Safely handle all potential undefined values
      const recommendations = Array.isArray(this.results.recommendations) ? this.results.recommendations : [];
      const frameworksDetected = Array.isArray(summary.frameworksDetected) ? summary.frameworksDetected : [];
      
      const recommendationText = recommendations.length > 0 ? 
        recommendations.slice(0, 2).join(' | ') : 
        'Analysis complete';

      const githubUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

      const updateData = [
        [
          chromiumResults.rawHtmlLength || 0,
          chromiumResults.renderedHtmlLength || 0,
          summary.averageContentChange || 0,
          frameworksDetected.join(', ') || 'None',
          summary.llmAccessibilityScore || 0,
          `Complete (${this.analysisType})`,
          recommendationText,
          githubUrl,
          new Date().toISOString()
        ]
      ];

      console.log(`📝 Updating range B${rowNumber}:J${rowNumber} with data:`, JSON.stringify(updateData[0]));

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
      console.error('❌ Full error:', error);
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
    console.error('❌ Error report saved');
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
    console.log(`🔗 GitHub Run: https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`);
  }
}

// Run the analysis
if (require.main === module) {
  const analyzer = new AdvancedJSAnalyzer();
  analyzer.analyze().catch(console.error);
}

module.exports = AdvancedJSAnalyzer;
