# Chrome Extension Permissions Justification

## Core Permissions

### Storage Permission

- Required to save user preferences and cached product data locally
- Enables offline access to previously scanned product information

### ActiveTab Permission

- Needed to interact with the current Instacart tab when scanning products
- Allows the extension to modify the page to highlight harmful ingredients
- Only activates when the user is actively using Instacart

### Identity Permission

- Required for user authentication with our Supabase backend
- Enables secure user account management
- Necessary for syncing user preferences across devices

## Host Permissions

### Instacart Domain (`*://*.instacart.com/*`)

- Required to scan and analyze product ingredients on Instacart pages
- Needed to inject our overlay UI for ingredient warnings
- Essential for the core functionality of identifying harmful ingredients

### Supabase Domain (`*://*.supabase.co/*`)

- Required for secure backend communication
- Enables user data synchronization
- Necessary for accessing our ingredient database

## Content Security Considerations

Our extension uses a strict Content Security Policy that:

- Limits script execution to extension-owned resources only (`'self'`)
- Prevents execution of remote code for security
- Ensures all functionality comes from verified extension files

These permissions represent the minimum required set to deliver our core functionality while maintaining security and user privacy.
