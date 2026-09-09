"""
NutriLens Food vs. Non-Food Semantic Classifier.
Determines whether scanned OCR text or product information is an authentic food / nutrition product or a non-food foreign object.
"""

import re
from typing import Tuple, Dict, Any, List

# Core edible food ingredients across all categories
FOOD_INGREDIENT_TOKENS = {
    # Flours, Grains, Seeds & Starches
    "flour", "wheat", "grain", "oats", "oatmeal", "rice", "corn", "barley", "rye", "millet",
    "quinoa", "buckwheat", "semolina", "tapioca", "starch", "cornstarch", "potato", "chia",
    "flaxseed", "sesame", "sunflower", "pumpkin", "hemp", "gluten", "bran", "cereal",

    # Sugars, Sweeteners & Syrups
    "sugar", "sucrose", "glucose", "fructose", "dextrose", "maltose", "lactose", "maltodextrin",
    "syrup", "honey", "molasses", "cane", "stevia", "aspartame", "sucralose", "acesulfame",
    "erythritol", "xylitol", "sorbitol", "caramel", "treacle", "agave",

    # Oils, Fats & Dairy
    "oil", "butter", "margarine", "fat", "lard", "shortening", "ghee", "milk", "cream",
    "cheese", "cheddar", "mozzarella", "parmesan", "ricotta", "yogurt", "curd", "whey",
    "casein", "buttermilk", "palm", "canola", "sunflower", "soybean", "olive", "coconut",

    # Proteins, Meats & Plant Proteins
    "chicken", "beef", "pork", "turkey", "fish", "salmon", "tuna", "shrimp", "egg", "eggs",
    "albumin", "egg yolk", "tofu", "tempeh", "soy", "soya", "soybean", "lentil", "lentils",
    "pea", "peas", "bean", "beans", "chickpea", "edamame", "protein",

    # Fruits & Vegetables
    "apple", "banana", "berry", "blueberries", "strawberries", "raspberries", "orange", "lemon",
    "lime", "grape", "mango", "peach", "pineapple", "tomato", "onion", "garlic", "carrot",
    "spinach", "broccoli", "celery", "cabbage", "beet", "ginger", "avocado", "raisin", "date",

    # Nuts & Legumes
    "almond", "almonds", "peanut", "peanuts", "cashew", "walnut", "walnuts", "pistachio",
    "pecan", "hazelnut", "macadamia",

    # Flavorings, Spices, Extracts & Additives
    "salt", "sea salt", "sodium", "pepper", "cinnamon", "vanilla", "cacao", "cocoa", "chocolate",
    "yeast", "vinegar", "citric acid", "malic acid", "ascorbic acid", "lecithin", "pectin",
    "gelatin", "xanthan", "guar gum", "flavor", "flavour", "flavoring", "seasoning", "spice",
    "spices", "herb", "herbs", "curry", "paprika", "turmeric", "oregano", "basil", "parsley",
    "preservative", "antioxidant", "emulsifier", "color", "colour", "extract", "juice", "puree",
    "concentrate", "coffee", "tea", "water"
}

# Standard Nutrition Facts panel terminology
NUTRITION_FACTS_TERMS = {
    "nutrition facts", "serving size", "servings per container", "servings",
    "calories", "calorie", "kcal", "total fat", "saturated fat", "trans fat",
    "cholesterol", "sodium", "total carbohydrate", "carbohydrate", "carbohydrates",
    "carbs", "dietary fiber", "fiber", "sugars", "added sugars", "protein",
    "vitamin", "vitamins", "calcium", "iron", "potassium", "daily value", "% dv"
}

# Ingredient list headings
FOOD_HEADING_PATTERNS = [
    r'\bingredients?\s*[:\-]',
    r'\bcontents?\s*[:\-]',
    r'\bcontains?\s*[:\-]',
    r'\bingrédients?\s*[:\-]',
    r'\bingredientes?\s*[:\-]',
    r'\ballergen (advice|information)\b'
]

# Non-Food & Foreign Object Keywords
NON_FOOD_INDICATORS = {
    # Electronics, Computing & Hardware
    "laptop", "computer", "intel", "amd", "nvidia", "core i3", "core i5", "core i7", "core i9",
    "snapdragon", "ram", "ddr4", "ddr5", "ssd", "hdd", "nvme", "gigabyte", "megabyte",
    "display", "screen", "oled", "amoled", "lcd", "pixel", "hdmi", "usb", "type-c", "bluetooth",
    "wifi", "wi-fi", "ethernet", "battery", "lithium", "mah", "voltage", "ampere", "watt",
    "wattage", "ghz", "mhz", "charger", "adapter", "circuit", "motherboard", "firmware",
    "operating system", "windows 10", "windows 11", "android", "ios", "macos", "linux",
    "mouse", "keyboard", "headphone", "earphone", "bluetooth speaker",

    # Apparel, Textiles & Fabrics
    "cotton", "polyester", "spandex", "nylon", "rayon", "elastane", "acrylic", "wool",
    "dry clean only", "machine wash", "tumble dry", "do not bleach", "iron low",
    "wash cold", "made in china", "made in bangladesh", "made in vietnam", "made in india",

    # Invoices, Receipts & Financial Documents
    "invoice", "receipt", "subtotal", "tax id", "tax rate", "gst", "vat", "cashier",
    "total amount", "balance due", "order #", "order id", "tracking #", "billing address",
    "shipping address", "credit card", "debit card", "customer copy",

    # Books, Publishing & Office
    "chapter", "edition", "isbn", "publisher", "bibliography", "preface", "index", "volume",

    # Industrial, Automotive & Cleaning Chemicals
    "bleach", "detergent", "disinfectant", "floor cleaner", "toilet cleaner", "engine oil",
    "motor oil", "lubricant", "brake fluid", "toxic", "poison", "keep out of reach of children",
    "for external use only", "flammable", "corrosive"
}


def classify_food_item(text: str) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Analyzes scanned text to verify if it represents an edible food or nutrition product.
    Returns:
        is_food (bool): True if verified food/beverage/nutrition item, False if foreign/non-food.
        reason (str): Human-readable justification.
        stats (dict): Counts of food vs non-food indicators.
    """
    if not text or not text.strip():
        return False, "No readable text detected in this scan.", {"food_score": 0, "non_food_score": 0}

    text_lower = text.lower()
    words = set(re.findall(r'[a-zA-Z]{3,}', text_lower))

    # 1. Match Food Indicators
    food_matches = []
    for food_word in FOOD_INGREDIENT_TOKENS:
        # Check boundary match
        if re.search(r'\b' + re.escape(food_word) + r'\b', text_lower):
            food_matches.append(food_word)

    # 2. Match Nutrition Facts Terminology
    nutrition_matches = [t for t in NUTRITION_FACTS_TERMS if t in text_lower]

    # 3. Match Food Header Patterns
    has_food_header = any(bool(re.search(pattern, text_lower)) for pattern in FOOD_HEADING_PATTERNS)

    # 4. Check for Additive E-Codes (e.g. E621, E330, E150d)
    has_e_codes = bool(re.search(r'\b[eE][-\s]?[0-9]{3,4}[a-z]?\b', text))

    # 5. Match Non-Food Indicators
    non_food_matches = []
    for non_food in NON_FOOD_INDICATORS:
        if re.search(r'\b' + re.escape(non_food) + r'\b', text_lower):
            non_food_matches.append(non_food)

    stats = {
        "food_tokens_count": len(food_matches),
        "nutrition_terms_count": len(nutrition_matches),
        "has_food_header": has_food_header,
        "has_e_codes": has_e_codes,
        "non_food_tokens_count": len(non_food_matches),
        "detected_food_sample": food_matches[:5],
        "detected_non_food_sample": non_food_matches[:5]
    }

    # DECISION RULES:

    # Rule A: Strong non-food markers with negligible food presence
    if len(non_food_matches) >= 2 and len(food_matches) <= 1 and not has_food_header and not nutrition_matches:
        samples = ", ".join(non_food_matches[:3])
        return (
            False,
            f"Non-Food Object Detected: Scanned content contains foreign hardware/apparel terms ({samples}) with zero nutritional data.",
            stats
        )

    # Rule B: Specific non-food item with 1 strong indicator
    if len(non_food_matches) >= 1 and len(food_matches) == 0 and not nutrition_matches and not has_food_header:
        sample = non_food_matches[0]
        return (
            False,
            f"Non-Food Object Detected: Found '{sample}' which does not belong to a food or beverage product.",
            stats
        )

    # Rule C: Clear Food or Nutrition indicators found
    if has_food_header or len(nutrition_matches) >= 2 or len(food_matches) >= 2 or has_e_codes:
        return (
            True,
            "Recognized Food Product: Food ingredients or nutrition facts successfully identified.",
            stats
        )

    # Rule D: Single food word in a reasonably short text (e.g. "Cheddar Cheese")
    if len(food_matches) == 1 and len(words) <= 8 and len(non_food_matches) == 0:
        return (
            True,
            f"Recognized Food Product: Identified edible item '{food_matches[0]}'.",
            stats
        )

    # Rule E: No food markers whatsoever
    return (
        False,
        "Unrecognized Content: No food ingredients, additives, or nutrition facts were found in this scan.",
        stats
    )
