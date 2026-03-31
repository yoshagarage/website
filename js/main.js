/* ===== THEME SYSTEM ===== */
var enabledStyles = ['a'];
var defaultStyle = 'a';

function isStyleEnabled(id) {
  return enabledStyles.indexOf(id) !== -1;
}

function applyStyle(id) {
  document.body.className = 'style-' + id;
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

/* ===== FILTER & SORT ===== */
var activeFilters = { category: 'all', brand: 'all' };
var productGrid = document.getElementById('productGrid');
var noResults = document.getElementById('noResults');
var sortSelect = document.getElementById('sortSelect');

function applyFilters() {
  if (!productGrid || !noResults) return;

  var products = productGrid.querySelectorAll('.product');
  var visible = 0;
  products.forEach(function(p) {
    var catMatch = activeFilters.category === 'all' || p.dataset.category === activeFilters.category;
    var brandMatch = activeFilters.brand === 'all' || p.dataset.brand === activeFilters.brand;
    var show = catMatch && brandMatch;
    p.classList.toggle('hidden', !show);
    if (show) visible++;
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
    var aVal, bVal;
    if (field === 'price') {
      aVal = parseFloat(a.dataset.price);
      bVal = parseFloat(b.dataset.price);
    } else {
      aVal = a.dataset.added;
      bVal = b.dataset.added;
    }
    if (aVal < bVal) return -1 * dir;
    if (aVal > bVal) return 1 * dir;
    return 0;
  });

  products.forEach(function(p) { productGrid.appendChild(p); });
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

function formatLabel(value) {
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
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

function createProductCard(product) {
  var card = document.createElement('div');
  card.className = 'product';
  card.dataset.category = product.category;
  card.dataset.brand = product.brand;
  card.dataset.price = product.price;
  card.dataset.added = product.added;

  var tags = document.createElement('div');
  tags.className = 'product-tags';

  var categoryTag = document.createElement('span');
  categoryTag.className = 'tag tag-category';
  categoryTag.textContent = formatLabel(product.category);
  tags.appendChild(categoryTag);

  var brandTag = document.createElement('span');
  brandTag.className = 'tag tag-brand';
  brandTag.textContent = formatLabel(product.brand);
  tags.appendChild(brandTag);

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
  price.textContent = '$' + Number(product.price).toFixed(2) + ' AUD';

  var jpLabel = document.createElement('p');
  jpLabel.className = 'jp-label';
  jpLabel.textContent = product.jpLabel;

  var buyUrl = String(product.buyUrl || product.butUrl || '').trim();
  var cta;

  if (buyUrl) {
    cta = document.createElement('a');
    cta.href = buyUrl;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
    cta.textContent = '購入 BUY';
  } else {
    cta = document.createElement('span');
    cta.textContent = 'COMING SOON';
    cta.setAttribute('aria-disabled', 'true');
  }

  cta.className = 'buy-btn' + (buyUrl ? '' : ' buy-btn-disabled');

  card.appendChild(tags);
  card.appendChild(imageWrap);
  card.appendChild(title);
  card.appendChild(price);
  card.appendChild(jpLabel);
  card.appendChild(cta);

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

function handleFilterClick(event) {
  var button = event.target.closest('.filter-btn');
  if (!button) return;

  var filterType = button.dataset.filter;
  var value = button.dataset.value;
  activeFilters[filterType] = value;

  document.querySelectorAll('.filter-btn[data-filter="' + filterType + '"]').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.value === value);
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
