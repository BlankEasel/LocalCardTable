/* ==========================================
   1. 状態管理 & 初期データ (sessionStorage利用)
   ========================================== */
const STORAGE_KEY = "local-card-freeplay-v47";
const uid = function() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
};

const defaultCards = [
  { id: uid(), name: "ブレイズドラゴン", count: 2, image: "", backImage: "", color: "linear-gradient(135deg, #f97316, #b91c1c)" },
  { id: uid(), name: "森の守護者", count: 2, image: "", backImage: "", color: "linear-gradient(135deg, #10b981, #166534)" },
  { id: uid(), name: "蒼月の魔導士", count: 2, image: "", backImage: "", color: "linear-gradient(135deg, #0ea5e9, #3730a3)" }
];

const colorPresets = [
  "linear-gradient(135deg, #f97316, #b91c1c)",
  "linear-gradient(135deg, #10b981, #166534)",
  "linear-gradient(135deg, #0ea5e9, #3730a3)",
  "linear-gradient(135deg, #8b5cf6, #701a75)",
  "linear-gradient(135deg, #ec4899, #9f1239)"
];

let cards = defaultCards;
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  if (saved && Array.isArray(saved.cards)) cards = saved.cards;
} catch (e) {}

let deck = [], hand = [], discard = [];
let counters = [];
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  if (saved && Array.isArray(saved.counters)) counters = saved.counters;
} catch (e) {}

let isDeckPublic = false;
let previewCard = null;
let handIsPrivate = true;

let fields = [
  { 
    id: uid(), 
    name: "場 1", 
    cards: [], 
    facing: "up", 
    isOpen: true,
    isPrivate: true,
    clickAction: "hand",
    clickFacing: "up",
    clickDeckPos: "top",
    clickDeckNum: 1,
    enableClick: true
  }
];

try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  if (saved && Array.isArray(saved.fields) && saved.fields.length > 0) {
    fields = saved.fields.map(function(f, i) {
      return {
        id: f.id || uid(),
        name: String(f.name || ("場 " + (i + 1))),
        cards: [],
        facing: f.facing || "up",
        isOpen: f.isOpen !== false,
        isPrivate: f.isPrivate !== false,
        clickAction: f.clickAction || "hand",
        clickFacing: f.clickFacing || "up",
        clickDeckPos: f.clickDeckPos || "top",
        clickDeckNum: f.clickDeckNum || 1,
        enableClick: f.enableClick !== false
      };
    });
  }
} catch (e) {}

// 開始設定項目の復元（手札と場の順序をそのまま保持）
let setupItems = [];
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  if (saved && Array.isArray(saved.setupItems) && saved.setupItems.length > 0) {
    saved.setupItems.forEach(function(item) {
      if (item.type === 'hand') {
        setupItems.push({
          id: "hand",
          type: "hand",
          name: "手札",
          count: item.count !== undefined ? item.count : 0,
          facing: item.facing || "up",
          pos: item.pos || "top"
        });
      } else if (item.type === 'field') {
        const matchedField = fields.find(function(f) { return f.id === item.id || f.name === item.name; });
        if (matchedField) {
          setupItems.push({
            id: matchedField.id,
            type: "field",
            name: matchedField.name,
            count: item.count !== undefined ? item.count : 0,
            facing: item.facing || "up",
            pos: item.pos || "top"
          });
        }
      }
    });
  }
} catch (e) {}

// 不足している項目（新規追加された場や手札）があれば追加
if (!setupItems.some(function(i) { return i.type === 'hand'; })) {
  setupItems.unshift({ id: "hand", type: "hand", name: "手札", count: 0, facing: "up", pos: "top" });
}
fields.forEach(function(f) {
  if (!setupItems.some(function(i) { return i.id === f.id; })) {
    setupItems.push({ id: f.id, type: "field", name: f.name, count: 0, facing: "up", pos: "top" });
  }
});

let operationLogs = [];
let handFacing = "up";
let handEnableClick = true;

const $ = function(id) { return document.getElementById(id); };

/* ==========================================
   モーダル統括管理（排他制御）
   ========================================== */
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(function(modal) {
    modal.classList.remove('active');
  });
}

function openModal(modalId) {
  closeAllModals();
  const target = $(modalId);
  if (target) target.classList.add("active");
}

/* ==========================================
   2. ユーティリティ・ヘルパー
   ========================================== */
function addLog(text) {
  const timeStr = new Date().toLocaleTimeString();
  operationLogs.unshift("[" + timeStr + "] " + text);
  if (operationLogs.length > 100) operationLogs.pop();
}

function renderLogs() {
  const list = $("logList");
  if (!list) return;
  list.innerHTML = "";
  if (operationLogs.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: #64748b; padding: 20px;">ログはありません</div>';
    return;
  }
  operationLogs.forEach(function(log) {
    const item = document.createElement("div");
    item.className = "log-item";
    item.textContent = log;
    list.appendChild(item);
  });
}

function saveCards() {
  try {
    const savedData = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
    savedData.cards = cards;
    savedData.counters = counters;
    savedData.setupItems = setupItems;
    savedData.fields = fields.map(function(f) {
      return {
        id: f.id,
        name: f.name,
        facing: f.facing,
        isOpen: f.isOpen,
        isPrivate: f.isPrivate,
        clickAction: f.clickAction,
        clickFacing: f.clickFacing,
        clickDeckPos: f.clickDeckPos,
        clickDeckNum: f.clickDeckNum,
        enableClick: f.enableClick
      };
    });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));
  } catch (e) {}
}

function saveCounters() {
  saveCards();
}

function shuffle(items) {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = next[i];
    next[i] = next[j];
    next[j] = temp;
  }
  return next;
}

function insertToDeck(card, pos, num) {
  const n = Math.max(1, Number(num) || 1);
  if (pos === "top") {
    deck.splice(Math.max(0, n - 1), 0, card);
  } else {
    deck.splice(Math.max(0, deck.length - n + 1), 0, card);
  }
}

function getAllDescendants(cardsArr, parentCardId) {
  let result = [];
  const children = cardsArr.filter(function(c) { return c.parentId === parentCardId; });
  children.forEach(function(ch) {
    result.push(ch);
    result.push.apply(result, getAllDescendants(cardsArr, ch.instanceId));
  });
  return result;
}

function getAncestorChain(cardsArr, card) {
  let chain = [card];
  let current = card;
  while (current && current.parentId) {
    const parent = cardsArr.find(function(c) { return c.instanceId === current.parentId; });
    if (parent && chain.indexOf(parent) === -1) {
      chain.unshift(parent);
      current = parent;
    } else {
      break;
    }
  }
  return chain;
}

/* ==========================================
   3. UIコントロール・レイアウト調整
   ========================================== */
const previewSidebar = $("previewSidebar");
const previewResizer = $("previewResizer");
let isResizing = false;
let currentPreviewWidth = "280px";

previewResizer.onmousedown = function(e) {
  isResizing = true;
  document.body.style.cursor = "ew-resize";
  e.preventDefault();
};

window.onmousemove = function(e) {
  if (!isResizing) return;
  const newWidth = window.innerWidth - e.clientX;
  if (newWidth > 180 && newWidth < 600) {
    const widthStr = newWidth + 'px';
    document.documentElement.style.setProperty('--preview-width', widthStr);
    if (!previewSidebar.classList.contains("collapsed")) {
      currentPreviewWidth = widthStr;
    }
  }
};

window.onmouseup = function() {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = "default";
  }
};

$("previewToggleBtn").onclick = function() {
  const isCollapsed = previewSidebar.classList.toggle("collapsed");
  if (isCollapsed) {
    const computedW = getComputedStyle(document.documentElement).getPropertyValue('--preview-width').trim();
    if (computedW !== "44px") currentPreviewWidth = computedW;
    document.documentElement.style.setProperty('--preview-width', '44px');
    $("previewToggleBtn").textContent = "▶";
  } else {
    document.documentElement.style.setProperty('--preview-width', currentPreviewWidth);
    $("previewToggleBtn").textContent = "◀";
  }
};

const bottomDockEl = $("bottomDock");
if (bottomDockEl && window.ResizeObserver) {
  const ro = new ResizeObserver(function(entries) {
    for (let i = 0; i < entries.length; i++) {
      document.documentElement.style.setProperty('--dock-height', (entries[i].contentRect.height + 16) + 'px');
    }
  });
  ro.observe(bottomDockEl);
}

/* ==========================================
   4. カード・ゾーン操作ロジック
   ========================================== */
function syncCardRotation(targetCard, newRot) {
  targetCard.rotation = newRot;
  if (previewCard && previewCard.instanceId === targetCard.instanceId) {
    renderPreviewPanel();
  }
  const zoomModal = $("zoomModal");
  if (zoomModal.classList.contains("active")) {
    const zoomInput = $("zoomRotateInput");
    if (zoomInput) zoomInput.value = newRot;
    const zoomCardElem = $("zoomCardContainer").querySelector(".game-card");
    if (zoomCardElem) zoomCardElem.style.transform = "rotate(" + newRot + "deg)";
  }
  renderZones();
}

function moveCardWithDescendants(mainCard, srcArray, targetType, targetFieldId, targetFacing, extraParams) {
  if (!extraParams) extraParams = {};
  const descendants = getAllDescendants(srcArray, mainCard.instanceId);
  const cardsToMove = [mainCard].concat(descendants);

  let fromField = fields.find(function(f) { return f.cards.indexOf(mainCard) !== -1; });

  if (fromField && targetType !== "field") {
    cardsToMove.forEach(function(c) {
      if (c.baseName) c.name = c.baseName;
      c.counters = [];
      c.memo = "";
    });
  }

  let filteredCardsToMove = cardsToMove;
  if (fromField && targetType !== "field") {
    filteredCardsToMove = cardsToMove.filter(function(c) { return !c.isToken; });
    const removedTokens = cardsToMove.filter(function(c) { return c.isToken; });
    if (removedTokens.length > 0) {
      addLog("トークン（" + removedTokens.length + "枚）が場から移動したため削除されました");
    }
  } else if (fromField && targetType === "field" && targetFieldId !== fromField.id) {
    filteredCardsToMove = cardsToMove.filter(function(c) { return !c.isToken; });
    const removedTokens = cardsToMove.filter(function(c) { return c.isToken; });
    if (removedTokens.length > 0) {
      addLog("トークン（" + removedTokens.length + "枚）が別の場に移動したため削除されました");
    }
  }

  cardsToMove.forEach(function(c) {
    const idx = srcArray.findIndex(function(item) { return item.instanceId === c.instanceId; });
    if (idx !== -1) srcArray.splice(idx, 1);
    c.parentId = null;
  });

  if (previewCard && cardsToMove.some(function(c) { return c.instanceId === previewCard.instanceId; })) {
    previewCard = null;
    renderPreviewPanel();
  }

  if (filteredCardsToMove.length === 0) return;

  if (targetType === "hand") {
    filteredCardsToMove.forEach(function(c) { c.isFacedUp = true; hand.push(c); });
    addLog(mainCard.name + "（子・孫含む " + filteredCardsToMove.length + "枚）を手札に移動しました");
  } else if (targetType === "field") {
    const targetField = fields.find(function(f) { return f.id === targetFieldId; });
    if (targetField) {
      filteredCardsToMove.forEach(function(c) {
        if (targetFacing !== undefined) c.isFacedUp = (targetFacing === "up");
        targetField.cards.push(c);
      });
      addLog(mainCard.name + "（子・孫含む " + filteredCardsToMove.length + "枚）を" + targetField.name + "に移動しました");
    }
  } else if (targetType === "deck") {
    filteredCardsToMove.forEach(function(c) {
      if (targetFacing !== undefined) {
        c.isFacedUp = (targetFacing === "up");
        c.inspectFacing = (targetFacing === "up");
      } else {
        c.inspectFacing = c.isFacedUp !== false;
      }
      insertToDeck(c, extraParams.pos || "top", extraParams.num || 1);
    });
    addLog(mainCard.name + "（子・孫含む " + filteredCardsToMove.length + "枚）をデッキに戻しました");
  } else if (targetType === "discard") {
    filteredCardsToMove.forEach(function(c) { c.isFacedUp = true; discard.push(c); });
    addLog(mainCard.name + "（子・孫含む " + filteredCardsToMove.length + "枚）をDISCARDに移動しました");
  }
}

function executeCardAction(card, srcArray, srcIndex, action, facing, extraParams) {
  if (!card || srcIndex === -1) return;
  if (action === "hand") {
    moveCardWithDescendants(card, srcArray, "hand");
  } else if (action && action.indexOf("field_") === 0) {
    const targetFieldId = action.replace("field_", "");
    moveCardWithDescendants(card, srcArray, "field", targetFieldId, facing);
  } else if (action === "discard") {
    moveCardWithDescendants(card, srcArray, "discard");
  } else if (action === "deck") {
    moveCardWithDescendants(card, srcArray, "deck", null, facing, extraParams);
  }
  render();
}

function setupDropZone(zoneElement, targetType, targetFieldId) {
  if (!targetFieldId) targetFieldId = null;
  zoneElement.ondragover = function(e) { e.preventDefault(); };
  zoneElement.ondrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      const srcType = data.type;
      const srcFieldId = data.fieldId;
      const srcIndex = data.index;

      let srcArray = null;
      if (srcType === "hand") srcArray = hand;
      else if (srcType === "field") {
        const f = fields.find(function(item) { return item.id === srcFieldId; });
        if (f) srcArray = f.cards;
      } else if (srcType === "discard") srcArray = discard;
      else if (srcType === "deck") srcArray = deck;

      if (!srcArray || srcIndex === undefined || !srcArray[srcIndex]) return;

      const movedCard = srcArray[srcIndex];
      if (srcType === targetType && srcFieldId === targetFieldId) {
        const dropTargetIndex = zoneElement.dataset.dropIndex !== undefined ? Number(zoneElement.dataset.dropIndex) : srcArray.length - 1;
        const item = srcArray.splice(srcIndex, 1)[0];
        srcArray.splice(dropTargetIndex, 0, item);
        render();
        return;
      }

      moveCardWithDescendants(movedCard, srcArray, targetType, targetFieldId);
      render();
    } catch (err) {}
  };
}

function createCardContainerElement(card, compact, onClick, sourceInfo, enableClick, isPreviewOnly) {
  if (compact === undefined) compact = false;
  if (enableClick === undefined) enableClick = true;
  if (isPreviewOnly === undefined) isPreviewOnly = false;

  const container = document.createElement("div");
  container.className = "card-container-item";

  const wrapper = document.createElement("div");
  wrapper.className = "card-wrapper";

  const btn = document.createElement("button");
  btn.type = "button";
  
  const isFacedUp = card.isFacedUp !== false;
  let baseClass = "game-card " + (compact ? "compact" : "normal") + (!isFacedUp && !compact ? " faced-down" : "");
  if (!enableClick) baseClass += " disabled-click";
  btn.className = baseClass;
  
  const rot = card.rotation || 0;
  const w = compact ? 56 : 70;
  const h = compact ? 80 : 98;

  if (rot > 0) {
    btn.style.transform = "rotate(" + rot + "deg)";
    if (rot % 180 === 90) {
      wrapper.style.width = h + "px";
      wrapper.style.height = w + "px";
      btn.style.position = 'absolute';
      btn.style.top = ((w - h) / 2) + "px";
      btn.style.left = ((h - w) / 2) + "px";
    } else {
      wrapper.style.width = w + "px";
      wrapper.style.height = h + "px";
    }
  } else {
    wrapper.style.width = w + "px";
    wrapper.style.height = h + "px";
  }

  if (sourceInfo && !isPreviewOnly) {
    btn.draggable = true;
    btn.ondragstart = function(e) {
      const payload = Object.assign({}, sourceInfo, { cardId: card.instanceId });
      e.dataTransfer.setData("text/plain", JSON.stringify(payload));
      e.stopPropagation();
    };
  }

  if (isFacedUp) {
    if (card.image) {
      const img = document.createElement("img");
      img.src = card.image;
      img.className = "bg-img";
      btn.appendChild(img);
    } else {
      const bg = document.createElement("div");
      bg.className = "bg-gradient";
      bg.style.background = card.color || "linear-gradient(135deg, #8b5cf6, #701a75)";
      btn.appendChild(bg);
    }
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    btn.appendChild(overlay);

    const content = document.createElement("div");
    content.className = "card-content-text";
    const p = document.createElement("p");
    p.textContent = card.name;
    content.appendChild(p);
    btn.appendChild(content);

    if (card.isToken) {
      const tokenPattern = document.createElement("div");
      tokenPattern.className = "token-card-pattern";
      tokenPattern.textContent = card.name || "トークン";
      btn.innerHTML = "";
      const bg = document.createElement("div");
      bg.className = "bg-gradient";
      bg.style.background = card.color || "linear-gradient(135deg, #f1f5f9, #cbd5e1)";
      btn.appendChild(bg);
      btn.appendChild(tokenPattern);
    }
  } else {
    if (card.backImage) {
      const img = document.createElement("img");
      img.src = card.backImage;
      img.className = "bg-img";
      btn.appendChild(img);
    } else {
      const pattern = document.createElement("div");
      pattern.className = "card-back-pattern";
      pattern.textContent = "BACK";
      btn.appendChild(pattern);
    }
  }

  if (enableClick && onClick) btn.onclick = onClick;
  
  if (!isPreviewOnly) {
    btn.oncontextmenu = function(e) {
      e.preventDefault();
      const isHandPrivate = (sourceInfo && sourceInfo.type === 'hand' && handIsPrivate);
      let isFieldPrivate = false;
      if (sourceInfo && sourceInfo.type === 'field') {
        const fieldObj = fields.find(function(item) { return item.id === sourceInfo.fieldId; });
        if (fieldObj && fieldObj.isPrivate !== false && card.isFacedUp === false) {
          isFieldPrivate = true;
        }
      }

      if (isHandPrivate || isFieldPrivate) {
        previewCard = card;
        renderPreviewPanel();
        addLog(card.name + "をPREVIEW領域に表示しました");
      } else {
        previewCard = card;
        renderPreviewPanel();
        openZoomModal(card);
      }
    };
  }

  wrapper.appendChild(btn);
  container.appendChild(wrapper);

  if (card.counters && card.counters.length > 0) {
    const countersBadge = document.createElement("div");
    countersBadge.className = "card-counters-badge";
    card.counters.forEach(function(cnt) {
      const tag = document.createElement("span");
      tag.className = "card-counter-tag";
      tag.textContent = cnt.name + ":" + cnt.value;
      countersBadge.appendChild(tag);
    });
    container.appendChild(countersBadge);
  }

  return container;
}

/* ==========================================
   5. レンダリング・UI更新処理
   ========================================== */
function renderCounts() {
  $("deckCount").textContent = deck.length;
  $("handCount").textContent = hand.length + "枚";
  $("discardCountBadge").textContent = discard.length;

  $("drawButton").disabled = !deck.length;
  $("shuffleButton").disabled = !deck.length;
  $("inspectDeckBtn").disabled = !deck.length;
  $("inspectDiscardBtn").disabled = !discard.length;
  $("inspectHandBtn").disabled = (handIsPrivate || !hand.length);

  renderCounterList();
}

function renderCounterList() {
  const container = $("counterListContainer");
  container.innerHTML = "";
  if (counters.length === 0) {
    container.innerHTML = '<div style="color: #64748b; font-size: 11px; padding: 4px;">＋で追加</div>';
    return;
  }

  counters.forEach(function(cnt, idx) {
    const item = document.createElement("div");
    item.className = "counter-item";

    const delBtn = document.createElement("button");
    delBtn.className = "counter-del-btn";
    delBtn.textContent = "✕";
    delBtn.onclick = function() {
      counters.splice(idx, 1);
      saveCounters();
      renderCounterList();
    };

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = cnt.name;
    nameInput.oninput = function(e) { cnt.name = e.target.value; saveCounters(); };

    const numInput = document.createElement("input");
    numInput.type = "number";
    numInput.min = "0";
    numInput.value = cnt.value;
    numInput.oninput = function(e) {
      cnt.value = Math.max(0, Number(e.target.value) || 0);
      saveCounters();
    };

    item.appendChild(delBtn);
    item.appendChild(nameInput);
    item.appendChild(numInput);
    container.appendChild(item);
  });
}

function buildDestinationOptions(selectElem, excludeType, excludeId) {
  if (!excludeType) excludeType = "";
  if (!excludeId) excludeId = "";
  selectElem.innerHTML = "";
  if (excludeType !== "hand") {
    const optHand = document.createElement("option");
    optHand.value = "hand";
    optHand.textContent = "手札";
    selectElem.appendChild(optHand);
  }

  fields.forEach(function(f) {
    if (excludeType !== "field" || excludeId !== f.id) {
      const opt = document.createElement("option");
      opt.value = "field_" + f.id;
      opt.textContent = f.name;
      selectElem.appendChild(opt);
    }
  });

  if (excludeType !== "discard") {
    const optDisc = document.createElement("option");
    optDisc.value = "discard";
    optDisc.textContent = "DISCARD";
    selectElem.appendChild(optDisc);
  }

  if (excludeType !== "deck") {
    const optDeck = document.createElement("option");
    optDeck.value = "deck";
    optDeck.textContent = "デッキ";
    selectElem.appendChild(optDeck);
  }

  if (selectElem.options.length > 0 && !Array.from(selectElem.options).some(function(o) { return o.value === selectElem.value; })) {
    selectElem.value = selectElem.options[0].value;
  }
}

function updateAllActionSelects() {
  const handSelect = $("handActionSelect");
  const currentHandVal = handSelect.value;
  buildDestinationOptions(handSelect, "hand");
  if (Array.from(handSelect.options).some(function(o) { return o.value === currentHandVal; })) {
    handSelect.value = currentHandVal;
  } else if (handSelect.options.length > 0) {
    handSelect.value = handSelect.options[0].value;
  }
  $("handDeckOptions").style.display = handSelect.value === "deck" ? "flex" : "none";
  $("handEnableClick").checked = handEnableClick;
  $("handPrivacyToggleBtn").textContent = handIsPrivate ? "非公開" : "公開";
  $("handPrivacyToggleBtn").style.background = handIsPrivate ? "#7c3aed" : "rgba(255,255,255,0.1)";

  fields.forEach(function(f) {
    const fieldSelect = $("fieldActionSelect_" + f.id);
    if (fieldSelect) {
      const currentFieldVal = fieldSelect.value;
      buildDestinationOptions(fieldSelect, "field", f.id);
      if (Array.from(fieldSelect.options).some(function(o) { return o.value === currentFieldVal; })) {
        fieldSelect.value = currentFieldVal;
      } else if (fieldSelect.options.length > 0) {
        fieldSelect.value = fieldSelect.options[0].value;
      }
      
      const deckOpts = $("fieldDeckOptions_" + f.id);
      if (deckOpts) deckOpts.style.display = fieldSelect.value === "deck" ? "flex" : "none";
      
      const enableCheckbox = $("fieldEnableClick_" + f.id);
      if (enableCheckbox) enableCheckbox.checked = f.enableClick !== false;
      
      const privBtn = $("fieldPrivacyToggle_" + f.id);
      if (privBtn) {
        const isPriv = f.isPrivate !== false;
        privBtn.textContent = isPriv ? "非公開" : "公開";
        privBtn.style.background = isPriv ? "#7c3aed" : "rgba(255,255,255,0.1)";
      }
    }
  });
}

function renderPreviewPanel() {
  const body = $("previewBody");
  body.innerHTML = "";
  if (!previewCard) {
    body.innerHTML = '<div style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">非公開カードのプレビュー表示エリア</div>';
    return;
  }

  let pIsFacedUp = previewCard.isFacedUp !== false;
  let pRotation = previewCard.rotation || 0;

  let currentField = null;
  fields.forEach(function(f) {
    if (f.cards.some(function(c) { return c.instanceId === previewCard.instanceId; })) currentField = f;
  });

  const isFieldCardInPrivate = currentField && currentField.isPrivate !== false;
  const isCardFacedDown = previewCard.isFacedUp === false;
  const isSpecialInspectMode = isFieldCardInPrivate && isCardFacedDown;
  let isTemporarilyFacingUp = false;

  const ctrlBar = document.createElement("div");
  ctrlBar.style.cssText = "display: flex; flex-direction: column; gap: 6px; width: 100%; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); font-size: 11px;";

  const row1 = document.createElement("div");
  row1.style.cssText = "display: flex; gap: 4px; align-items: center; justify-content: space-between;";

  let facingBtn;
  if (isSpecialInspectMode) {
    facingBtn = document.createElement("button");
    facingBtn.className = "btn secondary";
    facingBtn.style.cssText = "padding: 2px 6px; font-size: 11px; flex: 1; justify-content: center; background: #7c3aed;";
    facingBtn.textContent = "確認する";

    const startInspect = function(e) { e.preventDefault(); isTemporarilyFacingUp = true; buildPreviewCardDOM(); };
    const endInspect = function(e) { e.preventDefault(); isTemporarilyFacingUp = false; buildPreviewCardDOM(); };

    facingBtn.onmousedown = startInspect;
    facingBtn.onmouseup = endInspect;
    facingBtn.onmouseleave = endInspect;
    facingBtn.onttouchstart = startInspect;
    facingBtn.ontouchend = endInspect;
  } else {
    facingBtn = document.createElement("button");
    facingBtn.className = "btn secondary";
    facingBtn.style.cssText = "padding: 2px 6px; font-size: 11px; flex: 1; justify-content: center;";
    facingBtn.textContent = pIsFacedUp ? "裏にする" : "表にする";
    facingBtn.onclick = function() {
      pIsFacedUp = !pIsFacedUp;
      previewCard.isFacedUp = pIsFacedUp;
      facingBtn.textContent = pIsFacedUp ? "裏にする" : "表にする";
      facingBtn.style.background = pIsFacedUp ? "rgba(255,255,255,0.1)" : "#7c3aed";
      buildPreviewCardDOM();
      renderZones();
    };
  }

  const rotInput = document.createElement("input");
  rotInput.type = "number";
  rotInput.min = "0";
  rotInput.max = "360";
  rotInput.step = "15";
  rotInput.value = pRotation;
  rotInput.style.cssText = "width: 45px; height: 26px; text-align: center; font-size: 11px; padding: 2px;";
  rotInput.oninput = function(e) {
    const newR = Number(e.target.value) || 0;
    syncCardRotation(previewCard, newR);
  };

  const rotBtn = document.createElement("button");
  rotBtn.className = "btn secondary";
  rotBtn.style.cssText = "padding: 2px 6px; font-size: 11px;";
  rotBtn.textContent = "+90°";
  rotBtn.onclick = function() {
    const newR = (pRotation + 90) > 360 ? 0 : pRotation + 90;
    syncCardRotation(previewCard, newR);
  };

  row1.appendChild(facingBtn);
  row1.appendChild(rotInput);
  row1.appendChild(rotBtn);

  const row2 = document.createElement("div");
  row2.style.cssText = "display: flex; gap: 4px; align-items: center;";
  const parentLabel = document.createElement("span");
  parentLabel.textContent = "親:";
  parentLabel.style.color = "#94a3b8";

  const parentSelect = document.createElement("select");
  parentSelect.style.cssText = "flex: 1; height: 26px; font-size: 11px; padding: 2px;";
  parentSelect.innerHTML = '<option value="">(なし / 親)</option>';
  
  if (currentField) {
    const descendantIds = new Set(getAllDescendants(currentField.cards, previewCard.instanceId).map(function(d) { return d.instanceId; }));
    currentField.cards.forEach(function(c, idx) {
      if (c.instanceId !== previewCard.instanceId && !descendantIds.has(c.instanceId)) {
        const opt = document.createElement("option");
        opt.value = c.instanceId;
        opt.textContent = (c.isFacedUp !== false) ? c.name : ("#" + (idx + 1) + " (非公開)");
        parentSelect.appendChild(opt);
      }
    });
  }
  parentSelect.value = previewCard.parentId || "";
  parentSelect.onchange = function(e) {
    previewCard.parentId = e.target.value || null;
    renderZones();
    addLog(previewCard.name + "の親設定を変更しました");
  };
  row2.appendChild(parentLabel);
  row2.appendChild(parentSelect);
  ctrlBar.appendChild(row1);
  ctrlBar.appendChild(row2);

  const cardContainer = document.createElement("div");
  cardContainer.style.cssText = "display: flex; justify-content: center; width: 100%; margin-top: 4px; flex-direction: column; align-items: center; gap: 4px;";

  function buildPreviewCardDOM() {
    cardContainer.innerHTML = "";
    const cWrap = document.createElement("div");
    cWrap.className = "card-wrapper";
    cWrap.style.width = "100%";
    cWrap.style.display = "flex";
    cWrap.style.justifyContent = "center";

    const displayFacedUp = pIsFacedUp || isTemporarilyFacingUp;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "game-card preview-card-large" + (!displayFacedUp ? " faced-down" : "");
    btn.style.transform = "rotate(" + (previewCard.rotation || 0) + "deg)";
    btn.style.cursor = "default";

    if (displayFacedUp) {
      if (previewCard.image) {
        const img = document.createElement("img");
        img.src = previewCard.image;
        img.className = "bg-img";
        btn.appendChild(img);
      } else {
        const bg = document.createElement("div");
        bg.className = "bg-gradient";
        bg.style.background = previewCard.color || "linear-gradient(135deg, #8b5cf6, #701a75)";
        btn.appendChild(bg);
      }
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      btn.appendChild(overlay);

      const content = document.createElement("div");
      content.className = "card-content-text";
      const p = document.createElement("p");
      p.style.fontSize = "11px";
      p.style.webkitLineClamp = "unset";
      p.textContent = previewCard.name;
      content.appendChild(p);
      btn.appendChild(content);

      if (previewCard.isToken) {
        const tokenPattern = document.createElement("div");
        tokenPattern.className = "token-card-pattern";
        tokenPattern.textContent = previewCard.name || "トークン";
        btn.innerHTML = "";
        const bg = document.createElement("div");
        bg.className = "bg-gradient";
        bg.style.background = previewCard.color || "linear-gradient(135deg, #f1f5f9, #cbd5e1)";
        btn.appendChild(bg);
        btn.appendChild(tokenPattern);
      }
    } else {
      if (previewCard.backImage) {
        const img = document.createElement("img");
        img.src = previewCard.backImage;
        img.className = "bg-img";
        btn.appendChild(img);
      } else {
        const pattern = document.createElement("div");
        pattern.className = "card-back-pattern";
        pattern.style.fontSize = "11px";
        pattern.textContent = "BACK";
        btn.appendChild(pattern);
      }
    }

    cWrap.appendChild(btn);
    cardContainer.appendChild(cWrap);

    if (previewCard.counters && previewCard.counters.length > 0) {
      const cb = document.createElement("div");
      cb.style.cssText = "display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; width: 100%; margin-top: 6px;";
      previewCard.counters.forEach(function(cnt) {
        const tag = document.createElement("span");
        tag.className = "card-counter-tag";
        tag.style.fontSize = "13px";
        tag.style.padding = "4px 8px";
        tag.textContent = cnt.name + ":" + cnt.value;
        cb.appendChild(tag);
      });
      cardContainer.appendChild(cb);
    }
  }

  buildPreviewCardDOM();

  const memoWrap = document.createElement("div");
  memoWrap.style.cssText = "display: flex; flex-direction: column; gap: 4px; width: 100%; margin-top: 4px;";
  const memoLabel = document.createElement("span");
  memoLabel.style.cssText = "font-size: 13px; color: #c4b5fd; font-weight: 800; letter-spacing: 0.05em;";
  memoLabel.textContent = "メモ";
  const memoTextarea = document.createElement("textarea");
  memoTextarea.rows = 4;
  memoTextarea.value = previewCard.memo || "";
  memoTextarea.style.cssText = "font-size: 14px; width: 100%; resize: vertical;";
  
  memoTextarea.oninput = function(e) {
    previewCard.memo = e.target.value;
    const zoomTextarea = $("zoomMemoTextarea");
    if (zoomTextarea && zoomTextarea !== memoTextarea) zoomTextarea.value = previewCard.memo;
  };

  memoWrap.appendChild(memoLabel);
  memoWrap.appendChild(memoTextarea);
  body.appendChild(ctrlBar);
  body.appendChild(cardContainer);
  body.appendChild(memoWrap);
}

function renderEditor() {
  const list = $("editorList");
  list.innerHTML = "";
  cards.forEach(function(card, idx) {
    const row = document.createElement("div");
    row.className = "editor-row";

    const handle = document.createElement("div");
    handle.className = "drag-handle";
    handle.textContent = "⠿";
    handle.draggable = true;
    handle.ondragstart = function(e) { e.dataTransfer.setData("text/plain", JSON.stringify({ editIndex: idx })); };

    row.ondragover = function(e) { e.preventDefault(); };
    row.ondrop = function(e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (data.editIndex !== undefined && data.editIndex !== idx) {
          const moved = cards.splice(data.editIndex, 1)[0];
          cards.splice(idx, 0, moved);
          saveCards();
          render();
        }
      } catch (err) {}
    };

    const imgContainer = document.createElement("div");
    imgContainer.className = "image-pick-container";

    const wrapFront = document.createElement("div");
    wrapFront.className = "image-pick-wrap";
    const labelFront = document.createElement("label");
    labelFront.className = "image-pick";
    wrapFront.ondragover = function(e) { e.preventDefault(); };
    wrapFront.ondrop = function(e) {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.indexOf("image/") === 0) {
        const reader = new FileReader();
        reader.onload = function() { card.image = String(reader.result); saveCards(); render(); };
        reader.readAsDataURL(file);
      }
    };

    wrapFront.oncontextmenu = function(e) {
      e.preventDefault();
      if (card.image) {
        previewCard = { name: card.name + " (表)", image: card.image, isFacedUp: true };
        renderPreviewPanel();
        addLog(card.name + "の表画像をPREVIEWに表示しました");
      }
    };

    if (card.image) {
      labelFront.innerHTML = '<img src="' + card.image + '" alt="表">';
      const clearFront = document.createElement("button");
      clearFront.className = "image-clear-btn";
      clearFront.textContent = "✕";
      clearFront.onclick = function(e) { e.preventDefault(); card.image = ""; saveCards(); render(); };
      wrapFront.appendChild(clearFront);
    } else {
      labelFront.innerHTML = '<span style="font-size:10px; font-weight:bold;">表</span>';
    }
    const fileFront = document.createElement("input");
    fileFront.type = "file";
    fileFront.accept = "image/*";
    fileFront.className = "field-file";
    fileFront.onchange = function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function() { card.image = String(reader.result); saveCards(); render(); };
      reader.readAsDataURL(file);
    };
    labelFront.appendChild(fileFront);
    wrapFront.appendChild(labelFront);

    const wrapBack = document.createElement("div");
    wrapBack.className = "image-pick-wrap";
    const labelBack = document.createElement("label");
    labelBack.className = "image-pick";
    wrapBack.ondragover = function(e) { e.preventDefault(); };
    wrapBack.ondrop = function(e) {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.indexOf("image/") === 0) {
        const reader = new FileReader();
        reader.onload = function() { card.backImage = String(reader.result); saveCards(); render(); };
        reader.readAsDataURL(file);
      }
    };

    wrapBack.oncontextmenu = function(e) {
      e.preventDefault();
      if (card.backImage) {
        previewCard = { name: card.name + " (裏)", backImage: card.backImage, isFacedUp: false };
        renderPreviewPanel();
        addLog(card.name + "の裏画像をPREVIEWに表示しました");
      }
    };

    if (card.backImage) {
      labelBack.innerHTML = '<img src="' + card.backImage + '" alt="裏">';
      const clearBack = document.createElement("button");
      clearBack.className = "image-clear-btn";
      clearBack.textContent = "✕";
      clearBack.onclick = function(e) { e.preventDefault(); card.backImage = ""; saveCards(); render(); };
      wrapBack.appendChild(clearBack);
    } else {
      labelBack.innerHTML = '<span style="font-size:10px; font-weight:bold; color:#64748b;">裏</span>';
    }
    const fileBack = document.createElement("input");
    fileBack.type = "file";
    fileBack.accept = "image/*";
    fileBack.className = "field-file";
    fileBack.onchange = function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function() { card.backImage = String(reader.result); saveCards(); render(); };
      reader.readAsDataURL(file);
    };
    labelBack.appendChild(fileBack);
    wrapBack.appendChild(labelBack);

    imgContainer.appendChild(wrapFront);
    imgContainer.appendChild(wrapBack);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = card.name;
    nameInput.oninput = function(e) { card.name = e.target.value; saveCards(); renderCounts(); };

    const countInput = document.createElement("input");
    countInput.type = "number";
    countInput.min = "0";
    countInput.max = "99";
    countInput.value = card.count;
    countInput.oninput = function(e) { card.count = Math.max(0, Number(e.target.value) || 0); saveCards(); renderCounts(); };

    const delBtn = document.createElement("button");
    delBtn.className = "btn danger-ghost";
    delBtn.style.cssText = "padding: 6px; width: 32px; height: 32px;";
    delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    delBtn.onclick = function() { cards = cards.filter(function(item) { return item.id !== card.id; }); saveCards(); render(); };

    row.appendChild(handle);
    row.appendChild(imgContainer);
    row.appendChild(nameInput);
    row.appendChild(countInput);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
  const totalCards = cards.reduce(function(sum, c) { return sum + (Number(c.count) || 0); }, 0);
  $("modalTotalCount").textContent = "合計 " + totalCards + "枚";
}

function syncSetupItemsWithFields() {
  const currentFieldIds = new Set(fields.map(function(f) { return f.id; }));
  setupItems = setupItems.filter(function(item) { return item.type === 'hand' || currentFieldIds.has(item.id); });
  fields.forEach(function(f) {
    if (!setupItems.some(function(item) { return item.id === f.id; })) {
      setupItems.push({ id: f.id, type: "field", name: f.name, count: 0, facing: "up", pos: "top" });
    } else {
      const item = setupItems.find(function(i) { return i.id === f.id; });
      if (item) item.name = f.name;
    }
  });
}

function renderSetupModalList() {
  syncSetupItemsWithFields();
  const list = $("setupModalList");
  list.innerHTML = "";

  setupItems.forEach(function(item, idx) {
    const row = document.createElement("div");
    row.className = "editor-row";
    row.style.cssText = "display: flex; flex-direction: row; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;";

    const handle = document.createElement("div");
    handle.className = "drag-handle";
    handle.textContent = "⠿";
    handle.draggable = true;
    handle.ondragstart = function(e) { e.dataTransfer.setData("text/plain", JSON.stringify({ setupIndex: idx })); };

    row.ondragover = function(e) { e.preventDefault(); };
    row.ondrop = function(e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (data.setupIndex !== undefined && data.setupIndex !== idx) {
          const moved = setupItems.splice(data.setupIndex, 1)[0];
          setupItems.splice(idx, 0, moved);
          saveCards();
          renderSetupModalList();
        }
      } catch (err) {}
    };

    const nameSpan = document.createElement("span");
    nameSpan.style.cssText = "font-weight: bold; font-size: 13px; width: 75px; white-space: nowrap;";
    nameSpan.textContent = item.name;

    const controls = document.createElement("div");
    controls.style.cssText = "display: flex; gap: 6px; align-items: center; font-size: 12px; flex: 1; justify-content: flex-end; flex-wrap: wrap;";

    const countLabel = document.createElement("span");
    countLabel.textContent = "枚数:";
    const countInput = document.createElement("input");
    countInput.type = "number";
    countInput.min = "0";
    countInput.max = "99";
    countInput.value = item.count !== undefined ? item.count : 0;
    countInput.style.cssText = "width: 48px; height: 28px; text-align: center;";
    countInput.oninput = function(e) { 
      item.count = Math.max(0, Number(e.target.value) || 0); 
      saveCards();
    };

    const facingToggleBtn = document.createElement("button");
    facingToggleBtn.type = "button";
    facingToggleBtn.className = "btn secondary";
    facingToggleBtn.style.cssText = "width: 45px; height: 28px; padding: 0; justify-content: center; font-size: 12px;";
    const isUp = item.facing !== "down";
    facingToggleBtn.textContent = isUp ? "表" : "裏";
    facingToggleBtn.style.background = isUp ? "rgba(255,255,255,0.1)" : "#7c3aed";
    facingToggleBtn.onclick = function() {
      item.facing = item.facing === "down" ? "up" : "down";
      const nowUp = item.facing !== "down";
      facingToggleBtn.textContent = nowUp ? "表" : "裏";
      facingToggleBtn.style.background = nowUp ? "rgba(255,255,255,0.1)" : "#7c3aed";
      saveCards();
    };

    const deckLabel = document.createElement("span");
    deckLabel.textContent = "山札";

    const posToggleBtn = document.createElement("button");
    posToggleBtn.type = "button";
    posToggleBtn.className = "btn secondary";
    posToggleBtn.style.cssText = "width: 45px; height: 28px; padding: 0; justify-content: center; font-size: 12px;";
    const isTop = item.pos !== "bottom";
    posToggleBtn.textContent = isTop ? "上" : "下";
    posToggleBtn.style.background = isTop ? "rgba(255,255,255,0.1)" : "#7c3aed";
    posToggleBtn.onclick = function() {
      item.pos = item.pos === "bottom" ? "top" : "bottom";
      const nowTop = item.pos !== "bottom";
      posToggleBtn.textContent = nowTop ? "上" : "下";
      posToggleBtn.style.background = nowTop ? "rgba(255,255,255,0.1)" : "#7c3aed";
      saveCards();
    };

    controls.appendChild(countLabel);
    controls.appendChild(countInput);
    controls.appendChild(facingToggleBtn);
    controls.appendChild(deckLabel);
    controls.appendChild(posToggleBtn);
    row.appendChild(handle);
    row.appendChild(nameSpan);
    row.appendChild(controls);
    list.appendChild(row);
  });
}

function renderCardTreeNode(card, f) {
  const nodeEl = document.createElement("div");
  nodeEl.className = "card-tree-node";

  const cardContainerEl = createCardContainerElement(card, false, function() {
    executeCardAction(card, f.cards, f.cards.findIndex(function(c) { return c.instanceId === card.instanceId; }), f.clickAction || "hand", f.clickFacing || "up", { pos: f.clickDeckPos, num: f.clickDeckNum });
  }, { type: 'field', fieldId: f.id, index: f.cards.findIndex(function(c) { return c.instanceId === card.instanceId; }) }, f.enableClick !== false);

  cardContainerEl.ondragover = function(e) {
    e.preventDefault();
    const zone = cardContainerEl.closest(".zone");
    if (zone) zone.dataset.dropIndex = f.cards.findIndex(function(c) { return c.instanceId === card.instanceId; });
  };

  nodeEl.appendChild(cardContainerEl);

  const children = f.cards.filter(function(c) { return c.parentId === card.instanceId; });
  if (children.length > 0) {
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "card-tree-children";
    children.forEach(function(childCard) { childrenContainer.appendChild(renderCardTreeNode(childCard, f)); });
    nodeEl.appendChild(childrenContainer);
  }

  return nodeEl;
}

function renderZones() {
  const fieldsContainer = $("fieldsContainer");
  fieldsContainer.innerHTML = "";

  fields.forEach(function(f) {
    const details = document.createElement("details");
    details.className = "panel field-card-panel";
    details.open = f.isOpen !== false;
    details.ontoggle = function() { f.isOpen = details.open; };

    const summary = document.createElement("summary");
    summary.className = "panel-head";
    
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = f.name;
    nameInput.style.cssText = "width: 110px; font-weight: bold; font-size: 15px;";
    nameInput.oninput = function(e) { 
      f.name = e.target.value; 
      syncSetupItemsWithFields();
      saveCards();
      updateAllActionSelects(); 
    };

    const headActions = document.createElement("div");
    headActions.className = "actions";
    headActions.onclick = function(e) { e.stopPropagation(); };

    const fieldControls = document.createElement("div");
    fieldControls.className = "controls-bar";

    const fieldPrivacyToggle = document.createElement("button");
    fieldPrivacyToggle.type = "button";
    fieldPrivacyToggle.className = "btn secondary";
    fieldPrivacyToggle.id = "fieldPrivacyToggle_" + f.id;
    fieldPrivacyToggle.style.cssText = "background: " + (f.isPrivate !== false ? "#7c3aed" : "rgba(255,255,255,0.1)") + "; font-size: 12px; padding: 4px 8px;";
    fieldPrivacyToggle.textContent = f.isPrivate !== false ? "非公開" : "公開";
    fieldPrivacyToggle.title = "右クリック時の動作切替";
    fieldPrivacyToggle.onclick = function(e) {
      e.stopPropagation();
      f.isPrivate = f.isPrivate === false ? true : false;
      fieldPrivacyToggle.textContent = f.isPrivate ? "非公開" : "公開";
      fieldPrivacyToggle.style.background = f.isPrivate ? "#7c3aed" : "rgba(255,255,255,0.1)";
      saveCards();
      addLog(f.name + "の公開・非公開を「" + (f.isPrivate ? "非公開" : "公開") + "」に変更しました");
    };

    const enableClickLabel = document.createElement("label");
    enableClickLabel.style.cssText = "display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; margin-right: 4px;";
    const enableClickInput = document.createElement("input");
    enableClickInput.type = "checkbox";
    enableClickInput.id = "fieldEnableClick_" + f.id;
    enableClickInput.style.width = "auto";
    enableClickInput.checked = f.enableClick !== false;
    enableClickInput.onchange = function(e) { f.enableClick = e.target.checked; saveCards(); renderZones(); };
    enableClickLabel.appendChild(enableClickInput);
    enableClickLabel.appendChild(document.createTextNode(" クリック時:"));

    const actionSelect = document.createElement("select");
    actionSelect.id = "fieldActionSelect_" + f.id;
    actionSelect.style.width = "auto";
    buildDestinationOptions(actionSelect, "field", f.id);
    actionSelect.value = f.clickAction || "hand";
    actionSelect.onchange = function(e) {
      f.clickAction = e.target.value;
      deckOptions.style.display = f.clickAction === "deck" ? "flex" : "none";
      saveCards();
    };

    const facingToggle = document.createElement("button");
    facingToggle.type = "button";
    facingToggle.className = "btn secondary";
    facingToggle.style.cssText = "width: 45px; height: 30px; padding: 0; justify-content: center; font-size: 12px;";
    facingToggle.textContent = f.clickFacing === "down" ? "裏" : "表";
    facingToggle.style.background = f.clickFacing === "down" ? "#7c3aed" : "rgba(255,255,255,0.1)";
    facingToggle.onclick = function() {
      f.clickFacing = f.clickFacing === "up" ? "down" : "up";
      facingToggle.textContent = f.clickFacing === "up" ? "表" : "裏";
      facingToggle.style.background = f.clickFacing === "up" ? "rgba(255,255,255,0.1)" : "#7c3aed";
      saveCards();
    };

    const deckOptions = document.createElement("div");
    deckOptions.id = "fieldDeckOptions_" + f.id;
    deckOptions.style.cssText = "display: " + (f.clickAction === "deck" ? "flex" : "none") + "; align-items: center; gap: 4px;";

    const deckPos = document.createElement("select");
    deckPos.style.width = "60px";
    deckPos.innerHTML = '<option value="top">上</option><option value="bottom">下</option>';
    deckPos.value = f.clickDeckPos || "top";
    deckPos.onchange = function(e) { f.clickDeckPos = e.target.value; saveCards(); };

    const deckNum = document.createElement("input");
    deckNum.type = "number";
    deckNum.min = "1";
    deckNum.value = f.clickDeckNum || 1;
    deckNum.style.width = "45px";
    deckNum.oninput = function(e) { f.clickDeckNum = Math.max(1, Number(e.target.value) || 1); saveCards(); };

    deckOptions.appendChild(deckPos);
    deckOptions.appendChild(deckNum);
    const spanNum = document.createElement("span");
    spanNum.textContent = "番目";
    deckOptions.appendChild(spanNum);

    fieldControls.appendChild(fieldPrivacyToggle);
    fieldControls.appendChild(enableClickLabel);
    fieldControls.appendChild(actionSelect);
    fieldControls.appendChild(facingToggle);
    fieldControls.appendChild(deckOptions);
    headActions.appendChild(fieldControls);

    const spawnGroup = document.createElement("div");
    spawnGroup.style.cssText = "display: flex; gap: 4px; align-items: center;";

    const spawnTypeSelect = document.createElement("select");
    spawnTypeSelect.style.cssText = "width: 75px; height: 30px; font-size: 12px;";
    spawnTypeSelect.innerHTML = '<option value="deck">DECK</option><option value="token">トークン</option>';

    const pullFacingToggle = document.createElement("button");
    pullFacingToggle.type = "button";
    pullFacingToggle.className = "btn secondary";
    pullFacingToggle.style.cssText = "width: 40px; height: 30px; padding: 0; justify-content: center; font-size: 12px;";
    pullFacingToggle.textContent = f.facing === "down" ? "裏" : "表";
    pullFacingToggle.style.background = f.facing === "down" ? "#7c3aed" : "rgba(255,255,255,0.1)";
    pullFacingToggle.onclick = function() {
      f.facing = f.facing === "up" ? "down" : "up";
      pullFacingToggle.textContent = f.facing === "up" ? "表" : "裏";
      pullFacingToggle.style.background = f.facing === "up" ? "rgba(255,255,255,0.1)" : "#7c3aed";
    };

    const spawnNumInput = document.createElement("input");
    spawnNumInput.type = "number";
    spawnNumInput.min = "1";
    spawnNumInput.max = "99";
    spawnNumInput.value = "1";
    spawnNumInput.style.cssText = "width: 45px; height: 30px; text-align: center;";

    const spawnBtn = document.createElement("button");
    spawnBtn.className = "btn secondary";
    spawnBtn.style.cssText = "padding: 4px 10px; height: 30px; font-size: 12px;";
    spawnBtn.textContent = "出す";
    spawnBtn.onclick = function() {
      const count = Math.max(1, Number(spawnNumInput.value) || 1);
      if (spawnTypeSelect.value === "deck") {
        if (!deck.length) { addLog("デッキにカードがありません"); return; }
        const actual = Math.min(count, deck.length);
        deck.splice(0, actual).forEach(function(card) {
          card.isFacedUp = f.facing === "up";
          card.parentId = null;
          f.cards.push(card);
        });
        addLog("デッキから" + actual + "枚のカードを" + f.name + "に出しました");
      } else {
        for (let i = 0; i < count; i++) {
          const newToken = {
            id: uid(),
            instanceId: "token-" + uid(),
            baseName: "トークン",
            name: "トークン",
            isToken: true,
            isFacedUp: true,
            rotation: 0,
            parentId: null,
            counters: [],
            memo: "",
            color: "linear-gradient(135deg, #f1f5f9, #cbd5e1)"
          };
          f.cards.push(newToken);
        }
        addLog(f.name + "にトークンを" + count + "枚追加しました");
      }
      render();
    };

    spawnGroup.appendChild(spawnTypeSelect);
    spawnGroup.appendChild(pullFacingToggle);
    spawnGroup.appendChild(spawnNumInput);
    spawnGroup.appendChild(spawnBtn);
    headActions.appendChild(spawnGroup);

    if (fields.length > 1) {
      const deleteFieldBtn = document.createElement("button");
      deleteFieldBtn.className = "btn danger-ghost";
      deleteFieldBtn.style.cssText = "padding: 0; width: 30px; height: 30px; justify-content: center; font-weight: bold; font-size: 16px;";
      deleteFieldBtn.textContent = "×";
      deleteFieldBtn.onclick = function() {
        f.cards.forEach(function(c) { c.isFacedUp = true; c.parentId = null; });
        hand.push.apply(hand, f.cards);
        fields = fields.filter(function(item) { return item.id !== f.id; });
        syncSetupItemsWithFields();
        saveCards();
        addLog(f.name + "を削除しました");
        render();
      };
      headActions.appendChild(deleteFieldBtn);
    }

    summary.appendChild(nameInput);
    summary.appendChild(headActions);
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "panel-body";
    const zone = document.createElement("div");
    zone.className = "zone";
    setupDropZone(zone, "field", f.id);

    if (f.cards.length) {
      f.cards.filter(function(c) { return !c.parentId || !f.cards.some(function(p) { return p.instanceId === c.parentId; }); }).forEach(function(rootCard) {
        zone.appendChild(renderCardTreeNode(rootCard, f));
      });
    } else {
      zone.innerHTML = '<div class="empty-zone">手札からカードをクリックするか、DECKやトークンを出すと' + f.name + 'に配置されます</div>';
    }

    body.appendChild(zone);
    details.appendChild(body);
    fieldsContainer.appendChild(details);
  });

  const handZone = $("handZone");
  handZone.innerHTML = "";
  setupDropZone(handZone, "hand");

  if (hand.length) {
    hand.forEach(function(card, cardIdx) {
      card.isFacedUp = true;
      card.parentId = null;
      const cardContainerEl = createCardContainerElement(card, true, function() {
        executeCardAction(card, hand, cardIdx, $("handActionSelect").value, handFacing, { pos: $("handDeckPos").value, num: $("handDeckNum").value });
      }, { type: 'hand', index: cardIdx }, handEnableClick);

      cardContainerEl.ondragover = function(e) { e.preventDefault(); handZone.dataset.dropIndex = cardIdx; };
      handZone.appendChild(cardContainerEl);
    });
  } else {
    handZone.innerHTML = '<div class="empty-hand">手札はありません</div>';
  }

  setupDropZone($("deckDropZone"), "deck");
  setupDropZone($("discardDropZone"), "discard");
  updateAllActionSelects();
}

function renderInspectList(container, cardList, srcType) {
  container.innerHTML = "";
  if (cardList.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #64748b; padding: 20px;">カードはありません</div>';
    return;
  }

  cardList.forEach(function(card, idx) {
    const item = document.createElement("div");
    item.className = "deck-list-item";

    item.oncontextmenu = function(e) {
      e.preventDefault();
      previewCard = card;
      renderPreviewPanel();
      addLog(card.name + "をPREVIEW領域に表示しました");
    };

    const handle = document.createElement("div");
    handle.className = "drag-handle";
    handle.textContent = "⠿";
    handle.draggable = true;
    handle.ondragstart = function(e) { e.dataTransfer.setData("text/plain", JSON.stringify({ inspectIndex: idx, inspectType: srcType })); };

    item.ondragover = function(e) { e.preventDefault(); };
    item.ondrop = function(e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (data.inspectIndex !== undefined && data.inspectType === srcType && data.inspectIndex !== idx) {
          const moved = cardList.splice(data.inspectIndex, 1)[0];
          cardList.splice(idx, 0, moved);
          if (srcType === "deck") renderDeckInspect();
          else if (srcType === "discard") renderDiscardInspect();
          render();
        }
      } catch (err) {}
    };

    item.appendChild(handle);

    const info = document.createElement("div");
    info.style.cssText = "display: flex; align-items: center; gap: 8px; margin-right: auto; text-align: left;";
    
    const isFacedUp = card.isFacedUp !== false;
    const isCardPublicInDeck = (srcType === "deck") 
      ? (isDeckPublic || card.isIndividuallyPublic === true)
      : true;

    const displayName = isCardPublicInDeck ? card.name : "非公開カード";
    info.textContent = (idx + 1) + ": " + displayName;

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.style.cssText = "display: flex; gap: 6px; align-items: center;";

    if (srcType === "deck") {
      const publicToggleBtn = document.createElement("button");
      publicToggleBtn.type = "button";
      publicToggleBtn.className = "btn secondary";
      publicToggleBtn.style.cssText = "padding: 2px 8px; font-size: 11px;";
      
      const isIndPublic = card.isIndividuallyPublic === true;
      publicToggleBtn.textContent = isIndPublic ? "公開" : "非公開";
      publicToggleBtn.style.background = isIndPublic ? "rgba(255,255,255,0.1)" : "#7c3aed";

      publicToggleBtn.onclick = function() {
        card.isIndividuallyPublic = !isIndPublic;
        renderDeckInspect();
        renderZones();
      };
      actions.appendChild(publicToggleBtn);
    }

    const facingToggleBtn = document.createElement("button");
    facingToggleBtn.type = "button";
    facingToggleBtn.className = "btn secondary";
    facingToggleBtn.style.cssText = "padding: 2px 8px; font-size: 11px;";
    facingToggleBtn.textContent = isFacedUp ? "表" : "裏";
    facingToggleBtn.style.background = isFacedUp ? "rgba(255,255,255,0.1)" : "#7c3aed";
    facingToggleBtn.onclick = function() {
      card.isFacedUp = !isFacedUp;
      if (srcType === "deck") renderDeckInspect();
      else renderDiscardInspect();
      renderZones();
    };
    actions.appendChild(facingToggleBtn);

    const targetSelect = document.createElement("select");
    targetSelect.style.cssText = "width: auto; height: 28px; font-size: 11px; padding: 2px 4px;";
    buildDestinationOptions(targetSelect, srcType);

    const deckOptWrap = document.createElement("div");
    deckOptWrap.style.cssText = "display: none; align-items: center; gap: 4px; font-size: 11px;";

    const deckPos = document.createElement("select");
    deckPos.style.cssText = "width: 50px; height: 28px; font-size: 11px; padding: 2px;";
    deckPos.innerHTML = '<option value="top">上</option><option value="bottom">下</option>';

    const deckNum = document.createElement("input");
    deckNum.type = "number";
    deckNum.min = "1";
    deckNum.value = "1";
    deckNum.style.cssText = "width: 40px; height: 28px; font-size: 11px; padding: 2px; text-align: center;";

    deckOptWrap.appendChild(deckPos);
    deckOptWrap.appendChild(deckNum);
    deckOptWrap.appendChild(document.createTextNode("番目"));

    targetSelect.onchange = function() {
      deckOptWrap.style.display = targetSelect.value === "deck" ? "flex" : "none";
    };

    const moveBtn = document.createElement("button");
    moveBtn.type = "button";
    moveBtn.className = "btn primary";
    moveBtn.style.cssText = "padding: 2px 10px; font-size: 11px;";
    moveBtn.textContent = "移動";
    moveBtn.onclick = function() {
      const action = targetSelect.value;
      executeCardAction(card, cardList, idx, action, card.isFacedUp ? "up" : "down", {
        pos: deckPos.value,
        num: Number(deckNum.value) || 1
      });
      if (srcType === "deck") renderDeckInspect();
      else if (srcType === "discard") renderDiscardInspect();
    };

    actions.appendChild(targetSelect);
    actions.appendChild(deckOptWrap);
    actions.appendChild(moveBtn);
    item.appendChild(info);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

function renderDeckInspect() {
  const list = $("deckInspectList");
  const countBadge = $("deckInspectCount");
  countBadge.textContent = deck.length + "枚";
  renderInspectList(list, deck, "deck");
}

function renderDiscardInspect() {
  const list = $("discardInspectList");
  const countBadge = $("discardInspectCount");
  countBadge.textContent = discard.length + "枚";
  renderInspectList(list, discard, "discard");
}

function renderHandInspect() {
  const list = $("handInspectList");
  const countBadge = $("handInspectCount");
  countBadge.textContent = hand.length + "枚";
  list.innerHTML = "";

  if (hand.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: #64748b; padding: 20px; width: 100%;">手札はありません</div>';
    return;
  }

  hand.forEach(function(card) {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";
    wrap.style.flexShrink = "0";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "game-card zoom-card-large";
    btn.style.cursor = "pointer";

    if (card.image) {
      const img = document.createElement("img");
      img.src = card.image;
      img.className = "bg-img";
      btn.appendChild(img);
    } else {
      const bg = document.createElement("div");
      bg.className = "bg-gradient";
      bg.style.background = card.color || "linear-gradient(135deg, #8b5cf6, #701a75)";
      btn.appendChild(bg);
    }
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    btn.appendChild(overlay);

    const content = document.createElement("div");
    content.className = "card-content-text";
    const p = document.createElement("p");
    p.style.cssText = "font-size: 14px; -webkit-line-clamp: unset;";
    p.textContent = card.name;
    content.appendChild(p);
    btn.appendChild(content);

    btn.onclick = function() {
      openZoomModal(card);
    };

    wrap.appendChild(btn);
    list.appendChild(wrap);
  });
}

function render() {
  renderEditor();
  renderZones();
  renderCounts();
  renderCounterList();
  renderPreviewPanel();
}

/* ==========================================
   6. モーダル操作・詳細画面
   ========================================== */
function openZoomModal(card) {
  const container = $("zoomCardContainer");
  const chainListEl = $("zoomChainList");
  const toggleBtn = $("zoomFacingToggleBtn");
  const nameInput = $("zoomCardNameInput");
  const rotateInput = $("zoomRotateInput");
  const parentSelect = $("zoomParentSelect");
  const counterListEl = $("zoomCounterList");
  const memoTextarea = $("zoomMemoTextarea");
  
  let zoomIsFacedUp = card.isFacedUp !== false;
  let everRevealed = zoomIsFacedUp;
  let currentRotation = card.rotation || 0;
  rotateInput.value = currentRotation;
  nameInput.value = card.name || "";
  memoTextarea.value = card.memo || "";

  nameInput.oninput = function(e) {
    card.name = e.target.value;
    updateZoomCardView();
    renderZones();
    renderPreviewPanel();
  };

  memoTextarea.oninput = function(e) {
    card.memo = e.target.value;
    if (previewCard && previewCard.instanceId === card.instanceId) {
      const previewTextarea = document.querySelector("#previewBody textarea");
      if (previewTextarea && previewTextarea !== memoTextarea) previewTextarea.value = card.memo;
    }
  };

  let currentField = fields.find(function(f) { return f.cards.some(function(c) { return c.instanceId === card.instanceId; }); });

  function renderZoomCounters() {
    counterListEl.innerHTML = "";
    if (!card.counters) card.counters = [];
    if (card.counters.length === 0) {
      counterListEl.innerHTML = '<div style="color: #64748b; font-size: 11px; text-align: center; padding: 10px;">カウンターはありません</div>';
      return;
    }

    card.counters.forEach(function(cnt, cIdx) {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.04); padding: 4px 8px; border-radius: 6px; position: relative; width: 100%;";

      const delB = document.createElement("button");
      delB.className = "counter-del-btn";
      delB.textContent = "✕";
      delB.onclick = function() {
        card.counters.splice(cIdx, 1);
        renderZoomCounters();
        renderZones();
        renderPreviewPanel();
      };

      const cNameInput = document.createElement("input");
      cNameInput.type = "text";
      cNameInput.value = cnt.name;
      cNameInput.style.cssText = "flex: 1; height: 28px; font-size: 12px; padding: 2px 6px;";
      cNameInput.oninput = function(e) {
        cnt.name = e.target.value;
        renderZones();
        renderPreviewPanel();
      };

      const cValInput = document.createElement("input");
      cValInput.type = "number";
      cValInput.min = "0";
      cValInput.value = cnt.value;
      cValInput.style.cssText = "width: 55px; height: 28px; font-size: 12px; padding: 2px; text-align: center; font-weight: bold;";
      cValInput.oninput = function(e) {
        cnt.value = Math.max(0, Number(e.target.value) || 0);
        renderZones();
        renderPreviewPanel();
      };

      row.appendChild(delB);
      row.appendChild(cNameInput);
      row.appendChild(cValInput);
      counterListEl.appendChild(row);
    });
  }

  $("zoomAddCounterBtn").onclick = function() {
    if (!card.counters) card.counters = [];
    card.counters.push({ id: uid(), name: "C" + (card.counters.length + 1), value: 0 });
    renderZoomCounters();
    renderZones();
    renderPreviewPanel();
  };

  function renderZoomChain() {
    chainListEl.innerHTML = "";
    if (!currentField) return;

    const ancestors = getAncestorChain(currentField.cards, card);
    const descendants = getAllDescendants(currentField.cards, card.instanceId);
    const uniqueChain = Array.from(new Set(ancestors.concat(descendants).map(function(c) { return c.instanceId; }))).map(function(id) {
      return ancestors.concat(descendants).find(function(c) { return c.instanceId === id; });
    });

    uniqueChain.forEach(function(c, index) {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; align-items: center; gap: 6px; padding-left: " + (Math.max(0, ancestors.indexOf(c)) * 12) + "px";

      const isCurrent = c.instanceId === card.instanceId;
      const linkSpan = document.createElement("span");
      linkSpan.style.cssText = "cursor: " + (isCurrent ? 'default' : 'pointer') + "; color: " + (isCurrent ? '#c4b5fd' : '#38bdf8') + "; text-decoration: " + (isCurrent ? 'none' : 'underline') + "; font-weight: " + (isCurrent ? 'bold' : 'normal') + ";";
      linkSpan.textContent = (index > 0 ? '↳ ' : '') + ((c.isFacedUp !== false) ? c.name : '非公開カード') + (isCurrent ? ' (このカード)' : '');

      if (!isCurrent) linkSpan.onclick = function() { openZoomModal(c); };
      row.appendChild(linkSpan);
      chainListEl.appendChild(row);
    });
  }

  parentSelect.innerHTML = '<option value="">(なし / 親)</option>';
  if (currentField) {
    const descendantIds = new Set(getAllDescendants(currentField.cards, card.instanceId).map(function(d) { return d.instanceId; }));
    currentField.cards.forEach(function(c, idx) {
      if (c.instanceId !== card.instanceId && !descendantIds.has(c.instanceId)) {
        const opt = document.createElement("option");
        opt.value = c.instanceId;
        opt.textContent = (c.isFacedUp !== false) ? c.name : ("#" + (idx + 1) + " (非公開)");
        parentSelect.appendChild(opt);
      }
    });
  }
  parentSelect.value = card.parentId || "";
  parentSelect.onchange = function(e) {
    card.parentId = e.target.value || null;
    renderZoomChain();
    renderZones();
    addLog(card.name + "の親設定を変更しました");
  };

  function updateZoomCardView() {
    container.innerHTML = "";
    const zoomCard = document.createElement("div");
    zoomCard.className = "game-card zoom-card-large" + (!zoomIsFacedUp ? " faced-down" : "");
    zoomCard.style.cssText = "cursor: default; transform: rotate(" + currentRotation + "deg);";

    if (zoomIsFacedUp) {
      if (card.image) {
        const img = document.createElement("img");
        img.src = card.image;
        img.className = "bg-img";
        zoomCard.appendChild(img);
      } else {
        const bg = document.createElement("div");
        bg.className = "bg-gradient";
        bg.style.background = card.color || "linear-gradient(135deg, #8b5cf6, #701a75)";
        zoomCard.appendChild(bg);
      }
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      zoomCard.appendChild(overlay);

      if (everRevealed) {
        const content = document.createElement("div");
        content.className = "card-content-text";
        const p = document.createElement("p");
        p.style.cssText = "font-size: 14px; -webkit-line-clamp: unset;";
        p.textContent = card.name;
        content.appendChild(p);
        zoomCard.appendChild(content);
      }

      if (card.isToken) {
        const tokenPattern = document.createElement("div");
        tokenPattern.className = "token-card-pattern";
        tokenPattern.style.fontSize = "12px";
        tokenPattern.textContent = card.name || "トークン";
        zoomCard.innerHTML = "";
        const bg = document.createElement("div");
        bg.className = "bg-gradient";
        bg.style.background = card.color || "linear-gradient(135deg, #f1f5f9, #cbd5e1)";
        zoomCard.appendChild(bg);
        zoomCard.appendChild(tokenPattern);
      }
    } else {
      if (card.backImage) {
        const img = document.createElement("img");
        img.src = card.backImage;
        img.className = "bg-img";
        zoomCard.appendChild(img);
      } else {
        const pattern = document.createElement("div");
        pattern.className = "card-back-pattern";
        pattern.style.fontSize = "14px";
        pattern.textContent = "BACK";
        zoomCard.appendChild(pattern);
      }
    }

    container.appendChild(zoomCard);
    toggleBtn.textContent = zoomIsFacedUp ? "裏にする" : "表にする";
    toggleBtn.style.background = zoomIsFacedUp ? "rgba(255,255,255,0.1)" : "#7c3aed";
  }

  rotateInput.oninput = function(e) {
    currentRotation = Number(e.target.value) || 0;
    syncCardRotation(card, currentRotation);
  };

  $("zoomRotatePlus90").onclick = function() {
    currentRotation = (currentRotation + 90) > 360 ? 0 : currentRotation + 90;
    rotateInput.value = currentRotation;
    syncCardRotation(card, currentRotation);
    updateZoomCardView();
  };
  $("zoomRotateZero").onclick = function() {
    currentRotation = 0;
    rotateInput.value = 0;
    syncCardRotation(card, 0);
    updateZoomCardView();
  };

  toggleBtn.onclick = function() {
    zoomIsFacedUp = !zoomIsFacedUp;
    if (zoomIsFacedUp) everRevealed = true;
    card.isFacedUp = zoomIsFacedUp;
    updateZoomCardView();
    renderZones();
  };

  renderZoomChain();
  renderZoomCounters();
  updateZoomCardView();
  openModal("zoomModal");
}

/* ==========================================
   7. イベントリスナー登録 & 初期化
   ========================================== */
$("handFacingToggleBtn").onclick = function() {
  handFacing = handFacing === "up" ? "down" : "up";
  $("handFacingToggleBtn").textContent = handFacing === "up" ? "表" : "裏";
  $("handFacingToggleBtn").style.background = handFacing === "up" ? "rgba(255,255,255,0.1)" : "#7c3aed";
};

$("handPrivacyToggleBtn").onclick = function() {
  handIsPrivate = !handIsPrivate;
  $("handPrivacyToggleBtn").textContent = handIsPrivate ? "非公開" : "公開";
  $("handPrivacyToggleBtn").style.background = handIsPrivate ? "#7c3aed" : "rgba(255,255,255,0.1)";
  addLog("公開・非公開を「" + (handIsPrivate ? "非公開" : "公開") + "」に変更しました");
  renderCounts();
};

$("handEnableClick").onchange = function(e) {
  handEnableClick = e.target.checked;
  renderZones();
};

$("deckVisibilityToggleBtn").onclick = function() {
  isDeckPublic = !isDeckPublic;
  $("deckVisibilityToggleBtn").textContent = isDeckPublic ? "公開" : "非公開";
  $("deckVisibilityToggleBtn").style.background = isDeckPublic ? "rgba(255,255,255,0.1)" : "#7c3aed";
  addLog("デッキの公開状態を「" + (isDeckPublic ? "公開" : "非公開") + "」に変更しました");
  if ($("deckInspectModal").classList.contains("active")) {
    renderDeckInspect();
  }
};

const setupModal = function(openBtnId, closeBtnId, modalId) {
  $(openBtnId).onclick = function() { openModal(modalId); };
  $(closeBtnId).onclick = function() { $(modalId).classList.remove("active"); };
  $(modalId).onclick = function(e) { if (e.target === $(modalId)) $(modalId).classList.remove("active"); };
};

setupModal("openHelpModalBtn", "helpModalClose", "helpModal");
$("helpModalCloseBtn").onclick = function() { $("helpModal").classList.remove("active"); };

$("openSetupModalBtn").onclick = function() {
  renderSetupModalList();
  openModal("setupModal");
};
$("setupModalClose").onclick = function() { $("setupModal").classList.remove("active"); };
$("setupModalCompleteBtn").onclick = function() {
  $("setupModal").classList.remove("active");
  saveCards();
  addLog("開始設定を保存しました");
};
$("setupModal").onclick = function(e) { if (e.target === $("setupModal")) $("setupModal").classList.remove("active"); };

$("addButton").onclick = function() {
  cards.push({
    id: uid(),
    name: "新カード " + (cards.length + 1),
    count: 1,
    image: "",
    backImage: "",
    color: colorPresets[cards.length % colorPresets.length]
  });
  saveCards();
  render();
};

$("openEditorModalBtn").onclick = function() {
  $("handDetails").open = false;
  openModal("editorModal");
};
const closeEditorModal = function() {
  $("handDetails").open = true;
  $("editorModal").classList.remove("active");
  render();
};
$("closeEditorModalBtn").onclick = closeEditorModal;
$("completeEditorBtn").onclick = closeEditorModal;
$("editorModal").onclick = function(e) {
  if (e.target === $("editorModal")) closeEditorModal();
};

$("openLogModalBtn").onclick = function() {
  renderLogs();
  openModal("logModal");
};
$("logModalClose").onclick = function() { $("logModal").classList.remove("active"); };
$("logModal").onclick = function(e) { if (e.target === $("logModal")) $("logModal").classList.remove("active"); };

$("inspectDeckBtn").onclick = function() {
  renderDeckInspect();
  openModal("deckInspectModal");
};
$("deckInspectClose").onclick = function() { $("deckInspectModal").classList.remove("active"); };
$("deckInspectModal").onclick = function(e) { if (e.target === $("deckInspectModal")) $("deckInspectModal").classList.remove("active"); };

$("inspectDiscardBtn").onclick = function() {
  renderDiscardInspect();
  openModal("discardInspectModal");
};
$("discardInspectClose").onclick = function() { $("discardInspectModal").classList.remove("active"); };
$("discardInspectModal").onclick = function(e) { if (e.target === $("discardInspectModal")) $("discardInspectModal").classList.remove("active"); };

$("inspectHandBtn").onclick = function() {
  renderHandInspect();
  openModal("handInspectModal");
};
$("handInspectClose").onclick = function() { $("handInspectModal").classList.remove("active"); };
$("handInspectModal").onclick = function(e) { if (e.target === $("handInspectModal")) $("handInspectModal").classList.remove("active"); };

$("clearLogBtn").onclick = function() { operationLogs = []; renderLogs(); };
$("zoomCloseBtn").onclick = function() { $("zoomModal").classList.remove("active"); };
$("zoomModal").onclick = function(e) { if (e.target === $("zoomModal")) $("zoomModal").classList.remove("active"); };

$("addCounterBtn").onclick = function() {
  counters.push({ id: uid(), name: "カウンタ " + (counters.length + 1), value: 0 });
  saveCounters();
  renderCounterList();
  addLog("新しいカウンタを追加しました");
};

$("addFieldBtn").onclick = function() {
  const num = fields.length + 1;
  const newField = {
    id: uid(), name: "場 " + num, cards: [], facing: "up", isOpen: true, isPrivate: true,
    clickAction: "hand", clickFacing: "up", clickDeckPos: "top", clickDeckNum: 1, enableClick: true
  };
  fields.push(newField);
  setupItems.push({ id: newField.id, type: "field", name: newField.name, count: 0, facing: "up", pos: "top" });
  saveCards();
  addLog("新しい場（場 " + num + "）を追加しました");
  render();
};

$("startButton").onclick = function() {
  deck = shuffle(cards.flatMap(function(card) {
    return Array.from({ length: Math.max(0, Number(card.count) || 0) }, function(_, i) {
      return Object.assign({}, card, {
        baseName: card.name, isFacedUp: true, rotation: 0, parentId: null, inspectFacing: undefined, isIndividuallyPublic: false, counters: [], memo: "", instanceId: card.id + "-" + i + "-" + uid()
      });
    });
  }));
  hand = []; discard = []; previewCard = null;
  fields.forEach(function(f) { f.cards = []; });

  // 開始設定に基づく自動配置（上から順に処理）
  setupItems.forEach(function(item) {
    const count = Math.max(0, Number(item.count) || 0);
    if (count > 0 && deck.length > 0) {
      const actualCount = Math.min(count, deck.length);
      for (let i = 0; i < actualCount; i++) {
        let card = item.pos === "bottom" ? deck.pop() : deck.shift();
        if (card) {
          card.parentId = null;
          if (item.type === "hand") {
            card.isFacedUp = true;
            hand.push(card);
          } else {
            const targetField = fields.find(function(f) { return f.id === item.id; });
            if (targetField) {
              card.isFacedUp = (item.facing !== "down");
              targetField.cards.push(card);
            }
          }
        }
      }
      addLog(item.name + "に開始設定で" + actualCount + "枚のカードを配置しました");
    }
  });

  addLog(deck.length + "枚のデッキをシャッフルし、ゲームを開始しました");
  render();
};

$("drawButton").onclick = function() {
  if (!deck.length) { addLog("デッキにカードがありません"); return; }
  const actual = Math.min(Math.max(1, Number($("drawAmountInput").value) || 1), deck.length);
  deck.splice(0, actual).forEach(function(c) { c.isFacedUp = true; c.parentId = null; c.inspectFacing = undefined; hand.push(c); });
  addLog(actual + "枚ドローしました");
  render();
};

$("shuffleButton").onclick = function() { deck = shuffle(deck); addLog("デッキをシャッフルしました"); render(); };
$("resetButton").onclick = function() { deck = []; hand = []; discard = []; previewCard = null; fields.forEach(function(f) { f.cards = []; }); addLog("プレイエリアをリセットしました"); render(); };

$("exportButton").onclick = function() {
  const filename = $("exportFileName").value.trim() || "card-deck.json";
  const blob = new Blob([JSON.stringify({
    version: 22, cards: cards, handEnableClick: handEnableClick, handIsPrivate: handIsPrivate,
    counters: counters.map(function(c) { return { id: c.id, name: c.name, value: c.value }; }),
    setupItems: setupItems,
    fields: fields.map(function(f) { return { id: f.id, name: f.name, facing: f.facing, isPrivate: f.isPrivate, clickAction: f.clickAction, clickFacing: f.clickFacing, clickDeckPos: f.clickDeckPos, clickDeckNum: f.clickDeckNum, enableClick: f.enableClick }; })
  }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  addLog("デッキとカウンタを「" + filename + "」として書き出しました");
};

$("importButton").onclick = function() { $("importFile").click(); };
$("importFile").onchange = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  $("exportFileName").value = file.name;
  const reader = new FileReader();
  reader.onload = function() {
    try {
      const data = JSON.parse(String(reader.result));
      if (!Array.isArray(data.cards)) throw new Error();
      cards = data.cards.map(function(c, i) {
        return {
          id: c.id || uid(), name: String(c.name || "名称未設定"), count: Math.max(0, Number(c.count) || 0),
          image: typeof c.image === "string" ? c.image : "", backImage: typeof c.backImage === "string" ? c.backImage : "",
          color: c.color || colorPresets[i % colorPresets.length]
        };
      });
      handEnableClick = data.handEnableClick !== false;
      handIsPrivate = data.handIsPrivate !== false;
      counters = Array.isArray(data.counters) ? data.counters.map(function(c) { return { id: c.id || uid(), name: String(c.name || "カウンタ"), value: Math.max(0, Number(c.value) || 0) }; }) : [];
      fields = Array.isArray(data.fields) && data.fields.length > 0 ? data.fields.map(function(f, i) {
        return {
          id: f.id || uid(), name: String(f.name || ("場 " + (i + 1))), cards: [], facing: f.facing || "up", isOpen: true,
          isPrivate: f.isPrivate !== false, clickAction: f.clickAction || "hand", clickFacing: f.clickFacing || "up",
          clickDeckPos: f.clickDeckPos || "top", clickDeckNum: f.clickDeckNum || 1, enableClick: f.enableClick !== false
        };
      }) : [{ id: uid(), name: "場 1", cards: [], facing: "up", isOpen: true, isPrivate: true, clickAction: "hand", clickFacing: "up", clickDeckPos: "top", clickDeckNum: 1, enableClick: true }];
      
      // JSON内の開始設定の順序をそのまま引き継ぐ
      setupItems = [];
      if (Array.isArray(data.setupItems) && data.setupItems.length > 0) {
        data.setupItems.forEach(function(item) {
          if (item.type === 'hand') {
            setupItems.push({
              id: "hand",
              type: "hand",
              name: "手札",
              count: item.count !== undefined ? item.count : 0,
              facing: item.facing || "up",
              pos: item.pos || "top"
            });
          } else if (item.type === 'field') {
            const matchedField = fields.find(function(f) { return f.id === item.id || f.name === item.name; });
            if (matchedField) {
              setupItems.push({
                id: matchedField.id,
                type: "field",
                name: matchedField.name,
                count: item.count !== undefined ? item.count : 0,
                facing: item.facing || "up",
                pos: item.pos || "top"
              });
            }
          }
        });
      }

      if (!setupItems.some(function(i) { return i.type === 'hand'; })) {
        setupItems.unshift({ id: "hand", type: "hand", name: "手札", count: 0, facing: "up", pos: "top" });
      }
      fields.forEach(function(f) {
        if (!setupItems.some(function(i) { return i.id === f.id; })) {
          setupItems.push({ id: f.id, type: "field", name: f.name, count: 0, facing: "up", pos: "top" });
        }
      });
      syncSetupItemsWithFields();

      saveCards();
      deck = []; hand = []; discard = []; previewCard = null;
      addLog("デッキデータ・カウンタおよび場情報を読み込みました");
      render();
    } catch (err) {
      addLog("読み込みに失敗しました。正しいJSONファイルを選択してください");
    } finally {
      $("importFile").value = "";
    }
  };
  reader.readAsText(file);
};

render();