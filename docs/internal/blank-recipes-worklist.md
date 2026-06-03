# Blank Recipe Worklist — a place to start

87 recipes in `src/data/recipes.json` are placeholders (`"is_blank": true`) —
they have a name, section, and tags, but no ingredients or instructions. In the
app they show a **"coming soon"** badge. This is the checklist for filling them.

Generated 2026-06-02. Counts: **145 complete / 87 blank / 232 total.** The
"For Review" sections are already fully populated and are not listed here.

---

## How to fill one (2-minute version)

1. Find the recipe object in `src/data/recipes.json` (search by `name`).
2. Set `"is_blank": false`.
3. Fill `ingredients` and `instructions` using this shape:

```json
{
  "name": "Lasagna",
  "section": "ITALIAN",
  "category": "Italian",
  "source": "Original",
  "tags": ["#beef", "#italian"],
  "ingredients": [
    { "type": "section", "text": "Sauce" },
    { "type": "item", "text": "1 lb ground beef" },
    { "type": "item", "text": "1 (28 oz) can crushed tomatoes" }
  ],
  "instructions": [
    { "step": "Brown the beef", "detail": "Cook ground beef over medium-high until no pink remains; drain." },
    { "step": "Assemble", "detail": "Layer noodles, sauce, and cheese; repeat." }
  ],
  "is_blank": false
}
```

**Rules that matter:**

- `ingredients[].type` is `"item"` for an ingredient or `"section"` for a
  sub-heading (e.g. "Sauce", "For the topping"). Use `"section"` to group long lists.
- Each instruction is `{ "step": "Short title", "detail": "What to do." }`.
- Write quantities like `1 lb`, `2 tsp`, `¼ cup` — the unit/fraction parser and
  the macro estimator read these (`utils/parseIngredient.js`, `convertToGrams.js`).
- `SEASONINGS` and `DOUGHS` are excluded from macro estimates by design — don't
  worry about nutrition there.
- After editing, run `npm run validate:recipes` (and `npm run lint`). The build
  also runs the validator via the `prebuild` hook.
- If a USDA nutrition match is wrong, add an override in
  `data/nutritionOverrides.json` rather than special-casing — see
  [`architecture.md`](architecture.md) §5.

**Tip:** fill a whole section in one sitting — the section header in the app
stops showing partial "coming soon" rows once they're done.

---

## Checklist (87) — by section, in app order

### Breakfast (2)
- [ ] **Breakfast Burrito** — `#mexican #breakfast`
- [ ] **Breakfast Muffins** — `#baked #breakfast`

### Slow Cooker (7)
- [ ] **Pulled Pork** — `#pork #slow-cooker`
- [ ] **Orange Chicken and Broccoli** — `#chicken #slow-cooker`
- [ ] **Beef Stew** — `#beef #soup #slow-cooker`
- [ ] **Pork Stew** — `#pork #soup #slow-cooker`
- [ ] **Corned Beef and Cabbage** — `#beef #slow-cooker`
- [ ] **Tortellini Soup** — `#soup #italian #slow-cooker`
- [ ] **Barbacoa Beef** — `#beef #slow-cooker #mexican`

### Seasonings (5)
- [ ] **Taco Seasoning** — `#mexican #seasoning`
- [ ] **Tandoori** — `#middle-eastern #seasoning`
- [ ] **Garam Masala** — `#middle-eastern #seasoning`
- [ ] **Curry Powder** — `#curry #seasoning`
- [ ] **Italian Seasoning** — `#italian #seasoning`

### Doughs (3)
- [ ] **Noodle Dough** — `#dough`
- [ ] **Biscuit Dough** — `#baked #dough`
- [ ] **White Bread Dough** — `#baked #dough`

### American (2)
- [ ] **Burger** — `#beef #american`
- [ ] **Baked Bean Casserole** — `#vegetarian #american`

### Mexican (12)
- [ ] **Ground Beef Meat** — `#beef #mexican`
- [ ] **Ground Beef Tacos** — `#beef #mexican`
- [ ] **Shrimp Street Tacos** — `#shrimp #mexican`
- [ ] **Enchilada Pie** — `#mexican`
- [ ] **Lemon Lime Chicken** — `#chicken #mexican`
- [ ] **Fajita** — `#mexican`
- [ ] **Fajita Chicken** — `#chicken #mexican`
- [ ] **Fajita Shrimp** — `#shrimp #mexican`
- [ ] **Quesadillas** — `#mexican`
- [ ] **Mexican Rice Bowl** — `#mexican`
- [ ] **White Enchiladas** — `#mexican`
- [ ] **Spanish Chicken and Rice** — `#chicken #mexican`

### Asian (7)
- [ ] **Stir Fry** — `#asian`
- [ ] **Stir Fry - Beef** — `#beef #asian`
- [ ] **Stir Fry - Pork** — `#pork #asian`
- [ ] **Fried Rice** — `#asian`
- [ ] **Beef and Cabbage** — `#beef #asian`
- [ ] **Korean Bulgogi Beef** — `#beef #asian`
- [ ] **Katsu Fried Chicken** — `#chicken #asian`

### Italian (6)
- [ ] **Tomato Sauce** — `#italian #sauce`
- [ ] **Chicken Parmesan** — `#chicken #italian`
- [ ] **Spaghetti and Meatballs** — `#beef #italian`
- [ ] **Lasagna** — `#beef #italian`
- [ ] **Stuffed Meatballs** — `#beef #italian`
- [ ] **Stuffed Shells** — `#italian`

### Middle Eastern (1)
- [ ] **Middle Eastern Chicken** — `#chicken #middle-eastern`

### Sandwiches (5)
- [ ] **Grilled Cheese** — `#sandwich`
- [ ] **Grilled Peanut Butter and Jelly** — `#sandwich`
- [ ] **Cuban** — `#sandwich #pork`
- [ ] **Monte Cristo** — `#sandwich`
- [ ] **Chopped Salami** — `#sandwich #italian`

### Sides (10)
- [ ] **Brown Rice** — `#side #starch`
- [ ] **Quinoa** — `#side #starch`
- [ ] **Rice Pilaf** — `#side #starch`
- [ ] **Mashed Potatoes** — `#side #starch`
- [ ] **Smashed Potatoes** — `#side #starch`
- [ ] **Garlic Half-Mash Potatoes** — `#side #starch`
- [ ] **Twice Baked Mashed Potatoes** — `#side #starch`
- [ ] **Baked Potato Chunks** — `#side #starch`
- [ ] **Honey Carrots** — `#side #vegetable`
- [ ] **Parmesan Baked Carrots** — `#side #vegetable #italian`

### Soups (23)
- [ ] **Chicken Wild Rice Soup** — `#chicken #soup`
- [ ] **Cheesy Chicken Tortilla Soup** — `#chicken #soup #mexican`
- [ ] **Beef Barley Soup** — `#beef #soup`
- [ ] **Italian Wedding Soup** — `#soup #italian`
- [ ] **Stuffed Pepper Soup** — `#soup`
- [ ] **French Onion Soup** — `#soup`
- [ ] **Loaded Baked Potato Soup** — `#soup`
- [ ] **Cheesy Potato Soup** — `#soup`
- [ ] **Ham and 15 Bean Soup** — `#pork #soup`
- [ ] **Clam Chowder** — `#soup #seafood`
- [ ] **Cheesy Broccoli Soup** — `#soup #vegetarian`
- [ ] **Hot and Sour Soup** — `#soup #asian`
- [ ] **Minestrone** — `#soup #italian #vegetarian`
- [ ] **Egg Drop Soup** — `#eggs #soup #asian`
- [ ] **Sopa de Tortilla** — `#soup #mexican`
- [ ] **Sancocho** — `#soup`
- [ ] **Pozole** — `#soup #mexican`
- [ ] **Tomato Basil Soup** — `#soup #vegetarian #italian`
- [ ] **Lentil Soup** — `#vegetarian #soup`
- [ ] **Carrot Ginger Soup** — `#soup #vegetarian`
- [ ] **Butternut Squash Soup** — `#soup #vegetarian`
- [ ] **Chickpea and Spinach Soup** — `#vegetarian #soup`
- [ ] **Vegan Coconut Curry Soup** — `#vegetarian #soup #curry`

### Marinades (2)
- [ ] **Stir-Fry Marinade - Beef** — `#beef #marinade #asian`
- [ ] **Stir-Fry Marinade - Pork** — `#pork #marinade #asian`

### Smoothies (1)
- [ ] **Smoothies** — `#smoothie`

### Bread (1)
- [ ] **Bread** — `#baked #bread`
