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
    distance?: number;
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
      className="group overflow-hidden border-0 shadow-elegant rounded-3xl hover:shadow-glow-hover transition-all duration-700 hover:-translate-y-3 cursor-pointer bg-white text-black transform hover:scale-[1.015]"
      onClick={goToDetails}
      aria-label={`View details for ${court.name}`}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") goToDetails();
      }}
    >
      <div className="relative overflow-hidden rounded-t-3xl h-72">
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-teal-500/0 group-hover:from-emerald-500/10 group-hover:to-teal-500/10 transition-all duration-700 z-10"></div>
        <img
          src={court.image}
          alt={court.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out rounded-t-3xl"
        />
        <div className="absolute top-5 right-5 z-20 transform group-hover:scale-110 transition-transform duration-300">
          <span className="inline-block glass px-5 py-2.5 text-emerald-700 text-sm font-extrabold rounded-2xl shadow-xl backdrop-blur-md border border-white/40 tracking-tight">
            ${court.price}
            <span className="text-xs font-semibold">/hr</span>
          </span>
        </div>
      </div>

      <CardContent className="py-7 px-7 bg-gradient-to-b from-white via-white to-emerald-50/30 text-black">
        <div className="space-y-5">
          <div>
            <h3 className="font-extrabold text-2xl text-gray-900 group-hover:text-emerald-600 transition-colors duration-300 cursor-pointer mb-3 tracking-tight leading-tight">
              {court.name}
            </h3>
            <div className="flex items-center flex-wrap gap-2 text-sm text-gray-600">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1.5 text-emerald-600" />
                <span className="font-medium">{court.location}</span>
              </div>
              {court.distance && (
                <span className="px-3 py-1 bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 font-bold rounded-full text-xs border border-emerald-200/50 shadow-sm">
                  {court.distance.toFixed(1)} mi
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
              <span className="font-medium">{court.rating}</span>
              <span className="text-sm text-gray-500 ml-1">
                ({court.reviewCount})
              </span>
            </div>
            <div className="flex items-center text-sm text-gray-500">
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
                  className="flex items-center text-xs text-gray-400"
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {amenity}
                </div>
              );
            })}
            {court.amenities.length > 3 && (
              <span className="text-xs text-gray-400">
                +{court.amenities.length - 3} more
              </span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="px-7 pb-7 pt-5 bg-white rounded-b-3xl">
        <div className="flex w-full gap-3">
          <Button
            variant="outline"
            className="w-full h-13 cursor-pointer text-base font-extrabold border-2 border-gray-200 hover:border-emerald-500 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 hover:text-emerald-700 transition-all duration-300 rounded-2xl shadow-sm hover:shadow-md"
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
            className="w-full h-13 cursor-pointer text-base font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white shadow-xl hover:shadow-glow-hover transition-all duration-300 rounded-2xl transform hover:scale-[1.02] relative overflow-hidden group"
            onClick={(e) => {
              e.stopPropagation();
              goToDetails();
            }}
            aria-label="Book Now"
          >
            <span className="relative z-10">Book Now</span>
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default CourtCard;
