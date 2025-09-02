import { useState, useRef } from "react";
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

interface SearchSectionProps {
  onLocationChange?: (location: string, coords: Coordinates | null) => void;
  onDistanceChange?: (distance: number | null) => void;
}

const SearchSection = ({ onLocationChange, onDistanceChange }: SearchSectionProps) => {
  const [location, setLocation] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const datePickerRef = useRef<any>(null);
  const [time, setTime] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [distanceFilter, setDistanceFilter] = useState<string>("");
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

  return (
    <div className="w-full space-y-6 -mt-12 md:-mt-16 z-10 relative flex flex-col items-center mt-8" data-search-section>
      {/* Main Search Card */}
      <Card className="bg-white border border-gray-300 shadow-md rounded-xl w-full max-w-6xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Location */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter city or zip code"
                  value={location}
                  onChange={(e) => handleLocationInputChange(e.target.value)}
                  className="pl-10 pr-20 border-gray-300"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  {location && (
                    <button
                      onClick={clearLocation}
                      className="p-1 hover:bg-gray-100 rounded"
                      type="button"
                    >
                      <X className="h-3 w-3 text-gray-500" />
                    </button>
                  )}
                  <button
                    onClick={handleGetCurrentLocation}
                    disabled={locationLoading}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                    type="button"
                    title="Use current location"
                  >
                    <Navigation className="h-3 w-3 text-green-600" />
                  </button>
                </div>
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
                <SelectTrigger className="border border-gray-300 rounded-lg h-11 pl-3 cursor-pointer">
                  <SelectValue placeholder="Any distance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any distance</SelectItem>
                  <SelectItem value="5">5 miles</SelectItem>
                  <SelectItem value="10">10 miles</SelectItem>
                  <SelectItem value="15">15 miles</SelectItem>
                  <SelectItem value="25">25 miles</SelectItem>
                  <SelectItem value="50">50 miles</SelectItem>
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
                <SelectTrigger className="border border-gray-300 rounded-lg h-11 pl-3 cursor-pointer">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                    <SelectValue placeholder="Select time" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning (6AM - 12PM)</SelectItem>
                  <SelectItem value="afternoon">
                    Afternoon (12PM - 6PM)
                  </SelectItem>
                  <SelectItem value="evening">Evening (6PM - 10PM)</SelectItem>
                  <SelectItem value="anytime">Anytime</SelectItem>
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

      {/* Filters Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Popular Filters</h3>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            More Filters
          </Button>
        </div>

        {/* Filter Tags */}
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

        {/* Active Filters */}
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
    </div>
  );
};

export default SearchSection;
