import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiPut } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { JENIS_OPTIONS, KATEGORI, KONDISI, SATUAN_OPTIONS, type Item, type ItemInput } from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";

const EMPTY: ItemInput = {
  kode: "",
  nama: "",
  jenis: "persediaan",
  kategori: "ATK",
  merk: "",
  tipe_model: "",
  spesifikasi: "",
  satuan: "Buah",
  tahun: null,
  sumber_dana: "",
  lokasi: "",
  kondisi: "Baik",
  status: "aktif",
  nomor_seri: "",
  nup: "",
  stok_awal: 0,
  stok_minimum: 5,
  harga_satuan: 0,
  keterangan: "",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: Item | null;
  lokasiOptions?: string[];
}

// Form tambah/edit master barang.
export default function ItemFormDialog({ open, onOpenChange, item, lokasiOptions }: Props) {
  const [form, setForm] = useState<ItemInput>(EMPTY);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm(
        item
          ? {
              kode: item.kode,
              nama: item.nama,
              jenis: item.jenis,
              kategori: item.kategori,
              merk: item.merk,
              tipe_model: item.tipe_model,
              spesifikasi: item.spesifikasi,
              satuan: item.satuan,
              tahun: item.tahun,
              sumber_dana: item.sumber_dana,
              lokasi: item.lokasi,
              kondisi: item.kondisi,
              status: item.status,
              nomor_seri: item.nomor_seri,
              nup: item.nup,
              stok_awal: item.stok_awal,
              stok_minimum: item.stok_minimum,
              harga_satuan: item.harga_satuan,
              keterangan: item.keterangan,
            }
          : EMPTY,
      );
    }
  }, [open, item]);

  const m = useMutation({
    mutationFn: () => (item ? apiPut<Item>(`/items/${item.id}`, form) : apiPost<Item>("/items", form)),
    onSuccess: () => {
      toast.success(item ? "Barang berhasil diperbarui" : "Barang berhasil ditambahkan");
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const set = <K extends keyof ItemInput>(k: K, v: ItemInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="item-form-dialog">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Barang" : "Tambah Barang"}</DialogTitle>
          <DialogDescription>
            Stok saat ini dihitung otomatis dari histori transaksi (Stok Awal + Barang Masuk − Barang Keluar).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="item-kode">Kode Barang</Label>
            <Input
              id="item-kode"
              value={form.kode}
              onChange={(e) => set("kode", e.target.value)}
              placeholder="Kosongkan untuk kode otomatis (BRG-xxxx)"
              data-testid="item-form-input-kode"
            />
          </div>
          <div>
            <Label htmlFor="item-nama">Nama Barang *</Label>
            <Input
              id="item-nama"
              value={form.nama}
              onChange={(e) => set("nama", e.target.value)}
              placeholder="cth. Kertas A4 Sinar Dunia"
              data-testid="item-form-input-nama"
            />
          </div>
          <div>
            <Label>Jenis Barang</Label>
            <Select value={form.jenis} onValueChange={(v: string) => set("jenis", v)}>
              <SelectTrigger data-testid="item-form-select-jenis">
                <SelectValue>{(v) => JENIS_OPTIONS.find((j) => j.value === v)?.label ?? "Persediaan"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {JENIS_OPTIONS.map((j) => (
                  <SelectItem key={j.value} value={j.value}>
                    {j.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Kategori</Label>
            <Select value={form.kategori} onValueChange={(v: string) => set("kategori", v)}>
              <SelectTrigger data-testid="item-form-select-kategori">
                <SelectValue>{(v) => v || "Lainnya"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {KATEGORI.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="item-satuan">Satuan</Label>
            <Input
              id="item-satuan"
              list="satuan-options"
              value={form.satuan}
              onChange={(e) => set("satuan", e.target.value)}
              placeholder="cth. Buah / Rim / Unit"
              data-testid="item-form-input-satuan"
            />
          </div>
          <div>
            <Label htmlFor="item-tahun">Tahun Perolehan</Label>
            <Input
              id="item-tahun"
              type="number"
              value={form.tahun ?? ""}
              onChange={(e) => set("tahun", e.target.value ? Number(e.target.value) : null)}
              placeholder="cth. 2024"
              data-testid="item-form-input-tahun"
            />
          </div>
          <div>
            <Label htmlFor="item-lokasi">Lokasi/Ruang</Label>
            <Input
              id="item-lokasi"
              list="lokasi-options"
              value={form.lokasi}
              onChange={(e) => set("lokasi", e.target.value)}
              placeholder="cth. Gudang Utama"
              data-testid="item-form-input-lokasi"
            />
          </div>
          <div>
            <Label>Kondisi</Label>
            <Select value={form.kondisi} onValueChange={(v: string) => set("kondisi", v)}>
              <SelectTrigger data-testid="item-form-select-kondisi">
                <SelectValue>{(v) => v || "Baik"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {KONDISI.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="item-stok-awal">Stok Awal *</Label>
            <Input
              id="item-stok-awal"
              type="number"
              min={0}
              value={form.stok_awal}
              onChange={(e) => set("stok_awal", Number(e.target.value) || 0)}
              data-testid="item-form-input-stok-awal"
            />
          </div>
          <div>
            <Label htmlFor="item-stok-min">Stok Minimum (peringatan)</Label>
            <Input
              id="item-stok-min"
              type="number"
              min={0}
              value={form.stok_minimum}
              onChange={(e) => set("stok_minimum", Number(e.target.value) || 0)}
              data-testid="item-form-input-stok-minimum"
            />
          </div>
          <div>
            <Label htmlFor="item-harga">Harga Satuan (Rp)</Label>
            <Input
              id="item-harga"
              type="number"
              min={0}
              value={form.harga_satuan}
              onChange={(e) => set("harga_satuan", Number(e.target.value) || 0)}
              data-testid="item-form-input-harga"
            />
          </div>
          <div>
            <Label htmlFor="item-merk">Merk</Label>
            <Input id="item-merk" value={form.merk} onChange={(e) => set("merk", e.target.value)} placeholder="cth. Sinar Dunia" data-testid="item-form-input-merk" />
          </div>
          <div>
            <Label htmlFor="item-tipe">Tipe / Model</Label>
            <Input id="item-tipe" value={form.tipe_model} onChange={(e) => set("tipe_model", e.target.value)} placeholder="cth. A4 70gr" data-testid="item-form-input-tipe" />
          </div>
          <div>
            <Label htmlFor="item-sumber">Sumber Dana</Label>
            <Input id="item-sumber" value={form.sumber_dana} onChange={(e) => set("sumber_dana", e.target.value)} placeholder="cth. BOS Reguler" data-testid="item-form-input-sumber-dana" />
          </div>
          <div>
            <Label htmlFor="item-seri">Nomor Seri</Label>
            <Input id="item-seri" value={form.nomor_seri} onChange={(e) => set("nomor_seri", e.target.value)} placeholder="Khusus aset/inventaris" data-testid="item-form-input-nomor-seri" />
          </div>
          <div>
            <Label htmlFor="item-nup">NUP</Label>
            <Input id="item-nup" value={form.nup} onChange={(e) => set("nup", e.target.value)} placeholder="Nomor Urut Pendaftaran" data-testid="item-form-input-nup" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="item-spesifikasi">Spesifikasi</Label>
            <Input id="item-spesifikasi" value={form.spesifikasi} onChange={(e) => set("spesifikasi", e.target.value)} placeholder="cth. Core i5 / RAM 8GB / SSD 512GB" data-testid="item-form-input-spesifikasi" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="item-keterangan">Keterangan</Label>
            <Textarea
              id="item-keterangan"
              value={form.keterangan}
              onChange={(e) => set("keterangan", e.target.value)}
              rows={2}
              placeholder="Catatan tambahan (opsional)"
              data-testid="item-form-input-keterangan"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="item-form-cancel-button">
            Batal
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || !form.nama.trim()}
            data-testid="item-form-save-button"
          >
            {m.isPending ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
        <datalist id="lokasi-options">
          {(lokasiOptions ?? []).map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <datalist id="satuan-options">
          {SATUAN_OPTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </DialogContent>
    </Dialog>
  );
}
