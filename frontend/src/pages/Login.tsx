import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  Boxes,
  Eye,
  EyeOff,
  FileSpreadsheet,
  School,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { errMsg } from "@/lib/format";
import { login, useAuth } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HERO_IMG =
  "https://images.unsplash.com/photo-1613896527026-f195d5c818ed?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwxfHxzY2hvb2wlMjBidWlsZGluZyUyMGNhbXB1c3xlbnwwfHx8fDE3OTA2NDUyOTl8MA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { data: me } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (me) return <Navigate to="/" replace />;

  const doLogin = async (u: string, p: string) => {
    setLoading(true);
    setError("");
    try {
      await login(u, p);
      navigate("/", { replace: true });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    doLogin(username.trim(), password);
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Panel kiri: brand institusi */}
      <div className="relative hidden overflow-hidden bg-[#064E3B] lg:flex lg:flex-col">
        <img src={HERO_IMG} alt="Gedung sekolah" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(15, 23, 42, 0.92) 100%)" }}
        />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600">
              <School className="h-6 w-6" />
            </div>
            <div>
              <div className="font-heading text-lg font-bold tracking-tight">SIMBARA SEKOLAH</div>
              <div className="text-xs text-emerald-200">Sistem Informasi Manajemen Barang Sekolah</div>
            </div>
          </div>
          <div className="max-w-md space-y-6">
            <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight">
              Kelola Inventaris &amp; Persediaan Sekolah dengan Rapi
            </h1>
            <p className="text-sm leading-relaxed text-emerald-100/90">
              Catat barang masuk dan keluar, pantau stok otomatis, lakukan stok opname, dan cetak laporan resmi —
              semua dalam satu aplikasi.
            </p>
            <ul className="space-y-3 text-sm text-emerald-50">
              <li className="flex items-center gap-2.5">
                <Boxes className="h-4 w-4 shrink-0 text-emerald-300" /> Data barang, stok otomatis &amp; kartu stok
              </li>
              <li className="flex items-center gap-2.5">
                <ArrowDownToLine className="h-4 w-4 shrink-0 text-emerald-300" /> Barang masuk &amp; keluar tervalidasi
              </li>
              <li className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-300" /> Import/Export Excel &amp; laporan siap cetak
              </li>
              <li className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" /> Hak akses Administrator &amp; Pengurus Barang
              </li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className="border-0 bg-emerald-700/60 text-emerald-50">Stok Otomatis</Badge>
            <Badge className="border-0 bg-emerald-700/60 text-emerald-50">Audit Trail</Badge>
            <Badge className="border-0 bg-emerald-700/60 text-emerald-50">Laporan Resmi</Badge>
          </div>
        </div>
      </div>

      {/* Panel kanan: form login */}
      <div className="flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700">
              <School className="h-6 w-6 text-white" />
            </div>
            <div className="font-heading text-lg font-bold text-slate-900">SIMBARA SEKOLAH</div>
            <div className="text-xs text-muted-foreground">Sistem Informasi Manajemen Barang Sekolah</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 hidden text-center lg:block">
              <h2 className="font-heading text-xl font-bold text-slate-900">Selamat Datang</h2>
              <p className="mt-1 text-sm text-muted-foreground">Masuk untuk mengelola barang sekolah</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
              <div>
                <Label htmlFor="login-username">Username / Email</Label>
                <Input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="cth. admin"
                  autoComplete="username"
                  data-testid="login-username-input"
                />
              </div>
              <div>
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pr-10"
                    data-testid="login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-2 top-2.5 text-muted-foreground transition-colors hover:text-slate-700"
                    data-testid="login-password-toggle"
                    aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700" data-testid="login-error">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !username.trim() || !password}
                data-testid="login-submit-button"
              >
                {loading ? "Memproses…" : "Masuk"}
              </Button>
            </form>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Akun Demo</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start"
                disabled={loading}
                onClick={() => doLogin("admin", "admin123")}
                data-testid="demo-login-admin"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Masuk sebagai Administrator
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                disabled={loading}
                onClick={() => doLogin("pengurus", "pengurus123")}
                data-testid="demo-login-pengurus"
              >
                <UserRound className="h-4 w-4 text-sky-600" /> Masuk sebagai Pengurus Barang
              </Button>
            </div>
            <p className="mt-4 text-center text-[11px] text-muted-foreground">admin / admin123 · pengurus / pengurus123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
