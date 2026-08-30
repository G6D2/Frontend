import CitizenBottomNav from "../components/civic/CitizenBottomNav";

export default function CitizenLayout({ children }) {
  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col">
      {children}
      <CitizenBottomNav />
    </div>
  );
}
