"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, isMockMode } from "@/lib/firebase";
import { getMockCourts } from "@/lib/mockData";
import { calculateDistance, type Coordinates } from "@/lib/geolocation";

export interface CourtListing {
  id: string;
  name: string;
  location: string;
  price: number;
  description: string;
  imageUrl: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  rating?: number;
  reviewCount?: number;
}

export function useCourtListings(authLoading = false) {
  const [courts, setCourts] = useState<CourtListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCourts = async () => {
      setLoading(true);
      setError("");
      try {
        const courtsData: CourtListing[] = isMockMode
          ? (getMockCourts() as CourtListing[])
          : ((await getDocs(collection(db, "courts"))).docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as CourtListing[]);
        setCourts(courtsData);
      } catch (err) {
        console.error("Error fetching courts:", err);
        setError("Failed to fetch courts. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchCourts();
    }
  }, [authLoading]);

  return { courts, loading, error };
}

export function filterCourtListings(
  courts: CourtListing[],
  userCoords: Coordinates | null,
  maxDistance: number | null
) {
  if (!userCoords || !maxDistance) {
    return courts;
  }

  return courts
    .map((court) => {
      if (!court.latitude || !court.longitude) {
        return court;
      }

      return {
        ...court,
        distance: calculateDistance(userCoords, {
          latitude: court.latitude,
          longitude: court.longitude,
        }),
      };
    })
    .filter((court) => court.distance !== undefined && court.distance <= maxDistance)
    .sort((a, b) => (a.distance || 0) - (b.distance || 0));
}

export function useFilteredCourtListings(
  courts: CourtListing[],
  userCoords: Coordinates | null,
  maxDistance: number | null
) {
  return useMemo(
    () => filterCourtListings(courts, userCoords, maxDistance),
    [courts, userCoords, maxDistance]
  );
}

export function toCourtCardModel(court: CourtListing) {
  return {
    id: court.id,
    name: court.name,
    location: court.location,
    price: court.price,
    rating: court.rating,
    reviewCount: court.reviewCount || 0,
    image: court.imageUrl || "https://placehold.co/400x300?text=Tennis+Court",
    surface: "Hard Court",
    indoor: false,
    amenities: ["Parking", "WiFi"],
    availability: "Available",
    distance: court.distance,
  };
}
