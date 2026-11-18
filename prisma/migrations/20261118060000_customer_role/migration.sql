-- Peran baru untuk pelanggan yang login Google.
-- Dipisah dari migrasi berikutnya karena nilai enum baru baru boleh dipakai
-- (mis. sebagai DEFAULT) setelah transaksi ini selesai.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CUSTOMER';
