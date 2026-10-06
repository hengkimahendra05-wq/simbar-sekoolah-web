import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageUp, KeyRound, Save, Trash2 } from "lucide-react";
import { apiPut } from "@/lib/api";
import { errMsg, labelRole } from "@/lib/format";
import { useAuth } from "@/lib/session";
import type { AuthUser } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Profil Pengguna: setiap pengguna dapat mengubah nama, username, email, foto, dan password sendiri.
export default function Profile() {
  const { data: user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nama, setNama] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [foto, setFoto] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user) {
      setNama(user.nama);
      setUsername(user.username);
      setEmail(user.email);
      setFoto(user.foto);
    }
  }, [user]);

  const saveProfile = useMutation({
    mutationFn: () => apiPut<AuthUser>("/auth/profile", { nama, username, email, foto }),
    onSuccess: (u) => {
      toast.success("Profil berhasil disimpan");
      qc.setQueryData(["me"], u);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const savePassword = useMutation({
    mutationFn: () => apiPut<AuthUser>("/auth/profile", { current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      toast.success("Password berhasil diganti");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const onFoto = (file?: File) => {
    if (!file) return;
    if (file.size > 1_000_000) {
      toast.error("Ukuran foto maksimal 1 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFoto(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submitPassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak sama");
      return;
    }
    savePassword.mutate();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Profil Saya</h1>
        <p className="text-sm text-muted-foreground">Kelola data akun dan password Anda.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Data Akun</CardTitle>
            <CardDescription>
              Role Anda:{" "}
              <Badge className={user?.role === "admin" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}>
                {user && labelRole(user.role)}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="profil-nama">Nama Lengkap</Label>
                <Input id="profil-nama" value={nama} onChange={(e) => setNama(e.target.value)} data-testid="profile-input-nama" />
              </div>
              <div>
                <Label htmlFor="profil-username">Username</Label>
                <Input id="profil-username" value={username} onChange={(e) => setUsername(e.target.value)} data-testid="profile-input-username" />
              </div>
              <div>
                <Label htmlFor="profil-email">Email</Label>
                <Input id="profil-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="profile-input-email" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending || !nama.trim()} data-testid="profile-save-button">
                <Save className="h-4 w-4" /> {saveProfile.isPending ? "Menyimpan…" : "Simpan Profil"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Foto Profil</CardTitle>
            <CardDescription>Maksimal 1 MB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-center">
              {foto ? (
                <img src={foto} alt="Foto profil" className="h-28 w-28 rounded-full object-cover" data-testid="profile-foto-preview" />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-700 font-heading text-3xl font-bold text-white">
                  {(user?.nama ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()} data-testid="profile-foto-upload-button">
                <ImageUp className="h-4 w-4" /> Pilih Foto
              </Button>
              {foto && (
                <Button variant="outline" size="sm" onClick={() => setFoto("")} data-testid="profile-foto-remove-button">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFoto(e.target.files?.[0])} data-testid="profile-foto-input" />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ganti Password</CardTitle>
            <CardDescription>Masukkan password saat ini untuk keamanan.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="profil-current">Password Saat Ini</Label>
                <Input id="profil-current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} data-testid="profile-input-current-password" />
              </div>
              <div>
                <Label htmlFor="profil-new">Password Baru</Label>
                <Input id="profil-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} data-testid="profile-input-new-password" />
              </div>
              <div>
                <Label htmlFor="profil-confirm">Konfirmasi Password</Label>
                <Input id="profil-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} data-testid="profile-input-confirm-password" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={submitPassword}
                disabled={savePassword.isPending || !currentPassword || newPassword.length < 5}
                data-testid="profile-password-save-button"
              >
                <KeyRound className="h-4 w-4" /> {savePassword.isPending ? "Menyimpan…" : "Ganti Password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
