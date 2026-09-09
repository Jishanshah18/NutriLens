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


def lookup_barcode_online(barcode: str, timeout_seconds: float = 4.5) -> Dict[str, Any]:
    """
    Queries the OpenFoodFacts API for an EAN/UPC/GTIN barcode.
    Returns structured food product details or not-found status.
    """
    clean_code = re.sub(r'\D', '', barcode)
    if not clean_code or len(clean_code) < 8 or len(clean_code) > 14:
        return {
            "found": False,
            "is_food": False,
            "barcode": barcode,
            "message": f"Invalid barcode format: '{barcode}'"
        }

    url = f"{OPENFOODFACTS_BASE_URL}/{clean_code}.json"
    req = urllib.request.Request(url, headers=REQUEST_HEADERS)

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            if resp.status != 200:
                return {
                    "found": False,
                    "is_food": False,
                    "barcode": clean_code,
                    "message": f"External food database returned HTTP {resp.status}"
                }

            data = json.loads(resp.read().decode("utf-8"))
            status = data.get("status", 0)

            # OpenFoodFacts status == 1 indicates product exists
            if status != 1 or "product" not in data:
                return {
                    "found": False,
                    "is_food": False,
                    "barcode": clean_code,
                    "message": f"Barcode {clean_code} was not found in the global food database."
                }

            product = data["product"]

            # Verify it has food-identifying information
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

            # Calculate or read NOVA classification (1 to 4)
            nova_group = product.get("nova_group")
            if nova_group is not None:
                try:
                    nova_group = int(nova_group)
                except (ValueError, TypeError):
                    nova_group = None

            # Read or compute nutritional breakdown per 100g/serving
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

            # Convert sodium from grams to milligrams if necessary
            sodium_mg = None
            if sodium is not None:
                try:
                    sodium_val = float(sodium)
                    sodium_mg = sodium_val * 1000.0 if sodium_val < 50 else sodium_val
                except (ValueError, TypeError):
                    sodium_mg = None

            # Nutri-Score calculation or estimate
            nutriscore_grade = product.get("nutriscore_grade", "").upper()
            health_score_map = {"A": 92, "B": 78, "C": 62, "D": 45, "E": 28}
            health_score = health_score_map.get(nutriscore_grade, None)

            # If no Nutri-Score, calculate estimate from macronutrients
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
        return {
            "found": False,
            "is_food": False,
            "barcode": clean_code,
            "message": f"Barcode lookup notice: {err}"
        }
