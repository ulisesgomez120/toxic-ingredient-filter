# Grocery Ingredient Filter Chrome Extension Master Plan

## App Overview and Objectives

A Chrome extension that helps users make healthier food choices on Instacart by filtering out products with potentially harmful ingredients. The extension provides visual feedback through semi-transparent overlays and informative hovers, making it easy for users to identify and understand concerning ingredients without disrupting their shopping experience.

### Core Value Proposition

- Simplifies healthy shopping decisions
- Non-intrusive UI that informs without overwhelming
- Educational component to help users understand ingredients
- Customizable filtering based on user preferences
- Comprehensive ingredient database powered by OpenFoodFacts data

## Target Audience

- Health-conscious shoppers
- People with specific ingredient concerns
- Users overwhelmed by ingredient checking
- Instacart shoppers (initial platform)

## Features and Functionality

### Free Tier Features

1. Basic Toxin Screening
   - Pre-defined list of top 20 concerning ingredients
   - Global strictness setting (strict/moderate/lenient)
   - Basic educational tooltips with external links
2. Limited Customization
   - Add up to 3 custom ingredients to filter
3. Visual Feedback System
   - Semi-transparent overlay on products with concerning ingredients
   - Hover tooltip showing:
     - Number of concerning ingredients
     - List of specific ingredients
     - Concern level for each
   - Small clickable area in overlay corner for detailed view

### Premium Tier Features

1. Advanced Filtering
   - Complete database of harmful ingredients
   - Unlimited custom ingredients
   - Multiple filter presets
2. Enhanced Education
   - Detailed ingredient information
   - Comprehensive educational resources
3. Additional Features
   - Export safe product lists
   - Weekly/monthly reports
   - Future: sharing capabilities (v2)

## Technical Architecture

### Data Management

1. Primary Data Source
   - OpenFoodFacts database MongoDB dump
   - Bi-monthly data synchronization
   - Data enrichment with additional health information
2. Caching Strategy
   - IndexedDB for extension cache
   - Server-side caching for frequent requests
   - Bi-weekly cache cleanup
   - Background refresh for frequently checked items

### Backend Infrastructure

1. Data Synchronization

   - Bi-monthly sync with OpenFoodFacts database
   - JSONL data processing and enrichment
   - Monitoring system for sync health
   - Alert system for sync failures

2. Database System

   - Stores processed OpenFoodFacts data
   - Maintains ingredient classifications
   - Stores user preferences and settings
   - Caches frequently accessed data

3. REST API
   - Bulk product lookup endpoints
   - Ingredient information retrieval
   - Health classification data
   - Cache management endpoints

### Extension Components

1. Content Script
   - Monitors Instacart product pages
   - Applies semi-transparent overlays
   - Handles hover and click interactions
2. Background Service
   - Manages API communications
   - Handles IndexedDB caching
   - Performs periodic cache cleanup
3. Options Page
   - Settings management
   - Filter configurations
   - Educational resources
   - Account/subscription management

## User Interface Design Principles

1. Non-intrusive
   - Gray overlay for filtered items
   - Preserve original product link functionality
   - Dedicated click area for additional information
2. Informative
   - Clear hover tooltips
   - Educational content readily available
   - Intuitive strictness settings
3. Responsive
   - Fast feedback on hover
   - Smooth transitions
   - Minimal impact on page load

## Options Page Organization

1. Main Settings
   - Strictness level controls
   - Premium status/upgrade
2. Filter Management
   - Custom ingredient management
   - Premium: preset management
3. Educational Resources
   - Trusted source links
   - Ingredient explanations
4. About/Help
   - Usage instructions
   - Support contact

## Security Considerations

1. Data Privacy
   - Minimal user data collection
   - Local storage of preferences
   - Secure API communications
2. Performance
   - Efficient caching
   - Throttled API calls
   - Optimized DOM operations
3. Backend Security
   - API request validation
   - Rate limiting
   - Error handling
   - Security headers

### System Requirements

1. Server Infrastructure
   - Bun backend environment
   - MongoDB 4.4 database, important since openfoodfacts.org exports a mongo dump of their db from https://static.openfoodfacts.org/data/openfoodfacts-mongodbdump.gz (for structured product data)
   - Redis cache (for API response caching)
   - Minimum 16GB RAM for JSONL processing
2. Client Requirements
   - Chrome browser version 88+
   - ~100MB local storage capacity

## Development Phases

### Phase 1: Backend Infrastructure

1. Database setup and schema design
2. JSONL import processor
3. Basic REST API endpoints
4. Monitoring system setup

### Phase 2: Extension MVP

1. Basic extension structure
2. Instacart page integration
3. Free tier functionality
4. Basic options page
5. Essential educational content

### Phase 3: Premium Features

1. Advanced filtering system
2. Subscription management
3. Enhanced educational content
4. Improved caching system

### Phase 4: Optimization

1. Performance improvements
2. UI/UX refinements
3. Additional educational resources
4. User feedback implementation

### Future Phases (v2+)

1. Social features (sharing filters)
2. Additional platform support
3. Advanced reporting features
4. API integration expansion

## Potential Challenges and Solutions

### Technical Challenges

1. Instacart Page Structure
   - Challenge: Website structure changes
   - Solution: Robust selectors and fallback mechanisms
2. API Reliability
   - Challenge: API downtime or rate limits
   - Solution: Efficient caching and fallback data
3. Data Synchronization
   - Challenge: Large dataset processing
   - Solution: Efficient import strategy and data partitioning
4. Cache Management
   - Challenge: Balancing cache size and performance
   - Solution: Smart cache eviction and periodic cleanup
5. API Performance
   - Challenge: High concurrent requests
   - Solution: Implement request batching and efficient caching

### User Experience Challenges

1. Information Overload
   - Challenge: Too much information could overwhelm
   - Solution: Progressive disclosure through hover/click
2. False Positives
   - Challenge: Over-flagging products
   - Solution: Adjustable strictness levels

## Success Metrics

1. User Engagement
   - Active users
   - Interaction rates
   - Premium conversion rate
2. Technical Performance
   - Load time impact
   - Cache hit rate
   - API usage efficiency

## Future Expansion Possibilities

1. Platform Expansion
   - Additional grocery platforms
   - Mobile app version
2. Feature Enhancement
   - Recipe analysis
   - Meal planning integration
   - Barcode scanning (mobile)
3. Data Sources
   - Additional API integrations
   - User-contributed data
4. Community Features

   - Shared filter collections
   - Community reviews
   - Expert recommendations
