"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Calendar as CalendarIcon, Clock, Trophy } from "lucide-react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import AppHeader from "@/components/AppHeader";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface CourtFormData {
  courtName: string;
  location: string;
  fullAddress: string;
  accessInstructions: string;
  pricePerHour: string;
  description: string;
  latitude: string;
  longitude: string;
}

const CreateListing = () => {
  const [date, setDate] = useState<Date | null>(null);
  const [blockTimeDate, setBlockTimeDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CourtFormData>({
    defaultValues: {
      courtName: "",
      location: "",
      fullAddress: "",
      accessInstructions: "",
      pricePerHour: "",
      description: "",
      latitude: "",
      longitude: "",
    },
  });

  const onSubmit = (data: CourtFormData) => {
    console.log("Form submitted:", data);
    console.log("Selected files:", selectedFiles);
    // This is where the backend logic will be connected
  };

  const handleBlockDay = () => {
    if (date) {
      console.log("Blocking day:", format(date, "PPP"));
      // Backend logic will be connected here
    }
  };

  const handleBlockTime = () => {
    if (blockTimeDate && selectedTime) {
      console.log(
        "Blocking time:",
        format(blockTimeDate, "PPP"),
        "at",
        selectedTime
      );
      // Backend logic will be connected here
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const timeSlots = [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
      <AppHeader />

      {/* Hero Section with Background - Modernized */}
      <section className="relative py-24 bg-gradient-tennis overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float"></div>
          <div
            className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-300/10 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center text-white">
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 rounded-3xl glass-dark flex items-center justify-center shadow-glow">
                <Trophy className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
              Create Court Listing
            </h1>
            <p className="text-xl md:text-2xl text-white/95 max-w-2xl mx-auto font-medium">
              Fill in your court details below to start accepting bookings
            </p>
          </div>
        </div>
      </section>

      {/* Main Content - Modernized */}
      <section className="py-12 -mt-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-elegant border-0 rounded-3xl glass backdrop-blur-xl mt-8">
              <CardHeader className="space-y-2 pb-10 pt-10">
                <CardTitle className="text-3xl md:text-4xl font-black text-center tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Court Details
                </CardTitle>
                <CardDescription className="text-center text-gray-600 font-medium text-lg">
                  Please provide accurate information about your tennis court
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-8">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    {/* Basic Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="courtName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">
                              Court Name
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter court name"
                                className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">
                              Location
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="City, State"
                                className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="fullAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <AddressAutocomplete
                              value={field.value}
                              onChange={(address, coordinates) => {
                                field.onChange(address);
                                // Auto-populate coordinates if available
                                if (coordinates) {
                                  form.setValue(
                                    "latitude",
                                    coordinates.latitude.toString()
                                  );
                                  form.setValue(
                                    "longitude",
                                    coordinates.longitude.toString()
                                  );
                                }
                              }}
                              placeholder="Complete street address"
                              className="h-12 border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20 transition-all duration-200"
                              label="Full Address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="accessInstructions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">
                            Access Instructions
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Gate code, building access, parking info..."
                              className="min-h-[100px] border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20 transition-all duration-200 resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="pricePerHour"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">
                              Price per Hour (USD)
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="25.00"
                                type="number"
                                step="0.01"
                                className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">
                            Description
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your court's features, amenities, surface type..."
                              className="min-h-[120px] border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20 transition-all duration-200 resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Location Coordinates */}
                    <div className="space-y-4">
                      <FormLabel className="text-sm font-semibold">
                        Location Coordinates (Optional)
                      </FormLabel>
                      <p className="text-sm text-gray-600">
                        Add precise coordinates to enable distance-based search.
                        You can find these on Google Maps.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="latitude"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold">
                                Latitude
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="34.0522"
                                  type="number"
                                  step="any"
                                  className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="longitude"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold">
                                Longitude
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="-118.2437"
            type="number"
                                  step="any"
                                  className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Image Upload Section */}
                    <div className="space-y-4">
                      <FormLabel className="text-sm font-semibold">
                        Upload Images
                      </FormLabel>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500/50 transition-colors">
                        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <div className="space-y-2">
          <input
                            ref={fileInputRef}
            type="file"
                            multiple
            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="border-green-500/20 hover:bg-green-50 text-green-700 hover:border-green-500 cursor-pointer"
                            onClick={triggerFileInput}
                          >
                            Choose Files
                          </Button>
                          <p className="text-sm text-gray-500">
                            {selectedFiles.length === 0
                              ? "No file chosen"
                              : `${selectedFiles.length} file(s) selected`}
                          </p>
                        </div>
                      </div>

                      {/* Display selected files */}
                      {selectedFiles.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-700">
                            Selected Images:
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={`Preview ${index + 1}`}
                                  className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  ×
                                </button>
                                <p className="text-xs text-gray-600 mt-1 truncate">
                                  {file.name}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Simple Div Separator instead of Separator component */}
                    <div className="my-8 border-t border-gray-200"></div>

                    {/* Availability Management */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          Availability Management
                        </h3>
                        <p className="text-sm text-gray-600">
                          Manage when your court is available for booking
                        </p>
                      </div>

                      {/* Block Entire Days */}
                      <Card className="border-gray-200">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            Block Entire Days
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-col sm:flex-row gap-4 items-end">
                            <div className="flex-1">
                              <FormLabel className="text-sm">
                                Select Date
                              </FormLabel>
                              <ReactDatePicker
                                selected={date}
                                onChange={(date) => setDate(date)}
                                dateFormat="MM/dd/yyyy"
                                placeholderText="Select date"
                                minDate={new Date()}
                                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent h-12"
                              />
                            </div>
                            <Button
                              type="button"
                              onClick={handleBlockDay}
                              className="h-12 px-6 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 transition-all duration-300 text-white shadow-lg hover:shadow-xl"
                              disabled={!date}
                            >
                              Block Day
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Block Specific Times */}
                      <Card className="border-gray-200">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Block Specific Times
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-col lg:flex-row gap-4 items-end">
                            <div className="flex-1">
                              <FormLabel className="text-sm">
                                Select Date
                              </FormLabel>
                              <ReactDatePicker
                                selected={blockTimeDate}
                                onChange={(date) => setBlockTimeDate(date)}
                                dateFormat="MM/dd/yyyy"
                                placeholderText="Select date"
                                minDate={new Date()}
                                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent h-12"
                              />
                            </div>
                            <div className="flex-1">
                              <FormLabel className="text-sm">
                                Select Time
                              </FormLabel>
                              <Select
                                value={selectedTime}
                                onValueChange={setSelectedTime}
                              >
                                <SelectTrigger className="h-12 mt-2 border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20">
                                  <SelectValue placeholder="Select time" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-lg">
                                  {timeSlots.map((time) => (
                                    <SelectItem
                                      key={time}
                                      value={time}
                                      className="hover:bg-green-50 hover:text-green-700 cursor-pointer transition-colors duration-150 focus:bg-green-100 focus:text-green-800"
                                    >
                                      {time}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              onClick={handleBlockTime}
                              className="h-12 px-6 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 transition-all duration-300 text-white shadow-lg hover:shadow-xl"
                              disabled={!blockTimeDate || !selectedTime}
                            >
                              Block Time
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-6">
                      <Button
            type="submit"
                        className="w-full h-14 text-lg font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white shadow-xl hover:shadow-glow-hover transition-all duration-300 rounded-2xl transform hover:scale-[1.02]"
                      >
                        Create Listing
                      </Button>
                    </div>
        </form>
                </Form>
              </CardContent>
            </Card>
          </div>
      </div>
      </section>
      
      {/* Dark Gray Footer Section - Same as /courts page */}
      <div className="w-full bg-slate-900 py-16 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-400 text-sm">
            © 2025 CourtShare. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreateListing;
