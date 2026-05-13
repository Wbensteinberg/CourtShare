import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CalendarDays, Check, Search } from "lucide-react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import type { Coordinates } from "@/lib/geolocation";
import AddressAutocomplete from "@/components/AddressAutocomplete";

type SearchDropdown = "where" | "within" | "date" | "time" | null;

const searchSelectItemClass =
  "relative flex w-full cursor-pointer select-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-medium text-slate-700 outline-none transition-colors focus:bg-slate-50 focus:text-slate-900 data-[state=checked]:bg-slate-50 data-[state=checked]:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

function SearchSelectItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Item value={value} className={searchSelectItemClass}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--site-accent)]">
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

interface SearchSectionProps {
  onLocationChange?: (location: string, coords: Coordinates | null) => void;
  onDistanceChange?: (distance: number | null) => void;
  initialLocation?: string;
  initialDistance?: string;
  initialTime?: string;
  initialDate?: string;
  initialLatitude?: string;
  initialLongitude?: string;
  overlapHero?: boolean;
}

const SearchSection = ({
  onLocationChange,
  onDistanceChange,
  initialLocation = "",
  initialDistance = "10",
  initialTime = "anytime",
  initialDate,
  initialLatitude,
  initialLongitude,
  overlapHero = true,
}: SearchSectionProps) => {
  const router = useRouter();
  const [location, setLocation] = useState(initialLocation);
  const [selectedCoordinates, setSelectedCoordinates] =
    useState<Coordinates | null>(() => {
      const latitude = Number(initialLatitude);
      const longitude = Number(initialLongitude);
      return Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude, longitude }
        : null;
    });
  const [date, setDate] = useState<Date | null>(() => {
    if (initialDate) {
      const parsedDate = new Date(`${initialDate}T00:00:00`);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const datePickerRef = useRef<any>(null);
  const [time, setTime] = useState(initialTime);
  const [distanceFilter, setDistanceFilter] = useState<string>(initialDistance);
  const [activeDropdown, setActiveDropdown] = useState<SearchDropdown>(null);

  const makeSelectHandler = (id: Exclude<SearchDropdown, null>) => (open: boolean) => {
    setActiveDropdown((prev) => {
      if (open) return id;
      return prev === id ? null : prev;
    });
  };
  // const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  // const [locationLoading, setLocationLoading] = useState(false);
  // const [locationError, setLocationError] = useState("");

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

  const handleDistanceChange = (value: string) => {
    setDistanceFilter(value);
    const distance = value && value !== "any" ? parseFloat(value) : null;
    onDistanceChange?.(distance);
  };

  // Initialize default distance filter on mount
  useEffect(() => {
    const distance =
      distanceFilter && distanceFilter !== "any" ? parseFloat(distanceFilter) : null;
    onDistanceChange?.(distance);
  }, [distanceFilter, onDistanceChange]);

  useEffect(() => {
    const latitude = Number(initialLatitude);
    const longitude = Number(initialLongitude);
    setSelectedCoordinates(
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude, longitude }
        : null
    );
  }, [initialLatitude, initialLongitude]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (location) params.set("location", location);
    if (distanceFilter) params.set("distance", distanceFilter);
    if (date) params.set("date", date.toISOString().slice(0, 10));
    if (time) params.set("time", time);
    if (selectedCoordinates) {
      params.set("lat", String(selectedCoordinates.latitude));
      params.set("lng", String(selectedCoordinates.longitude));
    }
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div
      className={`relative z-[100] mx-auto flex w-full flex-col items-center space-y-5 ${
        overlapHero ? "-mt-24 md:-mt-28" : "mt-0"
      }`}
      data-search-section
    >
      <div className="flex w-full max-w-6xl flex-col overflow-visible rounded-[28px] border border-slate-200/90 bg-white p-2 shadow-[0_8px_32px_rgba(15,23,42,0.1)] md:flex-row md:items-stretch md:rounded-full md:p-1.5 md:pl-3 md:pr-2">
        <div className="flex min-h-0 flex-1 flex-col divide-y divide-slate-200/80 md:flex-row md:divide-x md:divide-y-0">
          <div className="group flex min-h-[4.5rem] min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3 transition-[box-shadow,background-color] focus-within:relative focus-within:z-[1] focus-within:rounded-2xl focus-within:bg-white focus-within:shadow-[0_6px_24px_rgba(15,23,42,0.12)] focus-within:ring-1 focus-within:ring-slate-200/90 md:min-h-[3.25rem] md:rounded-full md:px-5 md:py-2.5 md:focus-within:rounded-full">
            <span className="text-xs font-semibold text-slate-900">
              Where do you want to play?
            </span>
            <AddressAutocomplete
              value={location}
              onChange={(address, coordinates) => {
                const normalizedCoordinates = coordinates
                  ? {
                      latitude: coordinates.latitude,
                      longitude: coordinates.longitude,
                    }
                  : null;
                setLocation(address);
                setSelectedCoordinates(normalizedCoordinates);
                onLocationChange?.(address, normalizedCoordinates);
              }}
              placeholder="Enter city or zip code"
              showMapPin={false}
              showCurrentLocationOption
              className="h-auto min-h-[1.25rem] border-0 bg-transparent px-0 py-0 text-sm font-medium text-slate-600 shadow-none placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
              label=""
              active={activeDropdown === "where"}
              onActiveChange={(isActive) => {
                if (isActive) {
                  setActiveDropdown("where");
                } else {
                  setActiveDropdown((prev) => (prev === "where" ? null : prev));
                }
              }}
            />
          </div>

          <div className="group flex min-h-[4.5rem] min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3 transition-[box-shadow,background-color] focus-within:relative focus-within:z-[1] focus-within:rounded-2xl focus-within:bg-white focus-within:shadow-[0_6px_24px_rgba(15,23,42,0.12)] focus-within:ring-1 focus-within:ring-slate-200/90 md:min-h-[3.25rem] md:min-w-[7.5rem] md:rounded-full md:px-5 md:py-2.5 md:focus-within:rounded-full">
            <span className="text-xs font-semibold text-slate-900">Within</span>
            <Select
              value={distanceFilter}
              onValueChange={handleDistanceChange}
              open={activeDropdown === "within"}
              onOpenChange={makeSelectHandler("within")}
            >
              <SelectTrigger className="h-auto min-h-[1.25rem] w-full border-0 bg-transparent p-0 text-left text-sm font-medium text-slate-600 shadow-none ring-offset-0 focus:ring-0 focus:ring-offset-0 data-[state=open]:ring-0 [&>span]:truncate [&>svg]:ml-auto [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:opacity-60">
                <SelectValue placeholder="Any distance" />
              </SelectTrigger>
              <SelectContent
                sideOffset={12}
                className="z-[70] rounded-3xl border border-slate-100 bg-white p-2 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.28)]"
              >
                <SearchSelectItem value="any">Any distance</SearchSelectItem>
                <SearchSelectItem value="5">5 miles</SearchSelectItem>
                <SearchSelectItem value="10">10 miles</SearchSelectItem>
                <SearchSelectItem value="15">15 miles</SearchSelectItem>
                <SearchSelectItem value="25">25 miles</SearchSelectItem>
                <SearchSelectItem value="50">50 miles</SearchSelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="group flex min-h-[4.5rem] min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3 transition-[box-shadow,background-color] focus-within:relative focus-within:z-[1] focus-within:rounded-2xl focus-within:bg-white focus-within:shadow-[0_6px_24px_rgba(15,23,42,0.12)] focus-within:ring-1 focus-within:ring-slate-200/90 md:min-h-[3.25rem] md:rounded-full md:px-5 md:py-2.5 md:focus-within:rounded-full">
            <span className="text-xs font-semibold text-slate-900">Date</span>
            <div className="relative flex w-full min-w-0 items-center">
              <CalendarDays className="pointer-events-none absolute right-0 h-4 w-4 text-slate-400" />
              <ReactDatePicker
                selected={date}
                onChange={(value) => {
                  setDate(value);
                  setActiveDropdown((prev) => (prev === "date" ? null : prev));
                }}
                dateFormat="MM/dd/yyyy"
                placeholderText="mm/dd/yyyy"
                className="search-date-input-pill w-full cursor-pointer"
                ref={(r) => {
                  datePickerRef.current = r;
                }}
                open={activeDropdown === "date"}
                onInputClick={() => setActiveDropdown("date")}
                onClickOutside={() =>
                  setActiveDropdown((prev) => (prev === "date" ? null : prev))
                }
                onCalendarClose={() =>
                  setActiveDropdown((prev) => (prev === "date" ? null : prev))
                }
                popperPlacement="bottom-start"
                popperClassName="z-[70]"
                calendarClassName="courtshare-calendar search-calendar"
                wrapperClassName="w-full"
                showPopperArrow={false}
                minDate={new Date()}
                excludeDates={[]}
              />
            </div>
          </div>

          <div className="group flex min-h-[4.5rem] min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3 transition-[box-shadow,background-color] focus-within:relative focus-within:z-[1] focus-within:rounded-2xl focus-within:bg-white focus-within:shadow-[0_6px_24px_rgba(15,23,42,0.12)] focus-within:ring-1 focus-within:ring-slate-200/90 md:min-h-[3.25rem] md:min-w-[8rem] md:rounded-full md:px-5 md:py-2.5 md:focus-within:rounded-full">
            <span className="text-xs font-semibold text-slate-900">Time</span>
            <Select
              value={time}
              onValueChange={setTime}
              open={activeDropdown === "time"}
              onOpenChange={makeSelectHandler("time")}
            >
              <SelectTrigger className="h-auto min-h-[1.25rem] w-full border-0 bg-transparent p-0 text-left text-sm font-medium text-slate-600 shadow-none ring-offset-0 focus:ring-0 focus:ring-offset-0 data-[state=open]:ring-0 [&>span]:truncate [&>svg]:ml-auto [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:opacity-60">
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent
                sideOffset={12}
                className="z-[70] rounded-3xl border border-slate-100 bg-white p-2 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.28)]"
              >
                <SearchSelectItem value="morning">Morning (6AM - 12PM)</SearchSelectItem>
                <SearchSelectItem value="afternoon">Afternoon (12PM - 6PM)</SearchSelectItem>
                <SearchSelectItem value="evening">Evening (6PM - 10PM)</SearchSelectItem>
                <SearchSelectItem value="anytime">Anytime</SearchSelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-center border-t border-slate-200/80 p-2 md:border-t-0 md:border-l md:border-slate-200/80 md:pl-3 md:pr-1">
          <Button
            className="inline-flex h-12 w-full max-w-[12rem] items-center justify-center rounded-full bg-[var(--site-accent)] text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-[var(--site-accent-hover)] md:h-12 md:w-12 md:max-w-none md:shrink-0"
            type="button"
            onClick={handleSearch}
            aria-label="Search courts"
          >
            <Search className="h-5 w-5" />
            <span className="ml-2 font-semibold md:sr-only">Search</span>
          </Button>
        </div>
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
