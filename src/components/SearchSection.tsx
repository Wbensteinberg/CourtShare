import { useState, useRef, useEffect } from "react";
import type { MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Calendar, Clock, Filter, X, Navigation } from "lucide-react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getCurrentLocation, type Coordinates } from "@/lib/geolocation";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface SearchSectionProps {
  onLocationChange?: (location: string, coords: Coordinates | null) => void;
  onDistanceChange?: (distance: number | null) => void;
}

const SearchSection = ({ onLocationChange, onDistanceChange }: SearchSectionProps) => {
  const [location, setLocation] = useState("");
  const [date, setDate] = useState<Date | null>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const datePickerRef = useRef<any>(null);
  const [time, setTime] = useState("anytime");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [distanceFilter, setDistanceFilter] = useState<string>("10");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  const popularFilters = [
    "Indoor Courts",
    "Outdoor Courts",
    "Hard Court",
    "Clay Court",
    "Under $50/hr",
    "Parking Available",
    "WiFi Available",
  ];

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter)
        ? prev.filter((f) => f !== filter)
        : [...prev, filter]
    );
  };

  const removeFilter = (filter: string) => {
    setActiveFilters((prev) => prev.filter((f) => f !== filter));
  };

  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError("");
    
    try {
      const coords = await getCurrentLocation();
      setUserLocation(coords);
      setLocation("Current Location");
      setLocationError("");
      onLocationChange?.("Current Location", coords);
    } catch (error: any) {
      setLocationError(error.message);
      setUserLocation(null);
      onLocationChange?.("", null);
    } finally {
      setLocationLoading(false);
    }
  };

  const clearLocation = () => {
    setLocation("");
    setUserLocation(null);
    setLocationError("");
    onLocationChange?.("", null);
  };

  const handleLocationInputChange = (value: string) => {
    setLocation(value);
    // For manual location input, we don't have coordinates yet
    // This would need geocoding in a real implementation
    onLocationChange?.(value, null);
  };

  const handleDistanceChange = (value: string) => {
    setDistanceFilter(value);
    const distance = value && value !== "any" ? parseFloat(value) : null;
    onDistanceChange?.(distance);
  };

  // Initialize default distance filter on mount
  useEffect(() => {
    onDistanceChange?.(10); // Default to 10 miles
  }, [onDistanceChange]);

  return (
    <div className="w-full space-y-6 -mt-12 md:-mt-16 z-10 relative flex flex-col items-center mt-8" data-search-section>
      {/* Main Search Card */}
      <Card className="bg-white border border-gray-300 shadow-md rounded-xl w-full max-w-6xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Location */}
            <div className="space-y-2">
              <AddressAutocomplete
                value={location}
                onChange={(address, coordinates) => {
                  handleLocationInputChange(address);
                  if (coordinates) {
                    setUserLocation(coordinates);
                  }
                }}
                placeholder="Enter city or zip code"
                className="border-gray-300"
                label="Location"
              />
              <div className="flex gap-2 mt-2">
                {location && (
                  <button
                    onClick={clearLocation}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                    type="button"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={handleGetCurrentLocation}
                  disabled={locationLoading}
                  className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
                  type="button"
                  title="Use current location"
                >
                  {locationLoading ? "Getting..." : "Current Location"}
                </button>
              </div>
              {locationError && (
                <p className="text-xs text-red-500">{locationError}</p>
              )}
            </div>

            {/* Distance Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Within
              </label>
              <Select value={distanceFilter} onValueChange={handleDistanceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Any distance" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-lg">
                  <SelectItem value="any" className="hover:bg-green-50 cursor-pointer">
                    Any distance
                  </SelectItem>
                  <SelectItem value="5" className="hover:bg-green-50 cursor-pointer">
                    5 miles
                  </SelectItem>
                  <SelectItem value="10" className="hover:bg-green-50 cursor-pointer">
                    10 miles
                  </SelectItem>
                  <SelectItem value="15" className="hover:bg-green-50 cursor-pointer">
                    15 miles
                  </SelectItem>
                  <SelectItem value="25" className="hover:bg-green-50 cursor-pointer">
                    25 miles
                  </SelectItem>
                  <SelectItem value="50" className="hover:bg-green-50 cursor-pointer">
                    50 miles
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Date
              </label>
              <div className="relative">
                <ReactDatePicker
                  selected={date}
                  onChange={setDate}
                  dateFormat="MM/dd/yyyy"
                  placeholderText="mm/dd/yyyy"
                  className="w-full p-3 border border-gray-300 rounded-lg h-11 cursor-pointer"
                  ref={(r) => {
                    datePickerRef.current = r;
                  }}
                  popperPlacement="bottom"
                  calendarClassName="z-50"
                  wrapperClassName="w-full"
                  showPopperArrow={false}
                />
              </div>
            </div>

            {/* Time */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Time
              </label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                    <SelectValue placeholder="Select time" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-lg">
                  <SelectItem value="morning" className="hover:bg-green-50 cursor-pointer">
                    Morning (6AM - 12PM)
                  </SelectItem>
                  <SelectItem value="afternoon" className="hover:bg-green-50 cursor-pointer">
                    Afternoon (12PM - 6PM)
                  </SelectItem>
                  <SelectItem value="evening" className="hover:bg-green-50 cursor-pointer">
                    Evening (6PM - 10PM)
                  </SelectItem>
                  <SelectItem value="anytime" className="hover:bg-green-50 cursor-pointer">
                    Anytime
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Button */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-transparent">
                Search
              </label>
              <Button
                className="w-full bg-green-700 text-white hover:bg-green-800 font-semibold text-base h-11 rounded-lg shadow-md cursor-pointer"
                type="button"
              >
                <Search className="h-4 w-4 mr-2" />
                Search Courts
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters Section - COMMENTED OUT FOR FUTURE USE */}
      {/* 
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Popular Filters</h3>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            More Filters
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {popularFilters.map((filter) => (
            <Badge
              key={filter}
              variant={activeFilters.includes(filter) ? "default" : "secondary"}
              className={`cursor-pointer transition-all hover:scale-105 ${
                activeFilters.includes(filter)
                  ? "bg-tennis-green text-white hover:bg-tennis-light-green"
                  : "hover:bg-secondary/80"
              }`}
              onClick={() => toggleFilter(filter)}
            >
              {filter}
            </Badge>
          ))}
        </div>

        {activeFilters.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Active filters:</p>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge
                  key={filter}
                  variant="default"
                  className="bg-tennis-green text-white pr-1"
                >
                  {filter}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-2 hover:bg-transparent"
                    onClick={() => removeFilter(filter)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveFilters([])}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            </div>
          </div>
        )}
      </div>
      */}
    </div>
  );
};

export default SearchSection;
