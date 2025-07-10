import { Button } from "@/components/ui/button";
import { ArrowRight, Play, MapPin, Calendar, Trophy } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-hero text-white">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full bg-repeat" style={{backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "30px 30px"}}></div>
      </div>
      
      <div className="relative container py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium border border-white/20">
            <Trophy className="h-4 w-4 mr-2" />
            Premium Tennis Court Booking Platform
          </div>

          {/* Headlines */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              Book Your Perfect
              <span className="block text-tennis-yellow">Tennis Court</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed">
              Discover and book premium tennis courts in your area. From clay to hard courts, 
              indoor to outdoor - find your ideal playing experience.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold">1,200+</div>
              <div className="text-sm text-white/80">Courts Available</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold">50k+</div>
              <div className="text-sm text-white/80">Happy Players</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold">4.9★</div>
              <div className="text-sm text-white/80">Average Rating</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button variant="secondary" size="xl" className="group shadow-elegant">
              <MapPin className="h-5 w-5 mr-2" />
              Find Courts Near Me
              <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="xl" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
              <Play className="h-5 w-5 mr-2" />
              Watch Demo
            </Button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 max-w-3xl mx-auto">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="font-semibold">Instant Booking</h3>
              <p className="text-sm text-white/80">Book courts instantly with real-time availability</p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto">
                <Trophy className="h-6 w-6" />
              </div>
              <h3 className="font-semibold">Premium Courts</h3>
              <p className="text-sm text-white/80">Access to the finest tennis facilities</p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="font-semibold">Nationwide</h3>
              <p className="text-sm text-white/80">Courts available across the country</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" className="w-full h-12 md:h-20">
          <path 
            fill="hsl(var(--background))" 
            d="M0,80 C480,120 960,40 1440,80 L1440,120 L0,120 Z"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;