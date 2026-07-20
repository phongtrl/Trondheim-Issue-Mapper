// Initialize map and basemaps
const map = L.map('map').setView([63.4305, 10.3951], 13);

const baseLayers = {
  OpenStreetMap: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: 'OpenStreetMap contributors'
  }),
  CyclOSM: L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: 'OpenStreetMap contributors, CyclOSM'
  }),
  Satellite: L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless/GoogleMapsCompatible/{z}/{y}/{x}.jpg', {
    maxZoom: 19,
    attribution: 'EOX IT Services GmbH and Sentinel-2'
  })
};

let activeLayer = baseLayers.CyclOSM;
activeLayer.addTo(map);

// Keep the map correctly sized when the sidebar collapses/expands or the layout changes.
const mapElement = document.getElementById('map');
if (window.ResizeObserver && mapElement) {
  const mapResizeObserver = new ResizeObserver(() => map.invalidateSize());
  mapResizeObserver.observe(mapElement);
}

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const selectionPane = map.createPane('selectionPane');
selectionPane.style.zIndex = '390';
const selectionHighlightGroup = L.layerGroup().addTo(map);

const customMarkerIcon = L.divIcon({ className: 'custom-marker-icon', iconSize: [16, 16], iconAnchor: [8, 8] });

const drawControl = new L.Control.Draw({
  position: 'topright',
  draw: {
    marker: { icon: customMarkerIcon },
    polyline: {
      shapeOptions: {
        color: '#000000',
        weight: 3,
        dashArray: '8,6',
        opacity: 0.9
      }
    },
    polygon: {
      allowIntersection: false,
      showArea: true,
      shapeOptions: {
        color: '#000000',
        weight: 3,
        dashArray: '8,6',
        opacity: 0.9,
        fillColor: '#ffffff',
        fillOpacity: 0.12
      }
    },
    rectangle: false,
    circle: false,
    circlemarker: false
  },
  edit: {
    featureGroup: drawnItems,
    edit: false,
    remove: false
  }
});
map.addControl(drawControl);

const featureList = document.getElementById('featureList');
const featureCount = document.getElementById('featureCount');
const exportBtn = document.getElementById('exportBtn');
const emailBtn = document.getElementById('emailBtn');
const exportResult = document.getElementById('exportResult');
const layerButtons = document.querySelectorAll('.layer-btn');
const welcomeBox = document.getElementById('welcomeBox');
const toggleInfoBtn = document.getElementById('toggleInfo');
const controlDrawer = document.getElementById('controlDrawer');
const drawerToggle = document.getElementById('toggleDrawer');
const drawerToggle2 = document.getElementById('toggleDrawer2');
const sortBy = document.getElementById('sortBy');
const filterBy = document.getElementById('filterBy');
const gotItBtn = document.getElementById('gotItBtn');
const closeWelcome = document.getElementById('closeWelcome');
const emailAddressInput = document.getElementById('emailAddress');
const body = document.body;
const featureForm = document.getElementById('featureForm');
const fTitle = document.getElementById('fTitle');
const fDesc = document.getElementById('fDesc');
const saveForm = document.getElementById('saveForm');
const cancelForm = document.getElementById('cancelForm');
const formEyebrow = document.getElementById('formEyebrow');
const formHeading = document.getElementById('formHeading');
const autoBackupToggle = document.getElementById('autoBackupToggle');
const downloadBackup = document.getElementById('downloadBackup');
const restoreBackup = document.getElementById('restoreBackup');
const backupTarget = document.getElementById('backupTarget');
const backupFileInput = document.getElementById('backupFileInput');
const chooseLocalBackupFile = document.getElementById('chooseLocalBackupFile');
const addFeatureBtn = document.getElementById('addFeatureBtn');
const addFeaturePicker = document.getElementById('addFeaturePicker');
const minimizedAddBtn = document.getElementById('minimizedAddBtn');
const minimizedAddPicker = document.getElementById('minimizedAddPicker');
const BACKUP_KEY = 'trondheim_warning_map_backup';
const AUTO_BACKUP_KEY = 'trondheim_warning_map_auto_backup';
const LOCAL_BACKUP_FILE_NAME = 'trondheim-backup.json';
const STARTER_DATA_PATH = './data/issues.geojson';
const STARTER_GEOJSON_FALLBACK = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'seed-marker-1',
        title: 'Narrow crossing at Elgeseter',
        description: 'Pedestrians and bikes stack up here during peak hours because the waiting area is too tight.',
        type: 'marker',
        created: 1721462400000
      },
      geometry: {
        type: 'Point',
        coordinates: [10.3958, 63.4194]
      }
    },
    {
      type: 'Feature',
      properties: {
        id: 'seed-line-1',
        title: 'Painted lane fades near river route',
        description: 'Wayfinding and lane markings become unclear along this stretch, especially in rain.',
        type: 'line',
        created: 1721548800000
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [10.3862, 63.4308],
          [10.3894, 63.4316],
          [10.3938, 63.4322]
        ]
      }
    },
    {
      type: 'Feature',
      properties: {
        id: 'seed-area-1',
        title: 'Conflict zone outside station',
        description: 'Large flows of buses, bikes, and walkers overlap in this area and visibility is limited.',
        type: 'polygon',
        created: 1721635200000
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [10.4004, 63.4361],
          [10.4027, 63.4362],
          [10.4031, 63.4349],
          [10.4011, 63.4345],
          [10.4004, 63.4361]
        ]]
      }
    }
  ]
};

let pendingLayer = null;
let pendingIsNew = false;
let selectedId = null;
let sortOrder = 'newest';
let filterType = 'all';
let localBackupFileHandle = null;

function generateFeatureId() {
  return `f-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function featureTypeFromLayer(layer) {
  if (layer instanceof L.Marker) return 'marker';
  if (layer instanceof L.Polygon) return 'polygon';
  if (layer instanceof L.Polyline) return 'line';
  return 'feature';
}

function featureTypeLabel(type) {
  switch (type) {
    case 'marker':
      return 'Point';
    case 'line':
      return 'Line';
    case 'polygon':
      return 'Area';
    default:
      return 'Feature';
  }
}

function getSortedFilteredLayers() {
  return drawnItems.getLayers()
    .filter((layer) => {
      const type = layer.feature?.properties?.type || featureTypeFromLayer(layer);
      return filterType === 'all' || type === filterType;
    })
    .sort((a, b) => {
      const aCreated = a.feature?.properties?.created || 0;
      const bCreated = b.feature?.properties?.created || 0;
      if (sortOrder === 'title') {
        const aTitle = (a.feature?.properties?.title || '').toLowerCase();
        const bTitle = (b.feature?.properties?.title || '').toLowerCase();
        return aTitle.localeCompare(bTitle);
      }
      return sortOrder === 'oldest' ? aCreated - bCreated : bCreated - aCreated;
    });
}

function updateFeatureCount() {
  const count = getSortedFilteredLayers().length;
  featureCount.textContent = `${count} item${count === 1 ? '' : 's'}`;
}

function setResult(message) {
  exportResult.textContent = message;
}

function savePendingLayer() {
  if (!pendingLayer) return;
  const title = fTitle.value.trim() || '(no title)';
  const description = fDesc.value.trim() || 'No description provided.';

  pendingLayer.feature = pendingLayer.feature || pendingLayer.toGeoJSON();
  pendingLayer.feature.properties = pendingLayer.feature.properties || {};
  pendingLayer.feature.properties.id = pendingLayer.feature.properties.id || generateFeatureId();
  pendingLayer.feature.properties.title = title;
  pendingLayer.feature.properties.description = description;
  pendingLayer.feature.properties.type = featureTypeFromLayer(pendingLayer);
  pendingLayer.feature.properties.created = pendingLayer.feature.properties.created || Date.now();

  if (pendingLayer instanceof L.Marker) {
    pendingLayer.setIcon(customMarkerIcon);
  } else if (pendingLayer.setStyle) {
    styleLayerAsRoad(pendingLayer);
  }

  attachPopupAndLabel(pendingLayer);
  pendingLayer.off('click');
  pendingLayer.on('click', () => selectFeature(pendingLayer.feature.properties.id));

  if (!drawnItems.hasLayer(pendingLayer)) {
    drawnItems.addLayer(pendingLayer);
  }

  renderFeatureList();
  selectFeature(pendingLayer.feature.properties.id);
  pendingLayer = null;
  pendingIsNew = false;
  featureForm.classList.add('hidden');
  fTitle.value = '';
  fDesc.value = '';
  setFormMode('new');
  maybeAutoBackup();
}

function setFormMode(mode) {
  if (mode === 'edit') {
    formEyebrow.textContent = 'Edit report';
    formHeading.textContent = 'Update report details';
    saveForm.textContent = 'Save changes';
  } else {
    formEyebrow.textContent = 'New report';
    formHeading.textContent = 'Add report details';
    saveForm.textContent = 'Save report';
  }
}

function openEditForm(layer) {
  if (!layer) return;
  layer.feature = layer.feature || layer.toGeoJSON();
  layer.feature.properties = layer.feature.properties || {};
  pendingLayer = layer;
  pendingIsNew = false;
  fTitle.value = layer.feature.properties.title || '';
  fDesc.value = layer.feature.properties.description || '';
  setFormMode('edit');
  featureForm.classList.remove('hidden');
  fTitle.focus();
}

function styleLayerAsRoad(layer) {
  if (!(layer instanceof L.Polyline) || layer instanceof L.Marker) return;
  if (layer instanceof L.Polygon) {
    layer.setStyle({
      color: '#000000',
      weight: 2,
      fillColor: 'rgba(56, 189, 248, 0.18)',
      fillOpacity: 0.18,
      opacity: 0.9,
      dashArray: null,
      className: 'report-path'
    });
  } else {
    layer.setStyle({
      color: '#000000',
      weight: 3,
      opacity: 0.9,
      dashArray: '6,6',
      className: 'report-path'
    });
  }
}

function setFeatureSelection(layer, selected) {
  if (layer instanceof L.Marker) {
    const markerEl = layer.getElement?.();
    if (markerEl) {
      markerEl.classList.toggle('selected-marker', selected);
    }
    return;
  }
  if (!layer.setStyle) return;
  if (selected) {
    const selectedStyle = layer instanceof L.Polygon ? {
      color: '#000000',
      weight: 2,
      fillColor: 'rgba(56, 189, 248, 0.18)',
      fillOpacity: 0.18,
      opacity: 0.9,
      dashArray: null,
      className: 'report-path selected-feature'
    } : {
      color: '#000000',
      weight: 3,
      opacity: 0.9,
      dashArray: '6,6',
      className: 'report-path selected-feature'
    };
    layer.setStyle(selectedStyle);
  } else {
    styleLayerAsRoad(layer);
  }
}

function resetLayerStyles() {
  drawnItems.eachLayer((layer) => {
    if (layer.setStyle && !(layer instanceof L.Marker)) {
      styleLayerAsRoad(layer);
    }
    if (layer instanceof L.Marker) {
      const markerEl = layer.getElement?.();
      if (markerEl) markerEl.classList.remove('selected-marker');
    }
  });
}

function selectFeature(featureId) {
  selectedId = featureId;
  featureList.querySelectorAll('.feature-row').forEach((row) => {
    row.classList.toggle('selected', row.dataset.id === featureId);
  });

  drawnItems.eachLayer((layer) => {
    const layerId = layer.feature?.properties?.id;
    const isSelected = layerId === featureId;
    setFeatureSelection(layer, isSelected);

    if (isSelected) {
      if (layer.openPopup) layer.openPopup();
      if (layer.getBounds) {
        map.flyTo(layer.getBounds().getCenter(), 15, { duration: 0.7 });
      } else if (layer.getLatLng) {
        map.flyTo(layer.getLatLng(), 15, { duration: 0.7 });
      }
    }
  });
}

function renderFeatureList() {
  const layers = getSortedFilteredLayers();
  featureList.innerHTML = '';

  if (!layers.length) {
    featureList.innerHTML = '<div class="feature-card"><p style="margin:0;color:#cbd5e1;">No reports yet. Draw a marker, line, or area to add one.</p></div>';
    updateFeatureCount();
    return;
  }

  featureList.innerHTML = `
    <div class="feature-table-wrapper">
      <table class="feature-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const tbody = featureList.querySelector('tbody');

  layers.forEach((layer) => {
    layer.feature = layer.feature || layer.toGeoJSON();
    layer.feature.properties = layer.feature.properties || {};
    const id = layer.feature.properties.id || generateFeatureId();
    layer.feature.properties.id = id;
    const type = layer.feature.properties.type || featureTypeFromLayer(layer);
    const title = layer.feature.properties.title || '(no title)';
    const description = layer.feature.properties.description || 'No description';

    const row = document.createElement('tr');
    row.className = 'feature-row';
    row.dataset.id = id;
    row.innerHTML = `
      <td>
        <strong>${title}</strong><br />
        <span class="row-description">${description}</span>
      </td>
      <td>${featureTypeLabel(type)}</td>
      <td>
        <button type="button" class="row-icon-btn zoom-btn" title="Zoom to report" aria-label="Zoom to report">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>
        <div class="row-menu">
          <button type="button" class="row-icon-btn menu-btn" title="More actions" aria-label="More actions" aria-haspopup="true" aria-expanded="false">
            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>
          </button>
          <div class="row-menu-list hidden" role="menu">
            <button type="button" role="menuitem" data-action="edit">Edit</button>
            <button type="button" role="menuitem" data-action="delete" class="danger-item">Delete</button>
          </div>
        </div>
      </td>
    `;

    const zoomBtn = row.querySelector('.zoom-btn');
    zoomBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      selectFeature(id);
    });

    const menuBtn = row.querySelector('.menu-btn');
    const menuList = row.querySelector('.row-menu-list');
    menuBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = !menuList.classList.contains('hidden');
      closeAllRowMenus();
      if (!isOpen) {
        menuList.classList.remove('hidden');
        menuBtn.setAttribute('aria-expanded', 'true');
      }
    });
    menuList.querySelectorAll('[data-action]').forEach((item) => {
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        closeAllRowMenus();
        handleFeatureAction(id, item.dataset.action);
      });
    });

    row.addEventListener('click', (event) => {
      if (event.target.closest('.row-icon-btn') || event.target.closest('.row-menu-list')) {
        return;
      }
      selectFeature(id);
    });
    tbody.appendChild(row);
  });

  updateFeatureCount();
}

function closeAllRowMenus() {
  featureList.querySelectorAll('.row-menu-list').forEach((menu) => menu.classList.add('hidden'));
  featureList.querySelectorAll('.menu-btn').forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('.row-menu')) {
    closeAllRowMenus();
  }
});

function attachPopupAndLabel(layer) {
  layer.feature = layer.feature || layer.toGeoJSON();
  layer.feature.properties = layer.feature.properties || {};
  layer.feature.properties.id = layer.feature.properties.id || generateFeatureId();

  const title = layer.feature.properties.title || 'Report';
  const description = layer.feature.properties.description || 'No description provided.';
  const type = layer.feature.properties.type ?? featureTypeFromLayer(layer);

  const content = `
    <div style="max-width:260px; color:#0f172a;">
      <strong>${title}</strong>
      <small style="display:block;margin-top:6px;color:#475569;">${featureTypeLabel(type)}</small>
      <p style="margin:10px 0 0;color:#334155;line-height:1.5;">${description}</p>
      <div style="text-align:right;margin-top:12px;"><button id="popup-edit-${layer.feature.properties.id}" style="padding:8px 12px;border:none;border-radius:10px;background:#0ea5e9;color:#fff;cursor:pointer;">Edit</button></div>
    </div>
  `;

  layer.bindPopup(content, { minWidth: 240 });
  layer.bindTooltip(title, { permanent: true, direction: 'right', className: 'feature-label' });

  layer.on('popupopen', () => {
    const props = layer.feature?.properties || {};
    const button = document.getElementById(`popup-edit-${props.id}`);
    if (button) {
      button.addEventListener('click', () => {
        layer.closePopup();
        openEditForm(layer);
      });
    }
  });
}

function getFlatLatLngs(latlngs) {
  if (!Array.isArray(latlngs)) return [];
  if (!latlngs.length) return [];
  if (Array.isArray(latlngs[0])) {
    return latlngs.flatMap(getFlatLatLngs);
  }
  return latlngs;
}

function handleFeatureAction(featureId, action) {
  const layer = drawnItems.getLayers().find((l) => l.feature?.properties?.id === featureId);
  if (!layer) return;
  switch (action) {
    case 'zoom':
      selectFeature(featureId);
      break;
    case 'edit':
      openEditForm(layer);
      break;
    case 'delete':
      drawnItems.removeLayer(layer);
      if (selectedId === featureId) selectedId = null;
      renderFeatureList();
      maybeAutoBackup();
      break;
    default:
      break;
  }
}

function closestPointOnSegment(latlng, a, b) {
  const p = map.latLngToLayerPoint(latlng);
  const pa = map.latLngToLayerPoint(a);
  const pb = map.latLngToLayerPoint(b);
  const ab = L.point(pb.x - pa.x, pb.y - pa.y);
  const ap = L.point(p.x - pa.x, p.y - pa.y);
  const abSize = ab.x * ab.x + ab.y * ab.y;
  if (abSize === 0) return { point: a, distance: p.distanceTo(pa) };
  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / abSize));
  const closest = L.point(pa.x + ab.x * t, pa.y + ab.y * t);
  return { point: map.layerPointToLatLng(closest), distance: p.distanceTo(closest) };
}

function findNearestPathLatitudeLng(latlng, maxDistancePx = 12, excludeLayer = null) {
  let best = null;
  drawnItems.eachLayer((layer) => {
    if (layer === excludeLayer) return;
    if (!(layer instanceof L.Polyline) || layer instanceof L.Circle) return;
    const latlngs = getFlatLatLngs(layer.getLatLngs());
    for (let i = 0; i < latlngs.length - 1; i += 1) {
      const result = closestPointOnSegment(latlng, latlngs[i], latlngs[i + 1]);
      if (!best || result.distance < best.distance) {
        best = result;
      }
    }
  });
  if (!best || best.distance > maxDistancePx) return null;
  return best.point;
}

function snapLayerToExistingPath(layer, excludeSelf = true) {
  const latlngs = layer.getLatLngs();
  const flat = getFlatLatLngs(latlngs);
  let changed = false;
  const snapped = flat.map((latlng) => {
    const candidate = findNearestPathLatitudeLng(latlng, 12, excludeSelf ? layer : null);
    if (candidate) {
      changed = true;
      return candidate;
    }
    return latlng;
  });

  if (changed) {
    if (Array.isArray(latlngs[0])) {
      layer.setLatLngs([snapped]);
    } else {
      layer.setLatLngs(snapped);
    }
  }
}

async function saveGeoJsonToLocalFile(geojson) {
  if (!localBackupFileHandle || !window.showSaveFilePicker) return;
  try {
    const writable = await localBackupFileHandle.createWritable();
    await writable.write(JSON.stringify(geojson, null, 2));
    await writable.close();
  } catch (error) {
    console.warn('Local folder backup failed:', error);
  }
}

function saveBackupToStorage() {
  const geojson = drawnItems.toGeoJSON();
  localStorage.setItem(BACKUP_KEY, JSON.stringify(geojson));
  if (localBackupFileHandle) {
    saveGeoJsonToLocalFile(geojson);
  }
}

async function requestLocalBackupFileHandle() {
  if (!window.showSaveFilePicker) {
    setResult('This browser does not support local file backup.');
    return;
  }

  try {
    localBackupFileHandle = await window.showSaveFilePicker({
      suggestedName: LOCAL_BACKUP_FILE_NAME,
      types: [{ description: 'GeoJSON backup file', accept: { 'application/json': ['.json'] } }],
      excludeAcceptAllOption: false
    });
    const geojson = drawnItems.toGeoJSON();
    await saveGeoJsonToLocalFile(geojson);
    setResult('Local backup file chosen and saved.');
  } catch (error) {
    console.warn('Local backup file selection canceled or failed:', error);
    setResult('Local backup file was not selected.');
  }
}

function getSavedBackup() {
  const saved = localStorage.getItem(BACKUP_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function downloadGeoJsonFile(filename, geojson) {
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildEmailComposeUrl(filename, recipient) {
  const subject = encodeURIComponent(`Trondheim export: ${filename}`);
  const body = encodeURIComponent(
    `Please attach the file ${filename} to this email after it downloads.\n\n` +
    'If the attachment does not appear automatically, add it from your downloads folder.'
  );
  const normalized = recipient.toLowerCase().trim();
  if (normalized.endsWith('@gmail.com')) {
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${subject}&body=${body}`;
  }
  return `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(recipient)}&subject=${subject}&body=${body}`;
}

function downloadBackupFile() {
  const geojson = drawnItems.toGeoJSON();
  if (!geojson.features.length) {
    setResult('No features to backup yet.');
    return;
  }
  downloadGeoJsonFile(`trondheim-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, geojson);
}

function loadFeaturesFromObject(geojson, options = {}) {
  const { clearExisting = true } = options;
  if (!geojson || !Array.isArray(geojson.features)) {
    setResult('Backup data not valid.');
    return;
  }

  if (clearExisting) {
    drawnItems.clearLayers();
    selectedId = null;
  }

  L.geoJSON(geojson, {
    pointToLayer(feature, latlng) {
      return L.marker(latlng, { icon: customMarkerIcon });
    },
    onEachFeature(feature, layer) {
      layer.feature = feature;
      if (layer instanceof L.Marker) {
        layer.setIcon(customMarkerIcon);
      }
      layer.feature.properties = layer.feature.properties || {};
      layer.feature.properties.created = layer.feature.properties.created || Date.now();
      attachPopupAndLabel(layer);
      layer.on('click', () => selectFeature(layer.feature.properties.id));
      drawnItems.addLayer(layer);
    }
  });

  renderFeatureList();
}

function restoreBackupFromObject(geojson) {
  loadFeaturesFromObject(geojson);
  if (autoBackupToggle.checked) saveBackupToStorage();
}

async function loadStarterData() {
  try {
    const response = await fetch(STARTER_DATA_PATH, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const geojson = await response.json();
    loadFeaturesFromObject(geojson);
    setResult(`Loaded ${geojson.features.length} starter reports.`);
    return true;
  } catch (error) {
    console.warn('Starter GeoJSON fetch failed, using fallback data:', error);
    loadFeaturesFromObject(STARTER_GEOJSON_FALLBACK);
    setResult(`Loaded ${STARTER_GEOJSON_FALLBACK.features.length} starter reports.`);
    return false;
  }
}

function maybeAutoBackup() {
  if (autoBackupToggle.checked) {
    saveBackupToStorage();
    return;
  }

  if (localBackupFileHandle) {
    saveGeoJsonToLocalFile(drawnItems.toGeoJSON());
  }
}

function enableDrawMode(type) {
  const drawToolbar = drawControl._toolbars?.draw;
  if (!drawToolbar) return;

  const modeKey = type === 'line' ? 'polyline' : type;
  const mode = drawToolbar._modes?.[modeKey];
  if (drawToolbar._activeMode) {
    drawToolbar._activeMode.handler.disable();
  }
  if (mode && mode.handler) {
    mode.handler.enable();
  }
}

function toggleAddFeaturePicker() {
  addFeaturePicker.classList.toggle('hidden');
}

function hideAddFeaturePicker() {
  addFeaturePicker.classList.add('hidden');
}

function toggleDrawer() {
  controlDrawer.classList.toggle('minimized');
}

function restoreBackupIfPresent() {
  const backup = getSavedBackup();
  if (backup) {
    restoreBackupFromObject(backup);
    return true;
  }
  return false;
}

function applyBackupSettings() {
  autoBackupToggle.checked = localStorage.getItem(AUTO_BACKUP_KEY) === '1';
  backupTarget.value = localStorage.getItem('trondheim_warning_map_backup_target') || 'local';
}

async function initializeApp() {
  if (!localStorage.getItem('trondheim_seen_welcome')) {
    welcomeBox.classList.remove('hidden');
  }

  applyBackupSettings();

  const restoredBackup = autoBackupToggle.checked && restoreBackupIfPresent();
  if (!restoredBackup) {
    await loadStarterData();
  }

  renderFeatureList();
}

layerButtons.forEach((button) => {
  button.addEventListener('click', () => {
    layerButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    const layerName = button.dataset.layer;
    if (baseLayers[layerName]) {
      map.removeLayer(activeLayer);
      activeLayer = baseLayers[layerName];
      activeLayer.addTo(map);
    }
  });
});

exportBtn?.addEventListener('click', () => {
  const geojson = drawnItems.toGeoJSON();
  if (!geojson.features.length) {
    setResult('No features to export yet.');
    return;
  }
  const filename = `trondheim-features-${new Date().toISOString().replace(/[:.]/g, '-')}.geojson`;
  downloadGeoJsonFile(filename, geojson);
  setResult(`Exported ${filename}.`);
});

emailBtn?.addEventListener('click', () => {
  const geojson = drawnItems.toGeoJSON();
  if (!geojson.features.length) {
    setResult('No features to email yet.');
    return;
  }
  const emailAddress = emailAddressInput?.value.trim();
  if (!emailAddress) {
    setResult('Enter an email address before sending.');
    emailAddressInput?.focus();
    return;
  }
  const filename = `trondheim-features-${new Date().toISOString().replace(/[:.]/g, '-')}.geojson`;
  downloadGeoJsonFile(filename, geojson);
  const composeUrl = buildEmailComposeUrl(filename, emailAddress);
  window.open(composeUrl, '_blank', 'noopener');
  setResult(`Prepared ${filename}. Opened email compose for ${emailAddress} in a new tab.`);
});

drawerToggle.addEventListener('click', toggleDrawer);
drawerToggle2.addEventListener('click', toggleDrawer);

sortBy.addEventListener('change', (event) => {
  sortOrder = event.target.value;
  renderFeatureList();
});

filterBy.addEventListener('change', (event) => {
  filterType = event.target.value;
  renderFeatureList();
});

toggleInfoBtn.addEventListener('click', () => {
  welcomeBox.classList.toggle('hidden');
});

addFeatureBtn?.addEventListener('click', () => {
  toggleAddFeaturePicker();
});

addFeaturePicker?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-draw-type]');
  if (!button) return;
  const type = button.dataset.drawType;
  enableDrawMode(type);
  hideAddFeaturePicker();
});

minimizedAddBtn?.addEventListener('click', () => {
  minimizedAddPicker?.classList.toggle('hidden');
});

minimizedAddPicker?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-draw-type]');
  if (!button) return;
  const type = button.dataset.drawType;
  enableDrawMode(type);
  minimizedAddPicker.classList.add('hidden');
});

autoBackupToggle?.addEventListener('change', () => {
  localStorage.setItem(AUTO_BACKUP_KEY, autoBackupToggle.checked ? '1' : '0');
  if (autoBackupToggle.checked) {
    saveBackupToStorage();
  } else {
    localStorage.removeItem(BACKUP_KEY);
  }
});

downloadBackup?.addEventListener('click', () => {
  if (backupTarget.value === 'gdrive') {
    downloadBackupFile();
    setResult('Backup file downloaded. Upload it manually to Google Drive.');
  } else {
    downloadBackupFile();
  }
});

backupTarget?.addEventListener('change', () => {
  localStorage.setItem('trondheim_warning_map_backup_target', backupTarget.value);
});

chooseLocalBackupFile?.addEventListener('click', () => {
  requestLocalBackupFileHandle();
});

restoreBackup?.addEventListener('click', () => {
  backupFileInput.click();
});

backupFileInput?.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      restoreBackupFromObject(parsed);
      setResult('Backup restored successfully.');
    } catch {
      setResult('Unable to read backup file.');
    }
  };
  reader.readAsText(file);
});

gotItBtn.addEventListener('click', () => {
  welcomeBox.classList.add('hidden');
  localStorage.setItem('trondheim_seen_welcome', '1');
});

closeWelcome.addEventListener('click', () => {
  welcomeBox.classList.add('hidden');
});

saveForm.addEventListener('click', () => {
  savePendingLayer();
});

cancelForm.addEventListener('click', () => {
  // Only discard the layer when it was a brand-new draw. Editing an existing
  // report must never delete it on cancel.
  if (pendingLayer && pendingIsNew) {
    if (drawnItems.hasLayer(pendingLayer)) {
      drawnItems.removeLayer(pendingLayer);
    } else if (map.hasLayer(pendingLayer)) {
      map.removeLayer(pendingLayer);
    }
  }
  pendingLayer = null;
  pendingIsNew = false;
  featureForm.classList.add('hidden');
  fTitle.value = '';
  fDesc.value = '';
  setFormMode('new');
});

window.addEventListener('keydown', (event) => {
  if (featureForm.classList.contains('hidden')) return;
  if (event.key !== 'Enter') return;
  if (document.activeElement === fTitle) {
    event.preventDefault();
    savePendingLayer();
  } else if (document.activeElement === fDesc && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    savePendingLayer();
  }
});

map.on(L.Draw.Event.CREATED, function (event) {
  const layer = event.layer;
  const type = event.layerType;
  pendingLayer = layer;
  pendingIsNew = true;

  if (type === 'polyline' || type === 'polygon') {
    snapLayerToExistingPath(pendingLayer, false);
  }
  styleLayerAsRoad(pendingLayer);

  pendingLayer.feature = pendingLayer.toGeoJSON();
  pendingLayer.feature.properties = pendingLayer.feature.properties || {};
  pendingLayer.feature.properties.type = type === 'polyline' ? 'line' : type;
  pendingLayer.feature.properties.id = generateFeatureId();
  pendingLayer.feature.properties.created = Date.now();

  setFormMode('new');
  featureForm.classList.remove('hidden');
  fTitle.focus();
});

map.on(L.Draw.Event.DRAWVERTEX, function (event) {
  const layer = event.layer || event.poly || event.target;
  if (layer && (layer instanceof L.Polyline || layer instanceof L.Polygon)) {
    snapLayerToExistingPath(layer, false);
  }
});

map.on(L.Draw.Event.EDITMOVE, function (event) {
  if (event.layers && typeof event.layers.eachLayer === 'function') {
    event.layers.eachLayer((layer) => {
      if (layer instanceof L.Polyline || layer instanceof L.Polygon) {
        snapLayerToExistingPath(layer);
      }
    });
  }
});

map.on(L.Draw.Event.EDITVERTEX, function (event) {
  const layer = event.layer || event.poly || event.target;
  if (layer && (layer instanceof L.Polyline || layer instanceof L.Polygon)) {
    snapLayerToExistingPath(layer);
  }
});

map.on(L.Draw.Event.EDITED, function (event) {
  event.layers.eachLayer((layer) => {
    layer.feature = layer.feature || layer.toGeoJSON();
    layer.feature.properties = layer.feature.properties || {};
    attachPopupAndLabel(layer);
  });
  renderFeatureList();
  maybeAutoBackup();
});

map.on(L.Draw.Event.DELETED, function () {
  renderFeatureList();
  selectedId = null;
  resetLayerStyles();
  maybeAutoBackup();
});

initializeApp();


