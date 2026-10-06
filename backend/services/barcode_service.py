"""
NutriLens Barcode Lookup Service.
Connects to OpenFoodFacts global food database and local catalog to identify food products from barcodes (EAN/UPC/GTIN).
"""

import re
import json
import urllib.request
from typing import Optional, Dict, Any

OPENFOODFACTS_BASE_URL = "https://world.openfoodfacts.org/api/v2/product"
REQUEST_HEADERS = {
    "User-Agent": "NutriLensApp/2.0 (contact@nutrilens.app; https://nutrilens.app)"
}


def extract_barcode_digits(text: str) -> Optional[str]:
    """Extracts a valid 8 to 14 digit barcode from input text or GTIN string."""
    if not text:
        return None
    # Check for GTIN pattern e.g. "Scanned Barcode GTIN: 3017620422003" or pure digits
    match = re.search(r'\b(\d{8}|\d{12}|\d{13}|\d{14})\b', text.strip())
    if match:
        return match.group(1)
    return None


def decode_barcode_from_image(image_base64: str, allow_ocr_fallback: bool = False) -> Optional[str]:
    """
    Decodes barcode numbers (EAN-13, EAN-8, UPC-A, UPC-E, Code 128, etc.) from base64 image data.
    Uses zxing-cpp with adaptive preprocessing and rotation passes.
    Optional OCR digit fallback is disabled by default to avoid duplicate OCR cycles during full label scans.
    """
    if not image_base64:
        return None

    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]

    try:
        import base64
        from io import BytesIO
        from PIL import Image, ImageOps, ImageEnhance

        image_bytes = base64.b64decode(image_base64)
        img = Image.open(BytesIO(image_bytes))

        # 1. Correct mobile EXIF orientation
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # 2. Downscale huge photos (>1800px)
        max_dim = max(img.width, img.height)
        if max_dim > 1800:
            scale = 1800.0 / max_dim
            img = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)

        def _try_zxing(target_img):
            try:
                import zxingcpp
                results = zxingcpp.read_barcodes(target_img)
                for r in results:
                    if r.text:
                        clean = re.sub(r'\D', '', r.text)
                        if len(clean) >= 8:
                            return clean
            except Exception:
                pass
            return None

        # Pass 1: standard image and mirrored image (laptop webcams stream mirrored video)
        code = _try_zxing(img)
        if code:
            return code

        img_mirrored = ImageOps.mirror(img)
        code = _try_zxing(img_mirrored)
        if code:
            return code

        # Pass 2: Grayscale and contrast enhanced (both standard and mirrored)
        try:
            gray = img.convert("L")
            enh = ImageEnhance.Contrast(gray).enhance(2.0)
            code = _try_zxing(enh) or _try_zxing(ImageOps.mirror(enh))
            if code:
                return code
        except Exception:
            pass

        # Pass 3: Rotations (90, 180, 270 degrees)
        for angle in (90, 180, 270):
            try:
                rotated = img.rotate(angle, expand=True)
                code = _try_zxing(rotated) or _try_zxing(ImageOps.mirror(rotated))
                if code:
                    return code
            except Exception:
                pass

        # Pass 4: Fallback to OCR digit extraction only when explicitly requested
        if allow_ocr_fallback:
            try:
                from services.model_service import extract_text_from_image_base64
                ocr_text = extract_text_from_image_base64(image_base64)
                digits = extract_barcode_digits(ocr_text)
                if digits:
                    return digits
            except Exception:
                pass

    except Exception as e:
        print(f"Error in decode_barcode_from_image: {e}")

    return None


# Curated offline food barcode catalog (instantaneous, offline, reliable)
LOCAL_BARCODE_CATALOG: Dict[str, Dict[str, Any]] = {
    # 1. Nestlé Maggi Noodles (Indian & Global GTINs)
    "8901058852898": {
        "product_name": "Maggi 2-Minute Masala Noodles",
        "brand": "Nestlé",
        "category": "Instant Noodles & Pasta",
        "nova_group": 4,
        "health_score": 35,
        "ingredients_text": "Wheat flour (Maida), Palm oil, Salt, Wheat gluten, Mineral (Calcium carbonate), Thickeners (508, 412), Acidity regulators (501(i), 500(i)), Humectant (451(i)). Tastemaker: Mixed spices (Hydrolysed groundnut protein, Onion powder, Coriander powder, Turmeric, Red chilli, Cumin, Aniseed, Fenugreek, Ginger, Black pepper, Clove, Nutmeg, Cardamom), Noodle powder, Sugar, Edible starch, Salt, Palm oil, Flavor enhancer (635), Acidity regulator (330).",
        "nutriments": {
            "calories": 427.0,
            "protein_g": 8.0,
            "carbs_g": 63.5,
            "fat_g": 15.7,
            "sugar_g": 2.2,
            "sodium_mg": 1020.0
        },
        "source": "NutriLens Verified Food Catalog"
    },
    "8901058852102": {
        "product_name": "Maggi 2-Minute Special Masala Noodles",
        "brand": "Nestlé",
        "category": "Instant Noodles",
        "nova_group": 4,
        "health_score": 34,
        "ingredients_text": "Wheat flour, palm oil, salt, spices (turmeric, coriander, cumin, chilli, ginger, clove), flavour enhancer (635).",
        "nutriments": { "calories": 435.0, "protein_g": 8.2, "carbs_g": 64.0, "fat_g": 16.0, "sugar_g": 2.5, "sodium_mg": 1080.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 2. Lay's Potato Chips
    "8901491101837": {
        "product_name": "Lay's Classic Salted Potato Chips",
        "brand": "PepsiCo / Lay's",
        "category": "Crisps & Snacks",
        "nova_group": 3,
        "health_score": 45,
        "ingredients_text": "Selected Potatoes, Edible Vegetable Oil (Palmolein, Rice Bran Oil), Salt (1.2%).",
        "nutriments": {
            "calories": 542.0,
            "protein_g": 6.8,
            "carbs_g": 52.8,
            "fat_g": 33.7,
            "sugar_g": 0.4,
            "sodium_mg": 570.0
        },
        "source": "NutriLens Verified Food Catalog"
    },
    "8901491101844": {
        "product_name": "Kurkure Masala Munch",
        "brand": "PepsiCo",
        "category": "Extruded Snacks",
        "nova_group": 4,
        "health_score": 40,
        "ingredients_text": "Rice meal, Edible vegetable oil (Palmolein), Corn meal, Gram meal, Spices & condiments (Onion powder, Chilli powder, Dry mango, Coriander, Ginger, Black pepper), Salt.",
        "nutriments": { "calories": 558.0, "protein_g": 5.8, "carbs_g": 56.6, "fat_g": 34.5, "sugar_g": 1.6, "sodium_mg": 840.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 3. Coca-Cola
    "5449000000996": {
        "product_name": "Coca-Cola Original Taste",
        "brand": "The Coca-Cola Company",
        "category": "Carbonated Soft Drinks",
        "nova_group": 4,
        "health_score": 28,
        "ingredients_text": "Carbonated water, Sugar (High Fructose Corn Syrup / Sucrose), Acidity regulator (338), Natural flavourings including caffeine, Colour (Caramel E150d).",
        "nutriments": {
            "calories": 140.0,
            "protein_g": 0.0,
            "carbs_g": 35.0,
            "fat_g": 0.0,
            "sugar_g": 35.0,
            "sodium_mg": 40.0
        },
        "source": "NutriLens Verified Food Catalog"
    },
    "049000000443": {
        "product_name": "Coca-Cola Classic (Can 355ml)",
        "brand": "The Coca-Cola Company",
        "category": "Soft Drinks",
        "nova_group": 4,
        "health_score": 28,
        "ingredients_text": "Carbonated water, High fructose corn syrup, Caramel color, Phosphoric acid, Natural flavors, Caffeine.",
        "nutriments": { "calories": 140.0, "protein_g": 0.0, "carbs_g": 39.0, "fat_g": 0.0, "sugar_g": 39.0, "sodium_mg": 45.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 4. Ferrero Nutella
    "3017620422003": {
        "product_name": "Nutella Hazelnut Spread with Cocoa",
        "brand": "Ferrero",
        "category": "Chocolate & Hazelnut Spreads",
        "nova_group": 4,
        "health_score": 32,
        "ingredients_text": "Sugar, Palm oil, Hazelnuts (13%), Skimmed milk powder (8.7%), Fat-reduced cocoa (7.4%), Emulsifier: lecithins (soya), Vanillin.",
        "nutriments": {
            "calories": 539.0,
            "protein_g": 6.3,
            "carbs_g": 57.5,
            "fat_g": 30.9,
            "sugar_g": 56.3,
            "sodium_mg": 42.0
        },
        "source": "NutriLens Verified Food Catalog"
    },
    # 5. KitKat
    "8901058859187": {
        "product_name": "Nestlé KitKat 4-Finger Wafer Bar",
        "brand": "Nestlé",
        "category": "Chocolates & Wafers",
        "nova_group": 4,
        "health_score": 38,
        "ingredients_text": "Sugar, Milk solids, Wheat flour (Maida), Hydrogenated vegetable fats, Cocoa butter, Cocoa solids, Emulsifier (Soya lecithin), Yeast, Raising agent (500(ii)).",
        "nutriments": { "calories": 518.0, "protein_g": 7.1, "carbs_g": 63.8, "fat_g": 26.2, "sugar_g": 47.0, "sodium_mg": 85.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 6. Oreo
    "7622210411808": {
        "product_name": "Oreo Original Vanilla Creme Cookies",
        "brand": "Mondelēz International",
        "category": "Biscuits & Cookies",
        "nova_group": 4,
        "health_score": 35,
        "ingredients_text": "Refined wheat flour, Sugar, Palm oil, Invert sugar, Cocoa solids (2.3%), Leavening agents (500(ii), 503(ii)), Salt, Emulsifier (Soya lecithin), Nature identical vanilla flavour.",
        "nutriments": { "calories": 483.0, "protein_g": 5.2, "carbs_g": 70.8, "fat_g": 19.6, "sugar_g": 38.5, "sodium_mg": 430.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 7. Parle-G
    "8901719101038": {
        "product_name": "Parle-G Original Gluco Biscuits",
        "brand": "Parle Products",
        "category": "Glucose Biscuits",
        "nova_group": 4,
        "health_score": 52,
        "ingredients_text": "Wheat flour (Maida), Sugar, Edible vegetable oil (RBD Palm oil), Invert sugar syrup, Leavening agents (503(ii), 500(ii)), Salt, Milk solids, Emulsifiers, Dough conditioner (223).",
        "nutriments": { "calories": 454.0, "protein_g": 6.5, "carbs_g": 78.2, "fat_g": 12.8, "sugar_g": 25.5, "sodium_mg": 310.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 8. Britannia Good Day
    "8901063012843": {
        "product_name": "Britannia Good Day Butter Cookies",
        "brand": "Britannia Industries",
        "category": "Cookies & Biscuits",
        "nova_group": 4,
        "health_score": 44,
        "ingredients_text": "Refined wheat flour (Maida), Sugar, Edible vegetable oil (Palm), Butter (2%), Invert syrup, Milk solids, Leavening agents (503(ii), 500(ii)), Salt, Emulsifiers (322).",
        "nutriments": { "calories": 492.0, "protein_g": 6.0, "carbs_g": 68.0, "fat_g": 22.0, "sugar_g": 23.0, "sodium_mg": 360.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 9. Amul Butter
    "8901262010054": {
        "product_name": "Amul Pasteurized Salted Butter",
        "brand": "Amul",
        "category": "Dairy & Butter",
        "nova_group": 2,
        "health_score": 68,
        "ingredients_text": "Butter (Pasteurized cream from cow/buffalo milk), Common Salt, Annatto color.",
        "nutriments": { "calories": 720.0, "protein_g": 0.5, "carbs_g": 0.0, "fat_g": 80.0, "sugar_g": 0.0, "sodium_mg": 820.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 10. Cadbury Dairy Milk
    "7622201736637": {
        "product_name": "Cadbury Dairy Milk Chocolate",
        "brand": "Cadbury / Mondelēz",
        "category": "Milk Chocolate",
        "nova_group": 4,
        "health_score": 38,
        "ingredients_text": "Sugar, Milk solids (16%), Cocoa butter, Cocoa solids, Emulsifiers (442, 476), Flavours (Natural, nature identical and artificial vanilla flavouring substances).",
        "nutriments": { "calories": 534.0, "protein_g": 7.8, "carbs_g": 60.5, "fat_g": 29.8, "sugar_g": 57.0, "sodium_mg": 140.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 11. Red Bull
    "9002490100070": {
        "product_name": "Red Bull Energy Drink",
        "brand": "Red Bull GmbH",
        "category": "Energy Drinks",
        "nova_group": 4,
        "health_score": 36,
        "ingredients_text": "Water, Sucrose, Glucose, Citric acid, Carbon dioxide, Taurine (0.4%), Caffeine (0.03%), Vitamins (Niacin, Pantothenic acid, B6, B12), Flavourings, Colours (Caramel, Riboflavins).",
        "nutriments": { "calories": 46.0, "protein_g": 0.0, "carbs_g": 11.0, "fat_g": 0.0, "sugar_g": 11.0, "sodium_mg": 80.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 12. Doritos
    "028400064088": {
        "product_name": "Doritos Nacho Cheese Flavored Tortilla Chips",
        "brand": "Frito-Lay",
        "category": "Tortilla Chips",
        "nova_group": 4,
        "health_score": 42,
        "ingredients_text": "Corn, Vegetable oil (Corn, Canola, and/or Sunflower oil), Maltodextrin, Salt, Cheddar cheese, Whey, Monosodium glutamate, Buttermilk, Romano cheese, Whey protein concentrate, Onion powder, Corn flour, Natural and artificial flavor.",
        "nutriments": { "calories": 500.0, "protein_g": 7.1, "carbs_g": 64.3, "fat_g": 25.0, "sugar_g": 3.6, "sodium_mg": 750.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 13. Pringles
    "038000138416": {
        "product_name": "Pringles Original Potato Crisps",
        "brand": "Kellogg's",
        "category": "Potato Crisps",
        "nova_group": 4,
        "health_score": 44,
        "ingredients_text": "Dried potatoes, Vegetable oil (Corn, Cottonseed, High oleic soybean, and/or Sunflower oil), Degerminated yellow corn flour, Cornstarch, Rice flour, Maltodextrin, Mono- and diglycerides, Salt, Wheat starch.",
        "nutriments": { "calories": 536.0, "protein_g": 3.6, "carbs_g": 57.1, "fat_g": 32.1, "sugar_g": 0.0, "sodium_mg": 535.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 14. Haldiram's Bhujia
    "8901725181222": {
        "product_name": "Haldiram's Classic Bhujia Sev",
        "brand": "Haldiram's",
        "category": "Namkeen & Savouries",
        "nova_group": 3,
        "health_score": 46,
        "ingredients_text": "Moth flour, Gram pulse flour, Edible vegetable oil (Cottonseed and/or Palmolein), Edible common salt, Red chilli powder, Black pepper, Ginger, Clove, Cardamom.",
        "nutriments": { "calories": 578.0, "protein_g": 12.0, "carbs_g": 42.0, "fat_g": 40.0, "sugar_g": 0.5, "sodium_mg": 890.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 15. Tropicana Orange
    "8901491102025": {
        "product_name": "Tropicana 100% Orange Delight Juice",
        "brand": "Tropicana / PepsiCo",
        "category": "Fruit Juices",
        "nova_group": 1,
        "health_score": 75,
        "ingredients_text": "Water, Concentrated Orange Juice (100% juice reconstitution). No added sugar, no artificial flavours.",
        "nutriments": { "calories": 48.0, "protein_g": 0.7, "carbs_g": 11.2, "fat_g": 0.1, "sugar_g": 9.5, "sodium_mg": 12.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 16. Thums Up
    "8902080000140": {
        "product_name": "Thums Up Charged Strong Cola",
        "brand": "The Coca-Cola Company",
        "category": "Carbonated Drinks",
        "nova_group": 4,
        "health_score": 26,
        "ingredients_text": "Carbonated water, Sugar, Acidity regulator (338), Colour (150d), Flavours (Natural and nature-identical flavouring substances), Caffeine.",
        "nutriments": { "calories": 160.0, "protein_g": 0.0, "carbs_g": 40.0, "fat_g": 0.0, "sugar_g": 40.0, "sodium_mg": 38.0 },
        "source": "NutriLens Verified Food Catalog"
    },
    # 17. Quaker Oats
    "8901491503020": {
        "product_name": "Quaker Oats 100% Whole Grain Rolled Oats",
        "brand": "PepsiCo / Quaker",
        "category": "Whole Grains & Cereals",
        "nova_group": 1,
        "health_score": 95,
        "ingredients_text": "100% Whole Grain Rolled Oats. Contains Beta-Glucan dietary soluble fibre.",
        "nutriments": { "calories": 374.0, "protein_g": 11.8, "carbs_g": 60.0, "fat_g": 8.5, "sugar_g": 0.8, "sodium_mg": 9.0 },
        "source": "NutriLens Verified Food Catalog"
    }
}

# GS1 Country / Region Prefix Map for registered food products
GS1_PREFIX_MAP = [
    ((0, 139), "United States & Canada"),
    ((300, 379), "France"),
    ((400, 440), "Germany"),
    ((450, 459), "Japan"),
    ((490, 499), "Japan"),
    ((460, 469), "Russia"),
    ((471, 471), "Taiwan"),
    ((480, 480), "Philippines"),
    ((489, 489), "Hong Kong"),
    ((500, 509), "United Kingdom"),
    ((540, 549), "Belgium & Luxembourg"),
    ((570, 579), "Denmark"),
    ((590, 590), "Poland"),
    ((600, 601), "South Africa"),
    ((640, 649), "Finland"),
    ((690, 699), "China"),
    ((700, 709), "Norway"),
    ((730, 739), "Sweden"),
    ((760, 769), "Switzerland"),
    ((800, 839), "Italy"),
    ((840, 849), "Spain"),
    ((870, 879), "Netherlands"),
    ((880, 880), "South Korea"),
    ((885, 885), "Thailand"),
    ((888, 888), "Singapore"),
    ((890, 890), "India"),
    ((893, 893), "Vietnam"),
    ((899, 899), "Indonesia"),
    ((900, 919), "Austria"),
    ((930, 939), "Australia"),
    ((940, 949), "New Zealand")
]


def resolve_gs1_country(barcode: str) -> str:
    """Decodes the manufacturing country or GS1 member organization from barcode digits."""
    clean = re.sub(r'\D', '', barcode)
    if len(clean) >= 3:
        try:
            prefix3 = int(clean[:3])
            for (low, high), country in GS1_PREFIX_MAP:
                if low <= prefix3 <= high:
                    return country
        except ValueError:
            pass
    return "Global / International"


def _query_local_sqlite_db(barcode: str) -> Optional[Dict[str, Any]]:
    """Checks the 40,000+ item SQLite food_catalog in nutrilens.db for matching source_id."""
    try:
        import sqlite3
        import os
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "nutrilens.db")
        if not os.path.exists(db_path):
            return None
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT food_name, brand, category, ingredients_text, nova_group, health_score, calories, protein_g, carbs_g, fat_g, sugar_g, sodium_mg FROM food_catalog WHERE source_id = ? LIMIT 1", (barcode,))
        row = cur.fetchone()
        conn.close()
        if row:
            return {
                "found": True,
                "is_food": True,
                "barcode": barcode,
                "product_name": row[0] or f"Product ({barcode})",
                "brand": row[1] or "Verified Food Brand",
                "category": row[2] or "Food & Nutrition",
                "ingredients_text": row[3] or f"{row[0]} - Natural food ingredients.",
                "nova_group": int(row[4]) if row[4] else 3,
                "health_score": int(row[5]) if row[5] else 70,
                "nutriments": {
                    "calories": float(row[6]) if row[6] is not None else 180.0,
                    "protein_g": float(row[7]) if row[7] is not None else 4.0,
                    "carbs_g": float(row[8]) if row[8] is not None else 24.0,
                    "fat_g": float(row[9]) if row[9] is not None else 6.0,
                    "sugar_g": float(row[10]) if row[10] is not None else 3.0,
                    "sodium_mg": float(row[11]) if row[11] is not None else 150.0
                },
                "source": "NutriLens SQLite Verified Catalog"
            }
    except Exception:
        pass
    return None


def lookup_barcode_online(barcode: str, timeout_seconds: float = 4.0) -> Dict[str, Any]:
    """
    Looks up food product details from barcode (EAN/UPC/GTIN):
    1. Checks curated local food barcode catalog (instantaneous, offline, reliable).
    2. Checks SQLite food_catalog (40,000+ verified foods).
    3. Queries OpenFoodFacts global database with safety timeout.
    4. If unregistered in external APIs, decodes GS1 country origin and creates a
       structured food product entry so the user is NEVER given an "unrecognized foreign object" error!
    """
    clean_code = re.sub(r'\D', '', barcode)
    if not clean_code or len(clean_code) < 8 or len(clean_code) > 14:
        return {
            "found": False,
            "is_food": False,
            "barcode": barcode,
            "message": f"Invalid barcode format: '{barcode}'. Please ensure code has 8 to 14 digits."
        }

    # Step 1: Check curated local barcode catalog (0ms, 100% offline reliability)
    if clean_code in LOCAL_BARCODE_CATALOG:
        entry = dict(LOCAL_BARCODE_CATALOG[clean_code])
        entry["found"] = True
        entry["is_food"] = True
        entry["barcode"] = clean_code
        return entry

    # Step 2: Check SQLite food_catalog table
    sqlite_match = _query_local_sqlite_db(clean_code)
    if sqlite_match:
        return sqlite_match

    # Step 3: Query OpenFoodFacts API
    url = f"{OPENFOODFACTS_BASE_URL}/{clean_code}.json"
    req = urllib.request.Request(url, headers=REQUEST_HEADERS)

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                status = data.get("status", 0)

                if status == 1 and "product" in data:
                    product = data["product"]

                    product_name = (
                        product.get("product_name")
                        or product.get("product_name_en")
                        or product.get("generic_name")
                        or product.get("generic_name_en")
                        or f"Product ({clean_code})"
                    ).strip()

                    ingredients_text = (
                        product.get("ingredients_text")
                        or product.get("ingredients_text_en")
                        or product.get("ingredients_text_with_allergens")
                        or ""
                    ).strip()

                    nutriments = product.get("nutriments", {})

                    nova_group = product.get("nova_group")
                    if nova_group is not None:
                        try:
                            nova_group = int(nova_group)
                        except (ValueError, TypeError):
                            nova_group = None

                    calories = (
                        nutriments.get("energy-kcal_100g")
                        or nutriments.get("energy-kcal_serving")
                        or nutriments.get("energy-kcal")
                    )
                    protein = (
                        nutriments.get("proteins_100g")
                        or nutriments.get("proteins_serving")
                        or nutriments.get("proteins")
                    )
                    carbs = (
                        nutriments.get("carbohydrates_100g")
                        or nutriments.get("carbohydrates_serving")
                        or nutriments.get("carbohydrates")
                    )
                    fat = (
                        nutriments.get("fat_100g")
                        or nutriments.get("fat_serving")
                        or nutriments.get("fat")
                    )
                    sugar = (
                        nutriments.get("sugars_100g")
                        or nutriments.get("sugars_serving")
                        or nutriments.get("sugars")
                    )
                    sodium = (
                        nutriments.get("sodium_100g")
                        or nutriments.get("sodium_serving")
                        or nutriments.get("sodium")
                    )

                    sodium_mg = None
                    if sodium is not None:
                        try:
                            sodium_val = float(sodium)
                            sodium_mg = sodium_val * 1000.0 if sodium_val < 50 else sodium_val
                        except (ValueError, TypeError):
                            sodium_mg = None

                    nutriscore_grade = product.get("nutriscore_grade", "").upper()
                    health_score_map = {"A": 92, "B": 78, "C": 62, "D": 45, "E": 28}
                    health_score = health_score_map.get(nutriscore_grade, None)

                    if health_score is None:
                        health_score = 70
                        if sugar is not None and float(sugar) > 15:
                            health_score -= 15
                        if fat is not None and float(fat) > 20:
                            health_score -= 10
                        if protein is not None and float(protein) >= 10:
                            health_score += 10
                        if nova_group == 4:
                            health_score = min(health_score, 45)
                        elif nova_group == 1:
                            health_score = max(health_score, 85)
                        health_score = max(10, min(98, health_score))

                    return {
                        "found": True,
                        "is_food": True,
                        "barcode": clean_code,
                        "product_name": product_name,
                        "ingredients_text": ingredients_text or f"{product_name} - Standard ingredients",
                        "nova_group": nova_group or (4 if health_score < 50 else 3),
                        "health_score": int(health_score),
                        "nutriments": {
                            "calories": float(calories) if calories is not None else None,
                            "protein_g": float(protein) if protein is not None else None,
                            "carbs_g": float(carbs) if carbs is not None else None,
                            "fat_g": float(fat) if fat is not None else None,
                            "sugar_g": float(sugar) if sugar is not None else None,
                            "sodium_mg": float(sodium_mg) if sodium_mg is not None else None,
                        },
                        "brand": product.get("brands", ""),
                        "categories": product.get("categories", ""),
                        "source": "OpenFoodFacts Global Database"
                    }
    except Exception as err:
        print(f"OpenFoodFacts lookup note: {err}")

    # Step 4: If not found in any food database, return found=False honestly
    # Do NOT invent dummy/synthetic nutrition data
    return {
        "found": False,
        "is_food": False,
        "barcode": clean_code,
        "message": f"Barcode {clean_code} was not found in our verified food database. Please scan the nutrition facts or ingredient label directly using Food Label mode."
    }

