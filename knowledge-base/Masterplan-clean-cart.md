# Clean Cart Chrome Extension - Current Implementation

## App Overview and Objectives

App Name : Clean Cart
Web Domain : getcleancart.com
Chrome Store URL : https://chromewebstore.google.com/detail/clean-cart-ingredient-che/hfplmjgnghmoffhgfbkmkinknmlhbccg
Extension Icons :

- icons/icon16.png (16x16)
- icons/icon48.png (48x48)
- icons/icon128.png (128x128)

A Chrome extension that helps users make healthier food choices on Instacart by identifying products with potentially harmful ingredients. The extension provides visual feedback through a badge-based system and informative tooltips, making it easy for users to identify and understand concerning ingredients without disrupting their shopping experience.

### Core Value Proposition

- Simplifies healthy shopping decisions
- Non-intrusive UI with clear visual indicators
- Quick access to ingredient concerns
- Efficient performance through smart caching
- Real-time ingredient analysis

## Current Implementation Details

### Visual Feedback System

1. Badge-Based Indicators

   - Small circular badge in top-left corner of product images
   - Color-coded severity indication:
     - Red: High concern ingredients
     - Yellow: Moderate concern ingredients
     - Green: No concerning ingredients
     - Gray: No ingredient data available
   - Numeric counter showing number of concerning ingredients found

2. Interactive Tooltips
   - Appears on badge hover
   - Shows list of concerning ingredients
   - Indicates concern level for each ingredient
   - Clear messaging for safe products or missing data

### Data Management

1. Database Structure

   - Supabase PostgreSQL database
   - Product groups for handling variants
   - Real-time data collection during browsing
   - Version tracking for ingredient changes

2. Caching System
   - Two-level caching:
     - Memory cache for immediate access
     - IndexedDB for persistent storage
   - Batch processing of product data
   - Automatic cache cleanup
   - Background data prefetching

### Performance Optimizations

1. Batch Processing

   - Configurable batch size (currently 10 products)
   - Controlled delays between batches (500ms)
   - Prevents duplicate requests
   - Efficient callback management

2. Smart Caching
   - Product data caching
   - Ingredient result caching
   - Product group caching
   - Memory usage optimization

### Extension Components

1. Content Script

   - Product page monitoring
   - Badge overlay management
   - Event handling for tooltips
   - Cache coordination

2. Background Service

   - API communication
   - Cache management
   - Database operations

3. Data Managers
   - ProductDataManager: Coordinates data operations
   - ProductCacheManager: Handles caching
   - DatabaseHandler: Manages database operations
   - OverlayManager: Controls badge and tooltip display

### User Interface

1. Badge Design

   - 24x24px circular badge
   - Top-left positioning
   - Clear numeric indicator
   - Color-coded severity
   - Box shadow for visibility

2. Tooltip Design
   - Clean white background
   - Organized information hierarchy
   - Color-coded concern levels
   - Smooth hover interaction
   - Clear messaging for all states

## Technical Details

### Badge Implementation

```css
.toxic-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: white;
  font-weight: bold;
  font-size: 12px;
  z-index: 1000;
}
```

### Data Processing Flow

1. Product detection on page
2. Check cache for existing data
3. Queue for batch processing if needed
4. Process in configurable batch sizes
5. Update cache with results
6. Display badge with results
7. Enable tooltip interaction

### Caching Strategy

1. Memory Cache

   - Immediate access
   - Temporary storage
   - Frequently accessed data

2. IndexedDB Storage
   - Persistent data
   - Product information
   - Ingredient results
   - Product groups

## Disclaimers and Terms of Service

### Disclaimers

1. Information Purpose

   - The Clean Cart extension provides information for educational purposes only
   - The extension is not intended to diagnose, treat, cure, or prevent any disease
   - Users should consult qualified healthcare professionals for medical advice

2. Research Limitations

   - Ingredient classifications are based on available research which may evolve
   - Scientific understanding of certain ingredients remains subject to ongoing research
   - Some ingredients may have mixed or conflicting research findings
   - The extension reflects current research consensus where possible

3. Data Accuracy
   - While we strive for accuracy, ingredient data may not be complete or current
   - Product formulations can change without notice
   - Users should verify ingredients directly on product packaging
   - The extension is a supplementary tool and should not be the sole basis for purchasing decisions

### Terms of Service

1. Service Limitations

   - The extension provides ingredient analysis based on available data
   - We do not guarantee the completeness or accuracy of ingredient classifications
   - The badge system and warnings are guidelines, not definitive safety assessments
   - We reserve the right to modify or discontinue any features without notice

2. User Responsibility

   - Users acknowledge that ingredient research is ongoing and subject to change
   - Users are responsible for their own purchasing decisions
   - Users should conduct their own research and due diligence
   - The extension should be used as one of many tools in making informed decisions

3. Medical Disclaimer

   - The extension is not a substitute for professional medical advice
   - Users with specific health concerns should consult healthcare providers
   - Individual reactions to ingredients may vary
   - The extension does not account for personal allergies or sensitivities

4. Intellectual Property

   - All content, features, and functionality are owned by Clean Cart
   - Users may not copy, modify, or distribute extension materials
   - The extension's design, logos, and content are protected by copyright
   - Users receive a limited license to use the extension as intended

5. Acceptable Use

   - Users agree not to misuse or attempt to circumvent the service
   - No unauthorized access to backend systems or data
   - No interference with other users' access to the service
   - No automated or programmatic access without permission
   - No use of the service for unlawful purposes

6. Limitation of Liability

   - We are not liable for any damages arising from use of the service
   - No liability for decisions made based on extension data
   - No responsibility for product changes not reflected in our data
   - Maximum liability limited to subscription fees paid, if any

7. Service Modifications

   - We may modify or discontinue the service at any time
   - Features may change without prior notice
   - Subscription terms may be updated with notice
   - Users will be notified of significant changes

8. Privacy and Data

   - Users agree to our Privacy Policy
   - We collect and process data as described in Privacy Policy
   - Users grant permission to analyze shopping data
   - We implement reasonable security measures

9. Account Termination

   - We may suspend or terminate accounts for violations
   - Users may cancel subscription per cancellation policy
   - No refunds for partial subscription periods
   - Data retention follows our Privacy Policy

## Future Enhancements

1. Performance

   - WebWorker implementation for processing
   - Enhanced prefetching strategies
   - Further cache optimizations

2. Data Management

   - Enhanced batch processing
   - Improved caching strategies
   - Better variant handling

## Chrome Extension's Description on the store

Shop smarter on Instacart! Clean Cart highlights ingredients of concern, saving you time and helping you make healthier choices.

Make healthier food choices on Instacart with Clean Cart! This extension simplifies your grocery shopping by automatically scanning product ingredient lists and highlighting ingredients that you might want to avoid.

How Clean Cart Works:

Instant Ingredient Scanning: Clean Cart analyzes ingredient lists in real-time as you browse Instacart. No more manually reading every label!

Clear Visual Indicators: A simple, color-coded badge appears on product images:

🟢 Green: No ingredients of concern detected.

🟡 Yellow: Some ingredients you might want to review.

🔴 Red: Contains ingredients you may want to avoid, based on your preferences (see our website for details).

⚪ Gray: Ingredient data not available.

Informative Tooltips: Hover over the badge to see a list of the flagged ingredients and their category (e.g., preservative, artificial sweetener).

Saves You Time: Quickly identify products that meet your dietary needs and preferences, without spending hours reading labels.

7-Day Free Trial!

What We Check For:

Clean Cart helps you identify a wide range of ingredients, including:

Artificial Sweeteners (e.g., Aspartame, Sucralose)

Preservatives (e.g., BHA, BHT, Sodium Nitrite)

Artificial Colors (e.g., Red 40, Yellow 5)

And many more! (See our website, getcleancart.com, for the complete list and supporting research.)

Why Choose Clean Cart?

Empower Your Shopping: Make informed decisions about the food you buy.

Save Time & Effort: Streamline your grocery shopping experience.

Support Your Health Goals: Easily find products that align with your dietary needs.

Constantly Improving: We're committed to providing the most accurate and up-to-date ingredient information.

Install Clean Cart today and start shopping smarter!

DISCLAIMER:

Clean Cart is designed to provide helpful information and assist with your grocery shopping. While we strive for accuracy, ingredient lists on Instacart can sometimes be truncated or formatted differently. Always verify the complete ingredient list on the actual product packaging. Clean Cart is not a substitute for professional medical or dietary advice. Consult with healthcare professionals about specific dietary concerns. If our extension shows no concerning ingredients for products known to contain them (like some chips or sodas), please double-check the full ingredient list as formatting variations can affect detection.
