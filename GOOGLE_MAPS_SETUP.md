# Google Maps API Setup

To enable address autocomplete functionality, you need to set up a Google Maps API key.

## ⚠️ Current Status:
**The address autocomplete feature is currently disabled** because no Google Maps API key is configured. You'll see warnings in the console until you set this up.

## Steps:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Places API** (required for autocomplete)
   - **Geocoding API** (required for coordinates)
   - **Maps JavaScript API** (required for the library)

4. Create credentials (API Key)
5. **Important**: Set up billing for your project (Google requires billing even for free tier)
6. Add the API key to your `.env.local` file:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

7. Restart your development server after adding the API key

## API Restrictions (Recommended):

For security, restrict your API key to:
- HTTP referrers: your domain(s)
- APIs: Places API, Geocoding API, Maps JavaScript API

## Features Enabled:

- **Address Autocomplete**: Real-time address suggestions as users type
- **Auto-coordinates**: Automatically fills latitude/longitude when address is selected
- **US-only**: Currently restricted to US addresses for better accuracy

## Usage:

The AddressAutocomplete component is now integrated into:
- Create Listing page (`/create-listing`)
- Edit Listing page (`/edit-listing/[courtId]`)

Users can now:
1. Start typing an address
2. See real-time suggestions from Google Places
3. Click on a suggestion to auto-fill the address
4. Get coordinates automatically populated for distance filtering
