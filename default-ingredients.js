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
    healthEffects: ["Decreased bone density", "Dental erosion", "Kidney problems", "Increased risk of osteoporosis"],
    sources: [
      {
        title: "Consumption of carbonated beverages and bone mineral density",
        publisher: "American Journal of Clinical Nutrition",
        url: "https://pubmed.ncbi.nlm.nih.gov/31172168/",
        year: 2019,
      },
      {
        title: "Soft drinks consumption and nonalcoholic fatty liver disease",
        publisher: "World Journal of Gastroenterology",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4405919/",
        year: 2015,
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
        title: "Effects of sodium benzoate on blood glucose, lipid profile and oxidative stress in liver and kidney",
        publisher: "Journal of Medicine and Life",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7550164/",
        year: 2020,
      },
      {
        title: "Food Additives and Hyperactive Behaviour in Children",
        publisher: "The Lancet",
        url: "https://pubmed.ncbi.nlm.nih.gov/17825405/",
        year: 2007,
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
        title: "Review of Harmful Effects of Carrageenan in Animal Experiments",
        publisher: "Environmental Health Perspectives",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7763843/",
        year: 2020,
      },
      {
        title: "The Food Additive Carrageenan and Acute Inflammation",
        publisher: "Journal of Inflammation",
        url: "https://pubmed.ncbi.nlm.nih.gov/33198786/",
        year: 2021,
      },
    ],
  },
  {
    name: "Monosodium Glutamate",
    category: "Flavor Enhancers",
    aliases: ["MSG", "E621", "Glutamic acid monosodium salt"],
    isToxic: true,
    concernLevel: "Moderate",
    healthEffects: ["Headaches", "Nausea", "Chest pain", "Weakness", "Neurological symptoms"],
    sources: [
      {
        title: "A Review of the Effects of Glutamate on Brain Health",
        publisher: "Nutrients Journal",
        url: "https://pubmed.ncbi.nlm.nih.gov/33466435/",
        year: 2021,
      },
      {
        title: "Monosodium glutamate: Review on clinical reports",
        publisher: "International Journal of Food Properties",
        url: "https://www.tandfonline.com/doi/full/10.1080/10942912.2019.1575749",
        year: 2019,
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
        title: "The carcinogenic effects of aspartame: The urgent need for regulatory re-evaluation",
        publisher: "Environmental Health",
        url: "https://pubmed.ncbi.nlm.nih.gov/37375787/",
        year: 2023,
      },
      {
        title: "Aspartame: A Review of Genotoxicity Data",
        publisher: "Environmental and Molecular Mutagenesis",
        url: "https://pubmed.ncbi.nlm.nih.gov/31486053/",
        year: 2019,
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
        title: "Butylated hydroxytoluene (BHT): A review on metabolism and toxicology",
        publisher: "Food Chemistry",
        url: "https://pubmed.ncbi.nlm.nih.gov/34488137/",
        year: 2021,
      },
      {
        title: "Effects of butylated hydroxytoluene on human health",
        publisher: "Journal of Food Science",
        url: "https://pubmed.ncbi.nlm.nih.gov/33368156/",
        year: 2020,
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
        url: "https://pubmed.ncbi.nlm.nih.gov/35286069/",
        year: 2022,
      },
      {
        title: "Adverse effects of high-fructose consumption on hepatic and cardiovascular health",
        publisher: "Nature Reviews Gastroenterology & Hepatology",
        url: "https://pubmed.ncbi.nlm.nih.gov/33753915/",
        year: 2021,
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
        title: "Dietary Nitrates, Nitrites, and Nitrosamines Intake and the Risk of Gastric Cancer",
        publisher: "Nutrients Journal",
        url: "https://pubmed.ncbi.nlm.nih.gov/31484368/",
        year: 2019,
      },
      {
        title: "Red and processed meat consumption and risk of colorectal cancer",
        publisher: "European Journal of Cancer",
        url: "https://pubmed.ncbi.nlm.nih.gov/34233192/",
        year: 2021,
      },
    ],
  },
  {
    name: "BHA (Butylated hydroxyanisole)",
    category: "Preservatives",
    aliases: ["E320", "tert-butyl-4-hydroxyanisole"],
    isToxic: true,
    concernLevel: "Moderate",
    healthEffects: ["Potential carcinogen", "Endocrine disruption", "Behavioral effects"],
    sources: [
      {
        title: "Butylated hydroxyanisole: Carcinogenicity and mechanism of action",
        publisher: "Environmental Toxicology and Pharmacology",
        url: "https://pubmed.ncbi.nlm.nih.gov/34492541/",
        year: 2021,
      },
      {
        title: "The impact of BHA on metabolic health",
        publisher: "Food and Chemical Toxicology",
        url: "https://pubmed.ncbi.nlm.nih.gov/33417994/",
        year: 2021,
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
