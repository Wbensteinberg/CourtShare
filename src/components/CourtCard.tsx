import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Star } from "lucide-react";
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

      <CardContent className="px-7 py-7 bg-gradient-to-b from-white via-white to-emerald-50/30 text-black">
        <h3 className="mb-3 font-extrabold text-2xl text-gray-900 group-hover:text-emerald-600 transition-colors duration-300 cursor-pointer tracking-tight leading-tight">
          {court.name}
        </h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
          <div className="flex min-w-0 items-center">
            <MapPin className="mr-1.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span className="truncate font-medium">{court.location}</span>
          </div>
          <div className="flex items-center">
            <Star className="mr-1 h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold text-gray-900">{court.rating}</span>
            <span className="ml-1 text-gray-500">({court.reviewCount})</span>
          </div>
          {court.distance && (
            <span className="rounded-full border border-emerald-200/50 bg-gradient-to-r from-emerald-100 to-teal-100 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
              {court.distance.toFixed(1)} mi
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CourtCard;
