import { Button } from "@/components/ui/button";
import { ArrowRight, Play, MapPin, Calendar, Trophy } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden w-full bg-gradient-tennis text-white">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 opacity-20 animate-pulse"></div>

      {/* Geometric shapes for visual interest - more refined */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-gradient-to-br from-white/8 to-emerald-300/5 rounded-full blur-3xl animate-float"></div>
        <div
          className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-gradient-to-br from-cyan-400/8 to-teal-300/5 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-br from-emerald-400/6 to-cyan-300/4 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "4s" }}
        ></div>
        {/* Additional subtle shapes */}
        <div
          className="absolute top-40 right-1/4 w-64 h-64 bg-white/3 rounded-full blur-2xl animate-float"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute bottom-40 left-1/4 w-72 h-72 bg-teal-300/4 rounded-full blur-2xl animate-float"
          style={{ animationDelay: "3s" }}
        ></div>
      </div>

      <div className="relative w-full flex flex-col items-center py-20 md:py-28 lg:py-36 px-4 z-10">
        <div className="max-w-6xl w-full mx-auto text-center space-y-10 md:space-y-12 animate-fade-in-up">
          {/* Headlines - more refined typography */}
          <div className="space-y-8">
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-white drop-shadow-2xl leading-[1.1]">
              <span className="block bg-gradient-to-r from-white via-emerald-50 to-cyan-50 bg-clip-text text-transparent pb-2">
                Book Your Perfect
              </span>
              <span className="block bg-gradient-to-r from-yellow-300 via-yellow-200 to-amber-200 bg-clip-text text-transparent mt-3 drop-shadow-2xl">
                Tennis Court
              </span>
            </h1>
            <p className="text-base md:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed px-4 mt-2">
              Discover and book tennis courts near you. Browse availability,
              pick your time, and book instantly — all in one place.
            </p>
          </div>

          {/* Stats - commented out for now */}
          {/* <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-md mx-auto px-4">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-white">
                1,200+
              </div>
              <div className="text-sm text-white/80">Courts Available</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-white">
                50k+
              </div>
              <div className="text-sm text-white/80">Happy Players</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-white">
                4.9★
              </div>
              <div className="text-sm text-white/80">Average Rating</div>
            </div>
          </div> */}

          {/* CTA Buttons - commented out for now */}
          {/* <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 px-4">
            <Button
              variant="secondary"
              size="xl"
              className="group shadow-elegant bg-white text-green-700 hover:bg-gray-100 border border-white"
            >
              <MapPin className="h-5 w-5 mr-2" />
              Find Courts Near Me
              <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="xl"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Play className="h-5 w-5 mr-2" />
              Watch Demo
            </Button>
          </div> */}

          {/* Features - more refined */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 pt-16 md:pt-20 max-w-5xl mx-auto px-4">
            <div className="text-center space-y-5 group cursor-pointer transform transition-all duration-500 hover:scale-105">
              <div className="w-20 h-20 rounded-3xl glass-dark flex items-center justify-center mx-auto shadow-glow transition-all duration-500 group-hover:scale-110 group-hover:shadow-glow-hover group-hover:bg-white/25 group-hover:rotate-3">
                <Calendar className="h-10 w-10 text-white group-hover:text-yellow-300 transition-all duration-300 drop-shadow-lg" />
              </div>
              <h3 className="font-bold text-xl text-white group-hover:text-yellow-300 transition-colors duration-300 tracking-tight">
                Find a Court Whenever You Need
              </h3>
              <p className="text-sm text-white/85 leading-relaxed max-w-xs mx-auto -mt-2">
                Book courts instantly with real-time availability and instant
                confirmations
              </p>
            </div>
            <div className="text-center space-y-5 group cursor-pointer transform transition-all duration-500 hover:scale-105">
              <div className="w-20 h-20 rounded-3xl glass-dark flex items-center justify-center mx-auto shadow-glow transition-all duration-500 group-hover:scale-110 group-hover:shadow-glow-hover group-hover:bg-white/25 group-hover:rotate-3">
                <MapPin className="h-10 w-10 text-white group-hover:text-yellow-300 transition-all duration-300 drop-shadow-lg" />
              </div>
              <h3 className="font-bold text-xl text-white group-hover:text-yellow-300 transition-colors duration-300 tracking-tight">
                Find a Court Close to You
              </h3>
              <p className="text-sm text-white/85 leading-relaxed max-w-xs mx-auto -mt-2">
                Wherever you are, discover courts nearby that fit your schedule
                and preferences
              </p>
            </div>
            <div className="text-center space-y-5 group cursor-pointer transform transition-all duration-500 hover:scale-105">
              <div className="w-20 h-20 rounded-3xl glass-dark flex items-center justify-center mx-auto shadow-glow transition-all duration-500 group-hover:scale-110 group-hover:shadow-glow-hover group-hover:bg-white/25 group-hover:rotate-3">
                <Trophy className="h-10 w-10 text-white group-hover:text-yellow-300 transition-all duration-300 drop-shadow-lg" />
              </div>
              <h3 className="font-bold text-xl text-white group-hover:text-yellow-300 transition-colors duration-300 tracking-tight">
                All Courts in One Place
              </h3>
              <p className="text-sm text-white/85 leading-relaxed max-w-xs mx-auto -mt-2">
                Choose from all courts in your area on one centralized booking
                platform to get the best options
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave - smoother and more modern */}
      <div className="absolute left-0 bottom-[-1px] w-full z-10">
        <svg
          viewBox="0 0 1440 120"
          className="w-full h-24 md:h-32"
          preserveAspectRatio="none"
        >
          <path
            fill="#ffffff"
            d="M0,96L48,90.7C96,85,192,75,288,70C384,65,480,65,576,70C672,75,768,85,864,90C960,95,1056,95,1152,90C1248,85,1344,75,1392,70L1440,65L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
            className="animate-pulse"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
