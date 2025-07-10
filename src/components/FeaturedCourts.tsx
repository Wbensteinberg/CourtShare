import CourtCard from "./CourtCard";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const FeaturedCourts = () => {
  // Sample court data - in a real app, this would come from an API
  const featuredCourts = [
    {
      id: "1",
      name: "Wimbledon Sports Club",
      location: "Manhattan, NYC",
      price: 85,
      rating: 4.9,
      reviewCount: 127,
      image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80",
      surface: "Grass",
      indoor: false,
      amenities: ["Parking", "Changing Rooms", "WiFi"],
      availability: "Available Today"
    },
    {
      id: "2", 
      name: "Elite Tennis Center",
      location: "Brooklyn, NYC",
      price: 65,
      rating: 4.8,
      reviewCount: 89,
      image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=800&q=80",
      surface: "Hard Court",
      indoor: true,
      amenities: ["Parking", "WiFi", "Pro Shop"],
      availability: "2 slots left"
    },
    {
      id: "3",
      name: "Clay Court Paradise",
      location: "Queens, NYC", 
      price: 75,
      rating: 4.7,
      reviewCount: 156,
      image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=800&q=80",
      surface: "Clay",
      indoor: false,
      amenities: ["Changing Rooms", "Parking", "Restaurant"],
      availability: "Available Tomorrow"
    },
    {
      id: "4",
      name: "Premier Indoor Courts",
      location: "Bronx, NYC",
      price: 55,
      rating: 4.6,
      reviewCount: 203,
      image: "https://images.unsplash.com/photo-1617083278877-95e05a2f785b?auto=format&fit=crop&w=800&q=80",
      surface: "Hard Court",
      indoor: true,
      amenities: ["WiFi", "Parking", "Changing Rooms"],
      availability: "Available Now"
    }
  ];

  return (
    <section className="py-16 bg-gradient-subtle">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Featured Tennis Courts
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover the most popular and highly-rated tennis courts in your area. 
            Book your next game at these premium facilities.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {featuredCourts.map((court) => (
            <CourtCard key={court.id} court={court} />
          ))}
        </div>

        <div className="text-center">
          <Button variant="tennis" size="lg" className="group">
            View All Courts
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedCourts;