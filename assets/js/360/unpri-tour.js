
(function () {
  'use strict';

  var root = document.getElementById('unpri-tour');
  if (!root || root.getAttribute('data-ready')) return;

  var configUrl = root.getAttribute('data-config-url');
  var status = document.getElementById('ut-status');

  if (!window.pannellum || !window.fetch || !configUrl) {
    if (status) status.textContent = 'Virtual Tour tidak dapat dimuat.';
    return;
  }

  root.setAttribute('data-ready', 'loading');

  fetch(configUrl, { cache: 'no-cache', mode: 'cors' })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (config) {
      if (!Array.isArray(config.scenes) || !config.scenes.length) {
        throw new Error('Konfigurasi scene tidak valid.');
      }

      initializeTour(config);
      root.setAttribute('data-ready', 'true');
    })
    .catch(function (error) {
      root.removeAttribute('data-ready');
      if (status) {
        status.textContent = 'Gagal memuat Virtual Tour. Silakan refresh halaman.';
      }
      console.error('[UNPRI Tour]', error);
    });

  function initializeTour(config) {
    var select = document.getElementById('ut-location');
    var shortcuts = root.querySelector('.ut-shortcuts');
    var lift = root.querySelector('.ut-floor-lift');
    var sceneTitle = document.getElementById('ut-scene-title');
    var area = document.getElementById('ut-area');
    var toggle = document.getElementById('ut-auto');
    var reset = document.getElementById('ut-reset');
    var retry = document.getElementById('ut-retry');
    var panorama = document.getElementById('ut-panorama');

    var scenes = {};
    var metadata = {};
    var shortcutButtons = [];
    var floorButtons = [];
    var allButtons = [];
    var floors = config.floors || [];
    var base = config.panoramaBase || '';

    var loaded = false;
    var busy = true;
    var enabled = true;
    var rotating = false;
    var visible = true;
    var held = false;
    var pointers = {};
    var keys = {};
    var timer = null;
    var motion = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

    if (motion && motion.matches) enabled = false;

    function imageUrl(image) {
      return new URL(image, base).href;
    }

    function setStatus(message) {
      if (status && status.textContent !== message) {
        status.textContent = message;
      }
    }

    function makeElement(tag, className, text) {
      var element = document.createElement(tag);
      if (className) element.className = className;
      if (text != null) element.textContent = text;
      return element;
    }

    config.scenes.forEach(function (item) {
      if (!item.id || !item.image || scenes[item.id]) {
        throw new Error('Scene tidak valid atau duplikat: ' + item.id);
      }

      metadata[item.id] = {
        title: item.title || item.id,
        area: item.area || '',
        floorId: item.floorId || null
      };

      scenes[item.id] = {
        type: 'equirectangular',
        panorama: imageUrl(item.image),
        pitch: item.pitch == null ? 0 : item.pitch,
        yaw: item.yaw == null ? 0 : item.yaw,
        hfov: item.hfov == null ? 100 : item.hfov,
        hotSpots: (item.hotSpots || []).map(function (spot) {
          return {
            pitch: spot.pitch,
            yaw: spot.yaw,
            type: 'scene',
            sceneId: spot.sceneId,
            cssClass: 'ut-nav-hotspot'
          };
        })
      };
    });

    var firstScene = config.firstScene || config.scenes[0].id;

    if (!scenes[firstScene]) {
      throw new Error('firstScene tidak ditemukan: ' + firstScene);
    }

    Object.keys(scenes).forEach(function (id) {
      var option = makeElement('option', null, metadata[id].title);
      option.value = id;
      select.appendChild(option);

      scenes[id].hotSpots.forEach(function (spot) {
        if (!scenes[spot.sceneId]) {
          throw new Error('Target hotspot tidak ditemukan: ' + spot.sceneId);
        }

        spot.text = 'Ke ' + metadata[spot.sceneId].title;
        spot.createTooltipFunc = navigationTooltip;
        spot.createTooltipArgs = { label: spot.text };
      });
    });

    function navigationTooltip(element, args) {
      element.innerHTML =
        '<svg class="ut-nav-chevron" viewBox="0 0 48 32" ' +
        'aria-hidden="true" focusable="false">' +
        '<path d="M7 24 L24 11 L41 24" ' +
        'fill="none" stroke="white" stroke-width="6" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';

      element.setAttribute('role', 'link');
      element.setAttribute('tabindex', '0');
      element.setAttribute('aria-label', args.label);
      element.setAttribute('title', args.label);

      element.addEventListener('keydown', function (event) {
        if (event.keyCode === 13 || event.keyCode === 32) {
          event.preventDefault();
          event.stopPropagation();
          element.click();
        }
      });
    }

    function addShortcut(id, label) {
      if (!scenes[id] || !shortcuts) return;

      var button = makeElement('button', 'ut-location-button', label);
      button.type = 'button';
      button.disabled = true;
      button.setAttribute('data-scene', id);
      button.setAttribute('aria-pressed', 'false');

      button.addEventListener('click', function () {
        chooseScene(id);
      });

      shortcuts.appendChild(button);
      shortcutButtons.push(button);
      allButtons.push(button);
    }

    (config.shortcuts || []).forEach(function (item) {
      addShortcut(item.sceneId, item.label);
    });

    function floorForScene(id) {
      var item = metadata[id];
      if (!item) return null;

      if (item.floorId) return String(item.floorId);

      if (item.area === 'Mall') return 'mall';
      if (item.area === 'Lantai 10') return '10';
      if (item.area === 'Lantai 12') return '12';

      return null;
    }

    function buildLift() {
      if (!lift) return;

      lift.innerHTML = '';
      floorButtons = [];

      var validFloors = floors.filter(function (floor) {
        return floor.id != null && scenes[floor.sceneId];
      });

      if (validFloors.length < 2) {
        lift.hidden = true;
        return;
      }

      var heading = makeElement('span', 'ut-lift-heading', 'LIFT');
      lift.appendChild(heading);

      validFloors.slice().reverse().forEach(function (floor) {
        var button = makeElement('button', 'ut-lift-floor', floor.label);
        button.type = 'button';
        button.disabled = true;
        button.title = floor.title;
        button.setAttribute('data-floor', String(floor.id));
        button.setAttribute('data-scene', floor.sceneId);
        button.setAttribute('aria-label', 'Menuju ' + floor.title);
        button.setAttribute('aria-pressed', 'false');

        button.addEventListener('click', function () {
          chooseScene(floor.sceneId);
        });

        lift.appendChild(button);
        floorButtons.push(button);
        allButtons.push(button);
      });

      var footer = makeElement('span', 'ut-lift-footer', 'UNPRI');
      lift.appendChild(footer);
    }

    function syncLift(id) {
      if (!lift) return;

      var currentFloor = floorForScene(id);
      var hasFloors = floorButtons.length > 1;

      lift.hidden = !currentFloor || !hasFloors;

      floorButtons.forEach(function (button) {
        var active =
          button.getAttribute('data-floor') === currentFloor;

        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
        button.setAttribute('aria-current', active ? 'location' : 'false');
      });
    }

    buildLift();

    var viewer = window.pannellum.viewer('ut-panorama', {
      default: {
        firstScene: firstScene,
        autoLoad: true,
        crossOrigin: 'anonymous',
        sceneFadeDuration: motion && motion.matches ? 0 : 500,
        autoRotate: false,
        autoRotateInactivityDelay: -1,
        minHfov: 50,
        maxHfov: 110,
        showControls: true,
        showZoomCtrl: true,
        showFullscreenCtrl: true,
        compass: false,
        mouseZoom: 'fullscreenonly'
      },
      scenes: scenes
    });

    function controls(isBusy) {
      busy = isBusy;

      if (select) select.disabled = isBusy;
      if (toggle) toggle.disabled = isBusy || !loaded;
      if (reset) reset.disabled = isBusy || !loaded;

      allButtons.forEach(function (button) {
        button.disabled = isBusy;
      });

      panorama.setAttribute('aria-busy', String(isBusy));
    }

    function syncScene(id) {
      if (!metadata[id]) return;

      select.value = id;
      sceneTitle.textContent = metadata[id].title;
      area.textContent = metadata[id].area;

      shortcutButtons.forEach(function (button) {
        var active =
          button.getAttribute('data-scene') === id;

        button.setAttribute('aria-pressed', String(active));
      });

      syncLift(id);
    }

    function updateAutoButton() {
      toggle.textContent = enabled
        ? 'Putar otomatis: aktif'
        : 'Putar otomatis';

      toggle.setAttribute('aria-pressed', String(enabled));
    }

    function stop() {
      window.clearTimeout(timer);
      timer = null;

      if (rotating) viewer.stopAutoRotate();
      rotating = false;
    }

    function canRotate() {
      return loaded &&
        !busy &&
        enabled &&
        visible &&
        !held &&
        !Object.keys(keys).length &&
        !document.hidden &&
        document.hasFocus();
    }

    function activity() {
      stop();

      if (!loaded || busy) return;

      setStatus(enabled
        ? 'Putar otomatis aktif · dimulai setelah 8 detik tanpa aktivitas.'
        : 'Putar otomatis nonaktif · geser panorama untuk menjelajah.');

      if (!canRotate()) return;

      timer = window.setTimeout(function () {
        timer = null;
        if (!canRotate()) return;

        viewer.startAutoRotate(1, viewer.getPitch());
        rotating = true;

        setStatus('Panorama berputar perlahan · gerakkan untuk berhenti.');
      }, 3000);
    }

    function resetInteraction() {
      held = false;
      pointers = {};
      keys = {};
      stop();
    }

    function chooseScene(id) {
      if (!scenes[id]) return;
      if (busy) return;
      if (loaded && viewer.getScene() === id) return;

      stop();
      loaded = false;
      retry.hidden = true;

      controls(true);
      syncScene(id);
      setStatus('Memuat ' + metadata[id].title + '...');

      viewer.loadScene(id);
    }

    viewer.on('load', function () {
      loaded = true;
      retry.hidden = true;

      syncScene(viewer.getScene());
      controls(false);
      activity();
    });

    viewer.on('scenechange', function (id) {
      stop();
      loaded = false;
      retry.hidden = true;

      controls(true);
      syncScene(id);
      setStatus('Memuat ' + metadata[id].title + '...');
    });

    viewer.on('error', function () {
      stop();
      loaded = false;
      controls(false);

      retry.hidden = false;
      setStatus('Panorama gagal dimuat. Pilih lokasi lain atau coba lagi.');
    });

    select.addEventListener('change', function () {
      chooseScene(select.value);
    });

    retry.addEventListener('click', function () {
      var id = select.value;
      if (!scenes[id]) return;

      stop();
      loaded = false;
      retry.hidden = true;

      controls(true);
      setStatus('Memuat ulang ' + metadata[id].title + '...');

      viewer.loadScene(id);
    });

    reset.addEventListener('click', function () {
      if (!loaded) return;

      activity();

      var scene = scenes[viewer.getScene()];
      if (!scene) return;

      viewer.lookAt(
        scene.pitch,
        scene.yaw,
        scene.hfov,
        motion && motion.matches ? 0 : 600
      );
    });

    toggle.addEventListener('click', function () {
      enabled = !enabled;
      updateAutoButton();
      activity();
    });

    ['mousemove', 'touchmove', 'wheel', 'scroll', 'focusin']
      .forEach(function (name) {
        document.addEventListener(name, activity, false);
      });

    if (window.PointerEvent) {
      document.addEventListener('pointerdown', function (event) {
        pointers[event.pointerId] = true;
        held = true;
        activity();
      });

      ['pointerup', 'pointercancel'].forEach(function (name) {
        document.addEventListener(name, function (event) {
          delete pointers[event.pointerId];
          held = Object.keys(pointers).length > 0;
          activity();
        });
      });
    } else {
      document.addEventListener('mousedown', function () {
        held = true;
        activity();
      });

      document.addEventListener('mouseup', function () {
        held = false;
        activity();
      });

      document.addEventListener('touchstart', function () {
        held = true;
        activity();
      });

      document.addEventListener('touchend', function (event) {
        held = event.touches.length > 0;
        activity();
      });

      document.addEventListener('touchcancel', function () {
        held = false;
        activity();
      });
    }

    document.addEventListener('keydown', function (event) {
      keys[event.keyCode] = true;
      activity();
    });

    document.addEventListener('keyup', function (event) {
      delete keys[event.keyCode];
      activity();
    });

    document.addEventListener('visibilitychange', function () {
      resetInteraction();
      if (!document.hidden) activity();
    });

    window.addEventListener('blur', resetInteraction);
    window.addEventListener('focus', activity);
    window.addEventListener('pagehide', resetInteraction);
    window.addEventListener('pageshow', activity);

    if (window.IntersectionObserver) {
      var observer = new window.IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        activity();
      }, { threshold: 0 });

      observer.observe(panorama);
    }

    if (window.ResizeObserver) {
      var sizeObserver = new window.ResizeObserver(function () {
        viewer.resize();
      });

      sizeObserver.observe(panorama);
    }

    syncScene(firstScene);
    controls(true);
    updateAutoButton();
  }
}());
