export default function CancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-tennis relative overflow-hidden px-4">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float"></div>
        <div
          className="absolute bottom-20 right-20 w-80 h-80 bg-red-300/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 mx-auto text-center relative z-10 border border-white/30">
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-xl">
          <span className="text-5xl">❌</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black mb-4 text-gray-900 tracking-tight">
          Payment Canceled
        </h1>
        <p className="text-gray-600 text-lg font-medium leading-relaxed">
          Your booking was not completed. You can try again anytime.
        </p>
      </div>
    </div>
  );
}
