import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Calendar, Clock, Filter, X } from "lucide-react";

const SearchSection = () => {
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const popularFilters = [
    "Indoor Courts",
    "Outdoor Courts",
    "Hard Court",
    "Clay Court",
    "Under $50/hr",
    "Parking Available",
    "WiFi Available"
  ];

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const removeFilter = (filter: string) => {
    setActiveFilters(prev => prev.filter(f => f !== filter));
  };

  return (
    <div className="w-full space-y-6">
      {/* Main Search Card */}
      <Card className="shadow-elegant border-2 border-primary/10">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Location */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter city or zip code"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Time */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Time</label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                    <SelectValue placeholder="Select time" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning (6AM - 12PM)</SelectItem>
                  <SelectItem value="afternoon">Afternoon (12PM - 6PM)</SelectItem>
                  <SelectItem value="evening">Evening (6PM - 10PM)</SelectItem>
                  <SelectItem value="anytime">Anytime</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Button */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-transparent">Search</label>
              <Button variant="hero" size="lg" className="w-full">
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