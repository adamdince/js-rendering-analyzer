const { chromium, firefox, webkit } = require('playwright');
const { google } = require('googleapis');
const fs = require('fs').promises;

class AdvancedJSAnalyzer {
  constructor() {
    console.log('🔧 Initializing AdvancedJSAnalyzer...');
    this.targetUrl = process.env.TARGET_URL;
    this.analysisType = process.env.ANALYSIS_TYPE || 'full';
    
    console.log(`🎯 Target URL: ${this.targetUrl}`);
    console.log(`📊 Analysis Type: ${this.analysisType}`);
    
    this.results = {
      url: this.targetUrl,
      timestamp: new Date().toISOString(),
      analysisType: this.analysisType,
      browsers: {},
      summary: {},
      recommendations: [],
      githubRunId: process.env.GITHUB_RUN_ID
    };
    
    console.log('✅ AdvancedJSAnalyzer initialized successfully');
  }

  async analyze() {
    // Validate environment
    if (!this.targetUrl) {
      throw new Error('TARGET_URL environment variable is required');
    }
    
    try {
      new URL(this.targetUrl);
    } catch (error) {
      throw new Error(`Invalid URL: ${this.targetUrl}`);
    }

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
          console.error(`❌ ${name} stack:`, error.stack);
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
      console.error('❌ Full stack trace:', error.stack);
      await this.handleError(error);
      throw error; // Re-throw to trigger the main catch handler
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
    // Use enhanced evasion if explicitly requested
    if (process.env.ENHANCED_EVASION === 'true') {
      return await this.analyzeWithEnhancedEvasion(browserType, browserName);
    }
    
    // For extremely protected sites, try multiple approaches
    if (this.isExtremelyProtected()) {
      return await this.analyzeProtectedSite(browserType, browserName);
    }

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
      console.log(`  🥷 Applying enhanced stealth mode for ${browserName}...`);
      launchOptions.args.push(
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-client-side-phishing-detection',
        '--disable-sync',
        '--disable-default-apps',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-pings',
        '--disable-extensions-http-throttling',
        '--disable-component-extensions-with-background-pages',
        '--disable-permissions-api',
        '--force-device-scale-factor=1',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
    }

    const browser = await browserType.launch(launchOptions);
    console.log(`  ✅ Browser launched successfully`);

    try {
      const contextOptions = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: [],
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0'
        }
      };

      const context = await browser.newContext(contextOptions);
      console.log(`  ✅ Browser context created`);
      
      // Apply additional stealth if needed
      if (this.analysisType === 'stealth' || this.shouldUseStealth()) {
        console.log(`  🥷 Applying stealth techniques...`);
        await this.applyStealth(context);
      }
      
      const page = await context.newPage();
      console.log(`  ✅ New page created`);

      // Navigate with enhanced error handling for HTTP/2 issues
      console.log(`  📄 Fetching page...`);
      
      let response;
      let rawHtml;
      
      try {
        // First attempt with standard navigation
        response = await page.goto(this.targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        rawHtml = await response.text();
      } catch (error) {
        if (error.message.includes('ERR_HTTP2_PROTOCOL_ERROR')) {
          console.log(`  🔄 HTTP/2 error detected, trying fallback approach...`);
          
          // Fallback: Try with HTTP/1.1 by creating new context
          await context.close();
          
          const fallbackOptions = {
            ...contextOptions,
            extraHTTPHeaders: {
              ...contextOptions.extraHTTPHeaders,
              'Connection': 'close',  // Force HTTP/1.1
              'HTTP2-Settings': undefined
            }
          };
          
          const fallbackContext = await browser.newContext(fallbackOptions);
          await this.applyStealth(fallbackContext);
          const fallbackPage = await fallbackContext.newPage();
          
          // Add additional HTTP/2 bypass
          await fallbackPage.route('**/*', route => {
            const headers = route.request().headers();
            delete headers['http2-settings'];
            route.continue({ headers });
          });
          
          response = await fallbackPage.goto(this.targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          rawHtml = await response.text();
          
          // Use fallback page for the rest of analysis
          await context.close();
          context = fallbackContext;
          page = fallbackPage;
          
        } else {
          throw error; // Re-throw if it's a different error
        }
      }
      
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
      console.log(`  🔍 STARTING CONTENT ANALYSIS`);
      const analysis = await this.analyzeContent(page, rawHtml, renderedHtml);
      console.log(`  ✅ CONTENT ANALYSIS COMPLETED`);
      
      // Get performance metrics
      console.log(`  ⏱️ GETTING PERFORMANCE METRICS`);
      const metrics = await this.getPerformanceMetrics(page);
      console.log(`  ✅ PERFORMANCE METRICS COMPLETED`);
      
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

  isExtremelyProtected() {
    // Only use if FORCE_PROTECTED_MODE is set
    return process.env.FORCE_PROTECTED_MODE === 'true';
  }

  async analyzeProtectedSite(browserType, browserName) {
    console.log(`  🛡️ Using specialized approach for extremely protected site...`);
    
    try {
      // Strategy 1: Try to get at least basic information
      const basicInfo = await this.getBasicSiteInfo();
      
      // Return actual analysis results without assumptions
      return {
        rawHtmlLength: 0,
        renderedHtmlLength: 0,
        contentDifference: 0,
        contentDifferencePercent: 0,
        significantChange: false,
        frameworks: ['Analysis Blocked - Unable to Detect'],
        dynamicElements: { note: 'Site blocks automated analysis' },
        rawContentLength: 0,
        renderedContentLength: 0,
        performanceMetrics: { error: 'Protected site - analysis blocked' },
        screenshotPath: null,
        statusCode: 'Protected',
        timestamp: new Date().toISOString(),
        status: 'protected_site',
        protectionLevel: 'extreme',
        alternativeInfo: basicInfo
      };
      
    } catch (error) {
      console.log(`  ❌ All protection bypass attempts failed: ${error.message}`);
      
      return {
        rawHtmlLength: 0,
        renderedHtmlLength: 0,
        contentDifference: 0,
        contentDifferencePercent: 0,
        significantChange: false,
        frameworks: ['Analysis Blocked'],
        dynamicElements: { error: 'Site protection too strong' },
        rawContentLength: 0,
        renderedContentLength: 0,
        performanceMetrics: { error: error.message },
        screenshotPath: null,
        statusCode: 'Blocked',
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: error.message,
        recommendation: 'Site requires manual analysis or professional tools'
      };
    }
  }

  async getBasicSiteInfo() {
    // Return basic domain info without making framework assumptions
    const domain = new URL(this.targetUrl).hostname;
    
    return {
      domain: domain,
      analysisBlocked: true,
      recommendedApproach: 'Manual testing or enterprise tools'
    };
  }

  async tryAlternativeAnalysis() {
    // Remove all industry-based assumptions
    return {
      frameworks: ['Unable to detect - analysis blocked'],
      confidence: 'None',
      jsRequired: 'Unknown - analysis blocked'
    };
  }

  async analyzeWithEnhancedEvasion(browserType, browserName) {
    console.log(`  🥷 Using enhanced evasion techniques...`);
    
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-client-side-phishing-detection',
        '--disable-sync',
        '--disable-default-apps',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-pings',
        '--disable-extensions-http-throttling',
        '--disable-component-extensions-with-background-pages',
        '--disable-permissions-api',
        '--force-device-scale-factor=1',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--disable-background-networking',
        '--enable-automation=false',
        '--password-store=basic',
        '--use-mock-keychain'
      ]
    };

    const browser = await browserType.launch(launchOptions);

    try {
      const contextOptions = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: [],
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
          'sec-ch-ua': '"Chromium";v="120", "Not_A Brand";v="24", "Google Chrome";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"'
        }
      };

      const context = await browser.newContext(contextOptions);
      
      // Apply enhanced stealth
      await this.applyAnthemStealth(context);
      
      const page = await context.newPage();

      // Simulate human behavior
      await this.simulateHumanBehavior(page);

      // Navigate with multiple fallbacks
      console.log(`  📄 Fetching page with enhanced evasion...`);
      const response = await this.navigateWithFallbacks(page);
      
      // Check if we got blocked
      if (await this.detectBlocking(page)) {
        throw new Error('Site detected automation and blocked access');
      }
      
      // Wait for JavaScript rendering with human-like delays
      console.log(`  ⚡ Waiting for JavaScript execution...`);
      await page.waitForTimeout(2000 + Math.random() * 3000); // Random 2-5 second delay
      
      try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
      } catch (e) {
        console.log(`  ⏰ Network timeout - continuing...`);
      }
      
      await page.waitForTimeout(2000);

      // Get final rendered content
      const rawHtml = await response.text();
      const renderedHtml = await page.content();
      
      // Take screenshot
      console.log(`  📸 Taking screenshot...`);
      const screenshotPath = `screenshots/${browserName}-enhanced-${Date.now()}.png`;
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
        status: 'success',
        evasionUsed: 'enhanced'
      };
      
    } finally {
      await browser.close();
    }
  }

  async applyAnthemStealth(context) {
    await context.addInitScript(() => {
      // Aggressive removal of automation indicators
      delete Object.getPrototypeOf(navigator).webdriver;
      delete navigator.__proto__.webdriver;
      delete navigator.webdriver;
      
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        set: () => {},
        configurable: true,
        enumerable: false
      });
      
      // Remove ALL Playwright indicators
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_JSON;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Object;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Proxy;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Reflect;
      
      // Override window dimensions
      Object.defineProperty(window, 'outerHeight', {
        get: () => window.innerHeight,
      });
      Object.defineProperty(window, 'outerWidth', {
        get: () => window.innerWidth,
      });
      
      // Mock realistic plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin'
          }
        ]
      });
      
      // Override WebGL fingerprinting
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.call(this, parameter);
      };
      
      // Add chrome object
      window.chrome = { runtime: {} };
      
      // Mock connection
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 2.0
        })
      });
    });
  }

  async simulateHumanBehavior(page) {
    // Random mouse movements
    await page.mouse.move(100 + Math.random() * 100, 100 + Math.random() * 100);
    await page.waitForTimeout(500 + Math.random() * 1000);
    
    await page.mouse.move(200 + Math.random() * 100, 200 + Math.random() * 100);
    await page.waitForTimeout(300 + Math.random() * 700);
  }

  async navigateWithFallbacks(page) {
    const strategies = [
      { waitUntil: 'domcontentloaded', timeout: 30000 },
      { waitUntil: 'load', timeout: 45000 }
    ];
    
    for (const strategy of strategies) {
      try {
        const response = await page.goto(this.targetUrl, strategy);
        if (response && response.status() < 400) {
          return response;
        }
      } catch (error) {
        console.log(`  ⚠️ Navigation failed with ${strategy.waitUntil}: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('All navigation strategies failed');
  }

  async detectBlocking(page) {
    try {
      const indicators = await page.evaluate(() => {
        const title = document.title.toLowerCase();
        const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
        
        const blockingKeywords = [
          'access denied', 'blocked', 'security check', 'captcha', 
          'robot', 'automated', 'suspicious activity', 'ray id'
        ];
        
        return blockingKeywords.some(keyword => 
          title.includes(keyword) || bodyText.includes(keyword)
        ) || !document.body || document.body.children.length === 0;
      });
      
      return indicators;
    } catch (error) {
      return true;
    }
  }

  shouldUseStealth() {
    // Only use stealth if explicitly requested
    return this.analysisType === 'stealth' || process.env.FORCE_STEALTH === 'true';
  }

  async applyStealth(context) {
    await context.addInitScript(() => {
      // Remove webdriver property
      delete Object.getPrototypeOf(navigator).webdriver;
      
      // Override webdriver property more thoroughly
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      // Override plugins with realistic values
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: null },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin'
          },
          {
            0: { type: 'application/pdf', suffixes: 'pdf', description: '', enabledPlugin: null },
            description: '',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            length: 1,
            name: 'Chrome PDF Viewer'
          },
          {
            0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable', enabledPlugin: null },
            1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable', enabledPlugin: null },
            description: '',
            filename: 'internal-nacl-plugin',
            length: 2,
            name: 'Native Client'
          }
        ]
      });
      
      // Override languages with realistic values
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      // Override permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
        Promise.resolve({ state: 'denied' }) :
        originalQuery(parameters)
      );
      
      // Override chrome runtime
      if (!window.chrome) {
        window.chrome = {};
      }
      if (!window.chrome.runtime) {
        window.chrome.runtime = {};
      }
      
      // Override WebGL vendor and renderer
      const getParameter = WebGLRenderingContext.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter(parameter);
      };
      
      // Hide automation indicators
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });
  }

  async analyzeContent(page, rawHtml, renderedHtml) {
    console.log(`  📊 Starting content analysis...`);
    const cleanRaw = this.cleanHtml(rawHtml);
    const cleanRendered = this.cleanHtml(renderedHtml);
    
    console.log(`  📏 Clean raw length: ${cleanRaw.length}`);
    console.log(`  📏 Clean rendered length: ${cleanRendered.length}`);
    
    const difference = cleanRendered.length - cleanRaw.length;
    const percentChange = cleanRaw.length > 0 ? 
      Math.round((difference / cleanRaw.length) * 100) : 0;
    
    // Safety check for extreme values
    const safePercentChange = Math.min(Math.max(percentChange, -1000), 1000);
    if (Math.abs(percentChange) > 1000) {
      console.log(`  ⚠️ Extreme percentage detected: ${percentChange}%, capping at ${safePercentChange}%`);
    }
    
    console.log(`  📊 Content difference: ${difference} characters (${safePercentChange}%)`);
    
    // Detect frameworks
    const frameworks = await this.detectFrameworks(renderedHtml, page);
    console.log(`  🎭 Frameworks detected: ${frameworks.join(', ') || 'None'}`);
    
    // Get dynamic elements info
    const dynamicElements = await page.evaluate(() => {
      return {
        totalElements: document.querySelectorAll('*').length,
        scriptTags: document.querySelectorAll('script').length,
        loadingElements: document.querySelectorAll('[data-loading], .loading, .spinner, .skeleton').length
      };
    }).catch(() => ({ totalElements: 0, scriptTags: 0, loadingElements: 0 }));

    console.log(`  🧮 Dynamic elements: ${dynamicElements.totalElements} total, ${dynamicElements.scriptTags} scripts`);

    // LLM-focused content analysis
    const jsRenderedContent = await this.analyzeJSRenderedContent(cleanRaw, cleanRendered, page);

    return {
      rawHtmlLength: rawHtml.length,
      renderedHtmlLength: renderedHtml.length,
      contentDifference: difference,
      contentDifferencePercent: safePercentChange,
      significantChange: Math.abs(safePercentChange) > 15 || Math.abs(difference) > 2000,
      frameworks: frameworks,
      dynamicElements: dynamicElements,
      rawContentLength: cleanRaw.length,
      renderedContentLength: cleanRendered.length,
      jsRenderedContent: jsRenderedContent
    };
  }

  async analyzeJSRenderedContent(rawText, renderedText, page) {
    console.log(`  🔍 Analyzing truly missing content (LLM-relevant only)...`);
    console.log(`  📏 Raw text length: ${rawText.length}`);
    console.log(`  📏 Rendered text length: ${renderedText.length}`);
    console.log(`  📊 Content change: ${renderedText.length - rawText.length} chars (${Math.round(((renderedText.length - rawText.length) / rawText.length) * 100)}%)`);
    
    try {
      // Get raw HTML to check what's actually in the DOM vs what's visible
      console.log(`  🔍 Getting raw DOM structure...`);
      const rawHtml = await page.evaluate(() => document.documentElement.outerHTML);
      
      console.log(`  📏 Raw HTML length: ${rawHtml.length}`);
      console.log(`  📏 Rendered HTML length: ${rawHtml.length}`);
      
      // DEBUG: Let's see what content is actually different
      const contentSamples = await page.evaluate((rawTextContent) => {
        const debug = {
          rawTextSample: rawTextContent.substring(0, 500),
          renderedTextSample: document.body?.innerText?.substring(0, 500) || 'No body text',
          totalVisibleElements: document.querySelectorAll('*').length,
          visibleTextElements: document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div').length,
          visibleNavElements: document.querySelectorAll('nav, .nav, .navigation, .menu, header a').length,
          visibleHeadings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.innerText?.trim()).slice(0, 5),
          visibleNavText: Array.from(document.querySelectorAll('nav a, .nav a, .navigation a, .menu a, header a')).map(a => a.innerText?.trim()).slice(0, 5),
          visiblePrices: Array.from(document.querySelectorAll('[class*="price"], [class*="cost"], .currency, [data-price]')).map(p => p.innerText?.trim()).slice(0, 5),
          bodyStructure: {
            mainElements: document.querySelectorAll('main').length,
            articles: document.querySelectorAll('article').length,
            sections: document.querySelectorAll('section').length,
            contentDivs: document.querySelectorAll('.content, [class*="content"]').length
          }
        };
        return debug;
      }, rawText);
      
      console.log(`  🔍 DEBUG INFO:`);
      console.log(`    Total visible elements: ${contentSamples.totalVisibleElements}`);
      console.log(`    Visible text elements: ${contentSamples.visibleTextElements}`);
      console.log(`    Visible nav elements: ${contentSamples.visibleNavElements}`);
      console.log(`    Visible headings: ${JSON.stringify(contentSamples.visibleHeadings)}`);
      console.log(`    Visible nav text: ${JSON.stringify(contentSamples.visibleNavText)}`);
      console.log(`    Body structure: ${JSON.stringify(contentSamples.bodyStructure)}`);
      console.log(`    Raw text sample: "${contentSamples.rawTextSample.substring(0, 200)}..."`);
      console.log(`    Rendered text sample: "${contentSamples.renderedTextSample.substring(0, 200)}..."`);
      
      // Get content that's actually missing from raw HTML (not just hidden by CSS)
      const trulyMissingContent = await page.evaluate((contentData) => {
        const { rawHtmlContent, rawTextContent } = contentData;
        const missing = {
          navigation: { missingLinks: [], missingText: [] },
          headings: { missingHeadings: [] },
          textContent: { missingParagraphs: [], significantTextBlocks: [] },
          interactiveElements: { missingButtons: [], missingForms: [] },
          criticalData: { missingPrices: [], missingContent: [] },
          debugInfo: {
            rawHtmlLength: rawHtmlContent.length,
            rawTextLength: rawTextContent.length,
            renderedTextLength: document.body?.innerText?.length || 0,
            searchExamples: []
          }
        };

        // DEBUG: Check navigation - with detailed logging
        const visibleNavLinks = document.querySelectorAll('nav a, .nav a, .navigation a, .menu a, header a');
        console.log(`DEBUG: Found ${visibleNavLinks.length} visible nav links`);
        
        Array.from(visibleNavLinks).forEach((link, index) => {
          const linkText = link.innerText?.trim();
          const href = link.href;
          if (linkText && linkText.length > 2) {
            const searchText = linkText.toLowerCase().substring(0, 15);
            const foundInRawHtml = rawHtmlContent.toLowerCase().includes(searchText);
            const foundInRawText = rawTextContent.toLowerCase().includes(searchText);
            
            console.log(`DEBUG Nav ${index}: "${linkText}" -> HTML: ${foundInRawHtml}, Text: ${foundInRawText}`);
            missing.debugInfo.searchExamples.push(`Nav "${linkText}": HTML=${foundInRawHtml}, Text=${foundInRawText}`);
            
            if (!foundInRawHtml && !foundInRawText) {
              missing.navigation.missingLinks.push(linkText.substring(0, 30));
            }
          }
        });

        // DEBUG: Check headings - with detailed logging
        const visibleHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        console.log(`DEBUG: Found ${visibleHeadings.length} visible headings`);
        
        Array.from(visibleHeadings).forEach((heading, index) => {
          const headingText = heading.innerText?.trim();
          if (headingText && headingText.length > 3) {
            const searchText = headingText.toLowerCase().substring(0, 20);
            const foundInRawHtml = rawHtmlContent.toLowerCase().includes(searchText);
            const foundInRawText = rawTextContent.toLowerCase().includes(searchText);
            
            console.log(`DEBUG Heading ${index}: "${headingText}" -> HTML: ${foundInRawHtml}, Text: ${foundInRawText}`);
            missing.debugInfo.searchExamples.push(`Heading "${headingText}": HTML=${foundInRawHtml}, Text=${foundInRawText}`);
            
            if (!foundInRawHtml && !foundInRawText) {
              missing.headings.missingHeadings.push(headingText.substring(0, 60));
            }
          }
        });

        // DEBUG: Check for significant text differences
        const renderedBodyText = document.body?.innerText || '';
        const textDifference = renderedBodyText.length - rawTextContent.length;
        console.log(`DEBUG: Text difference: ${textDifference} characters`);
        
        // Sample random sections of rendered text to see if they exist in raw
        const renderedSections = [];
        for (let i = 0; i < Math.min(5, Math.floor(renderedBodyText.length / 1000)); i++) {
          const start = i * 1000;
          const sample = renderedBodyText.substring(start, start + 100).trim();
          if (sample.length > 20) {
            const foundInRaw = rawTextContent.toLowerCase().includes(sample.toLowerCase().substring(0, 50));
            renderedSections.push({ sample, foundInRaw });
            console.log(`DEBUG Text Section ${i}: "${sample.substring(0, 50)}..." -> Found in raw: ${foundInRaw}`);
          }
        }
        
        missing.debugInfo.renderedSections = renderedSections;

        // Check for missing interactive elements (buttons with meaningful text)
        const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], .btn');
        console.log(`DEBUG: Found ${buttons.length} buttons`);
        
        Array.from(buttons).slice(0, 10).forEach((button, index) => {
          const buttonText = button.innerText?.trim() || button.value?.trim();
          if (buttonText && buttonText.length > 2) {
            const foundInRaw = rawHtmlContent.toLowerCase().includes(buttonText.toLowerCase());
            console.log(`DEBUG Button ${index}: "${buttonText}" -> Found in raw: ${foundInRaw}`);
            
            if (!foundInRaw) {
              missing.interactiveElements.missingButtons.push(buttonText.substring(0, 30));
            }
          }
        });

        // Check for missing pricing/data content
        const priceElements = document.querySelectorAll('[class*="price"], [class*="cost"], .currency, [data-price]');
        console.log(`DEBUG: Found ${priceElements.length} price elements`);
        
        Array.from(priceElements).slice(0, 10).forEach((el, index) => {
          const priceText = el.innerText?.trim();
          if (priceText && /[\$£€¥₹]|\d+\.\d{2}/.test(priceText)) {
            const foundInRaw = rawHtmlContent.toLowerCase().includes(priceText.toLowerCase());
            console.log(`DEBUG Price ${index}: "${priceText}" -> Found in raw: ${foundInRaw}`);
            
            if (!foundInRaw) {
              missing.criticalData.missingPrices.push(priceText.substring(0, 20));
            }
          }
        });

        return {
          navigation: {
            count: missing.navigation.missingLinks.length,
            examples: missing.navigation.missingLinks.slice(0, 3)
          },
          headings: {
            count: missing.headings.missingHeadings.length,
            examples: missing.headings.missingHeadings.slice(0, 3)
          },
          textContent: {
            count: missing.textContent.missingParagraphs.length,
            totalMissingChars: missing.textContent.missingParagraphs.reduce((sum, p) => sum + p.length, 0),
            examples: missing.textContent.missingParagraphs.slice(0, 2).map(p => p.preview)
          },
          interactiveElements: {
            count: missing.interactiveElements.missingButtons.length,
            examples: missing.interactiveElements.missingButtons.slice(0, 3)
          },
          criticalData: {
            count: missing.criticalData.missingPrices.length,
            examples: missing.criticalData.missingPrices.slice(0, 3)
          },
          debugInfo: missing.debugInfo
        };
      }, rawHtml, rawText);

      console.log(`  ✅ True missing content analysis completed`);
      console.log(`  📊 Missing navigation: ${trulyMissingContent.navigation.count}`);
      console.log(`  📊 Missing headings: ${trulyMissingContent.headings.count}`);
      console.log(`  📊 Missing text content: ${trulyMissingContent.textContent.count}`);
      console.log(`  📊 Missing interactive: ${trulyMissingContent.interactiveElements.count}`);
      console.log(`  📊 Missing critical data: ${trulyMissingContent.criticalData.count}`);
      console.log(`  🔍 Debug search examples: ${JSON.stringify(trulyMissingContent.debugInfo.searchExamples.slice(0, 3))}`);

      return {
        summary: this.generateLLMFocusedSummary(trulyMissingContent),
        trulyMissingContent: trulyMissingContent,
        recommendations: this.generateLLMFocusedRecommendations(trulyMissingContent)
      };

    } catch (error) {
      console.error(`  ❌ LLM-focused content analysis failed: ${error.message}`);
      console.error(`  ❌ Stack trace: ${error.stack}`);
      return {
        error: error.message,
        summary: 'Unable to analyze LLM-accessible content',
        recommendations: ['Manual content inspection required']
      };
    }
  }

  generateLLMFocusedSummary(missingContent) {
    // Generate the technical summary
    const issues = [];
    
    if (missingContent.navigation.count > 0) {
      issues.push(`${missingContent.navigation.count} navigation links truly missing from HTML`);
    }
    
    if (missingContent.headings.count > 0) {
      issues.push(`${missingContent.headings.count} headings not in raw HTML`);
    }
    
    if (missingContent.textContent.count > 0) {
      const totalChars = missingContent.textContent.totalMissingChars;
      issues.push(`${missingContent.textContent.count} text blocks missing (~${Math.round(totalChars/1000)}k chars)`);
    }
    
    if (missingContent.interactiveElements.count > 0) {
      issues.push(`${missingContent.interactiveElements.count} interactive elements missing`);
    }
    
    if (missingContent.criticalData.count > 0) {
      issues.push(`${missingContent.criticalData.count} pricing/data elements missing`);
    }
    
    // Generate the plain-language "Bottom Line" summary
    const bottomLine = this.generateBottomLineSummary(missingContent);
    
    if (issues.length === 0) {
      return 'Content appears accessible to LLMs - no significant missing elements detected';
    }
    
    const examples = [];
    if (missingContent.navigation.examples.length > 0) {
      examples.push(`Nav: "${missingContent.navigation.examples[0]}"`);
    }
    if (missingContent.headings.examples.length > 0) {
      examples.push(`Heading: "${missingContent.headings.examples[0]}"`);
    }
    if (missingContent.criticalData.examples.length > 0) {
      examples.push(`Price: "${missingContent.criticalData.examples[0]}"`);
    }
    
    const exampleText = examples.length > 0 ? ` (e.g., ${examples.slice(0, 2).join(', ')})` : '';
    const technicalSummary = `LLM Impact: ${issues.join(' | ')}${exampleText}`;
    
    // Combine technical and plain-language summaries
    return `${technicalSummary} | BOTTOM LINE: ${bottomLine}`;
  }

  generateBottomLineSummary(missingContent) {
    const willMiss = [];
    const willStillGet = [];
    
    // What LLMs will miss
    if (missingContent.criticalData.count > 0) {
      willMiss.push(`actual prices/costs (${missingContent.criticalData.count} missing - CRITICAL)`);
    }
    
    if (missingContent.headings.count > 0) {
      willMiss.push(`page structure/headings (${missingContent.headings.count} missing)`);
    }
    
    if (missingContent.navigation.count > 0) {
      willMiss.push(`some navigation options (${missingContent.navigation.count} links)`);
    }
    
    if (missingContent.textContent.totalMissingChars > 5000) {
      willMiss.push(`significant content blocks (~${Math.round(missingContent.textContent.totalMissingChars/1000)}k characters)`);
    }
    
    if (missingContent.interactiveElements.count > 0) {
      willMiss.push(`interactive functionality (${missingContent.interactiveElements.count} elements - not critical for content)`);
    }
    
    // What LLMs will still get (based on what's NOT missing)
    if (missingContent.headings.count === 0) {
      willStillGet.push('page structure and headings');
    }
    
    if (missingContent.textContent.totalMissingChars < 2000) {
      willStillGet.push('most descriptive text');
    }
    
    if (missingContent.criticalData.count === 0) {
      willStillGet.push('pricing and key data');
    }
    
    if (missingContent.navigation.count <= 2) {
      willStillGet.push('main navigation');
    }
    
    // Always add these likely positives
    willStillGet.push('basic page information');
    if (missingContent.textContent.count < 3) {
      willStillGet.push('general content');
    }
    
    // Format the bottom line
    let summary = '';
    
    if (willMiss.length === 0) {
      summary = 'LLMs can access virtually all content without JavaScript';
    } else {
      summary = `LLMs will miss: ${willMiss.join(', ')}`;
      
      if (willStillGet.length > 0) {
        summary += ` | BUT will still get: ${willStillGet.join(', ')}`;
      }
    }
    
    return summary;
  }

  generateLLMFocusedRecommendations(missingContent) {
    const recommendations = [];
    const totalIssues = missingContent.navigation.count + missingContent.headings.count + 
                       missingContent.textContent.count + missingContent.interactiveElements.count + 
                       missingContent.criticalData.count;
    
    if (totalIssues === 0) {
      recommendations.push('✅ Excellent LLM accessibility - all content available in raw HTML');
      recommendations.push('🤖 LLMs can access this content without JavaScript rendering');
      return recommendations;
    }
    
    if (missingContent.criticalData.count > 0) {
      recommendations.push(`💰 CRITICAL: ${missingContent.criticalData.count} pricing/data elements require JavaScript - essential for analysis`);
    }
    
    if (missingContent.headings.count > 0) {
      recommendations.push(`📝 HIGH: ${missingContent.headings.count} headings missing from raw HTML - affects content structure understanding`);
    }
    
    if (missingContent.navigation.count > 0) {
      recommendations.push(`🧭 MEDIUM: ${missingContent.navigation.count} navigation links require JavaScript - impacts site discovery`);
    }
    
    if (missingContent.textContent.count > 0) {
      const chars = missingContent.textContent.totalMissingChars;
      recommendations.push(`📄 MEDIUM: ${Math.round(chars/1000)}k characters of content missing - significant for comprehensive analysis`);
    }
    
    if (missingContent.interactiveElements.count > 0) {
      recommendations.push(`🔧 LOW: ${missingContent.interactiveElements.count} interactive elements require JavaScript - functional but not content-critical`);
    }
    
    // Overall recommendation
    if (totalIssues > 5) {
      recommendations.push('🚨 RECOMMENDATION: JavaScript rendering essential for LLM access - use Playwright/Puppeteer');
    } else if (totalIssues > 2) {
      recommendations.push('⚠️ RECOMMENDATION: Consider JavaScript rendering for complete content access');
    } else {
      recommendations.push('✅ RECOMMENDATION: Most content accessible without JavaScript rendering');
    }
    
    return recommendations;
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
    
    // Get JS content analysis from the first successful browser
    const successfulBrowser = Object.values(this.results.browsers).find(b => b.status === 'success');
    const jsContent = successfulBrowser?.jsRenderedContent;
    
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

${jsContent ? `
🎯 LLM-FOCUSED CONTENT ANALYSIS
------------------------------
${jsContent.summary || 'No additional content details available'}

${jsContent.trulyMissingContent ? `
CONTENT TRULY MISSING FROM RAW HTML:
${jsContent.trulyMissingContent.navigation.count > 0 ? `• Navigation: ${jsContent.trulyMissingContent.navigation.count} links missing` : ''}
${jsContent.trulyMissingContent.headings.count > 0 ? `• Headings: ${jsContent.trulyMissingContent.headings.count} headings missing` : ''}
${jsContent.trulyMissingContent.textContent.count > 0 ? `• Text Content: ${jsContent.trulyMissingContent.textContent.count} blocks missing (~${Math.round(jsContent.trulyMissingContent.textContent.totalMissingChars/1000)}k chars)` : ''}
${jsContent.trulyMissingContent.criticalData.count > 0 ? `• Critical Data: ${jsContent.trulyMissingContent.criticalData.count} pricing/data elements missing` : ''}
${jsContent.trulyMissingContent.interactiveElements.count > 0 ? `• Interactive: ${jsContent.trulyMissingContent.interactiveElements.count} elements missing` : ''}
` : ''}

LLM-SPECIFIC RECOMMENDATIONS:
${jsContent && jsContent.recommendations ? jsContent.recommendations.map(r => `• ${r}`).join('\n') : 'No specific content recommendations available'}
` : ''}

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
      const jsContent = chromiumResults.jsRenderedContent || {};

      // Safely handle all potential undefined values
      const recommendations = Array.isArray(this.results.recommendations) ? this.results.recommendations : [];
      const frameworksDetected = Array.isArray(summary.frameworksDetected) ? summary.frameworksDetected : [];
      
      const recommendationText = recommendations.length > 0 ? 
        recommendations.slice(0, 2).join(' | ') : 
        'Analysis complete';

      const githubUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

      // Enhanced data with LLM-focused JS content analysis
      const missingContent = jsContent.trulyMissingContent || {};
      const criticalMissing = (missingContent.criticalData?.count || 0) + (missingContent.headings?.count || 0);
      const navigationMissing = missingContent.navigation?.count > 0 ? 'Yes' : 'No';
      const headingsMissing = missingContent.headings?.count > 0 ? 'Yes' : 'No';
      const interactiveCount = missingContent.interactiveElements?.count || 0;
      const dataCount = missingContent.criticalData?.count || 0;
      
      // Determine impact level based on truly missing content
      let impactLevel = 'Low';
      if (criticalMissing > 3 || dataCount > 0) impactLevel = 'High';
      else if (criticalMissing > 0 || navigationMissing === 'Yes') impactLevel = 'Medium';
      
      const contentExample = missingContent.headings?.examples?.[0] || 
                           missingContent.navigation?.examples?.[0] || 
                           missingContent.criticalData?.examples?.[0] || 'None';

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
          new Date().toISOString(),
          // Enhanced LLM-focused JS content columns
          jsContent.summary || 'No LLM analysis available',
          criticalMissing,
          navigationMissing,
          headingsMissing,
          interactiveCount,
          dataCount,
          impactLevel,
          contentExample.substring(0, 50),
          chromiumResults.evasionUsed || 'standard',
          chromiumResults.status === 'protected_site' || chromiumResults.status === 'failed' ? 'Yes' : 'No',
          summary.analysisConfidence || 100
        ]
      ];

      console.log(`📝 Updating range B${rowNumber}:U${rowNumber} with enhanced LLM-focused data`);

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `B${rowNumber}:U${rowNumber}`,
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

// Run the analysis with timeout protection
if (require.main === module) {
  console.log('🚀 Starting analyzer script...');
  console.log('📋 Environment check:');
  console.log(`  TARGET_URL: ${process.env.TARGET_URL || 'MISSING'}`);
  console.log(`  ANALYSIS_TYPE: ${process.env.ANALYSIS_TYPE || 'full (default)'}`);
  console.log(`  NODE_VERSION: ${process.version}`);
  
  // Add a global timeout to prevent hanging
  const GLOBAL_TIMEOUT = 10 * 60 * 1000; // 10 minutes
  const timeout = setTimeout(() => {
    console.error('❌ GLOBAL TIMEOUT: Analysis took longer than 10 minutes');
    process.exit(1);
  }, GLOBAL_TIMEOUT);
  
  const analyzer = new AdvancedJSAnalyzer();
  analyzer.analyze()
    .then(() => {
      clearTimeout(timeout);
      console.log('🎉 Analysis completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      clearTimeout(timeout);
      console.error('❌ FATAL ERROR:', error);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Error details:', {
        message: error.message,
        name: error.name,
        code: error.code
      });
      process.exit(1);
    });
}

module.exports = AdvancedJSAnalyzer;
