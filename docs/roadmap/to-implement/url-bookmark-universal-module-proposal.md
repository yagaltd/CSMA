# URL Bookmarking & Content Fetcher - Universal Module Proposal

> **Goal**: Create a unified module that works on **Chrome Extension (MV3)** and **CapacitorJS mobile apps** to bookmark URLs, fetch their content, and store them as markdown for LLM processing.

---

## 1. The Challenge: Unified UX Across Extension & Mobile

### Chrome Extension Flow
1. User clicks extension icon/bookmark button
2. URL is extracted from current tab automatically
3. Content fetched via background script (no CORS issues)
4. Markdown generated and stored
5. Content available immediately in popup/background

### Mobile App Flow (CapacitorJS)
1. User is browsing in mobile browser or another app
2. User taps "Share" → "Your CSMA App"
3. URL is received via Share Extension/Intent
4. Content fetched via Capacitor proxy/fetch
5. Markdown generated and stored
6. In-app notification: "URL bookmarked!"

### The Problem
These are **fundamentally different entry points** that need to be handled by the **same core logic** to avoid code duplication.

---

## 2. CSMA-Compliant Solution: Unified Architecture

### Module Structure
```
modules/url-bookmarker/
├── index.js                          # Public API exports
├── services/                         # Core business logic
│   ├── URLBookmarkService.js         # Orchestrator (Type III)
│   ├── ContentFetcher.js             # Fetch HTML from URL
│   ├── MarkdownConverter.js          # HTML → Markdown
│   └── URLExtractor.js               # Extract metadata
├── platform/
│   ├── chrome-extension/            # Chrome-specific implementation
│   │   ├── background.js             # Service Worker listener
│   │   ├── popup.js                  # Popup UI (Type II)
│   │   ├── manifest.json             # Extension manifest
│   │   └── content-script.js         # Extract from page
│   └── capacitor/                   # Mobile implementation
│       ├── ios/ShareExtension/       # iOS Share Extension
│       │   └── ShareViewController.swift
│       ├── android/                  # Android Intent handling
│       │   └── IntentHandler.java
│       └── mobile-share-listener.js  # JS layer for mobile
├── storage/
│   ├── BookmarkStore.js              # IndexedDB/Capacitor wrapper
│   └── SyncQueue.js                  # Sync between platforms
└── contracts/
    └── URLBookmarkContracts.js       # Event schemas
```

### Key Insight: Unified Event Flow

**Both entry points publish the SAME event**: `INTENT_BOOKMARK_URL`

**Chrome Extension (MV3)**:
```javascript
// background.js
chrome.action.onClicked.addListener(async (tab) => {
  eventBus.publish('INTENT_BOOKMARK_URL', {
    source: 'chrome-extension',
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    timestamp: Date.now()
  });
});
```

**Mobile (CapacitorJS)**:
```javascript
// mobile-share-listener.js (runs in main app)
App.addListener('appUrlOpen', async (data) => {
  const url = extractFromShareData(data); // Parse URL from intent
  
  eventBus.publish('INTENT_BOOKMARK_URL', {
    source: 'capacitor-mobile',
    url: url,
    title: '[Will be fetched]',
    timestamp: Date.now()
  });
});
```

**The `URLBookmarkService` handles both identically**:
```javascript
// URLBookmarkService.js (CSMA Type III)
export function createURLBookmarkService(eventBus) {
  eventBus.subscribe('INTENT_BOOKMARK_URL', async (payload) => {
    const [err, data] = bookmarkIntentContract.validate(payload);
    if (err) { handleError(err); return; }
    
    // SAME code for both platforms!
    try {
      const html = await ContentFetcher.fetch(data.url);
      const markdown = await MarkdownConverter.convert(html, {
        url: data.url,
        title: data.title,
        favicon: data.favIconUrl
      });
      
      const bookmark = createBookmarkRecord(data, markdown);
      
      await BookmarkStore.save(bookmark);
      
      eventBus.publish('URL_BOOKMARKED', {
        id: bookmark.id,
        url: data.url,
        title: bookmark.title,
        savedAt: bookmark.savedAt
      });
    } catch (error) {
      eventBus.publish('BOOKMARK_ERROR', { ... });
    }
  });
}
```

---

## 3. Platform-Specific Implementation Details

### Chrome Extension (MV3)

#### Setup
```json
// src/modules/url-bookmarker/platform/chrome-extension/manifest.json
{
  "manifest_version": 3,
  "name": "CSMA URL Bookmarker",
  "permissions": [
    "tabs",
    "storage",
    "activeTab",
    "https://*/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
}
```

#### Background Script (Service Worker)
```javascript
// src/modules/url-bookmarker/platform/chrome-extension/background.js
import { EventBus } from '../../../runtime/EventBus.js';
import { createURLBookmarkService } from '../../services/URLBookmarkService.js';
import { URLBookmarkContracts } from '../../contracts/URLBookmarkContracts.js';

const eventBus = new EventBus();
eventBus.contracts = URLBookmarkContracts;

// Initialize service
const bookmarkService = createURLBookmarkService(eventBus);

// Listen for extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  eventBus.publish('INTENT_BOOKMARK_URL', {
    source: 'chrome-extension',
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl
  });
});

// Listen for context menu bookmarks
chrome.contextMenus.create({
  id: 'bookmark-link',
  title: 'Bookmark Link',
  contexts: ['link']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'bookmark-link') {
    eventBus.publish('INTENT_BOOKMARK_URL', {
      source: 'chrome-extension-context-menu',
      url: info.linkUrl,
      title: info.selectionText || info.linkUrl,
      favIconUrl: tab?.favIconUrl
    });
  }
});

// Listen for success/failure and show notifications
eventBus.subscribe('URL_BOOKMARKED', (data) => {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'URL Bookmarked',
    message: data.title || data.url,
    priority: 0
  });
});

eventBus.subscribe('BOOKMARK_ERROR', (error) => {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'Bookmark Failed',
    message: error.message || 'Unknown error',
    priority: 2
  });
});
```

#### Storage (uses chrome.storage for persistence)
```javascript
// In BookmarkStore.js - Chrome Extension path
export class ChromeBookmarkStore {
  constructor() {
    this.db = chrome.storage.local;
  }
  
  async save(bookmark) {
    return new Promise((resolve) => {
      this.db.set({ [`bookmark-${bookmark.id}`]: bookmark }, resolve);
    });
  }
}
```

### Mobile (CapacitorJS)

#### iOS Share Extension Setup
```swift
// platform/capacitor/ios/ShareExtension/ShareViewController.swift
import UIKit
import Social

class ShareViewController: UIViewController {
  private let urlScheme = "csma-app-share"
  
  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    handleSharedURL()
  }
  
  private func handleSharedURL() {
    guard let extensionContext = extensionContext,
          let item = extensionContext.inputItems.first as? NSExtensionItem,
          let attachments = item.attachments else { return }
    
    for attachment in attachments {
      if attachment.hasItemConformingToTypeIdentifier("public.url") {
        attachment.loadItem(forTypeIdentifier: "public.url", options: nil) { (url, error) in
          if let sharedURL = url as? URL {
            self.openMainApp(with: sharedURL.absoluteString)
          }
        }
      }
    }
  }
  
  private func openMainApp(with urlString: String) {
    let urlString = "\(urlScheme)://?url=\(urlString)"
    let encoded = urlString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)!
    
    if let url = URL(string: encoded) {
      var responder: UIResponder? = self
      while responder != nil {
        if let application = responder as? UIApplication {
          application.open(url) { _ in
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
          }
          return
        }
        responder = responder?.next
      }
    }
  }
}
```

#### Android Intent Filter Setup
```xml
<!-- In AndroidManifest.xml under platforms/capacitor/android/app/src/main/ -->
<activity
  android:name=".MainActivity"
  android:launchMode="singleTask"
  android:exported="true">
  
  <!-- Accept shared URLs from browsers -->
  <intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
  </intent-filter>
  
  <!-- Accept shared web pages (shares entire page) -->
  <intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
  </intent-filter>
</activity>
```

#### Mobile Share Listener (JavaScript)
```javascript
// src/modules/url-bookmarker/platform/capacitor/mobile-share-listener.js
import { App, Share } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';

export function initializeMobileShareListener(eventBus) {
  // iOS: Listen for URL scheme opens from Share Extension
  App.addListener('appUrlOpen', async (data) => {
    if (data.url.includes('csma-app-share://')) {
      const url = new URL(data.url);
      const sharedUrl = url.searchParams.get('url');
      
      if (sharedUrl) {
        eventBus.publish('INTENT_BOOKMARK_URL', {
          source: 'capacitor-ios-share',
          url: sharedUrl
        });
      }
    }
  });
  
  // Android: Check for shared intent when app opens
  App.addListener('appStateChange', async (state) => {
    if (state.isActive) {
      // Android sharing sends data via intent extras
      try {
        const intentUrl = await Share.getShareIntent(); // Custom plugin or use App.getLaunchUrl()
        if (intentUrl) {
          eventBus.publish('INTENT_BOOKMARK_URL', {
            source: 'capacitor-android-share',
            url: intentUrl.value
          });
        }
      } catch (e) {
        // No shared URL
      }
    }
  });
}
```

#### Capacitor Storage (IndexedDB wrapper)
```javascript
// In BookmarkStore.js - Mobile/Capacitor path
import { Storage } from '@capacitor/storage';

export class CapacitorBookmarkStore {
  async save(bookmark) {
    await Storage.set({
      key: `bookmark-${bookmark.id}`,
      value: JSON.stringify(bookmark)
    });
  }
  
  async getAll() {
    const { keys } = await Storage.keys();
    const bookmarkKeys = keys.filter(k => k.startsWith('bookmark-'));
    
    const bookmarks = [];
    for (const key of bookmarkKeys) {
      const { value } = await Storage.get({ key });
      bookmarks.push(JSON.parse(value));
    }
    
    return bookmarks;
  }
}
```

---

## 4. Core Services (Platform-Agnostic)

### ContentFetcher Service
```javascript
// src/modules/url-bookmarker/services/ContentFetcher.js
export class ContentFetcher {
  static async fetch(url, options = {}) {
    const { timeout = 10000 } = options;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      // Chrome Extension: Use fetch() directly (no CORS in MV3)
      // Mobile: Goes through Capacitor HTTP plugin or fetch()
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': getAppropriateUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,*/*'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      return {
        html,
        url: response.url, // Final URL (after redirects)
        status: response.status,
        contentType: response.headers.get('content-type')
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }
}
```

### MarkdownConverter Service
```javascript
// src/modules/url-bookmarker/services/MarkdownConverter.js
export class MarkdownConverter {
  static async convert(fetchedData, metadata = {}) {
    const { html, url } = fetchedData;
    const { title, favicon } = metadata;
    
    // Remove scripts, styles, ads
    const cleanedHtml = this.sanitizeHtml(html);
    
    // Extract main content (simple algorithm)
    const mainContent = this.extractMainContent(cleanedHtml);
    
    // Convert to markdown
    const markdown = this.htmlToMarkdown(mainContent);
    
    // Add metadata header
    const header = `---\ntitle: ${title}\nurl: ${url}\nfavicon: ${favicon}\nsaved: ${new Date().toISOString()}\n---\n\n`;
    
    return header + markdown;
  }
  
  static sanitizeHtml(html) {
    // Remove <script>, <style>, <nav>, <aside>, <footer> elements
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const removeSelectors = ['script', 'style', 'nav', 'aside', 'footer', '.ad'];
    
    removeSelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    return doc.body.innerHTML;
  }
  
  static extractMainContent(html) {
    // Simple algorithm: prefer <article>, <main>, or largest <div>
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    const article = doc.querySelector('article');
    if (article) return article.innerHTML;
    
    const main = doc.querySelector('main');
    if (main) return main.innerHTML;
    
    // Fallback: find largest text block
    const divs = [...doc.querySelectorAll('div')];
    return divs.reduce((largest, div) => 
      div.textContent.length > largest.textContent.length ? div : largest
    ).innerHTML;
  }
  
  static htmlToMarkdown(html) {
    // Simple conversion: h1-h6 → #, <p> → \n\n, <a> → [text](href), <b> → **
    // For production, consider using turndown.js (if you can accept the dependency)
    
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<a[^>]*href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<ul[^>]*>|<\/ul>/gi, '')
      .replace(/<ol[^>]*>|<\/ol>/gi, '');
  }
}
```

### URLBookmarkService (Main Orchestrator)
```javascript
// src/modules/url-bookmarker/services/URLBookmarkService.js
import { ContentFetcher } from './ContentFetcher.js';
import { MarkdownConverter } from './MarkdownConverter.js';
import { URLExtractor } from './URLExtractor.js';

export function createURLBookmarkService(eventBus, store) {
  // Subscribe to bookmark intents
  eventBus.subscribe('INTENT_BOOKMARK_URL', async (payload) => {
    const [error, data] = bookmarkIntentContract.validate(payload);
    if (error) {
      eventBus.publish('BOOKMARK_ERROR', {
        type: 'INVALID_PAYLOAD',
        error: error.message
      });
      return;
    }
    
    const { url } = data;
    const bookmarkId = `bookmark-${Date.now()}-${hash(url)}`;
    
    try {
      // Show loading state
      eventBus.publish('BOOKMARK_STATUS', {
        id: bookmarkId,
        status: 'fetching',
        url
      });
      
      // Step 1: Fetch content
      const fetched = await ContentFetcher.fetch(url);
      
      // Extract metadata from fetched content
      const metadata = URLExtractor.extractDetails(fetched.html, {
        url: fetched.url
      });
      
      // Step 2: Convert to markdown
      const markdown = await MarkdownConverter.convert(fetched, {
        title: metadata.title,
        favicon: metadata.favicon
      });
      
      // Step 3: Create bookmark
      const bookmark = {
        id: bookmarkId,
        url: fetched.url,
        originalUrl: url,
        title: metadata.title,
        description: metadata.description,
        favicon: metadata.favicon || data.favIconUrl,
        markdown,
        savedAt: Date.now(),
        platform: data.source, // 'chrome-extension', 'capacitor-ios', etc.
        tags: [],
        metadata: {
          language: metadata.language,
          wordCount: markdown.split(' ').length,
          readingTime: Math.ceil(markdown.split(' ').length / 200) // 200 wpm
        }
      };
      
      // Step 4: Store
      await store.save(bookmark);
      
      // Success!
      eventBus.publish('URL_BOOKMARKED', bookmark);
      
    } catch (error) {
      eventBus.publish('BOOKMARK_ERROR', {
        id: bookmarkId,
        url,
        type: 'FETCH_ERROR',
        error: error.message
      });
    }
  });
  
  return {
    // Optional: Methods for getting/saving bookmarks
    getBookmarks: () => store.getAll(),
    deleteBookmark: (id) => store.delete(id),
    clearBookmarks: () => store.clear()
  };
}
```

---

## 5. Data Flow: How It Works

### Chrome Extension Sequence
```
User clicks extension icon
    ↓
chrome.action.onClicked → Publish INTENT_BOOKMARK_URL
    ↓
URLBookmarkService receives
    ↓
ContentFetcher.fetch() → HTML from URL
    ↓
MarkdownConverter.convert() → Markdown
    ↓
BookmarkStore.save() → chrome.storage.local
    ↓
eventBus.publish('URL_BOOKMARKED') → Show notification
```

### Mobile Capacitor Sequence
```
User shares URL to app
    ↓
ShareExtension/Intent → App opens with URL
    ↓
App listener → Publish INTENT_BOOKMARK_URL
    ↓
URLBookmarkService receives (same service!)
    ↓
ContentFetcher.fetch() → HTML from URL
    ↓
MarkdownConverter.convert() → Markdown
    ↓
BookmarkStore.save() → Storage plugin (IndexedDB)
    ↓
eventBus.publish('URL_BOOKMARKED') → Show toast
```

---

## 6. Sync Between Platforms (Optional)

### Use Case: Bookmark on Mobile, Access on Desktop

```javascript
// Add SyncQueue to the module
import { createSyncQueueService } from '../sync-queue/services/SyncQueueService.js';

export function createBookmarkSync(bookmarks, options = {}) {
  const syncQueue = createSyncQueueService(eventBus);
  
  // When bookmark saved, queue for sync
  eventBus.subscribe('URL_BOOKMARKED', (bookmark) => {
    if (options.syncEnabled) {
      syncQueue.add({
        type: 'bookmark',
        action: 'create',
        payload: bookmark,
        syncTo: options.syncTargets // ['cloud-storage', 'other-devices']
      });
    }
  });
}
```

**Storage options**:
- **Self-hosted**: Use CSMA's `modules/sync-queue` + your API
- **Cloud**: Store in Google Drive / Dropbox (browser extension) and Capacitor Filesystem (mobile)
- **P2P**: Use WebRTC data channels (advanced)

---

## 7. Implementation Guide for Developer

### Step 1: Create Module Structure
```bash
# From CSMA-kit root
cd src/modules
mkdir -p url-bookmarker/{services,platform/chrome-extension,platform/capacitor,storage,contracts}
touch url-bookmarker/index.js
```

### Step 2: Implement Core Services (do these first!)
```bash
# 1. Create platform-agnostic services
nano url-bookmarker/services/URLExtractor.js
# Copy regex patterns and extraction logic

nano url-bookmarker/services/ContentFetcher.js
# Port fetch with timeout/abort

nano url-bookmarker/services/MarkdownConverter.js
# Create HTML → Markdown converter

nano url-bookmarker/services/URLBookmarkService.js
# Create the main orchestrator with EventBus
```

### Step 3: Create Chrome Extension
```bash
# 1. Create manifest
nano url-bookmarker/platform/chrome-extension/manifest.json

# 2. Create background script
nano url-bookmarker/platform/chrome-extension/background.js
# Implements chrome.action.onClicked

# 3. Create popup (optional)
nano url-bookmarker/platform/chrome-extension/popup.js
nano url-bookmarker/platform/chrome-extension/popup.html
```

### Step 4: Set Up Mobile Sharing
```bash
# iOS - Create Share Extension
cd platforms/capacitor/ios/App
mkdir -p ShareExtension
cd ../../../modules/url-bookmarker/platform/capacitor

# Android - Configure manifest
cat > android-intent-config.md << 'EOF'
# Add to: platforms/capacitor/android/app/src/main/AndroidManifest.xml
# Under <activity android:name=".MainActivity" ...>

<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
EOF

# 3. Create mobile share listener
nano url-bookmarker/platform/capacitor/mobile-share-listener.js
```

### Step 5: Create Platform Storage Adapters
```bash
# Chrome
nano url-bookmarker/storage/ChromeBookmarkStore.js

# Mobile/Capacitor
nano url-bookmarker/storage/CapacitorBookmarkStore.js

# Then create unified store
nano url-bookmarker/storage/BookmarkStore.js
# Detects platform and returns correct adapter
```

### Step 6: Wire Everything Together
```javascript
// url-bookmarker/index.js
import { createURLBookmarkService } from './services/URLBookmarkService.js';
import { ChromeBookmarkStore } from './storage/ChromeBookmarkStore.js';
import { CapacitorBookmarkStore } from './storage/CapacitorBookmarkStore.js';
import { isPlatform } from '../../runtime/platform.js';

export function createBookmarkModule(eventBus) {
  const store = isPlatform('chrome') 
    ? new ChromeBookmarkStore()
    : new CapacitorBookmarkStore();
  
  const service = createURLBookmarkService(eventBus, store);
  
  // Initialize platform-specific entry points
  if (isPlatform('chrome')) {
    chrome.action.onClicked.addListener(async (tab) => {
      eventBus.publish('INTENT_BOOKMARK_URL', { /* ... */ });
    });
  }
  
  if (isPlatform('capacitor')) {
    initializeMobileShareListener(eventBus);
  }
  
  return service;
}
```

### Step 7: Test Both Platforms

**Chrome**:
1. `npm run build`
2. Load extension in chrome://extensions/
3. Visit any page, click extension icon
4. Check DevTools → Application → Storage

**Mobile**:
1. `npm run build:mobile`
2. Open on device `npx cap open ios`
3. Browse to article in Safari
4. Share → Your CSMA App
5. App should open and show "URL bookmarked!"

---

## 8. CSMA Contracts (Event Definitions)

```javascript
// url-bookmarker/contracts/URLBookmarkContracts.js
export const URLBookmarkContracts = {
  INTENT_BOOKMARK_URL: {
    type: 'intent',
    schema: object({
      url: string(), // Must be valid URL
      title: optional(string()),
      favIconUrl: optional(string()),
      source: enums([
        'chrome-extension',
        'chrome-extension-context-menu',
        'capacitor-ios-share',
        'capacitor-android-share'
      ]),
      timestamp: number()
    })
  },
  
  URL_BOOKMARKED: {
    type: 'event',
    schema: object({
      id: string(),
      url: string(),
      originalUrl: string(),
      title: string(),
      description: optional(string()),
      favicon: optional(string()),
      markdown: string(),
      savedAt: number(),
      platform: string(),
      tags: array(string()),
      metadata: object({
        language: optional(string()),
        wordCount: number(),
        readingTime: number()
      })
    })
  },
  
  BOOKMARK_STATUS: {
    type: 'event',
    schema: object({
      id: string(),
      status: enums(['fetching', 'converting', 'saving', 'complete']),
      url: string(),
      progress: optional(number())
    })
  },
  
  BOOKMARK_ERROR: {
    type: 'event',
    schema: object({
      id: string(),
      url: string(),
      type: enums([
        'INVALID_PAYLOAD',
        'FETCH_ERROR',
        'CONVERSION_ERROR',
        'STORAGE_ERROR',
        'TIMEOUT_ERROR'
      ]),
      error: string(),
      details: optional(object())
    })
  }
};
```

---

## 9. Benefits of This CSMA Approach

| Feature | Chrome Extension | Mobile (Capacitor) | Unified CSMA |
|---------|-----------------|-------------------|--------------|
| **Entry Point** | Icon click / Context menu | Share Extension / Intent | Both publish same event |
| **Core Logic** | Identical | Identical | Exactly the same service |
| **Storage** | chrome.storage.local | Capacitor Storage | Storage adapter pattern |
| **Content Fetch** | fetch() (no CORS) | Capacitor HTTP / fetch() | ContentFetcher abstraction |
| **Notifications** | chrome.notifications | Toast (Capacitor Toast plugin) | Event-driven notifications |
| **Code Reuse** | 70% | 70% | **90%** (only entry points differ) |
| **Testing** | Separate | Separate | Service testing covers both |
| **Sync** | Manual | Manual | Built-in SyncQueue support |

---

## 10. Advanced: Sync Between Devices

### Option 1: Export/Import (Simple)
```javascript
// Add to bookmark service
exportBookmark: async (id) => {
  const bookmarks = await store.get(id);
  const blob = new Blob([JSON.stringify(bookmarks, null, 2)], 
    { type: 'application/json' });
  return blob;
}

// User downloads from desktop, uploads to mobile
```

### Option 2: Cloud Storage (Google Drive)
```javascript
// Chrome Extension: Save to Drive
import { GoogleDriveSync } from './sync/GoogleDriveSync.js';

// Mobile: Capacitor FileSystem syncs to same location
```

### Option 3: Custom API + Sync Queue
```javascript
// Leverage existing sync-queue module
eventBus.subscribe('URL_BOOKMARKED', (bookmark) => {
  syncQueue.add({
    type: 'bookmark',
    payload: bookmark,
    endpoint: '/api/bookmarks',
    method: 'POST'
  });
});
```

---

## 11. Quick Reference for Developer

### Which Files to Create (in order):

1. **Core Services** (platform-agnostic)
   - `services/URLExtractor.js` - Platform-agnostic
   - `services/ContentFetcher.js` - Platform-agnostic
   - `services/MarkdownConverter.js` - Platform-agnostic
   - `services/URLBookmarkService.js` - Platform-agnostic

2. **Storage** (platform-specific adapters)
   - `storage/ChromeBookmarkStore.js` - Chrome extension
   - `storage/CapacitorBookmarkStore.js` - Mobile
   - `storage/BookmarkStore.js` - Unified interface

3. **Contracts** (CSMA pattern)
   - `contracts/URLBookmarkContracts.js` - Event schemas

4. **Platform Entry Points** (different for each)
   - Chrome: `platform/chrome-extension/background.js`
   - iOS: `platform/capacitor/ios/ShareExtension/ShareViewController.swift`
   - Android: Config in `platform/capacitor/android/`
   - Mobile JS: `platform/capacitor/mobile-share-listener.js`

5. **Main Index** (ties everything together)
   - `index.js` - Detects platform, wires up listeners

### Development Workflow:

**Day 1-2**: Build core services (URLExtractor, ContentFetcher, MarkdownConverter)
**Day 3**: Build URLBookmarkService with EventBus integration
**Day 4**: Create Chrome extension (background.js, manifest)
**Day 5**: Create iOS Share Extension (Swift)
**Day 6**: Create Android intent handling
**Day 7**: Test both platforms, fix bugs, add sync (optional)

**Total**: ~35-40 hours

### Testing Checklist:

- [ ] Chrome: Click extension icon → URL saved → Show notification
- [ ] Chrome: Right-click link → "Bookmark Link" → URL saved
- [ ] iOS: Safari → Share → CSMA App → App opens → URL saved
- [ ] Android: Chrome → Share → CSMA App → URL saved
- [ ] Both: Content fetched → Converted to markdown → Metadata extracted
- [ ] Both: Can view saved bookmarks in app
- [ ] Both: Storage persists between sessions
- [ ] Mobile: Works offline (stores URL, fetches when online)

---

## 12. Handling Edge Cases

### Mobile: No Internet Connection
```javascript
// In URLBookmarkService
try {
  const html = await ContentFetcher.fetch(url);
  // ... continue
} catch (error) {
  if (error.message.includes('Network error')) {
    // Store URL only, mark as "pending fetch"
    const bookmark = {
      id: bookmarkId,
      url,
      status: 'pending',
      savedAt: Date.now()
    };
    await store.save(bookmark);
    
    // Try again when online
    eventBus.subscribe('NETWORK_ONLINE', async () => {
      const pending = await store.getByStatus('pending');
      for (const b of pending) {
        retryBookmark(b);
      }
    });
  }
}
```

### Chrome Extension: Site with Auth/Cookies
```javascript
// ContentFetcher.fetch for Chrome
static async fetch(url, options = {}) {
  if (isChromeExtension()) {
    // Use chrome.tabs.executeScript to get content from authenticated page
    const [tab] = await chrome.tabs.query({ active: true });
    const html = await chrome.tabs.sendMessage(tab.id, { action: 'getHTML' });
    return { html, url: tab.url };
  }
  
  // Fallback to regular fetch for mobile
  return regularFetch(url, options);
}
```

---

## Summary

**The key insight**: Use CSMA's EventBus pattern to decouple entry points from core logic. Both Chrome Extension and Mobile publish `INTENT_BOOKMARK_URL`, and the same `URLBookmarkService` handles both.

**Result**: 90% code reuse, consistent behavior across platforms, and the ability to add new platforms (Firefox, Safari, Electron) by just adding new entry point listeners.

**Next Steps**: Start with core services (URLExtractor, ContentFetcher, MarkdownConverter) which are completely platform-agnostic, then add platform-specific entry points.

**Need Help?** Check `docs/guides/building-components.md` for CSMA patterns, review `modules/storage/` for platform storage adapters, and see `services/core/` for service patterns.
