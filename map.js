import 'ol/ol.css';

// 📍 Use geographic projection (e.g. lon/lat)
import { useGeographic } from 'ol/proj';

// 🗺️ OpenLayers core
import Map from 'ol/Map';
import View from 'ol/View';
import Overlay from 'ol/Overlay';

// 🧭 Interactions
import { defaults as defaultInteractions } from 'ol/interaction';

// 🧱 Layers & Sources
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM'; // in case you need a fallback base map

// 📌 Features & Geometry
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';

// 🎨 Styling
import { Style, Icon } from 'ol/style';

// 🧩 Mapbox vector style loader
import { apply } from 'ol-mapbox-style';

// 🗺️ Mapbox GL JS
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/lib/mapbox-gl-geocoder.css';

useGeographic();

// —————————————————————————————————————————
// Module‐scope map & view so that apply() can see them
// —————————————————————————————————————————
let map, view;
let currentPopupOverlay = null;
let allGyms = [];
const featureMap = {}; // Map gym slugs to features

// figure out your initial center & state
const { coords, state: initialState } = checkTimeZoneIsInThePerth();

// mapping of state → default zoom
const stateZooms = {
  ALL: 4,
  WA: 9.5,
  NSW: 7,
  SA: 10,
  VIC: 10,
};

document.addEventListener('DOMContentLoaded', () => {
  // —————————————————————————————————————————
  // 1️⃣ Create view & map at your timezone‐based center
  // —————————————————————————————————————————
    map = new mapboxgl.Map({
    container: 'map',                                        // same DOM element id
    style:     'mapbox://styles/mathew-revo/cmbzuv84g006b01soe92r8kg8', // your custom style
    center:    coords,                                       // reuse your coords
    zoom:      stateZooms[initialState],                     // reuse your zoom mapping
    pitch:     60,                                           // tilt for 3D view
    bearing:  -20,                                           // slight rotation
    antialias: true                                          // smooths extrusions
  });
  // 3️⃣ Add zoom+rotate controls
  map.addControl(new mapboxgl.NavigationControl());

  // Add the fill-extrusion layer for 3D buildings
  map.addLayer({
    id:             '3d-buildings',
    source:         'composite',
    'source-layer': 'building',
    filter:         ['==', 'extrude', 'true'],
    type:           'fill-extrusion',
    minzoom:        15,
    paint: {
      'fill-extrusion-color':   '#aaa',
      'fill-extrusion-height':  ['get', 'height'],
      'fill-extrusion-base':    ['get', 'min_height'],
      'fill-extrusion-opacity': 0.6
    }
  }, labelLayerId);
});

  // —————————————————————————————————————————
  // 2️⃣ Mapbox geocoder
  // —————————————————————————————————————————
  mapboxgl.accessToken = 'pk.eyJ1IjoibWF0aGV3LXJldm8iLCJhIjoiY21icm53MWIwMDk2ZDJrc2RlNjJ5cXJ0YSJ9.eOxkjOrS1wBPNM3GA6fDtg';
  const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    placeholder: 'Search address',
    mapboxgl: mapboxgl,
    marker: false,
    flyTo: false,
  });
  document.getElementById('search-container').appendChild(geocoder.onAdd());
  geocoder.on('result', (e) => {
    view.animate({ center: e.result.center, zoom: 14 });
  });

  // —————————————————————————————————————————
  // 3️⃣ Apply Mapbox style **synchronously**
  // —————————————————————————————————————————
   apply(
      map,
      // 1. Your style URL (no template var—hard-code your style ID)
      `https://api.mapbox.com/styles/v1/mathew-revo/cmbzuv84g006b01soe92r8kg8` +
        `?access_token=${mapboxgl.accessToken}`,
      {
        // 2. Base sprite endpoint (no .json/.png suffix)
        sprite:
          `https://api.mapbox.com/styles/v1/mathew-revo/` +
          `cmbzuv84g006b01soe92r8kg8/sprite` +
          `?access_token=${mapboxgl.accessToken}`,

        // 3. HTTPS Fonts API—this MUST be an https:// URL returning .pbf files
        glyphs:
          `https://api.mapbox.com/fonts/v1/mapbox/` +
          `{fontstack}/{range}.pbf` +
          `?access_token=${mapboxgl.accessToken}`
      }
    );







  // —————————————————————————————————————————
  // 4️⃣ Wire up state buttons & load gyms
  // —————————————————————————————————————————
  selectStateChange();
  getStuff(initialState);
});

// —————————————————————————————————————————
// Everything below is verbatim from your file,
// unchanged except it now references module‐scope
// map & view.
// —————————————————————————————————————————

function renderGymPopupContent(item, gymName) {
  return `
    <a href="${item.link || '#'}" class="pr-8 w-fit outline-none text-2xl text-left font-bold text-brandRed hover:underline" tabindex="0">${gymName}</a>
    <div class="flex flex-col gap-2 text-xs sm:text-sm">
      <div class="flex gap-2">
        <svg class="flex-shrink-0 mt-1" xmlns="http://www.w3.org/2000/svg" width="15" height="12.75" viewBox="0 0 15 12.75"><path d="M7.5,15V10.5h3V15h3.75V9H16.5L9,2.25,1.5,9H3.75v6Z" transform="translate(-1.5 -2.25)" fill="#1a171b"></path></svg>
        <span class="font-medium">${item.acf?.custom_address || ''}</span>
      </div>
      <div class="flex items-center gap-2.5">
        <svg class="flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="13.5" height="13.5" viewBox="0 0 13.5 13.5"><path d="M2.25,3.75v3h1.5v-3h3V2.25h-3A1.5,1.5,0,0,0,2.25,3.75Zm1.5,7.5H2.25v3a1.5,1.5,0,0,0,1.5,1.5h3v-1.5h-3Zm10.5,3h-3v1.5h3a1.5,1.5,0,0,0,1.5-1.5v-3h-1.5Zm0-12h-3v1.5h3v3h1.5v-3A1.5,1.5,0,0,0,14.25,2.25Z" transform="translate(-2.25 -2.25)" fill="#1a171b"></path></svg>
        <span class="font-medium">${item.acf?.size || ''}</span>
      </div>
      <div class="flex items-center gap-2.5">
        <svg class="flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="13.5" height="13.5" viewBox="0 0 13.5 13.5"><path d="M4.965,8.093a11.361,11.361,0,0,0,4.943,4.943l1.65-1.65a.746.746,0,0,1,.765-.18A8.555,8.555,0,0,0,15,11.632a.752.752,0,0,1,.75.75V15a.752.752,0,0,1-.75.75A12.749,12.749,0,0,1,2.25,3,.752.752,0,0,1,3,2.25H5.625a.752.752,0,0,1,.75.75A8.52,8.52,0,0,0,6.8,5.677a.753.753,0,0,1-.187.765Z" transform="translate(-2.25 -2.25)" fill="#1a171b"></path></svg>
        <a href="tel:${item.acf?.phone || '1300 738 638'}" class="font-medium">${item.acf?.phone || '1300 738 638'}</a>
      </div>
      <div class="flex items-center gap-2.5">
        <svg class="flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="15" height="12" viewBox="0 0 15 12"><path d="M15,3H3A1.5,1.5,0,0,0,1.507,4.5l-.007,9A1.5,1.5,0,0,0,3,15H15a1.5,1.5,0,0,0,1.5-1.5v-9A1.5,1.5,0,0,0,15,3Zm0,3L9,9.75,3,6V4.5L9,8.25,15,4.5Z" transform="translate(-1.5 -3)" fill="#1a171b"></path></svg>
        <a href="mailto:${(item.title?.rendered || '').toLowerCase().replace(/\s+/g, '')}@revofitness.com.au" class="font-medium">${(item.title?.rendered || '').toLowerCase().replace(/\s+/g, '')}@revofitness.com.au</a>
      </div>
    </div>
    <div class="grid sm:grid-cols-2 gap-2.5">
      <img src="${item.acf?.gallery?.[0]?.url || ''}" alt="" class="aspect-16/9 sm:aspect-4/3 object-cover rounded-md w-full pointer-events-none">
      <img src="${item.acf?.gallery?.[1]?.url || ''}" alt="" class="aspect-16/9 sm:aspect-4/3 object-cover rounded-md w-full pointer-events-none">
    </div>
  `;
}

function checkTimeZoneIsInThePerth() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  switch (tz) {
    case 'Australia/Melbourne':
      return { coords: [144.9631, -37.9136], state: 'VIC' };
    case 'Australia/Sydney':
      return { coords: [151.2093, -33.4688], state: 'NSW' };
    case 'Australia/Adelaide':
      return { coords: [138.61387, -34.92504], state: 'SA' };
    case 'Australia/Perth':
    default:
      return { coords: [115.832409, -31.9295999], state: 'WA' };
  }
}

function selectStateChange() {
  const container = document.getElementById('state-buttons');
  if (!container) return;

  const stateSettings = {
    ALL:  { coords: [135.0, -20.734],        zoom: 4    },
    WA:   { coords: [115.832409, -31.9295999], zoom: 10 },
    NSW:  { coords: [151.2093, -33.8688],     zoom: 7    },
    SA:   { coords: [138.61387, -34.92504],   zoom: 9.5 },
    VIC:  { coords: [144.9631, -37.9136],     zoom: 10   },
  };

  container.querySelectorAll('button[data-state]').forEach(button => {
    button.addEventListener('click', function () {
      // scroll gym list into view if needed
      const gymListEl = document.getElementById('gym-list');
      if (gymListEl) {
        const offsetTop = gymListEl.getBoundingClientRect().top + window.scrollY - 150;
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
      }

      const state = this.getAttribute('data-state');
      const setting = stateSettings[state];

      container.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
      this.classList.add('selected');

      if (setting) {
        view.animate({ center: setting.coords, zoom: setting.zoom, duration: 800 });
      }

      const filteredGyms = state === 'ALL'
        ? allGyms
        : allGyms.filter(g => {
            const stateClass = g.class_list?.find(cls => cls.startsWith('state-'));
            const gymState = stateClass ? stateClass.replace('state-', '').toUpperCase() : '';
            return gymState === state;
          });

      populateGymList(filteredGyms);
    });
  });
}

function getStuff(stateFilter = 'ALL') {
  fetch('https://revofitness.test/wp-json/wp/v2/gyms?acf_format=standard&per_page=70')
    .then(res => res.json())
    .then(data => {
      allGyms = data;
      const filteredGyms = stateFilter === 'ALL'
        ? data
        : data.filter(g => {
            const stateClass = g.class_list?.find(cls => cls.startsWith('state-'));
            const gymState = stateClass ? stateClass.replace('state-', '').toUpperCase() : '';
            return gymState === stateFilter;
          });

      const features = data.map(item => {
        let lat = parseFloat(item.acf?.latitude);
        let lng = parseFloat(item.acf?.longitude);
        // Override for Modbury
        if (item.title?.rendered?.toLowerCase().includes('modbury')) {
          lat = -34.82960547422781;
          lng = 138.69172072516687;
        }
        if (!lat || !lng) return null;

        const slug = item.title?.rendered
          .toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[^\w-]/g, '');

        const feature = new Feature({
          geometry: new Point([lng, lat]),
          name: item.title?.rendered || 'Unnamed Gym',
          data: item,
        });

        feature.setStyle(new Style({
          image: new Icon({
            anchor: [0.5, 0.9],
            anchorXUnits: 'fraction',
            anchorYUnits: 'pixels',
            src: 'https://revofitness.com.au/wp-content/uploads/2025/06/revo-map-pin-50x50-1.png',
          }),
        }));

        featureMap[slug] = feature;
        return feature;
      }).filter(Boolean);

      const vectorSource = new VectorSource({ features });
      const vectorLayer  = new VectorLayer({ source: vectorSource });
      map.addLayer(vectorLayer);

      populateGymList(filteredGyms);

      map.on('singleclick', evt => {
        let clicked = false;
        map.forEachFeatureAtPixel(evt.pixel, feature => {
          if (clicked) return;
          clicked = true;

          const item    = feature.get('data');
          const coords  = feature.getGeometry().getCoordinates();
          const gymName = feature.get('name');

          const overlayEl = document.createElement('div');
          overlayEl.setAttribute('data-info-window', gymName);
          overlayEl.className = 'p-2.5 pt-0 flex flex-col gap-4 max-w-[350px] bg-white';
          overlayEl.innerHTML = renderGymPopupContent(item, gymName);

          if (currentPopupOverlay) {
            map.removeOverlay(currentPopupOverlay);
          }

          currentPopupOverlay = new Overlay({
            element: overlayEl,
            positioning: 'bottom-center',
            stopEvent: true,
            offset: [0, -10],
          });

          map.addOverlay(currentPopupOverlay);
          currentPopupOverlay.setPosition(coords);
        });
      });
    });
}

function populateGymList(gyms) {
  const gymListEl = document.getElementById('gym-list');
  if (!gymListEl) return;

  gyms.sort((a, b) => {
    const nameA = a.title?.rendered?.toLowerCase() || '';
    const nameB = b.title?.rendered?.toLowerCase() || '';
    return nameA.localeCompare(nameB);
  });

  const html = gyms.map(gym => {
    const name       = gym.title?.rendered || 'Unnamed Gym';
    const address    = gym.acf?.custom_address || '';
    const mapLink    = gym.acf?.map_link || '#';
    const gymLink    = gym.link || '#';
    const size       = gym.acf?.size || 'N/A';
    const slug       = name.toLowerCase().replace(/\s+/g, '').replace(/[^\w-]/g, '');
    const state      = gym.class_list?.find(cls => cls.startsWith('state-'))?.replace('state-', '').toUpperCase() || '';
    const isPresale  = gym.acf?.is_presale;
    const isStudio   = gym.acf?.studio_available;

    const presaleBanner = isPresale
      ? `<div class="presale relative w-full xl:relative xl:w-auto xl:absolute xl:top-0 xl:right-0 flex flex-row xl:flex-col bg-brandPink rounded-bl-none rounded-br-none xl:rounded-bl-3xl xl:rounded-br-3xl items-center justify-center p-3.5 gap-1.5 h-fit xl:px-5 xl:ml-auto">
          <svg xmlns="http://www.w3.org/2000/svg" width="70" height="54" fill="none" viewBox="0 0 70 54" class="">
            <path fill="#F392BD" d="M68.809 23.509c-1.224-1.532-2.896-2.22-4.237-2.773-.134-.056-.28-.117-.436-.179.877-1.09 2.029-2.57 2.062-4.65v-.257l-.033-.257c-.296-2.158-1.727-3.79-3.924-4.472-1.274-.396-2.65-.436-3.862-.475-.347-.01-.782-.022-1.163-.05.09-.939.18-2.27-.424-3.622l-.079-.173-.039-.073c-.922-1.772-2.677-2.789-4.807-2.789-1.553 0-3.08.537-4.192.928l-.318.112c-.235.09-.425.156-.581.2a18.98 18.98 0 0 1-.364-.76l-.039-.077C44.914 1.152 42.997.386 41.64.268a6.756 6.756 0 0 0-.475-.022c-2.426 0-4.092 1.503-5.193 2.498-.212.19-.497.447-.715.62-.313-.212-.743-.592-1.034-.843-1.129-.978-2.677-2.326-4.796-2.326-3.431 0-5.097 3.343-5.74 4.768-.324-.078-.715-.195-1.034-.29-.693-.207-1.481-.442-2.325-.587a8.124 8.124 0 0 0-1.548-.157c-2.158 0-3.88 1.057-4.712 2.895-.52 1.152-.565 2.342-.598 3.298 0 .095-.006.185-.011.28-.414.044-.922.05-1.448.061-1.442.022-3.23.045-4.974.866l-.218.101-.202.129c-1.704 1.112-2.252 2.515-2.414 3.498-.386 2.365 1.04 4.164 2.085 5.478l-.285.112c-1.13.447-2.41.956-3.483 1.81-1.945 1.555-2.576 3.83-1.688 6.076l.118.296.173.269c1.274 2.012 3.309 2.822 4.79 3.415.151.061.302.123.453.179-.078.1-.151.195-.213.28-.206.267-.402.53-.58.776-1.242 1.727-1.566 3.711-.884 5.45.654 1.676 2.146 2.873 4.108 3.297 1.174.302 2.32.325 3.337.347.425.011.911.022 1.32.056v.072c0 .789-.006 1.772.318 2.806.665 2.169 2.593 3.516 5.036 3.516.553 0 1.14-.067 1.744-.201.687-.123 1.369-.33 2.029-.531.34-.106.788-.24 1.168-.336.072.14.14.286.2.403.761 1.537 2.175 4.399 5.428 4.399 1.006 0 2.023-.308 3.018-.911.783-.453 1.414-1.007 1.979-1.493.235-.201.548-.475.788-.654.296.201.688.52.978.755 1.112.9 2.493 2.023 4.349 2.236.212.027.43.044.642.044 2.868 0 4.466-2.38 5.165-3.8l.056-.112.044-.118c.13-.318.235-.547.325-.72.302.072.665.178.967.268.665.19 1.414.408 2.325.603a8.35 8.35 0 0 0 1.677.185c2.515 0 4.449-1.47 5.052-3.834v-.029c.218-.855.224-1.665.23-2.313v-.224c.458-.04 1.073-.05 1.497-.056 1.437-.017 3.063-.033 4.572-.699 1.454-.58 2.521-1.67 3.013-3.08.509-1.47.319-3.079-.53-4.549-.386-.727-.878-1.325-1.331-1.861.173-.073.335-.14.475-.201 1.162-.487 2.476-1.029 3.482-2.001 1.006-.884 1.649-2.119 1.766-3.415a4.837 4.837 0 0 0-1.112-3.56l.006.022Z"></path>
            <path fill="#FFCB05" stroke="#333132" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.34" d="M53.667 8.166c.637 1.42-.587 3.454.61 4.712 1.699 2.012 8.054-.341 8.506 2.979-.033 2.13-3.376 3.717-2.61 5.924 1.135 2.04 4.555 2.052 5.986 3.885.632.738.386 1.733-.33 2.308-1.335 1.403-5.477 1.817-5.835 3.985-.05 1.61 1.85 2.896 2.544 4.243.726 1.207.385 2.37-.816 2.822-2.102.973-6.037-.307-7.602 1.554-.872 1.118-.374 2.812-.682 4.075-.335 1.308-1.476 1.414-2.739 1.151-3.951-.844-5.673-2.549-7.472 1.917-.459.934-1.219 2.046-2.326 1.878-1.755-.173-3.41-2.76-5.354-3.107-2.018-.296-3.331 1.827-4.896 2.716-2.94 1.822-3.349-2.576-4.88-4.024-1.28-1.185-4.12.296-5.891.587-1.42.324-2.532.09-2.862-.978-.475-1.504.397-3.7-1.157-4.701-1.85-.995-4.348-.369-6.288-.894-1.878-.375-2.353-1.9-1.235-3.443 1.14-1.61 3.398-3.812.956-5.36-1.599-1.13-4.192-1.359-5.293-3.102-1.062-2.678 3.722-3.248 5.27-4.427 4.125-2.627-4.454-6.053-.804-8.44 1.81-.85 4.096-.33 6.025-.727 1.062-.167 2-.782 2.241-1.9.397-2.113-.564-5.025 2.968-4.349 2.8.481 5.623 2.47 6.987-.86 3.359-7.658 5.628 2.14 9.826 0 1.615-.788 2.906-3.074 4.823-2.912.872.072 1.57 1.196 1.95 1.973 1.225 2.671 1.968 3.577 5.26 2.325 1.683-.587 4.187-1.57 5.081.14l.028.061.011-.011Z"></path>
            <path fill="#EF4136" stroke="#333132" stroke-miterlimit="10" stroke-width="1.34" d="M46.178 39.103h-6.551a.976.976 0 0 1-.81-.436l-4.863-7.322a.975.975 0 0 0-.81-.436h-1.398a.973.973 0 0 0-.973.972v6.25a.973.973 0 0 1-.972.972h-5.6a.973.973 0 0 1-.973-.973v-4.013a.99.99 0 0 1 .184-.57l6.668-9.172a.974.974 0 0 1 .783-.403h4.577c2.102 0 3.304-.96 3.304-2.632v-.073c0-1.576-.878-2.437-2.678-2.632h-.016a.973.973 0 0 1-.682-1.537l3.387-4.656a.979.979 0 0 1 1.056-.364c4.159 1.213 6.545 4.455 6.545 8.893v.073c0 3.454-1.425 6.176-4.069 7.858a.965.965 0 0 0-.285 1.364l4.964 7.31a.97.97 0 0 1-.805 1.516l.017.01Z"></path>
          </svg>
          <span class="supertitle uppercase font-extrabold text-center !text-sm !text-brandBlack">Presale</span>
        </div>`
      : '';

    const studioBanner = isStudio
      ? `<svg width="96" height="27" viewBox="0 0 96 27" fill="none" xmlns="http://www.w3.org/2000/svg" class="">
        <rect x="1.10919" y="1.47955" width="93.4182" height="24.9679" rx="12.4839" stroke="black" stroke-width="1.08556"></rect>
        <path d="M24.8879 20.5512L24.4041 19.5144C24.1844 19.0478 24.0234 18.7847 24.0234 18.5216C24.0234 18.2438 24.2138 18.0981 24.4041 18.0981C24.5945 18.0981 24.7554 18.2291 24.9605 18.4336C25.8387 19.2806 26.9376 20.0543 28.1524 20.0543C28.9285 20.0543 29.3828 19.6601 29.3828 19.1926C29.3828 18.55 28.5184 18.4189 27.3625 18.1568C25.7808 17.8066 24.1853 17.208 24.1853 15.6899C24.1853 14.3763 25.3863 13.4569 26.9828 13.4569C27.8178 13.4569 28.4762 13.6907 28.7401 13.6907C29.0335 13.6907 29.0335 13.3992 29.3701 13.3992C29.7066 13.3992 29.8528 13.677 30.0442 13.9685L30.5858 14.8155C30.7909 15.1217 30.9665 15.4435 30.9665 15.6626C30.9665 15.8817 30.8056 16.0274 30.6299 16.0274C30.4101 16.0274 30.2492 15.867 30.0589 15.7066C29.2386 15.0209 28.1995 14.4663 27.2909 14.4663C26.7051 14.4663 26.3097 14.7441 26.3097 15.1383C26.3097 15.7369 27.0711 15.868 28.2721 16.1604C29.9127 16.5399 31.5081 17.0358 31.5081 18.6712C31.5081 20.2186 30.0294 21.0794 28.1691 21.0794C27.1437 21.0794 26.5285 20.8172 26.2508 20.8172C25.8848 20.8172 25.8554 21.1967 25.4894 21.1967C25.1822 21.1967 25.0203 20.8466 24.8889 20.5541L24.8879 20.5512ZM37.9782 19.5144C37.9782 19.7482 37.8173 20.0103 37.6122 20.2147C37.1 20.74 36.3671 21.1058 35.3427 21.1058C34.0975 21.1058 33.1458 20.3908 33.1458 19.5144C33.1458 19.2082 33.2046 18.0844 33.2046 17.0769V14.7118H32.4285C32.1067 14.7118 31.8869 14.5367 31.8869 14.259C31.8869 13.9675 32.0772 13.8208 32.3843 13.6457C33.3214 13.1635 33.7904 12.6969 34.2732 11.6894C34.6097 11.1495 34.7422 10.9157 35.0346 10.9157C35.2544 10.9157 35.4006 11.0615 35.4006 11.441V13.6163H37.4651C37.6996 13.6163 37.831 13.7337 37.831 13.9665C37.831 14.0839 37.8016 14.258 37.7869 14.346C37.7427 14.5944 37.626 14.7108 37.3915 14.7108H35.3996V18.3455C35.3996 19.4694 35.7656 19.7618 36.2788 19.7618C36.63 19.7618 36.8793 19.5868 37.1864 19.3237C37.2884 19.2366 37.4209 19.1192 37.5965 19.1192C37.8458 19.1192 37.9772 19.309 37.9772 19.5134L37.9782 19.5144ZM47.7737 19.9966C47.7737 20.4054 47.4224 20.5365 46.1919 20.7996C45.3569 20.9894 45.0645 21.0334 44.9036 21.0334C44.5671 21.0334 44.4346 20.7556 44.4346 20.4348V19.6464C43.9656 20.4201 43.1315 21.0911 41.9011 21.0911C40.3636 21.0911 39.3676 20.0983 39.3676 18.2888V16.0264C39.3676 15.107 38.2834 15.3838 38.2834 14.7862C38.2834 14.4213 38.6347 14.2609 39.7768 13.8814C40.7433 13.5459 40.9631 13.5019 41.0946 13.5019C41.49 13.5019 41.5636 13.8667 41.5636 14.2169V17.6765C41.5636 18.859 41.9737 19.443 42.8813 19.443C43.628 19.443 44.4336 18.9177 44.4336 17.4721V16.0274C44.4336 15.108 43.2032 15.4141 43.2032 14.7871C43.2032 14.437 43.5692 14.2766 44.8428 13.8677C45.7651 13.5616 46.0438 13.5029 46.1753 13.5029C46.5854 13.5029 46.6296 13.897 46.6296 14.2179V18.6556C46.6296 19.5897 47.7717 19.4586 47.7717 19.9986L47.7737 19.9966ZM57.5995 19.8499C57.5995 20.2 57.2335 20.3751 56.1208 20.7409C55.2132 21.0618 54.9934 21.1058 54.8472 21.1058C54.4371 21.1058 54.3929 20.6823 54.3929 20.3908V19.7188C53.8513 20.5218 52.9437 21.1498 51.6985 21.1498C49.8676 21.1498 48.3742 19.7628 48.3742 17.3987C48.3742 15.0346 50.0579 13.3845 52.2696 13.3845C53.1625 13.3845 53.8807 13.6623 54.3929 14.0995V12.3477C54.3929 11.4136 53.2655 11.8655 53.2655 11.1798C53.2655 10.859 53.6315 10.6683 54.7736 10.2017C55.7548 9.80754 55.9893 9.77819 56.1355 9.77819C56.5015 9.77819 56.5898 10.099 56.5898 10.4785V18.595C56.5898 19.5144 57.6005 19.2522 57.6005 19.8499H57.5995ZM54.3929 17.5728V17.0622C54.3929 15.5882 53.4559 14.4937 52.402 14.4937C51.3482 14.4937 50.7036 15.3554 50.7036 16.7708C50.7036 18.5226 51.6995 19.6171 52.7101 19.6171C53.6178 19.6171 54.3939 18.8287 54.3939 17.5728H54.3929ZM58.3158 20.5512C58.3158 19.9673 59.1802 20.2881 59.1802 19.2082V16.1281C59.1802 15.194 58.2138 15.6029 58.2138 14.9603C58.2138 14.6394 58.5797 14.435 59.6198 13.9821C60.5863 13.5439 60.762 13.4999 60.9229 13.4999C61.2741 13.4999 61.3772 13.7914 61.3772 14.2003V19.2073C61.3772 20.2871 62.2416 19.9663 62.2416 20.5502C62.2416 20.74 62.0954 20.9591 61.7579 20.9591C61.4203 20.9591 61.0112 20.915 60.2792 20.915C59.5472 20.915 59.1665 20.9591 58.8152 20.9591C58.464 20.9591 58.3178 20.7546 58.3178 20.5502L58.3158 20.5512ZM58.6818 11.5593C58.6818 10.8297 59.4579 10.0413 60.4686 10.0413C61.0838 10.0413 61.6107 10.4355 61.6107 11.0194C61.6107 11.7344 60.761 12.4798 59.765 12.4798C59.1204 12.4798 58.6818 12.1149 58.6818 11.5603V11.5593ZM62.9579 17.3684C62.9579 15.0473 64.8173 13.3248 67.4244 13.3248C70.0315 13.3248 71.6132 14.9896 71.6132 17.1786C71.6132 19.5437 69.6949 21.2075 67.1467 21.2075C64.5985 21.2075 62.9579 19.5437 62.9579 17.3684ZM69.2406 17.7772C69.2406 16.3032 68.3909 14.435 67.0152 14.435C65.9467 14.435 65.3315 15.2967 65.3315 16.7708C65.3315 18.2448 66.1665 20.0993 67.5568 20.0993C68.6401 20.0993 69.2406 19.2376 69.2406 17.7782V17.7772ZM25.7572 8.36774H25.1195V10.4648C25.1195 11.0361 25.2205 11.2385 25.8377 11.2385C25.9172 11.2385 25.9682 11.2385 25.9682 11.3686C25.9682 11.5349 25.5404 11.5711 25.3304 11.5711C24.8879 11.5711 24.518 11.4772 24.518 10.6458V8.36872H24.1834C24.0745 8.36872 24.0234 8.32569 24.0234 8.24548C24.0234 8.14376 24.1255 8.0792 24.2118 8.03616C24.5454 7.86304 24.6465 7.71827 24.7054 7.28399C24.7417 7.03848 24.7417 6.85753 24.9154 6.85753C25.0674 6.85753 25.1185 6.88687 25.1185 7.07467V8.01464H25.8877C25.9525 8.01464 26.0035 8.03616 26.0035 8.12322C26.0035 8.31101 25.8514 8.36872 25.7572 8.36872V8.36774ZM29.5575 11.5564H28.8971C28.7951 11.5564 28.6283 11.5202 28.6283 11.3755C28.6283 11.3393 28.6498 11.2816 28.7225 11.2816C28.8235 11.2816 28.9256 11.2816 28.9256 10.9343V9.34391C28.9256 8.75801 28.8382 8.38926 28.3457 8.38926C27.7148 8.38926 27.3596 9.08373 27.3596 9.71266V10.9343C27.3596 11.2816 27.4538 11.2816 27.5558 11.2816C27.6353 11.2816 27.6578 11.3393 27.6578 11.3755C27.6578 11.5202 27.5342 11.5564 27.39 11.5564H26.7296C26.6207 11.5564 26.4617 11.5202 26.4617 11.3755C26.4617 11.3393 26.4833 11.2816 26.5559 11.2816C26.658 11.2816 26.7591 11.2816 26.7591 10.9343V6.95143C26.7591 6.64039 26.6864 6.6042 26.5559 6.6042C26.4833 6.6042 26.4617 6.55333 26.4617 6.50247C26.4617 6.36554 26.6217 6.32935 26.7375 6.32935H27.1947C27.3615 6.32935 27.3615 6.52497 27.3615 6.66875V8.76584C27.6225 8.27385 28.1808 7.92661 28.6086 7.92661C29.1748 7.92661 29.53 8.12908 29.53 9.03287V10.9343C29.53 11.2816 29.6242 11.2816 29.7262 11.2816C29.8057 11.2816 29.8283 11.3393 29.8283 11.3755C29.8283 11.5202 29.7047 11.5564 29.5594 11.5564H29.5575ZM33.082 9.77819H31.0293C31.0293 10.4648 31.2618 11.2532 32.0743 11.2532C32.5453 11.2532 32.7778 11.0507 32.9956 10.7612C33.0251 10.7103 33.083 10.638 33.1624 10.638C33.2351 10.638 33.3077 10.681 33.3077 10.768C33.3077 10.8404 33.3008 10.8698 33.2714 10.9197C33.0467 11.3676 32.5462 11.6503 31.9438 11.6503C31.0303 11.6503 30.3768 11.0214 30.3768 9.84275C30.3768 8.59956 30.993 7.92661 31.9212 7.92661C32.8494 7.92661 33.3499 8.55554 33.3499 9.3801C33.3499 9.7195 33.2046 9.77819 33.082 9.77819ZM31.8996 8.23863C31.1745 8.23863 31.0362 8.99765 31.0362 9.32337C31.0362 9.4603 31.0577 9.4603 31.1735 9.4603H32.4432C32.6532 9.4603 32.6826 9.40944 32.6826 9.18545C32.6826 8.76584 32.5011 8.23863 31.8996 8.23863Z" fill="#333132"></path>
      </svg>`
      : '';

    return `<div id="${slug}" data-gym="${name}" data-state="${state}" class="max-lg:snap-center max-lg:w-full max-lg:flex-shrink-0 max-md:px-6 mb-4 ml-4 mr-4">
      <div class="relative rounded-2xl bg-white overflow-hidden bg-brandOffWhite">
        ${presaleBanner}
        <div class="flex flex-col text-brandBlack">
          <div class="flex gap-10">
            <div class="w-full flex flex-col gap-2 font-semibold text-sm px-5 pt-5">
              <div class="flex gap-4 mb-1 max-sm:justify-between">
                <span class="is-h5 font-bold text-left text-black">${name}</span>
                ${studioBanner}
              </div>
              <div class="flex gap-3 text-left xl:gap-6">
                <div class="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded-full border border-brandBlack">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="12" fill="none" viewBox="0 0 14 12">
                    <path fill="#333132" stroke="#333132" stroke-width=".2" d="M11.182 11.812H8.558a.684.684 0 0 1-.682-.682V7.142a.115.115 0 0 0-.115-.115h-1.59a.115.115 0 0 0-.115.115v3.988a.683.683 0 0 1-.682.682H2.75a.684.684 0 0 1-.682-.682V5.829h-.577a.514.514 0 0 1-.493-.352.514.514 0 0 1 .17-.582L6.499.69a.756.756 0 0 1 .941 0l5.329 4.205c.176.141.245.37.17.582a.518.518 0 0 1-.492.352h-.578v5.3a.683.683 0 0 1-.682.683h-.004Zm-5.01-5.354h1.59c.374 0 .681.307.681.682v3.988c0 .063.051.115.115.115h2.624a.115.115 0 0 0 .115-.115V5.782c0-.288.234-.522.522-.522h.497L7.088 1.13a.192.192 0 0 0-.24 0L1.622 5.26h.496c.288 0 .522.234.522.522v5.346c0 .063.052.115.115.115h2.624a.115.115 0 0 0 .115-.115V7.14c0-.377.305-.682.682-.682h-.004Z"></path>
                  </svg>
                </div>
                <a href="${mapLink}" target="_blank" class="!text-sm underline max-w-[290px]">${address}</a>
              </div>
              <div class="flex items-center gap-3 xl:gap-6">
                <div class="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded-full border border-brandBlack">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="13" fill="none" viewBox="0 0 14 13">
                    <path fill="#333132" stroke="#333132" stroke-width=".2" d="M5.27 11.04H2.784a.685.685 0 0 1-.686-.686V7.866a.309.309 0 1 1 .618 0v2.488c0 .037.03.067.068.067H5.27a.309.309 0 1 1 0 .618ZM9.794 11.04H6.78a.309.309 0 1 1 0-.618h3.015a.309.309 0 1 1 0 .617Z"></path>
                    <path fill="#333132" stroke="#333132" stroke-width=".2" d="M8.663 12.169a.309.309 0 0 1-.218-.527l.913-.912-.913-.91a.308.308 0 1 1 .436-.437l1.132 1.13a.31.31 0 0 1 0 .436L8.88 12.078c-.06.06-.139.09-.218.09ZM2.406 6.667a.309.309 0 0 1-.309-.309V3.342a.309.309 0 1 1 .618 0v3.016a.31.31 0 0 1-.309.31Z"></path>
                    <path fill="#333132" stroke="#333132" stroke-width=".2" d="M3.535 4.78a.308.308 0 0 1-.218-.09l-.91-.913-.912.913a.308.308 0 1 1-.436-.437l1.129-1.131a.31.31 0 0 1 .437 0l1.129 1.131a.309.309 0 0 1-.219.527ZM12.283 11.04h-.98a.309.309 0 1 1 0-.618h.98c.037 0 .067-.03.067-.068v-9.5a.067.067 0 0 0-.067-.067h-9.5a.067.067 0 0 0-.068.067v.98a.309.309 0 1 1-.618 0v-.98c0-.379.307-.685.686-.685h9.5c.378 0 .685.306.685.685v9.5a.685.685 0 0 1-.685.686ZM3.703 9.332V7.408c0-.037.03-.067.067-.067h.555c.033 0 .063.016.063.072l.016.207a.649.649 0 0 1 .576-.328c.251 0 .454.12.572.344a.696.696 0 0 1 .63-.344c.448 0 .727.316.727.853v1.19c0 .036-.03.067-.068.067H6.27a.067.067 0 0 1-.067-.068v-1.02c0-.248-.084-.374-.275-.374-.19 0-.274.126-.274.374v1.02c0 .037-.03.068-.067.068h-.562c-.047 0-.077-.03-.077-.068v-1.02c0-.248-.08-.374-.27-.374-.176 0-.274.126-.274.374v1.02c0 .037-.03.068-.067.068h-.572a.067.067 0 0 1-.067-.068l.005-.002Z"></path>
                    <path fill="#333132" stroke="#333132" stroke-width=".2" d="M7.248 7.961v-.265c0-.016.005-.03.016-.046l.504-.495c.06-.058.186-.17.186-.314 0-.118-.086-.197-.218-.197-.121 0-.195.072-.26.153-.021.026-.038.019-.058-.002l-.189-.188a.043.043 0 0 1-.007-.054.652.652 0 0 1 .551-.286c.344 0 .583.226.583.537 0 .26-.17.411-.225.467l-.393.381h.581c.02 0 .04.016.04.04v.27a.04.04 0 0 1-.04.039H7.285a.04.04 0 0 1-.04-.04h.003Z"></path>
                  </svg>
                </div>
                <span class="!text-sm">${size} sq/m</span>
              </div>
            </div>
          </div>
          <div class="grid mt-auto gap-4 max-sm:pt-3 p-5">
            <div class="grid sm:grid-cols-2 gap-2 sm:gap-4">
              <span class="is-button after:!hidden text-sm px-4 py-2 w-full justify-center view-map-button" data-slug="${slug}">View On Map</span>
              <a href="${gymLink}" class="is-button-outline after:!hidden text-sm px-4 py-2 w-full justify-center">Gym Info</a>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  gymListEl.innerHTML = html;

  // Add event listeners to each "View On Map" button
  document.querySelectorAll('.view-map-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const slug    = btn.getAttribute('data-slug');
      const feature = featureMap[slug];
      if (!feature) return;

      const coords = feature.getGeometry().getCoordinates();
      view.animate({ center: coords, zoom: 13, duration: 800 });

      // remove any existing overlay
      if (currentPopupOverlay) {
        map.removeOverlay(currentPopupOverlay);
        currentPopupOverlay = null;
      }

      // show popup for this feature
      const overlayEl = document.createElement('div');
      overlayEl.setAttribute('data-info-window', feature.get('name'));
      overlayEl.className = 'p-2.5 pt-0 flex flex-col gap-4 max-w-[350px] bg-white';
      overlayEl.innerHTML = renderGymPopupContent(feature.get('data'), feature.get('name'));

      currentPopupOverlay = new Overlay({
        element: overlayEl,
        positioning: 'bottom-center',
        stopEvent: true,
        offset: [0, -10],
      });

      map.addOverlay(currentPopupOverlay);
      currentPopupOverlay.setPosition(coords);
    });
  });
}
