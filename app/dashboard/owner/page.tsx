import React from "react";

export default function OwnerDashboard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-300 via-lime-200 to-green-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col items-center gap-6 animate-fade-in">
        <h1 className="text-3xl font-extrabold text-green-800 mb-2">
          Owner Dashboard
        </h1>
        <p className="text-gray-600 text-center mb-2">
          Welcome Owner! (Dashboard placeholder)
        </p>
      </div>
    </div>
  );
}
