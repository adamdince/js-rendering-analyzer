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
      
      // Apply enhanced stealth for Anthem
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

    // NEW: Analyze what specific content was added by JS
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
    console.log(`  🔍 Analyzing JS-rendered content...`);
    console.log(`  📏 Raw text length: ${rawText.length}`);
    console.log(`  📏 Rendered text length: ${renderedText.length}`);
    
    try {
      // Get specific content differences
      console.log(`  🔍 Running before/after comparison...`);
      const contentDifferences = await page.evaluate((rawTextContent) => {
        const differences = {
          navigation: { raw: 0, rendered: 0, examples: [] },
          headings: { raw: [], rendered: [], newHeadings: [] },
          pricing: { raw: [], rendered: [], newPrices: [] },
          forms: { raw: 0, rendered: 0, newElements: [] },
          images: { raw: 0, rendered: 0, examples: [] },
          buttons: { raw: 0, rendered: 0, newButtons: [] },
          textContent: { rawChars: 0, renderedChars: 0, majorSections: [] },
          lists: { raw: 0, rendered: 0, newLists: [] }
        };

        // Navigation analysis
        const navElements = document.querySelectorAll('nav, .nav, .navigation, .menu, header a');
        differences.navigation.rendered = navElements.length;
        differences.navigation.examples = Array.from(navElements)
          .slice(0, 5)
          .map(el => el.innerText?.trim().substring(0, 30))
          .filter(text => text && text.length > 0);

        // Heading analysis
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        differences.headings.rendered = Array.from(headings)
          .map(h => h.innerText?.trim())
          .filter(text => text && text.length > 0)
          .slice(0, 10);

        // Check for pricing patterns
        const priceElements = document.querySelectorAll('[class*="price"], [class*="cost"], [class*="amount"], .currency, [data-price]');
        differences.pricing.rendered = Array.from(priceElements)
          .map(el => el.innerText?.trim())
          .filter(text => text && /[\$£€¥₹]|\d+\.\d{2}|price|cost/.test(text))
          .slice(0, 8);

        // Form elements
        const forms = document.querySelectorAll('form, input, button, select, textarea');
        differences.forms.rendered = forms.length;
        differences.forms.newElements = Array.from(forms)
          .map(el => {
            if (el.tagName === 'BUTTON') return `Button: "${el.innerText?.trim().substring(0, 20)}"`;
            if (el.tagName === 'INPUT') return `Input[${el.type || 'text'}]`;
            if (el.tagName === 'SELECT') return `Dropdown with ${el.options?.length || 0} options`;
            if (el.tagName === 'FORM') return `Form with ${el.elements?.length || 0} elements`;
            return el.tagName.toLowerCase();
          })
          .slice(0, 10);

        // Image analysis
        const images = document.querySelectorAll('img[src], picture, [style*="background-image"]');
        differences.images.rendered = images.length;
        differences.images.examples = Array.from(images)
          .slice(0, 5)
          .map(img => {
            const alt = img.alt || img.getAttribute('aria-label') || '';
            const src = img.src || img.style.backgroundImage || '';
            return alt.substring(0, 30) || src.split('/').pop()?.substring(0, 20) || 'Image';
          });

        // List analysis  
        const lists = document.querySelectorAll('ul, ol, .list, [class*="list"]');
        differences.lists.rendered = lists.length;
        differences.lists.newLists = Array.from(lists)
          .map(list => {
            const items = list.querySelectorAll('li, .item, [class*="item"]').length;
            const preview = list.innerText?.trim().substring(0, 50) || '';
            return `${items} items: ${preview}`;
          })
          .slice(0, 5);

        // Overall text content
        differences.textContent.renderedChars = document.body?.innerText?.length || 0;

        // Find major content sections
        const contentSections = document.querySelectorAll('main, article, section, .content, [class*="content"]');
        differences.textContent.majorSections = Array.from(contentSections)
          .map(section => {
            const chars = section.innerText?.length || 0;
            const preview = section.innerText?.trim().substring(0, 60) || '';
            const className = section.className || section.tagName.toLowerCase();
            return { className, chars, preview };
          })
          .filter(section => section.chars > 100)
          .slice(0, 5);

        return differences;
      }, rawText);

      console.log(`  ✅ Before/after comparison completed`);

      // Now compare with what was in raw HTML
      const rawAnalysis = this.analyzeRawContent(rawText);
      const detailedDifferences = this.generateDetailedDifferences(rawAnalysis, contentDifferences);

      return {
        summary: this.generateBeforeAfterSummary(detailedDifferences),
        detailedDifferences: detailedDifferences,
        recommendations: this.generateFactBasedRecommendations(detailedDifferences)
      };

    } catch (error) {
      console.error(`  ❌ JS content analysis failed: ${error.message}`);
      console.error(`  ❌ Stack trace: ${error.stack}`);
      return {
        error: error.message,
        summary: 'Unable to analyze before/after differences',
        recommendations: ['Manual before/after comparison required']
      };
    }
  }

  analyzeRawContent(rawText) {
    // Simple text-based analysis of raw content
    const headingMatches = rawText.match(/<h[1-6][^>]*>([^<]+)</gi) || [];
    const linkMatches = rawText.match(/<a[^>]*>([^<]+)</gi) || [];
    const priceMatches = rawText.match(/[\$£€¥₹]\d+\.?\d*|\d+\.?\d*\s*(dollar|euro|pound|yen)/gi) || [];
    const buttonMatches = rawText.match(/<button[^>]*>([^<]+)</gi) || [];
    const formMatches = rawText.match(/<(form|input|select|textarea)[^>]*>/gi) || [];

    return {
      headings: headingMatches.length,
      links: linkMatches.length,
      prices: priceMatches.length,
      buttons: buttonMatches.length,
      forms: formMatches.length,
      totalChars: rawText.length
    };
  }

  generateDetailedDifferences(rawAnalysis, renderedAnalysis) {
    const differences = [];

    // Navigation differences
    if (renderedAnalysis.navigation.rendered > rawAnalysis.links) {
      differences.push({
        type: 'Navigation',
        raw: `${rawAnalysis.links} links`,
        rendered: `${renderedAnalysis.navigation.rendered} navigation elements`,
        newContent: renderedAnalysis.navigation.examples.slice(0, 3),
        impact: 'High - affects site crawlability'
      });
    }

    // Heading differences  
    if (renderedAnalysis.headings.rendered.length > rawAnalysis.headings) {
      differences.push({
        type: 'Headings',
        raw: `${rawAnalysis.headings} headings`,
        rendered: `${renderedAnalysis.headings.rendered.length} headings`,
        newContent: renderedAnalysis.headings.rendered.slice(0, 3),
        impact: 'High - affects content structure'
      });
    }

    // Pricing differences
    if (renderedAnalysis.pricing.rendered.length > rawAnalysis.prices) {
      differences.push({
        type: 'Pricing',
        raw: `${rawAnalysis.prices} price elements`,
        rendered: `${renderedAnalysis.pricing.rendered.length} price elements`,
        newContent: renderedAnalysis.pricing.rendered.slice(0, 3),
        impact: 'Critical - essential for e-commerce data'
      });
    }

    // Form/Interactive differences
    if (renderedAnalysis.forms.rendered > rawAnalysis.forms) {
      differences.push({
        type: 'Interactive Elements',
        raw: `${rawAnalysis.forms} form elements`,
        rendered: `${renderedAnalysis.forms.rendered} interactive elements`,
        newContent: renderedAnalysis.forms.newElements.slice(0, 3),
        impact: 'Medium - affects functionality'
      });
    }

    // Image differences
    if (renderedAnalysis.images.rendered > 0) {
      differences.push({
        type: 'Images',
        raw: 'Static/placeholder images',
        rendered: `${renderedAnalysis.images.rendered} loaded images`,
        newContent: renderedAnalysis.images.examples.slice(0, 3),
        impact: 'Low - mainly visual content'
      });
    }

    // Content sections
    if (renderedAnalysis.textContent.majorSections.length > 0) {
      const significantSections = renderedAnalysis.textContent.majorSections
        .filter(section => section.chars > 500);
      
      if (significantSections.length > 0) {
        differences.push({
          type: 'Content Sections',
          raw: `${rawAnalysis.totalChars} characters`,
          rendered: `${renderedAnalysis.textContent.renderedChars} characters`,
          newContent: significantSections.map(s => `${s.className}: ${s.preview}...`),
          impact: 'High - major content blocks'
        });
      }
    }

    return differences;
  }

  generateBeforeAfterSummary(differences) {
    if (differences.length === 0) {
      return 'No significant content differences detected between raw and rendered HTML';
    }

    const summary = differences.map(diff => {
      const change = `${diff.type}: ${diff.raw} → ${diff.rendered}`;
      if (diff.newContent && diff.newContent.length > 0) {
        const examples = diff.newContent.slice(0, 2).join(', ');
        return `${change} (e.g., ${examples})`;
      }
      return change;
    }).join(' | ');

    return `Before/After Changes: ${summary}`;
  }

  generateFactBasedRecommendations(differences) {
    const recommendations = [];

    differences.forEach(diff => {
      switch (diff.type) {
        case 'Navigation':
          recommendations.push(`🧭 Navigation: ${diff.rendered} elements missing from raw HTML - impacts crawling and LLM site mapping`);
          break;
        case 'Headings':
          recommendations.push(`📝 Content Structure: ${diff.rendered} headings only visible after JS - affects content hierarchy understanding`);
          break;
        case 'Pricing':
          recommendations.push(`💰 Pricing: ${diff.rendered} price elements load via JS - critical for e-commerce analysis`);
          break;
        case 'Interactive Elements':
          recommendations.push(`🔧 Functionality: ${diff.rendered} interactive elements require JS - limits automation capabilities`);
          break;
        case 'Content Sections':
          recommendations.push(`📄 Content: Major text sections added by JS - significant content missing from static HTML`);
          break;
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('✅ Content well-accessible - minimal dependency on JavaScript rendering');
    }

    return recommendations;
  }

  identifyMissingContent(rawText, renderedText, contentAnalysis) {
    const missing = [];
    
    // Check if major content types are missing from raw
    if (contentAnalysis.criticalElements.length > 0) {
      contentAnalysis.criticalElements.forEach(element => {
        if (element.type === 'Headings' && element.examples) {
          const missingHeadings = element.examples.filter(heading => 
            !rawText.toLowerCase().includes(heading.toLowerCase().substring(0, 20))
          );
          if (missingHeadings.length > 0) {
            missing.push({
              type: 'Headings',
              count: missingHeadings.length,
              examples: missingHeadings.slice(0, 2),
              impact: 'High - Important for content structure and SEO'
            });
          }
        }
      });
    }

    // Check navigation
    if (contentAnalysis.navigationElements.length > 0) {
      missing.push({
        type: 'Navigation',
        count: contentAnalysis.navigationElements.length,
        impact: 'High - Critical for site usability and crawling'
      });
    }

    // Check interactive elements
    if (contentAnalysis.interactiveElements.length > 0) {
      missing.push({
        type: 'Interactive Elements',
        count: contentAnalysis.interactiveElements.reduce((sum, el) => sum + el.count, 0),
        impact: 'Medium - Important for user functionality'
      });
    }

    // Check data elements
    if (contentAnalysis.dataElements.length > 0) {
      missing.push({
        type: 'Data Tables/Lists',
        count: contentAnalysis.dataElements.reduce((sum, el) => sum + el.count, 0),
        impact: 'High - Important structured data'
      });
    }

    return missing;
  }

  summarizeJSContent(contentAnalysis, missingContent) {
    const totalElements = Object.values(contentAnalysis.contentTypes).reduce((sum, type) => sum + type.count, 0);
    const totalText = Object.values(contentAnalysis.contentTypes).reduce((sum, type) => sum + type.totalText, 0);
    
    if (totalElements === 0) {
      return 'No significant content rendered by JavaScript';
    }

    const primaryContent = [];
    if (contentAnalysis.criticalElements.length > 0) {
      primaryContent.push(`${contentAnalysis.criticalElements.length} critical content types`);
    }
    if (contentAnalysis.navigationElements.length > 0) {
      primaryContent.push('navigation menus');
    }
    if (contentAnalysis.interactiveElements.length > 0) {
      primaryContent.push('interactive elements');
    }
    if (contentAnalysis.dataElements.length > 0) {
      primaryContent.push('data tables/lists');
    }

    return `JavaScript renders: ${primaryContent.join(', ')} (${totalElements} elements, ~${Math.round(totalText/1000)}k characters)`;
  }

  generateContentRecommendations(contentAnalysis, missingContent) {
    const recommendations = [];
    
    const highImpactMissing = missingContent.filter(item => item.impact.startsWith('High'));
    
    if (highImpactMissing.length > 0) {
      recommendations.push('🚨 Critical content missing from raw HTML - JS rendering essential');
      
      highImpactMissing.forEach(item => {
        switch (item.type) {
          case 'Headings':
            recommendations.push('📝 Page structure (headings) only available after JS execution');
            break;
          case 'Navigation':
            recommendations.push('🧭 Navigation menus require JavaScript - impacts crawlability');
            break;
          case 'Data Tables/Lists':
            recommendations.push('📊 Data content is dynamically loaded - use browser automation');
            break;
        }
      });
    }

    if (contentAnalysis.interactiveElements.length > 0) {
      recommendations.push('🔧 Interactive elements detected - functionality requires JS');
    }

    if (contentAnalysis.criticalElements.length === 0 && contentAnalysis.navigationElements.length === 0) {
      recommendations.push('✅ Minimal JS dependency - content mostly available in raw HTML');
    }

    return recommendations.length > 0 ? recommendations : ['Content analysis completed'];
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
🎯 JAVASCRIPT CONTENT ANALYSIS
------------------------------
${jsContent.summary || 'No additional content details available'}

${jsContent.missingFromRaw && jsContent.missingFromRaw.length > 0 ? `
CONTENT MISSING FROM RAW HTML:
${jsContent.missingFromRaw.map(item => `• ${item.type}: ${item.count} elements (${item.impact})`).join('\n')}

SPECIFIC CONTENT RENDERED BY JS:
${jsContent.criticalElements ? jsContent.criticalElements.map(el => `• ${el.type}: ${el.count} elements${el.examples ? ` (e.g., "${el.examples[0]}")` : ''}`).join('\n') : 'No critical elements detected'}
${jsContent.navigationElements && jsContent.navigationElements.length > 0 ? `• Navigation: ${jsContent.navigationElements[0].examples || 'Multiple navigation elements'}` : ''}
${jsContent.interactiveElements && jsContent.interactiveElements.length > 0 ? `• Interactive: ${jsContent.interactiveElements[0].examples ? jsContent.interactiveElements[0].examples.join(', ') : 'Forms and inputs'}` : ''}
${jsContent.dataElements && jsContent.dataElements.length > 0 ? `• Data: ${jsContent.dataElements[0].examples ? jsContent.dataElements[0].examples.join(', ') : 'Tables and structured data'}` : ''}
` : ''}

JS-SPECIFIC RECOMMENDATIONS:
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

      // Enhanced data with JS content analysis
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
          // New JS content columns
          jsContent.summary || 'No JS content analysis',
          jsContent.missingFromRaw ? jsContent.missingFromRaw.filter(item => item.impact.startsWith('High')).length : 0,
          jsContent.navigationElements && jsContent.navigationElements.length > 0 ? 'Yes' : 'No',
          jsContent.criticalElements ? jsContent.criticalElements.some(el => el.type === 'Headings') ? 'Yes' : 'No' : 'No',
          jsContent.interactiveElements ? jsContent.interactiveElements.reduce((sum, el) => sum + el.count, 0) : 0,
          jsContent.dataElements ? jsContent.dataElements.reduce((sum, el) => sum + el.count, 0) : 0,
          jsContent.missingFromRaw && jsContent.missingFromRaw.some(item => item.impact.startsWith('High')) ? 'High' : 
            jsContent.missingFromRaw && jsContent.missingFromRaw.some(item => item.impact.startsWith('Medium')) ? 'Medium' : 'Low',
          jsContent.criticalElements && jsContent.criticalElements.length > 0 ? 
            jsContent.criticalElements[0].examples ? jsContent.criticalElements[0].examples[0] : 'Content detected' : 'None',
          chromiumResults.evasionUsed || 'standard',
          chromiumResults.status === 'protected_site' || chromiumResults.status === 'failed' ? 'Yes' : 'No',
          summary.analysisConfidence || 100
        ]
      ];

      console.log(`📝 Updating range B${rowNumber}:U${rowNumber} with enhanced data`);

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
