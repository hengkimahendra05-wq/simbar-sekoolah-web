import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, ImageUp, Save, Trash2 } from "lucide-react";
import { apiPut } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { useAuth, useSchoolProfile } from "@/lib/session";
import type { SchoolProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KopSurat } from "@/components/kop-surat";

const EMPTY: SchoolProfile = {
  nama_sekolah: "", npsn: "", alamat: "", kelurahan: "", kecamatan: "", kota: "", provinsi: "", kode_pos: "",
  telepon: "", email: "", website: "", kepala_sekolah: "", nip_kepala: "", pengurus_barang: "", nip_pengurus: "", logo: "",
};

const FIELDS: { key: keyof SchoolProfile; label: string; placeholder?: string; wide?: boolean }[] = [
  { key: "nama_sekolah", label: "Nama Sekolah", placeholder: "cth. SMP NEGERI 1 TELADAN", wide: true },
  { key: "npsn", label: "NPSN", placeholder: "cth. 20219742" },
  { key: "kode_pos", label: "Kode Pos", placeholder: "cth. 16915" },
  { key: "kelurahan", label: "Kelurahan/Desa" },
  { key: "kecamatan", label: "Kecamatan" },
  { key: "kota", label: "Kota/Kabupaten" },
  { key: "provinsi", label: "Provinsi" },
  { key: "telepon", label: "Telepon", placeholder: "cth. (0251) 8654321" },
  { key: "email", label: "Email Sekolah" },
  { key: "website", label: "Website", placeholder: "cth. smpn1teladan.sch.id" },
  { key: "kepala_sekolah", label: "Nama Kepala Sekolah" },
  { key: "nip_kepala", label: "NIP Kepala Sekolah" },
  { key: "pengurus_barang", label: "Nama Pengurus Barang" },
  { key: "nip_pengurus", label: "NIP Pengurus Barang" },
];

// Profil Sekolah — dipakai otomatis pada kop semua laporan & dokumen cetak (khusus Administrator).
export default function SchoolProfilePage() {
  const { data: user } = useAuth();
  const { data: profile } = useSchoolProfile();
  const [form, setForm] = useState<SchoolProfile>(EMPTY);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const save = useMutation({
    mutationFn: () => apiPut<SchoolProfile>("/school-profile", form),
    onSuccess: () => {
      toast.success("Profil sekolah berhasil disimpan");
      qc.invalidateQueries({ queryKey: ["school-profile"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const set = (k: keyof SchoolProfile, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onLogo = (file?: File) => {
    if (!file) return;
    if (file.size > 1_000_000) {
      toast.error("Ukuran logo maksimal 1 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("logo", String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Profil Sekolah</h1>
        <p className="text-sm text-muted-foreground">
          Data ini otomatis dipakai pada kop surat semua laporan dan dokumen yang dicetak.
        </p>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="school-readonly-notice">
          Hanya Administrator yang dapat mengubah profil sekolah. Anda dapat melihat data di bawah ini.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Identitas Sekolah</CardTitle>
            <CardDescription>Lengkapi data agar kop laporan tampil rapi dan resmi.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                  <Label htmlFor={`school-${f.key}`}>{f.label}</Label>
                  <Input
                    id={`school-${f.key}`}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    disabled={!isAdmin}
                    data-testid={`school-input-${f.key}`}
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <Label htmlFor="school-alamat">Alamat Lengkap</Label>
                <Textarea
                  id="school-alamat"
                  rows={2}
                  value={form.alamat}
                  onChange={(e) => set("alamat", e.target.value)}
                  placeholder="cth. Jl. Pendidikan No. 45"
                  disabled={!isAdmin}
                  data-testid="school-input-alamat"
                />
              </div>
            </div>
            {isAdmin && (
              <div className="mt-4 flex justify-end">
                <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="school-save-button">
                  <Save className="h-4 w-4" /> {save.isPending ? "Menyimpan…" : "Simpan Profil"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logo Sekolah</CardTitle>
              <CardDescription>Tampil pada kop laporan (maks 1 MB).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-slate-50">
                {form.logo ? (
                  <img src={form.logo} alt="Logo Sekolah" className="max-h-28 object-contain" data-testid="school-logo-preview" />
                ) : (
                  <Building2 className="h-10 w-10 text-slate-300" />
                )}
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()} data-testid="school-logo-upload-button">
                    <ImageUp className="h-4 w-4" /> Pilih Logo
                  </Button>
                  {form.logo && (
                    <Button variant="outline" size="sm" onClick={() => set("logo", "")} data-testid="school-logo-remove-button">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onLogo(e.target.files?.[0])}
                    data-testid="school-logo-input"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pratinjau Kop Surat</CardTitle>
              <CardDescription>Tampilan pada laporan tercetak.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-white p-3" data-testid="school-kop-preview">
                <KopSurat profile={form} title="CONTOH JUDUL LAPORAN" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
