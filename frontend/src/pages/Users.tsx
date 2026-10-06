import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut, downloadFile } from "@/lib/api";
import { errMsg, fmtWaktu, labelRole } from "@/lib/format";
import { useAuth } from "@/lib/session";
import type { AuthUser } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmDialog from "@/components/confirm-dialog";

interface FormState {
  nama: string;
  username: string;
  email: string;
  nip: string;
  role: string;
  password: string;
}

const EMPTY: FormState = { nama: "", username: "", email: "", nip: "", role: "pengurus", password: "" };

// Manajemen Pengguna (khusus Administrator).
export default function Users() {
  const { data: me } = useAuth();
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<AuthUser[]>("/users"),
    retry: false,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleting, setDeleting] = useState<AuthUser | null>(null);
  const [resetting, setResetting] = useState<AuthUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (formOpen) {
      setForm(
        editing
          ? { nama: editing.nama, username: editing.username, email: editing.email, nip: editing.nip, role: editing.role, password: "" }
          : EMPTY,
      );
    }
  }, [formOpen, editing]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? apiPut<AuthUser>(`/users/${editing.id}`, {
            nama: form.nama,
            username: form.username,
            email: form.email,
            nip: form.nip,
            role: form.role,
          })
        : apiPost<AuthUser>("/users", form),
    onSuccess: () => {
      toast.success(editing ? "Data pengguna diperbarui" : "Pengguna baru berhasil ditambahkan");
      invalidate();
      setFormOpen(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const toggleAktif = useMutation({
    mutationFn: (u: AuthUser) => apiPut<AuthUser>(`/users/${u.id}`, { aktif: !u.aktif }),
    onSuccess: (u) => {
      toast.success(`Akun ${u.username} kini ${u.aktif ? "aktif" : "non-aktif"}`);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const resetPass = useMutation({
    mutationFn: () => apiPut<AuthUser>(`/users/${resetting!.id}`, { password: newPassword }),
    onSuccess: () => {
      toast.success(`Password ${resetting?.username} berhasil direset`);
      setResetting(null);
      setNewPassword("");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiDelete<{ message: string }>(`/users/${id}`),
    onSuccess: (r) => {
      toast.success(r.message);
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const list = users ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Manajemen Pengguna</h1>
          <p className="text-sm text-muted-foreground">Kelola akun Administrator dan Pengurus Barang.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadFile("/export/pengguna")} data-testid="user-export-button">
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            data-testid="user-add-button"
          >
            <Plus className="h-4 w-4" /> Tambah Pengguna
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card" data-testid="user-table">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>NIP</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Memuat data…
                </TableCell>
              </TableRow>
            )}
            {list.map((u) => (
              <TableRow key={u.id} data-testid={`user-row-${u.username}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {u.foto ? (
                      <img src={u.foto} alt={u.nama} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                        {u.nama.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm font-medium">{u.nama}</span>
                    {u.id === me?.id && <Badge variant="outline" className="text-[10px]">Anda</Badge>}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{u.username}</TableCell>
                <TableCell className="max-w-48 truncate text-sm">{u.email || "-"}</TableCell>
                <TableCell>
                  <Badge className={u.role === "admin" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}>
                    {u.role === "admin" ? <ShieldCheck className="mr-1 h-3 w-3" /> : <UserRound className="mr-1 h-3 w-3" />}
                    {labelRole(u.role)}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{u.nip || "-"}</TableCell>
                <TableCell>
                  <button
                    onClick={() => toggleAktif.mutate(u)}
                    disabled={toggleAktif.isPending}
                    data-testid={`user-toggle-${u.username}`}
                    title="Klik untuk mengubah status"
                  >
                    <Badge className={u.aktif ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}>
                      {u.aktif ? "Aktif" : "Non-Aktif"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtWaktu(u.created_at)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setEditing(u);
                        setFormOpen(true);
                      }}
                      title="Edit"
                      data-testid={`user-edit-button-${u.username}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setResetting(u);
                        setNewPassword("");
                      }}
                      title="Reset Password"
                      data-testid={`user-reset-button-${u.username}`}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleting(u)}
                      title="Hapus"
                      className="text-rose-600 hover:text-rose-700"
                      data-testid={`user-delete-button-${u.username}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Form tambah/edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="user-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Pengguna" : "Tambah Pengguna"}</DialogTitle>
            <DialogDescription>
              {editing ? "Perbarui data akun. Gunakan tombol kunci untuk mengganti password." : "Akun baru langsung dapat digunakan untuk login."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="user-nama">Nama Lengkap *</Label>
              <Input id="user-nama" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} data-testid="user-form-input-nama" />
            </div>
            <div>
              <Label htmlFor="user-username">Username *</Label>
              <Input id="user-username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} data-testid="user-form-input-username" />
            </div>
            <div>
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} data-testid="user-form-input-email" />
            </div>
            <div>
              <Label htmlFor="user-nip">NIP</Label>
              <Input id="user-nip" value={form.nip} onChange={(e) => setForm((f) => ({ ...f, nip: e.target.value }))} data-testid="user-form-input-nip" />
            </div>
            <div>
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v: string) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="user-form-select-role">
                  <SelectValue>{(v) => labelRole(v as string)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="pengurus">Pengurus Barang</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editing && (
              <div className="sm:col-span-2">
                <Label htmlFor="user-password">Password * (minimal 5 karakter)</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  data-testid="user-form-input-password"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} data-testid="user-form-cancel-button">
              Batal
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.nama.trim() || !form.username.trim() || (!editing && form.password.length < 5)}
              data-testid="user-form-save-button"
            >
              {save.isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={Boolean(resetting)} onOpenChange={(v) => !v && setResetting(null)}>
        <DialogContent className="sm:max-w-md" data-testid="user-reset-dialog">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Password baru untuk akun {resetting?.username}.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="user-newpass">Password Baru (minimal 5 karakter)</Label>
            <Input id="user-newpass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} data-testid="user-reset-input" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetting(null)} data-testid="user-reset-cancel-button">
              Batal
            </Button>
            <Button onClick={() => resetPass.mutate()} disabled={resetPass.isPending || newPassword.length < 5} data-testid="user-reset-save-button">
              {resetPass.isPending ? "Menyimpan…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Hapus akun ${deleting?.username ?? ""}?`}
        description="Akun akan dihapus permanen. Riwayat aktivitas yang sudah tercatat tetap tersimpan."
        confirmLabel="Ya, Hapus"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </div>
  );
}
