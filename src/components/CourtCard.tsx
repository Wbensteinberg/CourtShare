import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star, Clock, Users, Wifi, Car } from "lucide-react";
import { useRouter } from "next/navigation";

interface CourtCardProps {
  court: {
    id: string;
    name: string;
    location: string;
    price: number;
    rating: number;
    reviewCount: number;
    image: string;
    surface: string;
    indoor: boolean;
    amenities: string[];
    availability: string;
  };
}

const CourtCard = ({ court }: CourtCardProps) => {
  const router = useRouter();
  const amenityIcons: { [key: string]: any } = {
    WiFi: Wifi,
    Parking: Car,
    "Changing Rooms": Users,
  };

  const goToDetails = () => router.push(`/courts/${court.id}`);

  return (
    <Card
      className="group overflow-hidden hover:shadow-card transition-all duration-300 hover:-translate-y-1 cursor-pointer"
      onClick={goToDetails}
      aria-label={`View details for ${court.name}`}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") goToDetails();
      }}
    >
      <CardHeader className="p-0">
        <div className="relative overflow-hidden rounded-t-lg">
          <img
            src={court.image}
            alt={court.name}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-3 left-3">
            <Badge variant={court.indoor ? "default" : "secondary"}>
              {court.indoor ? "Indoor" : "Outdoor"}
            </Badge>
          </div>
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="bg-white/90 text-foreground">
              ${court.price}/hr
            </Badge>
          </div>
          <div className="absolute bottom-3 left-3">
            <Badge className="bg-tennis-green text-white">
              {court.surface}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg hover:text-primary transition-colors cursor-pointer">
              {court.name}
            </h3>
            <div className="flex items-center text-sm text-muted-foreground mt-1">
              <MapPin className="h-4 w-4 mr-1" />
              {court.location}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
              <span className="font-medium">{court.rating}</span>
              <span className="text-sm text-muted-foreground ml-1">
                ({court.reviewCount})
              </span>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              {court.availability}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {court.amenities.slice(0, 3).map((amenity) => {
              const Icon = amenityIcons[amenity] || Users;
              return (
                <div
                  key={amenity}
                  className="flex items-center text-xs text-muted-foreground"
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {amenity}
                </div>
              );
            })}
            {court.amenities.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{court.amenities.length - 3} more
              </span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <div className="flex w-full space-x-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              goToDetails();
            }}
            aria-label="View Details"
          >
            View Details
          </Button>
          <Button
            variant="tennis"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              goToDetails();
            }}
            aria-label="Book Now"
          >
            Book Now
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default CourtCard;
