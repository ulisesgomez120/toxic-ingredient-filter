// Default list of ingredients with potential health concerns
export const DEFAULT_TOXIC_INGREDIENTS = [
  {
    name: "Propylene Glycol",
    category: "Humectants",
    aliases: ["E1520", "1,2-Propanediol", "Methyl glycol"],
    isToxic: true,
    concernLevel: "Moderate",
    healthEffects: [
      "Skin irritation",
      "Allergic reactions",
      "Central nervous system effects",
      "Potential liver and kidney effects",
    ],
    sources: [
      {
        title: "Safety Assessment of Propylene Glycol",
        publisher: "International Journal of Toxicology",
        url: "https://pubmed.ncbi.nlm.nih.gov/1937000/",
        year: 2012,
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
        title: "Colas, but not other carbonated beverages, are associated with low bone mineral density in older women",
        publisher: "American Journal of Clinical Nutrition",
        url: "https://pubmed.ncbi.nlm.nih.gov/17023723/",
        year: 2006,
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
        title: "Sodium benzoate-induced repeated episodes of acute urticaria/angio-oedema",
        publisher: "Journal of Health Science",
        url: "https://pubmed.ncbi.nlm.nih.gov/18274234/",
        year: 2008,
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
        title: "Review of harmful gastrointestinal effects of carrageenan in animal experiments",
        publisher: "Environmental Health Perspectives",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1242073/",
        year: 2001,
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
        title: "The toxicity/safety of processed free glutamic acid (MSG)",
        publisher: "Clinical and Experimental Allergy",
        url: "https://pubmed.ncbi.nlm.nih.gov/19438927/",
        year: 2009,
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
        title: "Direct and indirect cellular effects of aspartame on the brain",
        publisher: "European Journal of Clinical Nutrition",
        url: "https://pubmed.ncbi.nlm.nih.gov/17684524/",
        year: 2008,
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
        title: "Toxicology and carcinogenesis studies of butylated hydroxytoluene",
        publisher: "National Toxicology Program",
        url: "https://ntp.niehs.nih.gov/ntp/htdocs/lt_rpts/tr459.pdf",
        year: 2002,
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
        title: "Consumption of High-Fructose Corn Syrup in Beverages May Play a Role in the Epidemic of Obesity",
        publisher: "American Journal of Clinical Nutrition",
        url: "https://academic.oup.com/ajcn/article/79/4/537/4690128",
        year: 2004,
      },
      {
        title: "Fructose consumption and consequences for glycation, plasma triacylglycerol, and body weight",
        publisher: "Journal of Nutrition",
        url: "https://pubmed.ncbi.nlm.nih.gov/19403705/",
        year: 2009,
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
        title: "Processed meat consumption and stomach cancer risk: a meta-analysis",
        publisher: "Journal of the National Cancer Institute",
        url: "https://pubmed.ncbi.nlm.nih.gov/16467232/",
        year: 2006,
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
        title: "Report on Carcinogens, Fourteenth Edition: Butylated Hydroxyanisole",
        publisher: "National Toxicology Program",
        url: "https://ntp.niehs.nih.gov/ntp/roc/content/profiles/butylatedhydroxyanisole.pdf",
        year: 2016,
      },
    ],
  },
  {
    name: "Potassium Bromate",
    category: "Flour Treatment",
    aliases: ["E924", "Bromic acid, potassium salt"],
    isToxic: true,
    concernLevel: "High",
    healthEffects: ["Potential carcinogen", "Kidney damage", "Nervous system damage"],
    sources: [
      {
        title: "Toxicology and carcinogenesis studies of potassium bromate",
        publisher: "National Toxicology Program",
        url: "https://pubmed.ncbi.nlm.nih.gov/2702717/",
        year: 1989,
      },
    ],
  },
  {
    name: "Artificial Food Coloring",
    category: "Additives",
    aliases: ["Red 40", "Yellow 5", "Yellow 6", "Blue 1", "Red 3"],
    isToxic: true,
    concernLevel: "Moderate",
    healthEffects: ["Hyperactivity in children", "Allergic reactions", "Behavioral changes"],
    sources: [
      {
        title: "Food additives and hyperactive behaviour in 3-year-old and 8/9-year-old children",
        publisher: "The Lancet",
        url: "https://pubmed.ncbi.nlm.nih.gov/17825405/",
        year: 2007,
      },
    ],
  },
  {
    name: "Partially Hydrogenated Oils",
    category: "Fats",
    aliases: ["Trans fats", "PHOs"],
    isToxic: true,
    concernLevel: "High",
    healthEffects: [
      "Increased LDL cholesterol",
      "Decreased HDL cholesterol",
      "Increased inflammation",
      "Higher risk of heart disease",
    ],
    sources: [
      {
        title: "Trans Fatty Acids and Cardiovascular Disease",
        publisher: "New England Journal of Medicine",
        url: "https://www.nejm.org/doi/full/10.1056/NEJMra054035",
        year: 2006,
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
