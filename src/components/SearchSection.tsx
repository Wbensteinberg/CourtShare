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
import {
  Search,
  MapPin,
  Calendar,
  Clock,
  Filter,
  X,
  Navigation,
  Trophy,
} from "lucide-react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import type { Coordinates } from "@/lib/geolocation";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface SearchSectionProps {
  onLocationChange?: (location: string, coords: Coordinates | null) => void;
  onDistanceChange?: (distance: number | null) => void;
}

const SearchSection = ({
  onLocationChange,
  onDistanceChange,
}: SearchSectionProps) => {
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
  // const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  // const [locationLoading, setLocationLoading] = useState(false);
  // const [locationError, setLocationError] = useState("");

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

  // const handleGetCurrentLocation = async () => {
  //   setLocationLoading(true);
  //   setLocationError("");
  //
  //   try {
  //     const coords = await getCurrentLocation();
  //     setUserLocation(coords);
  //     setLocation("Current Location");
  //     setLocationError("");
  //     onLocationChange?.("Current Location", coords);
  //   } catch (error: any) {
  //     setLocationError(error.message);
  //     setUserLocation(null);
  //     onLocationChange?.("", null);
  //   } finally {
  //     setLocationLoading(false);
  //   }
  // };

  // const clearLocation = () => {
  //   setLocation("");
  //   setUserLocation(null);
  //   setLocationError("");
  //   onLocationChange?.("", null);
  // };

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
    <div
      className="relative z-20 mx-auto -mt-24 flex w-full max-w-6xl flex-col items-center space-y-5 px-4 md:-mt-28"
      data-search-section
    >
      <Card className="w-full overflow-visible rounded-[32px] border border-white/70 bg-white/92 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <CardContent className="overflow-visible p-4 md:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.45fr_0.9fr_0.95fr_0.95fr_64px] md:items-end">
            <div className="min-w-0">
              <label className="mb-3 block whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Where do you want to play?
              </label>
              <AddressAutocomplete
                value={location}
                onChange={(address, coordinates) => {
                  handleLocationInputChange(address);
                  // if (coordinates) {
                  //   setUserLocation(coordinates);
                  // }
                }}
                placeholder="Enter city or zip code"
                className="h-14 rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base font-semibold text-slate-900 shadow-sm"
                label=""
              />
              {/* <div className="mt-2 flex gap-2">
                {location && (
                  <button
                    onClick={clearLocation}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
                    type="button"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={handleGetCurrentLocation}
                  disabled={locationLoading}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 transition-colors disabled:opacity-50"
                  type="button"
                  title="Use current location"
                >
                  {locationLoading ? "Getting..." : "Current Location"}
                </button>
              </div>
              {locationError && (
                <p className="mt-2 text-xs text-red-500">{locationError}</p>
              )} */}
            </div>

            <div className="min-w-0">
              <label className="mb-3 block whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Within
              </label>
              <Select
                value={distanceFilter}
                onValueChange={handleDistanceChange}
              >
                <SelectTrigger className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold shadow-sm">
                  <SelectValue placeholder="Any distance" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-lg">
                  <SelectItem
                    value="any"
                    className="hover:bg-green-50 cursor-pointer"
                  >
                    Any distance
                  </SelectItem>
                  <SelectItem
                    value="5"
                    className="hover:bg-green-50 cursor-pointer"
                  >
                    5 miles
                  </SelectItem>
                  <SelectItem
                    value="10"
                    className="hover:bg-green-50 cursor-pointer"
                  >
                    10 miles
                  </SelectItem>
                  <SelectItem
                    value="15"
                    className="hover:bg-green-50 cursor-pointer"
                  >
                    15 miles
                  </SelectItem>
                  <SelectItem
                    value="25"
                    className="hover:bg-green-50 cursor-pointer"
                  >
                    25 miles
                  </SelectItem>
                  <SelectItem
                    value="50"
                    className="hover:bg-green-50 cursor-pointer"
                  >
                    50 miles
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <label className="mb-3 block whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Date
              </label>
              <div className="relative rounded-2xl bg-white">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <ReactDatePicker
                  selected={date}
                  onChange={setDate}
                  dateFormat="MM/dd/yyyy"
                  placeholderText="mm/dd/yyyy"
                  className="search-date-input w-full cursor-pointer"
                  ref={(r) => {
                    datePickerRef.current = r;
                  }}
                  popperPlacement="bottom-start"
                  popperClassName="z-[100]"
                  calendarClassName="z-[100]"
                  wrapperClassName="w-full"
                  showPopperArrow={false}
                  minDate={new Date()}
                  excludeDates={[]}
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className="mb-3 block whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Time
              </label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold shadow-sm">
                  <div className="flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-slate-500" />
                    <SelectValue placeholder="Select time" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-lg">
                  <SelectItem
                    value="morning"
                    className="hover:bg-green-50 cursor-pointer"
                  >
                    Morning (6AM - 12PM)
                  </SelectItem>
                  <SelectItem
                    value="afternoon"
                    className="hover:bg-green-50 cursor-pointer"
                  >
                    Afternoon (12PM - 6PM)
                  </SelectItem>
                  <SelectItem
                    value="evening"
                    className="hover:bg-green-50 cursor-pointer"
                  >
                    Evening (6PM - 10PM)
                  </SelectItem>
                  <SelectItem
                    value="anytime"
                    className="hover:bg-green-50 cursor-pointer"
                  >
                    Anytime
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                className="h-14 w-full rounded-[22px] bg-[var(--site-accent)] text-white shadow-none transition-all duration-300 hover:bg-[var(--site-accent-hover)] md:w-14 md:rounded-full"
                type="button"
              >
                <Search className="h-5 w-5 md:mr-0" />
                <span className="ml-2 md:hidden">Search Courts</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-3 px-4 text-center text-sm font-semibold text-slate-700">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-sm ring-1 ring-slate-200">
          <MapPin className="h-4 w-4 text-[#1b2534]" />
          Local private courts
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-sm ring-1 ring-slate-200">
          <Calendar className="h-4 w-4 text-[#1b2534]" />
          Live availability
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-sm ring-1 ring-slate-200">
          <Trophy className="h-4 w-4 text-[#1b2534]" />
          Premium match-day feel
        </span>
      </div>

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
