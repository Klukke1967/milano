// Milano Vennetur – Main Application Logic

let map;
let markersLayer;
let allLocations = [];
let activeCategory = 'all';
let searchQuery = '';
let currentView = 'map'; // 'map' or 'list'
let visitedSet = new Set();
let currentModalSpot = null;

const STORAGE_KEY = 'milano_visited_spots_v1';

// Load visited spots from localStorage
function loadVisited() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      visitedSet = new Set(parsed);
    }
  } catch (e) {
    console.error('Failed to load visited spots', e);
  }
  updateVisitedCounters();
}

function saveVisited() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visitedSet)));
  } catch (e) {
    console.error('Failed to save visited spots', e);
  }
  updateVisitedCounters();
}

function updateVisitedCounters() {
  const count = visitedSet.size;
  const el = document.getElementById('visited-counter');
  if (el) el.textContent = count;
}

// Category configuration
const CATEGORY_CONFIG = {
  hotel: {
    label: 'Basecamp / Hotel',
    icon: '🏨',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.6)',
    badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
  },
  rock: {
    label: 'Rock & Alternativ Musik',
    icon: '🎸',
    color: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.6)',
    badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/30'
  },
  monuments: {
    label: 'Monumenter & Seværdigheder',
    icon: '🏛️',
    color: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.6)',
    badgeClass: 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
  },
  tiktok: {
    label: 'TikTok & Insta Spots',
    icon: '📱',
    color: '#ec4899',
    glow: 'rgba(236, 72, 153, 0.6)',
    badgeClass: 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
  }
};

// Initialize Leaflet Map
function initMap() {
  // Center near Milan Center / Duomo & Hotel
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([45.4720, 9.1890], 13);

  // CartoDB Dark Matter Tiles (Clean, fast, high contrast, keyless)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  // Zoom control top right
  L.control.zoom({ position: 'topright' }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

// Create custom pin HTML icon
function createCustomMarkerIcon(spot) {
  const cfg = CATEGORY_CONFIG[spot.category] || CATEGORY_CONFIG.rock;
  const isVisited = visitedSet.has(spot.id);
  const glow = isVisited ? 'rgba(16, 185, 129, 0.7)' : cfg.glow;
  const color = isVisited ? '#10b981' : cfg.color;

  const html = `
    <div class="custom-pin" style="--pin-glow: ${glow};">
      <div class="pin-bubble" style="background: ${color};">
        <span class="pin-emoji">${isVisited ? '⭐' : cfg.icon}</span>
      </div>
      <div class="pin-pulse"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-div-icon',
    html: html,
    iconSize: [36, 42],
    iconAnchor: [18, 38],
    popupAnchor: [0, -38]
  });
}

// Filter logic
function getFilteredLocations() {
  return allLocations.filter(spot => {
    // Category filter
    if (activeCategory === 'visited') {
      if (!visitedSet.has(spot.id)) return false;
    } else if (activeCategory !== 'all' && spot.category !== activeCategory) {
      return false;
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = spot.name.toLowerCase().includes(q);
      const matchDesc = spot.description.toLowerCase().includes(q);
      const matchTip = spot.tip ? spot.tip.toLowerCase().includes(q) : false;
      const matchAddr = spot.address.toLowerCase().includes(q);
      const matchCat = spot.category_label.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchTip && !matchAddr && !matchCat) {
        return false;
      }
    }

    return true;
  });
}

// Render markers on map
function renderMarkers() {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();

  const filtered = getFilteredLocations();

  filtered.forEach(spot => {
    const marker = L.marker([spot.lat, spot.lng], {
      icon: createCustomMarkerIcon(spot),
      title: spot.name
    });

    marker.on('click', () => {
      openModal(spot);
    });

    markersLayer.addLayer(marker);
  });
}

// Render list view cards
function renderList() {
  const container = document.getElementById('cards-container');
  const emptyState = document.getElementById('empty-state');
  const mobileCount = document.getElementById('mobile-list-count');

  const filtered = getFilteredLocations();
  if (mobileCount) mobileCount.textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  container.innerHTML = filtered.map(spot => {
    const cfg = CATEGORY_CONFIG[spot.category] || CATEGORY_CONFIG.rock;
    const isVisited = visitedSet.has(spot.id);

    return `
      <article class="bg-darkcard border ${isVisited ? 'border-emerald-500/40' : 'border-darkborder'} rounded-2xl p-4 shadow-lg transition hover:border-gray-500 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.badgeClass}">
                ${cfg.icon} ${cfg.label}
              </span>
              ${isVisited ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✓ Besøgt</span>' : ''}
            </div>
            <h3 class="text-base font-bold text-white font-display">${spot.name}</h3>
            <p class="text-xs text-gray-400 flex items-center gap-1">📍 ${spot.address}</p>
          </div>
          <button onclick="toggleVisitedSpot('${spot.id}')" class="p-2 rounded-xl bg-darksurface border border-darkborder hover:bg-darkborder/50 text-xs font-semibold text-gray-300 transition" title="Tjek af som besøgt">
            ${isVisited ? '⭐ <span class="hidden sm:inline">Besøgt</span>' : '☆ <span class="hidden sm:inline">Tjek af</span>'}
          </button>
        </div>

        <p class="text-xs text-gray-300 leading-relaxed">${spot.description}</p>

        <div class="rounded-xl p-2.5 bg-darksurface border border-red-500/20 text-xs text-gray-300">
          <span class="font-bold text-red-400">🔥 Tip:</span> ${spot.tip}
        </div>

        <div class="flex items-center gap-2 pt-1">
          <a href="${spot.maps_url}" target="_blank" rel="noopener noreferrer" class="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold text-center shadow-md transition flex items-center justify-center gap-1.5">
            <span>📍</span> Rutevejledning
          </a>
          <button onclick="zoomToSpot('${spot.id}')" class="py-2 px-3 rounded-xl bg-darksurface border border-darkborder hover:border-gray-500 text-gray-200 text-xs font-semibold transition">
            🗺️ Vis på kort
          </button>
          <a href="${spot.social_url}" target="_blank" rel="noopener noreferrer" class="py-2 px-3 rounded-xl bg-darksurface border border-darkborder hover:border-gray-500 text-gray-300 text-xs font-semibold transition">
            🔗 Link
          </a>
        </div>
      </article>
    `;
  }).join('');
}

// Modal handling
function openModal(spot) {
  currentModalSpot = spot;
  const cfg = CATEGORY_CONFIG[spot.category] || CATEGORY_CONFIG.rock;
  const isVisited = visitedSet.has(spot.id);

  const modal = document.getElementById('detail-modal');
  const badge = document.getElementById('modal-category-badge');
  const visitedBadge = document.getElementById('modal-visited-badge');
  const title = document.getElementById('modal-title');
  const address = document.getElementById('modal-address');
  const desc = document.getElementById('modal-desc');
  const tip = document.getElementById('modal-tip');
  const mapsBtn = document.getElementById('modal-maps-btn');
  const socialBtn = document.getElementById('modal-social-btn');
  const socialText = document.getElementById('modal-social-text');
  const toggleIcon = document.getElementById('modal-toggle-icon');
  const toggleText = document.getElementById('modal-toggle-text');

  badge.className = `px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${cfg.badgeClass}`;
  badge.textContent = `${cfg.icon} ${cfg.label}`;

  if (isVisited) {
    visitedBadge.classList.remove('hidden');
    toggleIcon.textContent = '✓';
    toggleText.textContent = 'Fjern fra besøgt';
  } else {
    visitedBadge.classList.add('hidden');
    toggleIcon.textContent = '⭐';
    toggleText.textContent = 'Marker som besøgt';
  }

  title.textContent = spot.name;
  address.innerHTML = `📍 ${spot.address}`;
  desc.textContent = spot.description;
  tip.textContent = spot.tip;

  // Google Maps direct directions link:
  // Use user location origin if possible via Maps dir API
  mapsBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

  socialBtn.href = spot.social_url;
  socialText.textContent = spot.social_label || 'Se mere';

  modal.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('detail-modal');
  modal.classList.add('hidden');
  currentModalSpot = null;
}

// Toggle visited helper
window.toggleVisitedSpot = function(id) {
  if (visitedSet.has(id)) {
    visitedSet.delete(id);
  } else {
    visitedSet.add(id);
  }
  saveVisited();
  renderMarkers();
  renderList();
  if (currentModalSpot && currentModalSpot.id === id) {
    openModal(currentModalSpot);
  }
};

window.zoomToSpot = function(id) {
  const spot = allLocations.find(s => s.id === id);
  if (!spot) return;
  switchView('map');
  map.setView([spot.lat, spot.lng], 16, { animate: true });
  openModal(spot);
};

// Switch between Map and List
function switchView(view) {
  currentView = view;
  const mapContainer = document.getElementById('view-map');
  const listContainer = document.getElementById('view-list');
  const btnMap = document.getElementById('btn-view-map');
  const btnList = document.getElementById('btn-view-list');
  const mobMap = document.getElementById('mobile-nav-map');
  const mobList = document.getElementById('mobile-nav-list');

  if (view === 'map') {
    mapContainer.classList.remove('hidden');
    listContainer.classList.add('hidden');

    btnMap.className = 'px-3 py-1.5 rounded-lg bg-red-600 text-white shadow-sm flex items-center gap-1 transition';
    btnList.className = 'px-3 py-1.5 rounded-lg text-gray-400 hover:text-white flex items-center gap-1 transition';

    mobMap.className = 'flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl bg-red-600 text-white font-bold text-xs shadow-md';
    mobList.className = 'flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl text-gray-400 hover:text-white font-semibold text-xs';

    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 100);
  } else {
    mapContainer.classList.add('hidden');
    listContainer.classList.remove('hidden');

    btnList.className = 'px-3 py-1.5 rounded-lg bg-red-600 text-white shadow-sm flex items-center gap-1 transition';
    btnMap.className = 'px-3 py-1.5 rounded-lg text-gray-400 hover:text-white flex items-center gap-1 transition';

    mobList.className = 'flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl bg-red-600 text-white font-bold text-xs shadow-md';
    mobMap.className = 'flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl text-gray-400 hover:text-white font-semibold text-xs';

    renderList();
  }
}

// Recenter Map
function recenterMap() {
  const filtered = getFilteredLocations();
  if (filtered.length === 0) {
    map.setView([45.4720, 9.1890], 13);
    return;
  }
  const group = L.featureGroup(filtered.map(s => L.marker([s.lat, s.lng])));
  map.fitBounds(group.getBounds().pad(0.15));
}

// Go to Hotel
function goToHotel() {
  const hotel = allLocations.find(s => s.id === 'ibis-milano-centro');
  if (!hotel) return;
  switchView('map');
  map.setView([hotel.lat, hotel.lng], 16, { animate: true });
  openModal(hotel);
}

// Setup Event Listeners
function setupEvents() {
  // Category Pills
  const pills = document.querySelectorAll('.cat-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => {
        p.classList.remove('active', 'bg-white', 'text-gray-900', 'border-white');
        p.classList.add('bg-darkcard');
      });
      pill.classList.add('active', 'bg-white', 'text-gray-900', 'border-white');
      pill.classList.remove('bg-darkcard');

      activeCategory = pill.dataset.cat;
      renderMarkers();
      renderList();
      if (currentView === 'map') recenterMap();
    });
  });

  // Search input
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (searchQuery.length > 0) {
      searchClear.classList.remove('hidden');
    } else {
      searchClear.classList.add('hidden');
    }
    renderMarkers();
    renderList();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.add('hidden');
    renderMarkers();
    renderList();
  });

  // View switchers
  document.getElementById('btn-view-map').addEventListener('click', () => switchView('map'));
  document.getElementById('btn-view-list').addEventListener('click', () => switchView('list'));
  document.getElementById('mobile-nav-map').addEventListener('click', () => switchView('map'));
  document.getElementById('mobile-nav-list').addEventListener('click', () => switchView('list'));

  // Shortcuts & Buttons
  document.getElementById('hotel-shortcut').addEventListener('click', goToHotel);
  document.getElementById('mobile-nav-hotel').addEventListener('click', goToHotel);
  document.getElementById('btn-hotel-map').addEventListener('click', goToHotel);
  document.getElementById('btn-recenter').addEventListener('click', recenterMap);

  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.add('hidden');
    const allPill = document.querySelector('.cat-pill[data-cat="all"]');
    if (allPill) allPill.click();
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') closeModal();
  });

  document.getElementById('modal-toggle-visited').addEventListener('click', () => {
    if (currentModalSpot) {
      toggleVisitedSpot(currentModalSpot.id);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// Fetch Locations & Start
async function init() {
  loadVisited();
  initMap();

  try {
    const res = await fetch('locations.json');
    allLocations = await res.json();
    renderMarkers();
    renderList();
    setupEvents();
  } catch (err) {
    console.error('Kunne ikke hente locations.json', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
