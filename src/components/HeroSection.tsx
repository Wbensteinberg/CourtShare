const HeroSection = () => {
  return (
    <section className="relative overflow-hidden w-full min-h-[760px] text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/CourtShareHome.mov" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,18,28,0.22)_0%,rgba(7,18,28,0.38)_28%,rgba(7,18,28,0.68)_100%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(27,37,52,0.38),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_center,rgba(27,37,52,0.5),transparent_42%)]"></div>

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-24 left-10 h-80 w-80 rounded-full bg-white/8 blur-3xl"></div>
        <div
          className="absolute right-0 top-32 h-[28rem] w-[28rem] rounded-full bg-emerald-300/12 blur-3xl"
        ></div>
      </div>

      <div className="relative z-10 flex w-full flex-col items-center px-4 pb-24 pt-40 md:pt-48">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center animate-fade-in-up">
          <div className="max-w-5xl space-y-6 text-center">
            <h1 className="text-center text-3xl font-black leading-[0.95] tracking-[-0.05em] text-white drop-shadow-2xl sm:text-6xl md:text-[5.5rem] lg:text-[5.9rem]">
              Play on your dream
              <span className="block text-emerald-50">tennis court.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-center text-base font-medium leading-7 text-white/82 sm:text-lg">
              Find and reserve private tennis courts near you in just a few seconds!
            </p>
          </div>
        </div>
      </div>

      <div className="absolute left-0 bottom-[-1px] w-full z-10">
        <svg
          viewBox="0 0 1440 120"
          className="h-18 w-full md:h-24"
          preserveAspectRatio="none"
        >
          <path
            fill="#ffffff"
            d="M0,64C105,88,238,108,357,106C471,104,610,79,720,78C838,78,943,106,1054,111C1167,116,1285,97,1440,58V120H0Z"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
