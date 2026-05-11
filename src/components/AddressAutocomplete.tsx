"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

declare global {
  interface Window {
    google: any;
  }
}

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
  onChange: (
    address: string,
    coordinates?: { latitude: number; longitude: number }
  ) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  labelClassName?: string;
  /** When false, omit the map pin and left padding for inline / pill search bars */
  showMapPin?: boolean;
  /** Externally control whether the suggestions dropdown can be visible */
  active?: boolean;
  /** Notify parent that this field wants to be the active (open) dropdown */
  onActiveChange?: (active: boolean) => void;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Enter address",
  className = "",
  label = "Address",
  labelClassName = "",
  showMapPin = true,
  active,
  onActiveChange,
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load Google Places API script
  useEffect(() => {
    const loadGooglePlaces = () => {
      // Check if already loaded
      if (window.google && window.google.maps && window.google.maps.places) {
        return;
      }

      // Check if script already exists
      const existingScript = document.querySelector(
        'script[src*="maps.googleapis.com"]'
      );
      if (existingScript) {
        return;
      }

      // Check if API key is available
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.warn(
          "Google Maps API key not found. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file"
        );
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.id = "google-maps-script";
      document.head.appendChild(script);

      script.onload = () => {
        console.log("Google Places API loaded successfully");
      };

      script.onerror = () => {
        console.error(
          "Failed to load Google Places API. Please check your API key and billing settings."
        );
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
      console.warn(
        "Google Places API not loaded. Please check your API key configuration."
      );
      setIsLoading(false);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn(
        "Google Maps API key not configured. Address autocomplete will not work."
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const service = new window.google.maps.places.AutocompleteService();
    const request = {
      input: query,
      types: ["address"],
      componentRestrictions: { country: "us" }, // Restrict to US addresses
    };

    service.getPlacePredictions(request, (predictions: any, status: any) => {
      setIsLoading(false);

      if (
        status === window.google.maps.places.PlacesServiceStatus.OK &&
        predictions
      ) {
        setSuggestions(predictions);
        setShowSuggestions(true);
      } else if (
        status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED
      ) {
        console.error(
          "Google Places API request denied. Please check your API key and billing settings."
        );
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
      geocoder.geocode(
        { placeId: suggestion.place_id },
        (results: any, status: any) => {
          if (status === "OK" && results && results[0]) {
            const location = results[0].geometry.location;
            onChange(suggestion.description, {
              latitude: location.lat(),
              longitude: location.lng(),
            });
          }
        }
      );
    }
  };

  const handleInputFocus = () => {
    onActiveChange?.(true);
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
      onActiveChange?.(false);
    }, 200);
  };

  // Hide suggestions if the parent says we're no longer the active dropdown
  useEffect(() => {
    if (active === false) {
      setShowSuggestions(false);
    }
  }, [active]);

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
      {label && (
        <label className={`block mb-2 text-sm font-semibold ${labelClassName}`}>
          {label}
        </label>
      )}
      <div className="relative">
        {showMapPin && (
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className={showMapPin ? `pl-10 ${className}` : className}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {active !== false && showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 z-[70] mt-3 max-h-72 overflow-y-auto rounded-3xl border border-slate-100 bg-white p-2 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.28)]">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion.place_id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSuggestionClick(suggestion)}
              className="block w-full cursor-pointer rounded-2xl px-4 py-3 text-left transition-colors hover:bg-slate-50"
            >
              <div className="font-semibold text-slate-900">
                {suggestion.structured_formatting.main_text}
              </div>
              <div className="text-sm text-slate-500">
                {suggestion.structured_formatting.secondary_text}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
