import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/session";
import AppShell from "@/components/app-shell";
import AuditLog from "@/pages/AuditLog";
import Dashboard from "@/pages/Dashboard";
import ExportPage from "@/pages/ExportPage";
import ImportPage from "@/pages/ImportPage";
import Items from "@/pages/Items";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import RecalcStock from "@/pages/RecalcStock";
import Reports from "@/pages/Reports";
import SchoolProfilePage from "@/pages/SchoolProfilePage";
import Settings from "@/pages/Settings";
import StockCard from "@/pages/StockCard";
import StockOpname from "@/pages/StockOpname";
import Transactions from "@/pages/Transactions";
import Users from "@/pages/Users";

// Proteksi halaman: tanpa sesi login, arahkan ke /login.
function RequireAuth() {
  const { data: user, isLoading, isError } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-50">
        <div className="text-sm text-muted-foreground">Memuat aplikasi…</div>
      </div>
    );
  }
  if (isError || !user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Halaman khusus Administrator.
function RequireAdmin() {
  const { data: user } = useAuth();
  if (user && user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/barang" element={<Items />} />
            <Route path="/barang/persediaan" element={<Items jenis="persediaan" />} />
            <Route path="/barang/inventaris" element={<Items jenis="inventaris" />} />
            <Route path="/barang-masuk" element={<Transactions jenis="masuk" />} />
            <Route path="/barang-keluar" element={<Transactions jenis="keluar" />} />
            <Route path="/kartu-stok" element={<StockCard />} />
            <Route path="/stok-opname" element={<StockOpname />} />
            <Route path="/laporan" element={<Reports />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/profil-sekolah" element={<SchoolProfilePage />} />
            <Route path="/profil" element={<Profile />} />
            <Route path="/pengaturan" element={<Settings />} />
            <Route element={<RequireAdmin />}>
              <Route path="/pengguna" element={<Users />} />
              <Route path="/riwayat" element={<AuditLog />} />
              <Route path="/hitung-ulang-stok" element={<RecalcStock />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
      <Toaster richColors />
    </>
  );
}
