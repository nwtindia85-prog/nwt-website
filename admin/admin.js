/* ==========================================================================
   ADMIN DASHBOARD — JavaScript
   North Wide Traders India OPC Private Limited
   ========================================================================== */

(function () {
  'use strict';

  // ─── DOM References ──────────────────────────────────────────────────────

  const loginScreen = document.getElementById('loginScreen');
  const dashboardScreen = document.getElementById('dashboardScreen');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const sidebarUsername = document.getElementById('sidebarUsername');

  // Sidebar
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menuToggle');
  const sidebarClose = document.getElementById('sidebarClose');
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const pageTitle = document.getElementById('pageTitle');
  const contentArea = document.getElementById('contentArea');

  // Sections
  const sectionPanels = document.querySelectorAll('.section-panel');

  // Products
  const productsTableBody = document.getElementById('productsTableBody');
  const productsEmpty = document.getElementById('productsEmpty');
  const addProductBtn = document.getElementById('addProductBtn');
  const adminProductSearch = document.getElementById('adminProductSearch');
  const adminStatusFilter = document.getElementById('adminStatusFilter');
  const adminCategoryFilter = document.getElementById('adminCategoryFilter');

  // Product Form
  const productForm = document.getElementById('productForm');
  const formTitle = document.getElementById('formTitle');
  const backToProducts = document.getElementById('backToProducts');
  const cancelForm = document.getElementById('cancelForm');
  const productId = document.getElementById('productId');
  const imageUploadArea = document.getElementById('imageUploadArea');
  const imageFileInput = document.getElementById('imageFileInput');
  const imagePreview = document.getElementById('imagePreview');
  const imagePlaceholder = document.getElementById('imagePlaceholder');
  const previewImg = document.getElementById('previewImg');
  const removeImage = document.getElementById('removeImage');
  const productImagePath = document.getElementById('productImagePath');
  const saveProductBtn = document.getElementById('saveProductBtn');

  // Categories
  const categoriesGrid = document.getElementById('categoriesGrid');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const categoryModal = document.getElementById('categoryModal');
  const closeCategoryModal = document.getElementById('closeCategoryModal');
  const cancelCategoryForm = document.getElementById('cancelCategoryForm');
  const categoryForm = document.getElementById('categoryForm');
  const categoryModalTitle = document.getElementById('categoryModalTitle');
  const saveCategoryBtn = document.getElementById('saveCategoryBtn');
  const categoryIdInput = document.getElementById('categoryId');
  const categoryNameInput = document.getElementById('categoryName');
  const categorySlugInput = document.getElementById('categorySlug');
  const categoryIconInput = document.getElementById('categoryIcon');
  const categoryOrderInput = document.getElementById('categoryOrder');

  // Delete Product Modal
  const deleteModal = document.getElementById('deleteModal');
  const closeDeleteModal = document.getElementById('closeDeleteModal');
  const cancelDelete = document.getElementById('cancelDelete');
  const confirmDelete = document.getElementById('confirmDelete');
  const deleteProductName = document.getElementById('deleteProductName');

  // Delete Category Modal
  const deleteCategoryModal = document.getElementById('deleteCategoryModal');
  const closeDeleteCategoryModal = document.getElementById('closeDeleteCategoryModal');
  const cancelDeleteCategory = document.getElementById('cancelDeleteCategory');
  const confirmDeleteCategory = document.getElementById('confirmDeleteCategory');
  const deleteCategoryName = document.getElementById('deleteCategoryName');

  // Settings
  const passwordForm = document.getElementById('passwordForm');
  const passwordMsg = document.getElementById('passwordMsg');

  // Quick actions
  const quickAddProduct = document.getElementById('quickAddProduct');
  const quickViewProducts = document.getElementById('quickViewProducts');
  const quickManageCategories = document.getElementById('quickManageCategories');
  const visitSiteTopBtn = document.getElementById('visitSiteTopBtn');
  const visitSiteQuickBtn = document.getElementById('visitSiteQuickBtn');

  // State
  let allProducts = [];
  let allCategories = [];
  let deleteTargetId = null;
  let deleteCategoryTargetId = null;

  // ─── API Helpers ─────────────────────────────────────────────────────────

  async function api(url, options = {}, retries = 0, timeout = 10000) {
    const token = sessionStorage.getItem('nwt_admin_token');
    const defaults = {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    };
    if (token) {
      defaults.headers['Authorization'] = `Bearer ${token}`;
    }
    const config = { ...defaults, ...options };
    if (options.headers) config.headers = { ...defaults.headers, ...options.headers };
    if (options.body && typeof options.body !== 'string' && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    }
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    // Determine if we should retry (only for GET requests and when retries > 0)
    const isGet = !config.method || config.method.toUpperCase() === 'GET';
    const maxRetries = isGet ? retries : 0;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const res = await fetch(url, { ...config, signal: controller.signal });
        clearTimeout(id);
        
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401 && !url.includes('/login') && !url.includes('/session')) {
            sessionStorage.removeItem('nwt_admin_token');
            showLogin();
          }
          throw new Error(data.error || 'Request failed');
        }
        return data;
      } catch (err) {
        if (i === maxRetries) throw err;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
  }

  // ─── Toast Notifications ─────────────────────────────────────────────────

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${escapeText(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeText(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }

  // ─── Session Check ───────────────────────────────────────────────────────

  async function checkSession() {
    try {
      const data = await api('/api/admin/session');
      if (data.authenticated) {
        showDashboard(data.username);
      } else {
        sessionStorage.removeItem('nwt_admin_token');
        showLogin();
      }
    } catch {
      sessionStorage.removeItem('nwt_admin_token');
      showLogin();
    }
  }

  function showLogin() {
    loginScreen.style.display = 'flex';
    dashboardScreen.style.display = 'none';
  }

  async function showDashboard(username) {
    loginScreen.style.display = 'none';
    dashboardScreen.style.display = 'flex';
    sidebarUsername.textContent = username || 'Admin';
    await loadCategories();
    loadStats();
    loadProducts();
  }

  // ─── Login ───────────────────────────────────────────────────────────────

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

    try {
      const username = document.getElementById('loginUsername').value;
      const password = document.getElementById('loginPassword').value;
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: { username, password }
      });
      if (data.token) {
        sessionStorage.setItem('nwt_admin_token', data.token);
      }
      await showDashboard(data.username);
      showToast('Welcome back!', 'success');
    } catch (err) {
      loginError.textContent = err.message;
      loginError.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
  });

  // ─── Logout ──────────────────────────────────────────────────────────────

  logoutBtn.addEventListener('click', async () => {
    try {
      await api('/api/admin/logout', { method: 'POST' });
    } catch { /* ignore */ }
    sessionStorage.removeItem('nwt_admin_token');
    showLogin();
    loginForm.reset();
  });

  // ─── Sidebar Navigation ─────────────────────────────────────────────────

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      switchSection(section);
      if (window.innerWidth < 768) sidebar.classList.remove('open');
    });
  });

  menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));

  function switchSection(sectionName) {
    navItems.forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');

    sectionPanels.forEach(p => p.classList.remove('active'));

    const titles = { overview: 'Overview', products: 'Products', categories: 'Categories', settings: 'Settings' };
    pageTitle.textContent = titles[sectionName] || sectionName;

    const sectionId = 'section' + sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
    const panel = document.getElementById(sectionId);
    if (panel) panel.classList.add('active');

    if (contentArea) contentArea.scrollTop = 0;

    if (sectionName === 'overview') loadStats();
    if (sectionName === 'products') loadProducts();
    if (sectionName === 'categories') loadCategories();
  }

  // Quick actions
  if (quickAddProduct) {
    quickAddProduct.addEventListener('click', async () => {
      await openProductForm();
    });
  }
  if (quickViewProducts) {
    quickViewProducts.addEventListener('click', () => switchSection('products'));
  }
  if (quickManageCategories) {
    quickManageCategories.addEventListener('click', () => switchSection('categories'));
  }
  
  const handleVisitSite = (e) => {
    e.preventDefault();
    window.open(window.location.origin, '_blank');
  };
  
  if (visitSiteTopBtn) visitSiteTopBtn.addEventListener('click', handleVisitSite);
  if (visitSiteQuickBtn) visitSiteQuickBtn.addEventListener('click', handleVisitSite);

  // ─── Stats ───────────────────────────────────────────────────────────────

  async function loadStats() {
    try {
      const stats = await api('/api/admin/stats', {}, 3, 8000);
      document.getElementById('statTotal').textContent = stats.totalProducts;
      document.getElementById('statPublished').textContent = stats.publishedProducts;
      document.getElementById('statDraft').textContent = stats.draftProducts;
      document.getElementById('statCategories').textContent = stats.totalCategories;
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  // ─── Products List ───────────────────────────────────────────────────────

  async function loadProducts() {
    try {
      allProducts = await api('/api/admin/products', {}, 3, 8000);
      renderProductsTable();
    } catch (err) {
      showToast('Failed to load products: ' + err.message, 'error');
    }
  }

  function renderProductsTable() {
    const search = (adminProductSearch.value || '').trim().toLowerCase();
    const statusFilter = adminStatusFilter.value;
    const catFilter = adminCategoryFilter.value;

    let filtered = allProducts.filter(p => {
      const matchSearch = !search ||
        (p.name && p.name.toLowerCase().includes(search)) ||
        (p.short_description && p.short_description.toLowerCase().includes(search)) ||
        (p.sku && p.sku.toLowerCase().includes(search)) ||
        (p.brand && p.brand.toLowerCase().includes(search));
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchCat = catFilter === 'all' || String(p.category_id) === catFilter;
      return matchSearch && matchStatus && matchCat;
    });

    if (filtered.length === 0) {
      productsTableBody.innerHTML = '';
      productsEmpty.style.display = 'block';
      document.querySelector('.products-table-wrap').style.display = 'none';
      return;
    }

    productsEmpty.style.display = 'none';
    document.querySelector('.products-table-wrap').style.display = 'block';

    productsTableBody.innerHTML = filtered.map(p => {
      const imgSrc = p.image_path ? (p.image_path.startsWith('/') ? p.image_path : `/${p.image_path}`) : '';
      const statusClass = `status-${p.status}`;
      const updatedDate = p.updated_at ? new Date(p.updated_at + 'Z').toLocaleDateString() : '—';
      const desc = p.short_description ? p.short_description.substring(0, 80) + (p.short_description.length > 80 ? '...' : '') : '';

      return `<tr>
        <td>${imgSrc ? `<img src="${imgSrc}" class="product-thumb" alt="${escapeText(p.name)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 48%22><rect fill=%22%23232734%22 width=%2248%22 height=%2248%22/><text x=%2224%22 y=%2228%22 fill=%22%23555%22 text-anchor=%22middle%22 font-size=%2212%22>?</text></svg>'">` : '<div class="product-thumb" style="background:#232734;"></div>'}</td>
        <td>
          <div class="product-name-cell product-clickable" data-action="edit" data-id="${p.id}">${escapeText(p.name)}</div>
          <div class="product-desc-preview">${escapeText(desc).replace(/\n/g, '<br>')}</div>
        </td>
        <td>${escapeText(p.category_name || '')}</td>
        <td><span class="status-badge ${statusClass}">${p.status}</span></td>
        <td style="font-size:0.8rem;color:var(--admin-text-dim);">${updatedDate}</td>
        <td>
          <div class="action-btns">
            <button type="button" class="btn-action btn-edit" data-action="edit" data-id="${p.id}" title="Edit Product">
              <i class="fas fa-pen"></i> <span>Edit</span>
            </button>
            <button type="button" class="btn-action btn-action-danger" data-action="delete" data-id="${p.id}" data-name="${escapeText(p.name)}" title="Delete Product">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // Event delegation on table body for edit & delete buttons
  productsTableBody.addEventListener('click', async (e) => {
    const editEl = e.target.closest('[data-action="edit"]');
    if (editEl) {
      e.preventDefault();
      e.stopPropagation();
      const id = editEl.dataset.id;
      if (id) await handleEditProduct(id);
      return;
    }

    const deleteEl = e.target.closest('[data-action="delete"]');
    if (deleteEl) {
      e.preventDefault();
      e.stopPropagation();
      const id = deleteEl.dataset.id;
      const name = deleteEl.dataset.name;
      if (id) handleDeletePrompt(id, name);
      return;
    }
  });

  adminProductSearch.addEventListener('input', renderProductsTable);
  adminStatusFilter.addEventListener('change', renderProductsTable);
  adminCategoryFilter.addEventListener('change', renderProductsTable);

  // ─── Product Form (Add / Edit) ──────────────────────────────────────────

  addProductBtn.addEventListener('click', async () => {
    await openProductForm(null);
  });

  async function handleEditProduct(id) {
    try {
      showToast('Loading product details...', 'info');
      const product = await api(`/api/admin/products/${id}`, {}, 3, 8000);
      await openProductForm(product);
    } catch (err) {
      console.error('Failed to load product for edit:', err);
      showToast('Failed to load product: ' + err.message, 'error');
    }
  }

  function handleDeletePrompt(id, name) {
    deleteTargetId = id;
    deleteProductName.textContent = `"${name || 'Selected Product'}"`;
    deleteModal.style.display = 'flex';
  }

  async function openProductForm(product = null) {
    if (!allCategories || allCategories.length === 0) {
      await loadCategories();
    }

    sectionPanels.forEach(p => p.classList.remove('active'));
    document.getElementById('sectionProductForm').classList.add('active');
    
    navItems.forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-section="products"]`)?.classList.add('active');

    pageTitle.textContent = product ? 'Edit Product' : 'Add New Product';
    formTitle.textContent = product ? `Edit: ${product.name}` : 'Add New Product';

    const catSelect = document.getElementById('productCategory');
    catSelect.innerHTML = '<option value="">Select Category</option>' +
      allCategories.map(c => `<option value="${c.id}">${escapeText(c.name)}</option>`).join('');

    if (product) {
      productId.value = product.id;
      document.getElementById('productName').value = product.name || '';
      catSelect.value = String(product.category_id || '');
      document.getElementById('productStatus').value = product.status || 'draft';
      document.getElementById('productShortDesc').value = product.short_description || '';
      document.getElementById('productFullDesc').value = product.full_description || '';
      document.getElementById('productSKU').value = product.sku || '';
      document.getElementById('productBrand').value = product.brand || '';
      document.getElementById('productBadge').value = product.badge_text || '';
      document.getElementById('productType').value = product.type || '';
      document.getElementById('productGradeBadge').value = product.grade_badge_text || '';
      document.getElementById('productGradeIcon').value = product.grade_badge_icon || '';
      document.getElementById('productWhatsapp').value = product.whatsapp_text || '';
      productImagePath.value = product.image_path || '';

      try {
        if (product.specifications) {
          const specs = JSON.parse(product.specifications);
          document.getElementById('productSpecifications').value = Array.isArray(specs) ? specs.join('\n') : product.specifications;
        } else {
          document.getElementById('productSpecifications').value = '';
        }
      } catch {
        document.getElementById('productSpecifications').value = product.specifications || '';
      }

      if (product.image_path) {
        const fullImg = product.image_path.startsWith('/') || product.image_path.startsWith('data:') || product.image_path.startsWith('http') 
          ? product.image_path 
          : '/' + product.image_path;
        previewImg.src = fullImg;
        imagePreview.style.display = 'block';
        imagePlaceholder.style.display = 'none';
      } else {
        previewImg.src = '';
        imagePreview.style.display = 'none';
        imagePlaceholder.style.display = 'block';
      }
    } else {
      productId.value = '';
      productForm.reset();
      productImagePath.value = '';
      previewImg.src = '';
      imagePreview.style.display = 'none';
      imagePlaceholder.style.display = 'block';
    }

    if (contentArea) contentArea.scrollTop = 0;
  }

  backToProducts.addEventListener('click', () => switchSection('products'));
  cancelForm.addEventListener('click', () => switchSection('products'));

  window._adminEditProduct = handleEditProduct;
  window._adminDeleteProduct = handleDeletePrompt;

  // ─── Image Upload ────────────────────────────────────────────────────────

  imageUploadArea.addEventListener('click', () => imageFileInput.click());

  imageUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageUploadArea.classList.add('dragover');
  });

  imageUploadArea.addEventListener('dragleave', () => {
    imageUploadArea.classList.remove('dragover');
  });

  imageUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    imageUploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  });

  imageFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageUpload(file);
  });

  removeImage.addEventListener('click', (e) => {
    e.stopPropagation();
    productImagePath.value = '';
    previewImg.src = '';
    imagePreview.style.display = 'none';
    imagePlaceholder.style.display = 'block';
    imageFileInput.value = '';
  });

  async function handleImageUpload(file) {
    const formData = new FormData();
    formData.append('image', file);

    try {
      showToast('Uploading image...', 'info');
      const data = await api('/api/admin/upload', {
        method: 'POST',
        body: formData
      });

      productImagePath.value = data.path;
      previewImg.src = '/' + data.path;
      imagePreview.style.display = 'block';
      imagePlaceholder.style.display = 'none';
      showToast('Image uploaded successfully!', 'success');
    } catch (err) {
      showToast('Image upload failed: ' + err.message, 'error');
    }
  }

  // ─── Save Product (Submit Form) ──────────────────────────────────────────

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameVal = document.getElementById('productName').value.trim();
    const catVal = parseInt(document.getElementById('productCategory').value);

    if (!nameVal || !catVal) {
      showToast('Product name and category are required.', 'error');
      return;
    }

    const specsText = document.getElementById('productSpecifications').value.trim();
    const specsArray = specsText ? specsText.split('\n').map(s => s.trim()).filter(Boolean) : [];

    const body = {
      name: nameVal,
      category_id: catVal,
      status: document.getElementById('productStatus').value,
      type: document.getElementById('productType').value.trim(),
      short_description: document.getElementById('productShortDesc').value.trim(),
      full_description: document.getElementById('productFullDesc').value.trim(),
      sku: document.getElementById('productSKU').value.trim(),
      brand: document.getElementById('productBrand').value.trim(),
      badge_text: document.getElementById('productBadge').value.trim(),
      grade_badge_text: document.getElementById('productGradeBadge').value.trim(),
      grade_badge_icon: document.getElementById('productGradeIcon').value.trim(),
      whatsapp_text: document.getElementById('productWhatsapp').value.trim(),
      image_path: productImagePath.value,
      specifications: JSON.stringify(specsArray),
    };

    const isEdit = !!productId.value;
    saveProductBtn.disabled = true;
    saveProductBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      if (isEdit) {
        await api(`/api/admin/products/${productId.value}`, { method: 'PUT', body });
        showToast('Product updated successfully!', 'success');
      } else {
        await api('/api/admin/products', { method: 'POST', body });
        showToast('Product created successfully!', 'success');
      }
      switchSection('products');
      await loadProducts();
      await loadStats();
    } catch (err) {
      showToast('Failed to save product: ' + err.message, 'error');
    } finally {
      saveProductBtn.disabled = false;
      saveProductBtn.innerHTML = '<i class="fas fa-save"></i> Save Product';
    }
  });

  // ─── Delete Product Confirmation ─────────────────────────────────────────

  closeDeleteModal.addEventListener('click', () => { deleteModal.style.display = 'none'; deleteTargetId = null; });
  cancelDelete.addEventListener('click', () => { deleteModal.style.display = 'none'; deleteTargetId = null; });

  confirmDelete.addEventListener('click', async () => {
    if (!deleteTargetId) return;
    try {
      await api(`/api/admin/products/${deleteTargetId}`, { method: 'DELETE' });
      showToast('Product deleted permanently.', 'success');
      deleteModal.style.display = 'none';
      deleteTargetId = null;
      await loadProducts();
      await loadStats();
    } catch (err) {
      showToast('Failed to delete: ' + err.message, 'error');
    }
  });

  // ─── Categories Management ───────────────────────────────────────────────

  async function loadCategories() {
    try {
      allCategories = await api('/api/admin/categories', {}, 3, 8000);
      renderCategories();
      populateCategoryFilters();
    } catch (err) {
      console.error('Failed to load categories:', err);
      showToast('Failed to load categories: ' + err.message, 'error');
    }
  }

  function renderCategories() {
    if (!allCategories || allCategories.length === 0) {
      categoriesGrid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><i class="fas fa-tags"></i><p>No categories found</p></div>';
      return;
    }

    categoriesGrid.innerHTML = allCategories.map(c => `
      <div class="category-card" data-cat-id="${c.id}">
        <div class="category-icon" data-action="edit-cat" data-id="${c.id}" title="Click to edit">
          <i class="${escapeText(c.icon || 'fas fa-tag')}"></i>
        </div>
        <div class="category-info category-clickable" data-action="edit-cat" data-id="${c.id}" title="Click to edit">
          <h4>${escapeText(c.name)}</h4>
          <span>${c.product_count || 0} product(s) · slug: <code>${escapeText(c.slug)}</code></span>
        </div>
        <div class="category-actions">
          <button type="button" class="btn-action btn-edit" data-action="edit-cat" data-id="${c.id}" title="Edit Category">
            <i class="fas fa-pen"></i> <span>Edit</span>
          </button>
          <button type="button" class="btn-action btn-action-danger" data-action="delete-cat" data-id="${c.id}" data-name="${escapeText(c.name)}" data-count="${c.product_count || 0}" title="Delete Category">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Event delegation on categories grid
  categoriesGrid.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-action="edit-cat"]');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = editBtn.dataset.id;
      if (id) openCategoryEdit(id);
      return;
    }

    const delBtn = e.target.closest('[data-action="delete-cat"]');
    if (delBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = delBtn.dataset.id;
      const name = delBtn.dataset.name;
      const count = parseInt(delBtn.dataset.count || '0');
      if (id) promptDeleteCategory(id, name, count);
      return;
    }
  });

  function openCategoryEdit(id) {
    const cat = allCategories.find(c => String(c.id) === String(id));
    if (!cat) {
      showToast('Category not found.', 'error');
      return;
    }

    categoryModalTitle.textContent = 'Edit Category';
    categoryIdInput.value = cat.id;
    categoryNameInput.value = cat.name || '';
    categorySlugInput.value = cat.slug || '';
    categoryIconInput.value = cat.icon || '';
    categoryOrderInput.value = cat.display_order || 0;
    categoryModal.style.display = 'flex';
    categoryNameInput.focus();
  }

  function promptDeleteCategory(id, name, count) {
    deleteCategoryTargetId = id;
    deleteCategoryName.textContent = `"${name || 'Selected Category'}" (${count} products)`;
    deleteCategoryModal.style.display = 'flex';
  }

  // Auto-slugify when typing category name (only when adding new category)
  categoryNameInput.addEventListener('input', () => {
    if (!categoryIdInput.value) {
      categorySlugInput.value = categoryNameInput.value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
    }
  });

  function populateCategoryFilters() {
    adminCategoryFilter.innerHTML = '<option value="all">All Categories</option>' +
      allCategories.map(c => `<option value="${c.id}">${escapeText(c.name)}</option>`).join('');
  }

  addCategoryBtn.addEventListener('click', () => {
    categoryModalTitle.textContent = 'Add Category';
    categoryIdInput.value = '';
    categoryForm.reset();
    categoryModal.style.display = 'flex';
    categoryNameInput.focus();
  });

  closeCategoryModal.addEventListener('click', () => { categoryModal.style.display = 'none'; });
  cancelCategoryForm.addEventListener('click', () => { categoryModal.style.display = 'none'; });

  // Close modal on click outside
  categoryModal.addEventListener('click', (e) => {
    if (e.target === categoryModal) categoryModal.style.display = 'none';
  });

  // Delete category modal controls
  closeDeleteCategoryModal.addEventListener('click', () => { deleteCategoryModal.style.display = 'none'; deleteCategoryTargetId = null; });
  cancelDeleteCategory.addEventListener('click', () => { deleteCategoryModal.style.display = 'none'; deleteCategoryTargetId = null; });
  deleteCategoryModal.addEventListener('click', (e) => {
    if (e.target === deleteCategoryModal) { deleteCategoryModal.style.display = 'none'; deleteCategoryTargetId = null; }
  });

  confirmDeleteCategory.addEventListener('click', async () => {
    if (!deleteCategoryTargetId) return;
    try {
      await api(`/api/admin/categories/${deleteCategoryTargetId}`, { method: 'DELETE' });
      showToast('Category deleted successfully.', 'success');
      deleteCategoryModal.style.display = 'none';
      deleteCategoryTargetId = null;
      await loadCategories();
      await loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const catId = categoryIdInput.value;
    const name = categoryNameInput.value.trim();
    const slug = categorySlugInput.value.trim();

    if (!name || !slug) {
      showToast('Category name and slug are required.', 'error');
      return;
    }

    const body = {
      name,
      slug,
      icon: categoryIconInput.value.trim(),
      display_order: parseInt(categoryOrderInput.value) || 0
    };

    saveCategoryBtn.disabled = true;
    saveCategoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      if (catId) {
        await api(`/api/admin/categories/${catId}`, { method: 'PUT', body });
        showToast('Category updated successfully!', 'success');
      } else {
        await api('/api/admin/categories', { method: 'POST', body });
        showToast('Category created successfully!', 'success');
      }
      categoryModal.style.display = 'none';
      await loadCategories();
      await loadStats();
    } catch (err) {
      showToast('Failed to save category: ' + err.message, 'error');
    } finally {
      saveCategoryBtn.disabled = false;
      saveCategoryBtn.innerHTML = '<i class="fas fa-save"></i> Save Category';
    }
  });

  // Global window backup functions
  window._adminEditCategory = openCategoryEdit;
  window._adminDeleteCategory = promptDeleteCategory;

  // ─── Settings: Change Password ───────────────────────────────────────────

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    passwordMsg.style.display = 'none';

    const current = document.getElementById('currentPassword').value;
    const newPw = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (newPw !== confirm) {
      passwordMsg.textContent = 'New passwords do not match.';
      passwordMsg.className = 'form-message error';
      passwordMsg.style.display = 'block';
      return;
    }

    try {
      await api('/api/admin/change-password', {
        method: 'PUT',
        body: { currentPassword: current, newPassword: newPw }
      });
      passwordMsg.textContent = 'Password changed successfully!';
      passwordMsg.className = 'form-message success';
      passwordMsg.style.display = 'block';
      passwordForm.reset();
    } catch (err) {
      passwordMsg.textContent = err.message;
      passwordMsg.className = 'form-message error';
      passwordMsg.style.display = 'block';
    }
  });

  // ─── Initialize ──────────────────────────────────────────────────────────

  checkSession();

})();
