(function () {
  "use strict";

  var root = document.getElementById("unpri-tour");
  if (!root || root.getAttribute("data-ready")) return;

  var configUrl = root.getAttribute("data-config-url");
  var status = document.getElementById("ut-status");

  if (!window.pannellum || !window.fetch || !configUrl) {
    if (status) status.textContent = "Virtual Tour tidak dapat dimuat.";
    return;
  }

  root.setAttribute("data-ready", "loading");

  fetch(configUrl, { cache: "no-cache", mode: "cors" })
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (config) {
      if (!Array.isArray(config.scenes) || !config.scenes.length) {
        throw new Error("Konfigurasi scene tidak valid.");
      }

      initializeTour(config);
      root.setAttribute("data-ready", "true");
    })
    .catch(function (error) {
      root.removeAttribute("data-ready");
      if (status) {
        status.textContent =
          "Gagal memuat Virtual Tour. Silakan refresh halaman.";
      }
      console.error("[UNPRI Tour]", error);
    });

  function initializeTour(config) {
    var select = document.getElementById("ut-location");
    var shortcuts = root.querySelector(".ut-shortcuts");
    var lift = root.querySelector(".ut-floor-lift");
    var sceneTitle = document.getElementById("ut-scene-title");
    var area = document.getElementById("ut-area");
    var toggle = document.getElementById("ut-auto");
    var reset = document.getElementById("ut-reset");
    var retry = document.getElementById("ut-retry");
    var panorama = document.getElementById("ut-panorama");

    var scenes = {};
    var metadata = {};
    var shortcutButtons = [];
    var floorButtons = [];
    var allButtons = [];
    var floors = config.floors || [];
    var base = config.panoramaBase || "";

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
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
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
        throw new Error("Scene tidak valid atau duplikat: " + item.id);
      }

      metadata[item.id] = {
        title: item.title || item.id,
        area: item.area || "",
        floorId: item.floorId || null,
      };

      scenes[item.id] = {
        type: "equirectangular",
        panorama: imageUrl(item.image),
        pitch: item.pitch == null ? 0 : item.pitch,
        yaw: item.yaw == null ? 0 : item.yaw,
        hfov: item.hfov == null ? 100 : item.hfov,
        hotSpots: (item.hotSpots || []).map(function (spot) {
          return {
            pitch: spot.pitch,
            yaw: spot.yaw,
            type: "scene",
            sceneId: spot.sceneId,
            cssClass: "ut-nav-hotspot",
          };
        }),
      };
    });

    var firstScene = config.firstScene || config.scenes[0].id;

    if (!scenes[firstScene]) {
      throw new Error("firstScene tidak ditemukan: " + firstScene);
    }

    Object.keys(scenes).forEach(function (id) {
      var option = makeElement("option", null, metadata[id].title);
      option.value = id;
      select.appendChild(option);

      scenes[id].hotSpots.forEach(function (spot) {
        if (!scenes[spot.sceneId]) {
          throw new Error("Target hotspot tidak ditemukan: " + spot.sceneId);
        }

        spot.text = "Ke " + metadata[spot.sceneId].title;
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
        "</svg>";

      element.setAttribute("role", "link");
      element.setAttribute("tabindex", "0");
      element.setAttribute("aria-label", args.label);
      element.setAttribute("title", args.label);

      element.addEventListener("keydown", function (event) {
        if (event.keyCode === 13 || event.keyCode === 32) {
          event.preventDefault();
          event.stopPropagation();
          element.click();
        }
      });
    }

    var floorShortcuts = {
      mall: [
        { sceneId: "depanGedung", label: "Halaman depan" },
        { sceneId: "depanMall", label: "Mall kampus" },
        { sceneId: "menujuParkiran", label: "Area parkir" },
      ],
      gf: [{ sceneId: "gf", label: "GF" }],
      10: [
        { sceneId: "lobiLantai10", label: "Lobi Utama" },
        { sceneId: "taman", label: "Taman Lantai 10" },
      ],
      12: [
        { sceneId: "l12_GedungA", label: "Gedung A" },
        { sceneId: "l12_GedungB", label: "Gedung B" },
        { sceneId: "l12_GedungU", label: "Gedung U" },
      ],
      15: [
        { sceneId: "l15_Lift", label: "Lift L15" },
        { sceneId: "l15_GedungA", label: "Gedung A" },
        { sceneId: "l15_GedungU", label: "Gedung U" },
        { sceneId: "l15_GedungB", label: "Gedung B" },
      ],
      16: [
        { sceneId: "l16_Lift", label: "Lift L16" },
        { sceneId: "l16_GedungA", label: "Gedung A" },
        { sceneId: "l16_GedungU", label: "Gedung U" },
        { sceneId: "l16_GedungB", label: "Gedung B" },
      ],
      17: [
        { sceneId: "l17_Lift", label: "Lift L17" },
        { sceneId: "l17_GedungA", label: "Gedung A" },
        { sceneId: "l17_GedungU", label: "Gedung U" },
        { sceneId: "l17_GedungB", label: "Gedung B" },
      ],
      19: [
        { sceneId: "l19_Lift", label: "Lift L19" },
        { sceneId: "l19_GedungA", label: "Gedung A" },
        { sceneId: "l19_GedungU", label: "Gedung U" },
        { sceneId: "l19_GedungB", label: "Gedung B" },
      ],
      20: [
        { sceneId: "l20_Lift", label: "Lift L20" },
        { sceneId: "l20_GedungA", label: "Gedung A" },
        { sceneId: "l20_GedungU", label: "Gedung U" },
        { sceneId: "l20_GedungB", label: "Gedung B" },
      ],
      22: [
        { sceneId: "l22_Lift", label: "Lift L22" },
        { sceneId: "l22_Lorong", label: "Lorong L22" },
        { sceneId: "guestHouse", label: "Guest House" },
        { sceneId: "cafePrima", label: "Cafe Prima" },
      ],
    };

    function renderShortcutsForFloor(floorId, currentSceneId) {
      if (!shortcuts) return;
      shortcuts.innerHTML = "";
      shortcutButtons = [];

      var activeShortcuts = floorShortcuts[floorId] || floorShortcuts["mall"];

      activeShortcuts.forEach(function (item) {
        var id = item.sceneId;
        var label = item.label;
        if (!scenes[id]) return;

        var button = makeElement("button", "ut-location-button", label);
        button.type = "button";
        button.disabled = busy;
        button.setAttribute("data-scene", id);

        var isActive =
          currentSceneId === id ||
          (currentSceneId && currentSceneId.indexOf(id) === 0);

        button.setAttribute("aria-pressed", String(isActive));
        if (isActive) {
          button.classList.add("is-active");
        }

        button.addEventListener("click", function () {
          chooseScene(id);
        });

        shortcuts.appendChild(button);
        shortcutButtons.push(button);
        allButtons.push(button);
      });
    }

    function floorForScene(id) {
      var item = metadata[id];
      if (!item) return "mall";

      if (item.floorId) return String(item.floorId);

      var areaName = (item.area || "").toLowerCase();
      var idName = id.toLowerCase();

      if (areaName.includes("16") || idName.includes("l16")) return "16";
      if (areaName.includes("15") || idName.includes("l15")) return "15";
      if (areaName.includes("12") || idName.includes("l12")) return "12";
      if (areaName.includes("10") || idName.includes("lantai10")) return "10";
      if (areaName.includes("gf") || idName.includes("gf")) return "gf";
      if (areaName.includes("mall") || idName.includes("mall")) return "mall";
      if (areaName.includes("17") || idName.includes("l17")) return "17";
      if (areaName.includes("19") || idName.includes("l19")) return "19";
      if (areaName.includes("20") || idName.includes("l20")) return "20";
      if (areaName.includes("22") || idName.includes("l20")) return "22";

      return "mall";
    }

    function buildLift() {
      if (!lift) return;

      lift.innerHTML = "";
      floorButtons = [];

      var validFloors = floors.filter(function (floor) {
        return floor.id != null && scenes[floor.sceneId];
      });

      var heading = makeElement("span", "ut-lift-heading", "LIFT");
      lift.appendChild(heading);

      validFloors
        .slice()
        .reverse()
        .forEach(function (floor) {
          var button = makeElement("button", "ut-lift-floor", floor.label);
          button.type = "button";
          button.disabled = true;
          button.title = floor.title;
          button.setAttribute("data-floor", String(floor.id));
          button.setAttribute("data-scene", floor.sceneId);
          button.setAttribute("aria-label", "Menuju " + floor.title);
          button.setAttribute("aria-pressed", "false");

          button.addEventListener("click", function () {
            chooseScene(floor.sceneId);
          });

          lift.appendChild(button);
          floorButtons.push(button);
          allButtons.push(button);
        });

      var footer = makeElement("span", "ut-lift-footer", "UNPRI");
      lift.appendChild(footer);
    }

    function syncLift(id) {
      if (!lift) return;

      var currentFloor = floorForScene(id);

      lift.hidden = false;

      renderShortcutsForFloor(currentFloor, id);

      floorButtons.forEach(function (button) {
        var active = button.getAttribute("data-floor") === currentFloor;

        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-current", active ? "location" : "false");
      });
    }

    buildLift();

    var viewer = window.pannellum.viewer("ut-panorama", {
      default: {
        firstScene: firstScene,
        autoLoad: true,
        crossOrigin: "anonymous",
        sceneFadeDuration: motion && motion.matches ? 0 : 500,
        autoRotate: -2,
        autoRotateInactivityDelay: -1,
        minHfov: 50,
        maxHfov: 110,
        showControls: true,
        showZoomCtrl: true,
        showFullscreenCtrl: true,
        compass: false,
        mouseZoom: "fullscreenonly",
      },
      scenes: scenes,
    });

    function controls(isBusy) {
      busy = isBusy;

      if (select) select.disabled = isBusy;
      if (toggle) toggle.disabled = isBusy || !loaded;
      if (reset) reset.disabled = isBusy || !loaded;

      allButtons.forEach(function (button) {
        button.disabled = isBusy;
      });

      panorama.setAttribute("aria-busy", String(isBusy));
    }

    function syncScene(id) {
      if (!metadata[id]) return;

      select.value = id;
      sceneTitle.textContent = metadata[id].title;
      area.textContent = metadata[id].area;

      shortcutButtons.forEach(function (button) {
        var targetScene = button.getAttribute("data-scene");
        var active =
          targetScene === id || (id && id.indexOf(targetScene) === 0);

        button.setAttribute("aria-pressed", String(active));
        button.classList.toggle("is-active", active);
      });

      syncLift(id);
    }

    function updateAutoButton() {
      if (!toggle) return;

      toggle.textContent = enabled ? "Putar otomatis: aktif" : "Putar otomatis";
      toggle.setAttribute("aria-pressed", String(enabled));

      toggle.classList.toggle("is-active", enabled);
    }

    function stop() {
      window.clearTimeout(timer);
      timer = null;

      if (rotating) {
        viewer.stopAutoRotate();
        rotating = false;
      }
    }

    function canRotate() {
      return (
        loaded &&
        !busy &&
        enabled &&
        visible &&
        !held &&
        !Object.keys(keys).length &&
        !document.hidden &&
        document.hasFocus()
      );
    }

    function activity() {
      stop();

      if (!loaded || busy) return;

      if (!enabled) {
        setStatus("Putar otomatis nonaktif · geser panorama untuk menjelajah.");
        return;
      }

      setStatus(
        "Putar otomatis aktif · dimulai setelah 5 detik tanpa aktivitas.",
      );

      if (!canRotate()) return;

      timer = window.setTimeout(function () {
        timer = null;
        if (!canRotate()) return;

        viewer.startAutoRotate(-2);
        rotating = true;

        setStatus(
          "Panorama berputar perlahan · gerakkan kursor untuk berhenti.",
        );
      }, 5000);
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
      setStatus("Memuat " + metadata[id].title + "...");

      viewer.loadScene(id);
    }

    viewer.on("load", function () {
      loaded = true;
      retry.hidden = true;

      syncScene(viewer.getScene());
      controls(false);
      activity();
    });

    viewer.on("scenechange", function (id) {
      stop();
      loaded = false;
      retry.hidden = true;

      controls(true);
      syncScene(id);
      setStatus("Memuat " + metadata[id].title + "...");
    });

    viewer.on("error", function () {
      stop();
      loaded = false;
      controls(false);

      retry.hidden = false;
      setStatus("Panorama gagal dimuat. Pilih lokasi lain atau coba lagi.");
    });

    select.addEventListener("change", function () {
      chooseScene(select.value);
    });

    retry.addEventListener("click", function () {
      var id = select.value;
      if (!scenes[id]) return;

      stop();
      loaded = false;
      retry.hidden = true;

      controls(true);
      setStatus("Memuat ulang " + metadata[id].title + "...");

      viewer.loadScene(id);
    });

    reset.addEventListener("click", function () {
      if (!loaded) return;

      activity();

      var scene = scenes[viewer.getScene()];
      if (!scene) return;

      viewer.lookAt(
        scene.pitch,
        scene.yaw,
        scene.hfov,
        motion && motion.matches ? 0 : 600,
      );
    });

    toggle.addEventListener("click", function () {
      enabled = !enabled;
      updateAutoButton();
      activity();
    });

    ["mousemove", "touchmove", "wheel", "scroll", "focusin"].forEach(
      function (name) {
        document.addEventListener(name, activity, false);
      },
    );

    if (window.PointerEvent) {
      document.addEventListener("pointerdown", function (event) {
        pointers[event.pointerId] = true;
        held = true;
        activity();
      });

      ["pointerup", "pointercancel"].forEach(function (name) {
        document.addEventListener(name, function (event) {
          delete pointers[event.pointerId];
          held = Object.keys(pointers).length > 0;
          activity();
        });
      });
    } else {
      document.addEventListener("mousedown", function () {
        held = true;
        activity();
      });

      document.addEventListener("mouseup", function () {
        held = false;
        activity();
      });

      document.addEventListener("touchstart", function () {
        held = true;
        activity();
      });

      document.addEventListener("touchend", function (event) {
        held = event.touches.length > 0;
        activity();
      });

      document.addEventListener("touchcancel", function () {
        held = false;
        activity();
      });
    }

    document.addEventListener("keydown", function (event) {
      keys[event.keyCode] = true;
      activity();
    });

    document.addEventListener("keyup", function (event) {
      delete keys[event.keyCode];
      activity();
    });

    document.addEventListener("visibilitychange", function () {
      resetInteraction();
      if (!document.hidden) activity();
    });

    window.addEventListener("blur", resetInteraction);
    window.addEventListener("focus", activity);
    window.addEventListener("pagehide", resetInteraction);
    window.addEventListener("pageshow", activity);

    if (window.IntersectionObserver) {
      var observer = new window.IntersectionObserver(
        function (entries) {
          visible = entries[0].isIntersecting;
          activity();
        },
        { threshold: 0 },
      );

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
})();
