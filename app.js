(() => {
  "use strict";

  const VERSION = "1.0.0";
  const STORAGE_KEYS = {
    recipes: "myRecipes.recipes.v1",
    shopping: "myRecipes.shopping.v1",
    settings: "myRecipes.settings.v1"
  };

  const defaultSettings = {
    keepAwake: true,
    confirmDelete: true
  };

  let recipes = loadJson(STORAGE_KEYS.recipes, []);
  let shopping = loadJson(STORAGE_KEYS.shopping, []);
  let settings = { ...defaultSettings, ...loadJson(STORAGE_KEYS.settings, {}) };
  let activeRecipeId = null;
  let activeServings = null;
  let quickFilter = "all";
  let editingPhotoData = "";
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
    modalBackdrop: document.querySelector("#modalBackdrop"),
    recipeModal: document.querySelector("#recipeModal"),
    settingsModal: document.querySelector("#settingsModal"),
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
    recipeNotes: document.querySelector("#recipeNotes"),
    recipeRating: document.querySelector("#recipeRating"),
    makeAgain: document.querySelector("#makeAgain"),
    ingredientRowTemplate: document.querySelector("#ingredientRowTemplate"),
    instructionRowTemplate: document.querySelector("#instructionRowTemplate"),
    importFile: document.querySelector("#importFile"),
    keepAwakeSetting: document.querySelector("#keepAwakeSetting"),
    confirmDeleteSetting: document.querySelector("#confirmDeleteSetting"),
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
    const ingredients = recipe.ingredients.map((item, index) => {
      const quantity = Number.isFinite(item.qty) ? formatQuantity(item.qty * factor) : "";
      const leading = [quantity, item.unit].filter(Boolean).join(" ");
      return `
        <li>
          <input type="checkbox" aria-label="Check ${escapeAttr(item.name)}" />
          <span>${leading ? `<span class="ingredient-qty-display">${escapeHtml(leading)}</span> ` : ""}${escapeHtml(item.name)}</span>
        </li>`;
    }).join("");

    const instructions = recipe.instructions.map((step) => `<li><span>${escapeHtml(step)}</span></li>`).join("");
    const tags = (recipe.tags || []).map((tag, index) => `<span class="tag-chip ${index % 3 === 1 ? "blue" : index % 3 === 2 ? "gold" : ""}">${escapeHtml(tag)}</span>`).join("");
    const image = recipe.photo
      ? `<img class="detail-hero-image" src="${escapeAttr(recipe.photo)}" alt="${escapeAttr(recipe.name)}" />`
      : `<div class="detail-hero-image detail-hero-placeholder" aria-hidden="true">🍲</div>`;

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
    node.querySelector(".ingredient-qty").value = Number.isFinite(item.qty) ? formatEditableQuantity(item.qty) : (item.qtyText || "");
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
        const qtyText = row.querySelector(".ingredient-qty").value.trim();
        const qty = parseQuantity(qtyText);
        return {
          qty: Number.isFinite(qty) ? qty : null,
          qtyText: Number.isFinite(qty) ? "" : qtyText,
          unit: row.querySelector(".ingredient-unit").value.trim(),
          name: row.querySelector(".ingredient-name").value.trim()
        };
      })
      .filter((item) => item.name);

    const instructions = [...els.instructionEditor.querySelectorAll(".instruction-text")]
      .map((input) => input.value.trim())
      .filter(Boolean);

    if (!name) return toast("Please add a recipe name.");
    if (!ingredients.length) return toast("Please add at least one ingredient.");
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
    const rawLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const name = cleanHeading(rawLines[0] || "Untitled Recipe");
    const servingsMatch = text.match(/(?:serves|servings?|yield)\s*[:\-]?\s*(\d{1,2})/i);
    const prepMatch = text.match(/prep(?:\s*time)?\s*[:\-]\s*([^\n]+)/i);
    const cookMatch = text.match(/cook(?:\s*time)?\s*[:\-]\s*([^\n]+)/i);
    const categoryMatch = text.match(/category\s*[:\-]\s*([^\n]+)/i);

    let section = "header";
    const ingredientLines = [];
    const instructionLines = [];

    rawLines.forEach((line, index) => {
      const normalized = line.toLowerCase().replace(/[:：]/g, "").trim();
      if (/^(ingredients?|what you(?:'|’)ll need)$/.test(normalized)) {
        section = "ingredients";
        return;
      }
      if (/^(instructions?|directions?|method|steps?)$/.test(normalized)) {
        section = "instructions";
        return;
      }
      if (index === 0) return;
      if (/^(serves|servings?|yield|prep|prep time|cook|cook time|total time|category)\b/i.test(line)) return;

      if (section === "ingredients") ingredientLines.push(line);
      else if (section === "instructions") instructionLines.push(line);
    });

    if (!ingredientLines.length || !instructionLines.length) {
      const guessedIngredients = rawLines.filter((line) => looksLikeIngredientLine(line));
      const firstInstructionIndex = rawLines.findIndex((line) => /^\s*(?:\d+[.)]|step\s+\d+)/i.test(line));
      if (!ingredientLines.length) ingredientLines.push(...guessedIngredients);
      if (!instructionLines.length && firstInstructionIndex >= 0) {
        instructionLines.push(...rawLines.slice(firstInstructionIndex));
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
      ingredients: uniqueLines(ingredientLines).map(parseIngredientLine).filter((item) => item.name),
      instructions: uniqueLines(instructionLines).map(cleanInstructionLine).filter(Boolean)
    };
  }

  function parseIngredientLine(line) {
    const cleaned = line.replace(/^[-*•▪◦]\s*/, "").trim();
    const tokenized = cleaned.split(/\s+/);
    let qtyTokenCount = 0;
    let qty = null;

    if (tokenized.length) {
      if (tokenized.length >= 2 && /^\d+$/.test(tokenized[0]) && isFractionToken(tokenized[1])) {
        qty = parseQuantity(`${tokenized[0]} ${tokenized[1]}`);
        qtyTokenCount = 2;
      } else {
        const candidate = parseQuantity(tokenized[0]);
        if (Number.isFinite(candidate)) {
          qty = candidate;
          qtyTokenCount = 1;
        }
      }
    }

    const units = [
      "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
      "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds", "g", "gram", "grams", "kg",
      "ml", "l", "clove", "cloves", "can", "cans", "package", "packages", "pkg", "stick", "sticks",
      "slice", "slices", "piece", "pieces", "pinch", "dash"
    ];

    let unit = "";
    let nameStart = qtyTokenCount;
    if (qtyTokenCount && tokenized[nameStart] && units.includes(tokenized[nameStart].toLowerCase().replace(/[.,]/g, ""))) {
      unit = tokenized[nameStart].replace(/[.,]/g, "");
      nameStart += 1;
    }

    const name = tokenized.slice(nameStart).join(" ").replace(/^of\s+/i, "").trim();
    return { qty: Number.isFinite(qty) ? qty : null, qtyText: Number.isFinite(qty) ? "" : "", unit, name: name || cleaned };
  }

  function looksLikeIngredientLine(line) {
    const stripped = line.replace(/^[-*•▪◦]\s*/, "");
    return /^((\d+([./]\d+)?)|([¼½¾⅓⅔⅛⅜⅝⅞]))\b/.test(stripped) || /^[-*•▪◦]/.test(line);
  }

  function cleanInstructionLine(line) {
    return line.replace(/^\s*(?:step\s*)?\d+\s*[.)\-:]\s*/i, "").replace(/^[-*•▪◦]\s*/, "").trim();
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
    const factor = servings / recipe.originalServings;
    recipe.ingredients.forEach((ingredient) => {
      const scaledQty = Number.isFinite(ingredient.qty) ? ingredient.qty * factor : null;
      const key = `${normalizeIngredientName(ingredient.name)}|${normalizeUnit(ingredient.unit)}`;
      const existing = shopping.find((item) => item.key === key && !item.manualTextOnly);
      if (existing && Number.isFinite(existing.qty) && Number.isFinite(scaledQty)) {
        existing.qty += scaledQty;
        existing.checked = false;
      } else {
        shopping.push({
          id: createId(),
          key,
          name: ingredient.name,
          unit: ingredient.unit,
          qty: scaledQty,
          qtyText: Number.isFinite(scaledQty) ? "" : (ingredient.qtyText || ""),
          checked: false,
          manualTextOnly: !Number.isFinite(scaledQty)
        });
      }
    });
    saveShopping();
    toast(`${recipe.name} added to shopping list.`);
  }

  function renderShopping() {
    if (!shopping.length) {
      els.shoppingList.innerHTML = `<div class="shopping-empty"><div class="empty-icon">🛒</div><h3>Your shopping list is empty</h3><p class="muted">Open a recipe and tap “＋ Shopping List.”</p></div>`;
      return;
    }

    const sorted = [...shopping].sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name));
    els.shoppingList.innerHTML = sorted.map((item) => {
      const qty = Number.isFinite(item.qty) ? formatQuantity(item.qty) : (item.qtyText || "");
      return `
        <label class="shopping-item ${item.checked ? "checked" : ""}">
          <input type="checkbox" data-shopping-check="${escapeAttr(item.id)}" ${item.checked ? "checked" : ""} />
          <span class="shopping-name">${escapeHtml(item.name)}</span>
          <span class="shopping-qty">${escapeHtml([qty, item.unit].filter(Boolean).join(" "))}</span>
        </label>`;
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
      settings
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
      saveRecipes();
      saveShopping();
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
        qty: Number.isFinite(Number(item.qty)) && item.qty !== null ? Number(item.qty) : null,
        qtyText: String(item.qtyText || ""),
        unit: String(item.unit || ""),
        name: String(item.name || "")
      })).filter((item) => item.name) : [],
      instructions: Array.isArray(recipe.instructions) ? recipe.instructions.map(String).filter(Boolean) : [],
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
    els.cookStepContent.innerHTML = `
      <div class="cook-step-card ${completed ? "completed" : ""}">
        <span class="step-badge">Step ${cookState.index + 1} of ${recipe.instructions.length}</span>
        <p>${escapeHtml(step)}</p>
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

  function normalizeUnit(value) {
    const unit = value.toLowerCase().replace(/\./g, "").trim();
    const map = {
      tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp",
      teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp",
      cup: "cup", cups: "cup",
      ounce: "oz", ounces: "oz", oz: "oz",
      pound: "lb", pounds: "lb", lbs: "lb", lb: "lb",
      clove: "clove", cloves: "clove"
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
