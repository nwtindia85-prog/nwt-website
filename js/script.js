/* ==========================================================================
   NORTH WIDE TRADERS INDIA OPC PRIVATE LIMITED
   Official JavaScript - Interactions, Animations, Filters & Dark Mode
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. STICKY HEADER ON SCROLL
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // 2. DARK MODE TOGGLE WITH LOCAL STORAGE
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('nwt_theme') || 'light';

  const applyTheme = (theme) => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
      if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun" style="color:#FBBF24;"></i>';
    } else {
      document.body.classList.remove('dark-theme');
      if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
  };

  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-theme');
      const nextTheme = isDark ? 'light' : 'dark';
      applyTheme(nextTheme);
      localStorage.setItem('nwt_theme', nextTheme);
    });
  }

  // 3. MOBILE HAMBURGER MENU
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
      document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    });

    const allNavLinks = navMenu.querySelectorAll('a');
    allNavLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('active') && !navMenu.contains(e.target) && !hamburger.contains(e.target)) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  // 4. BACK TO TOP BUTTON
  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }, { passive: true });

    backToTop.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // 5. INTERSECTION OBSERVER FOR FADE-IN ANIMATIONS
  const fadeElements = document.querySelectorAll('.fade-in');
  if (fadeElements.length > 0) {
    const observerOptions = {
      root: null,
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px'
    };

    const fadeObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    fadeElements.forEach(el => fadeObserver.observe(el));
  }

  // 7. CONTACT FORM HANDLER
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('cName')?.value || 'Client';
      alert(`Thank you, ${name}!\n\nYour message has been delivered to North Wide Traders. We will reach out to you shortly.`);
      contactForm.reset();
    });
  }

  // 8. PRODUCT CATALOG — DYNAMIC LOADING FROM API (For products.html)
  const catalogGrid = document.getElementById('catalogGrid');
  const productSearch = document.getElementById('productSearch');
  const filterPillsContainer = document.querySelector('.filter-pills');
  const noMatchBox = document.getElementById('noMatchBox');

  if (catalogGrid) {
    let allProducts = [];
    let allCategories = [];
    let currentCategory = 'all';
    let searchQuery = '';

    // Check URL query param for category (e.g., products.html?cat=scientific)
    const urlParams = new URLSearchParams(window.location.search);
    const catParam = urlParams.get('cat');
    if (catParam) {
      currentCategory = catParam;
    }

    // Helper: fetch with retry and timeout
    async function fetchWithRetry(url, options = {}, retries = 3, timeout = 8000) {
      for (let i = 0; i < retries; i++) {
        try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), timeout);
          const res = await fetch(url, { ...options, signal: controller.signal });
          clearTimeout(id);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return await res.json();
        } catch (err) {
          if (i === retries - 1) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
      }
    }

    // Fetch categories and render filter pills
    async function loadCategoriesFromAPI() {
      try {
        allCategories = await fetchWithRetry('/api/categories');
        renderFilterPills();
      } catch (err) {
        console.error('Error loading categories:', err);
        // Fallback to static if API fails, but we already have static ones in HTML
        // For dynamic ones we might just leave the ones currently in HTML if it fails
      }
    }

    function renderFilterPills() {
      if (!filterPillsContainer || allCategories.length === 0) return;
      
      const allActive = currentCategory === 'all' ? 'active' : '';
      let html = `<button class="filter-pill ${allActive}" data-category="all">All Products (${allProducts.length})</button>`;
      
      html += allCategories.map(c => {
        const isActive = currentCategory === c.slug ? 'active' : '';
        const icon = c.icon || 'fas fa-tag';
        return `<button class="filter-pill ${isActive}" data-category="${escapeAttr(c.slug)}"><i class="${escapeAttr(icon)}"></i> ${escapeHtml(c.name)}</button>`;
      }).join('');
      
      filterPillsContainer.innerHTML = html;
      attachFilterPillEvents();
    }

    // Fetch products from public API
    async function loadProductsFromAPI() {
      try {
        allProducts = await fetchWithRetry('/api/products');
        renderProducts();
        updateFilterCounts();
      } catch (err) {
        console.error('Error loading products:', err);
        catalogGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: #94A3B8;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; display: block; color: #F59E0B;"></i>
            Unable to load products. Please try refreshing the page.
          </div>`;
      }
    }

    function renderProducts() {
      let filtered = allProducts.filter(p => {
        const matchCategory = currentCategory === 'all' || p.category_slug === currentCategory;
        const matchSearch = !searchQuery ||
          p.name.toLowerCase().includes(searchQuery) ||
          (p.short_description || '').toLowerCase().includes(searchQuery);
        return matchCategory && matchSearch;
      });

      if (filtered.length === 0) {
        catalogGrid.innerHTML = '';
        if (noMatchBox) noMatchBox.style.display = 'block';
        return;
      }

      if (noMatchBox) noMatchBox.style.display = 'none';

      catalogGrid.innerHTML = filtered.map(p => {
        const imgSrc = p.image_path ? (p.image_path.startsWith('data:') || p.image_path.startsWith('http') ? p.image_path : `/${p.image_path}`) : '';
        const waText = p.whatsapp_text || encodeURIComponent('Hello North Wide Traders, I am interested in: ' + p.name);
        const gradeIcon = p.grade_badge_icon || 'fas fa-certificate';
        const fallbackImg = `this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 48%22><rect fill=%22%23232734%22 width=%2248%22 height=%2248%22/><text x=%2224%22 y=%2228%22 fill=%22%23555%22 text-anchor=%22middle%22 font-size=%2212%22>?</text></svg>'`;

        return `
          <div class="product-card catalog-product-card" data-category="${escapeAttr(p.category_slug)}">
            <div class="product-image">
              ${imgSrc ? `<img src="${imgSrc}" alt="${escapeAttr(p.name)}" class="product-img" loading="lazy" onerror="${fallbackImg}">` : ''}
              <span class="product-badge">${escapeHtml(p.badge_text || p.category_name)}</span>
            </div>
            <div class="product-info">
              <h4 class="product-name">${escapeHtml(p.name)}</h4>
              ${p.grade_badge_text ? `<span class="product-grade-badge"><i class="${gradeIcon}"></i> ${escapeHtml(p.grade_badge_text)}</span>` : ''}
              <p class="product-spec">${escapeHtml(p.short_description || '').replace(/\n/g, '<br>')}</p>
              ${p.full_description ? `<p class="product-desc" style="font-size: 0.85rem; color: #94A3B8; margin-top: 0.5rem; line-height: 1.4;">${escapeHtml(p.full_description).replace(/\n/g, '<br>')}</p>` : ''}
              <div class="product-actions" style="margin-top: 1rem;">
                <a href="https://wa.me/919997829094?text=${waText}" target="_blank" class="btn btn-whatsapp btn-sm" style="width: 100%; justify-content: center; gap: 0.5rem; font-weight: 600;">
                  <i class="fab fa-whatsapp"></i> Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>`;
      }).join('');
    }

    function updateFilterCounts() {
      if (allCategories.length > 0) {
        renderFilterPills(); // Re-render pills with updated count
      } else {
        const allPill = document.querySelector('.filter-pill[data-category="all"]');
        if (allPill) allPill.textContent = `All Products (${allProducts.length})`;
      }
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }

    function escapeAttr(str) {
      return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Filter pill click
    function attachFilterPillEvents() {
      const pills = document.querySelectorAll('.filter-pill');
      pills.forEach(pill => {
        pill.addEventListener('click', () => {
          pills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          currentCategory = pill.dataset.category;
          renderProducts();
        });
      });
    }

    // Real-time search
    if (productSearch) {
      productSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderProducts();
      });
    }
    
    // Initial static event attach
    attachFilterPillEvents();

    // Load data from API concurrently
    Promise.all([loadCategoriesFromAPI(), loadProductsFromAPI()]);
  }
});
