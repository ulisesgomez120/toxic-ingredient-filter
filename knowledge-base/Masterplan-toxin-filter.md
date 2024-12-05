# Grocery Ingredient Filter Chrome Extension - Current Implementation

## App Overview and Objectives

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

## Future Enhancements

1. Performance

   - WebWorker implementation for processing
   - Enhanced prefetching strategies
   - Further cache optimizations

2. Data Management

   - Enhanced batch processing
   - Improved caching strategies
   - Better variant handling
