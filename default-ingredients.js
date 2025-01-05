// Default list of ingredients with potential health concerns
export const DEFAULT_TOXIC_INGREDIENTS = [
  {
    name: "Propylparaben",
    category: "Preservatives",
    aliases: ["E216", "Propyl 4-hydroxybenzoate", "PrP"],
    isToxic: true,
    concernLevel: "Moderate",
    healthEffects: [
      "Reproductive system toxicity",
      "Endocrine disruption",
      "Cell cycle disruption",
      "Potential carcinogenic effects",
      "Environmental toxicant",
    ],
    sources: [
      {
        title:
          "Propylparaben Induces Reproductive Toxicity in Human Extravillous Trophoblast Cells via Apoptosis and Cell Cycle Pathways",
        publisher: "Environmental Health",
        url: "https://pubmed.ncbi.nlm.nih.gov/39474327/",
        year: 2024,
      },
      {
        title: "The controversies of parabens - an overview nowadays",
        publisher: "Acta Pharmaceutica",
        url: "https://pubmed.ncbi.nlm.nih.gov/32697748/",
        year: 2021,
      },
    ],
  },
  {
    name: "Phosphoric Acid",
    category: "Acidulants",
    aliases: ["E338", "Orthophosphoric acid"],
    isToxic: true,
    concernLevel: "Moderate",
    healthEffects: [
      "Decreased bone density",
      "Dental erosion",
      "Kidney problems",
      "Increased risk of osteoporosis",
      "Skin and eye irritation",
      "Respiratory issues",
      "Potential liver and kidney effects",
    ],
    sources: [
      {
        title: "Is Phosphoric Acid Bad for Me?",
        publisher: "Healthline",
        url: "https://www.healthline.com/health/food-nutrition/is-phosphoric-acid-bad-for-me",
        year: 2014,
      },
      {
        title:
          "Consumption of soft drinks with phosphoric acid as a risk factor for the development of hypocalcemia in postmenopausal women",
        publisher: "Journal of Clinical Epidemiology",
        url: "https://pubmed.ncbi.nlm.nih.gov/10513764/",
        year: 1999,
      },
      {
        title: "Phosphoric Acid (Solutions)",
        publisher: "Canadian Centre for Occupational Health and Safety",
        url: "https://www.ccohs.ca/oshanswers/chemicals/chem_profiles/phosphoric.html",
        year: 2010,
      },
    ],
  },
  {
    name: "Sodium Benzoate",
    category: "Preservatives",
    aliases: ["E211", "Benzoic acid sodium salt"],
    isToxic: true,
    concernLevel: "Moderate",
    healthEffects: [
      "Can form benzene when combined with vitamin C",
      "Hyperactivity in children",
      "Allergic reactions",
      "Potential DNA damage",
    ],
    sources: [
      {
        title: "Sodium Benzoate—Harmfulness and Potential Use in Therapies for Various Diseases",
        publisher: "Frontiers in Pharmacology",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9003278/",
        year: 2020,
      },
      {
        title: "What Is Sodium Benzoate? Everything You Need to Know",
        publisher: "Healthline",
        url: "https://www.healthline.com/nutrition/sodium-benzoate",
        year: 2023,
      },
    ],
  },
  {
    name: "Carrageenan",
    category: "Thickeners",
    aliases: ["E407", "Irish moss extract"],
    isToxic: true,
    concernLevel: "Moderate",
    healthEffects: [
      "Inflammation",
      "Digestive problems",
      "Potential carcinogenic effects",
      "Immune system suppression",
    ],
    sources: [
      {
        title: "Carrageenan: Safety, risks, and uses",
        publisher: "Medical News Today",
        url: "https://www.medicalnewstoday.com/articles/323117",
        year: 2018,
      },
      {
        title: "Carrageenan: Uses, Safety, Side Effects, and More",
        publisher: "MedicineNet",
        url: "https://www.medicinenet.com/what_is_wrong_with_carrageenan/article.htm",
        year: 2023,
      },
    ],
  },
  {
    name: "Aspartame",
    category: "Artificial Sweeteners",
    aliases: ["E951", "NutraSweet", "Equal"],
    isToxic: true,
    concernLevel: "High",
    healthEffects: ["Headaches", "Seizures", "Depression", "Anxiety", "Memory loss"],
    sources: [
      {
        title: "Aspartame hazard and risk assessment results released",
        publisher: "World Health Organization",
        url: "https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment-results-released",
        year: 2023,
      },
      {
        title: "Aspartame and Cancer Risk",
        publisher: "American Cancer Society",
        url: "https://www.cancer.org/cancer/risk-prevention/chemicals/aspartame.html",
        year: 2023,
      },
    ],
  },
  {
    name: "BHT",
    category: "Preservatives",
    aliases: ["E321", "Butylated hydroxytoluene"],
    isToxic: true,
    concernLevel: "Moderate",
    healthEffects: ["Potential carcinogen", "Liver effects", "Kidney effects", "Behavioral effects"],
    sources: [
      {
        title: "Final Report on the Safety Assessment of BHT",
        publisher: "International Journal of Toxicology",
        url: "https://pubmed.ncbi.nlm.nih.gov/12396675/",
        year: 2002,
      },
      {
        title: "Butylated Hydroxytoluene (BHT) - Uses, Side Effects, and More",
        publisher: "WebMD",
        url: "https://www.webmd.com/vitamins/ai/ingredientmono-1071/butylated-hydroxytoluene-bht",
        year: 2021,
      },
    ],
  },
  {
    name: "High Fructose Corn Syrup",
    category: "Sweeteners",
    aliases: ["HFCS", "Corn syrup high fructose", "Isoglucose"],
    isToxic: true,
    concernLevel: "High",
    healthEffects: [
      "Increased risk of obesity",
      "Potential metabolic syndrome",
      "Insulin resistance",
      "Non-alcoholic fatty liver disease",
    ],
    sources: [
      {
        title: "High-fructose corn syrup and diabetes prevalence",
        publisher: "Global Public Health",
        url: "https://europepmc.org/article/med/23181629",
        year: 2022,
      },
      {
        title: "The Contribution of Dietary Fructose to Non-alcoholic Fatty Liver Disease",
        publisher: "Institute of Digestive Diseases, Longhua Hospital",
        url: "https://www.frontiersin.org/journals/pharmacology/articles/10.3389/fphar.2021.783393/full",
        year: 2021,
      },
      {
        title: "Metabolic Effects of Fructose and the Worldwide Increase in Obesity",
        publisher: "American Physiological Society",
        url: "https://journals.physiology.org/doi/full/10.1152/physrev.00019.2009",
        year: 2019,
      },
    ],
  },
  {
    name: "Sodium Nitrite",
    category: "Preservatives",
    aliases: ["E250", "Nitrous acid sodium salt"],
    isToxic: true,
    concernLevel: "High",
    healthEffects: [
      "Formation of carcinogenic nitrosamines",
      "Increased risk of colorectal cancer",
      "Methemoglobinemia risk",
    ],
    sources: [
      {
        title: "Nitrites and nitrates from food additives and cancer risk",
        publisher: "European Journal of Public Health",
        url: "https://academic.oup.com/eurpub/article/31/Supplement_3/ckab165.244/6406211",
        year: 2021,
      },
      {
        title: "How Bad Is Sodium Nitrate for You?",
        publisher: "MedicineNet",
        url: "https://www.medicinenet.com/how_bad_is_sodium_nitrate_for_you/article.htm",
        year: 2024,
      },
      {
        title: "Is Sodium Nitrate Safe?",
        publisher: "Health.com",
        url: "https://www.health.com/sodium-nitrate-8674446",
        year: 2024,
      },
    ],
  },
  {
    name: "BHA",
    category: "Preservatives",
    aliases: ["E320", "tert-butyl-4-hydroxyanisole", "Butylated Hydroxyanisole"],
    isToxic: true,
    concernLevel: "Moderate",
    healthEffects: [
      "Potential carcinogen",
      "Endocrine disruption",
      "Behavioral effects",
      "Thyroid system damage",
      "Neurotoxicity",
    ],
    sources: [
      {
        title: "Butylated hydroxyanisole (BHA)",
        publisher: "Vermont Department of Health",
        url: "https://www.healthvermont.gov/sites/default/files/documents/pdf/ENV_CDP_25013_16_5_BHA.pdf",
        year: 2021,
      },
      {
        title: "Endocrine disrupting effects of butylated hydroxyanisole (BHA - E320)",
        publisher: "Environmental Health Insights",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4462476/",
        year: 2015,
      },
      {
        title: "A review of the occurrence, metabolites and health risks of butylated hydroxyanisole (BHA)",
        publisher: "Journal of the Science of Food and Agriculture",
        url: "https://onlinelibrary.wiley.com/doi/10.1002/jsfa.12676",
        year: 2023,
      },
    ],
  },
  {
    name: "Potassium Bromate",
    category: "Flour Treatment",
    aliases: ["E924", "Bromic acid, potassium salt"],
    isToxic: true,
    concernLevel: "High",
    healthEffects: [
      "Potential carcinogen",
      "Kidney damage",
      "Nervous system damage",
      "Thyroid tumors",
      "Gastrointestinal cancer",
    ],
    sources: [
      {
        title: "Toxicity and carcinogenicity of potassium bromate--a new renal carcinogen",
        publisher: "Environmental Health Perspectives",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1567851/",
        year: 1986,
      },
      {
        title: "Potassium bromate: 50 years of research shows serious health risks",
        publisher: "U.S. Right to Know",
        url: "https://usrtk.org/chemicals/potassium-bromate/",
        year: 2023,
      },
      {
        title: "Potassium bromate",
        publisher: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Potassium_bromate",
        year: 2023,
      },
    ],
  },
  {
    name: "Artificial Food Coloring",
    category: "Additives",
    aliases: ["Red 40", "Yellow 5", "Yellow 6", "Blue 1", "Red 3", "Blue 2", "Green 3"],
    isToxic: true,
    concernLevel: "Moderate",
    healthEffects: [
      "Hyperactivity and attention problems in children",
      "Behavioral changes and irritability",
      "Allergic reactions and hypersensitivity",
      "Potential immune system effects",
      "Gastrointestinal disturbances",
      "Sleep disturbances in sensitive individuals",
    ],
    sources: [
      {
        title: "Artificial food additives: hazardous to long-term health?",
        publisher: "Archives of Disease in Childhood",
        url: "https://pubmed.ncbi.nlm.nih.gov/38423749/",
        year: 2024,
      },
      {
        title: "Synthetic Colors in Food: A Warning for Children's Health",
        publisher: "International Journal of Environmental Research and Public Health",
        url: "https://pubmed.ncbi.nlm.nih.gov/38928929/",
        year: 2023,
      },
    ],
  },
  {
    name: "Partially Hydrogenated Oils",
    category: "Fats",
    aliases: ["Trans fats", "PHOs", "Artificial trans fats"],
    isToxic: true,
    concernLevel: "High",
    healthEffects: [
      "Significantly increases risk of cardiovascular disease",
      "Raises harmful LDL cholesterol levels",
      "Lowers beneficial HDL cholesterol",
      "Promotes systemic inflammation",
      "Increases risk of type 2 diabetes",
      "Associated with stroke risk",
    ],
    sources: [
      {
        title:
          "On account of trans fatty acids and cardiovascular disease risk - There is still need to upgrade the knowledge and educate consumers",
        publisher: "Nutrition, Metabolism and Cardiovascular Diseases",
        url: "https://pubmed.ncbi.nlm.nih.gov/35753860/",
        year: 2022,
      },
      {
        title: "Mechanisms of Action of trans Fatty Acids",
        publisher: "Current Developments in Nutrition",
        url: "https://pubmed.ncbi.nlm.nih.gov/31782488/",
        year: 2023,
      },
    ],
  },
  {
    name: "Titanium Dioxide",
    category: "Food Additives",
    aliases: ["E171", "TiO2", "Titanium(IV) oxide"],
    isToxic: true,
    concernLevel: "High",
    healthEffects: [
      "Potential carcinogen",
      "Oxidative stress",
      "Inflammatory responses",
      "Cellular damage",
      "Digestive system effects",
      "Immune system disruption",
    ],
    sources: [
      {
        title: "Titanium Dioxide: Structure, Impact, and Toxicity",
        publisher: "International Journal of Environmental Research and Public Health",
        url: "https://pubmed.ncbi.nlm.nih.gov/35565075/",
        year: 2022,
      },
      {
        title: "Mechanistic Insights into Toxicity of Titanium Dioxide Nanoparticles at the Micro- and Macro-levels",
        publisher: "Chemical Research in Toxicology",
        url: "https://pubmed.ncbi.nlm.nih.gov/39324438/",
        year: 2024,
      },
    ],
  },
];

// Added comprehensive allergen information
export const COMMON_ALLERGENS = [
  {
    name: "Milk",
    aliases: ["Dairy", "Casein", "Whey", "Lactose"],
    description: "Common dairy-based ingredients and derivatives",
    riskLevel: "High",
    prevalence: "2-3% of adults",
  },
  {
    name: "Eggs",
    aliases: ["Albumin", "Globulin", "Ovomucin", "Vitellin"],
    description: "Both egg yolks and whites can cause reactions",
    riskLevel: "High",
    prevalence: "1-2% of adults",
  },
  {
    name: "Peanuts",
    aliases: ["Arachis oil", "Ground nuts", "Mandelonas"],
    description: "Legume family, separate from tree nuts",
    riskLevel: "Severe",
    prevalence: "1-2% of population",
  },
  {
    name: "Tree Nuts",
    aliases: ["Almonds", "Walnuts", "Cashews", "Pistachios", "Brazil nuts", "Macadamia"],
    description: "Various types of tree-grown nuts",
    riskLevel: "Severe",
    prevalence: "0.5-1% of population",
  },
];

// Filter categories with descriptions
export const FILTER_CATEGORIES = [
  {
    name: "Preservatives",
    description: "Substances added to products to extend shelf life",
    commonExamples: ["BHA", "BHT", "Sodium nitrite", "Sulfites"],
    concernLevel: "Moderate to High",
  },
  {
    name: "Artificial Sweeteners",
    description: "Non-nutritive sweetening agents",
    commonExamples: ["Aspartame", "Sucralose", "Saccharin", "Acesulfame-K"],
    concernLevel: "Moderate",
  },
  {
    name: "Artificial Colors",
    description: "Synthetic dyes used to enhance product appearance",
    commonExamples: ["Red 40", "Yellow 5", "Blue 1"],
    concernLevel: "Moderate",
  },
  {
    name: "Processing Aids",
    description: "Chemicals used in food processing",
    commonExamples: ["Potassium bromate", "Calcium propionate"],
    concernLevel: "Moderate to High",
  },
];
