// ============================================================
// MILANO VENNETUR — APP LOGIK & KORT
// ============================================================

const STATE = {
  places: [],
  filteredPlaces: [],
  selectedCategory: 'all',
  searchQuery: '',
  visitedIds: new Set(),
  map: null,
  markers: {},
  activePlaceId: null,
};

const CATEGORY_META = {
  rock: { label: 'Rock & Musik', icon: '🎸', badgeClass: 'badge-rock', markerClass: 'marker-rock' },
  sight: { label: 'Monumenter', icon: '🏛️', badgeClass: 'badge-sight', markerClass: 'marker-sight' },
  viral: { label: 'TikTok & Insta', icon: '📱', badgeClass: 'badge-viral', markerClass: 'marker-viral' },
};

const DOM = {
  searchInput: document.getElementById('search-input'),
  clearSearch: document.getElementById('clear-search'),
  filterChips: document.querySelectorAll('.filter-chip'),
  placesList: document.getElementById('places-list'),
  sidebar: document.getElementById('sidebar'),
  visitedCount: document.getElementById('visited-count'),
  mobileListCount: document.getElementById('mobile-list-count'),
  filterTitleLabel: document.getElementById('filter-title-label'),
  activeCountLabel: document.getElementById('active-count-label'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalBody: document.getElementById('modal-body'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  navBtnMap: document.getElementById('nav-btn-map'),
  navBtnList: document.getElementById('nav-btn-list'),
  btnRecenter: document.getElementById('btn-recenter'),
  btnShowDuomo: document.getElementById('btn-show-duomo'),
};

// 1. Initialisering
document.addEventListener('DOMContentLoaded', async () => {
  loadVisitedFromStorage();
  initMap();
  await loadLocations();
  setupEventListeners();
});

// 2. LocalStorage for Besøgt-status
function loadVisitedFromStorage() {
  try {
    const saved = localStorage.getItem('milano_visited_spots');
    if (saved) {
      STATE.visitedIds = new Set(JSON.parse(saved));
    }
  } catch (e) {
    console.warn('Kunne ikke læse localStorage:', e);
  }
}

function saveVisitedToStorage() {
  try {
    localStorage.setItem('milano_visited_spots', JSON.stringify(Array.from(STATE.visitedIds)));
  } catch (e) {
    console.warn('Kunne ikke gemme i localStorage:', e);
  }
  updateVisitedCounters();
}

function toggleVisited(placeId) {
  if (STATE.visitedIds.has(placeId)) {
    STATE.visitedIds.delete(placeId);
  } else {
    STATE.visitedIds.add(placeId);
  }
  saveVisitedToStorage();
  renderMarkers();
  renderList();
  
  // Hvis modal er åben for dette sted, opdater knappen
  if (STATE.activePlaceId === placeId) {
    const modalBtn = document.getElementById('modal-visit-btn');
    if (modalBtn) {
      const isVisited = STATE.visitedIds.has(placeId);
      modalBtn.innerHTML = isVisited ? '⭐ Marker som ikke besøgt' : '⭐ Marker som besøgt ✓';
    }
  }
}

function updateVisitedCounters() {
  const count = STATE.visitedIds.size;
  if (DOM.visitedCount) DOM.visitedCount.textContent = count;
  const countVisitedEl = document.getElementById('count-visited');
  if (countVisitedEl) countVisitedEl.textContent = count;
}

// 3. Leaflet Kort Opsætning
function initMap() {
  // Center over Milanos historiske centrum (Duomo området)
  STATE.map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([45.4642, 9.1900], 13);

  // Zoom kontrol i øverste højre hjørne
  L.control.zoom({ position: 'topright' }).addTo(STATE.map);

  // Mørkt Carto Dark kortlag
  const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
  });

  // Backup åbent kortlag (OSM Humanitarian)
  const osmHotTiles = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19,
  });

  darkTiles.addTo(STATE.map);

  L.control.layers({
    "🌙 Urban Dark": darkTiles,
    "☀️ Lyst Kort": osmHotTiles
  }, null, { position: 'bottomleft' }).addTo(STATE.map);
}

// 4. Hent data fra locations.json
async function loadLocations() {
  try {
    const res = await fetch('locations.json');
    if (!res.ok) throw new Error('Kunne ikke hente locations.json');
    STATE.places = await res.json();
    STATE.filteredPlaces = [...STATE.places];

    updateCounts();
    renderMarkers();
    renderList();
  } catch (err) {
    console.error('Fejl ved indlæsning af steder:', err);
    DOM.placesList.innerHTML = `<div style="padding:20px; color:#ff4444;">Kunne ikke indlæse steder. Tjek locations.json.</div>`;
  }
}

// 5. Render Kort Markører
function renderMarkers() {
  // Fjern eksisterende markører
  Object.values(STATE.markers).forEach(m => STATE.map.removeLayer(m));
  STATE.markers = {};

  STATE.filteredPlaces.forEach(place => {
    const isVisited = STATE.visitedIds.has(place.id);
    const meta = CATEGORY_META[place.category] || { icon: '📍', markerClass: 'marker-rock' };

    const markerClass = isVisited ? 'marker-visited' : meta.markerClass;
    const iconSymbol = isVisited ? '⭐' : meta.icon;

    const iconHtml = `
      <div class="pin-bubble">
        <span>${iconSymbol}</span>
      </div>
    `;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: `custom-neon-marker ${markerClass}`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const marker = L.marker([place.lat, place.lng], { icon: customIcon });

    // Rutevejledning links
    const googleMapsNav = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`;
    const appleMapsNav = `https://maps.apple.com/?daddr=${place.lat},${place.lng}&dirflg=w`;

    // Tooltip til desktop
    const hoverHtml = `
      <div class="hover-card">
        <div class="hover-top-row">
          ${place.image ? `<img class="hover-thumb" src="${place.image}" alt="${place.name}">` : ''}
          <div class="hover-title-col">
            <span class="card-badge ${meta.badgeClass}">${meta.icon} ${meta.label}</span>
            <h3 class="hover-title">${place.name}</h3>
          </div>
        </div>
        <p class="hover-desc">${place.shortDesc}</p>
        <div class="hover-actions">
          <a href="${googleMapsNav}" target="_blank" rel="noopener noreferrer" class="hover-btn hover-btn-google" onclick="event.stopPropagation()">
            <span>🗺️ Google Maps</span>
          </a>
          <a href="${appleMapsNav}" target="_blank" rel="noopener noreferrer" class="hover-btn hover-btn-apple" onclick="event.stopPropagation()">
            <span>🧭 Apple</span>
          </a>
        </div>
      </div>
    `;

    if (window.innerWidth > 768) {
      marker.bindTooltip(hoverHtml, {
        direction: 'top',
        offset: [0, -14],
        className: 'custom-hover-tooltip',
        interactive: true,
        opacity: 1
      });
    }

    marker.on('click', () => {
      openModal(place);
    });

    marker.addTo(STATE.map);
    STATE.markers[place.id] = marker;
  });
}

// 6. Render Liste
function renderList() {
  if (STATE.filteredPlaces.length === 0) {
    DOM.placesList.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">🔍</span>
        <p>Ingen steder matchede din filtrering.</p>
        <button onclick="resetFilters()" style="margin-top: 12px; background: #FFF; color: #000; border: none; padding: 6px 14px; border-radius: 999px; font-weight: 700; cursor: pointer;">Nulstil filter</button>
      </div>
    `;
    return;
  }

  DOM.placesList.innerHTML = STATE.filteredPlaces.map(place => {
    const meta = CATEGORY_META[place.category] || { icon: '📍', label: place.category, badgeClass: 'badge-rock' };
    const isVisited = STATE.visitedIds.has(place.id);

    return `
      <article class="place-card ${isVisited ? 'visited' : ''}" onclick="selectPlace('${place.id}')">
        <div class="card-top-row">
          ${place.image ? `<img src="${place.image}" alt="${place.name}" class="card-thumb" loading="lazy">` : ''}
          <div class="card-info-col">
            <div class="card-title-row">
              <h2 class="card-title">${place.name}</h2>
              <span class="card-badge ${meta.badgeClass}">${meta.icon} ${meta.label}</span>
            </div>
            <p class="card-desc">${place.shortDesc}</p>
          </div>
        </div>
        <div class="card-footer">
          <span>📍 ${place.address}</span>
          <button class="btn-visit-toggle ${isVisited ? 'active' : ''}" onclick="event.stopPropagation(); toggleVisited('${place.id}')">
            <span>${isVisited ? '⭐ Besøgt' : '☆ Marker set'}</span>
          </button>
        </div>
      </article>
    `;
  }).join('');
}

// 7. Vælg og centrer sted
function selectPlace(placeId) {
  const place = STATE.places.find(p => p.id === placeId);
  if (!place) return;

  STATE.activePlaceId = placeId;
  STATE.map.flyTo([place.lat, place.lng], 16, { duration: 0.8 });

  openModal(place);

  if (window.innerWidth <= 768) {
    DOM.sidebar.classList.remove('mobile-open');
    DOM.navBtnMap.classList.add('active');
    DOM.navBtnList.classList.remove('active');
  }
}

// 8. Detalje Modal / Bottom Sheet
function openModal(place) {
  STATE.activePlaceId = place.id;
  const meta = CATEGORY_META[place.category] || { icon: '📍', label: place.category, badgeClass: 'badge-rock' };
  const isVisited = STATE.visitedIds.has(place.id);
  const googleMapsNav = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`;
  const appleMapsNav = `https://maps.apple.com/?daddr=${place.lat},${place.lng}&dirflg=w`;

  const tipClass = place.category === 'sight' ? 'tip-sight' : place.category === 'viral' ? 'tip-viral' : '';

  DOM.modalBody.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="modal-top-row">
      ${place.image ? `<img src="${place.image}" alt="${place.name}" class="modal-thumb">` : ''}
      <div class="modal-title-col">
        <span class="card-badge ${meta.badgeClass}">${meta.icon} ${meta.label}</span>
        <h2 class="modal-title">${place.name}</h2>
        <div class="modal-address">📍 ${place.address}</div>
      </div>
    </div>

    <p class="modal-desc">${place.shortDesc}</p>

    ${place.tips ? `
      <div class="modal-tip-box ${tipClass}">
        <div class="tip-title">💡 Insider-Tip til Venneturen</div>
        <div class="tip-body">${place.tips}</div>
      </div>
    ` : ''}

    <div class="modal-actions">
      <div class="nav-buttons-row">
        <a href="${googleMapsNav}" target="_blank" rel="noopener noreferrer" class="btn-nav-google">
          <span>🗺️ Gå-rute i Google Maps</span>
        </a>
        <a href="${appleMapsNav}" target="_blank" rel="noopener noreferrer" class="btn-nav-apple">
          <span>🧭 Apple Maps</span>
        </a>
      </div>

      ${place.socialUrl ? `
        <a href="${place.socialUrl}" target="_blank" rel="noopener noreferrer" class="btn-social-link">
          <span>🔗 ${place.socialLabel || 'Åbn profil / link'}</span>
        </a>
      ` : ''}

      <button id="modal-visit-btn" class="btn-modal-visit" onclick="toggleVisited('${place.id}')">
        <span>${isVisited ? '⭐ Marker som IKKE besøgt' : '⭐ Marker som BESØGT ✓'}</span>
      </button>
    </div>
  `;

  DOM.modalBackdrop.classList.add('open');
}

function closeModal() {
  DOM.modalBackdrop.classList.remove('open');
}

// 9. Filtrering & Tællere
function updateCounts() {
  const counts = {
    all: STATE.places.length,
    rock: STATE.places.filter(p => p.category === 'rock').length,
    sight: STATE.places.filter(p => p.category === 'sight').length,
    viral: STATE.places.filter(p => p.category === 'viral').length,
  };

  document.getElementById('count-all').textContent = counts.all;
  document.getElementById('count-rock').textContent = counts.rock;
  document.getElementById('count-sight').textContent = counts.sight;
  document.getElementById('count-viral').textContent = counts.viral;

  updateVisitedCounters();
}

function applyFilters() {
  const query = STATE.searchQuery.toLowerCase().trim();

  STATE.filteredPlaces = STATE.places.filter(place => {
    // Kategori
    let matchCat = false;
    if (STATE.selectedCategory === 'all') {
      matchCat = true;
    } else if (STATE.selectedCategory === 'visited') {
      matchCat = STATE.visitedIds.has(place.id);
    } else {
      matchCat = place.category === STATE.selectedCategory;
    }

    // Søgetekst
    let matchQuery = true;
    if (query) {
      const name = place.name.toLowerCase();
      const desc = place.shortDesc.toLowerCase();
      const tips = (place.tips || '').toLowerCase();
      const tags = (place.tags || []).join(' ').toLowerCase();
      matchQuery = name.includes(query) || desc.includes(query) || tips.includes(query) || tags.includes(query);
    }

    return matchCat && matchQuery;
  });

  const count = STATE.filteredPlaces.length;
  DOM.activeCountLabel.textContent = `${count} steder`;
  DOM.mobileListCount.textContent = count;

  renderMarkers();
  renderList();
}

function resetFilters() {
  STATE.selectedCategory = 'all';
  STATE.searchQuery = '';
  DOM.searchInput.value = '';
  DOM.clearSearch.style.display = 'none';

  DOM.filterChips.forEach(c => c.classList.toggle('active', c.dataset.category === 'all'));
  applyFilters();
}

// 10. Event Listeners
function setupEventListeners() {
  // Filter chips
  DOM.filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      DOM.filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      STATE.selectedCategory = chip.dataset.category;
      applyFilters();
    });
  });

  // Søgefelt
  DOM.searchInput.addEventListener('input', (e) => {
    STATE.searchQuery = e.target.value;
    DOM.clearSearch.style.display = STATE.searchQuery ? 'block' : 'none';
    applyFilters();
  });

  DOM.clearSearch.addEventListener('click', () => {
    STATE.searchQuery = '';
    DOM.searchInput.value = '';
    DOM.clearSearch.style.display = 'none';
    applyFilters();
  });

  // Modal luk
  DOM.modalCloseBtn.addEventListener('click', closeModal);
  DOM.modalBackdrop.addEventListener('click', (e) => {
    if (e.target === DOM.modalBackdrop) closeModal();
  });

  // Mobil faneblade
  DOM.navBtnMap.addEventListener('click', () => {
    DOM.sidebar.classList.remove('mobile-open');
    DOM.navBtnMap.classList.add('active');
    DOM.navBtnList.classList.remove('active');
  });

  DOM.navBtnList.addEventListener('click', () => {
    DOM.sidebar.classList.add('mobile-open');
    DOM.navBtnList.classList.add('active');
    DOM.navBtnMap.classList.remove('active');
  });

  // Kort genveje
  DOM.btnRecenter.addEventListener('click', () => {
    STATE.map.flyTo([45.4642, 9.1900], 13, { duration: 0.8 });
  });

  DOM.btnShowDuomo.addEventListener('click', () => {
    const duomo = STATE.places.find(p => p.id === 'duomo-di-milano');
    if (duomo) selectPlace(duomo.id);
  });
}
