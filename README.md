# My Recipes — Version 1.0.0

A private-by-default personal recipe library designed for GitHub Pages. It stores recipes in the browser on the device you are using and does not require a server, database, framework, API key, or account.

## Files to upload to GitHub

Upload these files to the root of your GitHub repository:

- `index.html`
- `styles.css`
- `app.js`
- `README.md`

Then enable **GitHub Pages** for the repository.

## Version 1.0.0 features

- Add recipes manually.
- Paste recipes from ChatGPT or Gemini and parse them into editable fields.
- Edit and delete recipes.
- Recipe photos.
- Search by recipe name, source, tag, category, notes, or ingredient.
- Categories and custom tags.
- Favorites and “Would make again.”
- 1–5 star ratings.
- Serving scaler from **1 through 12 servings**.
- Cooking-friendly quantity display such as `1 1/2`, `1/3`, and `3/4` as readable fraction symbols when possible.
- Reset recipe to its original serving size.
- Ingredient checkboxes while cooking.
- Step-by-step Cook Mode.
- Optional screen wake lock during Cook Mode when the browser supports it.
- Shopping list generation from one or more recipes.
- Shopping-list quantity merging when ingredient name and unit match.
- Print-friendly recipe view.
- JSON backup/export.
- JSON restore/import.
- Mobile, tablet, and desktop layouts.

## Important storage note

GitHub Pages hosts the app files, but Version 1.0.0 stores your recipe data in your browser using `localStorage`. That means:

- Recipes saved on one phone do not automatically appear on another device.
- Clearing browser/site data can remove locally stored recipes.
- Use **Settings → Export All Recipes (Backup)** regularly.
- You can restore that JSON backup on another device with **Import Recipes (Restore)**.

Automatic cross-device syncing is intentionally not included in Version 1.0.0.

## GitHub Pages setup

1. Create a new GitHub repository.
2. Upload the four files above to the repository root.
3. Open the repository's **Settings**.
4. Open **Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select your main branch and `/ (root)`.
7. Save.

GitHub will provide the website address after deployment.

## Data format

Each recipe is stored as structured data containing:

- Name
- Source
- Original servings
- Category
- Prep/cook time
- Tags
- Photo
- Ingredients with quantity, unit, and ingredient name
- Instructions
- Notes
- Rating
- Favorite status
- “Would make again” status
- Created/updated timestamps
- Last-cooked timestamp

Keeping this structure consistent is what allows reliable scaling, searching, editing, shopping-list generation, and backup/restore.

## Known limitations in Version 1.0.0

- Pasted-recipe parsing is heuristic because ChatGPT/Gemini recipe formatting can vary. Always review parsed fields before saving.
- Shopping-list merging only combines ingredients when normalized names and units match. It does not convert between measurement systems such as teaspoons and tablespoons.
- Recipe photos are stored with the recipe in browser storage. Large numbers of photos can eventually reach browser storage limits.
- Automatic cloud syncing is not included.
- Nutrition calculations are not included.

## Recommended testing areas

Before loading your entire collection, test these workflows:

1. Add a recipe manually.
2. Paste a ChatGPT or Gemini recipe and review the parsed result.
3. Scale a recipe from its original serving count to 1 and then to 12.
4. Check fraction display on ingredients such as 1/2 cup, 1/3 cup, and 1 1/2 cups.
5. Add two recipes with overlapping ingredients to the shopping list.
6. Export a backup.
7. Add or edit a recipe.
8. Restore the backup and confirm the previous data returns.
9. Test on the phone you plan to use while cooking.

## Changelog

### 1.0.0

Initial release of My Recipes.
