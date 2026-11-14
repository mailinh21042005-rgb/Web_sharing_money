import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import MyGroups from "./pages/MyGroups";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from './pages/ForgotPassword';
import Minigames from "./pages/Minigames";
import ScanBill from "./pages/ScanBill";
import BackButton from "./components/BackButton";
import Notifications from "./pages/Notifications";
import Friends from "./pages/Friends";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[var(--background)] text-[var(--text)] transition-colors duration-300">
        <Navbar />
        <BackButton />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/groups" element={<MyGroups />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/minigames" element={<Minigames />} />
            <Route path="/scan-bill" element={<ScanBill />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/friends" element={<Friends />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;