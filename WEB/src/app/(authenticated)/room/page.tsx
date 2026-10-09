import CreateRoomCard from "@/components/room/CreateRoomCard";

/** A whiteboard's dot grid, behind everything. */
const DOT_GRID = {
  backgroundImage:
    "radial-gradient(circle, rgb(148 163 184 / 0.35) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
};

const HIGHLIGHT = {
  backgroundImage: "linear-gradient(to right, #4f46e5, #d946ef, #f59e0b)",
};

export default function page() {
  return (
    <main
      className="relative flex min-h-full items-center justify-center overflow-hidden px-6 py-16"
      style={DOT_GRID}
    >
      {/* Soft washes of colour, like paint bleeding into paper. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-300/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-pink-300/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-200/40 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
            aria-hidden
          />
          A whiteboard for thinking out loud, together
        </span>

        <h1 className="sr-only">CWA, a collaborative whiteboard</h1>
        <figure>
          <blockquote>
            <p className="text-balance text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-6xl">
              “
              <span className="relative inline-block">
                <span
                  className="bg-clip-text text-transparent"
                  style={HIGHLIGHT}
                >
                  Imagination
                </span>
                {/* A hand-drawn underline. */}
                <svg
                  aria-hidden
                  viewBox="0 0 300 20"
                  preserveAspectRatio="none"
                  className="absolute -bottom-2 left-0 h-3 w-full text-fuchsia-400"
                >
                  <path
                    d="M2 14 C 60 4, 120 18, 180 8 S 270 6, 298 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              is more important than knowledge.”
            </p>
          </blockquote>
          <figcaption className="mt-5 text-base font-medium text-slate-500">
            — Albert Einstein
          </figcaption>
        </figure>

        <p className="mt-8 max-w-xl text-lg text-slate-600">
          Open a blank board, share the link, and sketch ideas with anyone in
          real time.
        </p>

        <div className="mt-10">
          <CreateRoomCard />
        </div>
      </div>
    </main>
  );
}
