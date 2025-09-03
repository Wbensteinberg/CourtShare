"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

interface AddressSuggestion {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Enter address",
  className = "",
  label = "Address"
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Load Google Places API script
  useEffect(() => {
    const loadGooglePlaces = () => {
      // Check if already loaded
      if (window.google && window.google.maps && window.google.maps.places) {
        return;
      }

      // Check if script already exists
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        return;
      }

      // Check if API key is available
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.warn('Google Maps API key not found. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file');
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.id = 'google-maps-script';
      document.head.appendChild(script);

      script.onload = () => {
        console.log('Google Places API loaded successfully');
      };

      script.onerror = () => {
        console.error('Failed to load Google Places API. Please check your API key and billing settings.');
      };
    };

    loadGooglePlaces();
  }, []);

  const handleInputChange = (inputValue: string) => {
    onChange(inputValue);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // If input is empty, clear suggestions
    if (!inputValue.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce the API call
    timeoutRef.current = setTimeout(() => {
      if (window.google && window.google.maps && window.google.maps.places) {
        searchPlaces(inputValue);
      }
    }, 300);
  };

  const searchPlaces = (query: string) => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.warn('Google Places API not loaded. Please check your API key configuration.');
      setIsLoading(false);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key not configured. Address autocomplete will not work.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const service = new window.google.maps.places.AutocompleteService();
    const request = {
      input: query,
      types: ['address'],
      componentRestrictions: { country: 'us' } // Restrict to US addresses
    };

    service.getPlacePredictions(request, (predictions, status) => {
      setIsLoading(false);
      
      if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
        setSuggestions(predictions);
        setShowSuggestions(true);
      } else if (status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
        console.error('Google Places API request denied. Please check your API key and billing settings.');
        setSuggestions([]);
        setShowSuggestions(false);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    });
  };

  const handleSuggestionClick = (suggestion: AddressSuggestion) => {
    onChange(suggestion.description);
    setShowSuggestions(false);
    setSuggestions([]);

    // Get coordinates for the selected place
    if (window.google && window.google.maps && window.google.maps.places) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ placeId: suggestion.place_id }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          onChange(suggestion.description, {
            lat: location.lat(),
            lng: location.lng()
          });
        }
      });
    }
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <label className="text-sm font-semibold block mb-2">{label}</label>
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className={`pl-10 ${className}`}
        />
        {isLoading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.place_id}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="font-medium text-gray-900">
                {suggestion.structured_formatting.main_text}
              </div>
              <div className="text-sm text-gray-500">
                {suggestion.structured_formatting.secondary_text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
