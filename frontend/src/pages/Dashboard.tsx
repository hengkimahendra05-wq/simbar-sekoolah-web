import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Laptop,
  Layers,
  PackageCheck,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/lib/recharts";
import { apiGet } from "@/lib/api";
import { fmtAngka, fmtTanggal, labelJenis } from "@/lib/format";
import { useAuth } from "@/lib/session";
import type { DashboardData } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const COLORS = ["#059669", "#0284c7", "#d97706", "#0f766e", "#e11d48", "#64748b"];
const KONDISI_COLORS: Record<string, string> = { Baik: "#059669", "Rusak Ringan": "#d97706", "Rusak Berat": "#e11d48" };

interface Kpi {
  id: string;
  title: string;
  desc: string;
  value: number;
  icon: LucideIcon;
  strip: string;
  chip: string;
}

export default function Dashboard() {
  const { data: user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardData>("/dashboard"),
    retry: false,
  });

  const kpis: Kpi[] = data
    ? [
        { id: "total-jenis", title: "Total Jenis Barang", desc: "Seluruh barang terdaftar", value: data.total_jenis, icon: Boxes, strip: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
        { id: "total-persediaan", title: "Barang Persediaan", desc: "ATK & barang habis pakai", value: data.total_persediaan, icon: Layers, strip: "bg-sky-500", chip: "bg-sky-100 text-sky-700" },
        { id: "total-aset", title: "Inventaris / Aset", desc: "Meubelair & elektronik", value: data.total_inventaris, icon: Laptop, strip: "bg-indigo-500", chip: "bg-indigo-100 text-indigo-700" },
        { id: "total-unit", title: "Total Stok Saat Ini", desc: "Akumulasi seluruh unit", value: data.total_unit, icon: PackageCheck, strip: "bg-teal-500", chip: "bg-teal-100 text-teal-700" },
        { id: "masuk-bulan-ini", title: "Barang Masuk Bulan Ini", desc: "Pengadaan & penerimaan", value: data.masuk_bulan_ini, icon: TrendingUp, strip: "bg-emerald-600", chip: "bg-emerald-100 text-emerald-700" },
        { id: "keluar-bulan-ini", title: "Barang Keluar Bulan Ini", desc: "Pemakaian & distribusi", value: data.keluar_bulan_ini, icon: TrendingDown, strip: "bg-amber-500", chip: "bg-amber-100 text-amber-700" },
        { id: "stok-menipis", title: "Stok Menipis", desc: "≤ batas minimum", value: data.stok_menipis, icon: AlertTriangle, strip: "bg-amber-600", chip: "bg-amber-100 text-amber-700" },
        { id: "stok-habis", title: "Stok Habis", desc: "Segera lakukan pengadaan", value: data.stok_habis, icon: AlertCircle, strip: "bg-rose-500", chip: "bg-rose-100 text-rose-700" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Selamat datang, <span className="font-semibold text-slate-700">{user?.nama ?? "Pengguna"}</span> — berikut
          ringkasan barang sekolah hari ini.
        </p>
      </div>

      {isError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" data-testid="dashboard-error">
          Tidak dapat memuat data dashboard. Pastikan koneksi ke server tersedia, lalu muat ulang halaman.
        </div>
      )}

      {/* Kartu statistik */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="dashboard-kpi-grid">
        {isLoading &&
          Array.from({ length: 8 }, (_, i) => `kpi-skeleton-${i}`).map((key) => (
            <div key={key} className="h-[104px] animate-pulse rounded-xl border bg-white/60" />
          ))}
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.id} className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-card p-4 transition-transform hover:-translate-y-0.5" data-testid={`dashboard-kpi-${k.id}`}>
              <span className={`absolute inset-x-0 top-0 h-1 ${k.strip}`} aria-hidden />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-muted-foreground">{k.title}</div>
                  <div className="mt-1 font-heading text-2xl font-bold tabular-nums tracking-tight text-slate-900" data-testid={`dashboard-kpi-value-${k.id}`}>
                    {fmtAngka(k.value)}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{k.desc}</div>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${k.chip}`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grafik */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7" data-testid="dashboard-chart-tren">
          <CardHeader>
            <CardTitle className="text-base">Tren Pengadaan vs Pengambilan</CardTitle>
            <CardDescription>6 bulan terakhir (jumlah unit barang masuk dan keluar)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {data && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.tren_bulanan} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip formatter={(v: number) => `${fmtAngka(v)} unit`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="masuk" name="Barang Masuk" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="keluar" name="Barang Keluar" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5" data-testid="dashboard-chart-kategori">
          <CardHeader>
            <CardTitle className="text-base">Komposisi Stok per Kategori</CardTitle>
            <CardDescription>Jumlah unit stok saat ini</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {data && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.stok_kategori}
                      dataKey="stok"
                      nameKey="kategori"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                      strokeWidth={1}
                    >
                      {data.stok_kategori.map((s, i) => (
                        <Cell key={s.kategori} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${fmtAngka(v)} unit`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-6" data-testid="dashboard-chart-jenis">
          <CardHeader>
            <CardTitle className="text-base">Persediaan vs Inventaris</CardTitle>
            <CardDescription>Jumlah jenis barang berdasarkan kelompok</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {data && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.jumlah_jenis} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                    <YAxis type="category" dataKey="nama" width={120} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip formatter={(v: number) => `${fmtAngka(v)} jenis`} />
                    <Bar dataKey="jumlah" name="Jumlah Jenis" fill="#0284c7" radius={[0, 4, 4, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-6" data-testid="dashboard-chart-kondisi">
          <CardHeader>
            <CardTitle className="text-base">Kondisi Barang &amp; Aset</CardTitle>
            <CardDescription>Distribusi jenis barang menurut kondisi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {data && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.kondisi} dataKey="jumlah" nameKey="nama" outerRadius={80} paddingAngle={2} strokeWidth={1}>
                      {data.kondisi.map((entry) => (
                        <Cell key={entry.nama} fill={KONDISI_COLORS[entry.nama] ?? "#64748b"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${fmtAngka(v)} jenis`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaksi terbaru */}
      <Card data-testid="dashboard-transaksi-terbaru">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Transaksi Terbaru</CardTitle>
            <CardDescription>8 mutasi barang terakhir</CardDescription>
          </div>
          <Link to="/barang-masuk" className="text-xs font-medium text-emerald-700 hover:underline" data-testid="dashboard-link-barang-masuk">
            Lihat Barang Masuk
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No. Transaksi</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Petugas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.transaksi_terbaru ?? []).map((t) => (
                  <TableRow key={t.id} data-testid={`dashboard-row-${t.nomor}`}>
                    <TableCell className="whitespace-nowrap text-sm">{fmtTanggal(t.tanggal)}</TableCell>
                    <TableCell className="font-mono text-xs">{t.nomor}</TableCell>
                    <TableCell>
                      {t.jenis === "masuk" ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Masuk</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800">Keluar</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-sm">
                      {t.nama_barang}
                      <span className="ml-1 text-xs text-muted-foreground">· {labelJenis(t.kategori ? "" : "")}{t.kategori}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {fmtAngka(t.jumlah)} {t.satuan}
                    </TableCell>
                    <TableCell className="text-sm">{t.user_name}</TableCell>
                  </TableRow>
                ))}
                {data && data.transaksi_terbaru.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Belum ada transaksi. Catat barang masuk untuk memulai.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
