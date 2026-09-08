"""
NutriLens Food Nutrient Dataset Cleaner & Normalizer.
Processes raw nutrient datasets (FOOD-DATA-GROUP1 through GROUP5),
cleans product names and nutritional values, assigns scientifically grounded
NOVA processing categories and Health Scores, tags allergens, and prepares
canonical training datasets for the NutriLens ML models.
"""

import os
import re
import glob
import pandas as pd
import numpy as np
from typing import Dict, Tuple, List, Set

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_SOURCE_DIR = os.path.join(os.path.dirname(BACKEND_DIR), "FINAL FOOD DATASET")
TARGET_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


# Allergen keyword map for automatic allergen tagging
ALLERGEN_TAXONOMY = {
    "Milk/Dairy": [
        "cheese", "cream", "butter", "milk", "yogurt", "yoghurt", "whey", "casein",
        "custard", "dairy", "eggnog", "pudding", "requijao", "zaziki", "ricotta",
        "parmesan", "gouda", "cheddar", "provolone", "mozzarella", "brie", "camembert"
    ],
    "Gluten/Wheat": [
        "wheat", "flour", "bread", "pasta", "spaghetti", "macaroni", "noodle", "crust",
        "beer", "malt", "barley", "rye", "oat", "couscous", "roti", "chapati",
        "cracker", "cookie", "cake", "pie", "eclair", "shortbread"
    ],
    "Eggs": [
        "egg", "eggnog", "custard", "mayonnaise", "meringue"
    ],
    "Tree Nuts": [
        "almond", "walnut", "cashew", "pecan", "hazelnut", "pistachio", "macadamia",
        "brazil nut", "chestnut", "pine nut", "acorn"
    ],
    "Peanuts": [
        "peanut", "peanut butter"
    ],
    "Fish": [
        "fish", "salmon", "tuna", "cod", "sardine", "mackerel", "menhaden", "trout",
        "anchovy", "bass", "halibut", "snapper"
    ],
    "Shellfish": [
        "shrimp", "prawn", "crab", "lobster", "clam", "oyster", "mussel", "scallop",
        "squid", "calamari", "octopus", "jellyfish"
    ],
    "Soy": [
        "soy", "soya", "tofu", "edamame", "tempeh", "miso", "soybean"
    ],
    "Sesame": [
        "sesame", "tahini"
    ]
}

# NOVA 2 indicators: pure culinary ingredients
CULINARY_INGREDIENTS = [
    "oil", "butter", "lard", "shortening", "sugar", "granulated sugar", "brown sugar",
    "syrup", "maple syrup", "corn syrup", "honey", "molasses", "salt", "vinegar",
    "starch", "cornstarch", "cocoa butter"
]

# NOVA 4 indicators: industrial / ultra-processed items
ULTRA_PROCESSED_KEYWORDS = [
    "margarine", "pudding", "soda", "root beer", "whiskey sour mix", "cola",
    "instant", "powder", "flavored", "confectionery", "candy", "taffy", "marshmallow",
    "microwave popcorn", "shortbread", "frosting", "imitation", "artificial",
    "sweetener", "bologna", "frankfurter", "hot dog", "nuggets", "tyson",
    "fries", "shoestring", "soft drink", "energy drink", "punch", "liqueur"
]

# NOVA 3 indicators: processed foods with added salt/oil/sugar or fermentation
PROCESSED_KEYWORDS = [
    "cheese", "canned", "stewed", "pickled", "salted", "cured", "smoked",
    "bacon", "ham", "sausage", "beer", "wine", "bread", "roti", "roll",
    "pasta", "cracker"
]


def clean_food_name(name: str) -> str:
    """Format and clean raw food string."""
    if not isinstance(name, str):
        return "Unknown Food Item"
    cleaned = name.strip()
    cleaned = re.sub(r'\s+', ' ', cleaned)
    # Title-case nicely
    return cleaned.title()


def determine_nova_group(food_name: str, sugars: float, fat: float, sodium_mg: float, group_num: int) -> int:
    """
    Determine NOVA processing group (1 to 4) based on FAO / Pan American Health Organization guidelines.
    Group 1: Unprocessed / minimally processed
    Group 2: Processed culinary ingredients (pure fats, sugars, salts, oils)
    Group 3: Processed foods (canned, cured, cheeses, traditional breads, wine/beer)
    Group 4: Ultra-processed food and drink products
    """
    name_lower = food_name.lower()

    # Explicit ultra-processed patterns
    if any(k in name_lower for k in ULTRA_PROCESSED_KEYWORDS):
        return 4

    # Group 4 from dataset source: Puddings, industrial dairy desserts, confectionery
    if group_num == 4:
        # Puddings, sweet desserts, commercial snack creams
        if any(w in name_lower for w in ["pudding", "pie", "custard", "cream", "snack"]):
            return 4
        return 3

    # Pure culinary ingredients (Group 5 fats & oils, or pure sugars/salts)
    if any(k == name_lower or f" {k}" in name_lower or name_lower.startswith(k) for k in CULINARY_INGREDIENTS):
        # If it's pure oil, lard, shortening, sugar, salt
        if any(w in name_lower for w in ["oil", "lard", "shortening", "sugar", "salt", "syrup"]):
            return 2
        # Butters / Margarines: Margarine is NOVA 4; pure butter is NOVA 2
        if "margarine" in name_lower:
            return 4
        if "butter" in name_lower:
            return 2

    # Processed foods (Group 1 cheeses, canned/cured meats, beers/wines)
    if any(k in name_lower for k in PROCESSED_KEYWORDS):
        return 3

    # Alcohol beverages (beers, wines)
    if any(w in name_lower for w in ["beer", "wine", "whiskey", "rum", "vodka", "tequila", "daiquiri"]):
        return 3

    # Fast foods / highly sweetened or high sodium processed items
    if sugars > 30.0 or sodium_mg > 1800.0:
        return 4

    # Fresh produce, raw cuts of meat, plain legumes, raw seeds, fresh fruits, unflavored raw nuts
    return 1


def calculate_health_score(
    calories: float,
    protein_g: float,
    carbs_g: float,
    fat_g: float,
    sugar_g: float,
    sodium_mg: float,
    fiber_g: float,
    nutrition_density: float,
    nova_group: int
) -> float:
    """
    Computes a balanced Health Score from 5 to 99 following Nutri-Score & FSA nutrient profiling principles.
    Considers positive nutritional factors (fiber, protein, nutrient density) and negative factors (sugars, saturated fat, sodium, ultra-processing).
    """
    # Start at a neutral baseline of 70
    score = 70.0

    # 1. Processing level impact
    if nova_group == 4:
        score -= 25.0
    elif nova_group == 3:
        score -= 8.0
    elif nova_group == 1:
        score += 10.0

    # 2. Dietary Fiber bonus (high fiber is a hallmark of clean whole foods)
    if fiber_g > 0:
        score += min(15.0, fiber_g * 2.5)

    # 3. Protein balance
    if protein_g > 5.0:
        score += min(10.0, (protein_g - 5.0) * 0.4)

    # 4. Nutrition Density index bonus
    if nutrition_density > 50.0:
        score += min(12.0, (nutrition_density - 50.0) * 0.05)
    elif nutrition_density < 10.0:
        score -= 5.0

    # 5. Sugar penalties (high simple sugars degrade metabolic health)
    if sugar_g > 10.0:
        score -= min(28.0, (sugar_g - 10.0) * 0.9)

    # 6. Sodium penalties
    if sodium_mg > 400.0:
        score -= min(20.0, (sodium_mg - 400.0) * 0.015)

    # 7. Caloric & Fat density balance
    if calories > 500.0 and nova_group >= 3:
        score -= min(15.0, (calories - 500.0) * 0.02)
    elif calories > 300.0 and sugar_g > 20.0:
        score -= 8.0

    # Clip to healthy bounds (5 to 98)
    return round(float(np.clip(score, 5.0, 98.0)), 1)


def generate_ingredient_text(food_name: str, nova: int, protein_g: float, carbs_g: float, fat_g: float, fiber_g: float) -> str:
    """
    Constructs an informative, normalized ingredient text string from the food name
    and nutritional characteristics for NLP tokenization and TF-IDF feature learning.
    """
    name_lower = food_name.lower().strip()
    tokens = [name_lower]

    # Add descriptive sub-ingredients based on food category
    if "cheese" in name_lower:
        tokens.extend(["pasteurized milk", "cheese cultures", "salt", "enzymes"])
    elif "yogurt" in name_lower or "yoghurt" in name_lower:
        tokens.extend(["cultured milk", "live active probiotic cultures"])
    elif "bread" in name_lower or "roll" in name_lower:
        tokens.extend(["grain flour", "water", "yeast", "salt"])
    elif "pudding" in name_lower:
        tokens.extend(["sugar", "modified starch", "milk solids", "natural flavoring", "emulsifier"])
    elif "butter" in name_lower:
        tokens.extend(["pasteurized cream", "natural milk fat"])
    elif "margarine" in name_lower:
        tokens.extend(["hydrogenated vegetable oil", "water", "salt", "soy lecithin", "mono and diglycerides"])
    elif "oil" in name_lower:
        tokens.extend([name_lower, "pure extracted plant lipids"])
    elif "beer" in name_lower:
        tokens.extend(["water", "malted barley", "hops", "brewer yeast"])
    elif "wine" in name_lower:
        tokens.extend(["fermented grape juice", "sulfites"])
    elif any(k in name_lower for k in ["chicken", "turkey", "duck", "pheasant"]):
        tokens.extend(["fresh poultry meat", "protein amino acids"])
    elif any(k in name_lower for k in ["pork", "beef", "veal", "lamb"]):
        tokens.extend(["fresh meat", "essential amino acids", "heme iron"])
    elif any(k in name_lower for k in ["fish", "salmon", "cod", "tuna", "sardine"]):
        tokens.extend(["fresh fish fillet", "omega 3 fatty acids"])
    elif any(k in name_lower for k in ["apple", "berry", "banana", "fruit", "pear", "peach", "orange", "grape"]):
        tokens.extend(["fresh raw fruit", "natural fruit sugars", "plant dietary fiber", "vitamin c"])
    elif any(k in name_lower for k in ["cabbage", "spinach", "tomato", "salad", "shoot", "greens"]):
        tokens.extend(["fresh raw vegetable", "dietary fiber", "folate", "antioxidants"])

    if fiber_g > 3.0:
        tokens.append("dietary fiber")
    if protein_g > 15.0:
        tokens.append("high protein")

    return ", ".join(tokens)


def detect_allergens(food_name: str) -> str:
    """Detect potential allergens present in the food item."""
    name_lower = food_name.lower()
    found: List[str] = []
    for allergen, keywords in ALLERGEN_TAXONOMY.items():
        if any(re.search(rf'\b{re.escape(kw)}\b', name_lower) for kw in keywords):
            found.append(allergen)
    return ", ".join(found)


def detect_additives(food_name: str, nova_group: int) -> str:
    """Tag potential industrial food additives based on food classification."""
    name_lower = food_name.lower()
    additives: List[str] = []

    if "margarine" in name_lower:
        additives.extend(["E471 (Mono and diglycerides)", "E322 (Lecithin)", "E160a (Beta-carotene)"])
    if "pudding" in name_lower:
        additives.extend(["E1442 (Modified starch)", "E407 (Carrageenan)"])
    if "root beer" in name_lower or "soda" in name_lower:
        additives.extend(["E150d (Caramel color)", "E330 (Citric acid)"])
    if "bologna" in name_lower or "frankfurter" in name_lower:
        additives.extend(["E250 (Sodium nitrite)", "E451 (Triphosphates)"])
    if "wine" in name_lower:
        additives.append("E220 (Sulfur dioxide)")

    return ", ".join(additives)


def clean_and_prepare_all_groups(source_dir: str = DATASET_SOURCE_DIR, target_dir: str = TARGET_DATA_DIR) -> pd.DataFrame:
    """
    Loads all 5 FOOD-DATA-GROUP files, standardizes columns, cleans values,
    computes NOVA and Health Score, and writes out cleaned CSV datasets.
    """
    print("===================================================================")
    print("   NutriLens Dataset Cleaning & Normalization Pipeline Starting   ")
    print("===================================================================")
    print(f"Reading from: {source_dir}")
    print(f"Target directory: {target_dir}")

    os.makedirs(target_dir, exist_ok=True)
    csv_files = sorted(glob.glob(os.path.join(source_dir, "FOOD-DATA-GROUP*.csv")))
    if not csv_files:
        raise FileNotFoundError(f"No FOOD-DATA-GROUP*.csv files found in {source_dir}!")

    cleaned_records = []

    for fpath in csv_files:
        filename = os.path.basename(fpath)
        # Extract group number (1 to 5)
        match = re.search(r'GROUP(\d+)', filename)
        group_num = int(match.group(1)) if match else 1

        df_raw = pd.read_csv(fpath)
        print(f"Processing {filename}: {len(df_raw)} records (Group {group_num})")

        for _, row in df_raw.iterrows():
            raw_name = str(row.get("food", "")).strip()
            if not raw_name or len(raw_name) < 2:
                continue

            product_name = clean_food_name(raw_name)

            # Extract numeric fields
            calories = max(0.0, float(row.get("Caloric Value", 0.0)))
            fat_g = max(0.0, float(row.get("Fat", 0.0)))
            carbs_g = max(0.0, float(row.get("Carbohydrates", 0.0)))
            sugar_g = max(0.0, float(row.get("Sugars", 0.0)))
            protein_g = max(0.0, float(row.get("Protein", 0.0)))
            fiber_g = max(0.0, float(row.get("Dietary Fiber", 0.0)))

            # Sodium in dataset is in grams -> convert to milligrams
            raw_sodium = max(0.0, float(row.get("Sodium", 0.0)))
            sodium_mg = round(raw_sodium * 1000.0, 1)

            nutrition_density = max(0.0, float(row.get("Nutrition Density", 0.0)))

            # Processing and scoring
            nova_group = determine_nova_group(product_name, sugar_g, fat_g, sodium_mg, group_num)
            health_score = calculate_health_score(
                calories=calories,
                protein_g=protein_g,
                carbs_g=carbs_g,
                fat_g=fat_g,
                sugar_g=sugar_g,
                sodium_mg=sodium_mg,
                fiber_g=fiber_g,
                nutrition_density=nutrition_density,
                nova_group=nova_group
            )

            ingredients_text = generate_ingredient_text(
                food_name=product_name,
                nova=nova_group,
                protein_g=protein_g,
                carbs_g=carbs_g,
                fat_g=fat_g,
                fiber_g=fiber_g
            )

            allergens = detect_allergens(product_name)
            additives = detect_additives(product_name, nova_group)

            cleaned_records.append({
                "product_name": product_name,
                "ingredients_text": ingredients_text,
                "nova_group": nova_group,
                "health_score": health_score,
                "allergens": allergens,
                "additives": additives,
                "calories": round(calories, 1),
                "protein_g": round(protein_g, 1),
                "carbs_g": round(carbs_g, 1),
                "fat_g": round(fat_g, 1),
                "sugar_g": round(sugar_g, 1),
                "sodium_mg": sodium_mg,
                "fiber_g": round(fiber_g, 1),
                "nutrition_density": round(nutrition_density, 1),
                "food_group": f"Group {group_num}",
                "source_dataset": filename
            })

    df_cleaned = pd.DataFrame(cleaned_records)

    # Deduplicate by product name
    df_cleaned = df_cleaned.drop_duplicates(subset=["product_name"]).reset_index(drop=True)
    print(f"\nTotal unique cleaned food products: {len(df_cleaned)}")
    print(f"NOVA Group distribution:\n{df_cleaned['nova_group'].value_counts().sort_index()}")
    print(f"Average Health Score by NOVA Group:")
    print(df_cleaned.groupby('nova_group')['health_score'].agg(['count', 'mean', 'min', 'max']))

    # Check if there is an existing food_products_dataset.csv to merge
    existing_file = os.path.join(target_dir, "food_products_dataset.csv")
    if os.path.exists(existing_file):
        try:
            df_exist = pd.read_csv(existing_file)
            print(f"Existing food_products_dataset.csv has {len(df_exist)} records.")
            # Standardize column structure if needed
            for col in ["fiber_g", "nutrition_density", "food_group", "source_dataset"]:
                if col not in df_exist.columns:
                    df_exist[col] = 0.0 if "g" in col or "density" in col else "Existing Catalog"

            # Combine and deduplicate
            merged_df = pd.concat([df_cleaned, df_exist], ignore_index=True)
            merged_df = merged_df.drop_duplicates(subset=["product_name"]).reset_index(drop=True)
        except Exception as e:
            print(f"Warning merging existing file: {e}")
            merged_df = df_cleaned
    else:
        merged_df = df_cleaned

    # Save outputs
    clean_export_path = os.path.join(target_dir, "cleaned_food_nutrients_dataset.csv")
    merged_df.to_csv(clean_export_path, index=False)
    print(f"Exported master dataset to: {clean_export_path} ({len(merged_df)} items)")

    # Also update food_products_dataset.csv so existing references use the full dataset
    merged_df.to_csv(existing_file, index=False)
    print(f"Synchronized with primary dataset file: {existing_file}")

    print("===================================================================\n")
    return merged_df


if __name__ == "__main__":
    clean_and_prepare_all_groups()
