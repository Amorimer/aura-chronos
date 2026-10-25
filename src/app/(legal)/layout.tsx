export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-6 py-12 text-[15px] leading-relaxed [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_a]:text-accent [&_a]:underline">
      {children}
    </main>
  );
}
