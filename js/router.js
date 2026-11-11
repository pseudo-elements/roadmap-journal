/**
 * Lightweight Client-Side Hash Router
 * Maps URL hashes (/#/path) to view controller functions
 */

export class HashRouter {
  constructor(routes = [], rootElement = null) {
    this.routes = routes;
    this.rootElement = rootElement;
    this.currentViewCleanup = null;
    this.currentRoute = null;

    this.handleHashChange = this.handleHashChange.bind(this);
  }

  init() {
    window.addEventListener('hashchange', this.handleHashChange);
    // If no hash is set, default to #/
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = '#/';
    } else {
      this.handleHashChange();
    }
  }

  destroy() {
    window.removeEventListener('hashchange', this.handleHashChange);
    if (typeof this.currentViewCleanup === 'function') {
      this.currentViewCleanup();
    }
  }

  navigateTo(path) {
    if (!path.startsWith('#')) {
      path = '#' + (path.startsWith('/') ? path : '/' + path);
    }
    window.location.hash = path;
  }

  async handleHashChange() {
    const rawHash = window.location.hash.slice(1) || '/';
    
    // Support sub-anchors like #/roadmap/:id/topic/:topicId/lesson/:lessonId#quiz
    // The hash could be "#/roadmap/...#quiz".
    // We split by subsequent '#' to isolate the route path from the in-page anchor
    let pathPart = rawHash;
    let anchorPart = '';

    const secondHashIdx = rawHash.indexOf('#', 1);
    if (secondHashIdx !== -1) {
      pathPart = rawHash.slice(0, secondHashIdx);
      anchorPart = rawHash.slice(secondHashIdx + 1);
    }

    // Ensure leading slash
    if (!pathPart.startsWith('/')) {
      pathPart = '/' + pathPart;
    }

    // Match route
    let matchedRoute = null;
    let params = {};

    for (const route of this.routes) {
      const match = this.matchRoutePattern(route.pattern, pathPart);
      if (match) {
        matchedRoute = route;
        params = match;
        break;
      }
    }

    // If no route matches, fallback to default or home route
    if (!matchedRoute) {
      console.warn(`Route not found for path: ${pathPart}. Redirecting to /#/`);
      this.navigateTo('/#/');
      return;
    }

    // Clean up previous view if exists
    if (typeof this.currentViewCleanup === 'function') {
      try {
        this.currentViewCleanup();
      } catch (err) {
        console.error('Error during view cleanup:', err);
      }
      this.currentViewCleanup = null;
    }

    this.currentRoute = {
      path: pathPart,
      anchor: anchorPart,
      params
    };

    // Update active nav links in document
    this.updateActiveNavLinks(pathPart);

    // Render new view
    if (this.rootElement && typeof matchedRoute.handler === 'function') {
      try {
        const cleanup = await matchedRoute.handler(this.rootElement, {
          ...params,
          anchor: anchorPart,
          path: pathPart,
          router: this
        });
        if (typeof cleanup === 'function') {
          this.currentViewCleanup = cleanup;
        }

        // If an anchor was specified (e.g., #quiz), scroll to it smoothly
        if (anchorPart) {
          setTimeout(() => {
            const el = document.getElementById(anchorPart);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            }
          }, 150);
        } else {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      } catch (renderError) {
        console.error('Error executing view handler:', renderError);
        this.rootElement.innerHTML = `
          <div class="field-container error-panel">
            <h2 class="editorial-title">Archival Error</h2>
            <p>An error occurred while loading this view folio: ${renderError.message}</p>
            <button class="btn btn-primary" onclick="window.location.hash='#/'">Return to Field Index</button>
          </div>
        `;
      }
    }
  }

  matchRoutePattern(pattern, path) {
    // Convert e.g. '/roadmap/:id/topic/:topicId' to regex
    const paramNames = [];
    const regexPath = pattern.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });

    const regex = new RegExp(`^${regexPath}$`);
    const match = path.match(regex);

    if (!match) return null;

    const params = {};
    paramNames.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1]);
    });

    return params;
  }

  updateActiveNavLinks(path) {
    const navLinks = document.querySelectorAll('[data-nav-route]');
    navLinks.forEach(link => {
      const targetRoute = link.getAttribute('data-nav-route');
      let isActive = false;
      if (targetRoute === '/progress/challenges') {
        isActive = (path === '/progress/challenges');
      } else if (targetRoute === '/progress') {
        isActive = (path === '/progress');
      } else if (targetRoute === '/') {
        isActive = (path === '/' || path.startsWith('/roadmap'));
      }
      link.classList.toggle('active', isActive);
    });
  }
}
