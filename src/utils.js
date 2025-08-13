function createBrowserConfig(analysisType, browserName) {
  const baseConfig = {
    launchOptions: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    },
    contextOptions: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'America/New_York'
    }
  };

  if (analysisType === 'stealth') {
    baseConfig.launchOptions.args.push(
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor'
    );
    
    baseConfig.contextOptions.javaScriptEnabled = true;
    baseConfig.contextOptions.extraHTTPHeaders = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };
  }

  return baseConfig;
}

function detectFrameworks(html, page = null) {
  const frameworks = [];
  const patterns = {
    'React': [
      /react/i,
      /_reactInternalFiber/i,
      /data-reactroot/i,
      /__webpack_require__/,
      /react-dom/i
    ],
    'Vue.js': [
      /vue(?:\.js)?/i,
      /data-v-[a-f0-9]/i,
      /\[data-v-/i,
      /Vue\.component/i,
      /_vue/i
    ],
    'Angular': [
      /angular/i,
      /ng-version/i,
      /ng-app/i,
      /\[ng-/i,
      /@angular/i
    ],
    'Next.js': [
      /__NEXT_DATA__/i,
      /_next\/static/i,
      /next\.js/i,
      /_buildManifest/i
    ],
    'Nuxt.js': [
      /__NUXT__/i,
      /_nuxt\//i,
      /nuxt\.js/i
    ],
    'Svelte': [
      /svelte/i,
      /s-[A-Za-z0-9]+/,
      /svelte-[a-z0-9]/i
    ],
    'Alpine.js': [
      /x-data/i,
      /alpine/i,
      /@click/i,
      /x-show/i
    ],
    'Stimulus': [
      /data-controller/i,
      /stimulus/i
    ],
    'Ember.js': [
      /ember/i,
      /data-ember-action/i,
      /ember-application/i
    ],
    'Backbone.js': [
      /backbone/i,
      /data-backbone/i
    ],
    'jQuery': [
      /jquery/i,
      /\$\(/,
      /jQuery/
    ]
  };

  for (const [name, regexes] of Object.entries(patterns)) {
    if (regexes.some(regex => regex.test(html))) {
      frameworks.push(name);
    }
  }

  return frameworks;
}

function calculateScore(browsers, frameworks, avgDifferencePercent) {
  let score = 100;
  
  // Penalize based on content changes
  if (avgDifferencePercent > 50) {
    score -= 40;
  } else if (avgDifferencePercent > 25) {
    score -= 30;
  } else if (avgDifferencePercent > 10) {
    score -= 20;
  }
  
  // Penalize based on frameworks
  if (frameworks.length > 0) {
    const modernFrameworks = ['React', 'Vue.js', 'Angular', 'Next.js', 'Nuxt.js', 'Svelte'];
    const modernCount = frameworks.filter(f => modernFrameworks.includes(f)).length;
    score -= modernCount * 15;
  }
  
  // Check for significant changes across browsers
  const hasSignificantChanges = browsers.some(b => b.significantChange);
  if (hasSignificantChanges) {
    score -= 25;
  }
  
  // Penalize for low content in raw HTML
  const avgRawContent = browsers.reduce((sum, b) => sum + (b.rawContentLength || 0), 0) / browsers.length;
  if (avgRawContent < 500) {
    score -= 20;
  }
  
  // Bonus for good practices
  const hasGoodStructure = browsers.some(b => b.rawHtmlLength > 2000);
  if (hasGoodStructure) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = {
  createBrowserConfig,
  detectFrameworks,
  calculateScore
};
