"""
NutriLens Toxicological & Allergen Knowledge Base.
Contains comprehensive dictionaries and taxonomies for food additives, allergens, and risk markers.
"""

from typing import Dict, List, Tuple

# Comprehensive Food Additives and E-Numbers Dictionary
ADDITIVES_DATABASE: Dict[str, Dict[str, str]] = {
    # High Risk Additives
    "E102": {
        "name": "Tartrazine (FD&C Yellow 5)",
        "risk_level": "High",
        "description": "Azo dye linked to hyperactivity in children, allergic reactions, and asthma exacerbation."
    },
    "E110": {
        "name": "Sunset Yellow FCF",
        "risk_level": "High",
        "description": "Synthetic petroleum-derived orange dye linked to allergic hives and hyperactivity."
    },
    "E129": {
        "name": "Allura Red AC (Red 40)",
        "risk_level": "High",
        "description": "Petroleum-based artificial colorant linked to neurobehavioral issues and gut inflammation."
    },
    "E133": {
        "name": "Brilliant Blue FCF",
        "risk_level": "Moderate",
        "description": "Synthetic dye poorly absorbed by the GI tract; potential hypersensitivity."
    },
    "E171": {
        "name": "Titanium Dioxide",
        "risk_level": "High",
        "description": "Nanoparticle whitening agent banned in the EU due to genotoxicity concerns."
    },
    "E211": {
        "name": "Sodium Benzoate",
        "risk_level": "Moderate",
        "description": "Preservative; when combined with vitamin C (ascorbic acid), can form carcinogenic benzene."
    },
    "E220": {
        "name": "Sulphur Dioxide",
        "risk_level": "Moderate",
        "description": "Sulfite preservative that can trigger severe bronchospasm in asthmatics."
    },
    "E249": {
        "name": "Potassium Nitrite",
        "risk_level": "High",
        "description": "Curing agent in processed meats; forms carcinogenic nitrosamines in high heat."
    },
    "E250": {
        "name": "Sodium Nitrite",
        "risk_level": "High",
        "description": "Processed meat preservative associated with increased colorectal cancer risks."
    },
    "E320": {
        "name": "Butylated Hydroxyanisole (BHA)",
        "risk_level": "High",
        "description": "Synthetic antioxidant preservative; classified as a suspected human carcinogen and endocrine disruptor."
    },
    "E321": {
        "name": "Butylated Hydroxytoluene (BHT)",
        "risk_level": "Moderate",
        "description": "Antioxidant preservative; shown to cause kidney and liver issues in animal models."
    },
    "E407": {
        "name": "Carrageenan",
        "risk_level": "Moderate",
        "description": "Seaweed-derived stabilizer that can promote gut inflammation and intestinal permeability."
    },
    "E471": {
        "name": "Mono- and Diglycerides of Fatty Acids",
        "risk_level": "Moderate",
        "description": "Common emulsifier in processed food that may carry hidden trans fats."
    },
    "E621": {
        "name": "Monosodium Glutamate (MSG)",
        "risk_level": "Moderate",
        "description": "Flavor enhancer that can cause transient numbness, headaches, and sensitivity in some individuals."
    },
    "E950": {
        "name": "Acesulfame Potassium (Ace-K)",
        "risk_level": "Moderate",
        "description": "Intense artificial sweetener that may disrupt gut microbiome and metabolic signaling."
    },
    "E951": {
        "name": "Aspartame",
        "risk_level": "Moderate",
        "description": "Artificial sweetener; breaks down into phenylalanine, dangerous for people with PKU."
    },
    "E952": {
        "name": "Cyclamate",
        "risk_level": "High",
        "description": "Artificial sweetener banned in several countries due to potential bladder toxicity."
    },
    "E954": {
        "name": "Saccharin",
        "risk_level": "Moderate",
        "description": "First synthetic sweetener; can cause digestive discomfort and microbiome shifts."
    },
    "E955": {
        "name": "Sucralose",
        "risk_level": "Moderate",
        "description": "Chlorinated carbohydrate sweetener that may reduce beneficial gut bacteria."
    },
    # Low Risk / Natural Additives
    "E300": {
        "name": "Ascorbic Acid (Vitamin C)",
        "risk_level": "Low",
        "description": "Natural essential vitamin used safely as an antioxidant and freshness keeper."
    },
    "E306": {
        "name": "Tocopherol (Vitamin E)",
        "risk_level": "Low",
        "description": "Natural fat-soluble antioxidant protecting oils from oxidation."
    },
    "E322": {
        "name": "Lecithin",
        "risk_level": "Low",
        "description": "Natural phospholipid emulsifier typically derived from sunflowers or soybeans."
    },
    "E330": {
        "name": "Citric Acid",
        "risk_level": "Low",
        "description": "Natural organic acid found in citrus fruits; acts as a safe natural preservative."
    },
    "E410": {
        "name": "Locust Bean Gum",
        "risk_level": "Low",
        "description": "Natural plant-based thickening fiber extracted from carob tree seeds."
    },
    "E412": {
        "name": "Guar Gum",
        "risk_level": "Low",
        "description": "Natural water-soluble soluble dietary fiber from guar beans."
    },
    "E415": {
        "name": "Xanthan Gum",
        "risk_level": "Low",
        "description": "Fermented plant polysaccharide used safely as a stabilizer and gluten replacement."
    },
    "E440": {
        "name": "Pectin",
        "risk_level": "Low",
        "description": "Soluble dietary fiber extracted from apples and citrus rinds."
    }
}

# Major 14 Allergens and common detection keywords
ALLERGEN_TAXONOMY: Dict[str, List[str]] = {
    "Peanuts": ["peanut", "peanuts", "groundnut", "arachis", "peanut butter", "peanut oil"],
    "Lactose": ["milk", "lactose", "dairy", "whey", "casein", "butter", "cheese", "cream", "curd", "buttermilk", "skimmed milk", "milk powder", "ghee"],
    "Gluten": ["wheat", "gluten", "barley", "rye", "malt", "spelt", "semolina", "kamut", "couscous", "durum", "triticale"],
    "Soy": ["soy", "soya", "soybean", "tofu", "edamame", "soy lecithin", "tamari", "miso", "tempeh", "soy protein"],
    "Tree Nuts": ["almond", "walnut", "cashew", "pecan", "pistachio", "macadamia", "hazelnut", "brazil nut", "chestnut"],
    "Eggs": ["egg", "eggs", "egg white", "yolk", "albumin", "albumen", "ovalbumin", "mayonnaise"],
    "Fish": ["fish", "salmon", "tuna", "cod", "anchovy", "mackerel", "sardine", "tilapia", "haddock", "trout", "halibut", "fish gelatin"],
    "Shellfish": ["shellfish", "crustacean", "shrimp", "prawn", "crab", "lobster", "crawfish"],
    "Sesame": ["sesame", "tahini", "sesame oil", "sesamum"],
    "Sulfites": ["sulfite", "sulphite", "sulfur dioxide", "potassium metabisulfite", "sodium bisulfite"],
    "Celery": ["celery", "celeriac", "celery seed"],
    "Mustard": ["mustard", "mustard seed", "mustard powder"],
    "Lupin": ["lupin", "lupine", "lupin flour"],
    "Molluscs": ["mollusc", "mollusk", "clam", "mussel", "oyster", "scallop", "squid", "octopus", "calamari"]
}

# Risky Processing & Metabolic Ingredients
RISK_PATTERNS: List[Tuple[str, str, int]] = [
    ("high fructose corn syrup", "Contains High Fructose Corn Syrup (HFCS), which causes rapid liver fat accumulation and spikes insulin.", -15),
    ("corn syrup", "Contains processed corn syrup sweeteners.", -8),
    ("hydrogenated", "Contains hydrogenated oils which frequently harbor toxic trans fats linked to cardiovascular disease.", -18),
    ("partially hydrogenated", "Contains partially hydrogenated oils (direct source of harmful artificial trans fats).", -22),
    ("palm oil", "Contains refined palm oil high in palmitic acid and saturated fats.", -8),
    ("artificial flavor", "Contains synthetic chemical artificial flavorings.", -6),
    ("artificial colour", "Contains artificial dyes linked to behavioral hyperactivity.", -8),
    ("artificial color", "Contains artificial dyes linked to behavioral hyperactivity.", -8),
    ("sodium nitrite", "Contains sodium nitrite preservative associated with carcinogenic nitrosamine formation.", -15),
    ("sodium nitrate", "Contains nitrate preservatives commonly added to processed meats.", -12),
    ("potassium bromate", "Contains potassium bromate flour bleaching agent.", -20),
    ("bleached flour", "Contains chemically bleached refined flour stripped of natural micronutrients.", -7),
    ("invert sugar", "Contains concentrated invert sugar syrup.", -8),
    ("maltodextrin", "Contains maltodextrin (extremely high glycemic index rating of 110-185).", -10),
    ("dextrose", "Contains refined dextrose sugar.", -7),
    ("aspartame", "Contains artificial sweetener Aspartame.", -8),
    ("sucralose", "Contains chlorinated sweetener Sucralose.", -8),
    ("acesulfame potassium", "Contains artificial sweetener Acesulfame-K.", -8),
]

# Beneficial Whole & Healthy Foods
BENEFICIAL_PATTERNS: List[Tuple[str, str, int]] = [
    ("organic", "Contains certified organic ingredients.", 8),
    ("whole grain", "Rich in dietary fiber and whole grain complex carbohydrates.", 10),
    ("whole wheat", "Whole wheat provides sustained fiber and B vitamins.", 8),
    ("rolled oats", "Contains heart-healthy beta-glucan soluble fiber.", 10),
    ("oats", "Contains natural oat fiber for cholesterol management.", 8),
    ("chia seed", "Rich in plant-based Omega-3 ALA fatty acids and prebiotic fiber.", 10),
    ("flaxseed", "High in lignans and natural anti-inflammatory fats.", 10),
    ("quinoa", "Complete plant protein containing all 9 essential amino acids.", 10),
    ("extra virgin olive oil", "Cold-pressed extra virgin oil rich in heart-healthy monounsaturated polyphenols.", 12),
    ("olive oil", "Source of healthy monounsaturated fats.", 7),
    ("almond", "Nutrient-dense tree nut high in vitamin E and magnesium.", 8),
    ("walnut", "Rich in plant omega-3 and brain-protective antioxidants.", 9),
    ("probiotics", "Contains live probiotic cultures supporting gut microbiome diversity.", 10),
    ("fermented", "Fermentation enhances nutrient bioavailability and digestive ease.", 8),
    ("spirulina", "Superfood microalgae packed with antioxidants.", 8),
    ("matcha", "Rich in EGCG green tea catechins and cellular protectors.", 8),
    ("turmeric", "Contains curcumin, a potent natural anti-inflammatory agent.", 8),
    ("ginger", "Natural digestive aid with anti-inflammatory gingerols.", 7),
    ("raw cacao", "High flavanol whole chocolate source supporting cardiovascular health.", 8),
    ("sea salt", "Unrefined salt retaining trace natural minerals.", 4),
]
