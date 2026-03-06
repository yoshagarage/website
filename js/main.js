/* ===== STYLE SWITCHER ===== */
function setStyle(id) {
  document.body.className = 'style-' + id;
  document.querySelectorAll('.style-switcher button').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.style === id);
  });
  localStorage.setItem('yosha-style', id);
}

(function() {
  var saved = localStorage.getItem('yosha-style');
  if (saved) {
    document.body.className = 'style-' + saved;
    document.querySelectorAll('.style-switcher button').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.style === saved);
    });
  }
})();

/* ===== FILTER & SORT ===== */
var activeFilters = { category: 'all', brand: 'all' };

function applyFilters() {
  var products = document.querySelectorAll('.product');
  var visible = 0;
  products.forEach(function(p) {
    var catMatch = activeFilters.category === 'all' || p.dataset.category === activeFilters.category;
    var brandMatch = activeFilters.brand === 'all' || p.dataset.brand === activeFilters.brand;
    var show = catMatch && brandMatch;
    p.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.getElementById('noResults').style.display = visible === 0 ? '' : 'none';
}

function applySort() {
  var grid = document.getElementById('productGrid');
  var products = Array.from(grid.querySelectorAll('.product'));
  var val = document.getElementById('sortSelect').value;
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

  products.forEach(function(p) { grid.appendChild(p); });
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var filterType = btn.dataset.filter;
      var value = btn.dataset.value;
      activeFilters[filterType] = value;

      document.querySelectorAll('.filter-btn[data-filter="' + filterType + '"]').forEach(function(b) {
        b.classList.toggle('active', b.dataset.value === value);
      });

      applyFilters();
    });
  });

  document.getElementById('sortSelect').addEventListener('change', applySort);
});
