"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit3, Trash2, Calendar, User, Clock, MapPin } from "lucide-react";
import AppHeader from "@/components/AppHeader";

interface Court {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
  surface?: string;
  indoor?: boolean;
}

interface Booking {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
}

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const [deletingCourtId, setDeletingCourtId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError("");
    const fetchData = async () => {
      try {
        // Fetch courts owned by this user (assuming you store ownerId on court)
        const courtsSnap = await getDocs(
          query(collection(db, "courts"), where("ownerId", "==", user.uid))
        );
        const courtsData: Court[] = courtsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Court[];
        setCourts(courtsData);
        // Fetch bookings for these courts
        const courtIds = courtsData.map((c) => c.id);
        let bookingsData: Booking[] = [];
        if (courtIds.length > 0) {
          const bookingsSnap = await getDocs(
            query(collection(db, "bookings"), where("courtId", "in", courtIds))
          );
          bookingsData = bookingsSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Booking[];
        }
        setBookings(bookingsData);
      } catch (err: any) {
        setError(err.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleDelete = async (courtId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this court? This cannot be undone."
      )
    )
      return;
    setDeletingCourtId(courtId);
    try {
      await deleteDoc(doc(db, "courts", courtId));
      setCourts((prev) => prev.filter((c) => c.id !== courtId));
    } catch (err: any) {
      alert(err.message || "Failed to delete court");
    } finally {
      setDeletingCourtId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "confirmed":
        return <Badge className="bg-green-600 text-white">Confirmed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading courts and bookings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      
      {/* Header */}
      <div className="bg-white shadow-card border-b">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push("/courts")}
                className="flex items-center text-muted-foreground hover:text-primary transition-colors hover:cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Browse
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8">
        {/* Title Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Owner Dashboard
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Welcome! Here are your courts and bookings.
          </p>
        </div>

        {/* Add New Court Button */}
        <div className="flex justify-center mb-8">
          <Button 
            onClick={() => router.push("/create-listing")}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:cursor-pointer"
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add New Court
          </Button>
        </div>

        {/* Courts Section */}
        {courts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">You have no courts listed yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {courts.map((court) => (
              <Card key={court.id} className="overflow-hidden hover:shadow-elegant transition-all duration-300">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden">
                        {court.imageUrl ? (
                          <Image
                            src={court.imageUrl}
                            alt={court.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <span className="text-4xl">🎾</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-green-600 opacity-10"></div>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-foreground">{court.name}</h3>
                        <div className="flex items-center text-muted-foreground mt-1">
                          <MapPin className="h-4 w-4 mr-1" />
                          {court.location}
                        </div>
                        {court.surface && (
                          <Badge variant="outline" className="mt-2">
                            {court.surface}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 hover:cursor-pointer"
                        onClick={() => router.push(`/edit-listing/${court.id}`)}
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => handleDelete(court.id)}
                        disabled={deletingCourtId === court.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingCourtId === court.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Bookings Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <Calendar className="h-5 w-5 text-green-600" />
                      <h4 className="text-lg font-semibold text-foreground">Bookings</h4>
                      <Badge variant="outline" className="ml-auto">
                        {bookings.filter(b => b.courtId === court.id).length} total
                      </Badge>
                    </div>

                    {bookings.filter(b => b.courtId === court.id).length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-4">
                        No bookings for this court yet.
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {bookings
                          .filter(b => b.courtId === court.id)
                          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                          .map((booking) => (
                            <Card key={booking.id} className="bg-muted/30 border-border/50">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2 text-sm">
                                      <Calendar className="h-4 w-4 text-green-600" />
                                      <span className="font-medium">{booking.date}</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-sm">
                                      <Clock className="h-4 w-4 text-green-600" />
                                      <span>{booking.time} ({booking.duration}h)</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                      <User className="h-4 w-4" />
                                      <span className="font-mono text-xs">{booking.userId.slice(0, 12)}...</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-3">
                                    {getStatusBadge(booking.status)}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Card className="text-center p-6 hover:shadow-card transition-all duration-300">
            <div className="text-3xl font-bold text-green-600 mb-2">{courts.length}</div>
            <div className="text-muted-foreground">Active Courts</div>
          </Card>
          <Card className="text-center p-6 hover:shadow-card transition-all duration-300">
            <div className="text-3xl font-bold text-green-600 mb-2">{bookings.length}</div>
            <div className="text-muted-foreground">Total Bookings</div>
          </Card>
          <Card className="text-center p-6 hover:shadow-card transition-all duration-300">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {bookings.filter(b => b.status === 'pending').length}
            </div>
            <div className="text-muted-foreground">Pending Requests</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
