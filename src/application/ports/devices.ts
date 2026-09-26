/** Tarayıcı yetenekleri için portlar; uygulaması infrastructure'da, bağlama composition'da. */

export type ShareOutcome =
  /** Sistem paylaşım menüsü başarılı döndü (P3: kesin teyit yok, kabul). */
  | { readonly kind: "shared" }
  /** Kullanıcı vazgeçti (AbortError) — sessiz, sipariş "hazır" kalır (P2). */
  | { readonly kind: "cancelled" }
  /** Dosya paylaşımı yok (PC): indirildi / panoya kopyalandı / WhatsApp Web açıldı (P1). */
  | { readonly kind: "fallback"; readonly downloaded: boolean; readonly copied: boolean }
  | { readonly kind: "failed"; readonly message: string };

export interface ShareService {
  /** Bu cihaz dosya paylaşımını destekliyor mu? */
  canShareFiles(): boolean;
  sharePng(blob: Blob, fileName: string, title: string): Promise<ShareOutcome>;
  download(blob: Blob, fileName: string): void;
  copyImage(blob: Blob): Promise<boolean>;
  openWhatsAppWeb(): void;
}

export interface PngRenderer {
  /** DOM düğümünü 1080 px genişlikte PNG'ye çevirir; yazı tipi yüklenmesini bekler (P5). */
  render(node: HTMLElement): Promise<Blob>;
}

export interface ImageResizer {
  /** Yüklenen görseli ~600 px WebP data URL'ye küçültür (D3). */
  resize(file: File): Promise<string>;
}

/** Güncelleme denetimi: "ready" = yeni sürüm iniyor ya da hazır; "unavailable" = çevrimdışı çalışma kurulmamış. */
export type UpdateCheck = "ready" | "current" | "failed" | "unavailable";
