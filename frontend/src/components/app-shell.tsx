import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Building2,
  Calculator,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  School,
  Search,
  Settings,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { labelRole } from "@/lib/format";
import { endSession, useAuth, useSchoolProfile } from "@/lib/session";
import type { DashboardData, SchoolProfile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Package;
  testid: string;
  adminOnly?: boolean;
  exact?: boolean;
  children?: { to: string; label: string; testid: string }[];
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Utama",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard", exact: true }],
  },
  {
    group: "Inventaris & Stok",
    items: [
      {
        to: "/barang",
        label: "Data Barang",
        icon: Package,
        testid: "nav-barang",
        children: [
          { to: "/barang", label: "Semua Barang", testid: "nav-barang-semua" },
          { to: "/barang/persediaan", label: "Persediaan", testid: "nav-barang-persediaan" },
          { to: "/barang/inventaris", label: "Inventaris/Aset", testid: "nav-barang-inventaris" },
        ],
      },
      { to: "/barang-masuk", label: "Barang Masuk", icon: ArrowDownToLine, testid: "nav-barang-masuk" },
      { to: "/barang-keluar", label: "Barang Keluar", icon: ArrowUpFromLine, testid: "nav-barang-keluar" },
      { to: "/kartu-stok", label: "Kartu Stok", icon: ClipboardList, testid: "nav-kartu-stok" },
      { to: "/stok-opname", label: "Stok Opname", icon: ClipboardCheck, testid: "nav-stok-opname" },
      { to: "/hitung-ulang-stok", label: "Hitung Ulang Stok", icon: Calculator, testid: "nav-hitung-ulang-stok", adminOnly: true },
    ],
  },
  {
    group: "Data & Laporan",
    items: [
      { to: "/laporan", label: "Laporan", icon: FileSpreadsheet, testid: "nav-laporan" },
      { to: "/import", label: "Import Excel", icon: Upload, testid: "nav-import" },
      { to: "/export", label: "Export Excel", icon: Download, testid: "nav-export" },
    ],
  },
  {
    group: "Pengaturan Sekolah",
    items: [
      { to: "/profil-sekolah", label: "Profil Sekolah", icon: Building2, testid: "nav-profil-sekolah" },
      { to: "/pengguna", label: "Pengguna", icon: Users, testid: "nav-pengguna", adminOnly: true },
      { to: "/riwayat", label: "Riwayat Aktivitas", icon: History, testid: "nav-riwayat", adminOnly: true },
      { to: "/pengaturan", label: "Pengaturan", icon: Settings, testid: "nav-pengaturan" },
    ],
  },
];

function Brand({ profile }: { profile?: SchoolProfile }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4" data-testid="sidebar-brand">
      {profile?.logo ? (
        <img src={profile.logo} alt="Logo Sekolah" className="h-9 w-9 rounded bg-white object-contain p-0.5" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <School className="h-5 w-5 text-white" />
        </div>
      )}
      <div className="leading-tight">
        <div className="font-heading text-sm font-bold tracking-tight text-white">SIMBARA SEKOLAH</div>
        <div className="text-[10px] text-emerald-200/80">Manajemen Barang Sekolah</div>
      </div>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { data: user } = useAuth();
  const location = useLocation();
  const isActive = (item: NavItem) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-3" data-testid="sidebar-nav">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.adminOnly || user?.role === "admin");
        if (!items.length) return null;
        return (
          <div key={group.group} className="mb-3">
            <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200/60">
              {group.group}
            </div>
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <div key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    data-testid={item.testid}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors active:scale-[0.98] ${
                      active
                        ? "bg-sidebar-primary text-white shadow-sm"
                        : "text-emerald-50/85 hover:bg-sidebar-accent hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                  {item.children && active && (
                    <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
                      {item.children.map((c) => (
                        <Link
                          key={c.to}
                          to={c.to}
                          onClick={onNavigate}
                          data-testid={c.testid}
                          className={`rounded px-2 py-1 text-xs transition-colors ${
                            location.pathname === c.to
                              ? "bg-sidebar-primary/60 font-semibold text-white"
                              : "text-emerald-50/70 hover:text-white"
                          }`}
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export default function AppShell() {
  const { data: user } = useAuth();
  const { data: profile } = useSchoolProfile();
  const { data: dash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardData>("/dashboard"),
    refetchInterval: 120_000,
    retry: false,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const alerts = (dash?.stok_menipis ?? 0) + (dash?.stok_habis ?? 0);
  const initial = (user?.nama || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-svh bg-background">
      {/* Sidebar desktop */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar lg:flex">
        <Brand profile={profile} />
        <SidebarNav />
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            {user?.foto ? (
              <img src={user.foto} alt={user.nama} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-white">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-semibold text-white">{user?.nama}</div>
              <div className="truncate text-[10px] text-emerald-200/80">{user && labelRole(user.role)}</div>
            </div>
            <button
              onClick={() => endSession()}
              data-testid="sidebar-logout-button"
              title="Logout"
              className="rounded p-1.5 text-emerald-100/80 transition-colors hover:bg-sidebar-accent hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Header */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 shadow-xs backdrop-blur-md md:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            data-testid="sidebar-toggle-button"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden min-w-0 items-center gap-2 md:flex" data-testid="header-school-badge">
            <School className="h-4 w-4 shrink-0 text-emerald-700" />
            <span className="truncate text-sm font-semibold text-slate-800">
              {profile?.nama_sekolah || "SIMBARA SEKOLAH"}
            </span>
            {profile?.npsn && (
              <Badge variant="outline" className="hidden text-[10px] lg:inline-flex">
                NPSN {profile.npsn}
              </Badge>
            )}
          </div>

          <form
            className="ml-auto hidden md:block"
            onSubmit={(e) => {
              e.preventDefault();
              const v = new FormData(e.currentTarget).get("q");
              if (v) navigate(`/barang?q=${encodeURIComponent(String(v))}`);
            }}
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input name="q" placeholder="Cari barang…" className="w-52 pl-8" data-testid="global-search-input" />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 md:ml-2">
            {/* Aksi cepat */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="sm" data-testid="quick-action-button" className="hidden sm:inline-flex">
                    <Plus className="h-4 w-4" />
                    Tambah
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Aksi Cepat</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/barang?new=1")} data-testid="quick-action-tambah-barang">
                  <Package className="h-4 w-4" /> Tambah Barang
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/barang-masuk?new=1")} data-testid="quick-action-barang-masuk">
                  <ArrowDownToLine className="h-4 w-4" /> Catat Barang Masuk
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/barang-keluar?new=1")} data-testid="quick-action-barang-keluar">
                  <ArrowUpFromLine className="h-4 w-4" /> Catat Barang Keluar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/stok-opname?new=1")} data-testid="quick-action-stok-opname">
                  <ClipboardCheck className="h-4 w-4" /> Stok Opname
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifikasi stok */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="ghost" size="icon" className="relative" data-testid="notification-bell-button" aria-label="Peringatan stok">
                    <Bell className="h-5 w-5" />
                    {alerts > 0 && (
                      <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold text-white">
                        {alerts}
                      </span>
                    )}
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-72">
                <div className="text-sm font-semibold text-slate-900">Peringatan Stok</div>
                <div className="mt-2 space-y-1">
                  <Link
                    to="/barang?status=menipis"
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-amber-50"
                    data-testid="notification-menipis-link"
                  >
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" /> Stok menipis
                    </span>
                    <Badge className="bg-amber-100 text-amber-800">{dash?.stok_menipis ?? "-"}</Badge>
                  </Link>
                  <Link
                    to="/barang?status=habis"
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-rose-50"
                    data-testid="notification-habis-link"
                  >
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-500" /> Stok habis
                    </span>
                    <Badge className="bg-rose-100 text-rose-800">{dash?.stok_habis ?? "-"}</Badge>
                  </Link>
                  {alerts === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Semua stok aman.</div>}
                </div>
              </PopoverContent>
            </Popover>

            {/* Menu pengguna */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    className="flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-slate-100"
                    data-testid="user-menu-button"
                  >
                    {user?.foto ? (
                      <img src={user.foto} alt={user.nama} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                        {initial}
                      </span>
                    )}
                    <span className="hidden text-left text-xs leading-tight sm:block">
                      <span className="block max-w-32 truncate font-semibold text-slate-800">{user?.nama}</span>
                      <span className="block text-[10px] text-muted-foreground">{user && labelRole(user.role)}</span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate">{user?.nama}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    @{user?.username} · {user && labelRole(user.role)}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profil")} data-testid="menu-profil-saya">
                  <UserRound className="h-4 w-4" /> Profil Saya
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/pengaturan")} data-testid="menu-pengaturan">
                  <Settings className="h-4 w-4" /> Pengaturan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => endSession()} data-testid="menu-logout">
                  <LogOut className="h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="page-in mx-auto w-full max-w-7xl p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Sidebar mobile */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 gap-0 overflow-y-auto bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
          <Brand profile={profile} />
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
          <div className="mt-auto border-t border-sidebar-border p-3">
            <button
              onClick={() => endSession()}
              data-testid="mobile-logout-button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-emerald-50/85 transition-colors hover:bg-sidebar-accent hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
