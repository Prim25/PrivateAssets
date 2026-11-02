
(function () {
  'use strict';

  var root = document.getElementById('unpri-tour');
  if (!root || root.getAttribute('data-ready')) return;

  var configUrl = root.getAttribute('data-config-url');
  var status = document.getElementById('ut-status');

  if (!window.pannellum || !window.fetch || !configUrl) {
    status.textContent = 'Virtual Tour tidak dapat dimuat.';
    return;
  }

  root.setAttribute('data-ready', 'loading');

  fetch(configUrl, { cache: 'no-cache', mode: 'cors' })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.json();
    })
    .then(function (config) {
      if (!config.scenes || !Array.isArray(config.scenes) ||
          !config.scenes.length) {
        throw new Error('Konfigurasi scene tidak valid.');
      }
      initializeTour(config);
      root.setAttribute('data-ready', 'true');
    })
    .catch(function (error) {
      root.removeAttribute('data-ready');
      status.textContent =
        'Gagal memuat konfigurasi Virtual Tour. Silakan refresh halaman.';
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
    var sceneButtons = [];
    var base = config.panoramaBase || '';

    config.scenes.forEach(function (item) {
      if (!item.id || !item.image || scenes[item.id]) {
        throw new Error('ID atau image scene tidak valid: ' + item.id);
      }

      metadata[item.id] = {
        title: item.title || item.id,
        area: item.area || ''
      };

      scenes[item.id] = {
        type: 'equirectangular',
        panorama: new URL(item.image, base).href,
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
      throw new Error('firstScene tidak ditemukan.');
    }

    Object.keys(scenes).forEach(function (id) {
      var option = document.createElement('option');
      option.value = id;
      option.textContent = metadata[id].title;
      select.appendChild(option);

      scenes[id].hotSpots.forEach(function (spot) {
        if (!metadata[spot.sceneId]) {
          throw new Error('Target hotspot tidak ditemukan: ' + spot.sceneId);
        }

        spot.text = 'Ke ' + metadata[spot.sceneId].title;
        spot.createTooltipFunc = navigationTooltip;
        spot.createTooltipArgs = { label: spot.text };
      });
    });

    function addButton(parent, id, label) {
      if (!scenes[id]) return;

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'ut-location-button';
      button.textContent = label;
      button.setAttribute('data-scene', id);
      button.setAttribute('aria-pressed', 'false');
      button.disabled = true;

      parent.appendChild(button);
      sceneButtons.push(button);

      button.addEventListener('click', function () {
        chooseScene(id);
      });
    }

    (config.shortcuts || []).forEach(function (item) {
      addButton(shortcuts, item.sceneId, item.label);
    });

    if (lift) {
      var floors = config.floors || [];
      lift.hidden = floors.length <= 1;

      if (floors.length > 1) {
        var heading = document.createElement('span');
        heading.textContent = 'Lantai';
        lift.appendChild(heading);

        floors.forEach(function (item) {
          addButton(lift, item.sceneId, item.label);
        });
      }
    }

    function navigationTooltip(element, args) {
      element.innerHTML =
        '<svg class="ut-nav-chevron" viewBox="0 0 48 32" ' +
        'aria-hidden="true" focusable="false">' +
        '<path d="M7 24 L24 11 L41 24" fill="none" ' +
        'stroke="white" stroke-width="6" stroke-linecap="round" ' +
        'stroke-linejoin="round"/></svg>';

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

    var motion = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

    var enabled = !(motion && motion.matches);
    var loaded = false;
    var rotating = false;
    var visible = true;
    var held = false;
    var pointers = {};
    var keys = {};
    var timer = null;

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

    function setStatus(message) {
      if (status.textContent !== message) status.textContent = message;
    }

    function updateButton() {
      toggle.textContent = enabled
        ? 'Putar otomatis: aktif' : 'Putar otomatis';
      toggle.setAttribute('aria-pressed', String(enabled));
    }

    function controls(busy) {
      select.disabled = busy;
      toggle.disabled = busy || !loaded;
      reset.disabled = busy || !loaded;
      sceneButtons.forEach(function (button) {
        button.disabled = busy;
      });
      panorama.setAttribute('aria-busy', String(busy));
    }

    function syncScene(id) {
      if (!metadata[id]) return;
      select.value = id;
      sceneTitle.textContent = metadata[id].title;
      area.textContent = metadata[id].area;

      sceneButtons.forEach(function (button) {
        button.setAttribute('aria-pressed',
          String(button.getAttribute('data-scene') === id));
      });
    }

    function stop() {
      window.clearTimeout(timer);
      timer = null;
      if (rotating) viewer.stopAutoRotate();
      rotating = false;
    }

    function canRotate() {
      return loaded && enabled && visible && !held &&
        !Object.keys(keys).length && !document.hidden &&
        document.hasFocus();
    }

    function activity() {
      stop();
      if (!loaded) return;

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
      }, 8000);
    }

    function resetInteraction() {
      held = false;
      pointers = {};
      keys = {};
      stop();
    }

    function chooseScene(id) {
      if (!scenes[id] || (loaded && viewer.getScene() === id)) return;
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
      setStatus('Panorama gagal dimuat. Coba lagi atau pilih lokasi lain.');
    });

    select.addEventListener('change', function () {
      chooseScene(select.value);
    });

    retry.addEventListener('click', function () {
      var id = select.value;
      if (!scenes[id]) return;
      if (viewer.getScene() === id && viewer.getScene) {
        viewer.loadScene(id);
      } else {
        chooseScene(id);
      }
    });

    reset.addEventListener('click', function () {
      activity();
      var scene = scenes[viewer.getScene()];
      viewer.lookAt(scene.pitch, scene.yaw, scene.hfov,
        motion && motion.matches ? 0 : 600);
    });

    toggle.addEventListener('click', function () {
      enabled = !enabled;
      updateButton();
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
        held = true; activity();
      });
      document.addEventListener('mouseup', function () {
        held = false; activity();
      });
      document.addEventListener('touchstart', function () {
        held = true; activity();
      });
      document.addEventListener('touchend', function (event) {
        held = event.touches.length > 0; activity();
      });
      document.addEventListener('touchcancel', function () {
        held = false; activity();
      });
    }

    document.addEventListener('keydown', function (event) {
      keys[event.keyCode] = true; activity();
    });
    document.addEventListener('keyup', function (event) {
      delete keys[event.keyCode]; activity();
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
    updateButton();
  }
}());
