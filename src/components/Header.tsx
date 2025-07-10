import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-primary">CourtBooker</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#" className="text-sm font-medium hover:text-primary transition-colors">
            Find Courts
          </a>
          <a href="#" className="text-sm font-medium hover:text-primary transition-colors">
            List Your Court
          </a>
          <a href="#" className="text-sm font-medium hover:text-primary transition-colors">
            How It Works
          </a>
          <a href="#" className="text-sm font-medium hover:text-primary transition-colors">
            About
          </a>
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="hidden md:flex items-center space-x-4">
          <Button variant="ghost" size="sm">
            Sign In
          </Button>
          <Button variant="tennis" size="sm">
            Sign Up
          </Button>
          <Button variant="outline" size="icon">
            <User className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      <div className={cn(
        "md:hidden border-t bg-background",
        isMenuOpen ? "block" : "hidden"
      )}>
        <div className="container py-4 space-y-4">
          <nav className="flex flex-col space-y-3">
            <a href="#" className="text-sm font-medium hover:text-primary transition-colors">
              Find Courts
            </a>
            <a href="#" className="text-sm font-medium hover:text-primary transition-colors">
              List Your Court
            </a>
            <a href="#" className="text-sm font-medium hover:text-primary transition-colors">
              How It Works
            </a>
            <a href="#" className="text-sm font-medium hover:text-primary transition-colors">
              About
            </a>
          </nav>
          <div className="flex flex-col space-y-2 pt-4 border-t">
            <Button variant="ghost" size="sm" className="justify-start">
              Sign In
            </Button>
            <Button variant="tennis" size="sm">
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;