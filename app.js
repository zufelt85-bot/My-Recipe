(() => {
  "use strict";

  const VERSION = "1.1.1";
  const STORAGE_KEYS = {
    recipes: "myRecipes.recipes.v1",
    shopping: "myRecipes.shopping.v1",
    settings: "myRecipes.settings.v1",
    stores: "myRecipes.stores.v1"
  };

  const defaultSettings = {
    keepAwake: true,
    confirmDelete: true,
    selectedStoreId: ""
  };

  let recipes = loadJson(STORAGE_KEYS.recipes, []);
  let shopping = loadJson(STORAGE_KEYS.shopping, []);
  let settings = { ...defaultSettings, ...loadJson(STORAGE_KEYS.settings, {}) };
  let stores = sanitizeStores(loadJson(STORAGE_KEYS.stores, []));
  let activeRecipeId = null;
  let activeServings = null;
  let quickFilter = "all";
  let editingPhotoData = "";
  let editingAislePhotoData = "";
  let activeStoreEditorId = null;
  let activeShoppingAssignmentId = null;
  let cookState = { recipeId: null, index: 0, completed: new Set(), wakeLock: null };

  const els = {
    libraryView: document.querySelector("#libraryView"),
    recipeView: document.querySelector("#recipeView"),
    shoppingView: document.querySelector("#shoppingView"),
    recipeGrid: document.querySelector("#recipeGrid"),
    emptyState: document.querySelector("#emptyState"),
    recipeCountText: document.querySelector("#recipeCountText"),
    searchInput: document.querySelector("#searchInput"),
    quickFilters: document.querySelector("#quickFilters"),
    filterPanel: document.querySelector("#filterPanel"),
    categoryFilter: document.querySelector("#categoryFilter"),
    tagFilter: document.querySelector("#tagFilter"),
    sortSelect: document.querySelector("#sortSelect"),
    recipeDetail: document.querySelector("#recipeDetail"),
    shoppingList: document.querySelector("#shoppingList"),
    shoppingStoreSelect: document.querySelector("#shoppingStoreSelect"),
    modalBackdrop: document.querySelector("#modalBackdrop"),
    recipeModal: document.querySelector("#recipeModal"),
    settingsModal: document.querySelector("#settingsModal"),
    storeModal: document.querySelector("#storeModal"),
    storeEditorModal: document.querySelector("#storeEditorModal"),
    aisleModal: document.querySelector("#aisleModal"),
    assignLocationModal: document.querySelector("#assignLocationModal"),
    cookModal: document.querySelector("#cookModal"),
    recipeModalTitle: document.querySelector("#recipeModalTitle"),
    pasteImportBox: document.querySelector("#pasteImportBox"),
    pasteRecipeText: document.querySelector("#pasteRecipeText"),
    recipeForm: document.querySelector("#recipeForm"),
    recipeId: document.querySelector("#recipeId"),
    recipeName: document.querySelector("#recipeName"),
    recipeSource: document.querySelector("#recipeSource"),
    originalServings: document.querySelector("#originalServings"),
    recipeCategory: document.querySelector("#recipeCategory"),
    prepTime: document.querySelector("#prepTime"),
    cookTime: document.querySelector("#cookTime"),
    recipeTags: document.querySelector("#recipeTags"),
    recipePhoto: document.querySelector("#recipePhoto"),
    photoPreview: document.querySelector("#photoPreview"),
    ingredientEditor: document.querySelector("#ingredientEditor"),
    instructionEditor: document.querySelector("#instructionEditor"),
    recipeGroceryList: document.querySelector("#recipeGroceryList"),
    recipeNotes: document.querySelector("#recipeNotes"),
    recipeRating: document.querySelector("#recipeRating"),
    makeAgain: document.querySelector("#makeAgain"),
    ingredientRowTemplate: document.querySelector("#ingredientRowTemplate"),
    instructionRowTemplate: document.querySelector("#instructionRowTemplate"),
    importFile: document.querySelector("#importFile"),
    keepAwakeSetting: document.querySelector("#keepAwakeSetting"),
    confirmDeleteSetting: document.querySelector("#confirmDeleteSetting"),
    storeList: document.querySelector("#storeList"),
    storeForm: document.querySelector("#storeForm"),
    storeId: document.querySelector("#storeId"),
    storeName: document.querySelector("#storeName"),
    deleteStoreButton: document.querySelector("#deleteStoreButton"),
    aisleList: document.querySelector("#aisleList"),
    aisleForm: document.querySelector("#aisleForm"),
    aisleId: document.querySelector("#aisleId"),
    aisleName: document.querySelector("#aisleName"),
    aisleCategories: document.querySelector("#aisleCategories"),
    aisleCameraPhoto: document.querySelector("#aisleCameraPhoto"),
    aisleGalleryPhoto: document.querySelector("#aisleGalleryPhoto"),
    aislePhotoPreview: document.querySelector("#aislePhotoPreview"),
    assignLocationForm: document.querySelector("#assignLocationForm"),
    assignShoppingItemId: document.querySelector("#assignShoppingItemId"),
    assignLocationItemName: document.querySelector("#assignLocationItemName"),
    assignAisleSelect: document.querySelector("#assignAisleSelect"),
    rememberItemLocation: document.querySelector("#rememberItemLocation"),
    cookProgressText: document.querySelector("#cookProgressText"),
    cookStepContent: document.querySelector("#cookStepContent")
  };

  init();

  function init() {
    for (let i = 1; i <= 12; i += 1) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = String(i);
      if (i === 4) option.selected = true;
      els.originalServings.append(option);
    }

    els.keepAwakeSetting.checked = settings.keepAwake;
    els.confirmDeleteSetting.checked = settings.confirmDelete;

    bindEvents();
    renderLibrary();
    renderShopping();
  }

  function bindEvents() {
    document.addEventListener("click", handleClick);
    els.searchInput.addEventListener("input", renderLibrary);
    els.categoryFilter.addEventListener("change", renderLibrary);
    els.tagFilter.addEventListener("change", renderLibrary);
    els.sortSelect.addEventListener("change", renderLibrary);
    els.recipeForm.addEventListener("submit", saveRecipeFromForm);
    els.recipePhoto.addEventListener("change", handlePhotoSelection);
    els.importFile.addEventListener("change", importRecipes);
    els.shoppingStoreSelect.addEventListener("change", handleShoppingStoreChange);
    els.storeForm.addEventListener("submit", saveStoreFromForm);
    els.aisleForm.addEventListener("submit", saveAisleFromForm);
    els.aisleCameraPhoto.addEventListener("change", handleAislePhotoSelection);
    els.aisleGalleryPhoto.addEventListener("change", handleAislePhotoSelection);
    els.assignLocationForm.addEventListener("submit", saveAssignedLocation);
    els.keepAwakeSetting.addEventListener("change", saveSettingsFromControls);
    els.confirmDeleteSetting.addEventListener("change", saveSettingsFromControls);

    document.querySelector(".brand").addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") showView("library");
    });
  }

  function handleClick(event) {
    const actionEl = event.target.closest("[data-action]");
    if (actionEl) {
      const action = actionEl.dataset.action;
      const handlers = {
        "go-home": () => showView("library"),
        "open-add": () => openRecipeModal(),
        "open-shopping": () => showView("shopping"),
        "open-settings": () => openSettings(),
        "open-stores": openStores,
        "add-store": () => openStoreEditor(),
        "edit-store": () => openStoreEditor(actionEl.dataset.storeId),
        "back-to-stores": openStores,
        "add-aisle": () => openAisleEditor(),
        "edit-aisle": () => openAisleEditor(actionEl.dataset.aisleId),
        "delete-aisle": () => deleteAisle(actionEl.dataset.aisleId),
        "move-aisle-up": () => moveAisle(actionEl.dataset.aisleId, -1),
        "move-aisle-down": () => moveAisle(actionEl.dataset.aisleId, 1),
        "back-to-store-editor": () => openStoreEditor(activeStoreEditorId),
        "delete-store": deleteCurrentStore,
        "remove-aisle-photo": removeAislePhoto,
        "assign-shopping-location": () => openAssignLocation(actionEl.dataset.shoppingId),
        "close-modal": () => els.cookModal.classList.contains("hidden") ? closeModals() : closeCookMode(),
        "toggle-filters": () => els.filterPanel.classList.toggle("hidden"),
        "clear-filters": clearFilters,
        "parse-pasted-recipe": parsePastedRecipeIntoForm,
        "add-ingredient-row": () => addIngredientRow(),
        "add-instruction-row": () => addInstructionRow(),
        "remove-editor-row": () => removeEditorRow(actionEl),
        "remove-photo": removePhoto,
        "export-recipes": exportRecipes,
        "clear-checked-shopping": clearCheckedShopping,
        "clear-shopping": clearShopping,
        "close-cook-mode": closeCookMode,
        "cook-prev": () => changeCookStep(-1),
        "cook-next": () => changeCookStep(1),
        "cook-complete": toggleCookStepComplete
      };
      if (handlers[action]) {
        event.preventDefault();
        handlers[action]();
        return;
      }
    }

    const quick = event.target.closest("[data-quick-filter]");
    if (quick) {
      quickFilter = quick.dataset.quickFilter;
      document.querySelectorAll("[data-quick-filter]").forEach((button) => button.classList.toggle("active", button === quick));
      renderLibrary();
      return;
    }

    const card = event.target.closest("[data-recipe-id]");
    if (card && !event.target.closest("button")) {
      openRecipe(card.dataset.recipeId);
      return;
    }

    const favoriteButton = event.target.closest("[data-favorite-id]");
    if (favoriteButton) {
      event.stopPropagation();
      toggleFavorite(favoriteButton.dataset.favoriteId);
    }
  }

  function showView(name) {
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    const target = name === "recipe" ? els.recipeView : name === "shopping" ? els.shoppingView : els.libraryView;
    target.classList.add("active");
    if (name === "library") renderLibrary();
    if (name === "shopping") renderShopping();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderLibrary() {
    updateFilterOptions();
    const search = els.searchInput.value.trim().toLowerCase();
    const category = els.categoryFilter.value;
    const tag = els.tagFilter.value;

    let filtered = recipes.filter((recipe) => {
      if (quickFilter === "favorites" && !recipe.favorite) return false;
      if (quickFilter === "make-again" && !recipe.makeAgain) return false;
      if (category && recipe.category !== category) return false;
      if (tag && !(recipe.tags || []).includes(tag)) return false;
      if (!search) return true;
      const haystack = [
        recipe.name,
        recipe.source,
        recipe.category,
        ...(recipe.tags || []),
        ...(recipe.ingredients || []).map((item) => item.name),
        recipe.notes
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });

    const sortMode = els.sortSelect.value;
    filtered = [...filtered].sort((a, b) => {
      if (sortMode === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortMode === "rating") return (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name);
      if (sortMode === "recent") return new Date(b.lastCookedAt || 0) - new Date(a.lastCookedAt || 0);
      return a.name.localeCompare(b.name);
    });

    els.recipeGrid.innerHTML = filtered.map(recipeCardHtml).join("");
    els.recipeCountText.textContent = `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`;
    els.emptyState.classList.toggle("hidden", recipes.length > 0 || filtered.length > 0);

    if (recipes.length > 0 && filtered.length === 0) {
      els.emptyState.classList.remove("hidden");
      els.emptyState.querySelector("h3").textContent = "No recipes match those filters";
      els.emptyState.querySelector("p").textContent = "Try another search, category, or tag.";
      els.emptyState.querySelector("button").classList.add("hidden");
    } else {
      els.emptyState.querySelector("h3").textContent = "Your recipe box is empty";
      els.emptyState.querySelector("p").textContent = "Paste a recipe from ChatGPT or Gemini, or add one manually.";
      els.emptyState.querySelector("button").classList.remove("hidden");
    }
  }

  function recipeCardHtml(recipe) {
    const image = recipe.photo
      ? `<img class="recipe-card-image" src="${escapeAttr(recipe.photo)}" alt="${escapeAttr(recipe.name)}" />`
      : `<div class="recipe-card-image recipe-card-placeholder" aria-hidden="true">🍲</div>`;
    const tags = (recipe.tags || []).slice(0, 2).map((tag, index) => `<span class="tag-chip ${index === 1 ? "blue" : ""}">${escapeHtml(tag)}</span>`).join("");
    return `
      <article class="recipe-card" data-recipe-id="${escapeAttr(recipe.id)}">
        ${image}
        <button class="card-favorite ${recipe.favorite ? "active" : ""}" data-favorite-id="${escapeAttr(recipe.id)}" title="Favorite">★</button>
        <div class="recipe-card-body">
          <h3>${escapeHtml(recipe.name)}</h3>
          <div class="recipe-meta">
            ${recipe.prepTime || recipe.cookTime ? `<span>⏱ ${escapeHtml(totalTimeLabel(recipe))}</span>` : ""}
            <span>👥 ${recipe.originalServings} servings</span>
            ${recipe.category ? `<span>🍴 ${escapeHtml(recipe.category)}</span>` : ""}
          </div>
          ${tags ? `<div class="chip-row">${tags}</div>` : ""}
        </div>
      </article>`;
  }

  function openRecipe(id, servings = null) {
    const recipe = recipes.find((item) => item.id === id);
    if (!recipe) return;
    activeRecipeId = id;
    activeServings = clampServings(servings || recipe.originalServings);
    renderRecipeDetail();
    showView("recipe");
  }

  function renderRecipeDetail() {
    const recipe = recipes.find((item) => item.id === activeRecipeId);
    if (!recipe) return showView("library");

    const factor = activeServings / recipe.originalServings;
    const ingredients = (recipe.ingredients || []).map((item) => ingredientDisplayHtml(item, factor)).join("");
    const instructions = (recipe.instructions || []).map((step) => instructionDisplayHtml(step)).join("");
    const tags = (recipe.tags || []).map((tag, index) => `<span class="tag-chip ${index % 3 === 1 ? "blue" : index % 3 === 2 ? "gold" : ""}">${escapeHtml(tag)}</span>`).join("");
    const image = recipe.photo
      ? `<img class="detail-hero-image" src="${escapeAttr(recipe.photo)}" alt="${escapeAttr(recipe.name)}" />`
      : `<div class="detail-hero-image detail-hero-placeholder" aria-hidden="true">🍲</div>`;
    const groceryDetail = groceryListDetailHtml(recipe.groceryListText || "");

    els.recipeDetail.innerHTML = `
      <div class="detail-hero">
        ${image}
        <div class="detail-summary">
          <div class="recipe-actions">
            <div>
              <h2 id="recipeTitle">${escapeHtml(recipe.name)}</h2>
              <div class="recipe-meta">
                ${recipe.prepTime ? `<span>Prep: ${escapeHtml(recipe.prepTime)}</span>` : ""}
                ${recipe.cookTime ? `<span>Cook: ${escapeHtml(recipe.cookTime)}</span>` : ""}
                ${recipe.category ? `<span>${escapeHtml(recipe.category)}</span>` : ""}
              </div>
            </div>
            <div class="inline-actions">
              <button class="secondary-button" data-detail-action="favorite">${recipe.favorite ? "★ Favorited" : "☆ Favorite"}</button>
              <button class="secondary-button" data-detail-action="edit">Edit</button>
            </div>
          </div>
          ${tags ? `<div class="chip-row">${tags}</div>` : ""}
          ${recipe.source ? `<p><strong>Source:</strong> ${escapeHtml(recipe.source)}</p>` : ""}
          ${recipe.rating ? `<p class="star-rating">${"★".repeat(recipe.rating)}${"☆".repeat(5 - recipe.rating)}</p>` : ""}
          ${recipe.makeAgain ? `<p><strong>✓ Would make again</strong></p>` : ""}

          <div class="serving-box">
            <strong>Servings</strong>
            <div class="serving-controls">
              <button class="secondary-button" data-detail-action="servings-minus" ${activeServings <= 1 ? "disabled" : ""}>−</button>
              <span class="serving-value">${activeServings}</span>
              <button class="secondary-button" data-detail-action="servings-plus" ${activeServings >= 12 ? "disabled" : ""}>＋</button>
            </div>
            <button class="text-button" data-detail-action="reset-servings">Reset</button>
            <span class="muted small">Original recipe makes ${recipe.originalServings}.</span>
          </div>

          <div class="inline-actions wrap">
            <button class="primary-button" data-detail-action="cook-mode">Cook Mode</button>
            <button class="secondary-button" data-detail-action="add-shopping">＋ Shopping List</button>
            <button class="secondary-button" data-detail-action="print">Print</button>
            <button class="danger-button" data-detail-action="delete">Delete</button>
          </div>
        </div>
      </div>

      <section class="detail-section">
        <h3>Ingredients</h3>
        <ul class="ingredient-list">${ingredients}</ul>
      </section>
      <section class="detail-section">
        <h3>Instructions</h3>
        <ol class="instruction-list">${instructions}</ol>
      </section>
      ${groceryDetail ? `<section class="detail-section"><h3>Grocery Shopping List</h3>${groceryDetail}</section>` : ""}
      ${recipe.notes ? `<section class="detail-section"><h3>Notes</h3><p>${escapeHtml(recipe.notes).replace(/\n/g, "<br>")}</p></section>` : ""}
    `;

    els.recipeDetail.querySelectorAll("[data-detail-action]").forEach((button) => {
      button.addEventListener("click", () => handleDetailAction(button.dataset.detailAction));
    });
  }

  function handleDetailAction(action) {
    const recipe = recipes.find((item) => item.id === activeRecipeId);
    if (!recipe) return;
    if (action === "favorite") {
      toggleFavorite(recipe.id);
      renderRecipeDetail();
    } else if (action === "edit") {
      openRecipeModal(recipe);
    } else if (action === "servings-minus") {
      activeServings = clampServings(activeServings - 1);
      renderRecipeDetail();
    } else if (action === "servings-plus") {
      activeServings = clampServings(activeServings + 1);
      renderRecipeDetail();
    } else if (action === "reset-servings") {
      activeServings = recipe.originalServings;
      renderRecipeDetail();
    } else if (action === "cook-mode") {
      openCookMode(recipe.id);
    } else if (action === "add-shopping") {
      addRecipeToShoppingList(recipe, activeServings);
    } else if (action === "print") {
      window.print();
    } else if (action === "delete") {
      deleteRecipe(recipe.id);
    }
  }

  function openRecipeModal(recipe = null) {
    closeModals();
    resetRecipeForm();
    els.recipeModal.classList.remove("hidden");
    els.modalBackdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    if (recipe) {
      els.recipeModalTitle.textContent = "Edit Recipe";
      els.pasteImportBox.classList.add("hidden");
      populateRecipeForm(recipe);
    } else {
      els.recipeModalTitle.textContent = "Add Recipe";
      els.pasteImportBox.classList.remove("hidden");
      addIngredientRow();
      addInstructionRow();
    }
  }

  function resetRecipeForm() {
    els.recipeForm.reset();
    els.recipeId.value = "";
    els.originalServings.value = "4";
    els.ingredientEditor.innerHTML = "";
    els.instructionEditor.innerHTML = "";
    els.pasteRecipeText.value = "";
    els.recipeGroceryList.value = "";
    els.recipePhoto.value = "";
    editingPhotoData = "";
    updatePhotoPreview();
  }

  function populateRecipeForm(recipe) {
    els.recipeId.value = recipe.id;
    els.recipeName.value = recipe.name;
    els.recipeSource.value = recipe.source || "";
    els.originalServings.value = String(recipe.originalServings);
    els.recipeCategory.value = recipe.category || "";
    els.prepTime.value = recipe.prepTime || "";
    els.cookTime.value = recipe.cookTime || "";
    els.recipeTags.value = (recipe.tags || []).join(", ");
    els.recipeGroceryList.value = recipe.groceryListText || "";
    els.recipeNotes.value = recipe.notes || "";
    els.recipeRating.value = String(recipe.rating || 0);
    els.makeAgain.checked = Boolean(recipe.makeAgain);
    editingPhotoData = recipe.photo || "";
    updatePhotoPreview();
    recipe.ingredients.forEach(addIngredientRow);
    recipe.instructions.forEach((step) => addInstructionRow(step));
  }

  function addIngredientRow(item = {}) {
    const node = els.ingredientRowTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.kind = item.kind === "section" ? "section" : "item";
    if (node.dataset.kind === "section") node.classList.add("section-row");
    node.querySelector(".ingredient-qty").value = formatEditableQuantityRange(item);
    node.querySelector(".ingredient-unit").value = item.unit || "";
    node.querySelector(".ingredient-name").value = item.name || "";
    els.ingredientEditor.append(node);
  }

  function addInstructionRow(text = "") {
    const node = els.instructionRowTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".instruction-text").value = text;
    els.instructionEditor.append(node);
    renumberInstructionRows();
  }

  function removeEditorRow(button) {
    const row = button.closest(".ingredient-row, .instruction-row");
    if (row) row.remove();
    renumberInstructionRows();
  }

  function renumberInstructionRows() {
    els.instructionEditor.querySelectorAll(".instruction-row").forEach((row, index) => {
      row.querySelector(".step-number").textContent = String(index + 1);
    });
  }

  async function handlePhotoSelection() {
    const file = els.recipePhoto.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file.");
      return;
    }
    try {
      editingPhotoData = await resizeImage(file, 1200, 0.82);
      updatePhotoPreview();
    } catch {
      toast("That photo could not be processed.");
    }
  }

  function removePhoto() {
    editingPhotoData = "";
    els.recipePhoto.value = "";
    updatePhotoPreview();
  }

  function updatePhotoPreview() {
    if (editingPhotoData) {
      els.photoPreview.src = editingPhotoData;
      els.photoPreview.classList.remove("hidden");
    } else {
      els.photoPreview.removeAttribute("src");
      els.photoPreview.classList.add("hidden");
    }
  }

  function saveRecipeFromForm(event) {
    event.preventDefault();
    const name = els.recipeName.value.trim();
    const ingredients = [...els.ingredientEditor.querySelectorAll(".ingredient-row")]
      .map((row) => {
        const kind = row.dataset.kind === "section" ? "section" : "item";
        const qtyText = row.querySelector(".ingredient-qty").value.trim();
        const range = parseQuantityRange(qtyText);
        return {
          kind,
          qty: kind === "item" && Number.isFinite(range.min) ? range.min : null,
          qtyMax: kind === "item" && Number.isFinite(range.max) && range.max !== range.min ? range.max : null,
          qtyText: kind === "item" && !Number.isFinite(range.min) ? qtyText : "",
          unit: kind === "item" ? row.querySelector(".ingredient-unit").value.trim() : "",
          name: row.querySelector(".ingredient-name").value.trim()
        };
      })
      .filter((item) => item.name);

    const instructions = [...els.instructionEditor.querySelectorAll(".instruction-text")]
      .map((input) => input.value.trim())
      .filter(Boolean);

    if (!name) return toast("Please add a recipe name.");
    if (!ingredients.some((item) => item.kind !== "section")) return toast("Please add at least one ingredient.");
    if (!instructions.length) return toast("Please add at least one instruction step.");

    const existing = recipes.find((item) => item.id === els.recipeId.value);
    const now = new Date().toISOString();
    const recipe = {
      id: existing?.id || createId(),
      name,
      source: els.recipeSource.value.trim(),
      originalServings: clampServings(Number(els.originalServings.value) || 4),
      category: els.recipeCategory.value.trim(),
      prepTime: els.prepTime.value.trim(),
      cookTime: els.cookTime.value.trim(),
      tags: normalizeTags(els.recipeTags.value),
      photo: editingPhotoData,
      ingredients,
      instructions,
      groceryListText: els.recipeGroceryList.value.trim(),
      notes: els.recipeNotes.value.trim(),
      rating: Number(els.recipeRating.value) || 0,
      makeAgain: els.makeAgain.checked,
      favorite: existing?.favorite || false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastCookedAt: existing?.lastCookedAt || null
    };

    if (existing) recipes = recipes.map((item) => item.id === existing.id ? recipe : item);
    else recipes.unshift(recipe);

    saveRecipes();
    closeModals();
    activeRecipeId = recipe.id;
    activeServings = recipe.originalServings;
    renderLibrary();
    openRecipe(recipe.id);
    toast(existing ? "Recipe updated." : "Recipe saved.");
  }

  function parsePastedRecipeIntoForm() {
    const text = els.pasteRecipeText.value.trim();
    if (!text) return toast("Paste a recipe first.");
    const parsed = parseRecipeText(text);

    els.recipeName.value = parsed.name;
    els.recipeSource.value = parsed.source || guessSource(text);
    els.originalServings.value = String(parsed.servings);
    els.recipeCategory.value = parsed.category || "";
    els.prepTime.value = parsed.prepTime || "";
    els.cookTime.value = parsed.cookTime || "";
    els.recipeTags.value = parsed.tags.join(", ");
    els.recipeGroceryList.value = parsed.groceryListText || "";
    els.recipeNotes.value = parsed.notes || "";
    els.ingredientEditor.innerHTML = "";
    els.instructionEditor.innerHTML = "";
    parsed.ingredients.forEach(addIngredientRow);
    parsed.instructions.forEach((step) => addInstructionRow(step));
    if (!parsed.ingredients.length) addIngredientRow();
    if (!parsed.instructions.length) addInstructionRow();
    toast("Recipe parsed. Review the fields before saving.");
    els.recipeName.focus();
  }

  function parseRecipeText(text) {
    const lines = text.replace(/\r/g, "").split("\n");
    const firstContent = lines.map((line) => line.trim()).find(Boolean) || "Untitled Recipe";
    const name = cleanHeading(firstContent);
    const servingsMatch = text.match(/(?:serves|servings?|yield)\s*[:\-]?\s*(\d{1,2})/i);
    const prepMatch = text.match(/prep(?:\s*time)?\s*[:\-]\s*([^\n]+)/i);
    const cookMatch = text.match(/(?:cook|bake)(?:\s*time)?\s*[:\-]\s*([^\n]+)/i);
    const ingredientsHeadingIndex = lines.findIndex((line) => /^(ingredients?|what you(?:'|’)ll need)$/.test(normalizeSectionHeading(line.trim())));
    const headerText = lines.slice(0, ingredientsHeadingIndex >= 0 ? ingredientsHeadingIndex : lines.length).join("\n");
    const categoryMatch = headerText.match(/category\s*[:\-]\s*([^\n]+)/i);

    let section = "header";
    let currentStep = null;
    let currentNoteHeading = "";
    const ingredients = [];
    const steps = [];
    const groceryLines = [];
    const noteBlocks = [];
    let noteLines = [];

    const finishStep = () => {
      if (!currentStep) return;
      const body = currentStep.body.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      const combined = [currentStep.title.trim(), body].filter(Boolean).join("\n\n");
      if (combined) steps.push(combined);
      currentStep = null;
    };

    const finishNoteBlock = () => {
      const body = noteLines.join("\n").trim();
      if (currentNoteHeading || body) {
        noteBlocks.push([currentNoteHeading, body].filter(Boolean).join("\n"));
      }
      currentNoteHeading = "";
      noteLines = [];
    };

    lines.forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line) return;
      if (isDividerLine(line)) return;

      const heading = normalizeSectionHeading(line);
      if (/^(ingredients?|what you(?:'|’)ll need)$/.test(heading)) {
        finishStep();
        finishNoteBlock();
        section = "ingredients";
        return;
      }
      if (/^(instructions?|directions?|method|steps?)$/.test(heading)) {
        finishStep();
        finishNoteBlock();
        section = "instructions";
        return;
      }
      if (/^(grocery shopping list|shopping list|grocery list)$/.test(heading)) {
        finishStep();
        finishNoteBlock();
        section = "grocery";
        return;
      }
      if (/^(best result tips|best-result tips|best results tips|tips)$/.test(heading)) {
        finishStep();
        finishNoteBlock();
        section = "notes";
        currentNoteHeading = cleanHeading(line);
        return;
      }
      if (/^(optional teen friendly version|optional teen-friendly version|optional version|variations?|optional variations?)$/.test(heading)) {
        finishStep();
        finishNoteBlock();
        section = "notes";
        currentNoteHeading = cleanHeading(line);
        return;
      }

      if (index === lines.findIndex((candidate) => candidate.trim())) return;
      if (section === "header" && /^(serves|servings?|yield|ramekin size|prep|prep time|cook|cook time|bake|bake time|oven temperature|total time|category)\b/i.test(line)) return;

      if (section === "ingredients") {
        if (isBulletLine(line)) {
          const bulletText = stripBullet(line);
          const isNestedAlternative = /^\s+/.test(rawLine) && /^or\b/i.test(bulletText);
          const previous = ingredients[ingredients.length - 1];
          if (isNestedAlternative && previous && previous.kind !== "section") {
            previous.name = `${previous.name}\n${bulletText}`;
          } else {
            ingredients.push(parseIngredientLine(line));
          }
        } else if (looksLikeIngredientLine(line)) {
          ingredients.push(parseIngredientLine(line));
        } else {
          ingredients.push({ kind: "section", qty: null, qtyMax: null, qtyText: "", unit: "", name: cleanHeading(line) });
        }
        return;
      }

      if (section === "instructions") {
        const numbered = line.match(/^(?:step\s*)?(\d{1,2})\s*[.)\-:]\s*(.+)$/i);
        if (numbered) {
          finishStep();
          currentStep = { title: cleanHeading(numbered[2]), body: [] };
          return;
        }
        if (!currentStep) currentStep = { title: "", body: [] };
        currentStep.body.push(isBulletLine(line) ? `• ${stripBullet(line)}` : line);
        return;
      }

      if (section === "grocery") {
        groceryLines.push(isBulletLine(line) ? `- ${stripBullet(line)}` : cleanHeading(line));
        return;
      }

      if (section === "notes") {
        noteLines.push(isBulletLine(line) ? `• ${stripBullet(line)}` : line);
      }
    });

    finishStep();
    finishNoteBlock();

    if (!ingredients.some((item) => item.kind !== "section") || !steps.length) {
      const rawLines = lines.map((line) => line.trim()).filter(Boolean);
      if (!ingredients.some((item) => item.kind !== "section")) {
        rawLines.filter((line) => looksLikeIngredientLine(line)).forEach((line) => ingredients.push(parseIngredientLine(line)));
      }
      if (!steps.length) {
        const firstInstructionIndex = rawLines.findIndex((line) => /^\s*(?:\d+[.)]|step\s+\d+)/i.test(line));
        if (firstInstructionIndex >= 0) {
          rawLines.slice(firstInstructionIndex).map(cleanInstructionLine).filter(Boolean).forEach((line) => steps.push(line));
        }
      }
    }

    return {
      name,
      source: "",
      servings: clampServings(Number(servingsMatch?.[1]) || 4),
      prepTime: prepMatch?.[1]?.trim() || "",
      cookTime: cookMatch?.[1]?.trim() || "",
      category: categoryMatch?.[1]?.trim() || "",
      tags: [],
      ingredients: ingredients.filter((item) => item.name),
      instructions: steps,
      groceryListText: groceryLines.join("\n").trim(),
      notes: noteBlocks.join("\n\n").trim()
    };
  }

  function parseIngredientLine(line) {
    const cleaned = stripBullet(line);
    const parsedLeading = parseLeadingQuantity(cleaned);
    const units = [
      "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
      "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds", "g", "gram", "grams", "kg",
      "ml", "l", "clove", "cloves", "can", "cans", "package", "packages", "pkg", "stick", "sticks",
      "box", "boxes", "slice", "slices", "piece", "pieces", "pinch", "dash"
    ];

    let remainder = parsedLeading.remainder;
    let unit = "";
    if (Number.isFinite(parsedLeading.min)) {
      const tokens = remainder.split(/\s+/);
      if (tokens[0] && units.includes(tokens[0].toLowerCase().replace(/[.,]/g, ""))) {
        unit = tokens.shift().replace(/[.,]/g, "");
        remainder = tokens.join(" ");
      }
    }

    return {
      kind: "item",
      qty: Number.isFinite(parsedLeading.min) ? parsedLeading.min : null,
      qtyMax: Number.isFinite(parsedLeading.max) && parsedLeading.max !== parsedLeading.min ? parsedLeading.max : null,
      qtyText: Number.isFinite(parsedLeading.min) ? "" : parsedLeading.qtyText,
      unit,
      name: remainder.replace(/^of\s+/i, "").trim() || cleaned
    };
  }

  function parseLeadingQuantity(value) {
    const text = String(value || "").trim();
    const q = "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+\\/\\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+(?:\\.\\d+)?)";
    const range = text.match(new RegExp(`^(${q})\\s*(?:to|[-–—])\\s*(${q})(?:\\s+|$)`, "i"));
    if (range) {
      const min = parseQuantity(range[1]);
      const max = parseQuantity(range[2]);
      return { min, max, qtyText: range[0].trim(), remainder: text.slice(range[0].length).trim() };
    }
    const single = text.match(new RegExp(`^(${q})(?:\\s+|$)`, "i"));
    if (single) {
      const min = parseQuantity(single[1]);
      return { min, max: min, qtyText: single[1], remainder: text.slice(single[0].length).trim() };
    }
    return { min: null, max: null, qtyText: "", remainder: text };
  }

  function looksLikeIngredientLine(line) {
    const stripped = stripBullet(line);
    return Number.isFinite(parseLeadingQuantity(stripped).min) || isBulletLine(line);
  }

  function cleanInstructionLine(line) {
    return line.replace(/^\s*(?:step\s*)?\d+\s*[.)\-:]\s*/i, "").replace(/^[-*•▪◦]\s*/, "").trim();
  }

  function isDividerLine(line) {
    return /^[-_*]{3,}$/.test(String(line || "").trim());
  }

  function normalizeSectionHeading(line) {
    return cleanHeading(line).toLowerCase().replace(/[:：]+$/, "").replace(/[–—]/g, "-").trim();
  }

  function isBulletLine(line) {
    return /^\s*[-*•▪◦]\s+/.test(String(line || ""));
  }

  function stripBullet(line) {
    return String(line || "").replace(/^\s*[-*•▪◦]\s*/, "").trim();
  }

  function cleanHeading(line) {
    return line.replace(/^#+\s*/, "").replace(/^recipe\s*[:\-]\s*/i, "").trim();
  }

  function guessSource(text) {
    if (/chatgpt|openai/i.test(text)) return "ChatGPT";
    if (/gemini|google ai/i.test(text)) return "Gemini";
    return "";
  }

  function deleteRecipe(id) {
    const recipe = recipes.find((item) => item.id === id);
    if (!recipe) return;
    if (settings.confirmDelete && !window.confirm(`Delete “${recipe.name}”? This cannot be undone unless you have a backup.`)) return;
    recipes = recipes.filter((item) => item.id !== id);
    saveRecipes();
    activeRecipeId = null;
    renderLibrary();
    showView("library");
    toast("Recipe deleted.");
  }

  function toggleFavorite(id) {
    recipes = recipes.map((item) => item.id === id ? { ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() } : item);
    saveRecipes();
    renderLibrary();
  }

  function addRecipeToShoppingList(recipe, servings) {
    const groceryItems = parseGroceryListText(recipe.groceryListText || "");
    if (groceryItems.length) {
      const seenProducts = new Set();
      groceryItems.forEach((groceryItem) => {
        const product = canonicalProductName(groceryItem.text);
        if (!product || seenProducts.has(product)) return;
        seenProducts.add(product);
        mergeGroceryItemIntoShopping(recipe, groceryItem, servings);
      });
    } else {
      addRecipeIngredientsToShoppingFallback(recipe, servings);
    }
    saveShopping();
    renderShopping();
    toast(`${recipe.name} added to shopping list.`);
  }

  function addRecipeIngredientsToShoppingFallback(recipe, servings) {
    const factor = servings / recipe.originalServings;
    (recipe.ingredients || []).filter((ingredient) => ingredient.kind !== "section").forEach((ingredient) => {
      const scaledQty = Number.isFinite(ingredient.qty) ? ingredient.qty * factor : null;
      const key = `${normalizeIngredientName(ingredient.name)}|${normalizeUnit(ingredient.unit)}`;
      const existing = shopping.find((item) => item.key === key && !item.fromGroceryList);
      if (existing && Number.isFinite(existing.qty) && Number.isFinite(scaledQty)) {
        existing.qty += scaledQty;
        existing.checked = false;
      } else {
        shopping.push({
          id: createId(),
          key,
          matchKey: canonicalProductName(ingredient.name),
          name: ingredient.name,
          purchaseText: "",
          section: "",
          category: "",
          group: "",
          unit: ingredient.unit,
          qty: scaledQty,
          qtyText: Number.isFinite(scaledQty) ? "" : (ingredient.qtyText || ""),
          checked: false,
          manualTextOnly: !Number.isFinite(scaledQty),
          fromGroceryList: false,
          sourceRecipes: [recipe.name],
          storeLocations: {}
        });
      }
    });
  }

  function mergeGroceryItemIntoShopping(recipe, groceryItem, servings) {
    const itemName = groceryItem.item || groceryItem.text;
    const matchKey = canonicalProductName(itemName);
    if (!matchKey) return;
    const requirement = getRecipeRequirement(recipe, matchKey, servings);
    const key = `grocery|${matchKey}`;
    const existing = shopping.find((item) => item.key === key);
    const sourcePurchaseText = groceryItem.buy
      ? `${groceryItem.buy} ${itemName}`.trim()
      : groceryItem.text;

    if (existing) {
      existing.checked = false;
      existing.sourceRecipes = [...new Set([...(existing.sourceRecipes || []), recipe.name])];
      if (requirement && (!existing.baseUnit || existing.baseUnit === requirement.unit)) {
        existing.baseUnit = requirement.unit;
        existing.baseRequired = (Number(existing.baseRequired) || 0) + requirement.amount;
      }
      existing.purchaseText = buildPracticalPurchaseText(matchKey, existing.baseRequired, existing.baseUnit, existing.originalPurchaseText || sourcePurchaseText);
      if (!existing.section && groceryItem.section) existing.section = groceryItem.section;
      if (!existing.category && groceryItem.category) existing.category = groceryItem.category;
      if (!existing.group && groceryItem.group) existing.group = groceryItem.group;
      return;
    }

    const baseRequired = requirement?.amount || null;
    const baseUnit = requirement?.unit || "";
    shopping.push({
      id: createId(),
      key,
      matchKey,
      name: itemName,
      purchaseText: buildPracticalPurchaseText(matchKey, baseRequired, baseUnit, sourcePurchaseText),
      originalPurchaseText: sourcePurchaseText,
      section: groceryItem.section || groceryItem.category || "",
      category: groceryItem.category || groceryItem.section || "",
      group: groceryItem.group || "",
      unit: "",
      qty: null,
      qtyText: "",
      baseRequired,
      baseUnit,
      checked: false,
      manualTextOnly: true,
      fromGroceryList: true,
      sourceRecipes: [recipe.name],
      storeLocations: {}
    });
  }

  function parseGroceryListText(text) {
    if (!String(text || "").trim()) return [];
    let section = "";
    let structured = null;
    const items = [];

    const flushStructured = () => {
      if (!structured?.item) {
        structured = null;
        return;
      }
      const category = structured.category || section || "";
      const buy = structured.buy || "";
      const item = structured.item.trim();
      items.push({
        section: category,
        category,
        group: structured.group || "",
        item,
        buy,
        text: buy ? `${buy} ${item}`.trim() : item
      });
      structured = null;
    };

    String(text).replace(/\r/g, "").split("\n").forEach((raw) => {
      const line = raw.trim();
      if (!line || isDividerLine(line) || /^or$/i.test(line)) return;

      const unbulleted = isBulletLine(line) ? stripBullet(line) : line;
      const cleaned = stripInlineMarkdown(unbulleted).trim();
      const field = cleaned.match(/^(item|category|group|buy)\s*:\s*(.+)$/i);
      if (field) {
        const key = field[1].toLowerCase();
        const value = field[2].trim();
        if (key === "item") {
          flushStructured();
          structured = { item: value, category: "", group: "", buy: "" };
        } else if (structured) {
          structured[key] = value;
        }
        return;
      }

      if (structured) flushStructured();

      if (isBulletLine(line)) {
        const textValue = stripBullet(line);
        if (textValue) items.push({
          section,
          category: section,
          group: "",
          item: textValue,
          buy: "",
          text: textValue
        });
      } else {
        section = cleanHeading(stripInlineMarkdown(line)).replace(/:$/, "").trim();
      }
    });

    flushStructured();
    return items;
  }

  function stripInlineMarkdown(value) {
    return String(value || "")
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/\*\*|__|`/g, "")
      .trim();
  }

  function getRecipeRequirement(recipe, product, servings) {
    const factor = servings / recipe.originalServings;
    let total = 0;
    let baseUnit = "";
    (recipe.ingredients || []).filter((item) => item.kind !== "section").forEach((ingredient) => {
      const ingredientProduct = canonicalProductName(ingredient.name);
      if (!productsMatch(product, ingredientProduct)) return;
      const quantity = Number.isFinite(ingredient.qtyMax) ? ingredient.qtyMax : ingredient.qty;
      if (!Number.isFinite(quantity)) return;
      const converted = convertIngredientRequirement(product, quantity * factor, ingredient.unit, ingredient.name);
      if (!converted) return;
      if (!baseUnit) baseUnit = converted.unit;
      if (baseUnit !== converted.unit) return;
      total += converted.amount;
    });
    return total > 0 && baseUnit ? { amount: total, unit: baseUnit } : null;
  }

  function convertIngredientRequirement(product, quantity, unit, name) {
    const normalizedUnit = normalizeUnit(unit || "");
    if (product === "egg") return { amount: quantity, unit: "count" };
    if (product === "butter") {
      if (normalizedUnit === "tbsp") return { amount: quantity, unit: "tbsp" };
      if (normalizedUnit === "tsp") return { amount: quantity / 3, unit: "tbsp" };
      if (normalizedUnit === "cup") return { amount: quantity * 16, unit: "tbsp" };
      if (normalizedUnit === "stick") return { amount: quantity * 8, unit: "tbsp" };
    }
    if (product === "heavy cream") {
      if (normalizedUnit === "cup") return { amount: quantity, unit: "cup" };
      if (normalizedUnit === "tbsp") return { amount: quantity / 16, unit: "cup" };
      if (normalizedUnit === "tsp") return { amount: quantity / 48, unit: "cup" };
    }
    if (product.includes("broth") || product.includes("stock")) {
      if (normalizedUnit === "cup") return { amount: quantity, unit: "cup" };
      if (normalizedUnit === "oz") return { amount: quantity / 8, unit: "cup" };
    }
    if (product === "onion") {
      if (normalizedUnit === "cup") return { amount: quantity, unit: "cup" };
      if (!normalizedUnit) return { amount: quantity, unit: "count" };
    }
    if (product === "carrot") {
      if (normalizedUnit === "cup") return { amount: quantity, unit: "cup" };
      if (!normalizedUnit) return { amount: quantity, unit: "count" };
    }
    if (product === "celery") {
      if (normalizedUnit === "cup") return { amount: quantity, unit: "cup" };
      if (!normalizedUnit) return { amount: quantity, unit: "count" };
    }
    if (product === "garlic") {
      if (normalizedUnit === "clove") return { amount: quantity, unit: "clove" };
    }
    if (product === "pie crust" && normalizedUnit === "box") return { amount: quantity, unit: "box" };
    if (normalizedUnit === "lb" || normalizedUnit === "oz" || normalizedUnit === "cup" || normalizedUnit === "count") {
      return { amount: quantity, unit: normalizedUnit };
    }
    if (!normalizedUnit && /\beggs?\b/i.test(name || "")) return { amount: quantity, unit: "count" };
    return null;
  }

  function buildPracticalPurchaseText(product, required, baseUnit, originalText) {
    if (!(Number(required) > 0)) return originalText;
    if (product === "egg" && baseUnit === "count") {
      const dozens = Math.max(1, Math.ceil(required / 12));
      return `${dozens} dozen ${dozens === 1 ? "eggs" : "eggs"}`;
    }
    if (product === "heavy cream" && baseUnit === "cup") {
      if (required <= 2) return "1 pint heavy cream";
      if (required <= 4) return "1 quart heavy cream";
      const quarts = Math.ceil(required / 4);
      return `${quarts} quarts heavy cream`;
    }
    if (product === "butter" && baseUnit === "tbsp") {
      const sticks = Math.max(1, Math.ceil(required / 8));
      return `${sticks} ${sticks === 1 ? "stick" : "sticks"} unsalted butter`;
    }
    if ((product.includes("chicken broth") || product.includes("chicken stock")) && baseUnit === "cup") {
      const cartons = Math.max(1, Math.ceil(required / 4));
      return `${cartons} × 32 oz ${cartons === 1 ? "carton" : "cartons"} low-sodium chicken broth`;
    }
    if (product === "onion" && baseUnit === "cup") {
      const count = Math.max(1, Math.ceil(required));
      return `${count} medium yellow ${count === 1 ? "onion" : "onions"}`;
    }
    if (product === "carrot" && baseUnit === "cup") {
      const count = Math.max(1, Math.ceil(required * 3));
      return `${count} medium ${count === 1 ? "carrot" : "carrots"}`;
    }
    if (product === "celery" && baseUnit === "cup") {
      const count = Math.max(1, Math.ceil(required * 4));
      return `${count} celery ${count === 1 ? "stalk" : "stalks"}`;
    }
    if (product === "garlic" && baseUnit === "clove") {
      const bulbs = Math.max(1, Math.ceil(required / 10));
      return `${bulbs} ${bulbs === 1 ? "bulb" : "bulbs"} garlic`;
    }
    if (product === "chicken breast" && baseUnit === "cup") {
      const pounds = Math.ceil((required / 2) * 4) / 4;
      return `About ${formatQuantity(pounds)} lb boneless skinless chicken breasts`;
    }
    if (product === "chicken breast" && baseUnit === "lb") {
      const pounds = Math.ceil(required * 4) / 4;
      return `About ${formatQuantity(pounds)} lb boneless skinless chicken breasts`;
    }
    if (product === "pie crust" && baseUnit === "box") {
      const boxes = Math.max(1, Math.ceil(required));
      return `${boxes} ${boxes === 1 ? "box" : "boxes"} refrigerated rolled pie crusts, containing 2 crusts each`;
    }
    if (product === "peas" && baseUnit === "cup") {
      const bags = Math.max(1, Math.ceil(required / 2.5));
      return `${bags} small ${bags === 1 ? "bag" : "bags"} frozen petite sweet peas, optional`;
    }
    return originalText;
  }

  function renderShopping() {
    renderShoppingStoreOptions();
    if (!shopping.length) {
      els.shoppingList.innerHTML = `<div class="shopping-empty"><div class="empty-icon">🛒</div><h3>Your shopping list is empty</h3><p class="muted">Open a recipe and tap “＋ Shopping List.”</p></div>`;
      return;
    }

    const store = getSelectedStore();
    const groups = buildShoppingGroups(store);
    els.shoppingList.innerHTML = groups.map((group) => {
      const photo = group.aisle?.photo ? `<img class="shopping-aisle-photo" src="${escapeAttr(group.aisle.photo)}" alt="${escapeAttr(group.name)}" />` : "";
      const groupHeader = `<div class="shopping-group-header ${group.needsAisle ? "needs-aisle" : ""}">${photo}<span>${escapeHtml(group.name)}</span><span class="shopping-group-meta small">${group.aisle ? escapeHtml(group.aisle.name) : ""}</span></div>`;
      const items = group.items.map((item) => shoppingItemHtml(item, store)).join("");
      return `<section class="shopping-group">${groupHeader}${items}</section>`;
    }).join("");

    els.shoppingList.querySelectorAll("[data-shopping-check]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const item = shopping.find((entry) => entry.id === checkbox.dataset.shoppingCheck);
        if (item) item.checked = checkbox.checked;
        saveShopping();
        renderShopping();
      });
    });
  }

  function renderShoppingStoreOptions() {
    if (settings.selectedStoreId && !stores.some((store) => store.id === settings.selectedStoreId)) settings.selectedStoreId = "";
    els.shoppingStoreSelect.innerHTML = `<option value="">No store layout</option>${stores.map((store) => `<option value="${escapeAttr(store.id)}">${escapeHtml(store.name)}</option>`).join("")}`;
    els.shoppingStoreSelect.value = settings.selectedStoreId || "";
  }

  function handleShoppingStoreChange() {
    settings.selectedStoreId = els.shoppingStoreSelect.value;
    saveJson(STORAGE_KEYS.settings, settings);
    renderShopping();
  }

  function getSelectedStore() {
    return stores.find((store) => store.id === settings.selectedStoreId) || null;
  }

  function buildShoppingGroups(store) {
    const sortedItems = [...shopping].sort((a, b) => Number(a.checked) - Number(b.checked) || shoppingDisplayText(a).localeCompare(shoppingDisplayText(b)));
    if (!store) {
      const map = new Map();
      sortedItems.forEach((item) => {
        const groupName = item.section || "Shopping List";
        if (!map.has(groupName)) map.set(groupName, []);
        map.get(groupName).push(item);
      });
      return [...map.entries()].map(([name, items]) => ({ name, items, aisle: null, needsAisle: false }));
    }

    const aisleGroups = new Map();
    const needs = [];
    sortedItems.forEach((item) => {
      const aisle = resolveShoppingAisle(item, store);
      if (!aisle) {
        needs.push(item);
        return;
      }
      if (!aisleGroups.has(aisle.id)) aisleGroups.set(aisle.id, []);
      aisleGroups.get(aisle.id).push(item);
    });

    const groups = [...store.aisles]
      .sort((a, b) => a.order - b.order)
      .filter((aisle) => aisleGroups.has(aisle.id))
      .map((aisle) => ({ name: aisle.name, aisle, items: aisleGroups.get(aisle.id), needsAisle: false }));
    if (needs.length) groups.push({ name: "Needs Aisle", aisle: null, items: needs, needsAisle: true });
    return groups;
  }

  function shoppingItemHtml(item, store) {
    const display = shoppingDisplayText(item);
    const source = (item.sourceRecipes || []).length ? `<span class="shopping-source">From: ${escapeHtml(item.sourceRecipes.join(", "))}</span>` : "";
    const aisle = store ? resolveShoppingAisle(item, store) : null;
    const locationButton = store ? `<button type="button" class="shopping-location-button" data-action="assign-shopping-location" data-shopping-id="${escapeAttr(item.id)}">${aisle ? escapeHtml(aisle.name) : "Assign aisle"}</button>` : "";
    const qty = !item.purchaseText && Number.isFinite(item.qty) ? formatQuantity(item.qty) : (!item.purchaseText ? (item.qtyText || "") : "");
    return `
      <div class="shopping-item ${item.checked ? "checked" : ""}">
        <input type="checkbox" data-shopping-check="${escapeAttr(item.id)}" ${item.checked ? "checked" : ""} />
        <span class="shopping-name-wrap"><span class="shopping-name">${escapeHtml(display)}</span>${source}</span>
        <span class="shopping-qty">${escapeHtml(item.purchaseText ? "" : [qty, item.unit].filter(Boolean).join(" "))}</span>
        ${locationButton}
      </div>`;
  }

  function shoppingDisplayText(item) {
    return item.purchaseText || item.name || "Item";
  }

  function resolveShoppingAisle(item, store) {
    const temporary = item.storeLocations?.[store.id];
    if (temporary) {
      const aisle = store.aisles.find((entry) => entry.id === temporary);
      if (aisle) return aisle;
    }
    const exactKey = item.matchKey || canonicalProductName(item.name || item.purchaseText || "");
    const exact = store.itemLocations?.[exactKey];
    if (exact) {
      const aisle = store.aisles.find((entry) => entry.id === exact);
      if (aisle) return aisle;
    }
    return matchStoreAisle(item, store);
  }

  function matchStoreAisle(item, store) {
    const product = item.matchKey || canonicalProductName(item.name || item.purchaseText || "");
    const category = item.category || item.section || "";
    const group = item.group || "";
    const signals = buildAisleMatchSignals(product, category, group);
    let best = null;
    let bestScore = 0;

    store.aisles.forEach((aisle) => {
      const labels = [aisle.name, ...(aisle.categories || [])].filter(Boolean);
      let aisleBest = 0;
      labels.forEach((label) => {
        aisleBest = Math.max(aisleBest, scoreAisleLabel(label, signals));
      });
      if (aisleBest > bestScore) {
        bestScore = aisleBest;
        best = aisle;
      }
    });

    return bestScore >= 8 ? best : null;
  }

  function buildAisleMatchSignals(product, category, group) {
    const signals = {
      product: normalizeAislePhrase(product),
      category: normalizeAislePhrase(category),
      group: normalizeAislePhrase(group),
      aliases: new Set()
    };
    [signals.product, signals.category, signals.group].filter(Boolean).forEach((value) => {
      aisleAliasTerms(value).forEach((term) => signals.aliases.add(term));
    });
    return signals;
  }

  function scoreAisleLabel(label, signals) {
    const normalized = normalizeAislePhrase(label);
    if (!normalized) return 0;
    const labelTokens = aisleTokens(normalized);
    let score = 0;

    if (signals.group && phraseTokensContained(signals.group, labelTokens)) score = Math.max(score, 13);
    if (signals.product && phraseTokensContained(signals.product, labelTokens)) score = Math.max(score, 12);
    if (signals.category && phraseTokensContained(signals.category, labelTokens)) score = Math.max(score, 11);

    const groupOverlap = tokenOverlapScore(signals.group, labelTokens);
    const productOverlap = tokenOverlapScore(signals.product, labelTokens);
    const categoryOverlap = tokenOverlapScore(signals.category, labelTokens);
    score = Math.max(score, groupOverlap ? 8 + groupOverlap : 0);
    score = Math.max(score, productOverlap ? 7 + productOverlap : 0);
    score = Math.max(score, categoryOverlap ? 6 + categoryOverlap : 0);

    signals.aliases.forEach((alias) => {
      const aliasTokens = aisleTokens(alias);
      if (!aliasTokens.length) return;
      if (aliasTokens.every((token) => labelTokens.includes(token))) score = Math.max(score, 9);
    });

    return score;
  }

  function normalizeAislePhrase(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/&/g, " and ")
      .replace(/[\/\\|,+()\-–—]+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function aisleTokens(value) {
    const stopWords = new Set(["and", "or", "the", "food", "foods", "goods", "needs", "general"]);
    return normalizeAislePhrase(value).split(" ").filter((token) => token.length > 1 && !stopWords.has(token));
  }

  function phraseTokensContained(value, labelTokens) {
    const tokens = aisleTokens(value);
    return tokens.length > 0 && tokens.every((token) => labelTokens.includes(token));
  }

  function tokenOverlapScore(value, labelTokens) {
    const tokens = aisleTokens(value);
    if (!tokens.length) return 0;
    const matches = tokens.filter((token) => labelTokens.includes(token)).length;
    if (!matches) return 0;
    if (tokens.length === 1) return matches;
    return matches / tokens.length > 0.5 ? matches : 0;
  }

  function aisleAliasTerms(value) {
    const tokens = aisleTokens(value);
    const joined = tokens.join(" ");
    const terms = new Set();

    const add = (...values) => values.forEach((entry) => terms.add(normalizeAislePhrase(entry)));

    if (tokens.includes("broth") || tokens.includes("stock")) add("broth stock", "soup");
    if (tokens.includes("flour") || tokens.includes("baking")) add("flour", "baking");
    if (tokens.includes("salt") || tokens.includes("pepper")) add("salt pepper", "spices");
    if ((tokens.includes("garlic") || tokens.includes("onion")) && tokens.includes("powder")) add("spices");
    if (tokens.includes("spice") || tokens.includes("spices") || tokens.includes("seasoning") || tokens.includes("seasonings")) add("spices", "seasonings");
    if (tokens.includes("soda") || (tokens.includes("soft") && tokens.includes("drinks"))) add("soda", "soft drinks", "beverages");
    if (tokens.includes("pasta")) add("pasta", "dry pasta");
    if (tokens.includes("rice")) add("rice");
    if (tokens.includes("beans")) add("beans", "dry beans", "canned beans");
    if (tokens.includes("ketchup") || tokens.includes("mustard")) add("ketchup mustard", "condiments");
    if (tokens.includes("mayonnaise")) add("mayonnaise", "condiments");
    if (tokens.includes("bbq") || tokens.includes("barbecue")) add("bbq steak sauces", "condiments");
    if (tokens.includes("vinegar")) add("vinegar");
    if (tokens.includes("oil") || tokens.includes("oils") || tokens.includes("shortening")) add("shortening oils", "cooking oil");
    if (tokens.includes("cereal")) add("hot cereal", "cold cereal", "cereal");
    if (tokens.includes("coffee") || tokens.includes("tea")) add("coffee tea");
    if (tokens.includes("juice")) add("juice", "beverages");
    if (tokens.includes("chips")) add("potato chips", "snacks");
    if (tokens.includes("popcorn")) add("popcorn", "snacks");
    if (tokens.includes("crackers") || tokens.includes("cookies")) add("cookies crackers", "snacks");
    if (tokens.includes("peanut") && tokens.includes("butter")) add("peanut butter");
    if (tokens.includes("jam") || tokens.includes("jelly") || tokens.includes("honey")) add("jam jelly honey");

    if (joined === "spices seasonings") add("spices", "salt pepper");
    if (joined === "soup broth") add("soup", "broth stock");
    if (joined === "pasta rice beans") add("dry pasta", "rice", "dry beans", "canned beans");
    if (joined === "condiments sauces") add("ketchup mustard", "mayonnaise", "bbq steak sauces", "salad dressing croutons", "pickles peppers relish");

    return [...terms].filter(Boolean);
  }

  function clearCheckedShopping() {
    shopping = shopping.filter((item) => !item.checked);
    saveShopping();
    renderShopping();
  }

  function clearShopping() {
    if (shopping.length && !window.confirm("Clear the entire shopping list?")) return;
    shopping = [];
    saveShopping();
    renderShopping();
  }

  function openStores() {
    closeModals();
    renderStoreList();
    els.storeModal.classList.remove("hidden");
    els.modalBackdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function renderStoreList() {
    if (!stores.length) {
      els.storeList.innerHTML = `<div class="shopping-empty"><div class="empty-icon">🏪</div><h3>No stores saved yet</h3><p class="muted">Add a store, then add its aisles or departments in walking order.</p></div>`;
      return;
    }
    els.storeList.innerHTML = [...stores].sort((a, b) => a.name.localeCompare(b.name)).map((store) => `
      <article class="store-card">
        <div class="store-card-main">
          <div class="store-card-icon" aria-hidden="true">🏪</div>
          <div><h3>${escapeHtml(store.name)}</h3><p class="muted small">${store.aisles.length} ${store.aisles.length === 1 ? "aisle / department" : "aisles / departments"}</p></div>
        </div>
        <button class="secondary-button" data-action="edit-store" data-store-id="${escapeAttr(store.id)}">Manage</button>
      </article>`).join("");
  }

  function openStoreEditor(storeId = null) {
    closeModals();
    const store = stores.find((item) => item.id === storeId) || null;
    activeStoreEditorId = store?.id || null;
    els.storeId.value = store?.id || "";
    els.storeName.value = store?.name || "";
    els.deleteStoreButton.classList.toggle("hidden", !store);
    renderAisleList(store);
    els.storeEditorModal.classList.remove("hidden");
    els.modalBackdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    if (!store) els.storeName.focus();
  }

  function saveStoreFromForm(event) {
    event.preventDefault();
    const name = els.storeName.value.trim();
    if (!name) return toast("Please add a store name.");
    const existing = stores.find((store) => store.id === els.storeId.value);
    if (existing) {
      existing.name = name;
    } else {
      const store = { id: createId(), name, aisles: [], itemLocations: {} };
      stores.push(store);
      activeStoreEditorId = store.id;
      els.storeId.value = store.id;
    }
    saveStores();
    renderShoppingStoreOptions();
    openStoreEditor(activeStoreEditorId || els.storeId.value);
    toast(existing ? "Store updated." : "Store saved. Add its aisles next.");
  }

  function deleteCurrentStore() {
    const id = els.storeId.value || activeStoreEditorId;
    const store = stores.find((item) => item.id === id);
    if (!store) return;
    if (!window.confirm(`Delete “${store.name}” and its aisle layout?`)) return;
    stores = stores.filter((item) => item.id !== id);
    if (settings.selectedStoreId === id) settings.selectedStoreId = "";
    saveStores();
    saveJson(STORAGE_KEYS.settings, settings);
    renderShopping();
    openStores();
    toast("Store deleted.");
  }

  function renderAisleList(store = stores.find((item) => item.id === activeStoreEditorId)) {
    if (!store) {
      els.aisleList.innerHTML = `<p class="muted">Save the store name first, then you can add aisle photos and categories.</p>`;
      return;
    }
    if (!store.aisles.length) {
      els.aisleList.innerHTML = `<p class="muted">No aisles or departments saved yet.</p>`;
      return;
    }
    const ordered = [...store.aisles].sort((a, b) => a.order - b.order);
    els.aisleList.innerHTML = ordered.map((aisle, index) => {
      const photo = aisle.photo ? `<img class="aisle-card-photo" src="${escapeAttr(aisle.photo)}" alt="${escapeAttr(aisle.name)} sign" />` : `<div class="aisle-card-photo aisle-card-placeholder" aria-hidden="true">🛒</div>`;
      return `<article class="aisle-card">
        ${photo}
        <div><h4>${escapeHtml(aisle.name)}</h4><p class="muted small">${escapeHtml((aisle.categories || []).slice(0, 4).join(" · ") || "No categories entered")}</p></div>
        <div class="aisle-card-actions">
          <button class="secondary-button" data-action="move-aisle-up" data-aisle-id="${escapeAttr(aisle.id)}" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="secondary-button" data-action="move-aisle-down" data-aisle-id="${escapeAttr(aisle.id)}" ${index === ordered.length - 1 ? "disabled" : ""}>↓</button>
          <button class="secondary-button" data-action="edit-aisle" data-aisle-id="${escapeAttr(aisle.id)}">Edit</button>
          <button class="danger-button" data-action="delete-aisle" data-aisle-id="${escapeAttr(aisle.id)}">Delete</button>
        </div>
      </article>`;
    }).join("");
  }

  function openAisleEditor(aisleId = null) {
    const store = stores.find((item) => item.id === activeStoreEditorId);
    if (!store) return toast("Save the store first.");
    const aisle = store.aisles.find((item) => item.id === aisleId) || null;
    closeModals();
    els.aisleId.value = aisle?.id || "";
    els.aisleName.value = aisle?.name || "";
    els.aisleCategories.value = (aisle?.categories || []).join("\n");
    els.aisleCameraPhoto.value = "";
    els.aisleGalleryPhoto.value = "";
    editingAislePhotoData = aisle?.photo || "";
    updateAislePhotoPreview();
    els.aisleModal.classList.remove("hidden");
    els.modalBackdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  async function handleAislePhotoSelection(event) {
    const input = event?.currentTarget;
    const file = input?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Please choose an image file.");
    try {
      editingAislePhotoData = await resizeImage(file, 900, 0.7);
      if (input === els.aisleCameraPhoto) els.aisleGalleryPhoto.value = "";
      if (input === els.aisleGalleryPhoto) els.aisleCameraPhoto.value = "";
      updateAislePhotoPreview();
    } catch {
      toast("That aisle photo could not be processed.");
    }
  }

  function removeAislePhoto() {
    editingAislePhotoData = "";
    els.aisleCameraPhoto.value = "";
    els.aisleGalleryPhoto.value = "";
    updateAislePhotoPreview();
  }

  function updateAislePhotoPreview() {
    if (editingAislePhotoData) {
      els.aislePhotoPreview.src = editingAislePhotoData;
      els.aislePhotoPreview.classList.remove("hidden");
    } else {
      els.aislePhotoPreview.removeAttribute("src");
      els.aislePhotoPreview.classList.add("hidden");
    }
  }

  function saveAisleFromForm(event) {
    event.preventDefault();
    const store = stores.find((item) => item.id === activeStoreEditorId);
    if (!store) return toast("Store not found.");
    const name = els.aisleName.value.trim();
    if (!name) return toast("Please add an aisle or department name.");
    const categories = normalizeCategoryLines(els.aisleCategories.value);
    const existing = store.aisles.find((aisle) => aisle.id === els.aisleId.value);
    if (existing) {
      existing.name = name;
      existing.categories = categories;
      existing.photo = editingAislePhotoData;
    } else {
      store.aisles.push({ id: createId(), name, categories, photo: editingAislePhotoData, order: store.aisles.length });
    }
    normalizeAisleOrder(store);
    saveStores();
    openStoreEditor(store.id);
    toast(existing ? "Aisle updated." : "Aisle added.");
  }

  function deleteAisle(aisleId) {
    const store = stores.find((item) => item.id === activeStoreEditorId);
    const aisle = store?.aisles.find((item) => item.id === aisleId);
    if (!store || !aisle) return;
    if (!window.confirm(`Delete “${aisle.name}”?`)) return;
    store.aisles = store.aisles.filter((item) => item.id !== aisleId);
    Object.keys(store.itemLocations || {}).forEach((key) => {
      if (store.itemLocations[key] === aisleId) delete store.itemLocations[key];
    });
    shopping.forEach((item) => {
      if (item.storeLocations?.[store.id] === aisleId) delete item.storeLocations[store.id];
    });
    normalizeAisleOrder(store);
    saveStores();
    saveShopping();
    renderAisleList(store);
    renderShopping();
  }

  function moveAisle(aisleId, delta) {
    const store = stores.find((item) => item.id === activeStoreEditorId);
    if (!store) return;
    const ordered = [...store.aisles].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((item) => item.id === aisleId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    ordered.forEach((aisle, idx) => { aisle.order = idx; });
    store.aisles = ordered;
    saveStores();
    renderAisleList(store);
    renderShopping();
  }

  function normalizeAisleOrder(store) {
    store.aisles.sort((a, b) => Number(a.order) - Number(b.order)).forEach((aisle, index) => { aisle.order = index; });
  }

  function openAssignLocation(shoppingItemId) {
    const store = getSelectedStore();
    if (!store) return toast("Choose a store first.");
    if (!store.aisles.length) return toast("Add aisles to this store first.");
    const item = shopping.find((entry) => entry.id === shoppingItemId);
    if (!item) return;
    activeShoppingAssignmentId = item.id;
    closeModals();
    els.assignShoppingItemId.value = item.id;
    els.assignLocationItemName.textContent = shoppingDisplayText(item);
    const current = resolveShoppingAisle(item, store);
    els.assignAisleSelect.innerHTML = [...store.aisles].sort((a, b) => a.order - b.order).map((aisle) => `<option value="${escapeAttr(aisle.id)}">${escapeHtml(aisle.name)}</option>`).join("");
    els.assignAisleSelect.value = current?.id || store.aisles[0].id;
    els.rememberItemLocation.checked = true;
    els.assignLocationModal.classList.remove("hidden");
    els.modalBackdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function saveAssignedLocation(event) {
    event.preventDefault();
    const store = getSelectedStore();
    const item = shopping.find((entry) => entry.id === els.assignShoppingItemId.value || entry.id === activeShoppingAssignmentId);
    const aisleId = els.assignAisleSelect.value;
    if (!store || !item || !aisleId) return;
    item.storeLocations = { ...(item.storeLocations || {}), [store.id]: aisleId };
    if (els.rememberItemLocation.checked) {
      store.itemLocations = { ...(store.itemLocations || {}), [item.matchKey || canonicalProductName(item.name || item.purchaseText || "")]: aisleId };
      saveStores();
    }
    saveShopping();
    closeModals();
    renderShopping();
    toast("Item location saved.");
  }

  function normalizeCategoryLines(value) {
    return [...new Set(String(value || "").split(/[\n,]+/).map((item) => item.trim()).filter(Boolean))];
  }

  function openSettings() {
    closeModals();
    els.settingsModal.classList.remove("hidden");
    els.modalBackdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function saveSettingsFromControls() {
    settings.keepAwake = els.keepAwakeSetting.checked;
    settings.confirmDelete = els.confirmDeleteSetting.checked;
    saveJson(STORAGE_KEYS.settings, settings);
  }

  function exportRecipes() {
    const payload = {
      app: "My Recipes",
      version: VERSION,
      exportedAt: new Date().toISOString(),
      recipes,
      shopping,
      settings,
      stores
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `my-recipes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast("Backup exported.");
  }

  async function importRecipes() {
    const file = els.importFile.files[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const importedRecipes = Array.isArray(payload) ? payload : payload.recipes;
      if (!Array.isArray(importedRecipes)) throw new Error("Invalid backup");
      if (!window.confirm(`Restore ${importedRecipes.length} recipes? This will replace the recipes currently stored on this device.`)) return;
      recipes = importedRecipes.map(sanitizeImportedRecipe).filter(Boolean);
      shopping = Array.isArray(payload.shopping) ? payload.shopping : [];
      settings = { ...defaultSettings, ...(payload.settings || {}) };
      stores = sanitizeStores(payload.stores || []);
      if (settings.selectedStoreId && !stores.some((store) => store.id === settings.selectedStoreId)) settings.selectedStoreId = "";
      saveRecipes();
      saveShopping();
      saveStores();
      saveJson(STORAGE_KEYS.settings, settings);
      els.keepAwakeSetting.checked = settings.keepAwake;
      els.confirmDeleteSetting.checked = settings.confirmDelete;
      renderLibrary();
      renderShopping();
      closeModals();
      toast("Backup restored.");
    } catch {
      toast("That file is not a valid My Recipes backup.");
    } finally {
      els.importFile.value = "";
    }
  }

  function sanitizeImportedRecipe(recipe) {
    if (!recipe || typeof recipe !== "object" || !recipe.name) return null;
    return {
      id: String(recipe.id || createId()),
      name: String(recipe.name),
      source: String(recipe.source || ""),
      originalServings: clampServings(Number(recipe.originalServings) || 4),
      category: String(recipe.category || ""),
      prepTime: String(recipe.prepTime || ""),
      cookTime: String(recipe.cookTime || ""),
      tags: Array.isArray(recipe.tags) ? recipe.tags.map(String) : [],
      photo: typeof recipe.photo === "string" ? recipe.photo : "",
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.map((item) => ({
        kind: item?.kind === "section" ? "section" : "item",
        qty: Number.isFinite(Number(item?.qty)) && item?.qty !== null ? Number(item.qty) : null,
        qtyMax: Number.isFinite(Number(item?.qtyMax)) && item?.qtyMax !== null ? Number(item.qtyMax) : null,
        qtyText: String(item?.qtyText || ""),
        unit: String(item?.unit || ""),
        name: String(item?.name || "")
      })).filter((item) => item.name) : [],
      instructions: Array.isArray(recipe.instructions) ? recipe.instructions.map(String).filter(Boolean) : [],
      groceryListText: String(recipe.groceryListText || ""),
      notes: String(recipe.notes || ""),
      rating: Math.min(5, Math.max(0, Number(recipe.rating) || 0)),
      makeAgain: Boolean(recipe.makeAgain),
      favorite: Boolean(recipe.favorite),
      createdAt: recipe.createdAt || new Date().toISOString(),
      updatedAt: recipe.updatedAt || new Date().toISOString(),
      lastCookedAt: recipe.lastCookedAt || null
    };
  }

  function openCookMode(recipeId) {
    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe || !recipe.instructions.length) return;
    cookState.recipeId = recipeId;
    cookState.index = 0;
    cookState.completed = new Set();
    closeModals();
    els.cookModal.classList.remove("hidden");
    els.modalBackdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    renderCookStep();
    requestWakeLock();
  }

  function renderCookStep() {
    const recipe = recipes.find((item) => item.id === cookState.recipeId);
    if (!recipe) return;
    const step = recipe.instructions[cookState.index];
    const completed = cookState.completed.has(cookState.index);
    els.cookProgressText.textContent = `Step ${cookState.index + 1} of ${recipe.instructions.length}`;
    const parts = instructionParts(step);
    els.cookStepContent.innerHTML = `
      <div class="cook-step-card ${completed ? "completed" : ""}">
        <span class="step-badge">Step ${cookState.index + 1} of ${recipe.instructions.length}</span>
        ${parts.title ? `<h3>${escapeHtml(parts.title)}</h3>` : ""}
        <p>${escapeHtml(parts.body || parts.title).replace(/\n/g, "<br>")}</p>
      </div>`;
    const completeButton = els.cookModal.querySelector('[data-action="cook-complete"]');
    completeButton.textContent = completed ? "↶ Mark Incomplete" : "✓ Mark Step Complete";
    els.cookModal.querySelector('[data-action="cook-prev"]').disabled = cookState.index === 0;
    els.cookModal.querySelector('[data-action="cook-next"]').disabled = cookState.index === recipe.instructions.length - 1;
  }

  function changeCookStep(delta) {
    const recipe = recipes.find((item) => item.id === cookState.recipeId);
    if (!recipe) return;
    cookState.index = Math.max(0, Math.min(recipe.instructions.length - 1, cookState.index + delta));
    renderCookStep();
  }

  function toggleCookStepComplete() {
    if (cookState.completed.has(cookState.index)) cookState.completed.delete(cookState.index);
    else cookState.completed.add(cookState.index);
    renderCookStep();
  }

  async function closeCookMode() {
    const recipe = recipes.find((item) => item.id === cookState.recipeId);
    if (recipe && cookState.completed.size) {
      recipe.lastCookedAt = new Date().toISOString();
      saveRecipes();
    }
    await releaseWakeLock();
    els.cookModal.classList.add("hidden");
    els.modalBackdrop.classList.add("hidden");
    document.body.style.overflow = "";
    cookState = { recipeId: null, index: 0, completed: new Set(), wakeLock: null };
  }

  async function requestWakeLock() {
    if (!settings.keepAwake || !("wakeLock" in navigator)) return;
    try {
      cookState.wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      // Unsupported, blocked, or not permitted. Cook Mode continues normally.
    }
  }

  async function releaseWakeLock() {
    try {
      if (cookState.wakeLock) await cookState.wakeLock.release();
    } catch {
      // No action needed.
    }
  }

  function closeModals() {
    document.querySelectorAll(".modal").forEach((modal) => modal.classList.add("hidden"));
    els.modalBackdrop.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function clearFilters() {
    els.searchInput.value = "";
    els.categoryFilter.value = "";
    els.tagFilter.value = "";
    els.sortSelect.value = "name";
    quickFilter = "all";
    document.querySelectorAll("[data-quick-filter]").forEach((button) => button.classList.toggle("active", button.dataset.quickFilter === "all"));
    renderLibrary();
  }

  function updateFilterOptions() {
    const currentCategory = els.categoryFilter.value;
    const currentTag = els.tagFilter.value;
    const categories = [...new Set(recipes.map((recipe) => recipe.category).filter(Boolean))].sort();
    const tags = [...new Set(recipes.flatMap((recipe) => recipe.tags || []))].sort();
    els.categoryFilter.innerHTML = `<option value="">All categories</option>${categories.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}`;
    els.tagFilter.innerHTML = `<option value="">All tags</option>${tags.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}`;
    els.categoryFilter.value = categories.includes(currentCategory) ? currentCategory : "";
    els.tagFilter.value = tags.includes(currentTag) ? currentTag : "";
  }

  function totalTimeLabel(recipe) {
    if (recipe.prepTime && recipe.cookTime) return `${recipe.prepTime} prep · ${recipe.cookTime} cook`;
    return recipe.prepTime || recipe.cookTime || "";
  }

  function normalizeTags(value) {
    return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
  }

  function normalizeIngredientName(value) {
    return value.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function ingredientDisplayHtml(item, factor) {
    if (item.kind === "section") return `<li class="ingredient-section-heading">${escapeHtml(item.name)}</li>`;
    const min = Number.isFinite(item.qty) ? item.qty * factor : null;
    const max = Number.isFinite(item.qtyMax) ? item.qtyMax * factor : null;
    const quantity = Number.isFinite(min) ? formatQuantityRange(min, max) : (item.qtyText || "");
    const leading = [quantity, item.unit].filter(Boolean).join(" ");
    const nameLines = String(item.name || "").split("\n");
    const mainName = nameLines.shift() || "Ingredient";
    const notes = nameLines.length ? `<span class="ingredient-note">${nameLines.map(escapeHtml).join("<br>")}</span>` : "";
    return `
      <li>
        <input type="checkbox" aria-label="Check ${escapeAttr(mainName)}" />
        <span>${leading ? `<span class="ingredient-qty-display">${escapeHtml(leading)}</span> ` : ""}${escapeHtml(mainName)}${notes}</span>
      </li>`;
  }

  function instructionParts(step) {
    const text = String(step || "").trim();
    const splitAt = text.indexOf("\n\n");
    if (splitAt < 0) return { title: "", body: text };
    return { title: text.slice(0, splitAt).trim(), body: text.slice(splitAt + 2).trim() };
  }

  function instructionDisplayHtml(step) {
    const parts = instructionParts(step);
    return `<li><span>${parts.title ? `<strong class="instruction-step-title">${escapeHtml(parts.title)}</strong>` : ""}<span class="instruction-step-body">${escapeHtml(parts.body || parts.title)}</span></span></li>`;
  }

  function groceryListDetailHtml(text) {
    const items = parseGroceryListText(text);
    if (!items.length) return "";
    const groups = new Map();
    items.forEach((item) => {
      const key = item.category || item.section || "Shopping List";
      if (!groups.has(key)) groups.set(key, []);
      const display = item.buy && item.item ? `${item.buy} — ${item.item}` : item.text;
      const group = item.group ? ` <span class="muted small">(${escapeHtml(item.group)})</span>` : "";
      groups.get(key).push(`${escapeHtml(display)}${group}`);
    });
    return `<div class="grocery-detail-list">${[...groups.entries()].map(([section, values]) => `<div class="grocery-detail-group"><h4>${escapeHtml(section)}</h4><ul>${values.map((value) => `<li>${value}</li>`).join("")}</ul></div>`).join("")}</div>`;
  }

  function canonicalProductName(value) {
    const text = String(value || "").toLowerCase().replace(/[’']/g, "'");
    const aliases = [
      [/\b(chicken broth|chicken stock)\b/, "chicken broth"],
      [/\b(vegetable broth|vegetable stock)\b/, "vegetable broth"],
      [/\b(beef broth|beef stock)\b/, "beef broth"],
      [/\bheavy (?:whipping )?cream\b|\bwhipping cream\b/, "heavy cream"],
      [/\bbutter\b/, "butter"],
      [/\beggs?\b/, "egg"],
      [/\bpie crusts?\b|\bpastry crusts?\b/, "pie crust"],
      [/\bchicken breasts?\b|\brotisserie chicken\b|\bcooked chicken\b/, "chicken breast"],
      [/\byellow onions?\b|\bonions?\b/, "onion"],
      [/\bcarrots?\b/, "carrot"],
      [/\bgarlic powder\b/, "garlic powder"],
      [/\bcelery salt\b/, "celery salt"],
      [/\bcelery\b/, "celery"],
      [/\bkosher salt\b/, "kosher salt"],
      [/\bblack pepper\b/, "black pepper"],
      [/\bgarlic\b/, "garlic"],
      [/\bthyme\b/, "thyme"],
      [/\bpetite (?:sweet )?peas\b|\bfrozen peas\b|\bpeas\b/, "peas"],
      [/\ball-purpose flour\b|\bflour\b/, "all-purpose flour"]
    ];
    for (const [pattern, result] of aliases) if (pattern.test(text)) return result;
    return text
      .replace(/\([^)]*\)/g, " ")
      .replace(/[¼½¾⅓⅔⅛⅜⅝⅞\d./×-]+/g, " ")
      .replace(/\b(about|approximately|medium|large|small|package|pkg|box|carton|bag|dozen|stick|sticks|pint|quart|oz|ounce|ounces|lb|lbs|pound|pounds|cup|cups|tbsp|tsp|fresh|frozen|refrigerated|rolled|boneless|skinless|low-sodium|optional|containing)\b/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function productsMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    return a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a));
  }

  function formatEditableQuantityRange(item) {
    if (Number.isFinite(item.qty)) {
      const min = formatEditableQuantity(item.qty);
      if (Number.isFinite(item.qtyMax) && item.qtyMax !== item.qty) return `${min} to ${formatEditableQuantity(item.qtyMax)}`;
      return min;
    }
    return item.qtyText || "";
  }

  function parseQuantityRange(value) {
    const parsed = parseLeadingQuantity(String(value || "").trim());
    return { min: parsed.min, max: parsed.max };
  }

  function formatQuantityRange(min, max) {
    if (!Number.isFinite(min)) return "";
    if (Number.isFinite(max) && Math.abs(max - min) > 0.0001) return `${formatQuantity(min)} to ${formatQuantity(max)}`;
    return formatQuantity(min);
  }

  function sanitizeStores(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((store) => store && typeof store === "object" && store.name).map((store) => ({
      id: String(store.id || createId()),
      name: String(store.name),
      aisles: Array.isArray(store.aisles) ? store.aisles.filter(Boolean).map((aisle, index) => ({
        id: String(aisle.id || createId()),
        name: String(aisle.name || `Aisle ${index + 1}`),
        categories: Array.isArray(aisle.categories) ? aisle.categories.map(String).filter(Boolean) : normalizeCategoryLines(aisle.categories || ""),
        photo: typeof aisle.photo === "string" ? aisle.photo : "",
        order: Number.isFinite(Number(aisle.order)) ? Number(aisle.order) : index
      })) : [],
      itemLocations: store.itemLocations && typeof store.itemLocations === "object" ? { ...store.itemLocations } : {}
    })).map((store) => {
      normalizeAisleOrder(store);
      return store;
    });
  }

  function normalizeUnit(value) {
    const unit = value.toLowerCase().replace(/\./g, "").trim();
    const map = {
      tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp",
      teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp",
      cup: "cup", cups: "cup",
      ounce: "oz", ounces: "oz", oz: "oz",
      pound: "lb", pounds: "lb", lbs: "lb", lb: "lb",
      clove: "clove", cloves: "clove",
      stick: "stick", sticks: "stick",
      box: "box", boxes: "box",
      count: "count"
    };
    return map[unit] || unit;
  }

  function parseQuantity(value) {
    if (value === null || value === undefined) return null;
    let text = String(value).trim();
    if (!text) return null;
    const unicodeMap = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };
    if (unicodeMap[text] !== undefined) return unicodeMap[text];

    const mixedUnicode = text.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/);
    if (mixedUnicode) return Number(mixedUnicode[1]) + unicodeMap[mixedUnicode[2]];

    const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

    const fraction = text.match(/^(\d+)\/(\d+)$/);
    if (fraction) return Number(fraction[1]) / Number(fraction[2]);

    const decimal = Number(text.replace(",", "."));
    return Number.isFinite(decimal) ? decimal : null;
  }

  function isFractionToken(value) {
    return /^\d+\/\d+$/.test(value) || /^[¼½¾⅓⅔⅛⅜⅝⅞]$/.test(value);
  }

  function formatEditableQuantity(value) {
    if (!Number.isFinite(value)) return "";
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  }

  function formatQuantity(value) {
    if (!Number.isFinite(value)) return "";
    if (Math.abs(value) < 0.0001) return "0";
    const whole = Math.floor(value + 1e-8);
    const fraction = value - whole;
    const common = [
      [0, ""], [1/8, "⅛"], [1/4, "¼"], [1/3, "⅓"], [3/8, "⅜"], [1/2, "½"],
      [5/8, "⅝"], [2/3, "⅔"], [3/4, "¾"], [7/8, "⅞"], [1, ""]
    ];
    let best = common[0];
    let diff = Infinity;
    common.forEach((candidate) => {
      const currentDiff = Math.abs(fraction - candidate[0]);
      if (currentDiff < diff) { best = candidate; diff = currentDiff; }
    });
    if (diff <= 0.035) {
      if (best[0] === 1) return String(whole + 1);
      return `${whole || ""}${whole && best[1] ? " " : ""}${best[1]}` || "0";
    }
    return String(Number(value.toFixed(2)));
  }

  function clampServings(value) {
    return Math.max(1, Math.min(12, Math.round(Number(value) || 1)));
  }

  function uniqueLines(lines) {
    const seen = new Set();
    return lines.filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function resizeImage(file, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * ratio));
          const height = Math.max(1, Math.round(image.height * ratio));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function saveRecipes() { saveJson(STORAGE_KEYS.recipes, recipes); }
  function saveShopping() { saveJson(STORAGE_KEYS.shopping, shopping); }
  function saveStores() { saveJson(STORAGE_KEYS.stores, stores); }

  function loadJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      if (String(error?.name).includes("Quota")) toast("Storage is full. Export a backup and remove some large recipe photos.");
      else toast("Could not save changes in this browser.");
    }
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `recipe-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function toast(message) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.append(el);
    window.setTimeout(() => el.remove(), 2600);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }
})();
