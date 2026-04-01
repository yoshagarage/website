/* ===== THEME SYSTEM ===== */
var enabledStyles = ['a'];
var defaultStyle = 'a';

function isStyleEnabled(id) {
  return enabledStyles.indexOf(id) !== -1;
}

function applyStyle(id) {
  var classNames = ['style-' + id];
  if (document.body.classList.contains('modal-open')) {
    classNames.push('modal-open');
  }

  document.body.className = classNames.join(' ');
  document.querySelectorAll('[data-style]').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.style === id);
  });
}

function setStyle(id) {
  var styleId = isStyleEnabled(id) ? id : defaultStyle;
  applyStyle(styleId);
  localStorage.setItem('yosha-style', styleId);
}

(function() {
  var saved = localStorage.getItem('yosha-style');
  setStyle(isStyleEnabled(saved) ? saved : defaultStyle);
})();

/* ===== FILTER, SORT & MODAL STATE ===== */
var activeFilters = { category: 'all', brand: 'all' };
var productGrid = document.getElementById('productGrid');
var noResults = document.getElementById('noResults');
var sortSelect = document.getElementById('sortSelect');
var activeProductModal = null;
var activeModalKeyHandler = null;
var activeModalTrigger = null;

function formatLabel(value) {
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function formatPrice(value) {
  return '$' + Number(value).toFixed(2) + ' AUD';
}

function getProductImages(product) {
  var imageManifest = window.YOSHA_PRODUCT_IMAGES || {};
  var images = Array.isArray(imageManifest[product.id]) ? imageManifest[product.id].slice() : [];
  var primaryIndex = images.indexOf(product.imageSrc);

  if (primaryIndex > 0) {
    images.splice(primaryIndex, 1);
    images.unshift(product.imageSrc);
  } else if (primaryIndex === -1 && product.imageSrc) {
    images.unshift(product.imageSrc);
  }

  return images.filter(Boolean);
}

function createFilterButton(filterType, value, label) {
  var button = document.createElement('button');
  button.className = 'filter-btn';
  button.dataset.filter = filterType;
  button.dataset.value = value;
  button.textContent = label;
  button.classList.toggle('active', activeFilters[filterType] === value);
  return button;
}

function getFilterOptions(products, valueKey) {
  var seen = {};
  var options = [{ value: 'all', label: 'ALL' }];

  products.forEach(function(product) {
    var value = product[valueKey];
    if (!value || seen[value]) return;

    seen[value] = true;
    options.push({
      value: value,
      label: formatLabel(value)
    });
  });

  return options;
}

function renderFilterGroup(containerId, filterType, options) {
  var container = document.getElementById(containerId);
  if (!container) return;

  container.replaceChildren();
  options.forEach(function(option) {
    container.appendChild(createFilterButton(filterType, option.value, option.label));
  });
}

function createProductTags(product, extraClassName) {
  var tags = document.createElement('div');
  tags.className = 'product-tags' + (extraClassName ? ' ' + extraClassName : '');

  var categoryTag = document.createElement('span');
  categoryTag.className = 'tag tag-category';
  categoryTag.textContent = formatLabel(product.category);
  tags.appendChild(categoryTag);

  var brandTag = document.createElement('span');
  brandTag.className = 'tag tag-brand';
  brandTag.textContent = formatLabel(product.brand);
  tags.appendChild(brandTag);

  return tags;
}

function createProductCta(product, extraClassName) {
  var buyUrl = String(product.buyUrl || product.butUrl || '').trim();
  var cta;
  var isDisabled = !buyUrl;

  if (buyUrl) {
    cta = document.createElement('a');
    cta.href = buyUrl;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
    cta.textContent = '購入 BUY';
  } else {
    cta = document.createElement('button');
    cta.type = 'button';
    cta.textContent = 'COMING SOON';
    cta.setAttribute('aria-disabled', 'true');
  }

  cta.className = 'buy-btn' + (isDisabled ? ' buy-btn-disabled' : '') + (extraClassName ? ' ' + extraClassName : '');
  cta.addEventListener('click', function(event) {
    if (isDisabled) {
      event.preventDefault();
    }
    event.stopPropagation();
  });

  return cta;
}

function formatCompatibilityEntry(entry) {
  var parts = [];

  if (entry.yearRange) {
    parts.push(entry.yearRange);
  }

  var vehicleName = [entry.make, entry.model].filter(Boolean).join(' ');
  if (vehicleName) {
    parts.push(vehicleName);
  }

  if (entry.chassisCode) {
    parts.push('(' + entry.chassisCode + ')');
  }

  return parts.join(' ');
}

function formatCompatibilityYearRangeCompact(yearRange) {
  var normalized = String(yearRange || '').trim();
  var rangeMatch;
  var plusMatch;

  if (!normalized) return '';

  rangeMatch = normalized.match(/^(\d{2,4})\s*(?:-|to|–|—)\s*(\d{2,4})$/i);
  if (rangeMatch) {
    return rangeMatch[1].slice(-2) + '-' + rangeMatch[2].slice(-2);
  }

  plusMatch = normalized.match(/^(\d{2,4})\s*\+$/);
  if (plusMatch) {
    return plusMatch[1].slice(-2) + '+';
  }

  return normalized;
}

function formatCompatibilitySummaryEntry(entry, includeMake) {
  var parts = [];
  var compactYearRange = formatCompatibilityYearRangeCompact(entry.yearRange);

  if (includeMake && entry.make) {
    parts.push(entry.make);
  }
  if (entry.model) {
    parts.push(entry.model);
  }
  if (entry.chassisCode) {
    parts.push(entry.chassisCode);
  }
  if (compactYearRange) {
    parts.push(compactYearRange);
  }

  return parts.join(' ');
}

function getCompatibilitySummary(product) {
  var compatibility = Array.isArray(product.compatibility) ? product.compatibility.filter(Boolean) : [];
  var previousMake = '';

  if (compatibility.length === 0) return '';

  return compatibility.map(function(entry, index) {
    var make = String(entry.make || '').trim();
    var includeMake = index === 0 || (make && make !== previousMake);
    var summary = formatCompatibilitySummaryEntry(entry, includeMake);

    previousMake = make || previousMake;
    return summary;
  }).filter(Boolean).join('/');
}

function createCompatibilityList(product) {
  var compatibility = Array.isArray(product.compatibility) ? product.compatibility.filter(Boolean) : [];
  if (compatibility.length === 0) return null;

  var section = document.createElement('div');
  section.className = 'modal-compatibility';

  var title = document.createElement('h3');
  title.className = 'modal-section-title';
  title.textContent = 'Compatibility';

  var list = document.createElement('ul');
  list.className = 'compatibility-list';

  compatibility.forEach(function(entry) {
    var item = document.createElement('li');
    item.className = 'compatibility-item';
    item.textContent = formatCompatibilityEntry(entry);
    list.appendChild(item);
  });

  section.appendChild(title);
  section.appendChild(list);

  return section;
}

function closeProductModal() {
  if (!activeProductModal) return;

  if (activeModalKeyHandler) {
    document.removeEventListener('keydown', activeModalKeyHandler);
  }

  activeProductModal.remove();
  activeProductModal = null;
  activeModalKeyHandler = null;
  document.body.classList.remove('modal-open');

  if (activeModalTrigger && typeof activeModalTrigger.focus === 'function') {
    activeModalTrigger.focus();
  }
  activeModalTrigger = null;
}

function createThumbnailButton(mainImage, thumbnails, imageSrc, imageAlt, isActive) {
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'modal-thumb' + (isActive ? ' active' : '');
  button.setAttribute('aria-label', 'Show product image');
  button.setAttribute('aria-pressed', isActive ? 'true' : 'false');

  var image = document.createElement('img');
  image.src = imageSrc;
  image.alt = imageAlt;
  button.appendChild(image);

  button.addEventListener('click', function() {
    mainImage.src = imageSrc;
    mainImage.alt = imageAlt;

    thumbnails.forEach(function(thumb) {
      var isSelected = thumb === button;
      thumb.classList.toggle('active', isSelected);
      thumb.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
  });

  return button;
}

function openProductModal(product, triggerElement) {
  closeProductModal();

  var images = getProductImages(product);
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  var modal = document.createElement('div');
  modal.className = 'product-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'product-modal-title-' + product.id);

  var closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'modal-close';
  closeButton.setAttribute('aria-label', 'Close product details');
  closeButton.textContent = 'X';

  var gallery = document.createElement('div');
  gallery.className = 'modal-gallery';

  var mainImageWrap = document.createElement('div');
  mainImageWrap.className = 'modal-main-image-wrap';

  var mainImage = document.createElement('img');
  mainImage.className = 'modal-main-image';
  mainImage.src = images[0] || product.imageSrc;
  mainImage.alt = product.imageAlt || product.name;
  mainImageWrap.appendChild(mainImage);
  gallery.appendChild(mainImageWrap);

  if (images.length > 1) {
    var thumbnails = [];
    var thumbnailsWrap = document.createElement('div');
    thumbnailsWrap.className = 'modal-thumbnails';

    images.forEach(function(imageSrc, index) {
      var thumb = createThumbnailButton(
        mainImage,
        thumbnails,
        imageSrc,
        product.imageAlt || product.name,
        index === 0
      );
      thumbnails.push(thumb);
      thumbnailsWrap.appendChild(thumb);
    });

    gallery.appendChild(thumbnailsWrap);
  }

  var details = document.createElement('div');
  details.className = 'modal-details';

  var title = document.createElement('h2');
  title.id = 'product-modal-title-' + product.id;
  title.className = 'modal-title';
  title.textContent = product.name;

  var jpLabel = document.createElement('p');
  jpLabel.className = 'jp-label modal-jp-label';
  jpLabel.textContent = product.jpLabel;

  var price = document.createElement('p');
  price.className = 'modal-price';
  price.textContent = formatPrice(product.price);

  var description = document.createElement('p');
  description.className = 'modal-description';
  description.textContent = product.description || 'Description coming soon.';

  var compatibility = createCompatibilityList(product);
  var cta = createProductCta(product, 'modal-buy-btn');

  details.appendChild(title);
  details.appendChild(jpLabel);
  details.appendChild(createProductTags(product, 'modal-tags'));
  details.appendChild(price);
  details.appendChild(description);
  if (compatibility) {
    details.appendChild(compatibility);
  }
  details.appendChild(cta);

  modal.appendChild(closeButton);
  modal.appendChild(gallery);
  modal.appendChild(details);
  overlay.appendChild(modal);

  closeButton.addEventListener('click', closeProductModal);
  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) {
      closeProductModal();
    }
  });

  activeModalKeyHandler = function(event) {
    if (event.key === 'Escape') {
      closeProductModal();
    }
  };

  activeProductModal = overlay;
  activeModalTrigger = triggerElement || null;
  document.body.classList.add('modal-open');
  document.body.appendChild(overlay);
  document.addEventListener('keydown', activeModalKeyHandler);
  closeButton.focus();
}

function createProductCard(product) {
  var card = document.createElement('article');
  card.className = 'product';
  card.dataset.productId = product.id;
  card.dataset.name = product.name;
  card.dataset.category = product.category;
  card.dataset.brand = product.brand;
  card.dataset.price = product.price;
  card.dataset.added = product.added;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-haspopup', 'dialog');
  card.setAttribute('aria-label', 'View details for ' + product.name);

  var imageWrap = document.createElement('div');
  imageWrap.className = 'product-img';

  var image = document.createElement('img');
  image.src = product.imageSrc;
  image.alt = product.imageAlt || product.name;
  imageWrap.appendChild(image);

  var title = document.createElement('h3');
  title.textContent = product.name;

  var price = document.createElement('p');
  price.className = 'price';
  price.textContent = formatPrice(product.price);

  var jpLabel = document.createElement('p');
  jpLabel.className = 'jp-label';
  jpLabel.textContent = product.jpLabel;

  var compatibilitySummary = getCompatibilitySummary(product);
  var compatibility;

  if (compatibilitySummary) {
    compatibility = document.createElement('p');
    compatibility.className = 'product-compatibility';
    compatibility.textContent = compatibilitySummary;
  }

  var cta = createProductCta(product);

  card.appendChild(createProductTags(product));
  card.appendChild(imageWrap);
  card.appendChild(title);
  if (compatibility) {
    card.appendChild(compatibility);
  }
  card.appendChild(price);
  card.appendChild(jpLabel);
  card.appendChild(cta);

  card.addEventListener('click', function(event) {
    if (event.target.closest('.buy-btn')) return;
    openProductModal(product, card);
  });

  card.addEventListener('keydown', function(event) {
    if (event.target.closest('.buy-btn')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    openProductModal(product, card);
  });

  return card;
}

function renderProducts(products) {
  if (!productGrid || !noResults) return;

  productGrid.querySelectorAll('.product').forEach(function(card) {
    card.remove();
  });

  products.forEach(function(product) {
    productGrid.appendChild(createProductCard(product));
  });
}

function applyFilters() {
  if (!productGrid || !noResults) return;

  var products = productGrid.querySelectorAll('.product');
  var visible = 0;
  products.forEach(function(card) {
    var catMatch = activeFilters.category === 'all' || card.dataset.category === activeFilters.category;
    var brandMatch = activeFilters.brand === 'all' || card.dataset.brand === activeFilters.brand;
    var show = catMatch && brandMatch;
    card.classList.toggle('hidden', !show);
    if (show) visible += 1;
  });
  noResults.style.display = visible === 0 ? '' : 'none';
}

function applySort() {
  if (!productGrid || !sortSelect) return;

  var products = Array.from(productGrid.querySelectorAll('.product'));
  var val = sortSelect.value;
  var parts = val.split('-');
  var field = parts[0];
  var dir = parts[1] === 'asc' ? 1 : -1;

  products.sort(function(a, b) {
    var aVal;
    var bVal;

    if (field === 'price') {
      aVal = parseFloat(a.dataset.price);
      bVal = parseFloat(b.dataset.price);
    } else if (field === 'name') {
      aVal = a.dataset.name || '';
      bVal = b.dataset.name || '';
      return aVal.localeCompare(bVal, undefined, { sensitivity: 'base' }) * dir;
    } else {
      aVal = a.dataset.added;
      bVal = b.dataset.added;
    }

    if (aVal < bVal) return -1 * dir;
    if (aVal > bVal) return 1 * dir;
    return 0;
  });

  products.forEach(function(card) {
    productGrid.appendChild(card);
  });
}

function handleFilterClick(event) {
  var button = event.target.closest('.filter-btn');
  if (!button) return;

  var filterType = button.dataset.filter;
  var value = button.dataset.value;
  activeFilters[filterType] = value;

  document.querySelectorAll('.filter-btn[data-filter="' + filterType + '"]').forEach(function(filterButton) {
    filterButton.classList.toggle('active', filterButton.dataset.value === value);
  });

  applyFilters();
}

function showProductLoadError() {
  if (!noResults) return;

  noResults.textContent = 'Could not load products right now.';
  noResults.style.display = '';
}

function initProductCatalog() {
  try {
    var payload = window.YOSHA_PRODUCTS_DATA;
    if (!payload || typeof payload !== 'object') {
      throw new Error('Missing products data');
    }

    if (!Array.isArray(payload.products)) {
      throw new Error('Invalid products data format: expected a products array');
    }

    var products = payload.products;
    renderFilterGroup('categoryFilters', 'category', getFilterOptions(products, 'category'));
    renderFilterGroup('brandFilters', 'brand', getFilterOptions(products, 'brand'));
    renderProducts(products);
    applySort();
    applyFilters();
  } catch (error) {
    console.error(error);
    showProductLoadError();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var toolbar = document.querySelector('.toolbar');
  if (toolbar) {
    toolbar.addEventListener('click', handleFilterClick);
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', applySort);
  }

  initProductCatalog();
});

/* ===== VISITOR COUNTER ===== */
(function() {
  var counter = document.getElementById('vc');
  if (!counter) return;

  var counterWrapper = counter.parentElement;
  var currentValue = Math.floor(Math.random() * 6000) + 4000;

  function renderCounter() {
    counter.textContent = currentValue.toLocaleString('en-AU');
  }

  renderCounter();

  if (counterWrapper) {
    counterWrapper.addEventListener('click', function() {
      if (Math.random() < 0.85) {
        currentValue += 1;
      } else {
        currentValue -= Math.floor(Math.random() * 51) + 50;
      }
      if (currentValue < 0) currentValue = 0;
      renderCounter();
    });
  }
})();
