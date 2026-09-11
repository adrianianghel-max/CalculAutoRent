import "@/App.css";
import RentCalculator from "@/pages/RentCalculator";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App">
      <RentCalculator />
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
